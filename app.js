/* ============================================================
   app.js — Juventud CNC (Public/Private Switch + Drag & Drop)
   ============================================================ */

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});

  // ------------------------------------------------------------
  // 1. CONTROL DE DRAG & DROP (Vista Pública)
  // ------------------------------------------------------------
  function initDragAndDrop() {
    const container = document.getElementById("vistaPublica");
    if (!container) return;

    // Cargar orden guardado
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
      
      // Guardar nuevo orden en localStorage
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
  // 2. CONMUTADOR DE VISTAS (PÚBLICA vs PRIVADA)
  // ------------------------------------------------------------
  function updateStateUI() {
    const user = JSON.parse(localStorage.getItem("jc_user") || "null");
    const isLogged = !!user?.nombre;

    const vistaPublica = document.getElementById("vistaPublica");
    const vistaPrivada = document.getElementById("vistaPrivada");
    const navPrivada = document.getElementById("navPrivada");
    
    document.getElementById("heroTitulo").textContent = isLogged ? `¡Hola, ${user.nombre}!` : "Bienvenido a Juventud CNC";
    document.getElementById("heroSubtitulo").textContent = isLogged
      ? (user.rol === "pareja_guia" ? "Panel de Pareja Guía" : "Panel de Animador")
      : "Un espacio para crecer, servir y caminar juntos.";

    document.getElementById("userBadgeWrap").style.display = isLogged ? "block" : "none";
    document.getElementById("btnLogin").style.display = isLogged ? "none" : "inline-flex";
    document.getElementById("btnLogoutTop").style.display = isLogged ? "inline-flex" : "none";

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
  // 3. NAVEGACIÓN PESTAÑAS PRIVADAS
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
    initDragAndDrop();
    initPrivatedTabs();
    updateStateUI();
  });

  window.checkSession = updateStateUI;
})();