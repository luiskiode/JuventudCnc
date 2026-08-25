// js/catefa.js
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

  // 1. Parejas Guías
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

  // 2. Grupos
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

  // 3. Niños y Fichas de Notitas
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
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div style="flex:1;">
              <strong>${n.nombre}</strong>
              <p id="notaText-${n.id}" class="muted small" style="margin-top:4px; font-style:italic;">
                ${n.notas ? `"${n.notas}"` : 'Sin notitas'}
              </p>
            </div>
            <button class="btn small ghost btn-edit-nota" data-id="${n.id}" title="Editar nota">✏️</button>
          </div>
          <div id="editBox-${n.id}" style="display:none; margin-top:8px;">
            <textarea id="inputNota-${n.id}" rows="2" style="width:100%; font-size:12px;">${n.notas || ''}</textarea>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <button class="btn small btn-save-nota" data-id="${n.id}">Guardar</button>
              <button class="btn small ghost btn-cancel-nota" data-id="${n.id}">Cancelar</button>
            </div>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('.btn-edit-nota').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          document.getElementById(`editBox-${id}`).style.display = 'block';
        });
      });

      list.querySelectorAll('.btn-cancel-nota').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.id;
          document.getElementById(`editBox-${id}`).style.display = 'none';
        });
      });

      list.querySelectorAll('.btn-save-nota').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.dataset.id;
          const nuevaNota = document.getElementById(`inputNota-${id}`).value.trim();
          try {
            await client.from('catefa_ninos').update({ notas: nuevaNota }).eq('id', id);
            document.getElementById(`notaText-${id}`).textContent = nuevaNota ? `"${nuevaNota}"` : 'Sin notitas';
            document.getElementById(`editBox-${id}`).style.display = 'none';
          } catch (err) {
            alert('Error al actualizar la nota.');
          }
        });
      });

    } catch (e) {
      console.error('[Catefa] Error cargando niños:', e);
      list.innerHTML = '<p class="muted small">Error al cargar la lista.</p>';
    }
  }

  // 4. Detección de Faltas Consecutivas (Alerta >= 2)
  async function calcularInasistenciasPrevias(grupoId) {
    const client = getClient();
    const mapaAlertas = {};
    if (!client || !grupoId) return mapaAlertas;

    try {
      // Obtener las últimas 2 sesiones anteriores del grupo
      const { data: sesiones } = await client
        .from('catefa_sesiones')
        .select('id, fecha')
        .eq('grupo_id', grupoId)
        .neq('id', currentSesionId || '00000000-0000-0000-0000-000000000000')
        .order('fecha', { ascending: false })
        .limit(2);

      if (!sesiones || sesiones.length < 2) return mapaAlertas;

      const sesionIds = sesiones.map(s => s.id);
      const { data: asistencias } = await client
        .from('catefa_asistencias')
        .select('nino_id, sesion_id, presente')
        .in('sesion_id', sesionIds);

      const conteoFaltas = {};
      (asistencias || []).forEach(a => {
        if (!a.presente) {
          conteoFaltas[a.nino_id] = (conteoFaltas[a.nino_id] || 0) + 1;
        }
      });

      Object.entries(conteoFaltas).forEach(([ninoId, faltas]) => {
        if (faltas >= 2) mapaAlertas[ninoId] = true;
      });
    } catch (e) {
      console.warn('[Catefa] Error calculando inasistencias:', e);
    }
    return mapaAlertas;
  }

  // 5. Asistencias
  async function cargarAsistencias(grupoId) {
    const list = document.getElementById('listaAsistencias');
    const badgeContador = document.getElementById('contadorAsistencias');
    const client = getClient();
    if (!list || !grupoId) return;

    if (!currentSesionId) {
      list.innerHTML = '<p class="muted small">Pulsa "Cargar / Guardar Sesión" para iniciar el pase de lista.</p>';
      badgeContador.textContent = '0 presentes';
      return;
    }

    list.innerHTML = '<p class="muted small">Cargando lista de asistencia...</p>';

    try {
      const { data: ninos, error: errN } = await client
        .from('catefa_ninos')
        .select('id, nombre, notas')
        .eq('grupo_id', grupoId)
        .order('nombre', { ascending: true });

      if (errN) throw errN;

      if (!ninos || ninos.length === 0) {
        list.innerHTML = '<p class="muted small">No hay niños en este grupo para tomar asistencia.</p>';
        badgeContador.textContent = '0 presentes';
        return;
      }

      const { data: asistencias, error: errA } = await client
        .from('catefa_asistencias')
        .select('nino_id, presente')
        .eq('sesion_id', currentSesionId);

      if (errA) throw errA;

      const alertasFaltas = await calcularInasistenciasPrevias(grupoId);

      const asistMap = {};
      (asistencias || []).forEach((a) => {
        asistMap[a.nino_id] = a.presente;
      });

      let presentesCount = 0;
      list.innerHTML = '';

      ninos.forEach((n) => {
        const isPresente = asistMap[n.id] === true;
        if (isPresente) presentesCount++;

        const tieneAlerta = alertasFaltas[n.id];

        const row = document.createElement('div');
        row.style.cssText =
          'background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; border:1px solid rgba(148,163,184,0.15); display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;';

        row.innerHTML = `
          <div>
            <strong>${n.nombre}</strong>
            ${tieneAlerta ? '<span style="display:inline-block; font-size:11px; background:rgba(239,68,68,0.2); color:#fca5a5; border:1px solid rgba(239,68,68,0.3); padding:2px 6px; border-radius:999px; margin-left:6px;">⚠️ 2+ Faltas</span>' : ''}
          </div>
          <button class="btn small ${isPresente ? '' : 'ghost'} btn-asistencia" data-nino="${n.id}" data-presente="${isPresente}">
            ${isPresente ? '✅ Presente' : '❌ Falta'}
          </button>
        `;
        list.appendChild(row);
      });

      badgeContador.textContent = `${presentesCount} presentes de ${ninos.length}`;

      list.querySelectorAll('.btn-asistencia').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const ninoId = btn.dataset.nino;
          const nuevoEstado = btn.dataset.presente !== 'true';
          btn.disabled = true;

          try {
            const { data: existing } = await client
              .from('catefa_asistencias')
              .select('id')
              .eq('sesion_id', currentSesionId)
              .eq('nino_id', ninoId)
              .maybeSingle();

            if (existing && existing.id) {
              await client
                .from('catefa_asistencias')
                .update({ presente: nuevoEstado })
                .eq('id', existing.id);
            } else {
              await client
                .from('catefa_asistencias')
                .insert([{
                  sesion_id: currentSesionId,
                  nino_id: ninoId,
                  presente: nuevoEstado
                }]);
            }

            await cargarAsistencias(grupoId);
          } catch (e) {
            console.error('[Catefa] Error al registrar asistencia:', e);
            btn.disabled = false;
          }
        });
      });

    } catch (e) {
      console.error('[Catefa] Error cargando asistencias:', e);
      list.innerHTML = '<p class="muted small">Error al cargar la asistencia.</p>';
    }
  }

  // 6. Formatear y Asegurar Sesión (Título - Fecha)
  async function asegurarSesionHoy(grupoId, forzarTema = '') {
    if (!grupoId) return;
    const client = getClient();
    const hoy = new Date().toISOString().split('T')[0];
    
    let baseTema = forzarTema || document.getElementById('inputTemaSesion')?.value.trim() || 'Sesión Ordinaria';
    // Limpiar si ya tenía fecha concatenada para no duplicar
    baseTema = baseTema.replace(/ - \d{4}-\d{2}-\d{2}$/, '').trim();
    const temaCompleto = `${baseTema} - ${hoy}`;

    try {
      let { data: sesion } = await client
        .from('catefa_sesiones')
        .select('*')
        .eq('grupo_id', grupoId)
        .eq('fecha', hoy)
        .maybeSingle();

      if (!sesion) {
        const { data: nueva, error: errInsert } = await client
          .from('catefa_sesiones')
          .insert([{ grupo_id: grupoId, tema: temaCompleto, fecha: hoy }])
          .select()
          .single();

        if (errInsert) throw errInsert;
        sesion = nueva;
      } else if (forzarTema) {
        const { data: updated } = await client
          .from('catefa_sesiones')
          .update({ tema: temaCompleto })
          .eq('id', sesion.id)
          .select()
          .single();
        if (updated) sesion = updated;
      }

      currentSesionId = sesion.id;
      if (document.getElementById('inputTemaSesion')) {
        document.getElementById('inputTemaSesion').value = sesion.tema || temaCompleto;
      }
      await cargarAsistencias(grupoId);
    } catch (err) {
      console.error('[Catefa] Error gestionando sesión:', err);
    }
  }

  // 7. Descargar Reporte en Excel (.CSV UTF-8)
  async function descargarReporteExcel() {
    if (!currentGrupoId || !currentSesionId) {
      alert('Selecciona un grupo y abre una sesión primero para descargar el reporte.');
      return;
    }

    const client = getClient();
    try {
      const { data: grupo } = await client.from('catefa_grupos').select('nombre').eq('id', currentGrupoId).single();
      const { data: sesion } = await client.from('catefa_sesiones').select('tema, fecha').eq('id', currentSesionId).single();
      const { data: ninos } = await client.from('catefa_ninos').select('id, nombre, notas').eq('grupo_id', currentGrupoId).order('nombre', { ascending: true });
      const { data: asistencias } = await client.from('catefa_asistencias').select('nino_id, presente').eq('sesion_id', currentSesionId);
      const alertas = await calcularInasistenciasPrevias(currentGrupoId);

      const asistMap = {};
      (asistencias || []).forEach(a => asistMap[a.nino_id] = a.presente);

      let csvContent = "\uFEFF"; // BOM UTF-8 para visualización correcta en Excel
      csvContent += `Reporte de Asistencia Catefa\n`;
      csvContent += `Grupo:,"${grupo?.nombre || ''}"\n`;
      csvContent += `Sesion:,"${sesion?.tema || ''}"\n`;
      csvContent += `Fecha:,"${sesion?.fecha || ''}"\n\n`;
      csvContent += `N°,Nombre del Niño,Estado,Alerta Pastoral,Notitas Pastorales\n`;

      (ninos || []).forEach((n, idx) => {
        const estado = asistMap[n.id] ? "PRESENTE" : "FALTA";
        const alerta = alertas[n.id] ? "ALERTA (2+ Faltas Consecutivas)" : "Al día";
        const notas = (n.notas || '').replace(/"/g, '""');
        csvContent += `${idx + 1},"${n.nombre}","${estado}","${alerta}","${notas}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Asistencia_${(grupo?.nombre || 'Catefa').replace(/\s+/g, '_')}_${sesion?.fecha || 'hoy'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('[Catefa] Error al exportar excel:', e);
      alert('Error al generar el reporte.');
    }
  }

  // 8. Enlace de Eventos
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

    const tabBtnNinos = document.getElementById('tabBtnNinos');
    const tabBtnAsistencias = document.getElementById('tabBtnAsistencias');
    const subvistaNinos = document.getElementById('subvistaNinos');
    const subvistaAsistencias = document.getElementById('subvistaAsistencias');
    const btnIniciarSesion = document.getElementById('btnIniciarSesion');
    const btnDescargarExcel = document.getElementById('btnDescargarExcel');
    const inputTemaSesion = document.getElementById('inputTemaSesion');

    tabBtnNinos?.addEventListener('click', () => {
      tabBtnNinos.classList.remove('ghost');
      tabBtnAsistencias.classList.add('ghost');
      subvistaNinos.style.display = 'block';
      subvistaAsistencias.style.display = 'none';
      if (currentGrupoId) cargarNinos(currentGrupoId);
    });

    tabBtnAsistencias?.addEventListener('click', () => {
      tabBtnAsistencias.classList.remove('ghost');
      tabBtnNinos.classList.add('ghost');
      subvistaNinos.style.display = 'none';
      subvistaAsistencias.style.display = 'block';
      if (currentGrupoId) asegurarSesionHoy(currentGrupoId);
    });

    select?.addEventListener('change', (e) => {
      currentGrupoId = e.target.value;
      currentSesionId = null;
      cargarNinos(currentGrupoId);
      if (subvistaAsistencias && subvistaAsistencias.style.display !== 'none') {
        asegurarSesionHoy(currentGrupoId);
      }
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

    btnIniciarSesion?.addEventListener('click', async () => {
      if (!currentGrupoId) {
        alert('Selecciona un grupo primero.');
        return;
      }
      const tema = inputTemaSesion?.value.trim();
      await asegurarSesionHoy(currentGrupoId, tema);
    });

    btnDescargarExcel?.addEventListener('click', descargarReporteExcel);
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
    cargarParejasGuias,
    cargarAsistencias,
    asegurarSesionHoy,
    descargarReporteExcel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();