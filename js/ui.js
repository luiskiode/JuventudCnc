/* ============================================================
   ui.js — drawer/overlay + tema + fondo global + pausa + cursos + notis
   (robusto: no revienta si faltan helpers / IDs / módulos)
   Compatible con tu index (IDs reales) + AngieHerramientas (postMessage)
   ============================================================ */

(function () {
  "use strict";

  // ============================================================
  // Namespace + Helpers
  // ============================================================
  const JC = (window.JC = window.JC || {});
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));
  const $$ = JC.$$ || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

  function safeParse(s) {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  // Escape seguro si por alguna razón usan innerHTML
  JC.safeText =
    JC.safeText ||
    function (v) {
      return String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    };

  // LocalStorage seguro (Safari / privado / quota)
  function lsGet(key, fallback = "") {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }
  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn("[JC] localStorage set failed:", key, e?.name || e);
      return false;
    }
  }
  function lsRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // State UI global
  // ============================================================
  const state = (JC.uiState = JC.uiState || {
    drawerOpen: false,
    angieOpen: false,
    loginOpen: false,
    pauseOpen: false
  });

  // ============================================================
  // Overlay / Drawer
  // ============================================================
  function syncOverlay() {
    const overlay = $("#overlay");
    if (!overlay) return;

    const shouldShow =
      !!state.drawerOpen || !!state.angieOpen || !!state.loginOpen || !!state.pauseOpen;

    overlay.classList.toggle("show", shouldShow);
    overlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }
  window.jcSyncOverlay = syncOverlay;

  function openDrawer() {
    const drawer = $("#drawer");
    if (!drawer) return;
    state.drawerOpen = true;
    drawer.classList.add("open");
    syncOverlay();
  }
  function closeDrawer() {
    const drawer = $("#drawer");
    if (!drawer) return;
    state.drawerOpen = false;
    drawer.classList.remove("open");
    syncOverlay();
  }
  window.jcOpenDrawer = openDrawer;
  window.jcCloseDrawer = closeDrawer;

  function initDrawer() {
    $("#openDrawer")?.addEventListener("click", openDrawer);
    $("#closeDrawer")?.addEventListener("click", closeDrawer);

    // Overlay: cierra drawer y modales globales (no pausa)
    $("#overlay")?.addEventListener("click", () => {
      closeDrawer();
      window.jcCloseAngieModal?.();
      window.jcCloseLoginModal?.();
      // pausa no se cierra aquí a propósito (se cierra con click fuera del modal)
    });

    // ESC cierra drawer + login + angie
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeDrawer();
      window.jcCloseAngieModal?.();
      window.jcCloseLoginModal?.();
    });

    // Click en links del drawer (data-tab) — activa vista si existe activate()
    $$("#drawer [data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        closeDrawer();
        // Si main.js exporta activate(tab)
        window.activate?.(tab);
      });
    });
  }

  // ============================================================
  // Theme tokens + presets
  // ============================================================
  function jcApplyTokens(tokens) {
    if (!tokens) return;
    const root = document.documentElement;

    // Mapa base + soporte para IDs del AngieHerramientas
    const map = {
      brand: "--brand",
      brand2: "--brand-2",
      "brand-2": "--brand-2",
      accent: "--accent",

      "neutral-900": "--neutral-900",
      "neutral-800": "--neutral-800",
      "neutral-700": "--neutral-700",
      "neutral-600": "--neutral-600",
      "neutral-400": "--neutral-400",
      "neutral-200": "--neutral-200",
      "neutral-100": "--neutral-100",

      // UI
      "topbar-bg": "--topbar-bg",
      "tabs-bg": "--tabs-bg",
      "drawer-bg": "--drawer-bg",
      "overlay-bg": "--overlay-bg",
      "icon-glow": "--icon-glow",

      // Fondo animado (si tu CSS los usa)
      "bg-a": "--bg-a",
      "bg-b": "--bg-b",
      "bg-c": "--bg-c",
      "bg-base-1": "--bg-base-1",
      "bg-base-2": "--bg-base-2",
      "veil-a": "--veil-a",
      "veil-b": "--veil-b"
    };

    for (const [k, v] of Object.entries(tokens)) {
      const cssVar = map[k] || (k.startsWith("--") ? k : `--${k}`);
      if (typeof v === "string" && v.trim()) root.style.setProperty(cssVar, v.trim());
    }
  }
  window.jcApplyTokens = jcApplyTokens;

  function applyThemePreset(mode = "auto") {
    const presets = {
      chicos: { brand: "#38bdf8", "brand-2": "#0ea5e9", accent: "#60a5fa" },
      chicas: { brand: "#f472b6", "brand-2": "#ec4899", accent: "#fb7185" },
      mix: { brand: "#2563eb", "brand-2": "#1d4ed8", accent: "#ec4899" },
      auto: null
    };

    const p = presets[mode] ?? null;

    // auto: no pisa tokens; solo aplica lo guardado
    const current = safeParse(lsGet("jc_tokens", "")) || {};
    const merged = p ? { ...current, ...p } : current;

    lsSet("jc_tokens", JSON.stringify(merged));
    jcApplyTokens(merged);
  }

  function restoreTokensOnLoad() {
    const saved = safeParse(lsGet("jc_tokens", "")) || null;
    if (saved) jcApplyTokens(saved);

    const themePicker = $("#themePicker");
    const mode = lsGet("jc_theme_mode", "");
    if (themePicker && mode) themePicker.value = mode;

    themePicker?.addEventListener("change", () => {
      const m = themePicker.value || "auto";
      lsSet("jc_theme_mode", m);
      applyThemePreset(m);
      window.logAviso?.({ title: "Tema", body: `Tema aplicado: ${m}` });
    });
  }

  // ============================================================
  // AngieHerramientas (postMessage) — aplica tokens y estados
  // ============================================================
  function initAngieToolMessaging() {
    window.addEventListener("message", (event) => {
      const data = event?.data || {};
      if (!data || typeof data !== "object") return;

      // 1) Tokens
      if (data.type === "applyTokens" && data.tokens) {
        try {
          const tokens = data.tokens || {};
          // Guardamos + aplicamos
          lsSet("jc_tokens", JSON.stringify(tokens));
          jcApplyTokens(tokens);
          window.logAviso?.({ title: "Angie", body: "Paleta aplicada 🎨" });
        } catch (e) {
          console.warn("[JC] applyTokens message error", e);
        }
      }

      // 2) Estado Angie
      if (data.type === "angieEstado") {
        const estado = data.estado || data.value;
        if (estado) {
          try {
            window.angieSetEstado?.(estado);
            window.logAviso?.({ title: "Angie", body: `Estado: ${estado}` });
          } catch (e) {
            console.warn("[JC] angieEstado message error", e);
          }
        }
      }
    });
  }

  // ============================================================
  // Fondo global (Box)
  // ============================================================
  const JC_BG_KEY = "jc_bg_main_dataurl";

  function jcApplyGlobalBackground(dataUrl) {
    try {
      if (dataUrl) {
        document.documentElement.style.setProperty("--jc-bg-image", `url("${dataUrl}")`);
        document.body.classList.add("jc-has-bg");
      } else {
        document.documentElement.style.removeProperty("--jc-bg-image");
        document.body.classList.remove("jc-has-bg");
      }
    } catch (e) {
      console.warn("[JC] jcApplyGlobalBackground failed", e);
    }
  }

  function jcLoadGlobalBackground() {
    const dataUrl = lsGet(JC_BG_KEY, "");
    if (dataUrl) jcApplyGlobalBackground(dataUrl);
  }

  function jcSaveGlobalBackground(dataUrl) {
    if (dataUrl) {
      const ok = lsSet(JC_BG_KEY, dataUrl);
      if (!ok) {
        lsRemove(JC_BG_KEY);
        jcApplyGlobalBackground("");
        throw new Error("No se pudo guardar el fondo (memoria llena). Usa una imagen más liviana.");
      }
    } else {
      lsRemove(JC_BG_KEY);
    }
    jcApplyGlobalBackground(dataUrl || "");
  }

  function jcReadImageAsCompressedDataURL(file, { maxW = 1400, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith("image/")) return reject(new Error("Archivo no es imagen"));

      const fr = new FileReader();
      fr.onload = () => {
        const src = String(fr.result || "");
        const img = new Image();

        img.onload = () => {
          try {
            const w = img.naturalWidth || img.width || 1;
            const h = img.naturalHeight || img.height || 1;
            const scale = w > maxW ? maxW / w : 1;
            const cw = Math.max(1, Math.round(w * scale));
            const ch = Math.max(1, Math.round(h * scale));

            const canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            const ctx2d = canvas.getContext("2d");
            if (!ctx2d) return reject(new Error("No canvas ctx"));

            ctx2d.drawImage(img, 0, 0, cw, ch);
            const out = canvas.toDataURL("image/jpeg", quality);
            resolve(out);
          } catch (e) {
            reject(e);
          }
        };

        img.onerror = () => reject(new Error("No se pudo cargar la imagen seleccionada"));
        img.src = src;
      };

      fr.onerror = () => {
        const err = fr.error;
        const msg =
          err?.name === "NotReadableError"
            ? "El navegador no pudo leer el archivo. Prueba moviéndolo a Desktop y vuelve a elegir."
            : err?.message || "No se pudo leer el archivo";
        reject(new Error(msg));
      };

      fr.onabort = () => reject(new Error("Lectura cancelada"));

      try {
        fr.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  let __jcBgBound = false;

  function jcBindGlobalBackgroundUI() {
    if (__jcBgBound) return true;

    // IDs reales en tu index
    const input = document.getElementById("bgPickerInput") || null;
    const btnPick = document.getElementById("btnBgPick") || null;
    const btnClear = document.getElementById("btnBgClear") || null;
    const estado = document.getElementById("bgPickEstado") || null;

    if (!input || !btnPick) return false;

    __jcBgBound = true;

    btnPick.addEventListener("click", () => {
      try {
        input.value = "";
      } catch {}
      input.click();
    });

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (estado) estado.textContent = "Cargando fondo…";
      try {
        const dataUrl = await jcReadImageAsCompressedDataURL(file, { maxW: 1400, quality: 0.82 });
        jcSaveGlobalBackground(dataUrl);
        if (estado) estado.textContent = "✅ Fondo aplicado";
        window.logAviso?.({ title: "Fondo", body: "Fondo global actualizado 🖼️" });
      } catch (e) {
        console.error("[JC] Fondo global:", e);
        if (estado) estado.textContent = e?.message || "No se pudo aplicar el fondo.";
      } finally {
        try {
          input.value = "";
        } catch {}
      }
    });

    btnClear?.addEventListener("click", () => {
      try {
        jcSaveGlobalBackground("");
        if (estado) estado.textContent = "Fondo eliminado.";
        window.logAviso?.({ title: "Fondo", body: "Fondo global eliminado 🧼" });
      } catch (e) {
        console.error("[JC] clear bg error", e);
        if (estado) estado.textContent = "No se pudo quitar el fondo.";
      }
    });

    return true;
  }

  window.jcBindGlobalBackgroundUI = jcBindGlobalBackgroundUI;
  window.jcLoadGlobalBackground = jcLoadGlobalBackground;

  // ============================================================
  // Pausa 30s
  // ============================================================
  function initPause30() {
    const pauseModal = document.getElementById("pauseModal");
    const pauseClose = document.getElementById("pauseClose");
    const pauseStart = document.getElementById("pauseStart");
    const pauseStop = document.getElementById("pauseStop");
    const pauseTimer = document.getElementById("pauseTimer");
    const pauseText = document.getElementById("pauseText");
    const btnPause30 = document.getElementById("btnPause30");

    let pauseT = null;
    let pauseLeft = 30;

    function openPauseModal() {
      if (!pauseModal) return;

      pauseLeft = 30;
      if (pauseTimer) pauseTimer.textContent = String(pauseLeft);
      if (pauseText) pauseText.textContent = "Inhala… exhala…";

      // cierra drawer
      closeDrawer();

      state.pauseOpen = true;
      pauseModal.style.display = "flex";
      pauseModal.classList.add("show");
      syncOverlay();

      try {
        window.miaSetEstado?.("apoyo");
      } catch {}
    }

    function closePauseModal() {
      if (!pauseModal) return;

      if (pauseT) clearInterval(pauseT);
      pauseT = null;

      state.pauseOpen = false;
      pauseModal.classList.remove("show");
      pauseModal.style.display = "none";
      syncOverlay();
    }

    function startPause() {
      if (pauseT) return;

      pauseLeft = Number(pauseLeft || 30);
      if (pauseText) pauseText.textContent = "Respira… suelta el peso…";

      pauseT = setInterval(() => {
        pauseLeft -= 1;
        if (pauseTimer) pauseTimer.textContent = String(Math.max(0, pauseLeft));

        if (pauseLeft === 20 && pauseText) pauseText.textContent = "“Jesús, confío en Ti.”";
        if (pauseLeft === 10 && pauseText) pauseText.textContent = "“Señor, aquí estoy.”";

        if (pauseLeft <= 0) {
          clearInterval(pauseT);
          pauseT = null;
          if (pauseText) pauseText.textContent = "Listo ✅ vuelve con calma.";
          window.logAviso?.({ title: "Pausa", body: "30s completados 🕊️" });
          window.angieSetEstado?.("feliz");
        }
      }, 1000);
    }

    function stopPause() {
      if (pauseT) clearInterval(pauseT);
      pauseT = null;
      if (pauseText) pauseText.textContent = "Pausa detenida.";
    }

    btnPause30?.addEventListener("click", openPauseModal);
    pauseClose?.addEventListener("click", closePauseModal);
    pauseModal?.addEventListener("click", (e) => {
      if (e.target === pauseModal) closePauseModal();
    });
    pauseStart?.addEventListener("click", startPause);
    pauseStop?.addEventListener("click", stopPause);

    window.jcClosePauseModal = closePauseModal;
  }

  // ============================================================
  // Cursos (demo local) + Notificaciones
  // ============================================================
  const CURSOS = [
    {
      key: "he-for-she",
      titulo: "HeForShe (Jóvenes)",
      desc: "Taller de respeto, dignidad, liderazgo y servicio.",
      duracion: "4 sesiones",
      link: "https://example.com/heforshe"
    },
    {
      key: "save-for-home",
      titulo: "Save For Home",
      desc: "Taller para decisiones sanas, familia, futuro y fe.",
      duracion: "6 sesiones",
      link: "https://example.com/saveforhome"
    }
  ];
  window.jcCursos = CURSOS;

  function cursosRender() {
    const gate = document.getElementById("cursosGate");
    const list = document.getElementById("cursosList");
    if (!list) return;

    const hasSession =
      typeof JC.auth?.isLoggedIn === "function"
        ? !!JC.auth.isLoggedIn()
        : !!JC.session || !!JC.user;

    if (gate) {
      gate.textContent = hasSession
        ? "🎯 Selecciona un curso y envía invitación."
        : "Modo local: puedes ver cursos, pero para registrar participación se requiere perfil.";
    }

    list.innerHTML = "";
    CURSOS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "jc-course";
      card.innerHTML = `
        <div class="jc-course-title"><strong>${JC.safeText(c.titulo)}</strong></div>
        <div class="muted small">${JC.safeText(c.duracion)} · ${JC.safeText(c.desc)}</div>
        <div class="jc-row" style="gap:.5rem; flex-wrap:wrap; margin-top:10px">
          <button class="btn small" type="button" data-act="invite">Invitar</button>
          <a class="btn small ghost" href="${c.link}" target="_blank" rel="noreferrer">Abrir</a>
        </div>
      `;

      card.querySelector('[data-act="invite"]')?.addEventListener("click", async () => {
        const text = `🎓 Te invito al curso: ${c.titulo}\n${c.desc}\n👉 ${c.link}`;
        try {
          if (navigator.share) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            alert("Invitación copiada ✅");
          }
          window.logAviso?.({ title: "Cursos", body: `Invitación lista: ${c.titulo}` });
          window.miaSetEstado?.("apoyo");
        } catch {}
      });

      list.appendChild(card);
    });
  }

  function initCursosView() {
    cursosRender();
    document.getElementById("btnCursosRefresh")?.addEventListener("click", cursosRender);
  }
  window.initCursosView = initCursosView;

  function updateNotiEstado() {
    const elx = document.getElementById("notiEstado");
    if (!elx) return;

    if (!("Notification" in window)) {
      elx.textContent = "Tu navegador no soporta notificaciones.";
      return;
    }
    elx.textContent = `Permiso: ${Notification.permission}`;
  }

  async function requestNotiPermission() {
    if (!("Notification" in window)) return;
    try {
      const res = await Notification.requestPermission();
      updateNotiEstado();
      window.logAviso?.({ title: "Notificaciones", body: `Permiso: ${res}` });
    } catch {}
  }

  function testNoti() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      alert("Activa el permiso primero.");
      return;
    }
    try {
      new Notification("Juventud CNC", { body: "Notificación de prueba ✅" });
      window.logAviso?.({ title: "Notificaciones", body: "Prueba enviada ✅" });
    } catch (e) {
      console.warn("[JC] Notification error", e);
    }
  }

  let __notiBound = false;
  function initNotificacionesView() {
    updateNotiEstado();
    if (__notiBound) return;
    __notiBound = true;

    document.getElementById("btnNotiRequest")?.addEventListener("click", requestNotiPermission);
    document.getElementById("btnNotiTest")?.addEventListener("click", testNoti);
  }
  window.initNotificacionesView = initNotificacionesView;

  // ============================================================
  // INIT UI
  // ============================================================
  function initUI() {
    initDrawer();
    restoreTokensOnLoad();
    initAngieToolMessaging();
    jcLoadGlobalBackground();
    initPause30();

    (function bindBgWithRetries() {
      if (jcBindGlobalBackgroundUI()) return;
      document.addEventListener("DOMContentLoaded", () => jcBindGlobalBackgroundUI(), { once: true });
      setTimeout(() => jcBindGlobalBackgroundUI(), 300);
      setTimeout(() => jcBindGlobalBackgroundUI(), 900);
      setTimeout(() => jcBindGlobalBackgroundUI(), 1500);
    })();
  }

  // Exports para main.js
  window.jcUI = { state, syncOverlay, initUI };
  window.JC = window.JC || {};
  window.JC.ui = { init: initUI, state, syncOverlay };
})();