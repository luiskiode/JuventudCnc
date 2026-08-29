/* ============================================================
   js/catefa.js — Gestión de Grupos, Asistencia e Historial Central
   ============================================================ */

(function () {
  "use strict";

  const JC = (window.JC = window.JC || {});
  let currentGrupoId = null;
  let currentSesionId = null;

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

  // 1. Cargar lista de Parejas Guías en el selector
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
          guiasNombres = data.map((d) => d.nombre);
        }
      } catch (err) {
        console.warn('[Catefa] Usando lista base de parejas:', err);
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

  // 2. Cargar Grupos de la BD
  async function cargarGrupos() {
    const select = document.getElementById('selectGrupo');
    const client = getClient();
    const user = getUser();
    if (!select || !client) return;

    try {
      let query = client.from('catefa_grupos').select('*').order('nombre', { ascending: true });

      if (user.rol === 'pareja_guia') {
        query = query.ilike('pareja_guia', `%${user.nombre}%`);
      }

      const { data: grupos, error } = await query;
      if (error) throw error;

      select.innerHTML = '<option value="">-- Selecciona tu grupo --</option>';

      if (!grupos || grupos.length === 0) {
        select.innerHTML = '<option value="">-- No hay grupos registrados --</option>';
        renderBloqueResumen(null);
      } else {
        grupos.forEach((g) => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = `${g.nombre} ${g.pareja_guia ? '· [' + g.pareja_guia + ']' : ''}`;
          select.appendChild(opt);
        });

        if (!currentGrupoId || !grupos.some(g => g.id === currentGrupoId)) {
          currentGrupoId = grupos[0].id;
        }
        select.value = currentGrupoId;
        const grupoActual = grupos.find(g => g.id === currentGrupoId) || grupos[0];
        
        renderBloqueResumen(grupoActual);
        cargarNinos(currentGrupoId);
        cargarHistorialSesiones(currentGrupoId);
      }
    } catch (e) {
      console.error('[Catefa] Error al cargar grupos:', e);
    }
  }

  // Renderizar la tarjeta informativa de la Pareja Guía / Grupo
  function renderBloqueResumen(grupo) {
    const container = document.getElementById('bloqueResumenGrupo');
    if (!container) return;

    if (!grupo) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px 0;">📖 ${JC.safeText(grupo.nombre)}</h4>
            <p class="muted small" style="margin:0;">
              <strong>Pareja Guía:</strong> ${JC.safeText(grupo.pareja_guia || 'Sin asignar')}
            </p>
          </div>
          <span style="font-size:12px; background:rgba(59,130,246,0.2); color:#93c5fd; padding:4px 10px; border-radius:20px;">
            Grupo Activo
          </span>
        </div>
      </div>
    `;
  }

  // 3. Guardar Nuevo Grupo
  async function crearGrupo() {
    const client = getClient();
    const nombre = document.getElementById('inputNombreGrupo')?.value.trim();
    const parejaGuia = document.getElementById('selectParejaGuia')?.value;

    if (!nombre) return alert('Por favor ingresa un nombre para el grupo.');
    if (!parejaGuia) return alert('Por favor selecciona la Pareja Guía asignada.');

    try {
      const { data, error } = await client
        .from('catefa_grupos')
        .insert([{ nombre, pareja_guia: parejaGuia }])
        .select()
        .single();

      if (error) throw error;

      alert('¡Grupo creado correctamente!');
      document.getElementById('inputNombreGrupo').value = '';
      document.getElementById('formNuevoGrupoWrap').style.display = 'none';

      currentGrupoId = data.id;
      await cargarGrupos();
    } catch (e) {
      console.error('[Catefa] Error al crear grupo:', e);
      alert('Error al guardar el grupo en la base de datos.');
    }
  }

  // 4. Obtener Faltas Totales por Niño
  async function obtenerConteoFaltas(grupoId) {
    const client = getClient();
    const mapaFaltas = {};
    if (!client || !grupoId) return mapaFaltas;

    try {
      const { data: asistencias } = await client
        .from('catefa_asistencias')
        .select('nino_id, presente, catefa_sesiones!inner(grupo_id)')
        .eq('catefa_sesiones.grupo_id', grupoId)
        .eq('presente', false);

      (asistencias || []).forEach(a => {
        mapaFaltas[a.nino_id] = (mapaFaltas[a.nino_id] || 0) + 1;
      });
    } catch (e) {
      console.warn('[Catefa] Error obteniendo conteo de faltas:', e);
    }
    return mapaFaltas;
  }

  // 5. Cargar Niños del Grupo y Notitas
  async function cargarNinos(grupoId) {
    const list = document.getElementById('listaNinos');
    const client = getClient();
    if (!list) return;

    if (!grupoId) {
      list.innerHTML = '<p class="muted small">Selecciona un grupo para ver a los niños.</p>';
      return;
    }

    list.innerHTML = '<p class="muted small">Cargando niños...</p>';

    try {
      const { data: ninos } = await client
        .from('catefa_ninos')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('nombre', { ascending: true });

      const mapaFaltas = await obtenerConteoFaltas(grupoId);

      if (!ninos || ninos.length === 0) {
        list.innerHTML = '<p class="muted small">No hay niños registrados en este grupo.</p>';
        return;
      }

      list.innerHTML = '';
      ninos.forEach((n) => {
        const totalFaltas = mapaFaltas[n.id] || 0;
        const item = document.createElement('div');
        item.style.cssText = 'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); margin-bottom:8px;';
        
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div style="flex:1;">
              <strong>${JC.safeText(n.nombre)}</strong>
              <span style="font-size:11px; margin-left:8px; padding:2px 8px; border-radius:10px; background:${totalFaltas > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}; color:${totalFaltas > 0 ? '#fca5a5' : '#86efac'};">
                ${totalFaltas} falta(s) acumulada(s)
              </span>
              <p id="notaText-${n.id}" class="muted small" style="margin-top:4px; font-style:italic;">
                ${n.notas ? `"${JC.safeText(n.notas)}"` : 'Sin notitas'}
              </p>
            </div>
            <button class="btn small ghost btn-edit-nota" data-id="${n.id}">✏️</button>
          </div>
          <div id="editBox-${n.id}" style="display:none; margin-top:8px;">
            <textarea id="inputNota-${n.id}" rows="2" style="width:100%; font-size:12px;">${JC.safeText(n.notas || '')}</textarea>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <button class="btn small btn-save-nota" data-id="${n.id}">Guardar</button>
              <button class="btn small ghost btn-cancel-nota" data-id="${n.id}">Cancelar</button>
            </div>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('.btn-edit-nota').forEach(b => b.addEventListener('click', () => {
        document.getElementById(`editBox-${b.dataset.id}`).style.display = 'block';
      }));
      list.querySelectorAll('.btn-cancel-nota').forEach(b => b.addEventListener('click', () => {
        document.getElementById(`editBox-${b.dataset.id}`).style.display = 'none';
      }));
      list.querySelectorAll('.btn-save-nota').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const nuevaNota = document.getElementById(`inputNota-${id}`).value.trim();
        await client.from('catefa_ninos').update({ notas: nuevaNota }).eq('id', id);
        cargarNinos(grupoId);
      }));

    } catch (e) {
      console.error('[Catefa] Error cargando niños:', e);
    }
  }

  // 6. Tomar Asistencias
  async function cargarAsistencias(grupoId) {
    const list = document.getElementById('listaAsistencias');
    const badgeContador = document.getElementById('contadorAsistencias');
    const client = getClient();
    if (!list || !grupoId) return;

    if (!currentSesionId) {
      list.innerHTML = '<p class="muted small">Ingresa el tema y haz clic en "Cargar / Guardar Sesión" para tomar asistencia.</p>';
      if (badgeContador) badgeContador.textContent = '0 presentes';
      return;
    }

    try {
      const { data: ninos } = await client.from('catefa_ninos').select('id, nombre').eq('grupo_id', grupoId).order('nombre', { ascending: true });
      const { data: asistencias } = await client.from('catefa_asistencias').select('nino_id, presente').eq('sesion_id', currentSesionId);
      const mapaFaltas = await obtenerConteoFaltas(grupoId);

      const asistMap = {};
      (asistencias || []).forEach(a => asistMap[a.nino_id] = a.presente);

      let presentesCount = 0;
      list.innerHTML = '';

      (ninos || []).forEach((n) => {
        const isPresente = asistMap[n.id] === true;
        if (isPresente) presentesCount++;
        const faltasAcumuladas = mapaFaltas[n.id] || 0;

        const row = document.createElement('div');
        row.style.cssText = 'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
        row.innerHTML = `
          <div>
            <strong>${JC.safeText(n.nombre)}</strong>
            <p class="muted small" style="margin:2px 0 0 0;">Faltas totales: <strong>${faltasAcumuladas}</strong></p>
          </div>
          <button class="btn small ${isPresente ? '' : 'ghost'} btn-asistencia" data-nino="${n.id}" data-presente="${isPresente}">
            ${isPresente ? '✅ Presente' : '❌ Falta'}
          </button>
        `;
        list.appendChild(row);
      });

      if (badgeContador) badgeContador.textContent = `${presentesCount} presentes de ${ninos.length}`;

      list.querySelectorAll('.btn-asistencia').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ninoId = btn.dataset.nino;
          const nuevoEstado = btn.dataset.presente !== 'true';

          const { data: existing } = await client.from('catefa_asistencias').select('id').eq('sesion_id', currentSesionId).eq('nino_id', ninoId).maybeSingle();

          if (existing?.id) {
            await client.from('catefa_asistencias').update({ presente: nuevoEstado }).eq('id', existing.id);
          } else {
            await client.from('catefa_asistencias').insert([{ sesion_id: currentSesionId, nino_id: ninoId, presente: nuevoEstado }]);
          }
          await cargarAsistencias(grupoId);
          await cargarNinos(grupoId);
        });
      });
    } catch (e) {
      console.error('[Catefa] Error cargando asistencias:', e);
    }
  }

  // 7. Historial de Sesiones Registradas
  async function cargarHistorialSesiones(grupoId) {
    const container = document.getElementById('historialSesiones');
    const client = getClient();
    if (!container || !grupoId || !client) return;

    container.innerHTML = '<p class="muted small">Cargando historial...</p>';

    try {
      const { data: sesiones, error } = await client
        .from('catefa_sesiones')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('fecha', { ascending: false });

      if (error) throw error;

      if (!sesiones || sesiones.length === 0) {
        container.innerHTML = '<p class="muted small">No hay sesiones registradas en el historial de este grupo.</p>';
        return;
      }

      container.innerHTML = '';
      sesiones.forEach((s) => {
        const item = document.createElement('div');
        item.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:10px 12px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;';
        item.innerHTML = `
          <div>
            <strong>📅 ${JC.safeText(s.fecha)}</strong>
            <p class="muted small" style="margin:2px 0 0 0;">Tema: <strong>${JC.safeText(s.tema || 'Formación del Lunes')}</strong></p>
          </div>
          <button class="btn small ghost btn-ver-sesion" data-id="${s.id}" data-fecha="${s.fecha}" data-tema="${JC.safeText(s.tema || '')}">👁️ Ver Detalle</button>
        `;
        container.appendChild(item);
      });

      container.querySelectorAll('.btn-ver-sesion').forEach(btn => {
        btn.addEventListener('click', () => abrirModalRevisarSesion(btn.dataset.id, btn.dataset.fecha, btn.dataset.tema));
      });

    } catch (e) {
      console.error('[Catefa] Error al cargar historial:', e);
    }
  }

  // Modal para revisar detalle de asistencia pasada
  async function abrirModalRevisarSesion(sesionId, fecha, tema) {
    const client = getClient();
    try {
      const { data: asistencias } = await client
        .from('catefa_asistencias')
        .select('presente, catefa_ninos(nombre)')
        .eq('sesion_id', sesionId);

      let mensaje = `--- DETALLE DE SESIÓN ---\nFecha: ${fecha}\nTema: ${tema}\n\n`;
      if (!asistencias || asistencias.length === 0) {
        mensaje += "No se registraron datos para este tema.";
      } else {
        asistencias.forEach(a => {
          const estado = a.presente ? '✅ Presente' : '❌ Falta';
          mensaje += `${estado} — ${a.catefa_ninos?.nombre || 'Niño'}\n`;
        });
      }
      alert(mensaje);
    } catch (e) {
      console.error('[Catefa] Error al revisar sesión:', e);
    }
  }

  // 8. Crear / Asegurar Sesión con el Tema
  async function asegurarSesionHoy(grupoId) {
    if (!grupoId) return;
    const client = getClient();
    const hoy = new Date().toISOString().split('T')[0];
    const temaIngresado = document.getElementById('inputTemaSesion')?.value.trim();

    if (!temaIngresado) {
      alert('Ingresa el tema de formación antes de cargar la sesión.');
      return;
    }

    try {
      let { data: sesion } = await client
        .from('catefa_sesiones')
        .select('*')
        .eq('grupo_id', grupoId)
        .eq('fecha', hoy)
        .maybeSingle();

      if (!sesion) {
        const { data: nueva, error } = await client
          .from('catefa_sesiones')
          .insert([{ grupo_id: grupoId, tema: temaIngresado, fecha: hoy }])
          .select()
          .single();
        if (error) throw error;
        sesion = nueva;
      } else {
        await client.from('catefa_sesiones').update({ tema: temaIngresado }).eq('id', sesion.id);
      }

      currentSesionId = sesion.id;
      await cargarAsistencias(grupoId);
      await cargarHistorialSesiones(grupoId);
      alert('¡Tema registrado correctamente en el historial!');
    } catch (err) {
      console.error('[Catefa] Error gestionando sesión:', err);
    }
  }

  // 9. Vincular Formulario de Registro de Niños
  function bindFormNino() {
    const formNino = document.getElementById('formNino');
    if (!formNino || formNino.dataset.bound) return;
    formNino.dataset.bound = "true";

    formNino.addEventListener('submit', async (e) => {
      e.preventDefault();
      const client = getClient();
      const nombre = document.getElementById('ninoNombre')?.value.trim();
      const notas = document.getElementById('ninoNotas')?.value.trim();

      if (!nombre || !currentGrupoId) {
        return alert('Ingresa un nombre y selecciona un grupo activo.');
      }

      try {
        const { error } = await client.from('catefa_ninos').insert([{
          nombre,
          notas,
          grupo_id: currentGrupoId
        }]);

        if (error) throw error;

        document.getElementById('ninoNombre').value = '';
        document.getElementById('ninoNotas').value = '';
        await cargarNinos(currentGrupoId);
      } catch (e) {
        console.error('[Catefa] Error guardando niño:', e);
      }
    });
  }

  // 10. Eventos de la UI
  function bindUI() {
    if (window.__JC_CATEFA_BOUND__) return;
    window.__JC_CATEFA_BOUND__ = true;

    // Selector de Grupos
    document.getElementById('selectGrupo')?.addEventListener('change', (e) => {
      currentGrupoId = e.target.value;
      currentSesionId = null;
      cargarGrupos();
    });

    // Botones de Crear Grupo
    document.getElementById('btnNuevoGrupo')?.addEventListener('click', () => {
      const wrap = document.getElementById('formNuevoGrupoWrap');
      if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btnCancelarGrupo')?.addEventListener('click', () => {
      const wrap = document.getElementById('formNuevoGrupoWrap');
      if (wrap) wrap.style.display = 'none';
    });

    document.getElementById('btnGuardarGrupo')?.addEventListener('click', crearGrupo);

    // Botón Iniciar / Cargar Sesión
    document.getElementById('btnIniciarSesion')?.addEventListener('click', async () => {
      if (!currentGrupoId) return alert('Selecciona un grupo primero.');
      await asegurarSesionHoy(currentGrupoId);
    });

    bindFormNino();
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
    cargarAsistencias,
    cargarHistorialSesiones,
    asegurarSesionHoy
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();