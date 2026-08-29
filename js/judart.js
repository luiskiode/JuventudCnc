/**
 * Módulo Judart (Muro Social y Galería de la Comunidad)
 * Conexión directa a Supabase en 'catefa_recursos' y 'catefa_comentarios'
 */
const JCJudart = {
  // 1. Cargar muro para la portada (Lectura pública)
  async cargarInicio(contenedorId = 'judart-home-grid') {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    try {
      const { data, error } = await supabase
        .from('catefa_recursos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      if (!data || data.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">No hay publicaciones recientes.</p>';
        return;
      }

      contenedor.innerHTML = data.map(post => `
        <div class="judart-card-public">
          ${post.media_type === 'image' 
            ? `<img src="${post.media_url}" alt="${post.titulo}" loading="lazy">`
            : `<div class="media-placeholder">🎥 Video / Enlace</div>`
          }
          <div class="judart-card-body">
            <h4>${post.titulo}</h4>
            <p>${post.descripcion || ''}</p>
            <span class="likes-count">❤️ ${post.likes_count || 0}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Error al cargar publicaciones en inicio:', err);
      contenedor.innerHTML = '<p class="text-error">Error al cargar galería.</p>';
    }
  },

  // 2. Muro interactivo completo (Pestaña autenticada: subir, reaccionar, comentar)
  async cargarMuroCompleto(contenedorId = 'judart-full-feed') {
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;

    try {
      const { data, error } = await supabase
        .from('catefa_recursos')
        .select(`
          *,
          catefa_comentarios (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        contenedor.innerHTML = '<p class="text-muted">El muro está vacío. ¡Sé el primero en subir una foto!</p>';
        return;
      }

      contenedor.innerHTML = data.map(post => {
        const comentarios = post.catefa_comentarios || [];

        return `
          <div class="judart-post" id="post-${post.id}">
            <div class="post-header">
              <strong>${post.created_by || 'Joven Parroquia'}</strong>
              <small>${new Date(post.created_at).toLocaleDateString()}</small>
            </div>
            
            <div class="post-media">
              ${post.media_type === 'image' 
                ? `<img src="${post.media_url}" alt="${post.titulo}">`
                : `<a href="${post.media_url}" target="_blank" class="video-link">▶️ Ver recurso enlace</a>`
              }
            </div>

            <div class="post-content">
              <h3>${post.titulo}</h3>
              <p>${post.descripcion || ''}</p>
            </div>

            <div class="post-actions">
              <button onclick="JCJudart.darLike('${post.id}', ${post.likes_count || 0})" class="btn-like">
                ❤️ ${post.likes_count || 0} Me gusta
              </button>
            </div>

            <div class="post-comments-section">
              <h5>Comentarios (${comentarios.length})</h5>
              <div class="comments-list">
                ${comentarios.map(c => `
                  <div class="comment-item">
                    <strong>${c.usuario_nombre}:</strong> ${c.comentario}
                  </div>
                `).join('')}
              </div>

              <div class="add-comment-form">
                <input type="text" id="input-comentario-${post.id}" placeholder="Escribe un comentario...">
                <button onclick="JCJudart.agregarComentario('${post.id}')">Enviar</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error al cargar muro completo:', err);
    }
  },

  // 3. Publicar nueva foto o recurso
  async crearPublicacion(e) {
    if (e) e.preventDefault();

    const titulo = document.getElementById('judart-titulo')?.value;
    const descripcion = document.getElementById('judart-descripcion')?.value;
    const media_url = document.getElementById('judart-url')?.value;
    const media_type = document.getElementById('judart-type')?.value || 'image';
    const usuarioLogueado = localStorage.getItem('catefa_user') || 'Joven Parroquia';

    if (!titulo || !media_url) {
      alert('Ingresa al menos el título y el enlace de la imagen o video.');
      return;
    }

    try {
      const { error } = await supabase
        .from('catefa_recursos')
        .insert([{
          titulo,
          descripcion,
          media_url,
          media_type,
          created_by: usuarioLogueado
        }]);

      if (error) throw error;

      alert('Publicación compartida en el muro');
      document.getElementById('form-crear-judart')?.reset();
      this.cargarMuroCompleto();
      this.cargarInicio();
    } catch (err) {
      console.error('Error al crear publicación:', err);
      alert('No se pudo publicar.');
    }
  },

  // 4. Reaccionar / Dar Like
  async darLike(recursoId, likesActuales) {
    try {
      const { error } = await supabase
        .from('catefa_recursos')
        .update({ likes_count: likesActuales + 1 })
        .eq('id', recursoId);

      if (error) throw error;

      this.cargarMuroCompleto();
    } catch (err) {
      console.error('Error al reaccionar:', err);
    }
  },

  // 5. Agregar Comentario
  async agregarComentario(recursoId) {
    const input = document.getElementById(`input-comentario-${recursoId}`);
    const comentario = input?.value;
    const usuarioLogueado = localStorage.getItem('catefa_user') || 'Joven Parroquia';

    if (!comentario) return;

    try {
      const { error } = await supabase
        .from('catefa_comentarios')
        .insert([{
          recurso_id: recursoId,
          usuario_nombre: usuarioLogueado,
          comentario: comentario
        }]);

      if (error) throw error;

      input.value = '';
      this.cargarMuroCompleto();
    } catch (err) {
      console.error('Error al comentar:', err);
    }
  }
};

window.JCJudart = JCJudart;