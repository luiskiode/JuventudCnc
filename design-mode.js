/* Juventud CNC — Design Mode (for Brenda)
   Drop this file next to index.html and add:
     <script src="./design-mode.js" defer></script>
   Open the site with ?design=1 to show the panel.
*/
(function(){
  const qs = new URLSearchParams(location.search);
  const enabled = qs.get('design') === '1' || localStorage.getItem('jc_design') === '1';
  if (!enabled) return;

  const VARS = [
    ['--brand', '#1e3a8a', 'Principal'],
    ['--brand-2', '#3b82f6', 'Secundario'],
    ['--accent', '#00d1b2', 'Acento'],
    ['--neutral-900', '#0b0f1a', 'Fondo oscuro'],
    ['--neutral-700', '#1f2937', 'Gris oscuro'],
    ['--neutral-400', '#9ca3af', 'Gris'],
    ['--neutral-100', '#f3f4f6', 'Fondo claro'],
  ];

  const BTN_VARS = [
    ['--btn-radius', '12px', 'Radio esquinas'],
    ['--btn-py', '10px', 'Padding vertical'],
    ['--btn-px', '14px', 'Padding horizontal'],
    ['--btn-fw', '800', 'Peso tipográfico']
  ];

  // Apply persisted tokens
  try{
    const saved = JSON.parse(localStorage.getItem('jc_tokens')||'{}');
    Object.entries(saved).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
  }catch{}

  const panel = document.createElement('div');
  panel.id = 'jc-design-panel';
  panel.innerHTML = `
    <style id="jc-design-css">
      #jc-design-panel{
        position: fixed; right: 16px; bottom: 16px; z-index: 99999;
        width: 340px; max-height: 80vh; overflow: auto;
        background: #0b1020; color: #e5e7eb;
        border: 1px solid rgba(255,255,255,.15); border-radius: 16px;
        box-shadow: 0 18px 40px rgba(0,0,0,.35);
        font-family: system-ui, Segoe UI, Roboto, Arial, sans-serif;
      }
      #jc-design-panel .hd{
        display:flex; gap:8px; align-items:center; justify-content:space-between;
        padding: 10px 12px; position:sticky; top:0; background:#0b1020;
        border-bottom:1px solid rgba(255,255,255,.12); border-radius: 16px 16px 0 0;
      }
      #jc-design-panel h3{ margin:0; font-size: 16px }
      #jc-design-panel .bd{ padding: 10px 12px; display:grid; gap: 12px }
      #jc-design-panel .row{ display:flex; gap:8px; align-items:center; flex-wrap:wrap }
      #jc-design-panel label{ font-size:12px; color:#cbd5e1; width: 160px }
      #jc-design-panel input[type="color"]{ width: 42px; height: 30px; border:0; background:none; padding:0; cursor:pointer }
      #jc-design-panel input[type="text"], #jc-design-panel input[type="number"]{
        width: 88px; padding: 6px 8px; border-radius: 10px; border:1px solid rgba(255,255,255,.12);
        background:#0b1430; color:#e5e7eb;
      }
      #jc-design-panel .btn{
        border:0; border-radius: 10px; padding:8px 10px;
        background:#3b82f6; color:#041; font-weight:800; cursor:pointer;
      }
      #jc-design-panel .btn.secondary{ background:#1e3a8a; color:#fff }
      #jc-design-panel textarea{
        width:100%; min-height:110px; padding:8px; border-radius:12px;
        border:1px solid rgba(255,255,255,.12); background:#0b1430; color:#cde3ff;
        font-family: ui-monospace, Consolas, Menlo, monospace;
      }
      #jc-design-panel .chip{ padding:6px 8px; border:1px solid rgba(255,255,255,.15); border-radius:999px; }
    </style>
    <div class="hd">
      <h3>🎨 Design Mode</h3>
      <div class="row">
        <button class="btn secondary" id="jc-close">Cerrar</button>
      </div>
    </div>
    <div class="bd">
      <div class="row" style="justify-content:space-between">
        <span class="chip">En vivo · Página real</span>
        <button class="btn" id="jc-copy-root">Copiar :root</button>
      </div>
      <h4 style="margin:0">Colores</h4>
      <div id="jc-color-grid"></div>
      <h4 style="margin:0">Botones</h4>
      <div id="jc-btn-grid"></div>
      <div class="row" style="justify-content:space-between">
        <button class="btn secondary" id="jc-reset">Reset</button>
        <button class="btn" id="jc-save">Guardar</button>
      </div>
      <h4 style="margin:0">Variables CSS</h4>
      <textarea id="jc-root"></textarea>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (sel)=>panel.querySelector(sel);
  const colorGrid = $('#jc-color-grid');
  const btnGrid = $('#jc-btn-grid');
  const rootTa = $('#jc-root');

  // Render color controls
  VARS.forEach(([name, fallback, label])=>{
    const current = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <label>${label} <small style="opacity:.7">${name}</small></label>
      <input type="color" data-var="${name}" value="${toHex(current, fallback)}">
      <input type="text" data-var="${name}" value="${toHex(current, fallback)}">
    `;
    colorGrid.appendChild(row);
  });

  // Render button controls
  BTN_VARS.forEach(([name, fallback, label])=>{
    const current = (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    const row = document.createElement('div');
    row.className = 'row';
    const type = name.includes('fw') ? 'number' : 'text';
    row.innerHTML = `
      <label>${label} <small style="opacity:.7">${name}</small></label>
      <input type="${type}" data-var="${name}" value="${current}">
    `;
    btnGrid.appendChild(row);
  });

  function updateRootTextarea(){
    const all = {};
    panel.querySelectorAll('[data-var]').forEach(inp=>{
      all[inp.dataset.var] = inp.value;
    });
    rootTa.value = ':root{\\n' + Object.entries(all).map(([k,v])=>`  ${k}: ${v};`).join('\\n') + '\\n}';
  }
  updateRootTextarea();

  // Debounced setter
  let t;
  panel.addEventListener('input', (e)=>{
    const inp = e.target.closest('[data-var]');
    if (!inp) return;
    const name = inp.dataset.var;
    const value = inp.value;
    clearTimeout(t);
    t = setTimeout(()=>{
      document.documentElement.style.setProperty(name, value);
      // sync paired inputs if color
      if (inp.type === 'color') {
        const text = panel.querySelector(`input[type="text"][data-var="${name}"]`);
        if (text) text.value = value;
      } else if (inp.type === 'text' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
        const col = panel.querySelector(`input[type="color"][data-var="${name}"]`);
        if (col) col.value = value;
      }
      updateRootTextarea();
    }, 10);
  });

  // Copy :root
  $('#jc-copy-root').addEventListener('click', ()=>{
    navigator.clipboard.writeText(rootTa.value);
    toast('Copiado');
  });

  // Save to localStorage
  $('#jc-save').addEventListener('click', ()=>{
    const out = {};
    panel.querySelectorAll('[data-var]').forEach(inp=>out[inp.dataset.var]=inp.value);
    localStorage.setItem('jc_tokens', JSON.stringify(out));
    localStorage.setItem('jc_design', '1');
    toast('Guardado');
  });

  // Reset
  $('#jc-reset').addEventListener('click', ()=>{
    localStorage.removeItem('jc_tokens');
    // Remove inline overrides
    [...VARS, ...BTN_VARS].forEach(([name])=>document.documentElement.style.removeProperty(name));
    // Reset form
    panel.querySelectorAll('[data-var]').forEach(inp=>{
      const match = [...VARS, ...BTN_VARS].find(x=>x[0]===inp.dataset.var);
      if (match){
        const def = match[1];
        inp.value = def;
      }
    });
    updateRootTextarea();
    toast('Reseteado');
  });

  // Close (keeps design mode enabled until query is removed or jc_design cleared)
  $('#jc-close').addEventListener('click', ()=>{
    panel.remove();
  });

  function toast(msg){
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;right:20px;bottom:20px;background:#111827;color:#fff;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);z-index:100000;';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1200);
  }

  function toHex(val, fallback){
    // normalize rgb(a)/hsl to hex if possible; otherwise return fallback or value
    const v = (val || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return v;
    const d = document.createElement('div');
    d.style.color = v;
    document.body.appendChild(d);
    const cs = getComputedStyle(d).color;
    document.body.removeChild(d);
    const m = cs.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
    if (!m) return fallback;
    const r = (+m[1]).toString(16).padStart(2,'0');
    const g = (+m[2]).toString(16).padStart(2,'0');
    const b = (+m[3]).toString(16).padStart(2,'0');
    return `#${r}${g}${b}`;
  }
})();