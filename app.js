/* ============================================================
   GH PRO — app.js
   Lógica principal — usa Supabase como backend
   ============================================================ */
'use strict';

// ── Date helpers ───────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(today());
  return Math.ceil(diff / 86400000);
};

const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${y}`;
};

const fmtDateLong = (d) => {
  if (!d) return '';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

// ── Avatar color ───────────────────────────────────────────────
const avatarColors = ['#6c63ff','#ff6584','#43e97b','#f7971e','#1e90ff','#ff9f43','#a29bfe','#fd79a8'];
const avatarColor  = (str) => avatarColors[(str || '').charCodeAt(0) % avatarColors.length];

// ── Badge helpers ──────────────────────────────────────────────
function estadoBadge(days) {
  if (days === null) return '<span class="badge badge-neutral">Sin fecha</span>';
  if (days < 0)   return '<span class="badge badge-danger"><span class="dot"></span>Vencido</span>';
  if (days <= 7)  return '<span class="badge badge-danger"><span class="dot"></span>Crítico</span>';
  if (days <= 30) return '<span class="badge badge-warning"><span class="dot"></span>Por vencer</span>';
  return '<span class="badge badge-success"><span class="dot"></span>Vigente</span>';
}

function diasBadge(days) {
  if (days === null) return '—';
  if (days < 0)   return `<span style="color:var(--danger);font-weight:700">${Math.abs(days)}d venc.</span>`;
  if (days <= 7)  return `<span style="color:var(--danger);font-weight:700">${days}d</span>`;
  if (days <= 30) return `<span style="color:var(--warning);font-weight:700">${days}d</span>`;
  return `<span style="color:var(--success)">${days}d</span>`;
}

function getDocEstado(days) {
  if (days === null) return 'sin_fecha';
  if (days < 0)   return 'vencido';
  if (days <= 7)  return 'critico';
  if (days <= 30) return 'proximo';
  return 'vigente';
}

// ── In-memory cache (evita refetch en cada render) ─────────────
const Cache = {
  trabajadores: null,
  dotacion:     null,
  entregas:     null,
  bpm:          null,
  vehiculos:    null,
  invalidate(key) { if (key) this[key] = null; else Object.keys(this).forEach(k => this[k] = null); },
};

// ═══════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

  const renders = {
    dashboard:    renderDashboard,
    trabajadores: renderTrabajadores,
    dotacion:     renderDotacion,
    entregas:     renderEntregas,
    documentos:   renderBPM,
    vehiculos:    renderVehiculos,
    alertas:      renderAlertas,
  };
  if (renders[pageId]) renders[pageId]();
  if (window.innerWidth <= 768) closeSidebar();
}

// ═══════════════════════════════════════════
// MODAL HELPERS
// ═══════════════════════════════════════════
function openModal(id) {
  if (id === 'modalEntrega') {
    const f = document.getElementById('eFecha');
    if (f && !f.value) f.value = today();
    poblarSelectTrabajadores('eTrabajador');
    poblarSelectDotacion('eArticulo');
  }
  if (id === 'modalBPM')      poblarSelectTrabajadores('bTrabajador');
  if (id === 'modalVehiculo') { poblarSelectTrabajadores('vConductor'); toggleVehiculoFields(); }
  if (id === 'modalTrabajador' && !document.getElementById('tId').value) resetTrabajadorForm();
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function toast(msg, type = 'success', duration = 3500) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0'; el.style.transform = 'translateX(100px)'; el.style.transition = '0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════
// SIDEBAR MOBILE
// ═══════════════════════════════════════════
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('show');
}

document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('mobileOverlay').classList.toggle('show');
});
document.getElementById('mobileOverlay')?.addEventListener('click', closeSidebar);
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// Tabs vehiculos
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  const parent = tab.closest('.tabs');
  if (!parent) return;
  parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tab.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  const target = document.getElementById(tab.dataset.tab);
  if (target) target.classList.add('active');
});

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
async function renderDashboard() {
  showLoading(true);
  try {
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    if (!Cache.entregas)     Cache.entregas     = await Entregas.getAll();
    const alertas = await Alertas.getAll();

    const trabajadores = Cache.trabajadores;
    const entregas     = Cache.entregas;

    const now = new Date();
    document.getElementById('dashDate').textContent = now.toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const alertCount = alertas.filter(a => a.days !== null && a.days <= 30).length;
    updateAlertBadge(alertCount);

    const activos  = trabajadores.filter(t => t.estado === 'activo').length;
    const ciudades = [...new Set(trabajadores.map(t => t.ciudad).filter(Boolean))].length;

    document.getElementById('statsGrid').innerHTML = [
      { icon: '👥', value: trabajadores.length, label: 'Trabajadores',   color: 'var(--accent)' },
      { icon: '✅', value: activos,             label: 'Activos',         color: 'var(--success)' },
      { icon: '📍', value: ciudades,            label: 'Ciudades',        color: 'var(--info)' },
      { icon: '📦', value: entregas.length,     label: 'Entregas',        color: 'var(--accent4)' },
      { icon: '🔔', value: alertCount,          label: 'Alertas',         color: alertCount > 0 ? 'var(--danger)' : 'var(--success)' },
    ].map(s => `
      <div class="stat-card" style="--card-color:${s.color}">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`).join('');

    // Recent alerts panel
    const recent = alertas.filter(a => a.days !== null && a.days <= 30).slice(0, 4);
    document.getElementById('dashAlerts').innerHTML = recent.length
      ? recent.map(alertCard).join('')
      : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Sin alertas pendientes</div></div>';

    // Recent entregas timeline
    const lastE = [...entregas].slice(0, 5);
    document.getElementById('dashEntregas').innerHTML = lastE.length
      ? '<div class="timeline">' + lastE.map(e => `
          <div class="timeline-item">
            <div class="timeline-date">${fmtDate(e.fecha)}</div>
            <div class="timeline-content">
              <div class="timeline-title">${e.trabajador_nombre}</div>
              <div class="timeline-desc">${e.cantidad}× ${e.articulo_nombre}${e.talla ? ' · ' + e.talla : ''}</div>
            </div>
          </div>`).join('') + '</div>'
      : '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Sin entregas</div></div>';

    if (window.innerWidth <= 768)
      document.getElementById('dashCards').style.gridTemplateColumns = '1fr';

  } finally { showLoading(false); }
}

// ═══════════════════════════════════════════
// TRABAJADORES
// ═══════════════════════════════════════════
async function renderTrabajadores() {
  showLoading(true);
  try {
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    const trabajadores = Cache.trabajadores;

    // Populate filter dropdowns once
    const repoblar = (selId, vals) => {
      const sel = document.getElementById(selId);
      if (!sel || sel.options.length > 1) return;
      [...vals].sort().forEach(v => sel.appendChild(new Option(v, v)));
    };
    repoblar('filterCiudad', [...new Set(trabajadores.map(t => t.ciudad).filter(Boolean))]);
    repoblar('filterMarca',  [...new Set(trabajadores.map(t => t.marca).filter(Boolean))]);
    repoblar('filterCargo',  [...new Set(trabajadores.map(t => t.cargo).filter(Boolean))]);

    // Datalists for modal
    const dl = (id, arr) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = arr.map(v => `<option value="${v}">`).join('');
    };
    dl('marcasDatalist',  [...new Set(trabajadores.map(t => t.marca).filter(Boolean))]);
    dl('cargosDatalist',  [...new Set(trabajadores.map(t => t.cargo).filter(Boolean))]);
    dl('jefesDatalist',   trabajadores.map(t => t.nombre));

    _renderTrabajadoresFiltered(trabajadores);
  } finally { showLoading(false); }
}

function _renderTrabajadoresFiltered(trabajadores) {
  const q           = (document.getElementById('searchTrabajador')?.value || '').toLowerCase();
  const filterMarca = document.getElementById('filterMarca')?.value || '';
  const filterCargo = document.getElementById('filterCargo')?.value || '';
  const filterCiud  = document.getElementById('filterCiudad')?.value || '';

  const filtered = trabajadores.filter(t => {
    const txt = [t.nombre, t.cargo, t.marca, t.cedula, t.ciudad, t.unidad_organizacional, t.jefe].join(' ').toLowerCase();
    return (!q || txt.includes(q))
        && (!filterMarca || t.marca  === filterMarca)
        && (!filterCargo || t.cargo  === filterCargo)
        && (!filterCiud  || t.ciudad === filterCiud);
  });

  const tbody = document.getElementById('tablaTrabajadores');
  const empty = document.getElementById('emptyTrabajadores');
  const count = document.getElementById('trabajadoresCount');
  if (count) count.textContent = `${filtered.length} de ${trabajadores.length} trabajadores`;

  if (filtered.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const estadoMap = { activo: 'badge-success', inactivo: 'badge-neutral', licencia: 'badge-warning' };
  const ciudadIcon = { Pereira: '🟣', Manizales: '🟡', Armenia: '🟢' };

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="background:${avatarColor(t.nombre)}">${(t.nombre||'?').slice(0,2).toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${t.nombre}</div>
            <div style="font-size:11px;color:var(--text-muted)">CC ${t.cedula || ''}${t.fecha_ingreso ? ' · Ingreso: ' + fmtDate(t.fecha_ingreso) : ''}</div>
          </div>
        </div>
      </td>
      <td><span style="font-size:12px">${t.cargo || '—'}</span></td>
      <td><span class="chip">${t.marca || 'General'}</span></td>
      <td><span class="chip">${ciudadIcon[t.ciudad] || '📍'} ${t.ciudad || '—'}</span></td>
      <td>${t.jefe || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge ${estadoMap[t.estado] || 'badge-neutral'}">${t.estado || 'activo'}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" title="Editar"   onclick="editarTrabajador('${t.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon"   title="Eliminar" onclick="eliminarTrabajador('${t.id}')">🗑️</button>
      </div></td>
    </tr>`).join('');
}

async function guardarTrabajador() {
  const id     = document.getElementById('tId').value;
  const nombre = document.getElementById('tNombre').value.trim();
  const cedula = document.getElementById('tCedula').value.trim();
  if (!nombre) return toast('El nombre es obligatorio', 'error');

  const row = {
    nombre, cedula,
    cargo:                document.getElementById('tCargo').value.trim(),
    marca:                document.getElementById('tMarca').value.trim(),
    ciudad:               document.getElementById('tCiudad')?.value.trim() || '',
    jefe:                 document.getElementById('tJefe').value.trim(),
    fecha_ingreso:        document.getElementById('tFechaIngreso').value || null,
    telefono:             document.getElementById('tTelefono').value.trim(),
    estado:               document.getElementById('tEstado').value,
    obs:                  document.getElementById('tObs').value.trim(),
    tipo_id:              'CC',
    unidad_organizacional:'',
  };

  showLoading(true);
  const result = id
    ? await Trabajadores.update(id, row)
    : await Trabajadores.insert(row);
  showLoading(false);

  if (!result) return;
  Cache.invalidate('trabajadores');
  closeModal('modalTrabajador');
  resetTrabajadorForm();
  await renderTrabajadores();
  toast(id ? 'Trabajador actualizado ✅' : 'Trabajador registrado ✅');
}

function editarTrabajador(id) {
  const t = (Cache.trabajadores || []).find(x => x.id === id);
  if (!t) return;
  document.getElementById('tId').value          = t.id;
  document.getElementById('tNombre').value      = t.nombre;
  document.getElementById('tCedula').value      = t.cedula || '';
  document.getElementById('tCargo').value       = t.cargo  || '';
  document.getElementById('tMarca').value       = t.marca  || '';
  const tCiudad = document.getElementById('tCiudad');
  if (tCiudad) tCiudad.value                   = t.ciudad || '';
  document.getElementById('tJefe').value        = t.jefe   || '';
  document.getElementById('tFechaIngreso').value= t.fecha_ingreso ? t.fecha_ingreso.split('T')[0] : '';
  document.getElementById('tTelefono').value    = t.telefono || '';
  document.getElementById('tEstado').value      = t.estado  || 'activo';
  document.getElementById('tObs').value         = t.obs     || '';
  document.getElementById('modalTrabajadorTitle').textContent = '✏️ Editar Trabajador';
  openModal('modalTrabajador');
}

async function eliminarTrabajador(id) {
  if (!confirm('¿Eliminar este trabajador? Esta acción no se puede deshacer.')) return;
  showLoading(true);
  const ok = await Trabajadores.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('trabajadores');
  await renderTrabajadores();
  toast('Trabajador eliminado', 'warning');
}

function resetTrabajadorForm() {
  ['tId','tNombre','tCedula','tCargo','tMarca','tCiudad','tJefe','tFechaIngreso','tTelefono','tObs']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const est = document.getElementById('tEstado'); if (est) est.value = 'activo';
  document.getElementById('modalTrabajadorTitle').textContent = '👤 Nuevo Trabajador';
}

async function exportarTrabajadores() {
  if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
  const data = Cache.trabajadores;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = ['Nombre','Cédula','Cargo','Proveedor','Ciudad','Jefe','Fecha Ingreso','Teléfono','Estado','Unidad Organizacional'];
  const rows = data.map(t => [t.nombre, t.cedula, t.cargo, t.marca, t.ciudad, t.jefe, t.fecha_ingreso, t.telefono, t.estado, t.unidad_organizacional]);
  downloadCSV('trabajadores', headers, rows);
}

// ═══════════════════════════════════════════
// DOTACION — INVENTARIO
// ═══════════════════════════════════════════
const dotacionIcons = { ropa:'👕', calzado:'👟', epp:'⛑️', accesorio:'🎒', otro:'📦' };

async function renderDotacion() {
  showLoading(true);
  try {
    if (!Cache.dotacion) Cache.dotacion = await Dotacion.getAll();
    const items = Cache.dotacion;
    const grid  = document.getElementById('gridDotacion');
    const empty = document.getElementById('emptyDotacion');

    if (!items.length) { grid.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';

    grid.innerHTML = items.map(d => {
      const pct      = d.stock_min > 0 ? Math.min(100, Math.round((d.stock / d.stock_min) * 50)) : 80;
      const lowStock = d.stock <= (d.stock_min || 5);
      return `
      <div class="dotacion-card" style="${lowStock ? 'border-color:rgba(255,165,2,0.4)' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div class="dotacion-card-icon">${d.emoji || dotacionIcons[d.categoria] || '📦'}</div>
          ${lowStock ? '<span class="badge badge-warning">Stock bajo</span>' : ''}
        </div>
        <div class="dotacion-card-name">${d.nombre}</div>
        <div style="margin:6px 0">
          <span class="dotacion-card-stock">${d.stock}</span>
          <span class="dotacion-card-unit">${d.unidad || 'und'}</span>
        </div>
        <div class="dotacion-progress">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted)">
            <span>Mín: ${d.stock_min || 0}</span><span>${d.categoria || 'otro'}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:14px">
          <button class="btn btn-secondary btn-sm" onclick="editarDotacion('${d.id}')">✏️ Editar</button>
          <button class="btn btn-success btn-sm"   onclick="ajustarStock('${d.id}',1)">+</button>
          <button class="btn btn-danger btn-sm"    onclick="ajustarStock('${d.id}',-1)">−</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarDotacion('${d.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  } finally { showLoading(false); }
}

async function guardarDotacion() {
  const id     = document.getElementById('dId').value;
  const nombre = document.getElementById('dNombre').value.trim();
  if (!nombre) return toast('El nombre es obligatorio', 'error');

  const row = {
    nombre,
    categoria:   document.getElementById('dCategoria').value,
    stock:       parseInt(document.getElementById('dStock').value)    || 0,
    stock_min:   parseInt(document.getElementById('dStockMin').value) || 0,
    unidad:      document.getElementById('dUnidad').value.trim() || 'und',
    emoji:       document.getElementById('dEmoji').value.trim(),
    descripcion: document.getElementById('dDesc').value.trim(),
  };

  showLoading(true);
  const result = id ? await Dotacion.update(id, row) : await Dotacion.insert(row);
  showLoading(false);
  if (!result) return;
  Cache.invalidate('dotacion');
  closeModal('modalDotacion');
  resetDotacionForm();
  await renderDotacion();
  toast(id ? 'Ítem actualizado ✅' : 'Ítem agregado al inventario ✅');
}

async function ajustarStock(id, delta) {
  showLoading(true);
  const result = await Dotacion.updateStock(id, delta);
  showLoading(false);
  if (!result) return;
  Cache.invalidate('dotacion');
  await renderDotacion();
}

function editarDotacion(id) {
  const d = (Cache.dotacion || []).find(x => x.id === id);
  if (!d) return;
  document.getElementById('dId').value       = d.id;
  document.getElementById('dNombre').value   = d.nombre;
  document.getElementById('dCategoria').value= d.categoria || 'ropa';
  document.getElementById('dStock').value    = d.stock;
  document.getElementById('dStockMin').value = d.stock_min || '';
  document.getElementById('dUnidad').value   = d.unidad   || '';
  document.getElementById('dEmoji').value    = d.emoji    || '';
  document.getElementById('dDesc').value     = d.descripcion || '';
  document.getElementById('modalDotacionTitle').textContent = '✏️ Editar Ítem';
  openModal('modalDotacion');
}

async function eliminarDotacion(id) {
  if (!confirm('¿Eliminar este ítem?')) return;
  showLoading(true);
  const ok = await Dotacion.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('dotacion');
  await renderDotacion();
  toast('Ítem eliminado', 'warning');
}

function resetDotacionForm() {
  ['dId','dNombre','dStock','dStockMin','dUnidad','dEmoji','dDesc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const cat = document.getElementById('dCategoria'); if (cat) cat.value = 'ropa';
  document.getElementById('modalDotacionTitle').textContent = '👕 Nuevo Ítem de Dotación';
}

// ═══════════════════════════════════════════
// ENTREGAS DE DOTACION
// ═══════════════════════════════════════════
async function renderEntregas() {
  showLoading(true);
  try {
    if (!Cache.entregas)     Cache.entregas     = await Entregas.getAll();
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    if (!Cache.dotacion)     Cache.dotacion     = await Dotacion.getAll();

    poblarSelectTrabajadores('eTrabajador');
    poblarSelectTrabajadores('filterEntregaTrabajador', true);
    poblarSelectDotacion('eArticulo');

    const q       = (document.getElementById('searchEntrega')?.value || '').toLowerCase();
    const filterT = document.getElementById('filterEntregaTrabajador')?.value || '';

    const filtered = Cache.entregas.filter(e => {
      const txt = [e.trabajador_nombre, e.articulo_nombre, e.talla, e.obs].join(' ').toLowerCase();
      return (!q || txt.includes(q)) && (!filterT || e.trabajador_id === filterT);
    });

    const tbody = document.getElementById('tablaEntregas');
    const empty = document.getElementById('emptyEntregas');
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(e => `
      <tr>
        <td>${fmtDate(e.fecha)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar" style="background:${avatarColor(e.trabajador_nombre)};width:28px;height:28px;font-size:11px">${(e.trabajador_nombre||'?').slice(0,2).toUpperCase()}</div>
            ${e.trabajador_nombre}
          </div>
        </td>
        <td>${e.articulo_nombre}</td>
        <td><strong>${e.cantidad}</strong></td>
        <td>${e.talla || '—'}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.obs||''}">${e.obs || '—'}</td>
        <td><div class="td-actions">
          <button class="btn btn-danger btn-sm btn-icon" onclick="eliminarEntrega('${e.id}')">🗑️</button>
        </div></td>
      </tr>`).join('');
  } finally { showLoading(false); }
}

async function guardarEntrega() {
  const trabajadorId = document.getElementById('eTrabajador').value;
  const articuloId   = document.getElementById('eArticulo').value;
  const cantidad     = parseInt(document.getElementById('eCantidad').value) || 0;
  const fecha        = document.getElementById('eFecha').value;
  if (!trabajadorId) return toast('Selecciona un trabajador', 'error');
  if (!articuloId)   return toast('Selecciona un artículo', 'error');
  if (cantidad < 1)  return toast('La cantidad debe ser mayor a 0', 'error');
  if (!fecha)        return toast('La fecha es obligatoria', 'error');

  const trabajador = (Cache.trabajadores || []).find(t => t.id === trabajadorId);
  const articulo   = (Cache.dotacion     || []).find(d => d.id === articuloId);

  const row = {
    trabajador_id:     trabajadorId,
    trabajador_nombre: trabajador?.nombre || '',
    articulo_id:       articuloId,
    articulo_nombre:   articulo?.nombre   || '',
    cantidad, fecha,
    talla:         document.getElementById('eTalla').value.trim(),
    entregado_por: document.getElementById('eEntregadoPor').value.trim(),
    obs:           document.getElementById('eObs').value.trim(),
  };

  showLoading(true);
  const result = await Entregas.insert(row);
  showLoading(false);
  if (!result) return;

  Cache.invalidate('entregas');
  Cache.invalidate('dotacion'); // stock changed via trigger
  closeModal('modalEntrega');
  resetEntregaForm();
  await renderEntregas();
  toast('Entrega registrada ✅');
}

async function eliminarEntrega(id) {
  if (!confirm('¿Eliminar este registro de entrega? El stock será restaurado.')) return;
  showLoading(true);
  const ok = await Entregas.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('entregas');
  Cache.invalidate('dotacion');
  await renderEntregas();
  toast('Entrega eliminada', 'warning');
}

function resetEntregaForm() {
  ['eId','eTalla','eEntregadoPor','eObs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const cant = document.getElementById('eCantidad'); if (cant) cant.value = 1;
  const f    = document.getElementById('eFecha');    if (f)    f.value = today();
  const selT = document.getElementById('eTrabajador'); if (selT) selT.value = '';
  const selA = document.getElementById('eArticulo');   if (selA) selA.value = '';
}

async function exportarEntregas() {
  if (!Cache.entregas) Cache.entregas = await Entregas.getAll();
  const data = Cache.entregas;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = ['Fecha','Trabajador','Artículo','Cantidad','Talla/Ref','Entregado por','Observaciones'];
  const rows = data.map(e => [e.fecha, e.trabajador_nombre, e.articulo_nombre, e.cantidad, e.talla, e.entregado_por, e.obs]);
  downloadCSV('entregas_dotacion', headers, rows);
}

// ── Select helpers ─────────────────────────────────────────────
function poblarSelectTrabajadores(selId, keepFirst = false) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const val  = sel.value;
  const list = Cache.trabajadores || [];
  if (!keepFirst) {
    sel.innerHTML = '<option value="">Seleccionar...</option>';
  } else if (sel.options.length > 1) {
    sel.value = val; return;
  } else {
    sel.innerHTML = '<option value="">Todos los trabajadores</option>';
  }
  list.forEach(t => sel.appendChild(new Option(t.nombre, t.id)));
  sel.value = val;
}

function poblarSelectDotacion(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const val  = sel.value;
  const list = Cache.dotacion || [];
  sel.innerHTML = '<option value="">Seleccionar artículo...</option>';
  list.forEach(d => sel.appendChild(new Option(`${d.nombre} (stock: ${d.stock})`, d.id)));
  sel.value = val;
}

// ═══════════════════════════════════════════
// BPM — CARNET
// ═══════════════════════════════════════════
async function renderBPM() {
  showLoading(true);
  try {
    if (!Cache.bpm)          Cache.bpm          = await BPM.getAll();
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    poblarSelectTrabajadores('bTrabajador');

    const q         = (document.getElementById('searchBPM')?.value || '').toLowerCase();
    const filterEst = document.getElementById('filterBPMEstado')?.value || '';

    const filtered = Cache.bpm.filter(b => {
      const days   = daysUntil(b.vencimiento);
      const estado = getDocEstado(days);
      const txt    = [b.trabajador_nombre, b.numero, b.entidad, b.capacitacion].join(' ').toLowerCase();
      return (!q || txt.includes(q)) && (!filterEst || estado === filterEst);
    });

    const tbody = document.getElementById('tablaBPM');
    const empty = document.getElementById('emptyBPM');
    if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';

    tbody.innerHTML = filtered.map(b => {
      const days = daysUntil(b.vencimiento);
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar" style="background:${avatarColor(b.trabajador_nombre)};width:28px;height:28px;font-size:11px">${(b.trabajador_nombre||'?').slice(0,2).toUpperCase()}</div>
            ${b.trabajador_nombre}
          </div>
        </td>
        <td>${b.numero || '—'}</td>
        <td>${fmtDate(b.emision)}</td>
        <td>${fmtDate(b.vencimiento)}</td>
        <td>${estadoBadge(days)}</td>
        <td>${diasBadge(days)}</td>
        <td><div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editarBPM('${b.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon"   onclick="eliminarBPM('${b.id}')">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
  } finally { showLoading(false); }
}

async function guardarBPM() {
  const id           = document.getElementById('bId').value;
  const trabajadorId = document.getElementById('bTrabajador').value;
  const vencimiento  = document.getElementById('bVencimiento').value;
  if (!trabajadorId) return toast('Selecciona un trabajador', 'error');
  if (!vencimiento)  return toast('La fecha de vencimiento es obligatoria', 'error');

  const trabajador = (Cache.trabajadores || []).find(t => t.id === trabajadorId);
  const row = {
    trabajador_id:     trabajadorId,
    trabajador_nombre: trabajador?.nombre || '',
    numero:            document.getElementById('bNumero').value.trim(),
    emision:           document.getElementById('bEmision').value || null,
    vencimiento,
    entidad:           document.getElementById('bEntidad').value.trim(),
    capacitacion:      document.getElementById('bCapacitacion').value.trim(),
    obs:               document.getElementById('bObs').value.trim(),
  };

  showLoading(true);
  const result = id ? await BPM.update(id, row) : await BPM.insert(row);
  showLoading(false);
  if (!result) return;
  Cache.invalidate('bpm');
  closeModal('modalBPM');
  resetBPMForm();
  await renderBPM();
  toast(id ? 'Carnet actualizado ✅' : 'Carnet registrado ✅');
}

function editarBPM(id) {
  const b = (Cache.bpm || []).find(x => x.id === id);
  if (!b) return;
  document.getElementById('bId').value           = b.id;
  document.getElementById('bTrabajador').value   = b.trabajador_id;
  document.getElementById('bNumero').value       = b.numero       || '';
  document.getElementById('bEmision').value      = b.emision      ? b.emision.split('T')[0]     : '';
  document.getElementById('bVencimiento').value  = b.vencimiento  ? b.vencimiento.split('T')[0] : '';
  document.getElementById('bEntidad').value      = b.entidad      || '';
  document.getElementById('bCapacitacion').value = b.capacitacion || '';
  document.getElementById('bObs').value          = b.obs          || '';
  document.getElementById('modalBPMTitle').textContent = '✏️ Editar Carnet BPM';
  openModal('modalBPM');
}

async function eliminarBPM(id) {
  if (!confirm('¿Eliminar este carnet?')) return;
  showLoading(true);
  const ok = await BPM.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('bpm');
  await renderBPM();
  toast('Carnet eliminado', 'warning');
}

function resetBPMForm() {
  ['bId','bNumero','bEmision','bVencimiento','bEntidad','bCapacitacion','bObs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sel = document.getElementById('bTrabajador'); if (sel) sel.value = '';
  document.getElementById('modalBPMTitle').textContent = '📋 Carnet BPM';
}

async function exportarBPM() {
  if (!Cache.bpm) Cache.bpm = await BPM.getAll();
  const data = Cache.bpm;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = ['Trabajador','N° Carnet','Emisión','Vencimiento','Estado','Días','Entidad','Capacitación'];
  const rows = data.map(b => {
    const days = daysUntil(b.vencimiento);
    return [b.trabajador_nombre, b.numero, b.emision, b.vencimiento, getDocEstado(days), days ?? '', b.entidad, b.capacitacion];
  });
  downloadCSV('bpm_carnets', headers, rows);
}

// ═══════════════════════════════════════════
// VEHICULOS
// ═══════════════════════════════════════════
async function renderVehiculos() {
  showLoading(true);
  try {
    if (!Cache.vehiculos)    Cache.vehiculos    = await Vehiculos.getAll();
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    poblarSelectTrabajadores('vConductor');

    const veh       = Cache.vehiculos;
    const soat      = veh.filter(v => v.tipo === 'soat');
    const tecno     = veh.filter(v => v.tipo === 'tecno');
    const propiedad = veh.filter(v => v.tipo === 'propiedad');
    const licencia  = veh.filter(v => v.tipo === 'licencia');

    _renderVehTable('tablaSOAT',      'emptySOAT',      soat);
    _renderVehTable('tablaTecno',     'emptyTecno',     tecno);
    _renderPropTable('tablaPropiedad','emptyPropiedad', propiedad);
    _renderLicTable('tablaLicencia',  'emptyLicencia',  licencia);
    _renderTodosTable(veh);
  } finally { showLoading(false); }
}

function _renderVehTable(tbodyId, emptyId, data) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  if (!data.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  tbody.innerHTML = data.map(v => {
    const days = daysUntil(v.vencimiento);
    return `<tr>
      <td><strong>${v.placa || '—'}</strong></td>
      <td>${v.conductor_nombre || '—'}</td>
      <td>${fmtDate(v.vencimiento)}</td>
      <td>${estadoBadge(days)}</td>
      <td>${diasBadge(days)}</td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="editarVehiculo('${v.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon"   onclick="eliminarVehiculo('${v.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function _renderPropTable(tbodyId, emptyId, data) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  if (!data.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  tbody.innerHTML = data.map(v => `
    <tr>
      <td><strong>${v.placa || '—'}</strong></td>
      <td>${v.conductor_nombre || '—'}</td>
      <td>${[v.marca_carro, v.modelo].filter(Boolean).join(' ') || '—'}</td>
      <td>${v.anio || '—'}</td>
      <td><span class="badge badge-info">Vigente</span></td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="editarVehiculo('${v.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon"   onclick="eliminarVehiculo('${v.id}')">🗑️</button>
      </div></td>
    </tr>`).join('');
}

function _renderLicTable(tbodyId, emptyId, data) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  if (!data.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  tbody.innerHTML = data.map(v => {
    const days = daysUntil(v.vencimiento);
    return `<tr>
      <td>${v.conductor_nombre || '—'}</td>
      <td>${v.num_licencia || '—'}</td>
      <td><span class="badge badge-info">${v.categoria || '—'}</span></td>
      <td>${fmtDate(v.vencimiento)}</td>
      <td>${estadoBadge(days)}</td>
      <td>${diasBadge(days)}</td>
      <td><div class="td-actions">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="editarVehiculo('${v.id}')">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon"   onclick="eliminarVehiculo('${v.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

function _renderTodosTable(vehiculos) {
  const tipoLabel = { soat:'🛡️ SOAT', tecno:'🔧 TECNO', propiedad:'📄 T.Propiedad', licencia:'🪪 Licencia' };
  document.getElementById('tablaTodos').innerHTML = vehiculos.map(v => {
    const days  = daysUntil(v.vencimiento);
    const ident = v.tipo === 'licencia' ? v.conductor_nombre : (v.placa || v.conductor_nombre);
    return `<tr>
      <td>${tipoLabel[v.tipo] || v.tipo}</td>
      <td>${ident || '—'}</td>
      <td>${fmtDate(v.vencimiento)}</td>
      <td>${estadoBadge(days)}</td>
      <td>${diasBadge(days)}</td>
    </tr>`;
  }).join('');
}

async function guardarVehiculo() {
  const id          = document.getElementById('vId').value;
  const tipo        = document.getElementById('vTipo').value;
  const conductorId = document.getElementById('vConductor').value;
  if (!conductorId) return toast('Selecciona un conductor/propietario', 'error');

  const conductor = (Cache.trabajadores || []).find(t => t.id === conductorId);
  const row = {
    tipo, conductor_id: conductorId,
    conductor_nombre: conductor?.nombre || '',
    placa:       (document.getElementById('vPlaca')?.value || '').trim().toUpperCase(),
    vencimiento: document.getElementById('vVencimiento')?.value || null,
    poliza:      document.getElementById('vPoliza')?.value.trim()      || '',
    aseguradora: document.getElementById('vAseguradora')?.value.trim() || '',
    marca_carro: document.getElementById('vMarcaCarro')?.value.trim()  || '',
    modelo:      document.getElementById('vModelo')?.value.trim()      || '',
    anio:        document.getElementById('vAnio')?.value               || '',
    num_licencia:document.getElementById('vNumLicencia')?.value.trim() || '',
    categoria:   document.getElementById('vCategoria')?.value          || '',
    obs:         document.getElementById('vObs')?.value.trim()         || '',
  };

  showLoading(true);
  const result = id ? await Vehiculos.update(id, row) : await Vehiculos.insert(row);
  showLoading(false);
  if (!result) return;
  Cache.invalidate('vehiculos');
  closeModal('modalVehiculo');
  resetVehiculoForm();
  await renderVehiculos();
  toast(id ? 'Documento actualizado ✅' : 'Documento registrado ✅');
}

function editarVehiculo(id) {
  const v = (Cache.vehiculos || []).find(x => x.id === id);
  if (!v) return;
  document.getElementById('vId').value           = v.id;
  document.getElementById('vTipo').value         = v.tipo;
  toggleVehiculoFields();
  document.getElementById('vConductor').value    = v.conductor_id     || '';
  document.getElementById('vPlaca').value        = v.placa            || '';
  document.getElementById('vVencimiento').value  = v.vencimiento      ? v.vencimiento.split('T')[0] : '';
  document.getElementById('vPoliza').value       = v.poliza           || '';
  document.getElementById('vAseguradora').value  = v.aseguradora      || '';
  document.getElementById('vMarcaCarro').value   = v.marca_carro      || '';
  document.getElementById('vModelo').value       = v.modelo           || '';
  document.getElementById('vAnio').value         = v.anio             || '';
  document.getElementById('vNumLicencia').value  = v.num_licencia     || '';
  document.getElementById('vCategoria').value    = v.categoria        || 'B1';
  document.getElementById('vObs').value          = v.obs              || '';
  document.getElementById('modalVehiculoTitle').textContent = '✏️ Editar Documento';
  openModal('modalVehiculo');
}

async function eliminarVehiculo(id) {
  if (!confirm('¿Eliminar este documento?')) return;
  showLoading(true);
  const ok = await Vehiculos.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('vehiculos');
  await renderVehiculos();
  toast('Documento eliminado', 'warning');
}

function resetVehiculoForm() {
  ['vId','vPlaca','vVencimiento','vPoliza','vAseguradora','vMarcaCarro','vModelo','vAnio','vNumLicencia','vObs']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const tipo = document.getElementById('vTipo'); if (tipo) tipo.value = 'soat';
  const sel  = document.getElementById('vConductor'); if (sel) sel.value = '';
  document.getElementById('modalVehiculoTitle').textContent = '🚗 Vehículo / Documento';
  toggleVehiculoFields();
}

function toggleVehiculoFields() {
  const tipo = document.getElementById('vTipo')?.value || 'soat';
  document.querySelectorAll('.veh-field').forEach(el => {
    el.style.display = el.classList.contains(tipo) ? '' : 'none';
  });
}

async function exportarVehiculos() {
  if (!Cache.vehiculos) Cache.vehiculos = await Vehiculos.getAll();
  const data = Cache.vehiculos;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = ['Tipo','Placa','Conductor/Propietario','Vencimiento','Estado','Días','N° Póliza/Licencia','Aseguradora/CDA'];
  const rows = data.map(v => {
    const days = daysUntil(v.vencimiento);
    return [v.tipo, v.placa, v.conductor_nombre, v.vencimiento, getDocEstado(days), days ?? '', v.poliza || v.num_licencia, v.aseguradora];
  });
  downloadCSV('vehiculos_documentos', headers, rows);
}

// ═══════════════════════════════════════════
// ALERTAS
// ═══════════════════════════════════════════
function alertCard(a) {
  const estado   = getDocEstado(a.days);
  const classMap = { vencido:'danger', critico:'danger', proximo:'warning', vigente:'info', sin_fecha:'info' };
  const iconMap  = { vencido:'🚨', critico:'⚠️', proximo:'⏰', vigente:'ℹ️', sin_fecha:'ℹ️' };
  return `<div class="alert-item ${classMap[estado] || 'info'}">
    <div class="alert-icon">${iconMap[estado]}</div>
    <div class="alert-content">
      <div class="alert-title">${a.tipo} — ${a.persona || '—'}</div>
      <div class="alert-desc">${a.desc}</div>
      <div class="alert-date">Vence: ${fmtDateLong(a.vencimiento)} · ${diasBadge(a.days)}</div>
    </div>
  </div>`;
}

async function renderAlertas() {
  showLoading(true);
  try {
    Cache.invalidate('bpm');
    Cache.invalidate('vehiculos');
    const alertas   = await Alertas.getAll();
    const filterVal = document.getElementById('filterAlerta')?.value || '';
    const filtered  = filterVal
      ? alertas.filter(a => getDocEstado(a.days) === filterVal)
      : alertas;

    const vencidos = alertas.filter(a => a.days !== null && a.days < 0).length;
    const criticos = alertas.filter(a => a.days !== null && a.days >= 0 && a.days <= 7).length;
    const proximos = alertas.filter(a => a.days !== null && a.days > 7 && a.days <= 30).length;
    const vigentes = alertas.filter(a => a.days !== null && a.days > 30).length;

    updateAlertBadge(vencidos + criticos + proximos);

    const statsEl = document.getElementById('alertStats');
    if (statsEl) {
      statsEl.innerHTML = [
        { icon:'🚨', value: vencidos, label:'Vencidos',      color:'var(--danger)' },
        { icon:'⚠️', value: criticos, label:'Críticos ≤7d',  color:'var(--warning)' },
        { icon:'⏰', value: proximos, label:'Próximos ≤30d', color:'var(--accent4)' },
        { icon:'✅', value: vigentes, label:'Vigentes',       color:'var(--success)' },
      ].map(s => `
        <div class="stat-card" style="--card-color:${s.color}">
          <div class="stat-icon">${s.icon}</div>
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    }

    const lista = document.getElementById('listaAlertas');
    lista.innerHTML = filtered.length
      ? filtered.map(alertCard).join('')
      : '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No hay alertas en esta categoría</div></div>';

  } finally { showLoading(false); }
}

function updateAlertBadge(count) {
  const badge       = document.getElementById('alertBadge');
  const badgeMobile = document.getElementById('alertBadgeMobile');
  if (badge)       { badge.textContent       = count; badge.style.display       = count > 0 ? '' : 'none'; }
  if (badgeMobile) { badgeMobile.textContent = count; badgeMobile.style.display = count > 0 ? '' : 'none'; }
}

async function solicitarNotificaciones() {
  if (!('Notification' in window)) return toast('Tu navegador no soporta notificaciones', 'warning');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    toast('Notificaciones activadas 🔔', 'success');
    const alertas = await Alertas.getAll();
    const pendientes = alertas.filter(a => a.days !== null && a.days >= 0 && a.days <= 30);
    if (pendientes.length > 0) {
      new Notification('GH Pro — Alertas pendientes', {
        body: `Tienes ${pendientes.length} documento(s) próximo(s) a vencer`,
        icon: 'icons/icon-192.png',
      });
    }
  } else {
    toast('Permisos de notificación denegados', 'warning');
  }
}

// ═══════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════
function downloadCSV(name, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv    = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob   = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `${name}_${today()}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('Archivo descargado 📥');
}

// ═══════════════════════════════════════════
// PWA — Service Worker & Install prompt
// ═══════════════════════════════════════════
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.classList.add('show');
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('installBtn').classList.remove('show');
  if (outcome === 'accepted') toast('¡App instalada! 🎉', 'success');
});

window.addEventListener('appinstalled', () => {
  toast('GH Pro instalada exitosamente 🚀', 'success');
  deferredPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[SW] Registrado:', reg.scope))
      .catch(err => console.warn('[SW] Error:', err));
  });
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Seed si las tablas están vacías (primera vez)
  await checkAndSeed();

  // Cargar dashboard inicial
  await renderDashboard();

  // Refresh badge de alertas cada 5 minutos
  setInterval(async () => {
    Cache.invalidate('bpm');
    Cache.invalidate('vehiculos');
    const alertas = await Alertas.getAll();
    const count   = alertas.filter(a => a.days !== null && a.days <= 30).length;
    updateAlertBadge(count);
  }, 5 * 60 * 1000);
});
