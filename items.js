/* The item list: the tracker's filter bar, working on rows loaded from data/*.json. Read-only. */
(function () {
  var L = 0, TI = 1, U = 2, B = 3, Y = 4, R = 5, S = 6, ST = 7, NX = 8, DL = 9, PO = 10, AC = 11, IM = 12, CO = 13, CH = 14, WH = 15, OP = 16;
  var TYPE = { market_notice: "Market notice", news_release: "News release", puc_docket: "Docket", puc_project: "Project / rulemaking",
    puc_news: "News release", bill: "Bill", interim_charge: "Interim charges" };
  var RV = { h: 3, m: 2, l: 1 }, PAGE = 100, el = T.el;
  var form = document.getElementById("filters"), tbody = document.querySelector("#items tbody"), count = document.getElementById("count"),
    pager = document.getElementById("pager");
  var data = null, rows = [], loaded = {}, page = 1, shown = [], wantType = "", timer = null;

  function typeName(r) { return TYPE[r[Y]] || r[Y]; }
  function val(name) { var f = form.elements[name]; return f.type === "checkbox" ? (f.checked ? "1" : "") : f.value; }
  function state() {
    return { q: val("q").trim(), source: val("source"), type: val("type"), rel: val("rel"), status: val("status"), from: val("from"), to: val("to"),
      sort: val("sort"), imm: val("imm"), deadline: val("deadline") };
  }
  function fromUrl() {
    var p = new URLSearchParams(location.search);
    ["q", "source", "rel", "status", "from", "to", "sort"].forEach(function (k) { if (p.get(k)) form.elements[k].value = p.get(k); });
    ["imm", "deadline"].forEach(function (k) { form.elements[k].checked = p.get(k) === "1"; });
    page = Math.max(1, parseInt(p.get("page") || "1", 10) || 1);
    wantType = p.get("type") || "";
  }
  function toUrl(s) {
    var p = new URLSearchParams();
    Object.keys(s).forEach(function (k) { if (s[k] && !(k === "status" && s[k] === "open") && !(k === "sort" && s[k] === "queue")) p.set(k, s[k]); });
    if (page > 1) p.set("page", page);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }
  function inStatus(r, status) { return status === "all" || (status === "open") === (r[OP] === 1); }
  function types() {
    var sel = form.elements.type, keep = sel.value || wantType, counts = {}, s = state();
    rows.forEach(function (r) { if ((!s.source || r[B] === s.source) && inStatus(r, s.status)) { var k = r[B] + "|" + r[Y]; counts[k] = (counts[k] || 0) + 1; } });
    T.clear(sel);
    sel.appendChild(el("option", { value: "", text: "All" }));
    Object.keys(counts).sort().forEach(function (k) {
      var b = k.split("|")[0], y = k.split("|")[1];
      sel.appendChild(el("option", { value: y, text: T.BODY[b] + ": " + (TYPE[y] || y) + " (" + counts[k].toLocaleString() + ")" }));
    });
    sel.value = keep;
    if (sel.value !== keep) sel.value = ""; else if (keep === wantType) wantType = "";
  }
  function ensure(s, then) {       // the settled items are fetched only when a filter asks for them
    var need = s.status === "open" ? [] : data.buckets.filter(function (b) { return (!s.source || b.body === s.source) && !loaded[b.file]; });
    if (!need.length) return then();
    count.textContent = "Loading " + need.reduce(function (n, b) { return n + b.n; }, 0).toLocaleString() + " older items.";
    Promise.all(need.map(function (b) { loaded[b.file] = true; return T.get(b.file).then(function (d) { rows = rows.concat(d.rows); }); }))
      .then(then, function () { count.textContent = "The older items could not be loaded. Reload the page to try again."; });
  }
  function text(r) { return r._s || (r._s = (r[L] + " " + r[TI] + " " + typeName(r) + " " + T.BODY[r[B]]).toLowerCase()); }
  function keep(r, s, words) {
    if (!inStatus(r, s.status) || (s.source && r[B] !== s.source) || (s.type && r[Y] !== s.type) || (s.rel && r[R] !== s.rel)) return false;
    if (s.imm && (!r[IM] || r[IM] === "IMM: no opinion")) return false;
    if (s.deadline && !r[DL]) return false;
    if ((s.from && (!r[AC] || r[AC] < s.from)) || (s.to && (!r[AC] || r[AC] > s.to))) return false;
    if (words.length) { var t = text(r); for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) < 0) return false; }
    return true;
  }
  function str(a, b, desc) { if (!a && !b) return 0; if (!a) return 1; if (!b) return -1; return a === b ? 0 : (a < b) === !desc ? -1 : 1; }
  function num(a, b) { if (a === null && b === null) return 0; if (a === null) return 1; if (b === null) return -1; return b - a; }
  var SORT = {
    queue: function (a, b) { return RV[b[R]] - RV[a[R]] || str(a[DL], b[DL]) || num(a[S], b[S]) || str(a[AC], b[AC], true); },
    score: function (a, b) { return num(a[S], b[S]) || str(a[DL], b[DL]); },
    deadline: function (a, b) { return str(a[DL], b[DL]) || RV[b[R]] - RV[a[R]]; },
    activity: function (a, b) { return str(a[AC], b[AC], true); },
    changed: function (a, b) { return str(a[CO], b[CO], true) || str(a[AC], b[AC], true); },
    posted: function (a, b) { return str(a[PO], b[PO], true); },
    id: function (a, b) { return str(a[B], b[B]) || str(a[Y], b[Y]) || a[L].localeCompare(b[L], undefined, { numeric: true }); }
  };
  function immTag(r) { return el("span", { class: "tag" + (r[IM] === "IMM: no opinion" ? "" : " imm"), text: r[IM] }); }
  function toggle(r, tr) {       // the read-only counterpart of the tracker's item page
    var nxt = tr.nextSibling;
    if (nxt && nxt.className === "detail") { nxt.parentNode.removeChild(nxt); return; }
    var d = (data.details || {})[r[L]] || {}, rank = T.RANK[r[R]], box = el("td", { colspan: "6" });
    box.appendChild(el("div", { class: "bar" }, [el("a", { class: "btn primary", href: r[U], target: "_blank", rel: "noopener", text: "Open original" })]));
    if (d.desc && d.desc !== r[TI]) box.appendChild(el("p", { text: d.desc }));
    var kv = el("dl", { class: "kv" });
    [["Source", T.BODY[r[B]] + ", " + typeName(r)], ["Status at source", r[ST] || "not stated"], ["Next step", r[NX]], ["Sponsor / author", d.sponsor],
      ["Posted", T.fmt(r[PO])], ["Latest activity", T.fmt(r[AC])], ["Next date", T.fmt(r[DL])]].forEach(function (p) {
      if (p[1]) { kv.appendChild(el("dt", { text: p[0] })); kv.appendChild(el("dd", { text: p[1] })); }
    });
    box.appendChild(kv);
    box.appendChild(el("p", { class: "small" }, [el("b", { text: "Rank: " + rank + (r[S] === null ? "" : ", score " + r[S] + " of 100") + ". " }), (r[WH] || "") + " ",
      el("a", { href: "ranking.html", text: "How ranking works" })]));
    var up = d.up || [], down = d.down || [];
    if (up.length || down.length) box.appendChild(el("p", { class: "small", text: (up.length ? "Raises the score: " + up.join(", ") + ". " : "") + (down.length ? "Lowers it: " + down.join(", ") + "." : "") }));
    function list(title, items) { box.appendChild(el("h3", { text: title })); box.appendChild(el("ul", { class: "small" }, items)); }
    if (d.similar && d.similar.length) list("Closest items the IMM engaged on", d.similar.map(function (p) {
      return el("li", {}, [el("a", { href: p[2], target: "_blank", rel: "noopener", text: p[0] }), " " + p[1] + " ", el("span", { class: "muted", text: "(" + p[3] + ")" })]);
    }));
    if (r[IM]) { box.appendChild(el("h3", { text: "IMM record" })); box.appendChild(el("p", { class: "small" }, [immTag(r), d.said ? " " + d.said : ""])); }
    if (d.dates && d.dates.length) list("Coming dates", d.dates.map(function (x) { return el("li", { text: T.fmt(x[0]) + ": " + x[1] }); }));
    if (d.changes && d.changes.length) list("Latest changes at the source", d.changes.map(function (x) { return el("li", { text: T.fmt(x[0]) + ": " + x[1] }); }));
    tr.parentNode.insertBefore(el("tr", { class: "detail" }, [box]), tr.nextSibling);
  }
  function row(r) {
    var rank = T.RANK[r[R]], id = el("a", { href: r[U], class: "idlink", text: r[L] });
    var tr = el("tr", {}, [
      el("td", {}, [el("span", { class: "rel " + rank, text: rank }),
        r[S] === null ? null : el("div", { class: "small muted", title: "Match with the IMM's record, 0 to 100", text: String(r[S]) })]),
      el("td", { class: "id" }, [id, el("div", { class: "small muted", style: "font-weight:400", text: T.BODY[r[B]] + (r[L].indexOf(r[Y]) === 0 ? "" : " " + typeName(r)) })]),
      el("td", {}, [r[TI], el("div", { class: "small" }, [r[IM] ? immTag(r) : null, r[CH] ? el("span", { class: "muted", text: T.short(r[CO]) + ": " + r[CH] }) : null]),
        r[WH] ? el("div", { class: "small muted", text: r[WH] }) : null]),
      el("td", { class: "small" }, [r[ST], r[NX] ? el("div", { class: "muted", text: r[NX] }) : null]),
      el("td", { class: "nowrap" }, [r[DL] ? el("span", { class: T.days(r[DL]) <= 14 ? "tag due" : "", text: T.short(r[DL]) }) : null]),
      el("td", { class: "nowrap small", text: T.fmt(r[AC]) })]);
    id.addEventListener("click", function (e) { e.preventDefault(); toggle(r, tr); });
    return tr;
  }
  function go(label, p) {
    var a = el("a", { href: "#", text: label });
    a.addEventListener("click", function (e) { e.preventDefault(); page = p; render(); window.scrollTo(0, 0); });
    return a;
  }
  function render() {
    var s = state(), q = s.q.toLowerCase().replace(/\s+/g, " ");
    var words = /\d/.test(q) ? [q] : q.split(" ").filter(Boolean);       // an ID or docket number is matched as typed
    document.getElementById("heading").textContent = s.status === "open" ? "Open items" : s.status === "resolved" ? "Resolved items" : "All items";
    document.getElementById("nav-open").className = s.status === "open" ? "on" : "";
    document.getElementById("nav-all").className = s.status === "open" ? "" : "on";
    document.getElementById("clear").setAttribute("href", s.status === "open" ? "index.html" : "index.html?status=" + s.status);
    shown = rows.filter(function (r) { return keep(r, s, words); }).sort(SORT[s.sort] || SORT.queue);
    var pages = Math.max(1, Math.ceil(shown.length / PAGE));
    if (page > pages) page = pages;
    T.clear(tbody);
    shown.slice((page - 1) * PAGE, page * PAGE).forEach(function (r) { tbody.appendChild(row(r)); });
    if (!shown.length) tbody.appendChild(el("tr", {}, [el("td", { colspan: "6", class: "muted", text: "Nothing matches." })]));
    count.textContent = shown.length.toLocaleString() + " item" + (shown.length === 1 ? "" : "s");
    T.clear(pager);
    if (pages > 1) {
      if (page > 1) pager.appendChild(go("Previous", page - 1));
      pager.appendChild(document.createTextNode(" Page " + page + " of " + pages + " "));
      if (page < pages) pager.appendChild(go("Next", page + 1));
    }
    toUrl(s);
  }
  function apply(reset) { if (reset) page = 1; ensure(state(), function () { types(); render(); }); }

  form.addEventListener("submit", function (e) { e.preventDefault(); apply(true); });
  form.addEventListener("change", function () { apply(true); });
  form.elements.q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { apply(true); }, 200); });
  document.getElementById("csv").addEventListener("click", function () {
    var head = ["Source", "Type", "ID", "Title", "Source status", "Next step", "Relevance", "Score", "Why", "Next deadline", "Posted", "Last activity",
      "IMM record", "Latest change", "URL"];
    function q(v) { v = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var lines = [head.join(",")].concat(shown.map(function (r) {
      return [T.BODY[r[B]], typeName(r), r[L], r[TI], r[ST], r[NX], T.RANK[r[R]], r[S], r[WH], r[DL], r[PO], r[AC], r[IM], r[CH] ? r[CO] + ": " + r[CH] : "", r[U]].map(q).join(",");
    }));
    var a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" })), download: "imm-tracker-items.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
  fromUrl();
  T.get("open.json").then(function (d) { data = d; rows = d.rows; apply(false); }, function () {
    T.clear(tbody);
    tbody.appendChild(el("tr", {}, [el("td", { colspan: "6", class: "alarm", text: "The list could not be loaded. Reload the page to try again." })]));
  });
})();
