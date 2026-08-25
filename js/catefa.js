// js/catefa.js
(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  let currentGrupoId = null;

  // Lista base de respaldo inmediato por si la conexión tarda
  const PAREJAS_BASE = [
    "Richard y Lucero",
    "Betty y Jesus",
    "Ricardo y Yaneli"
  ];

  function getClient() {
    return window.JC?.supabase || window.sb || window.supabaseClient;
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('jc_user') || '{}');
    } catch {
      return {};
    }
  }

  // 1. Cargar Parejas Guías (desde Supabase con fallback local)
  async function cargarParejasGuias() {
    const select = document.getElementById('selectParejaGuia');
    if (!select) return;

    let guiasNombres = [...PAREJAS_BASE];
    const client = getClient();

    if (client) {
      try {
        const { data, error } = await client
          .from('catefa_usuarios')
          .select('nombre')
          .eq('rol', 'pareja_guia')
          .order('nombre', { ascending: true });

        if (!error && data && data.length > 0) {
          guiasNombres = data.map(d => d.nombre);
        }
      } catch (err) {
        console.warn('[Catefa] Usando lista local de parejas guías:', err);
      }
    }

    select.innerHTML = '<option value="">-- Selecciona Pareja Guía --</option>';
    guiasNombres.forEach((nombre) => {
      const opt = document.createElement('option');
      opt.value = nombre;
      opt.textContent = nombre;
      select.appendChild(opt);
    });
  }

  // 2. Cargar Grupos
  async function cargarGrupos() {
    const select = document.getElementById('selectGrupo');
    const client = getClient();
    if (!select || !client) return;

    try {
      const { data: grupos, error } = await client
        .from('catefa_grupos')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;

      select.innerHTML = '<option value="">-- Selecciona tu grupo --</option>';
      (grupos || []).forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.nombre;
        select.appendChild(opt);
      });

      if (currentGrupoId) {
        select.value = currentGrupoId;
        cargarNinos(currentGrupoId);
      }
    } catch (e) {
      console.error('[Catefa] Error cargando grupos:', e);
    }
  }

  // 3. Cargar Niños del Grupo
  async function cargarNinos(grupoId) {
    const list = document.getElementById('listaNinos');
    const client = getClient();
    if (!list) return;

    if (!grupoId) {
      list.innerHTML = '<p class="muted small">Selecciona o crea un grupo para ver la lista.</p>';
      return;
    }

    list.innerHTML = '<p class="muted small">Cargando niños...</p>';

    try {
      const { data: ninos, error } = await client
        .from('catefa_ninos')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('nombre', { ascending: true });

      if (error) throw error;

      if (!ninos || ninos.length === 0) {
        list.innerHTML = '<p class="muted small">No hay niños registrados en este grupo aún.</p>';
        return;
      }

      list.innerHTML = '';
      ninos.forEach((n) => {
        const item = document.createElement('div');
        item.style.cssText =
          'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); margin-bottom:8px;';
        item.innerHTML = `
          <div>
            <strong>${n.nombre}</strong>
            ${n.notas ? `<p class="muted small" style="margin-top:4px; font-style:italic;">"${n.notas}"</p>` : '<p class="muted small" style="margin-top:4px; opacity:0.6;">Sin notitas</p>'}
          </div>
        `;
        list.appendChild(item);
      });
    } catch (e) {
      console.error('[Catefa] Error cargando niños:', e);
      list.innerHTML = '<p class="muted small">Error al cargar la lista.</p>';
    }
  }

  // 4. Eventos de la Interfaz
  function bindUI() {
    if (window.__JC_CATEFA_BOUND__) return;
    window.__JC_CATEFA_BOUND__ = true;

    const select = document.getElementById('selectGrupo');
    const btnNuevoGrupo = document.getElementById('btnNuevoGrupo');
    const formNuevoGrupoWrap = document.getElementById('formNuevoGrupoWrap');
    const btnGuardarGrupo = document.getElementById('btnGuardarGrupo');
    const btnCancelarGrupo = document.getElementById('btnCancelarGrupo');
    const inputNombreGrupo = document.getElementById('inputNombreGrupo');
    const selectParejaGuia = document.getElementById('selectParejaGuia');
    const formNino = document.getElementById('formNino');
    const ninoNombre = document.getElementById('ninoNombre');
    const ninoNotas = document.getElementById('ninoNotas');

    select?.addEventListener('change', (e) => {
      currentGrupoId = e.target.value;
      cargarNinos(currentGrupoId);
    });

    btnNuevoGrupo?.addEventListener('click', () => {
      if (formNuevoGrupoWrap) formNuevoGrupoWrap.style.display = 'block';
      cargarParejasGuias();
      inputNombreGrupo?.focus();
    });

    btnCancelarGrupo?.addEventListener('click', () => {
      if (formNuevoGrupoWrap) formNuevoGrupoWrap.style.display = 'none';
      if (inputNombreGrupo) inputNombreGrupo.value = '';
    });

    btnGuardarGrupo?.addEventListener('click', async () => {
      const nombreBase = inputNombreGrupo?.value.trim();
      const parejaGuia = selectParejaGuia?.value.trim();
      if (!nombreBase) return;

      const nombreFinal = parejaGuia ? `${nombreBase} (${parejaGuia})` : nombreBase;
      const user = getUser();
      const client = getClient();

      if (!client) {
        alert('No hay conexión con la base de datos.');
        return;
      }

      try {
        const { data: nuevo, error } = await client
          .from('catefa_grupos')
          .insert([{ nombre: nombreFinal, animador_id: user.id || null }])
          .select()
          .single();

        if (error) throw error;

        if (inputNombreGrupo) inputNombreGrupo.value = '';
        if (formNuevoGrupoWrap) formNuevoGrupoWrap.style.display = 'none';
        currentGrupoId = nuevo.id;
        await cargarGrupos();
      } catch (e) {
        console.error('[Catefa] Error al guardar grupo:', e);
      }
    });

    formNino?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentGrupoId) {
        alert('Por favor, selecciona o crea un grupo primero.');
        return;
      }

      const nombre = ninoNombre?.value.trim();
      const notas = ninoNotas?.value.trim();
      const client = getClient();

      try {
        const { error } = await client
          .from('catefa_ninos')
          .insert([{ grupo_id: currentGrupoId, nombre, notas }]);

        if (error) throw error;

        formNino.reset();
        cargarNinos(currentGrupoId);
      } catch (e) {
        console.error('[Catefa] Error al guardar niño:', e);
      }
    });
  }

  function init() {
    bindUI();
    cargarParejasGuias();
    cargarGrupos();
  }

  JC.catefa = {
    init,
    cargarGrupos,
    cargarNinos,
    cargarParejasGuias
  };

  // Autoarranque si ya cargó el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();