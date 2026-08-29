/**
 * Módulo de Eventos y Agenda (Catefa / Comunidad)
 * Conexión directa a Supabase en la tabla 'catefa_eventos'
 */
const JCEventos = {
  // 1. Cargar eventos para la portada (Lectura pública)
  async cargarEventosInicio(contenedorId = 'eventos-home-list') {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    try {
      const { data, error } = await supabase
        .from('catefa_eventos')
        .select('*')
        .order('fecha', { ascending: true })
        .limit(4);

      if (error) throw error;

      if (!data || data.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">No hay eventos próximos agendados.</p>';
        return;
      }

      contenedor.innerHTML = data.map(ev => {
        const fechaObj = new Date(ev.fecha);
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <div class="event-card-mini">
            <span class="event-badge">${ev.tipo || 'General'}</span>
            <h4>${ev.titulo}</h4>
            <p class="event-date">📅 ${fechaFormateada}</p>
            ${ev.lugar ? `<p class="event-location">📍 ${ev.lugar}</p>` : ''}
            ${ev.nota ? `<p class="event-note">📝 ${ev.nota}</p>` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error al cargar eventos en inicio:', err);
      contenedor.innerHTML = '<p class="text-error">Error al cargar la agenda.</p>';
    }
  },

  // 2. Cargar lista completa / Calendario para la pestaña autenticada
  async cargarAgendaCompleta(contenedorId = 'agenda-full-list') {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    try {
      const { data, error } = await supabase
        .from('catefa_eventos')
        .select('*')
        .order('fecha', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">No hay fechas registradas en la agenda.</p>';
        return;
      }

      contenedor.innerHTML = data.map(ev => `
        <div class="event-item-full" id="ev-${ev.id}">
          <div class="event-info">
            <span class="type-tag">${ev.tipo}</span>
            <h3>${ev.titulo}</h3>
            <p><strong>Fecha:</strong> ${new Date(ev.fecha).toLocaleString('es-ES')}</p>
            ${ev.lugar ? `<p><strong>Lugar:</strong> ${ev.lugar}</p>` : ''}
            ${ev.nota ? `<div class="event-sticky-note">📌 <strong>Nota:</strong> ${ev.nota}</div>` : ''}
          </div>
          <div class="event-actions">
            <button onclick="JCEventos.eliminarEvento('${ev.id}')" class="btn-delete">🗑️ Eliminar</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error al cargar agenda completa:', err);
    }
  },

  // 3. Crear nuevo evento con notita (Solo autenticados)
  async crearEvento(e) {
    if (e) e.preventDefault();

    const titulo = document.getElementById('ev-titulo')?.value;
    const fecha = document.getElementById('ev-fecha')?.value;
    const lugar = document.getElementById('ev-lugar')?.value;
    const tipo = document.getElementById('ev-tipo')?.value;
    const nota = document.getElementById('ev-nota')?.value;
    const usuarioLogueado = localStorage.getItem('catefa_user') || 'Animador';

    if (!titulo || !fecha) {
      alert('Por favor completa el título y la fecha.');
      return;
    }

    try {
      const { error } = await supabase
        .from('catefa_eventos')
        .insert([{
          titulo,
          fecha,
          lugar,
          tipo,
          nota,
          created_by: usuarioLogueado
        }]);

      if (error) throw error;

      alert('Evento agendado con éxito');
      document.getElementById('form-crear-evento')?.reset();
      this.cargarAgendaCompleta();
      this.cargarEventosInicio();
    } catch (err) {
      console.error('Error al guardar evento:', err);
      alert('No se pudo guardar el evento.');
    }
  },

  // 4. Eliminar evento
  async eliminarEvento(id) {
    if (!confirm('¿Deseas eliminar este evento?')) return;

    try {
      const { error } = await supabase
        .from('catefa_eventos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      this.cargarAgendaCompleta();
      this.cargarEventosInicio();
    } catch (err) {
      console.error('Error al eliminar evento:', err);
    }
  }
};

window.JCEventos = JCEventos;