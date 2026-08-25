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
  vacaciones:   null,
  examenes:     null,
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
    dashboard:      renderDashboard,
    trabajadores:   renderTrabajadores,
    dotacion:       renderDotacion,
    entregas:       renderEntregas,
    documentos:     renderBPM,
    vehiculos:      renderVehiculos,
    incapacidades:  renderIncapacidades,
    vacaciones:     renderVacaciones,
    examenes:       renderExamenes,
    alertas:        renderAlertas,
    asistencia:     renderAsistencia,
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
  if (id === 'modalBPM')          poblarSelectTrabajadores('bTrabajador');
  if (id === 'modalVehiculo')     { poblarSelectTrabajadores('vConductor'); toggleVehiculoFields(); }
  if (id === 'modalIncapacidad')  { poblarSelectTrabajadores('iTrabajador'); }
  if (id === 'modalVacacion')     { poblarSelectTrabajadores('vacTrabajador'); }
  if (id === 'modalExamenMedico') {
    poblarSelectTrabajadores('exTrabajador');
    if (!document.getElementById('exId').value) {
      resetExamenForm();
    }
  }
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

// Registrar SW solo bajo HTTPS real (no en localhost ni file://)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isHttps     = location.protocol === 'https:';
    if (!isLocalhost && isHttps) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('[SW] Registrado:', reg.scope))
        .catch(err => console.warn('[SW] Error:', err));
    } else {
      // En desarrollo: desregistrar cualquier SW previo para evitar interferencias
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => { r.unregister(); console.log('[SW] Desregistrado para desarrollo'); });
      });
    }
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

  // Calcular badge de incapacidades al arrancar
  (async () => {
    try {
      const incap = await Incapacidades.getAll();
      Cache.incapacidades = incap;
      const pendientes = incap.filter(i => !i.tiene_fisico || !i.historia_clinica).length;
      const badge = document.getElementById('incapBadge');
      if (badge) { badge.textContent = pendientes; badge.style.display = pendientes > 0 ? '' : 'none'; }
    } catch (_) { /* silencioso */ }
  })();

  // Calcular badge de vacaciones pendientes al arrancar
  (async () => {
    try {
      const vac = await Vacaciones.getAll();
      Cache.vacaciones = vac;
      const pend = vac.filter(v => v.status === 'solicitada').length;
      updateVacBadge(pend);
    } catch (_) { /* silencioso */ }
  })();

  // Refresh badge de alertas cada 5 minutos
  setInterval(async () => {
    Cache.invalidate('bpm');
    Cache.invalidate('vehiculos');
    Cache.invalidate('incapacidades');
    const alertas = await Alertas.getAll();
    const count   = alertas.filter(a => a.days !== null && a.days <= 30).length;
    updateAlertBadge(count);
    // Refrescar badge de incapacidades también
    const incap = Cache.incapacidades || await Incapacidades.getAll();
    Cache.incapacidades = incap;
    const pend = incap.filter(i => !i.tiene_fisico || !i.historia_clinica).length;
    const badge = document.getElementById('incapBadge');
    if (badge) { badge.textContent = pend; badge.style.display = pend > 0 ? '' : 'none'; }
  }, 5 * 60 * 1000);
});

// ═══════════════════════════════════════════
// INCAPACIDADES — helpers de presentación
// ═══════════════════════════════════════════

// Cache propio para incapacidades
Cache.incapacidades = null;

const INCAP_STATUS = {
  ingresada:  { label: 'Ingresada',   cls: 'badge-neutral',  icon: '📥' },
  cobrada:    { label: 'Cobrada',     cls: 'badge-info',     icon: '📤' },
  transcrita: { label: 'Transcrita',  cls: 'badge-warning',  icon: '📝' },
  pagada:     { label: 'Pagada',      cls: 'badge-success',  icon: '✅' },
  en_tramite: { label: 'En trámite',  cls: 'badge-warning',  icon: '⏳' },
  radicada:   { label: 'Radicada',    cls: 'badge-info',     icon: '📂' },
};

const INCAP_TIPO = {
  EG: { label: 'Enfermedad General',    short: 'EG', color: '#6c63ff' },
  EP: { label: 'Enfermedad Profesional',short: 'EP', color: '#f7971e' },
  AT: { label: 'Accidente de Trabajo',  short: 'AT', color: '#ff6584' },
  LM: { label: 'Licencia Maternidad',   short: 'LM', color: '#43e97b' },
};

function statusBadgeIncap(status) {
  const s = INCAP_STATUS[status] || { label: status, cls: 'badge-neutral', icon: '•' };
  return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
}

function tipoBadgeIncap(tipo) {
  const t = INCAP_TIPO[tipo] || { short: tipo, color: 'var(--text-muted)' };
  return `<span class="badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">${t.short}</span>`;
}

function fmtPeso(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);
}

function iconCheck(val, siText = 'Sí', noText = 'No') {
  return val
    ? `<span style="color:var(--success);font-weight:600">✔ ${siText}</span>`
    : `<span style="color:var(--danger);font-weight:600">✘ ${noText}</span>`;
}

// ═══════════════════════════════════════════
// INCAPACIDADES — render principal
// ═══════════════════════════════════════════
async function renderIncapacidades() {
  showLoading(true);
  try {
    if (!Cache.incapacidades) Cache.incapacidades = await Incapacidades.getAll();
    if (!Cache.trabajadores)  Cache.trabajadores  = await Trabajadores.getAll();
    poblarSelectTrabajadores('iTrabajador');

    const lista = Cache.incapacidades;

    // ── Stats ───────────────────────────────
    const totalDias   = lista.reduce((s, i) => s + (i.dias || 0), 0);
    const sinFisico   = lista.filter(i => !i.tiene_fisico).length;
    const sinHC       = lista.filter(i => !i.historia_clinica).length;
    const enTramite   = lista.filter(i => i.status === 'en_tramite' || i.status === 'radicada').length;

    const statsEl = document.getElementById('incapStats');
    if (statsEl) {
      statsEl.innerHTML = [
        { icon:'🏥', value: lista.length, label:'Total',        color:'var(--accent)' },
        { icon:'📅', value: totalDias,    label:'Días acum.',   color:'var(--info)' },
        { icon:'⏳', value: enTramite,    label:'En gestión',   color:'var(--warning)' },
        { icon:'📂', value: sinFisico,    label:'Sin físico',   color: sinFisico  > 0 ? 'var(--danger)' : 'var(--success)' },
        { icon:'🗂️', value: sinHC,        label:'Sin HC',       color: sinHC      > 0 ? 'var(--danger)' : 'var(--success)' },
      ].map(s => `
        <div class="stat-card" style="--card-color:${s.color}">
          <div class="stat-icon">${s.icon}</div>
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    }

    // Badge en sidebar
    const pendientes = sinFisico + sinHC;
    const incapBadge = document.getElementById('incapBadge');
    if (incapBadge) { incapBadge.textContent = pendientes; incapBadge.style.display = pendientes > 0 ? '' : 'none'; }

    // ── Aplicar filtros ─────────────────────
    const q          = (document.getElementById('searchIncap')?.value || '').toLowerCase();
    const fStatus    = document.getElementById('filterIncapStatus')?.value  || '';
    const fTipo      = document.getElementById('filterIncapTipo')?.value    || '';
    const fFisico    = document.getElementById('filterIncapFisico')?.value  || '';
    const fHC        = document.getElementById('filterIncapHC')?.value      || '';

    const filtered = lista.filter(i => {
      const txt = [i.trabajador_nombre, i.diagnostico, i.codigo_dx, i.radicado, i.entidad, i.observaciones].join(' ').toLowerCase();
      return (!q       || txt.includes(q))
          && (!fStatus || i.status        === fStatus)
          && (!fTipo   || i.tipo          === fTipo)
          && (!fFisico || (fFisico === 'si' ? i.tiene_fisico : !i.tiene_fisico))
          && (!fHC     || (fHC     === 'si' ? i.historia_clinica : !i.historia_clinica));
    });

    // ── Tab listado ─────────────────────────
    _renderTablaIncap(filtered);

    // ── Tab pendientes ──────────────────────
    _renderPendientes(lista);

    // ── Tab por trabajador ──────────────────
    _renderResumenTrabajador(lista);

  } finally { showLoading(false); }
}

function _renderTablaIncap(filtered) {
  const tbody = document.getElementById('tablaIncapacidades');
  const empty = document.getElementById('emptyIncapacidades');
  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(i => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(i.trabajador_nombre)};width:30px;height:30px;font-size:11px;flex-shrink:0">
            ${(i.trabajador_nombre||'?').slice(0,2).toUpperCase()}
          </div>
          <span style="font-weight:600;font-size:13px">${i.trabajador_nombre}</span>
        </div>
      </td>
      <td>${fmtDate(i.fecha_inicio)}</td>
      <td>${fmtDate(i.fecha_fin)}</td>
      <td>
        ${i.dias != null
          ? `<span style="font-weight:700;color:var(--accent)">${i.dias}d</span>`
          : '<span style="color:var(--text-muted)">—</span>'}
      </td>
      <td>${tipoBadgeIncap(i.tipo)}</td>
      <td>
        <div style="max-width:160px">
          ${i.codigo_dx ? `<span style="font-size:11px;color:var(--accent);font-weight:600">${i.codigo_dx}</span> ` : ''}
          <span style="font-size:12px;color:var(--text-secondary)">${i.diagnostico || '—'}</span>
        </div>
      </td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
          ${statusBadgeIncap(i.status)}
          <select class="filter-select" style="font-size:11px;padding:3px 6px;margin-top:2px"
            onchange="cambiarStatusIncap('${i.id}', this.value)">
            ${Object.entries(INCAP_STATUS).map(([k,v]) =>
              `<option value="${k}" ${i.status===k?'selected':''}>${v.icon} ${v.label}</option>`
            ).join('')}
          </select>
        </div>
      </td>
      <td style="text-align:center">${iconCheck(i.tiene_fisico,'Sí','No')}</td>
      <td style="text-align:center">${iconCheck(i.historia_clinica,'Sí','No')}</td>
      <td style="font-size:12px;color:var(--text-muted)">${i.radicado || '—'}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" title="Editar"   onclick="editarIncapacidad('${i.id}')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon"   title="Eliminar" onclick="eliminarIncapacidad('${i.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function _renderPendientes(lista) {
  const sinFisico  = lista.filter(i => !i.tiene_fisico);
  const sinHC      = lista.filter(i => !i.historia_clinica);

  const renderMini = (arr) => arr.length === 0
    ? '<div class="empty-state" style="padding:30px"><div class="empty-state-icon">✅</div><div class="empty-state-text">Todo en orden</div></div>'
    : arr.map(i => `
        <div class="alert-item info" style="margin-bottom:8px">
          <div class="alert-icon">🏥</div>
          <div class="alert-content" style="flex:1">
            <div class="alert-title" style="font-size:13px">${i.trabajador_nombre}</div>
            <div class="alert-desc">${fmtDate(i.fecha_inicio)}${i.fecha_fin ? ' → '+fmtDate(i.fecha_fin) : ''} · ${tipoBadgeIncap(i.tipo)}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="editarIncapacidad('${i.id}')">✏️</button>
        </div>`).join('');

  const sf = document.getElementById('listaSinFisico');
  const sh = document.getElementById('listaSinHC');
  if (sf) sf.innerHTML = renderMini(sinFisico);
  if (sh) sh.innerHTML = renderMini(sinHC);

  // Responsive
  const grid = document.getElementById('pendientesGrid');
  if (grid && window.innerWidth <= 768) grid.style.gridTemplateColumns = '1fr';
}

function _renderResumenTrabajador(lista) {
  const resumen = Incapacidades.resumenPorTrabajador(lista);
  const tbody   = document.getElementById('tablaIncapPorTrabajador');
  if (!tbody) return;
  if (!resumen.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px">Sin datos</td></tr>'; return; }

  tbody.innerHTML = resumen.map(r => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(r.trabajador_nombre)};width:30px;height:30px;font-size:11px">
            ${(r.trabajador_nombre||'?').slice(0,2).toUpperCase()}
          </div>
          <span style="font-weight:600">${r.trabajador_nombre}</span>
        </div>
      </td>
      <td><strong>${r.total}</strong></td>
      <td><span style="color:var(--accent);font-weight:700">${r.total_dias}d</span></td>
      <td>${r.pagadas   > 0 ? `<span class="badge badge-success">${r.pagadas}</span>`   : '<span style="color:var(--text-muted)">0</span>'}</td>
      <td>${r.en_tramite> 0 ? `<span class="badge badge-warning">${r.en_tramite}</span>`: '<span style="color:var(--text-muted)">0</span>'}</td>
      <td>${r.sin_fisico> 0 ? `<span class="badge badge-danger">${r.sin_fisico}</span>` : '<span style="color:var(--success)">✔</span>'}</td>
      <td>${r.sin_historia>0? `<span class="badge badge-danger">${r.sin_historia}</span>`:'<span style="color:var(--success)">✔</span>'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${fmtDate(r.ultima_fecha)}</td>
    </tr>`).join('');
}

// ═══════════════════════════════════════════
// INCAPACIDADES — CRUD
// ═══════════════════════════════════════════
async function guardarIncapacidad() {
  const id           = document.getElementById('iId').value;
  const trabajadorId = document.getElementById('iTrabajador').value;
  const fechaInicio  = document.getElementById('iFechaInicio').value;
  if (!trabajadorId) return toast('Selecciona un trabajador', 'error');
  if (!fechaInicio)  return toast('La fecha de inicio es obligatoria', 'error');

  const trabajador = (Cache.trabajadores || []).find(t => t.id === trabajadorId);
  const fechaFin   = document.getElementById('iFechaFin').value || null;
  const valor      = parseFloat(document.getElementById('iValor').value) || null;

  const row = {
    trabajador_id:     trabajadorId,
    trabajador_nombre: trabajador?.nombre || '',
    fecha_inicio:      fechaInicio,
    fecha_fin:         fechaFin,
    tipo:              document.getElementById('iTipo').value,
    entidad:           document.getElementById('iEntidad').value.trim(),
    codigo_dx:         document.getElementById('iCodigoDx').value.trim().toUpperCase(),
    diagnostico:       document.getElementById('iDiagnostico').value.trim(),
    status:            document.getElementById('iStatus').value,
    radicado:          document.getElementById('iRadicado').value.trim(),
    valor,
    tiene_fisico:      document.getElementById('iFisico').checked,
    historia_clinica:  document.getElementById('iHistoria').checked,
    observaciones:     document.getElementById('iObs').value.trim(),
  };

  showLoading(true);
  const result = id ? await Incapacidades.update(id, row) : await Incapacidades.insert(row);
  showLoading(false);
  if (!result) return;

  Cache.incapacidades = null;
  closeModal('modalIncapacidad');
  resetIncapacidadForm();
  await renderIncapacidades();
  toast(id ? 'Incapacidad actualizada ✅' : 'Incapacidad registrada ✅');
}

function editarIncapacidad(id) {
  const i = (Cache.incapacidades || []).find(x => x.id === id);
  if (!i) return;
  document.getElementById('iId').value             = i.id;
  document.getElementById('iTrabajador').value     = i.trabajador_id;
  document.getElementById('iFechaInicio').value    = i.fecha_inicio  ? i.fecha_inicio.split('T')[0]  : '';
  document.getElementById('iFechaFin').value       = i.fecha_fin     ? i.fecha_fin.split('T')[0]     : '';
  document.getElementById('iTipo').value           = i.tipo          || 'EG';
  document.getElementById('iEntidad').value        = i.entidad       || '';
  document.getElementById('iCodigoDx').value       = i.codigo_dx     || '';
  document.getElementById('iDiagnostico').value    = i.diagnostico   || '';
  document.getElementById('iStatus').value         = i.status        || 'ingresada';
  document.getElementById('iRadicado').value       = i.radicado      || '';
  document.getElementById('iValor').value          = i.valor         || '';
  document.getElementById('iFisico').checked       = !!i.tiene_fisico;
  document.getElementById('iHistoria').checked     = !!i.historia_clinica;
  document.getElementById('iObs').value            = i.observaciones || '';
  _updateFisicoLabel(); _updateHistoriaLabel();
  document.getElementById('modalIncapTitle').textContent = '✏️ Editar Incapacidad';
  openModal('modalIncapacidad');
}

async function eliminarIncapacidad(id) {
  if (!confirm('¿Eliminar esta incapacidad? La acción no se puede deshacer.')) return;
  showLoading(true);
  const ok = await Incapacidades.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.incapacidades = null;
  await renderIncapacidades();
  toast('Incapacidad eliminada', 'warning');
}

async function cambiarStatusIncap(id, status) {
  showLoading(true);
  const result = await Incapacidades.updateStatus(id, status);
  showLoading(false);
  if (!result) return;
  // Actualizar cache en lugar de recargar todo
  if (Cache.incapacidades) {
    const idx = Cache.incapacidades.findIndex(x => x.id === id);
    if (idx > -1) Cache.incapacidades[idx].status = status;
  }
  toast(`Estado → ${INCAP_STATUS[status]?.label || status} ✅`);
  // Re-render solo los stats y tabla sin refetch
  _renderTablaIncap(Cache.incapacidades || []);
  _renderPendientes(Cache.incapacidades || []);
  _renderResumenTrabajador(Cache.incapacidades || []);
}

function resetIncapacidadForm() {
  ['iId','iFechaInicio','iFechaFin','iEntidad','iCodigoDx','iDiagnostico','iRadicado','iValor','iObs']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const selT = document.getElementById('iTrabajador'); if (selT) selT.value = '';
  const tipo = document.getElementById('iTipo');       if (tipo) tipo.value = 'EG';
  const stat = document.getElementById('iStatus');     if (stat) stat.value = 'ingresada';
  const fis  = document.getElementById('iFisico');     if (fis)  fis.checked = false;
  const hc   = document.getElementById('iHistoria');   if (hc)   hc.checked  = false;
  _updateFisicoLabel(); _updateHistoriaLabel();
  document.getElementById('modalIncapTitle').textContent = '🏥 Nueva Incapacidad';
}

// Labels dinámicos para checkboxes
function _updateFisicoLabel() {
  const el = document.getElementById('iFisicoLabel');
  if (el) el.textContent = document.getElementById('iFisico')?.checked ? 'Recibido ✔' : 'No recibido';
}
function _updateHistoriaLabel() {
  const el = document.getElementById('iHistoriaLabel');
  if (el) el.textContent = document.getElementById('iHistoria')?.checked ? 'Recibida ✔' : 'No recibida';
}

// Listeners checkboxes del modal
document.getElementById('iFisico')?.addEventListener('change', _updateFisicoLabel);
document.getElementById('iHistoria')?.addEventListener('change', _updateHistoriaLabel);

// Registrar incapacidades en el mapa de navegación
// (sobreescribe el navigate existente para incluir el nuevo módulo)
const _navigateOrig = navigate;
window.navigate = function(pageId) {
  if (pageId === 'incapacidades') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-incapacidades');
    if (page) page.classList.add('active');
    document.querySelectorAll('[data-page="incapacidades"]').forEach(n => n.classList.add('active'));
    renderIncapacidades();
    if (window.innerWidth <= 768) closeSidebar();
    return;
  }
  if (pageId === 'vacaciones') {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = document.getElementById('page-vacaciones');
    if (page) page.classList.add('active');
    document.querySelectorAll('[data-page="vacaciones"]').forEach(n => n.classList.add('active'));
    renderVacaciones();
    if (window.innerWidth <= 768) closeSidebar();
    return;
  }
  _navigateOrig(pageId);
};

// ═══════════════════════════════════════════
// INCAPACIDADES — exportar CSV
// ═══════════════════════════════════════════
async function exportarIncapacidades() {
  if (!Cache.incapacidades) Cache.incapacidades = await Incapacidades.getAll();
  const data = Cache.incapacidades;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = [
    'Trabajador','Fecha Inicio','Fecha Fin','Días','Tipo','Diagnóstico',
    'Código CIE-10','Entidad','Estado','Radicado','Valor','Físico','Historia Clínica','Observaciones'
  ];
  const rows = data.map(i => [
    i.trabajador_nombre, i.fecha_inicio, i.fecha_fin, i.dias ?? '',
    INCAP_TIPO[i.tipo]?.label || i.tipo, i.diagnostico, i.codigo_dx,
    i.entidad, INCAP_STATUS[i.status]?.label || i.status, i.radicado,
    i.valor ?? '', i.tiene_fisico ? 'Sí' : 'No', i.historia_clinica ? 'Sí' : 'No', i.observaciones
  ]);
  downloadCSV('incapacidades', headers, rows);
}

// ═══════════════════════════════════════════
// VACACIONES — constantes de presentación
// ═══════════════════════════════════════════
Cache.vacaciones = null;

const VAC_STATUS = {
  solicitada:  { label: 'Solicitada',    cls: 'badge-neutral',  icon: '📥' },
  aprobada:    { label: 'Aprobada',      cls: 'badge-success',  icon: '✅' },
  rechazada:   { label: 'Rechazada',     cls: 'badge-danger',   icon: '❌' },
  en_curso:    { label: 'En curso',      cls: 'badge-info',     icon: '🏖️' },
  finalizada:  { label: 'Finalizada',    cls: 'badge-neutral',  icon: '🏁' },
};

const VAC_TIPO = {
  vacaciones:             { label: 'Vacaciones',          color: '#6c63ff' },
  licencia_remunerada:    { label: 'Lic. Remunerada',     color: '#43e97b' },
  licencia_no_remunerada: { label: 'Lic. No Remunerada',  color: '#f7971e' },
  permiso:                { label: 'Permiso',              color: '#1e90ff' },
  calamidad:              { label: 'Calamidad',            color: '#ff6584' },
  otro:                   { label: 'Otro',                 color: '#a0a0c0' },
};

function statusBadgeVac(status) {
  const s = VAC_STATUS[status] || { label: status, cls: 'badge-neutral', icon: '•' };
  return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
}

function tipoBadgeVac(tipo) {
  const t = VAC_TIPO[tipo] || { label: tipo, color: 'var(--text-muted)' };
  return `<span class="badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">${t.label}</span>`;
}

function updateVacBadge(count) {
  const badge = document.getElementById('vacBadge');
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? '' : 'none'; }
}

// ═══════════════════════════════════════════
// VACACIONES — render principal
// ═══════════════════════════════════════════
async function renderVacaciones() {
  showLoading(true);
  try {
    if (!Cache.vacaciones)   Cache.vacaciones   = await Vacaciones.getAll();
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    poblarSelectTrabajadores('vacTrabajador');

    const lista = Cache.vacaciones;

    // ── Stats ───────────────────────────────
    const totalDias    = lista.reduce((s, v) => s + (v.dias || 0), 0);
    const pendientes   = lista.filter(v => v.status === 'solicitada').length;
    const enCurso      = lista.filter(v => v.status === 'en_curso').length;
    const aprobadas    = lista.filter(v => v.status === 'aprobada').length;

    updateVacBadge(pendientes);

    const statsEl = document.getElementById('vacStats');
    if (statsEl) {
      statsEl.innerHTML = [
        { icon: '🏖️', value: lista.length,  label: 'Total solicitudes', color: 'var(--accent)' },
        { icon: '📅', value: totalDias,     label: 'Días acumulados',    color: 'var(--info)' },
        { icon: '📥', value: pendientes,    label: 'Solicitadas',        color: pendientes > 0 ? 'var(--warning)' : 'var(--success)' },
        { icon: '🏁', value: aprobadas,     label: 'Aprobadas',          color: 'var(--success)' },
        { icon: '⏳', value: enCurso,       label: 'En curso',           color: 'var(--info)' },
      ].map(s => `
        <div class="stat-card" style="--card-color:${s.color}">
          <div class="stat-icon">${s.icon}</div>
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    }

    // ── Tab: Listado con filtros ────────────
    const q       = (document.getElementById('searchVac')?.value    || '').toLowerCase();
    const fStatus = document.getElementById('filterVacStatus')?.value || '';
    const fTipo   = document.getElementById('filterVacTipo')?.value   || '';

    const filtered = lista.filter(v => {
      const txt = [v.trabajador_nombre, v.aprobado_por, v.observaciones].join(' ').toLowerCase();
      return (!q       || txt.includes(q))
          && (!fStatus || v.status === fStatus)
          && (!fTipo   || v.tipo   === fTipo);
    });

    _renderTablaVac('tablaVacaciones', 'emptyVacaciones', filtered, true);

    // ── Tab: Pendientes ─────────────────────
    const pend = lista.filter(v => v.status === 'solicitada' || v.status === 'en_curso');
    _renderTablaVac('tablaVacPendientes', 'emptyVacPendientes', pend, false);

    // ── Tab: Resumen por trabajador ─────────
    const resumen = Vacaciones.resumenPorTrabajador(lista, Cache.trabajadores);
    _renderResumenVac(resumen);

  } finally { showLoading(false); }
}

function _renderTablaVac(tbodyId, emptyId, data, showAprobador) {
  const tbody = document.getElementById(tbodyId);
  const empty = document.getElementById(emptyId);
  if (!tbody) return;
  if (!data.length) { tbody.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = data.map(v => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(v.trabajador_nombre)};width:28px;height:28px;font-size:11px">
            ${(v.trabajador_nombre || '?').slice(0, 2).toUpperCase()}
          </div>
          <span style="font-weight:600">${v.trabajador_nombre}</span>
        </div>
      </td>
      <td>${tipoBadgeVac(v.tipo)}</td>
      <td>${fmtDate(v.fecha_inicio)}</td>
      <td>${fmtDate(v.fecha_fin)}</td>
      <td><strong>${v.dias ?? '—'}</strong></td>
      <td>
        <select class="form-control" style="padding:4px 8px;font-size:12px;width:auto"
          onchange="cambiarStatusVac('${v.id}', this.value)">
          ${Object.entries(VAC_STATUS).map(([k, s]) =>
            `<option value="${k}" ${v.status === k ? 'selected' : ''}>${s.icon} ${s.label}</option>`
          ).join('')}
        </select>
      </td>
      ${showAprobador ? `<td style="font-size:12px;color:var(--text-secondary)">${v.aprobado_por || '—'}</td>` : ''}
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" title="Editar"   onclick="editarVacacion('${v.id}')">✏️</button>
          <button class="btn btn-danger   btn-sm btn-icon" title="Eliminar" onclick="eliminarVacacion('${v.id}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function _renderResumenVac(resumen) {
  const tbody = document.getElementById('tablaVacResumen');
  const empty = document.getElementById('emptyVacResumen');
  if (!tbody) return;
  if (!resumen.length) { tbody.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = resumen.map(r => {
    const disponibles = r.dias_disponibles !== null ? r.dias_disponibles : '—';
    const saldo = r.dias_disponibles !== null ? r.dias_disponibles - r.dias_aprobados : null;
    const saldoColor = saldo !== null ? (saldo < 0 ? 'var(--danger)' : saldo <= 5 ? 'var(--warning)' : 'var(--success)') : '';
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(r.trabajador_nombre)};width:28px;height:28px;font-size:11px">
            ${(r.trabajador_nombre || '?').slice(0, 2).toUpperCase()}
          </div>
          <span style="font-weight:600">${r.trabajador_nombre}</span>
        </div>
      </td>
      <td><strong>${r.dias_tomados}</strong></td>
      <td>${r.dias_aprobados}</td>
      <td>${disponibles}${saldo !== null ? ` <span style="font-size:11px;color:${saldoColor}">(saldo: ${saldo})</span>` : ''}</td>
      <td>${r.pendientes > 0 ? `<span class="badge badge-warning">⏳ ${r.pendientes}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${fmtDate(r.ultima_fecha)}</td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════
// VACACIONES — CRUD
// ═══════════════════════════════════════════
async function guardarVacacion() {
  const id           = document.getElementById('vacId').value;
  const trabajadorId = document.getElementById('vacTrabajador').value;
  const fechaInicio  = document.getElementById('vacInicio').value;
  const fechaFin     = document.getElementById('vacFin').value;

  if (!trabajadorId) return toast('Selecciona un trabajador', 'error');
  if (!fechaInicio)  return toast('La fecha de inicio es obligatoria', 'error');
  if (!fechaFin)     return toast('La fecha de fin es obligatoria', 'error');
  if (fechaFin < fechaInicio) return toast('La fecha de fin no puede ser anterior al inicio', 'error');

  const trabajador = (Cache.trabajadores || []).find(t => t.id === trabajadorId);

  const row = {
    trabajador_id:     trabajadorId,
    trabajador_nombre: trabajador?.nombre || '',
    fecha_inicio:      fechaInicio,
    fecha_fin:         fechaFin,
    tipo:              document.getElementById('vacTipo').value,
    status:            document.getElementById('vacStatus').value,
    aprobado_por:      document.getElementById('vacAprobadoPor').value.trim(),
    observaciones:     document.getElementById('vacObs').value.trim(),
  };

  showLoading(true);
  const result = id ? await Vacaciones.update(id, row) : await Vacaciones.insert(row);
  showLoading(false);
  if (!result) return;

  Cache.invalidate('vacaciones');
  closeModal('modalVacacion');
  _resetVacForm();
  await renderVacaciones();
  toast(id ? 'Solicitud actualizada ✅' : 'Solicitud registrada ✅');
}

async function cambiarStatusVac(id, status) {
  showLoading(true);
  const result = await Vacaciones.updateStatus(id, status);
  showLoading(false);
  if (!result) return;
  Cache.invalidate('vacaciones');
  await renderVacaciones();
  toast(`Estado actualizado: ${VAC_STATUS[status]?.label || status}`, 'info');
}

function editarVacacion(id) {
  const v = (Cache.vacaciones || []).find(x => x.id === id);
  if (!v) return;
  document.getElementById('vacId').value          = v.id;
  document.getElementById('vacTrabajador').value  = v.trabajador_id  || '';
  document.getElementById('vacTipo').value        = v.tipo           || 'vacaciones';
  document.getElementById('vacInicio').value      = v.fecha_inicio   ? v.fecha_inicio.split('T')[0] : '';
  document.getElementById('vacFin').value         = v.fecha_fin      ? v.fecha_fin.split('T')[0]    : '';
  document.getElementById('vacStatus').value      = v.status         || 'solicitada';
  document.getElementById('vacAprobadoPor').value = v.aprobado_por   || '';
  document.getElementById('vacObs').value         = v.observaciones  || '';
  document.getElementById('modalVacTitle').textContent = '✏️ Editar Solicitud';
  openModal('modalVacacion');
}

async function eliminarVacacion(id) {
  if (!confirm('¿Eliminar esta solicitud de vacaciones?')) return;
  showLoading(true);
  const ok = await Vacaciones.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.invalidate('vacaciones');
  await renderVacaciones();
  toast('Solicitud eliminada', 'warning');
}

function _resetVacForm() {
  ['vacId', 'vacAprobadoPor', 'vacObs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const sel  = document.getElementById('vacTrabajador'); if (sel)  sel.value  = '';
  const tipo = document.getElementById('vacTipo');       if (tipo) tipo.value = 'vacaciones';
  const stat = document.getElementById('vacStatus');     if (stat) stat.value = 'solicitada';
  const ini  = document.getElementById('vacInicio');     if (ini)  ini.value  = '';
  const fin  = document.getElementById('vacFin');        if (fin)  fin.value  = '';
  document.getElementById('modalVacTitle').textContent = '🏖️ Nueva Solicitud';
}

// Abrir modal pre-cargado
const _openModalOrig = openModal;
window.openModal = function(id) {
  if (id === 'modalVacacion' && !document.getElementById('vacId').value) {
    _resetVacForm();
    poblarSelectTrabajadores('vacTrabajador');
  }
  _openModalOrig(id);
};

// ═══════════════════════════════════════════
// VACACIONES — exportar CSV
// ═══════════════════════════════════════════
async function exportarVacaciones() {
  if (!Cache.vacaciones) Cache.vacaciones = await Vacaciones.getAll();
  const data = Cache.vacaciones;
  if (!data.length) return toast('No hay datos para exportar', 'warning');
  const headers = ['Trabajador', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Días', 'Estado', 'Aprobado por', 'Observaciones'];
  const rows = data.map(v => [
    v.trabajador_nombre,
    VAC_TIPO[v.tipo]?.label || v.tipo,
    v.fecha_inicio, v.fecha_fin,
    v.dias ?? '',
    VAC_STATUS[v.status]?.label || v.status,
    v.aprobado_por || '',
    v.observaciones || '',
  ]);
  downloadCSV('vacaciones', headers, rows);
}


// ═══════════════════════════════════════════════════════════════
// ASISTENCIA — historial (app principal)
// El QR rotativo vive en asistencia-qr.html
// El login de trabajador vive en asistencia-login.html
// ═══════════════════════════════════════════════════════════════

Cache.asistencia = null;

// ── Helpers ────────────────────────────────────────────────────
function horaActual() {
  const n = new Date();
  return n.toTimeString().slice(0, 8); // HH:MM:SS
}

function fmtHora(h) {
  if (!h) return '—';
  return h.slice(0, 5); // HH:MM
}

// ── Stats del día ──────────────────────────────────────────────
async function _actualizarStatsHoy() {
  const fecha = document.getElementById('asistFiltroFecha')?.value || today();
  const registros = await Asistencia.getByFecha(fecha);

  const entradas = registros.filter(r => r.tipo === 'entrada').length;
  const salidas  = registros.filter(r => r.tipo === 'salida').length;
  const unicos   = new Set(registros.map(r => r.cedula)).size;
  const porQR    = registros.filter(r => r.metodo === 'qr').length;

  const statsEl = document.getElementById('asistStats');
  if (!statsEl) return;
  statsEl.innerHTML = [
    { icon: '🟢', value: entradas, label: 'Entradas',       color: 'var(--accent3)' },
    { icon: '🔴', value: salidas,  label: 'Salidas',         color: 'var(--danger)'  },
    { icon: '👤', value: unicos,   label: 'Trabajadores',    color: 'var(--accent)'  },
    { icon: '📲', value: porQR,    label: 'Vía QR',          color: 'var(--accent4)' },
  ].map(s => `
    <div class="stat-card" style="--card-color:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

// ── Render tabla ───────────────────────────────────────────────
function _rowAsistHTML(r) {
  const metodoIcon = r.metodo === 'qr' ? '📲' : '🪪';
  return `<tr>
    <td><strong>${fmtHora(r.hora)}</strong></td>
    <td><span class="asist-log-tipo ${r.tipo}">${r.tipo}</span></td>
    <td>${r.trabajador_nombre || '—'}</td>
    <td style="font-variant-numeric:tabular-nums">${r.cedula || '—'}</td>
    <td>${r.cargo   || '—'}</td>
    <td>${r.ciudad  || '—'}</td>
    <td>${metodoIcon} ${r.metodo}</td>
    <td><button class="btn btn-danger btn-sm btn-icon"
      onclick="eliminarRegistroAsist('${r.id}')">🗑️</button></td>
  </tr>`;
}

async function renderTablaAsistencia() {
  const fecha  = document.getElementById('asistFiltroFecha')?.value || today();
  const q      = (document.getElementById('asistSearch')?.value     || '').toLowerCase();
  const fTipo  = document.getElementById('asistFiltroTipo')?.value  || '';
  const tbody  = document.getElementById('asistTbody');
  const empty  = document.getElementById('asistLogEmpty');
  if (!tbody) return;

  const todos = await Asistencia.getByFecha(fecha);

  const filtrados = todos.filter(r => {
    const txt = [(r.trabajador_nombre || ''), (r.cedula || '')].join(' ').toLowerCase();
    return (!q     || txt.includes(q))
        && (!fTipo || r.tipo === fTipo);
  });

  if (!filtrados.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = filtrados.map(_rowAsistHTML).join('');
}

// ── Eliminar registro ──────────────────────────────────────────
async function eliminarRegistroAsist(id) {
  if (!confirm('¿Eliminar este registro de asistencia?')) return;
  showLoading(true);
  const ok = await Asistencia.delete(id);
  showLoading(false);
  if (!ok) return;
  Cache.asistencia = null;
  await renderTablaAsistencia();
  await _actualizarStatsHoy();
  toast('Registro eliminado', 'warning');
}

// ── Render principal ───────────────────────────────────────────
async function renderAsistencia() {
  showLoading(true);
  try {
    const fechaInput = document.getElementById('asistFiltroFecha');
    if (fechaInput && !fechaInput.value) fechaInput.value = today();

    const subtitleEl = document.getElementById('asistFecha');
    if (subtitleEl) {
      subtitleEl.textContent = new Date().toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    }

    await _actualizarStatsHoy();
    await renderTablaAsistencia();
  } finally { showLoading(false); }
}

// ── Exportar CSV ───────────────────────────────────────────────
async function exportarAsistencia() {
  showLoading(true);
  const todos = await Asistencia.getAll();
  showLoading(false);
  if (!todos.length) return toast('No hay registros para exportar', 'warning');
  const headers = ['Fecha', 'Hora', 'Tipo', 'Trabajador', 'Cédula', 'Cargo', 'Ciudad', 'Método'];
  const rows = todos.map(r => [
    r.fecha, fmtHora(r.hora), r.tipo,
    r.trabajador_nombre, r.cedula,
    r.cargo || '', r.ciudad || '', r.metodo,
  ]);
  downloadCSV('asistencia', headers, rows);
}

// ═══════════════════════════════════════════════════════════════
// EXAMENES MEDICOS OCUPACIONALES — LÓGICA Y RENDER
// ═══════════════════════════════════════════════════════════════

const EXAM_TIPOS = {
  ingreso:          { label: 'Ingreso',           badge: 'badge-info',    icon: '📥' },
  periodico:        { label: 'Periódico',         badge: 'badge-primary', icon: '🔄' },
  egreso:           { label: 'Egreso',            badge: 'badge-neutral', icon: '📤' },
  post_incapacidad: { label: 'Reintegro / Post',  badge: 'badge-warning', icon: '🏥' },
  reubicacion:      { label: 'Reubicación',       badge: 'badge-warning', icon: '🔀' },
  otro:             { label: 'Otro',              badge: 'badge-neutral', icon: '📄' },
};

const EXAM_CONCEPTOS = {
  apto:                  { label: 'Apto',                   badge: 'badge-success', icon: '🟢' },
  apto_con_restricciones:{ label: 'Apto con restricciones', badge: 'badge-warning', icon: '🟡' },
  no_apto:               { label: 'No apto',                badge: 'badge-danger',  icon: '🔴' },
  aplazado:              { label: 'Aplazado',               badge: 'badge-neutral', icon: '⚪' },
};

function tipoBadgeExamen(tipo) {
  const t = EXAM_TIPOS[tipo] || { label: tipo, badge: 'badge-neutral', icon: '📄' };
  return `<span class="badge ${t.badge}">${t.icon} ${t.label}</span>`;
}

function conceptoBadgeExamen(concepto) {
  const c = EXAM_CONCEPTOS[concepto] || { label: concepto, badge: 'badge-neutral', icon: '⚪' };
  return `<span class="badge ${c.badge}">${c.icon} ${c.label}</span>`;
}

function autoCalcularVencimientoExamen() {
  const tipo  = document.getElementById('exTipo')?.value;
  const fecha = document.getElementById('exFecha')?.value;
  const venc  = document.getElementById('exVencimiento');
  if (!venc) return;

  if (tipo === 'periodico' && fecha && !venc.value) {
    const d = new Date(fecha + 'T12:00:00');
    d.setFullYear(d.getFullYear() + 1);
    venc.value = d.toISOString().split('T')[0];
  }
}

// ── Render Principal de Exámenes ─────────────────────────────────
async function renderExamenes() {
  showLoading(true);
  try {
    if (!Cache.trabajadores) Cache.trabajadores = await Trabajadores.getAll();
    const lista = await ExamenesMedicos.getAll();
    Cache.examenes = lista;

    // Actualizar badge en sidebar
    _actualizarBadgeExamenes(lista);

    // Actualizar stats cards
    _actualizarStatsExamenes(lista);

    // Filtros
    const q          = (document.getElementById('searchExam')?.value || '').toLowerCase();
    const fTipo      = document.getElementById('filterExamTipo')?.value || '';
    const fConcepto  = document.getElementById('filterExamConcepto')?.value || '';
    const fFisico    = document.getElementById('filterExamFisico')?.value || '';

    const filtered = lista.filter(e => {
      const txt = [e.trabajador_nombre, e.entidad, e.enfasis, e.restricciones, e.observaciones].filter(Boolean).join(' ').toLowerCase();
      return (!q         || txt.includes(q))
          && (!fTipo     || e.tipo_examen === fTipo)
          && (!fConcepto || e.concepto === fConcepto)
          && (!fFisico   || (fFisico === 'si' ? e.tiene_concepto_fisico : !e.tiene_concepto_fisico));
    });

    _renderTablaExamenes(filtered);
    _renderVencimientosExamenes(lista);
    _renderRestriccionesExamenes(lista);
    _renderResumenTrabajadoresExamenes(lista);

  } finally {
    showLoading(false);
  }
}

// ── Badge de alerta en sidebar ──────────────────────────────────
function _actualizarBadgeExamenes(lista) {
  const badge = document.getElementById('examBadge');
  if (!badge) return;
  const porVencer = lista.filter(e => {
    if (!e.fecha_vencimiento) return false;
    const d = daysUntil(e.fecha_vencimiento);
    return d !== null && d <= 30;
  }).length;

  if (porVencer > 0) {
    badge.textContent = porVencer;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ── Stats Cards ──────────────────────────────────────────────────
function _actualizarStatsExamenes(lista) {
  const total          = lista.length;
  const aptos          = lista.filter(e => e.concepto === 'apto').length;
  const restricciones  = lista.filter(e => e.concepto === 'apto_con_restricciones' || e.concepto === 'no_apto').length;
  const vencidosOVencer= lista.filter(e => {
    if (!e.fecha_vencimiento) return false;
    const d = daysUntil(e.fecha_vencimiento);
    return d !== null && d <= 30;
  }).length;

  const el = document.getElementById('examStats');
  if (!el) return;

  el.innerHTML = [
    { icon: '🩺', value: total,           label: 'Total Exámenes',        color: 'var(--accent)' },
    { icon: '🟢', value: aptos,           label: 'Aptos',                 color: 'var(--success)' },
    { icon: '⚠️', value: restricciones,   label: 'Con Restricciones / No', color: 'var(--warning)' },
    { icon: '⏳', value: vencidosOVencer, label: 'Por Vencer / Vencidos', color: vencidosOVencer > 0 ? 'var(--danger)' : 'var(--success)' },
  ].map(s => `
    <div class="stat-card" style="--card-color:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>`).join('');
}

// ── Tab 1: Tabla de Listado ──────────────────────────────────────
function _renderTablaExamenes(filtered) {
  const tbody = document.getElementById('tablaExamenes');
  const empty = document.getElementById('emptyExamenes');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(e => {
    const days = daysUntil(e.fecha_vencimiento);
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar" style="background:${avatarColor(e.trabajador_nombre)};width:30px;height:30px;font-size:11px;flex-shrink:0">
              ${(e.trabajador_nombre||'?').slice(0,2).toUpperCase()}
            </div>
            <span style="font-weight:600;font-size:13px">${e.trabajador_nombre}</span>
          </div>
        </td>
        <td>${tipoBadgeExamen(e.tipo_examen)}</td>
        <td>${fmtDate(e.fecha_examen)}</td>
        <td>
          ${e.fecha_vencimiento ? `
            <div style="display:flex;flex-direction:column;gap:2px">
              <span style="font-size:12px;font-weight:600">${fmtDate(e.fecha_vencimiento)}</span>
              <span>${diasBadge(days)}</span>
            </div>` : '<span style="color:var(--text-muted)">—</span>'}
        </td>
        <td><span style="font-size:12px">${e.entidad || '—'}</span></td>
        <td><span style="font-size:12px;color:var(--text-secondary)">${e.enfasis || 'General'}</span></td>
        <td>${conceptoBadgeExamen(e.concepto)}</td>
        <td>
          <div style="max-width:180px;font-size:12px;color:var(--text-secondary);line-height:1.3">
            ${e.restricciones || '<span style="color:var(--text-muted)">Ninguna</span>'}
          </div>
        </td>
        <td style="text-align:center">${iconCheck(e.tiene_concepto_fisico, 'Sí', 'No')}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-secondary btn-sm btn-icon" title="Editar" onclick="editarExamenMedico('${e.id}')">✏️</button>
            <button class="btn btn-danger btn-sm btn-icon" title="Eliminar" onclick="eliminarExamenMedico('${e.id}')">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Tab 2: Vencimientos y Periódicos ─────────────────────────────
function _renderVencimientosExamenes(lista) {
  const tbody = document.getElementById('tablaExamVencimientos');
  const empty = document.getElementById('emptyExamVencimientos');
  if (!tbody) return;

  const conVencimiento = lista
    .filter(e => e.fecha_vencimiento)
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  if (!conVencimiento.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = conVencimiento.map(e => {
    const days = daysUntil(e.fecha_vencimiento);
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="avatar" style="background:${avatarColor(e.trabajador_nombre)};width:30px;height:30px;font-size:11px;flex-shrink:0">
              ${(e.trabajador_nombre||'?').slice(0,2).toUpperCase()}
            </div>
            <span style="font-weight:600">${e.trabajador_nombre}</span>
          </div>
        </td>
        <td>${tipoBadgeExamen(e.tipo_examen)}</td>
        <td>${fmtDate(e.fecha_examen)}</td>
        <td><strong>${fmtDate(e.fecha_vencimiento)}</strong></td>
        <td>${estadoBadge(days)} ${diasBadge(days)}</td>
        <td>${e.entidad || '—'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-secondary btn-sm btn-icon" title="Editar" onclick="editarExamenMedico('${e.id}')">✏️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Tab 3: Con Restricciones ─────────────────────────────────────
function _renderRestriccionesExamenes(lista) {
  const tbody = document.getElementById('tablaExamRestricciones');
  const empty = document.getElementById('emptyExamRestricciones');
  if (!tbody) return;

  const conRestricciones = lista.filter(e =>
    e.concepto === 'apto_con_restricciones' || e.concepto === 'no_apto' || (e.restricciones && e.restricciones.trim())
  );

  if (!conRestricciones.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = conRestricciones.map(e => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(e.trabajador_nombre)};width:30px;height:30px;font-size:11px;flex-shrink:0">
            ${(e.trabajador_nombre||'?').slice(0,2).toUpperCase()}
          </div>
          <span style="font-weight:600">${e.trabajador_nombre}</span>
        </div>
      </td>
      <td>${fmtDate(e.fecha_examen)}</td>
      <td><span style="font-size:12px;color:var(--text-secondary)">${e.enfasis || 'General'}</span></td>
      <td>${conceptoBadgeExamen(e.concepto)}</td>
      <td>
        <div style="background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:8px;border-left:3px solid var(--warning);font-size:13px;line-height:1.4">
          ${e.restricciones || 'Sin detalle de restricciones'}
        </div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn btn-secondary btn-sm btn-icon" title="Editar" onclick="editarExamenMedico('${e.id}')">✏️</button>
        </div>
      </td>
    </tr>`).join('');
}

// ── Tab 4: Resumen por Trabajador ────────────────────────────────
function _renderResumenTrabajadoresExamenes(lista) {
  const tbody = document.getElementById('tablaExamPorTrabajador');
  const empty = document.getElementById('emptyExamTrabajador');
  if (!tbody) return;

  const resumen = ExamenesMedicos.resumenPorTrabajador(lista);
  if (!resumen.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = resumen.map(r => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar" style="background:${avatarColor(r.trabajador_nombre)};width:30px;height:30px;font-size:11px;flex-shrink:0">
            ${(r.trabajador_nombre||'?').slice(0,2).toUpperCase()}
          </div>
          <span style="font-weight:600">${r.trabajador_nombre}</span>
        </div>
      </td>
      <td><strong>${r.total_examenes}</strong></td>
      <td><span class="badge badge-success">${r.aptos}</span></td>
      <td>${r.con_restricciones > 0 ? `<span class="badge badge-warning">${r.con_restricciones}</span>` : '<span style="color:var(--text-muted)">0</span>'}</td>
      <td>${r.no_aptos > 0 ? `<span class="badge badge-danger">${r.no_aptos}</span>` : '<span style="color:var(--text-muted)">0</span>'}</td>
      <td>${r.sin_fisico > 0 ? `<span class="badge badge-danger">${r.sin_fisico}</span>` : '<span style="color:var(--success)">✔</span>'}</td>
      <td>${fmtDate(r.ultimo_examen)} ${r.ultimo_concepto ? conceptoBadgeExamen(r.ultimo_concepto) : ''}</td>
      <td>${r.proximo_venc ? `<strong>${fmtDate(r.proximo_venc)}</strong> ${diasBadge(daysUntil(r.proximo_venc))}` : '<span style="color:var(--text-muted)">—</span>'}</td>
    </tr>`).join('');
}

// ── Guardar / Editar Examen ──────────────────────────────────────
async function guardarExamenMedico() {
  const id           = document.getElementById('exId').value;
  const trabajadorId = document.getElementById('exTrabajador').value;
  const fechaExamen  = document.getElementById('exFecha').value;

  if (!trabajadorId) return toast('Selecciona un trabajador', 'error');
  if (!fechaExamen)  return toast('La fecha del examen es obligatoria', 'error');

  const trabajador = (Cache.trabajadores || []).find(t => t.id === trabajadorId);
  const costo      = parseFloat(document.getElementById('exCosto').value) || null;

  const row = {
    trabajador_id:         trabajadorId,
    trabajador_nombre:     trabajador?.nombre || '',
    tipo_examen:           document.getElementById('exTipo').value,
    fecha_examen:          fechaExamen,
    fecha_vencimiento:     document.getElementById('exVencimiento').value || null,
    entidad:               document.getElementById('exEntidad').value.trim(),
    concepto:              document.getElementById('exConcepto').value,
    enfasis:               document.getElementById('exEnfasis').value.trim(),
    restricciones:         document.getElementById('exRestricciones').value.trim(),
    tiene_concepto_fisico: document.getElementById('exFisico').checked,
    costo,
    observaciones:         document.getElementById('exObs').value.trim(),
  };

  showLoading(true);
  const result = id
    ? await ExamenesMedicos.update(id, row)
    : await ExamenesMedicos.insert(row);
  showLoading(false);

  if (!result) return;

  Cache.examenes = null;
  closeModal('modalExamenMedico');
  toast(id ? 'Examen médico actualizado' : 'Examen médico registrado con éxito');
  await renderExamenes();
}

function editarExamenMedico(id) {
  const exam = (Cache.examenes || []).find(e => e.id === id);
  if (!exam) return;

  poblarSelectTrabajadores('exTrabajador');

  document.getElementById('modalExamTitle').textContent  = '✏️ Editar Examen Médico';
  document.getElementById('exId').value                  = exam.id;
  document.getElementById('exTrabajador').value          = exam.trabajador_id || '';
  document.getElementById('exTipo').value                = exam.tipo_examen || 'periodico';
  document.getElementById('exFecha').value               = exam.fecha_examen || '';
  document.getElementById('exVencimiento').value         = exam.fecha_vencimiento || '';
  document.getElementById('exEntidad').value             = exam.entidad || '';
  document.getElementById('exConcepto').value            = exam.concepto || 'apto';
  document.getElementById('exEnfasis').value             = exam.enfasis || '';
  document.getElementById('exRestricciones').value       = exam.restricciones || '';
  document.getElementById('exCosto').value               = exam.costo || '';
  document.getElementById('exFisico').checked            = !!exam.tiene_concepto_fisico;
  document.getElementById('exObs').value                 = exam.observaciones || '';

  openModal('modalExamenMedico');
}

async function eliminarExamenMedico(id) {
  if (!confirm('¿Eliminar este examen médico? Esta acción no se puede deshacer.')) return;
  showLoading(true);
  const ok = await ExamenesMedicos.delete(id);
  showLoading(false);
  if (!ok) return;

  Cache.examenes = null;
  toast('Examen médico eliminado', 'warning');
  await renderExamenes();
}

function resetExamenForm() {
  document.getElementById('modalExamTitle').textContent = '🩺 Nuevo Examen Médico';
  document.getElementById('exId').value                 = '';
  const selT = document.getElementById('exTrabajador'); if (selT) selT.value = '';
  document.getElementById('exTipo').value               = 'periodico';
  document.getElementById('exFecha').value              = today();
  document.getElementById('exVencimiento').value        = '';
  document.getElementById('exEntidad').value            = '';
  document.getElementById('exConcepto').value           = 'apto';
  document.getElementById('exEnfasis').value            = '';
  document.getElementById('exRestricciones').value      = '';
  document.getElementById('exCosto').value              = '';
  document.getElementById('exFisico').checked           = false;
  document.getElementById('exObs').value                = '';
  autoCalcularVencimientoExamen();
}

// ── Exportar CSV de Exámenes ─────────────────────────────────────
async function exportarExamenes() {
  showLoading(true);
  const lista = await ExamenesMedicos.getAll();
  showLoading(false);
  if (!lista.length) return toast('No hay exámenes médicos para exportar', 'warning');

  const headers = [
    'Trabajador', 'Tipo de Examen', 'Fecha Examen', 'Vencimiento',
    'IPS / Entidad', 'Énfasis', 'Concepto', 'Restricciones',
    'Concepto Físico', 'Costo', 'Observaciones'
  ];

  const rows = lista.map(e => [
    e.trabajador_nombre,
    EXAM_TIPOS[e.tipo_examen]?.label || e.tipo_examen,
    fmtDate(e.fecha_examen),
    fmtDate(e.fecha_vencimiento),
    e.entidad || '',
    e.enfasis || '',
    EXAM_CONCEPTOS[e.concepto]?.label || e.concepto,
    e.restricciones || '',
    e.tiene_concepto_fisico ? 'Sí' : 'No',
    e.costo != null ? e.costo : '',
    e.observaciones || '',
  ]);

  downloadCSV('examenes_medicos', headers, rows);
}

