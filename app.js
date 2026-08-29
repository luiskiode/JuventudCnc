/* ============================================================
   app.js — Juventud CNC (Restaurado e Integral)
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

  // 2. MODALES, LOGIN Y RECEPTOR DE MENSAJES DE ANGIE
  function initModals() {
    const btnLogin = document.getElementById("btnLogin");
    const loginModal = document.getElementById("loginModal");
    const loginClose = document.getElementById("loginClose");
    const loginForm = document.getElementById("loginForm");

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
        const nombre = document.getElementById("loginNombre")?.value.trim() || "";
        const clave = document.getElementById("loginClave")?.value.trim() || "";
        if (!nombre) return;

        const rol = clave.toLowerCase() === "animador" ? "animador" : "pareja_guia";
        localStorage.setItem("jc_user", JSON.stringify({ nombre, rol }));

        if (loginModal) loginModal.style.display = "none";
        updateStateUI();
      });
    }

    // Modal Angie y Comunicación PostMessage
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

    // Cierre automático y aplicación de tokens enviado desde Angie
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "closeAngieModal" || data === "closeAngieModal") {
        if (angieModal) angieModal.style.display = "none";
      }

      if (data.type === "applyTokens" && data.tokens) {
        for (const [key, val] of Object.entries(data.tokens)) {
          document.documentElement.style.setProperty(`--${key}`, val);
        }
        localStorage.setItem("angie_tokens_ui", JSON.stringify(data.tokens));
      }
    });

    // Cargar tokens guardados de Angie al iniciar
    const savedTokens = localStorage.getItem("angie_tokens_ui");
    if (savedTokens) {
      try {
        const tokens = JSON.parse(savedTokens);
        for (const [key, val] of Object.entries(tokens)) {
          document.documentElement.style.setProperty(`--${key}`, val);
        }
      } catch (err) {
        console.error("Error al cargar tokens de Angie", err);
      }
    }

    // Cierre de Sesión
    const handleLogout = () => {
      localStorage.removeItem("jc_user");
      updateStateUI();
    };

    const btnLogout = document.getElementById("btnLogout");
    const btnLogoutTop = document.getElementById("btnLogoutTop");
    if (btnLogout) btnLogout.addEventListener("click", handleLogout);
    if (btnLogoutTop) btnLogoutTop.addEventListener("click", handleLogout);
  }

  // 3. CONMUTADOR DE VISTAS Y NAVEGACIÓN
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
      
      // Inicializar submódulo Catefa
      if (window.JC?.catefa?.init) {
        window.JC.catefa.init();
      }

      // Cargar listas
      renderEventosList();
      renderJudartList();
      renderMensajesData();
    } else {
      if (vistaPublica) vistaPublica.style.display = "grid";
      if (vistaPrivada) vistaPrivada.style.display = "none";
      if (navPrivada) navPrivada.style.display = "none";

      renderPublicView();
    }
  }

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

  // 4. MÓDULO DE MENSAJES (BIENVENIDA Y SEMANAL)
  function initMensajes() {
    const formMsg = document.getElementById("formMensajeSemanal");
    if (formMsg) {
      formMsg.addEventListener("submit", (e) => {
        e.preventDefault();
        const inputMsg = document.getElementById("inputMensajeSemanal")?.value.trim();
        if (inputMsg) {
          localStorage.setItem("jc_mensaje_semanal", inputMsg);
          formMsg.reset();
          renderMensajesData();
          renderPublicView();
        }
      });
    }
  }

  function renderMensajesData() {
    const defaultMsg = "Esta semana estamos llamados a vivir la fe con alegría y compartirla con los demás.";
    const currentMsg = localStorage.getItem("jc_mensaje_semanal") || defaultMsg;
    
    const adminMsgView = document.getElementById("adminVistaMensajeSemanal");
    if (adminMsgView) {
      adminMsgView.textContent = currentMsg;
    }
  }

  // 5. MÓDULO DE EVENTOS
  function initEventos() {
    const form = document.getElementById("formNuevoEvento");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const titulo = document.getElementById("eventTitulo")?.value.trim();
      const fecha = document.getElementById("eventFecha")?.value;
      const nota = document.getElementById("eventNota")?.value.trim();

      if (!titulo || !fecha) return;

      const eventos = JSON.parse(localStorage.getItem("jc_eventos") || "[]");
      eventos.push({ id: Date.now(), titulo, fecha, nota });
      localStorage.setItem("jc_eventos", JSON.stringify(eventos));

      form.reset();
      renderEventosList();
      renderPublicView();
    });
  }

  function renderEventosList() {
    const container = document.getElementById("listaEventosAgendados");
    if (!container) return;

    const eventos = JSON.parse(localStorage.getItem("jc_eventos") || "[]");
    if (eventos.length === 0) {
      container.innerHTML = '<p class="muted small">No hay eventos agendados aún.</p>';
      return;
    }

    container.innerHTML = eventos.map((ev) => `
      <div style="background: rgba(255,255,255,0.04); padding: 10px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--card-border);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${ev.titulo}</strong>
          <span class="badge badge-mix">${ev.fecha}</span>
        </div>
        ${ev.nota ? `<p class="small muted" style="margin-top: 4px;">${ev.nota}</p>` : ''}
      </div>
    `).join("");
  }

  // 6. MÓDULO DE JUDART
  function initJudart() {
    const form = document.getElementById("formNuevoJudart");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fotoUrl = document.getElementById("judartFotoUrl")?.value.trim();
      const leyenda = document.getElementById("judartLeyenda")?.value.trim();

      if (!leyenda) return;

      const posts = JSON.parse(localStorage.getItem("jc_judart") || "[]");
      posts.unshift({
        id: Date.now(),
        fotoUrl: fotoUrl || 'https://via.placeholder.com/400x250/0f172a/f8fafc?text=Juventud+CNC',
        leyenda,
        fecha: new Date().toLocaleDateString()
      });

      localStorage.setItem("jc_judart", JSON.stringify(posts));
      form.reset();
      renderJudartList();
      renderPublicView();
    });
  }

  function renderJudartList() {
    const container = document.getElementById("judartFeedInteractive");
    if (!container) return;

    const posts = JSON.parse(localStorage.getItem("jc_judart") || "[]");
    if (posts.length === 0) {
      container.innerHTML = '<p class="muted small">No hay publicaciones activas.</p>';
      return;
    }

    container.innerHTML = `<div class="judart-grid">` + posts.map((post) => `
      <div class="judart-card">
        <img src="${post.fotoUrl}" alt="Judart" onerror="this.src='https://via.placeholder.com/400x250/0f172a/f8fafc?text=Juventud+CNC'" />
        <p>${post.leyenda}</p>
        <div style="padding: 0 10px 8px 10px;" class="small muted">${post.fecha}</div>
      </div>
    `).join("") + `</div>`;
  }

  // 7. RENDERIZADO DE LA VISTA PÚBLICA (Feed, Calendario y Mensajes)
  function renderPublicView() {
    const feedPublico = document.getElementById("judartFeedPublico");
    const calPublico = document.getElementById("calendarioPublico");
    const vistaBienvenida = document.getElementById("textoBienvenida");
    const vistaMensajeSemanal = document.getElementById("textoMensajeSemanal");

    // Renderizar Mensajes
    if (vistaBienvenida) {
      vistaBienvenida.textContent = "¡Bienvenidos a la plataforma interactiva de Juventud CNC!";
    }
    if (vistaMensajeSemanal) {
      const defaultMsg = "Esta semana estamos llamados a vivir la fe con alegría y compartirla con los demás.";
      vistaMensajeSemanal.textContent = localStorage.getItem("jc_mensaje_semanal") || defaultMsg;
    }

    const posts = JSON.parse(localStorage.getItem("jc_judart") || "[]");
    const eventos = JSON.parse(localStorage.getItem("jc_eventos") || "[]");

    // Renderizar Judart
    if (feedPublico) {
      if (posts.length === 0) {
        feedPublico.innerHTML = '<p class="muted small">No hay publicaciones en el muro comunitario.</p>';
      } else {
        feedPublico.innerHTML = posts.slice(0, 4).map((post) => `
          <div class="judart-card">
            <img src="${post.fotoUrl}" alt="Judart" />
            <p>${post.leyenda}</p>
          </div>
        `).join("");
      }
    }

    // Renderizar Eventos
    if (calPublico) {
      if (eventos.length === 0) {
        calPublico.innerHTML = '<p class="muted small">No hay actividades agendadas próximamente.</p>';
      } else {
        calPublico.innerHTML = eventos.slice(0, 3).map((ev) => `
          <div style="background: rgba(255,255,255,0.04); padding: 8px; border-radius: 6px; margin-bottom: 6px;">
            <strong class="small">${ev.titulo}</strong>
            <div class="small muted">${ev.fecha}</div>
          </div>
        `).join("");
      }
    }
  }

  // 8. SOPORTE DE DRAG & DROP EN VISTA PÚBLICA
  function initDragAndDrop() {
    const container = document.getElementById("vistaPublica");
    if (!container) return;

    let draggedItem = null;

    container.addEventListener("dragstart", (e) => {
      if (e.target.classList.contains("draggable-block")) {
        draggedItem = e.target;
        e.target.style.opacity = "0.5";
      }
    });

    container.addEventListener("dragend", (e) => {
      if (e.target.classList.contains("draggable-block")) {
        e.target.style.opacity = "1";
        draggedItem = null;
      }
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(container, e.clientY);
      if (draggedItem) {
        if (afterElement == null) {
          container.appendChild(draggedItem);
        } else {
          container.insertBefore(draggedItem, afterElement);
        }
      }
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".draggable-block:not(.dragging)")];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  // 9. BOTS Y AUTOMATIZACIÓN
  function initBots() {
    const btnBotAsistente = document.getElementById("btnBotAsistente");
    if (btnBotAsistente) {
      btnBotAsistente.addEventListener("click", () => {
        // Lógica de enganche para el script externo bots.js o lógica nativa de automatización
        if (typeof window.initBotSystem === "function") {
          window.initBotSystem();
        } else {
          alert("🤖 Bot Asistente CNC: Los módulos de automatización rápida están listos. (Asegúrate de que bots.js esté cargado).");
        }
      });
    }
  }

  // ARRANQUE CENTRAL
  document.addEventListener("DOMContentLoaded", () => {
    initBackground();
    initModals();
    initPrivatedTabs();
    initMensajes();
    initEventos();
    initJudart();
    initDragAndDrop();
    initBots();
    updateStateUI();
  });

  window.checkSession = updateStateUI;
})();