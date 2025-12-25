/* ============================================================
   config.js — build + helpers globales
   ============================================================ */

(function () {
  "use strict";

  const JC_BUILD = window.JC_BUILD || "dev";
  window.JC_BUILD = JC_BUILD;

  (function autoUpdateOnNewBuild() {
    let prev = null;
    try { prev = localStorage.getItem("jc_build"); } catch {}

    if (prev && prev !== JC_BUILD) {
      try { sessionStorage.clear(); } catch {}
      if ("caches" in window) {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .catch(() => {});
      }
      const url = new URL(location.href);
      url.searchParams.set("v", JC_BUILD);
      try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
      location.replace(url.toString());
      return;
    }
    try { localStorage.setItem("jc_build", JC_BUILD); } catch {}
  })();

  const LOCALE = "es-PE";
  const TZ = "America/Lima";

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));
  const el = (id) => document.getElementById(id);

  const safeText = (s) => (typeof s === "string" ? s : s == null ? "" : String(s));
  const pick = (arr, fallback = "") =>
    (Array.isArray(arr) && arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback);

  const fmtDate = (d) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, weekday: "long", month: "short", day: "numeric" }).format(d);

  const fmtDateTime = (d) =>
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);

  function normalizeTab(t) {
    if (!t) return "inicio";
    const key = String(t).trim();
    if (key === "avisos") return "judart";
    return key;
  }

  function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

  window.JC = {
    LOCALE, TZ,
    $, $$, el,
    safeText, pick,
    fmtDate, fmtDateTime,
    normalizeTab,
    safeParse
  };
})();
