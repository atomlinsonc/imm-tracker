/* Shared helpers for the read-only mirror of the tracker. Everything is built with textContent, never markup. */
var T = (function () {
  var body = document.body, MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var today = body.getAttribute("data-today"), version = body.getAttribute("data-version");
  function el(tag, attrs, kids) {
    var e = document.createElement(tag), k;
    for (k in attrs || {}) {
      if (k === "text") e.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function parts(iso) { var p = iso.split("-").map(Number); return [p[0], p[1] - 1, p[2]]; }
  function fmt(iso) { if (!iso) return ""; var p = parts(iso); return MONTHS[p[1]] + " " + p[2] + ", " + p[0]; }
  function short(iso) { if (!iso) return ""; var p = parts(iso); return MONTHS[p[1]] + " " + p[2] + (String(p[0]) === today.slice(0, 4) ? "" : ", " + p[0]); }
  function days(iso) { return Math.round((Date.UTC.apply(null, parts(iso)) - Date.UTC.apply(null, parts(today))) / 864e5); }
  function weekday(iso) { return DAYS[new Date(Date.UTC.apply(null, parts(iso))).getUTCDay()]; }
  function get(file) {
    return fetch("data/" + file + "?v=" + version).then(function (r) { if (!r.ok) throw new Error(file + " " + r.status); return r.json(); });
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  var hours = (Date.now() - Date.parse(body.getAttribute("data-updated"))) / 36e5;
  if (hours > 36) {
    var s = document.getElementById("stale");
    s.textContent = "Last updated " + Math.floor(hours / 24) + " day" + (hours >= 48 ? "s" : "") + " ago. The daily pull has not run since, so newer items are missing.";
    s.hidden = false;
  }
  return { el: el, fmt: fmt, short: short, days: days, weekday: weekday, get: get, clear: clear, today: today, DAYS: DAYS,
    RANK: { h: "high", m: "medium", l: "low" }, BODY: { E: "ERCOT", P: "PUC", L: "Legislature" } };
})();
