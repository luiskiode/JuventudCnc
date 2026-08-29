/* ============================================================
   js/catefa.js — Gestión de Grupos, Asistencia e Historial
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

  // 1. Cargar Parejas Guías
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
        console.warn('[Catefa] Usando lista local:', err);
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

  // 2. Cargar Grupos y Renderizar Bloque de Resumen (Pareja Guía / Animador)
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
        select.innerHTML = '<option value="">-- No hay grupos asignados --</option>';
        renderBloqueResumen(null);
      } else {
        grupos.forEach((g) => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = `${g.nombre} ${g.pareja_guia ? '· [' + g.pareja_guia + ']' : ''}`;
          select.appendChild(opt);
        });

        if (!currentGrupoId) {
          currentGrupoId = grupos[0].id;
        }
        select.value = currentGrupoId;
        const grupoActual = grupos.find(g => g.id === currentGrupoId) || grupos[0];
        renderBloqueResumen(grupoActual);
        cargarNinos(currentGrupoId);
        cargarHistorialSesiones(currentGrupoId);
      }
    } catch (e) {
      console.error('[Catefa] Error cargando grupos:', e);
    }
  }

  // Renderiza el bloque superior informativo
  function renderBloqueResumen(grupo) {
    const container = document.getElementById('bloqueResumenGrupo');
    if (!container) return;

    if (!grupo) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
        <div style="display:flex; justify-width:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px 0;">📖 ${JC.safeText(grupo.nombre)}</h4>
            <p class="muted small" style="margin:0;">
              <strong>Pareja Guía:</strong> ${JC.safeText(grupo.pareja_guia || 'Sin asignar')} | 
              <strong>Animador:</strong> ${JC.safeText(grupo.animador_nombre || 'Asignado')}
            </p>
          </div>
          <span style="font-size:12px; background:rgba(59,130,246,0.2); color:#93c5fd; padding:4px 10px; border-radius:20px;">
            Bloque Activo
          </span>
        </div>
      </div>
    `;
  }

  // 3. Niños y Notitas
  async function cargarNinos(grupoId) {
    const list = document.getElementById('listaNinos');
    const client = getClient();
    if (!list) return;

    if (!grupoId) {
      list.innerHTML = '<p class="muted small">Selecciona un grupo para ver los niños.</p>';
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
        list.innerHTML = '<p class="muted small">No hay niños registrados en este grupo.</p>';
        return;
      }

      list.innerHTML = '';
      ninos.forEach((n) => {
        const item = document.createElement('div');
        item.style.cssText = 'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); margin-bottom:8px;';
        
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div style="flex:1;">
              <strong>${JC.safeText(n.nombre)}</strong>
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

  // 4. Inasistencias Previas (Alertas)
  async function calcularInasistenciasPrevias(grupoId) {
    const client = getClient();
    const mapaAlertas = {};
    if (!client || !grupoId) return mapaAlertas;

    try {
      const { data: sesiones } = await client
        .from('catefa_sesiones')
        .select('id')
        .eq('grupo_id', grupoId)
        .neq('id', currentSesionId || '00000000-0000-0000-0000-000000000000')
        .order('fecha', { ascending: false })
        .limit(2);

      if (!sesiones || sesiones.length < 2) return mapaAlertas;

      const { data: asistencias } = await client
        .from('catefa_asistencias')
        .select('nino_id, presente')
        .in('sesion_id', sesiones.map(s => s.id));

      const conteoFaltas = {};
      (asistencias || []).forEach(a => {
        if (!a.presente) conteoFaltas[a.nino_id] = (conteoFaltas[a.nino_id] || 0) + 1;
      });

      Object.entries(conteoFaltas).forEach(([ninoId, faltas]) => {
        if (faltas >= 2) mapaAlertas[ninoId] = true;
      });
    } catch (e) {
      console.warn('[Catefa] Error en alertas de inasistencias:', e);
    }
    return mapaAlertas;
  }

  // 5. Cargar Asistencias Actuales
  async function cargarAsistencias(grupoId) {
    const list = document.getElementById('listaAsistencias');
    const badgeContador = document.getElementById('contadorAsistencias');
    const client = getClient();
    if (!list || !grupoId) return;

    if (!currentSesionId) {
      list.innerHTML = '<p class="muted small">Inicia o carga una sesión para tomar asistencia.</p>';
      if (badgeContador) badgeContador.textContent = '0 presentes';
      return;
    }

    try {
      const { data: ninos } = await client.from('catefa_ninos').select('id, nombre').eq('grupo_id', grupoId).order('nombre', { ascending: true });
      const { data: asistencias } = await client.from('catefa_asistencias').select('nino_id, presente').eq('sesion_id', currentSesionId);
      const alertasFaltas = await calcularInasistenciasPrevias(grupoId);

      const asistMap = {};
      (asistencias || []).forEach(a => asistMap[a.nino_id] = a.presente);

      let presentesCount = 0;
      list.innerHTML = '';

      (ninos || []).forEach((n) => {
        const isPresente = asistMap[n.id] === true;
        if (isPresente) presentesCount++;

        const row = document.createElement('div');
        row.style.cssText = 'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
        row.innerHTML = `
          <div>
            <strong>${JC.safeText(n.nombre)}</strong>
            ${alertasFaltas[n.id] ? '<span style="font-size:11px; background:rgba(239,68,68,0.2); color:#fca5a5; padding:2px 6px; border-radius:10px; margin-left:6px;">⚠️ 2+ Faltas</span>' : ''}
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
        });
      });
    } catch (e) {
      console.error('[Catefa] Error cargando asistencias:', e);
    }
  }

  // 6. Historial de Sesiones y Temas Ordenados
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
        container.innerHTML = '<p class="muted small">No hay sesiones pasadas registradas.</p>';
        return;
      }

      container.innerHTML = '';
      sesiones.forEach((s) => {
        const item = document.createElement('div');
        item.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:10px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;';
        item.innerHTML = `
          <div>
            <strong>📅 ${JC.safeText(s.fecha)}</strong>
            <p class="muted small" style="margin:2px 0 0 0;">${JC.safeText(s.tema || 'Sesión ordinaria')}</p>
          </div>
          <button class="btn small ghost btn-ver-sesion" data-id="${s.id}" data-fecha="${s.fecha}" data-tema="${JC.safeText(s.tema || '')}">👁️ Revisar</button>
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

  // Modal de revisión de sesiones pasadas (Solo lectura)
  async function abrirModalRevisarSesion(sesionId, fecha, tema) {
    const client = getClient();
    try {
      const { data: asistencias } = await client
        .from('catefa_asistencias')
        .select('presente, catefa_ninos(nombre)')
        .eq('sesion_id', sesionId);

      let detalleHtml = `<p><strong>Fecha:</strong> ${fecha}</p><p><strong>Tema:</strong> ${tema}</p><hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:10px 0;"/>`;
      
      if (!asistencias || asistencias.length === 0) {
        detalleHtml += '<p class="muted small">No hay datos de asistencia para esta fecha.</p>';
      } else {
        detalleHtml += '<ul style="list-style:none; padding:0; font-size:13px;">';
        asistencias.forEach(a => {
          const estado = a.presente ? '✅ Presente' : '❌ Falta';
          detalleHtml += `<li style="margin-bottom:4px;">${estado} — ${JC.safeText(a.catefa_ninos?.nombre || 'Niño')}</li>`;
        });
        detalleHtml += '</ul>';
      }

      alert(`--- REVISIÓN DE SESIÓN ---\nFecha: ${fecha}\nTema: ${tema}\n\nRevisa los detalles completos en la sección de reportes.`);
    } catch (e) {
      console.error('[Catefa] Error al revisar sesión:', e);
    }
  }

  // 7. Crear / Asegurar Sesión
  async function asegurarSesionHoy(grupoId, forzarTema = '') {
    if (!grupoId) return;
    const client = getClient();
    const hoy = new Date().toISOString().split('T')[0];
    
    let baseTema = forzarTema || document.getElementById('inputTemaSesion')?.value.trim() || 'Sesión Ordinaria';
    baseTema = baseTema.replace(/ - \d{4}-\d{2}-\d{2}$/, '').trim();
    const temaCompleto = `${baseTema} - ${hoy}`;

    try {
      let { data: sesion } = await client.from('catefa_sesiones').select('*').eq('grupo_id', grupoId).eq('fecha', hoy).maybeSingle();

      if (!sesion) {
        const { data: nueva } = await client.from('catefa_sesiones').insert([{ grupo_id: grupoId, tema: temaCompleto, fecha: hoy }]).select().single();
        sesion = nueva;
      }

      currentSesionId = sesion.id;
      if (document.getElementById('inputTemaSesion')) {
        document.getElementById('inputTemaSesion').value = sesion.tema || temaCompleto;
      }
      await cargarAsistencias(grupoId);
      await cargarHistorialSesiones(grupoId);
    } catch (err) {
      console.error('[Catefa] Error gestionando sesión:', err);
    }
  }

  // 8. Eventos UI
  function bindUI() {
    if (window.__JC_CATEFA_BOUND__) return;
    window.__JC_CATEFA_BOUND__ = true;

    document.getElementById('selectGrupo')?.addEventListener('change', (e) => {
      currentGrupoId = e.target.value;
      currentSesionId = null;
      cargarGrupos();
    });

    document.getElementById('btnIniciarSesion')?.addEventListener('click', async () => {
      if (!currentGrupoId) return alert('Selecciona un grupo primero.');
      await asegurarSesionHoy(currentGrupoId);
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