/* Upcoming deadlines, as on the tracker's Deadlines page. Rows: [date, kind, what, meeting link, item, title, item link, rank]. */
(function () {
  var form = document.getElementById("filters"), tbody = document.querySelector("#rows tbody"), count = document.getElementById("count"),
    rows = [], el = T.el, RV = { h: 3, m: 2, l: 1 };
  function render() {
    var window_ = parseInt(form.elements.days.value, 10), min = form.elements.rel.value, n = 0;
    T.clear(tbody);
    rows.forEach(function (r) {
      var d = T.days(r[0]);
      if (d < 0 || d > window_ || (min && RV[r[7]] < RV[min])) return;
      n++;
      var what = r[3] ? [r[1] + ": ", el("a", { href: r[3], target: "_blank", rel: "noopener", text: r[2] })] : [r[1], el("div", { class: "small muted", text: r[2] })];
      tbody.appendChild(el("tr", {}, [
        el("td", { class: "nowrap" }, [el("b", { text: T.weekday(r[0]) + " " + T.short(r[0]) })]),
        el("td", { class: "nowrap" }, [el("span", { class: d <= 7 ? "tag due" : "", text: d + " d" })]),
        el("td", {}, what),
        el("td", {}, [el("a", { href: r[6], target: "_blank", rel: "noopener" }, [el("b", { text: r[4] })]), " " + r[5]]),
        el("td", {}, [el("span", { class: "rel " + T.RANK[r[7]], text: T.RANK[r[7]] })])]));
    });
    if (!n) tbody.appendChild(el("tr", {}, [el("td", { colspan: "5", class: "muted", text: "No deadlines in this window." })]));
    count.textContent = n + (n === 1 ? " entry." : " entries.");
  }
  form.addEventListener("change", render);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  T.get("deadlines.json").then(function (d) { rows = d.rows; render(); }, function () { count.textContent = "The list could not be loaded."; });
})();
