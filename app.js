/* ============================================================
   app.js — Juventud CNC
   ============================================================ */

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});

  // 1. MANEJO DEL FONDO FLORAL Y PERSONALIZADO
  function initBackground() {
    const bgLayer = document.getElementById("jcAppBgLayer");
    const btnChangeBg = document.getElementById("btnChangeBg");
    const bgFileInput = document.getElementById("bgFileInput");

    const customBg = localStorage.getItem("jc_custom_bg");
    if (customBg && bgLayer) {
      bgLayer.style.backgroundImage = `url('${customBg}')`;
    }

    if (btnChangeBg && bgFileInput) {
      btnChangeBg.addEventListener("click", () => bgFileInput.click());
      bgFileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (event) {
            const bgData = event.target.result;
            if (bgLayer) bgLayer.style.backgroundImage = `url('${bgData}')`;
            localStorage.setItem("jc_custom_bg", bgData);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  // 2. MODALES & RECEPTOR DE MENSAJES DE ANGIE
  function initModals() {
    const btnLogin = document.getElementById("btnLogin");
    const loginModal = document.getElementById("loginModal");
    const loginClose = document.getElementById("loginClose");
    const loginForm = document.getElementById("loginForm");

    if (btnLogin && loginModal) btnLogin.addEventListener("click", () => loginModal.style.display = "flex");
    if (loginClose && loginModal) loginClose.addEventListener("click", () => loginModal.style.display = "none");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nombre = document.getElementById("loginNombre")?.value.trim() || "";
        const clave = document.getElementById("loginClave")?.value.trim() || "";
        if (!nombre) return;

        const rol = clave === "animador" ? "animador" : "pareja_guia";
        localStorage.setItem("jc_user", JSON.stringify({ nombre, rol }));

        if (loginModal) loginModal.style.display = "none";
        updateStateUI();
      });
    }

    // Modal Angie
    const btnAngie = document.getElementById("btnAngie");
    const angieModal = document.getElementById("angiePaletteModal");
    const angieClose = document.getElementById("angiePaletteClose");

    if (btnAngie && angieModal) btnAngie.addEventListener("click", () => angieModal.style.display = "flex");
    if (angieClose && angieModal) angieClose.addEventListener("click", () => angieModal.style.display = "none");

    // FIX EXPLICITO: Cierre automático al pulsar "Aplicar cambios" en Angie
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "closeAngieModal" || data === "closeAngieModal") {
        if (angieModal) angieModal.style.display = "none";
      }

      if (data.type === "applyTokens" && data.tokens) {
        // Aplicar tokens dinámicos al CSS raíz
        for (const [key, val] of Object.entries(data.tokens)) {
          document.documentElement.style.setProperty(`--${key}`, val);
        }
      }
    });

    const handleLogout = () => {
      localStorage.removeItem("jc_user");
      updateStateUI();
    };

    const btnLogout = document.getElementById("btnLogout");
    const btnLogoutTop = document.getElementById("btnLogoutTop");
    if (btnLogout) btnLogout.addEventListener("click", handleLogout);
    if (btnLogoutTop) btnLogoutTop.addEventListener("click", handleLogout);
  }

  // 3. CONMUTADOR DE VISTAS (Pública / Privada)
  function updateStateUI() {
    const user = JSON.parse(localStorage.getItem("jc_user") || "null");
    const isLogged = !!user?.nombre;

    const vistaPublica = document.getElementById("vistaPublica");
    const vistaPrivada = document.getElementById("vistaPrivada");
    const navPrivada = document.getElementById("navPrivada");

    const heroTitulo = document.getElementById("heroTitulo");
    const heroSubtitulo = document.getElementById("heroSubtitulo");
    const userBadgeWrap = document.getElementById("userBadgeWrap");
    const userBadgeRole = document.getElementById("userBadgeRole");
    const btnLogin = document.getElementById("btnLogin");
    const btnLogoutTop = document.getElementById("btnLogoutTop");

    if (heroTitulo) heroTitulo.textContent = isLogged ? `¡Hola, ${user.nombre}!` : "Bienvenido a Juventud CNC";
    if (heroSubtitulo) {
      heroSubtitulo.textContent = isLogged
        ? (user.rol === "pareja_guia" ? "Panel de Pareja Guía" : "Panel de Animador")
        : "Un espacio para crecer, servir y caminar juntos.";
    }

    if (userBadgeRole && isLogged) userBadgeRole.textContent = user.rol === "pareja_guia" ? "Pareja Guía" : "Animador";
    if (userBadgeWrap) userBadgeWrap.style.display = isLogged ? "block" : "none";
    if (btnLogin) btnLogin.style.display = isLogged ? "none" : "inline-flex";
    if (btnLogoutTop) btnLogoutTop.style.display = isLogged ? "inline-flex" : "none";

    if (isLogged) {
      if (vistaPublica) vistaPublica.style.display = "none";
      if (vistaPrivada) vistaPrivada.style.display = "block";
      if (navPrivada) navPrivada.style.display = "flex";
      
      if (window.JC?.catefa?.init) {
        window.JC.catefa.init();
      }
    } else {
      if (vistaPublica) vistaPublica.style.display = "flex";
      if (vistaPrivada) vistaPrivada.style.display = "none";
      if (navPrivada) navPrivada.style.display = "none";
    }
  }

  // 4. NAVEGACIÓN DE PESTAÑAS PRIVADAS
  function initPrivatedTabs() {
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const targetTab = tab.dataset.tab;
        document.querySelectorAll(".tab-content").forEach((c) => {
          c.style.display = c.id === `tab-${targetTab}` ? "block" : "none";
        });
      });
    });
  }

  // ARRANQUE
  document.addEventListener("DOMContentLoaded", () => {
    initBackground();
    initModals();
    initPrivatedTabs();
    updateStateUI();
  });

  window.checkSession = updateStateUI;
})();