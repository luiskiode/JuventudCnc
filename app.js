/* ============================================================
   app.js — Juventud CNC (Public/Private Switch, Modales & Drag & Drop)
   ============================================================ */

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});

  // ------------------------------------------------------------
  // 1. MANEJO DEL FONDO DINÁMICO
  // ------------------------------------------------------------
  function initBackground() {
    const bgLayer = document.getElementById("jcAppBgLayer");
    const btnChangeBg = document.getElementById("btnChangeBg");
    const bgFileInput = document.getElementById("bgFileInput");

    // Cargar fondo personalizado si existe en localStorage
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

  // ------------------------------------------------------------
  // 2. MODALES (LOGIN Y ANGIE)
  // ------------------------------------------------------------
  function initModals() {
    // Modal Login
    const btnLogin = document.getElementById("btnLogin");
    const loginModal = document.getElementById("loginModal");
    const loginClose = document.getElementById("loginClose");
    const loginForm = document.getElementById("loginForm");
    const loginEstado = document.getElementById("loginEstado");

    if (btnLogin && loginModal) {
      btnLogin.addEventListener("click", () => {
        loginModal.style.display = "flex";
      });
    }

    if (loginClose && loginModal) {
      loginClose.addEventListener("click", () => {
        loginModal.style.display = "none";
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const nombreInput = document.getElementById("loginNombre");
        const claveInput = document.getElementById("loginClave");

        const nombre = nombreInput ? nombreInput.value.trim() : "";
        const clave = claveInput ? claveInput.value.trim() : "";

        if (!nombre) return;

        // Autenticación básica simulada
        const rol = clave === "animador" ? "animador" : "pareja_guia";
        const user = { nombre: nombre, rol: rol };

        localStorage.setItem("jc_user", JSON.stringify(user));
        if (loginEstado) loginEstado.textContent = "¡Sesión iniciada!";

        setTimeout(() => {
          if (loginModal) loginModal.style.display = "none";
          if (loginEstado) loginEstado.textContent = "";
          updateStateUI();
        }, 500);
      });
    }

    // Modal Angie
    const btnAngie = document.getElementById("btnAngie");
    const angieModal = document.getElementById("angiePaletteModal");
    const angieClose = document.getElementById("angiePaletteClose");

    if (btnAngie && angieModal) {
      btnAngie.addEventListener("click", () => {
        angieModal.style.display = "flex";
      });
    }

    if (angieClose && angieModal) {
      angieClose.addEventListener("click", () => {
        angieModal.style.display = "none";
      });
    }

    // Eventos de Cierre de Sesión (Logout)
    const handleLogout = () => {
      localStorage.removeItem("jc_user");
      updateStateUI();
    };

    const btnLogout = document.getElementById("btnLogout");
    const btnLogoutTop = document.getElementById("btnLogoutTop");

    if (btnLogout) btnLogout.addEventListener("click", handleLogout);
    if (btnLogoutTop) btnLogoutTop.addEventListener("click", handleLogout);
  }

  // ------------------------------------------------------------
  // 3. CONTROL DE DRAG & DROP (Vista Pública)
  // ------------------------------------------------------------
  function initDragAndDrop() {
    const container = document.getElementById("vistaPublica");
    if (!container) return;

    const savedOrder = JSON.parse(localStorage.getItem("jc_blocks_order") || "[]");
    if (savedOrder.length > 0) {
      savedOrder.forEach((id) => {
        const el = document.getElementById(id);
        if (el) container.appendChild(el);
      });
    }

    let draggedItem = null;

    container.addEventListener("dragstart", (e) => {
      const target = e.target.closest(".draggable-block");
      if (!target) return;
      draggedItem = target;
      target.classList.add("dragging");
    });

    container.addEventListener("dragend", (e) => {
      const target = e.target.closest(".draggable-block");
      if (target) target.classList.remove("dragging");
      
      const currentOrder = Array.from(container.querySelectorAll(".draggable-block")).map(el => el.id);
      localStorage.setItem("jc_blocks_order", JSON.stringify(currentOrder));
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggedItem);
      } else {
        container.insertBefore(draggedItem, afterElement);
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".draggable-block:not(.dragging)")];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // ------------------------------------------------------------
  // 4. CONMUTADOR DE VISTAS (PÚBLICA vs PRIVADA)
  // ------------------------------------------------------------
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

    if (heroTitulo) {
      heroTitulo.textContent = isLogged ? `¡Hola, ${user.nombre}!` : "Bienvenido a Juventud CNC";
    }

    if (heroSubtitulo) {
      heroSubtitulo.textContent = isLogged
        ? (user.rol === "pareja_guia" ? "Panel de Pareja Guía" : "Panel de Animador")
        : "Un espacio para crecer, servir y caminar juntos.";
    }

    if (userBadgeRole && isLogged) {
      userBadgeRole.textContent = user.rol === "pareja_guia" ? "Pareja Guía" : "Animador";
    }

    if (userBadgeWrap) userBadgeWrap.style.display = isLogged ? "block" : "none";
    if (btnLogin) btnLogin.style.display = isLogged ? "none" : "inline-flex";
    if (btnLogoutTop) btnLogoutTop.style.display = isLogged ? "inline-flex" : "none";

    if (isLogged) {
      if (vistaPublica) vistaPublica.style.display = "none";
      if (vistaPrivada) vistaPrivada.style.display = "block";
      if (navPrivada) navPrivada.style.display = "flex";
      
      if (window.JC?.catefa?.init) window.JC.catefa.init();
    } else {
      if (vistaPublica) vistaPublica.style.display = "flex";
      if (vistaPrivada) vistaPrivada.style.display = "none";
      if (navPrivada) navPrivada.style.display = "none";
    }
  }

  // ------------------------------------------------------------
  // 5. NAVEGACIÓN PESTAÑAS PRIVADAS
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // ARRANQUE
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    initBackground();
    initModals();
    initDragAndDrop();
    initPrivatedTabs();
    updateStateUI();
  });

  window.checkSession = updateStateUI;
})();