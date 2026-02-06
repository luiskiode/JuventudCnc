// js/members.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  JC.state = JC.state || {};

  const getSB = () => window.sb || window.supabaseClient || JC.sb || null;
  const $ = JC.$ || ((sel, root = document) => root.querySelector(sel));

  function refs() {
    return {
      gate: $("#miembrosGate"),
      list: $("#miembrosList"),
      btn: $("#btnMiembrosRefresh"),
    };
  }

  function setGate(msg) {
    const r = refs();
    if (r.gate) r.gate.textContent = msg || "";
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function card(m) {
    const nombre = escapeHtml(m.nombre || "—");
    const rol = escapeHtml(m.rol_key || "miembro");
    const frase = escapeHtml(m.frase || "");
    const avatar = m.avatar_url ? `style="background-image:url('${m.avatar_url}');"` : "";

    return `
      <div class="card" style="padding:12px">
        <div style="display:flex; gap:10px; align-items:center">
          <div aria-hidden="true"
               style="width:44px;height:44px;border-radius:999px;
                      background:rgba(255,255,255,.08); background-size:cover; background-position:center;
                      flex:0 0 auto;" ${avatar}></div>
          <div style="min-width:0">
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
              <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:360px">${nombre}</strong>
              <span class="badge badge-mix">${rol}</span>
            </div>
            ${frase ? `<div class="muted small" style="margin-top:4px; white-space:pre-wrap">${frase}</div>` : `<div class="muted small" style="margin-top:4px">—</div>`}
          </div>
        </div>
      </div>
    `;
  }

  async function cargarMiembros({ force = false } = {}) {
    const sb = getSB();
    const r = refs();
    if (!r.list) return;

    if (!sb) {
      setGate("⚠️ Supabase no disponible.");
      return;
    }

    // Gate UI
    if (!JC.state.user && !window.currentUser) {
      setGate("🔑 Inicia sesión para ver miembros.");
      r.list.innerHTML = "";
      return;
    }
    if (!JC.state.isMember) {
      setGate("🔒 Completa tu perfil para ver miembros.");
      r.list.innerHTML = "";
      return;
    }

    setGate("Cargando miembros…");
    r.list.innerHTML = "";

    try {
      const { data, error } = await sb
        .from("miembros")
        .select("user_id,nombre,rol_key,frase,avatar_url,estado,created_at")
        .eq("estado", "activo")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      const rows = data || [];
      setGate(rows.length ? `✅ ${rows.length} miembros` : "Aún no hay miembros (o RLS bloqueó la lista).");
      r.list.innerHTML = rows.map(card).join("");
    } catch (e) {
      console.error("[miembros] cargar error", e);
      setGate(`❌ No se pudo cargar miembros: ${e?.message || "RLS/permisos"}`);
      r.list.innerHTML = "";
    }
  }

  function bindUIOnce() {
    if (window.__JC_MEMBERS_BOUND__) return;
    window.__JC_MEMBERS_BOUND__ = true;

    const r = refs();
    r.btn?.addEventListener("click", () => cargarMiembros({ force: true }));

    // Refrescar cuando cambie auth/perfil
    try {
      document.addEventListener("JC:profile:changed", () => cargarMiembros({ force: true }));
      document.addEventListener("JC:auth:changed", () => cargarMiembros({ force: true }));
    } catch {}
  }

  async function init() {
    bindUIOnce();
    await cargarMiembros({ force: true });
    return true;
  }

  window.jcMiembros = { init, cargarMiembros };
})();