/* The tracker's Events calendar: month grid or list. Rows: [date, time, body, group, title, link, status, place, [items on the agenda]]. */
(function () {
  var NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var form = document.getElementById("filters"), cal = document.getElementById("cal"), el = T.el, rows = [], view = "month";
  var p = new URLSearchParams(location.search), ym = /^\d{4}-\d{2}$/.test(p.get("ym") || "") ? p.get("ym") : T.today.slice(0, 7);
  if (p.get("view") === "list") view = "list";
  ["body", "grp"].forEach(function (k) { if (p.get(k)) form.elements[k].value = p.get(k); });
  ["linked", "cancelled"].forEach(function (k) { form.elements[k].checked = p.get(k) === "1"; });

  function shift(n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    ym = y + "-" + (m < 9 ? "0" : "") + (m + 1);
  }
  function pick() {
    var body = form.elements.body.value, grp = form.elements.grp.value.trim().toLowerCase(), linked = form.elements.linked.checked,
      cancelled = form.elements.cancelled.checked;
    return rows.filter(function (r) {
      return r[0].slice(0, 7) === ym && (!body || r[2] === body) && (!grp || (r[3] + " " + r[4]).toLowerCase().indexOf(grp) >= 0) &&
        (!linked || r[8].length) && (cancelled || r[6] !== "Cancelled");
    });
  }
  function clock(t) { return t ? ((+t.slice(0, 2) + 11) % 12 + 1) + ":" + t.slice(3) : ""; }
  function ampm(t) { return t ? clock(t) + (+t.slice(0, 2) < 12 ? " AM" : " PM") : ""; }
  function month(evs) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1, first = new Date(Date.UTC(y, m, 1)), d = new Date(Date.UTC(y, m, 1 - first.getUTCDay())), by = {};
    evs.forEach(function (r) { (by[r[0]] = by[r[0]] || []).push(r); });
    var tb = el("tbody");
    do {
      var tr = el("tr");
      for (var i = 0; i < 7; i++) {
        var iso = d.toISOString().slice(0, 10);
        var td = el("td", { class: (d.getUTCMonth() !== m ? "out " : "") + (iso === T.today ? "today" : "") }, [el("span", { class: "dn", text: String(d.getUTCDate()) })]);
        (by[iso] || []).forEach(function (r) {
          td.appendChild(el("a", { href: r[5] || "#", target: r[5] ? "_blank" : null, rel: r[5] ? "noopener" : null,
            class: r[2] + (r[8].length ? " linked" : "") + (r[6] === "Cancelled" ? " off" : ""),
            title: (ampm(r[1]) + " " + r[4]).trim() + (r[3] ? " (" + r[3] + ")" : "") + (r[8].length ? " | " + r[8].join(", ") : ""),
            text: (clock(r[1]) + " " + r[4]).trim() }));
        });
        tr.appendChild(td);
        d = new Date(d.getTime() + 864e5);
      }
      tb.appendChild(tr);
    } while (d.getUTCMonth() === m);
    return el("table", { class: "cal" }, [el("thead", {}, [el("tr", {}, T.DAYS.map(function (n) { return el("th", { text: n }); }))]), tb]);
  }
  function list(evs) {
    var tb = el("tbody");
    evs.forEach(function (r) {
      tb.appendChild(el("tr", {}, [
        el("td", { class: "nowrap" }, [el("b", { text: T.weekday(r[0]) + " " + T.fmt(r[0]) }), el("div", { class: "small", text: ampm(r[1]) })]),
        el("td", { class: "small" }, [r[2], el("div", { class: "muted", text: r[3].slice(0, 40) })]),
        el("td", {}, [r[5] ? el("a", { href: r[5], target: "_blank", rel: "noopener", text: r[4] }) : r[4],
          r[6] !== "Scheduled" ? el("span", { class: "tag due", style: "margin-left:6px", text: r[6] }) : null]),
        el("td", { class: "small", text: r[7] }), el("td", { class: "small", text: r[8].join(", ") })]));
    });
    if (!evs.length) tb.appendChild(el("tr", {}, [el("td", { colspan: "5", class: "muted", text: "No meetings in this month." })]));
    return el("table", {}, [el("thead", {}, [el("tr", {}, ["When", "Body", "Meeting", "Location", "Agenda items in tracker"].map(function (n) { return el("th", { text: n }); }))]), tb]);
  }
  function render() {
    document.getElementById("ym").textContent = NAMES[+ym.slice(5, 7) - 1] + " " + ym.slice(0, 4);
    document.getElementById("legend").hidden = view !== "month";
    T.clear(cal);
    cal.appendChild(view === "month" ? month(pick()) : list(pick()));
    var q = new URLSearchParams();
    q.set("ym", ym);
    if (view === "list") q.set("view", "list");
    ["body", "grp"].forEach(function (k) { if (form.elements[k].value.trim()) q.set(k, form.elements[k].value.trim()); });
    ["linked", "cancelled"].forEach(function (k) { if (form.elements[k].checked) q.set(k, "1"); });
    history.replaceState(null, "", location.pathname + "?" + q.toString());
  }
  function on(id, fn) { document.getElementById(id).addEventListener("click", function (e) { e.preventDefault(); fn(); render(); }); }
  on("prev", function () { shift(-1); });
  on("next", function () { shift(1); });
  on("v-month", function () { view = "month"; });
  on("v-list", function () { view = "list"; });
  form.addEventListener("change", render);
  form.elements.grp.addEventListener("input", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  T.get("events.json").then(function (d) { rows = d.rows; render(); }, function () { T.clear(cal); cal.appendChild(el("p", { class: "alarm", text: "The calendar could not be loaded." })); });
})();
