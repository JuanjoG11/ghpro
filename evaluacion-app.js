/* ============================================================
   GH PRO — Módulo de Evaluación de Desempeño
   Requiere: supabase.js (cliente Supabase global `sb`)
   ============================================================ */
'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES Y ETIQUETAS
   ════════════════════════════════════════════════════════════ */
const EVAL_ESTADO = {
  pendiente:           'Pendiente',
  en_diligenciamiento: 'En diligenciamiento',
  enviada_gh:          'Enviada a GH',
  devuelta:            'Devuelta',
  socializada:         'Socializada',
  firmada:             'Firmada',
  cerrada:             'Cerrada',
  anulada:             'Anulada',
  vencida:             'Vencida'
};
const EVAL_BADGE = {
  pendiente:           'badge-warning',
  en_diligenciamiento: 'badge-info',
  enviada_gh:          'badge-primary',
  devuelta:            'badge-danger',
  socializada:         'badge-success',
  firmada:             'badge-success',
  cerrada:             'badge-neutral',
  anulada:             'badge-danger',
  vencida:             'badge-danger'
};
const CLASIF_LABEL = {
  cumple_perfil:         'Cumple el perfil',
  oportunidades_mejora:  'Cumple con oportunidades de mejora',
  cumple_parcialmente:   'Cumple parcialmente',
  no_cumple:             'No cumple'
};
const CLASIF_BADGE = {
  cumple_perfil:         'badge-success',
  oportunidades_mejora:  'badge-info',
  cumple_parcialmente:   'badge-warning',
  no_cumple:             'badge-danger'
};
const GRADO_LABEL = { A:'A – Alto', B:'B – Bueno', C:'C – Mínimo', D:'D – Insuficiente' };
const PUNTAJE    = { A:4, B:3, C:2, D:1 };

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function evalBadge(estado) {
  return `<span class="badge ${EVAL_BADGE[estado]||'badge-neutral'}">${EVAL_ESTADO[estado]||estado}</span>`;
}
function clasifBadge(c) {
  if (!c) return '';
  return `<span class="badge ${CLASIF_BADGE[c]||'badge-neutral'}">${CLASIF_LABEL[c]||c}</span>`;
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function diasRestantesHtml(dias) {
  if (dias === null || dias === undefined) return '';
  if (dias < 0)  return `<span class="badge badge-danger">${Math.abs(dias)} días vencido</span>`;
  if (dias <= 5) return `<span class="badge badge-danger">⚠ ${dias} días</span>`;
  if (dias <= 10) return `<span class="badge badge-warning">${dias} días</span>`;
  return `<span class="badge badge-info">${dias} días</span>`;
}
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg, tipo = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
async function supaRPC(fn, params = {}) {
  const { data, error } = await sb.rpc(fn, params);
  if (error) throw error;
  return data;
}

/* ════════════════════════════════════════════════════════════
   MÓDULO PRINCIPAL
   ════════════════════════════════════════════════════════════ */
const EvalMod = {

  /* ── estado UI ─────────────────────────────────────────── */
  vista: 'bandeja',
  evaluacionActiva: null,
  detalleCache: [],
  planesCache: [],
  competenciasCache: [],
  parametros: {},
  usuarioActual: null,       // { id, nombre, cargo, rol }
  usuariosLista: [],

  /* ════════════════════════════════════════════════════════
     INICIALIZAR
     ════════════════════════════════════════════════════════ */
  async init() {
    await this.cargarParametros();
    // Intentar recuperar usuario de sesión anterior
    const guardado = sessionStorage.getItem('eval_usuario');
    if (guardado) {
      try { this.usuarioActual = JSON.parse(guardado); } catch(e) {}
    }
    if (!this.usuarioActual) {
      await this.mostrarSelectorIdentidad();
      return;
    }
    this.renderTopbar();
    await this.mostrarBandeja();
  },

  async cargarParametros() {
    const { data } = await sb.from('parametros_evaluacion').select('clave,valor');
    if (data) data.forEach(p => { this.parametros[p.clave] = p.valor; });
  },

  /* ════════════════════════════════════════════════════════
     SELECTOR DE IDENTIDAD — cédula + PIN igual que requisición
     ════════════════════════════════════════════════════════ */
  async mostrarSelectorIdentidad() {
    const contenedor = document.getElementById('eval-contenido');
    if (!contenedor) return;

    contenedor.innerHTML = `
      <div class="selector-identidad">
        <div class="selector-card">
          <div class="selector-icon">📊</div>
          <h2>Evaluación de Desempeño</h2>
          <p class="text-muted">Ingresa tu cédula y PIN para continuar</p>
          <div class="selector-form">
            <div class="selector-campo">
              <label>Número de cédula</label>
              <input type="text" id="eval-cedula" class="form-control"
                placeholder="Ej: 1234567890"
                inputmode="numeric"
                onkeydown="if(event.key==='Enter') document.getElementById('eval-pin').focus()" />
            </div>
            <div class="selector-campo">
              <label>PIN</label>
              <input type="password" id="eval-pin" class="form-control"
                placeholder="PIN de 4-6 dígitos"
                maxlength="6"
                onkeydown="if(event.key==='Enter') EvalMod.verificarAcceso()" />
            </div>
            <div id="eval-login-error" class="alert alert-danger" style="display:none"></div>
            <button class="btn btn-primary" style="width:100%;margin-top:.5rem"
              onclick="EvalMod.verificarAcceso()">Ingresar →</button>
          </div>
        </div>
      </div>
    `;

    // Foco automático en cédula
    setTimeout(() => document.getElementById('eval-cedula')?.focus(), 100);
  },

  async verificarAcceso() {
    const cedula = (document.getElementById('eval-cedula')?.value || '').trim();
    const pin    = (document.getElementById('eval-pin')?.value    || '').trim();
    const errDiv = document.getElementById('eval-login-error');

    if (!cedula || !pin) {
      errDiv.textContent = 'Ingresa tu cédula y PIN.';
      errDiv.style.display = 'block';
      return;
    }

    const { data: usuarios, error } = await sb
      .from('usuarios_evaluacion')
      .select('*')
      .eq('cedula', cedula)
      .eq('activo', true)
      .limit(1);

    if (error || !usuarios || usuarios.length === 0) {
      errDiv.textContent = 'Cédula no encontrada. Verifica o contacta a Gestión Humana.';
      errDiv.style.display = 'block';
      return;
    }

    const u = usuarios[0];

    if (u.pin !== pin) {
      errDiv.textContent = 'PIN incorrecto.';
      errDiv.style.display = 'block';
      document.getElementById('eval-pin').value = '';
      document.getElementById('eval-pin').focus();
      return;
    }

    this.usuarioActual = u;
    sessionStorage.setItem('eval_usuario', JSON.stringify(u));
    this.renderTopbar();
    await this.mostrarBandeja();
  },

  /* ════════════════════════════════════════════════════════
     TOPBAR — muestra quién está activo y botón cambiar
     ════════════════════════════════════════════════════════ */
  renderTopbar() {
    const nav = document.getElementById('eval-nav');
    if (!nav || !this.usuarioActual) return;
    const u = this.usuarioActual;
    nav.innerHTML = `
      <span style="font-size:.85rem;opacity:.8">
        ${u.nombre} · <em>${u.cargo}</em>
      </span>
      <button class="btn btn-sm btn-ghost" onclick="EvalMod.cambiarUsuario()" title="Cambiar usuario">
        🔄 Cambiar
      </button>
    `;
  },

  cambiarUsuario() {
    this.usuarioActual = null;
    sessionStorage.removeItem('eval_usuario');
    this.mostrarSelectorIdentidad();
  },

  /* ════════════════════════════════════════════════════════
     BANDEJA — filtrada por rol del usuario actual
     ════════════════════════════════════════════════════════ */
  async mostrarBandeja(filtroEstado = '') {
    if (!this.usuarioActual) { await this.mostrarSelectorIdentidad(); return; }
    const contenedor = document.getElementById('eval-contenido');
    if (!contenedor) return;
    contenedor.innerHTML = '<div class="loading">Cargando evaluaciones…</div>';

    let q = sb
      .from('evaluaciones')
      .select(`
        id, estado, cargo_nombre, evaluador_nombre, rol_evaluador,
        fecha_limite, concepto_prueba, indice_ajuste, clasificacion,
        orden_contratacion_num, created_at,
        colaborador:colaborador_id (nombres, numero_id, empresa, sede_nombre),
        ciclo:ciclo_id (tipo, nombre)
      `)
      .order('created_at', { ascending: false });

    // Filtrar por rol:
    // lider → solo ve sus evaluaciones (donde él es el evaluador asignado)
    // gh    → ve todas
    // gerencia → solo ve evaluaciones de los cargos de liderazgo
    const u = this.usuarioActual;
    if (u.rol === 'lider') {
      q = q.eq('evaluador_nombre', u.nombre);
    } else if (u.rol === 'gerencia') {
      // gerencia ve evaluaciones donde el colaborador tiene cargo de liderazgo
      // Filtramos por evaluador_nombre también (el GG es evaluador de los líderes)
      q = q.eq('evaluador_nombre', u.nombre);
    }
    // gh no tiene filtro adicional — ve todo

    if (filtroEstado) q = q.eq('estado', filtroEstado);

    const { data: evals, error } = await q;
    if (error) { contenedor.innerHTML = `<p class="error">${error.message}</p>`; return; }

    const filas = (evals || []).map(e => `
      <tr>
        <td><strong>${esc(e.colaborador?.nombres || '—')}</strong><br>
            <small>${esc(e.colaborador?.numero_id || '')}</small></td>
        <td>${esc(e.cargo_nombre)}</td>
        <td><span class="badge badge-neutral">${esc(e.ciclo?.tipo === 'PRUEBA' ? 'Prueba' : e.ciclo?.nombre || '')}</span></td>
        <td>${evalBadge(e.estado)}</td>
        <td>${e.indice_ajuste != null ? e.indice_ajuste + '%' : '—'}</td>
        <td>${e.concepto_prueba ? (e.concepto_prueba === 'CONTINUA'
              ? '<span class="badge badge-success">Continúa</span>'
              : '<span class="badge badge-danger">No continúa</span>') : '—'}</td>
        <td>${fmtDate(e.fecha_limite)}</td>
        <td>
          <button class="btn btn-xs" onclick="EvalMod.abrirFormulario('${e.id}')">
            ${['pendiente','en_diligenciamiento','devuelta'].includes(e.estado) ? '✏ Evaluar' : '👁 Ver'}
          </button>
          ${['enviada_gh','socializada'].includes(e.estado)
            ? `<button class="btn btn-xs btn-success" onclick="EvalMod.abrirRevisionGH('${e.id}')">🔍 Revisar</button>`
            : ''}
        </td>
      </tr>
    `).join('');

    contenedor.innerHTML = `
      <div class="eval-toolbar">
        <h2>📋 ${u.rol === 'lider' ? 'Mis evaluaciones' : u.rol === 'gerencia' ? 'Evaluaciones a tu cargo' : 'Todas las evaluaciones'}</h2>
        <div class="toolbar-actions">
          ${u.rol !== 'lider' ? `
          <select id="filtro-estado-eval" onchange="EvalMod.mostrarBandeja(this.value)" class="form-select form-select-sm">
            <option value="">Todos los estados</option>
            ${Object.entries(EVAL_ESTADO).map(([k,v]) =>
              `<option value="${k}" ${k === filtroEstado ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>` : ''}
        </div>
      </div>
      ${u.rol === 'lider' ? `
        <div class="alert alert-info" style="margin-bottom:1rem">
          Estás viendo las evaluaciones de tu equipo como <strong>${esc(u.cargo)}</strong>.
          Solo los líderes de proceso con personal a cargo pueden evaluar.
        </div>` : ''}
      ${evals?.length === 0 ? '<p class="empty-state">No hay evaluaciones pendientes.</p>' : ''}
      <div class="table-responsive">
        <table class="tabla-gh">
          <thead>
            <tr>
              <th>Colaborador</th><th>Cargo</th><th>Ciclo</th><th>Estado</th>
              <th>Índice</th><th>Concepto prueba</th><th>Fecha límite</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;
  },

  /* ════════════════════════════════════════════════════════
     PERIODOS DE PRUEBA
     ════════════════════════════════════════════════════════ */
  async mostrarPeriodosPrueba() {
    const contenedor = document.getElementById('eval-contenido');
    if (!contenedor) return;
    contenedor.innerHTML = '<div class="loading">Cargando periodos de prueba…</div>';

    const { data, error } = await sb
      .from('v_periodos_prueba')
      .select('*')
      .order('dias_restantes', { ascending: true });

    if (error) { contenedor.innerHTML = `<p class="error">${error.message}</p>`; return; }

    const filas = (data || []).map(p => `
      <tr class="${p.dias_restantes !== null && p.dias_restantes <= 10 ? 'fila-alerta' : ''}">
        <td><strong>${esc(p.colaborador)}</strong><br><small>${esc(p.cedula)}</small></td>
        <td>${esc(p.empresa)}</td>
        <td>${esc(p.cargo)}</td>
        <td>${esc(p.lider)}</td>
        <td>${fmtDate(p.fecha_fin_prueba)}</td>
        <td>${diasRestantesHtml(p.dias_restantes)}</td>
        <td>${evalBadge(p.estado)}</td>
        <td>${p.concepto_prueba
              ? (p.concepto_prueba === 'CONTINUA'
                  ? '<span class="badge badge-success">Continúa</span>'
                  : '<span class="badge badge-danger">No continúa</span>')
              : '—'}</td>
        <td>
          <button class="btn btn-xs" onclick="EvalMod.abrirFormulario('${p.evaluacion_id}')">
            ${['pendiente','en_diligenciamiento','devuelta'].includes(p.estado) ? '✏ Evaluar' : '👁 Ver'}
          </button>
        </td>
      </tr>
    `).join('');

    contenedor.innerHTML = `
      <div class="eval-toolbar">
        <h2>⏱ Periodos de Prueba</h2>
      </div>
      <div class="table-responsive">
        <table class="tabla-gh">
          <thead>
            <tr>
              <th>Colaborador</th><th>Empresa</th><th>Cargo</th><th>Líder</th>
              <th>Vence</th><th>Días restantes</th><th>Estado</th><th>Concepto</th><th>Acción</th>
            </tr>
          </thead>
          <tbody>${filas || '<tr><td colspan="9" class="empty-state">Sin periodos de prueba activos.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  },

  /* ════════════════════════════════════════════════════════
     FORMULARIO DE EVALUACIÓN
     ════════════════════════════════════════════════════════ */
  async abrirFormulario(evalId) {
    const contenedor = document.getElementById('eval-contenido');
    contenedor.innerHTML = '<div class="loading">Cargando formulario…</div>';

    // Cargar evaluación completa
    const { data: ev, error: errEv } = await sb
      .from('evaluaciones')
      .select(`
        *, colaborador:colaborador_id(*), ciclo:ciclo_id(*)
      `)
      .eq('id', evalId)
      .single();

    if (errEv) { contenedor.innerHTML = `<p class="error">${errEv.message}</p>`; return; }

    // Cargar detalle de competencias
    const { data: detalle } = await sb
      .from('evaluacion_detalle')
      .select('*, competencia:competencia_id(codigo, nombre, tipo, definicion)')
      .eq('evaluacion_id', evalId)
      .order('codigo');

    // Cargar grados de cada competencia
    const compIds = (detalle || []).map(d => d.competencia_id);
    let gradosMap = {};
    if (compIds.length > 0) {
      const { data: grados } = await sb
        .from('competencia_grados')
        .select('*')
        .in('competencia_id', compIds)
        .order('puntaje', { ascending: false });
      (grados || []).forEach(g => {
        if (!gradosMap[g.competencia_id]) gradosMap[g.competencia_id] = {};
        gradosMap[g.competencia_id][g.grado] = g.conducta;
      });
    }

    // Cargar planes de mejora existentes
    const { data: planes } = await sb
      .from('planes_mejora')
      .select('*')
      .eq('evaluacion_id', evalId);

    this.evaluacionActiva = ev;
    this.detalleCache = detalle || [];
    this.planesCache = planes || [];

    // Un líder solo puede editar sus propias evaluaciones
    const u = this.usuarioActual;
    const esEvaluadorAsignado = !u || u.rol === 'gh' ||
      ev.evaluador_nombre?.toLowerCase() === u.nombre?.toLowerCase();

    const editable = ['pendiente','en_diligenciamiento','devuelta'].includes(ev.estado)
      && esEvaluadorAsignado;
    const esPrueba = ev.ciclo?.tipo === 'PRUEBA';
    const esFirmada = ['firmada','cerrada'].includes(ev.estado);

    // Cabecera
    const fechaVenc = ev.colaborador?.fecha_ingreso && ev.colaborador?.periodo_prueba_dias
      ? new Date(new Date(ev.colaborador.fecha_ingreso).getTime()
          + (ev.colaborador.periodo_prueba_dias - 1) * 86400000)
          .toISOString().split('T')[0]
      : null;

    let html = `
      <div class="eval-form-header">
        <button class="btn btn-sm btn-ghost" onclick="EvalMod.mostrarBandeja()">← Volver</button>
        <div>
          <h2>${esPrueba ? '⏱ Evaluación de Periodo de Prueba' : '📊 Evaluación de Desempeño'}</h2>
          <p class="eval-subtitle">
            <strong>${esc(ev.colaborador?.nombres)}</strong> ·
            ${esc(ev.cargo_nombre)} ·
            ${esc(ev.colaborador?.empresa || '')} ·
            ${esc(ev.colaborador?.sede_nombre || '')}
          </p>
          ${esPrueba && fechaVenc ? `<p class="eval-fechas">Vencimiento periodo de prueba: <strong>${fmtDate(fechaVenc)}</strong></p>` : ''}
          <p class="eval-fechas">Evaluador: <strong>${esc(ev.evaluador_nombre || '—')}</strong> · Estado: ${evalBadge(ev.estado)}</p>
          ${ev.observacion_devolucion ? `<div class="alert alert-warning">📌 GH devolvió: ${esc(ev.observacion_devolucion)}</div>` : ''}
          ${!esEvaluadorAsignado ? `<div class="alert alert-warning">👁 Solo puedes ver esta evaluación. El evaluador asignado es <strong>${esc(ev.evaluador_nombre)}</strong>.</div>` : ''}
        </div>
      </div>

      <form id="form-evaluacion" onsubmit="EvalMod.enviarEvaluacion(event, '${evalId}')">
        <div class="competencias-grid">
    `;

    // Tarjetas de competencia
    (detalle || []).forEach((d, idx) => {
      const grados = gradosMap[d.competencia_id] || {};
      const tieneValor = !!d.grado_observado;
      const bajoPerfil = tieneValor && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido];
      const evidenciaReq = tieneValor && (d.grado_observado === 'D' || bajoPerfil);

      html += `
        <div class="comp-card ${tieneValor ? (d.cumple ? 'comp-cumple' : 'comp-brecha') : ''}" id="card-${d.id}">
          <div class="comp-card-header">
            <span class="comp-codigo">${esc(d.codigo)}</span>
            <span class="comp-nombre">${esc(d.nombre_comp)}</span>
            ${tieneValor && ev.estado !== 'pendiente'
              ? (d.cumple
                  ? `<span class="badge badge-success">${d.es_fortaleza ? '⭐ Fortaleza' : '✓ Cumple'}</span>`
                  : `<span class="badge badge-danger">⚠ Brecha ${d.brecha_grados} grado(s)</span>`)
              : ''}
          </div>
          ${d.competencia?.definicion
            ? `<p class="comp-definicion">${esc(d.competencia.definicion)}</p>`
            : ''}
          <div class="comp-opciones">
            ${['A','B','C','D'].map(g => `
              <label class="comp-opcion ${!editable ? 'readonly' : ''} ${d.grado_observado === g ? 'selected' : ''}">
                <input type="radio" name="grado_${d.id}" value="${g}"
                  ${d.grado_observado === g ? 'checked' : ''}
                  ${!editable ? 'disabled' : ''}
                  onchange="EvalMod.onGradoChange('${d.id}', '${evalId}', this.value, ${PUNTAJE[d.grado_exigido]})"
                />
                <div class="comp-opcion-inner">
                  <span class="grado-label">${GRADO_LABEL[g]}</span>
                  <span class="conducta-texto">${esc(grados[g] || '')}</span>
                </div>
              </label>
            `).join('')}
          </div>
          <div class="comp-evidencia" id="evidencia-wrap-${d.id}"
               style="display:${evidenciaReq || d.evidencia ? 'block' : 'none'}">
            <label>Evidencia <span class="req">*</span>
              <small>(obligatoria cuando el grado está por debajo de lo exigido o es D)</small>
            </label>
            <textarea name="evidencia_${d.id}" rows="2" class="form-control"
              ${!editable ? 'readonly' : ''}
              minlength="30">${esc(d.evidencia || '')}</textarea>
          </div>
        </div>
      `;
    });

    html += `</div>`; // cierre competencias-grid

    // Sección de concepto (solo periodo de prueba)
    if (esPrueba) {
      html += `
        <div class="eval-seccion" id="seccion-concepto">
          <h3>Concepto del periodo de prueba</h3>
          <div class="concepto-opciones">
            <label class="concepto-btn ${ev.concepto_prueba === 'CONTINUA' ? 'selected' : ''} ${!editable?'readonly':''}">
              <input type="radio" name="concepto_prueba" value="CONTINUA"
                ${ev.concepto_prueba === 'CONTINUA' ? 'checked' : ''}
                ${!editable ? 'disabled' : ''}
                onchange="EvalMod.onConcepChange(this.value)"
              /> ✅ Continúa
            </label>
            <label class="concepto-btn ${ev.concepto_prueba === 'NO_CONTINUA' ? 'selected nocontinua' : ''} ${!editable?'readonly':''}">
              <input type="radio" name="concepto_prueba" value="NO_CONTINUA"
                ${ev.concepto_prueba === 'NO_CONTINUA' ? 'checked' : ''}
                ${!editable ? 'disabled' : ''}
                onchange="EvalMod.onConcepChange(this.value)"
              /> ❌ No continúa
            </label>
          </div>
          <div id="obs-nocontinua-wrap" style="display:${ev.concepto_prueba === 'NO_CONTINUA' ? 'block' : 'none'}">
            <div class="alert alert-danger">Esta decisión activa una alerta inmediata a Gestión Humana.</div>
          </div>
        </div>
      `;
    }

    // Observaciones generales
    html += `
      <div class="eval-seccion">
        <h3>Observaciones generales</h3>
        <textarea id="obs-generales" name="observaciones_generales" rows="4" class="form-control"
          ${!editable ? 'readonly' : ''}
          placeholder="${esPrueba && ev.concepto_prueba === 'NO_CONTINUA' ? 'Obligatorio (mínimo 100 caracteres) cuando el concepto es No continúa' : 'Observaciones del evaluador…'}"
        >${esc(ev.observaciones_generales || '')}</textarea>
      </div>
    `;

    // Plan de mejora (prellenado con brechas)
    const brechas = (detalle || []).filter(d => d.cumple === false);
    if (brechas.length > 0 || (planes || []).length > 0) {
      html += `
        <div class="eval-seccion" id="seccion-planes">
          <h3>📈 Plan de mejora</h3>
          <p class="text-muted">Obligatorio para cada brecha. Acuerda acciones concretas con el colaborador.</p>
          <div id="planes-container">
            ${this.renderPlanesForm(brechas, planes || [], editable)}
          </div>
        </div>
      `;
    }

    // Botones
    if (editable) {
      html += `
        <div class="eval-actions">
          <button type="button" class="btn btn-secondary"
            onclick="EvalMod.guardarBorrador('${evalId}')">💾 Guardar borrador</button>
          <button type="submit" class="btn btn-primary">📤 Enviar a Gestión Humana</button>
        </div>
      `;
    } else if (ev.estado === 'socializada') {
      html += `
        <div class="eval-seccion">
          <h3>✍ Firma del colaborador</h3>
          <div class="firma-opciones">
            <label><input type="radio" name="firma_aceptacion" value="true"> Estoy de acuerdo con la evaluación</label>
            <label><input type="radio" name="firma_aceptacion" value="false"> Dejo constancia de mi desacuerdo</label>
          </div>
          <textarea id="firma-comentario" rows="3" class="form-control mt-2"
            placeholder="Comentario o motivo de desacuerdo (opcional)"></textarea>
          <button class="btn btn-primary mt-2" onclick="EvalMod.firmarColaborador('${evalId}')">
            ✅ Firmar enterado
          </button>
        </div>
      `;
    }

    html += `</form>`;

    // Si ya está cerrada, mostrar resultado final con índice
    if (!editable && ev.indice_ajuste != null) {
      html += `
        <div class="eval-resultado-box">
          <div class="resultado-indice">${ev.indice_ajuste}%</div>
          <div class="resultado-label">Índice de ajuste al cargo</div>
          ${clasifBadge(ev.clasificacion)}
        </div>
      `;
    }

    contenedor.innerHTML = html;
  },

  /* ── Render plan de mejora ─────────────────────────────── */
  renderPlanesForm(brechas, planesExistentes, editable) {
    // Mezclar: una fila por brecha, tomando datos existentes si ya hay plan
    const filas = brechas.map((b, i) => {
      const p = planesExistentes.find(pl => pl.competencia_id === b.competencia_id) || {};
      return `
        <div class="plan-fila" data-comp-id="${b.competencia_id}">
          <div class="plan-comp-nombre">
            <span class="badge badge-danger">Brecha ${b.brecha_grados}g</span>
            ${esc(b.nombre_comp)} (exigido ${b.grado_exigido} · observado ${b.grado_observado || '—'})
          </div>
          <div class="plan-campos">
            <div class="plan-campo">
              <label>Acción concreta <span class="req">*</span></label>
              <input type="text" name="plan_accion_${b.competencia_id}"
                class="form-control" value="${esc(p.accion || '')}"
                ${!editable ? 'readonly' : ''} placeholder="Ej: Capacitación en servicio al cliente" />
            </div>
            <div class="plan-campo">
              <label>Responsable</label>
              <input type="text" name="plan_resp_${b.competencia_id}"
                class="form-control" value="${esc(p.responsable_nombre || '')}"
                ${!editable ? 'readonly' : ''} placeholder="Nombre del responsable" />
            </div>
            <div class="plan-campo">
              <label>Fecha compromiso <span class="req">*</span></label>
              <input type="date" name="plan_fecha_${b.competencia_id}"
                class="form-control" value="${p.fecha_compromiso || ''}"
                ${!editable ? 'readonly' : ''} />
            </div>
            <div class="plan-campo">
              <label>Fecha seguimiento</label>
              <input type="date" name="plan_seg_${b.competencia_id}"
                class="form-control" value="${p.fecha_seguimiento || ''}"
                ${!editable ? 'readonly' : ''} />
            </div>
          </div>
        </div>
      `;
    });
    return filas.join('') || '<p class="text-muted">Sin brechas detectadas aún.</p>';
  },

  /* ── Cambio de grado en tiempo real ───────────────────── */
  async onGradoChange(detalleId, evalId, gradoNuevo, puntajeExigido) {
    const puntajeNuevo = PUNTAJE[gradoNuevo];
    const bajoPerfil   = puntajeNuevo < puntajeExigido;
    const evidWrap     = document.getElementById(`evidencia-wrap-${detalleId}`);
    if (evidWrap) evidWrap.style.display = (gradoNuevo === 'D' || bajoPerfil) ? 'block' : 'none';

    // Marcar card visualmente
    const card = document.getElementById(`card-${detalleId}`);
    if (card) {
      card.classList.toggle('comp-brecha', bajoPerfil || gradoNuevo === 'D');
      card.classList.toggle('comp-cumple', !bajoPerfil && gradoNuevo !== 'D');
    }

    // Guardar automáticamente el grado (borrador)
    await sb.from('evaluacion_detalle')
      .update({
        grado_observado:   gradoNuevo,
        puntaje_observado: puntajeNuevo
      })
      .eq('id', detalleId);

    // Cambiar estado a en_diligenciamiento si está pendiente
    await sb.from('evaluaciones')
      .update({ estado: 'en_diligenciamiento', updated_at: new Date().toISOString() })
      .eq('id', evalId)
      .eq('estado', 'pendiente');
  },

  onConcepChange(valor) {
    const wrap = document.getElementById('obs-nocontinua-wrap');
    if (wrap) wrap.style.display = valor === 'NO_CONTINUA' ? 'block' : 'none';
    const obsArea = document.getElementById('obs-generales');
    if (obsArea) obsArea.placeholder = valor === 'NO_CONTINUA'
      ? 'Obligatorio: explique las razones (mínimo 100 caracteres)'
      : 'Observaciones del evaluador…';
  },

  /* ── Guardar borrador ──────────────────────────────────── */
  async guardarBorrador(evalId) {
    const form = document.getElementById('form-evaluacion');
    if (!form) return;
    const fd = new FormData(form);

    // Recoger planes
    await this._guardarPlanes(evalId, fd);

    // Observaciones y concepto
    const obs     = fd.get('observaciones_generales') || '';
    const concept = fd.get('concepto_prueba');
    const upd = { observaciones_generales: obs, updated_at: new Date().toISOString() };
    if (concept) upd.concepto_prueba = concept;

    const { error } = await sb.from('evaluaciones').update(upd).eq('id', evalId);
    if (error) { toast('Error al guardar: ' + error.message, 'error'); return; }
    toast('Borrador guardado ✓');
  },

  async _guardarPlanes(evalId, fd) {
    const brechas = this.detalleCache.filter(d =>
      d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);

    for (const b of brechas) {
      const accion = fd.get(`plan_accion_${b.competencia_id}`) || '';
      const resp   = fd.get(`plan_resp_${b.competencia_id}`) || '';
      const fecha  = fd.get(`plan_fecha_${b.competencia_id}`) || null;
      const seg    = fd.get(`plan_seg_${b.competencia_id}`) || null;

      if (!accion) continue;

      const existing = this.planesCache.find(p => p.competencia_id === b.competencia_id);
      if (existing) {
        await sb.from('planes_mejora').update({
          accion, responsable_nombre: resp,
          fecha_compromiso: fecha, fecha_seguimiento: seg, updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await sb.from('planes_mejora').insert({
          evaluacion_id: evalId, competencia_id: b.competencia_id,
          codigo_competencia: b.codigo, nombre_competencia: b.nombre_comp,
          accion, responsable_nombre: resp,
          fecha_compromiso: fecha, fecha_seguimiento: seg
        });
      }
    }
  },

  /* ── Enviar a GH ───────────────────────────────────────── */
  async enviarEvaluacion(e, evalId) {
    e.preventDefault();
    const form = document.getElementById('form-evaluacion');
    const fd   = new FormData(form);
    const ev   = this.evaluacionActiva;
    const esPrueba = ev?.ciclo?.tipo === 'PRUEBA';

    // ── Validaciones ────────────────────────────────────────
    const errores = [];

    // 1. Todas las competencias calificadas
    const sinCalificar = this.detalleCache.filter(d => !d.grado_observado);
    if (sinCalificar.length > 0) {
      errores.push(`Faltan ${sinCalificar.length} competencia(s) por calificar: ${sinCalificar.map(d => d.codigo).join(', ')}`);
    }

    // 2. Evidencia en D o por debajo del exigido
    const minChars = parseInt(this.parametros.evidencia_min_chars || '30');
    this.detalleCache.forEach(d => {
      if (!d.grado_observado) return;
      const bajoPerfil = PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido];
      if (d.grado_observado === 'D' || bajoPerfil) {
        const evidencia = (fd.get(`evidencia_${d.id}`) || '').trim();
        if (evidencia.length < minChars) {
          errores.push(`Evidencia insuficiente en "${d.nombre_comp}" (mínimo ${minChars} caracteres)`);
        }
      }
    });

    // 3. Concepto obligatorio en periodo de prueba
    const concepto = fd.get('concepto_prueba');
    if (esPrueba && !concepto) {
      errores.push('Debe seleccionar el concepto: Continúa o No continúa');
    }

    // 4. Observaciones mínimas si No continúa
    const obsMinChars = parseInt(this.parametros.obs_no_continua_min_chars || '100');
    const obs = (fd.get('observaciones_generales') || '').trim();
    if (esPrueba && concepto === 'NO_CONTINUA' && obs.length < obsMinChars) {
      errores.push(`Las observaciones deben tener al menos ${obsMinChars} caracteres cuando el concepto es "No continúa"`);
    }

    // 5. Plan de mejora para cada brecha
    const brechas = this.detalleCache.filter(d =>
      d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);
    brechas.forEach(b => {
      const accion = (fd.get(`plan_accion_${b.competencia_id}`) || '').trim();
      const fecha  = fd.get(`plan_fecha_${b.competencia_id}`) || '';
      if (!accion || !fecha) {
        errores.push(`Plan de mejora incompleto para "${b.nombre_comp}" (acción y fecha requeridas)`);
      }
    });

    if (errores.length > 0) {
      this._mostrarErrores(errores);
      return;
    }

    // ── Guardar datos finales ────────────────────────────────
    // Evidencias
    for (const d of this.detalleCache) {
      const evidencia = fd.get(`evidencia_${d.id}`) || '';
      if (evidencia) {
        await sb.from('evaluacion_detalle')
          .update({ evidencia })
          .eq('id', d.id);
      }
    }

    // Planes
    await this._guardarPlanes(evalId, fd);

    // Calcular índice en backend
    await sb.rpc('fn_calcular_indice', { p_evaluacion_id: evalId });

    // Actualizar estado de evaluación
    const updEval = {
      estado: 'enviada_gh',
      observaciones_generales: obs,
      fecha_envio: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (concepto) updEval.concepto_prueba = concepto;

    const { error } = await sb.from('evaluaciones').update(updEval).eq('id', evalId);
    if (error) { toast('Error al enviar: ' + error.message, 'error'); return; }

    // Auditoría
    await sb.from('auditoria_evaluacion').insert({
      tabla: 'evaluaciones', registro_id: evalId,
      accion: 'cambio_estado', valor_anterior: ev.estado, valor_nuevo: 'enviada_gh',
      usuario_nombre: 'líder'
    });

    toast('Evaluación enviada a Gestión Humana ✓', 'success');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  _mostrarErrores(errores) {
    const existing = document.getElementById('eval-errores');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'eval-errores';
    div.className = 'alert alert-danger';
    div.innerHTML = `<strong>Corrige antes de enviar:</strong><ul>${errores.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
    const form = document.getElementById('form-evaluacion');
    form?.insertAdjacentElement('beforebegin', div);
    div.scrollIntoView({ behavior: 'smooth' });
  },

  /* ════════════════════════════════════════════════════════
     REVISIÓN GH
     ════════════════════════════════════════════════════════ */
  async abrirRevisionGH(evalId) {
    const contenedor = document.getElementById('eval-contenido');
    contenedor.innerHTML = '<div class="loading">Cargando revisión…</div>';

    const { data: ev } = await sb
      .from('evaluaciones')
      .select('*, colaborador:colaborador_id(*), ciclo:ciclo_id(*)')
      .eq('id', evalId).single();

    const { data: detalle } = await sb
      .from('evaluacion_detalle')
      .select('*, competencia:competencia_id(codigo, nombre, tipo)')
      .eq('evaluacion_id', evalId)
      .order('codigo');

    const { data: planes } = await sb
      .from('planes_mejora').select('*').eq('evaluacion_id', evalId);

    const { data: firmas } = await sb
      .from('evaluacion_firmas').select('*').eq('evaluacion_id', evalId);

    // Buscar autoevaluación del colaborador (si existe)
    let autoEval = null;
    if (ev?.ciclo?.incluye_autoevaluacion) {
      const { data: ae } = await sb
        .from('evaluaciones')
        .select('*, evaluacion_detalle(*)')
        .eq('colaborador_id', ev.colaborador_id)
        .eq('ciclo_id', ev.ciclo_id)
        .eq('rol_evaluador', 'AUTO')
        .single();
      autoEval = ae;
    }

    // Tabla de competencias con comparación
    const filas = (detalle || []).map(d => {
      let autoGrado = '—';
      if (autoEval?.evaluacion_detalle) {
        const ad = autoEval.evaluacion_detalle.find(x => x.competencia_id === d.competencia_id);
        if (ad) {
          autoGrado = ad.grado_observado || '—';
          const diff = Math.abs((PUNTAJE[d.grado_observado] || 0) - (PUNTAJE[ad.grado_observado] || 0));
          if (diff >= 2) autoGrado = `<span class="badge badge-danger">⚠ ${autoGrado}</span>`;
        }
      }
      return `
        <tr class="${d.cumple === false ? 'fila-brecha' : ''}">
          <td>${esc(d.codigo)}</td>
          <td>${esc(d.nombre_comp)}</td>
          <td class="text-center">${esc(d.grado_exigido)}</td>
          <td class="text-center"><strong>${esc(d.grado_observado || '—')}</strong></td>
          <td class="text-center">${autoGrado}</td>
          <td class="text-center">
            ${d.cumple === true
              ? (d.es_fortaleza ? '⭐' : '✓')
              : d.cumple === false ? `<span class="text-danger">▼${d.brecha_grados}g</span>` : ''}
          </td>
          <td><small>${esc(d.evidencia || '')}</small></td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="eval-form-header">
        <button class="btn btn-sm btn-ghost" onclick="EvalMod.mostrarBandeja()">← Volver</button>
        <div>
          <h2>🔍 Revisión GH — ${esc(ev?.colaborador?.nombres)}</h2>
          <p>${esc(ev?.cargo_nombre)} · ${evalBadge(ev?.estado)}</p>
        </div>
      </div>

      ${ev?.indice_ajuste != null ? `
        <div class="eval-resultado-box">
          <div class="resultado-indice">${ev.indice_ajuste}%</div>
          <div class="resultado-label">Índice de ajuste al cargo</div>
          ${clasifBadge(ev.clasificacion)}
          ${ev.concepto_prueba ? `<div class="mt-1">${ev.concepto_prueba === 'CONTINUA'
            ? '<span class="badge badge-success badge-lg">✅ Continúa</span>'
            : '<span class="badge badge-danger badge-lg">❌ No continúa</span>'}</div>` : ''}
        </div>
      ` : ''}

      <div class="table-responsive">
        <table class="tabla-gh tabla-revision">
          <thead>
            <tr>
              <th>Código</th><th>Competencia</th><th>Exigido</th>
              <th>Jefe</th><th>Auto</th><th>Resultado</th><th>Evidencia</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>

      ${(planes || []).length > 0 ? `
        <div class="eval-seccion">
          <h3>Plan de mejora</h3>
          <table class="tabla-gh">
            <thead><tr><th>Competencia</th><th>Acción</th><th>Responsable</th><th>Fecha compromiso</th><th>Seguimiento</th></tr></thead>
            <tbody>
              ${planes.map(p => `
                <tr>
                  <td>${esc(p.nombre_competencia)}</td>
                  <td>${esc(p.accion)}</td>
                  <td>${esc(p.responsable_nombre || '—')}</td>
                  <td>${fmtDate(p.fecha_compromiso)}</td>
                  <td>${fmtDate(p.fecha_seguimiento)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <div class="eval-seccion">
        <h3>Observaciones generales del evaluador</h3>
        <p>${esc(ev?.observaciones_generales || '(sin observaciones)')}</p>
      </div>

      ${ev?.estado === 'enviada_gh' ? `
        <div class="eval-actions eval-gh-actions">
          <div class="gh-aprobar">
            <button class="btn btn-success btn-lg"
              onclick="EvalMod.aprobarEvaluacion('${evalId}')">✅ Aprobar y socializar</button>
          </div>
          <div class="gh-devolver">
            <textarea id="obs-devolucion" rows="3" class="form-control"
              placeholder="Motivo de devolución (obligatorio)"></textarea>
            <button class="btn btn-danger mt-1"
              onclick="EvalMod.devolverEvaluacion('${evalId}')">↩ Devolver al líder</button>
          </div>
        </div>
      ` : ''}
    `;

    contenedor.innerHTML = html;
  },

  async aprobarEvaluacion(evalId) {
    const { error } = await sb.from('evaluaciones').update({
      estado: 'socializada',
      updated_at: new Date().toISOString()
    }).eq('id', evalId);
    if (error) { toast('Error: ' + error.message, 'error'); return; }

    await sb.from('auditoria_evaluacion').insert({
      tabla: 'evaluaciones', registro_id: evalId,
      accion: 'cambio_estado', valor_anterior: 'enviada_gh', valor_nuevo: 'socializada',
      usuario_nombre: 'GH'
    });
    await sb.from('evaluacion_firmas').insert({
      evaluacion_id: evalId, rol: 'GH',
      usuario_nombre: 'Gestión Humana', aceptacion: true
    });

    toast('Evaluación socializada ✓', 'success');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  async devolverEvaluacion(evalId) {
    const obs = (document.getElementById('obs-devolucion')?.value || '').trim();
    if (!obs) { toast('Escribe el motivo de devolución', 'warning'); return; }

    const { error } = await sb.from('evaluaciones').update({
      estado: 'devuelta',
      observacion_devolucion: obs,
      updated_at: new Date().toISOString()
    }).eq('id', evalId);
    if (error) { toast('Error: ' + error.message, 'error'); return; }

    await sb.from('auditoria_evaluacion').insert({
      tabla: 'evaluaciones', registro_id: evalId,
      accion: 'cambio_estado', valor_anterior: 'enviada_gh', valor_nuevo: 'devuelta',
      campo: 'observacion_devolucion', valor_nuevo: obs, usuario_nombre: 'GH'
    });

    toast('Evaluación devuelta al líder ✓', 'success');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  /* ════════════════════════════════════════════════════════
     FIRMA DEL COLABORADOR
     ════════════════════════════════════════════════════════ */
  async firmarColaborador(evalId) {
    const aceptacion = document.querySelector('input[name="firma_aceptacion"]:checked')?.value;
    const comentario = (document.getElementById('firma-comentario')?.value || '').trim();

    if (aceptacion === undefined) { toast('Selecciona si estás de acuerdo o no', 'warning'); return; }

    await sb.from('evaluacion_firmas').insert({
      evaluacion_id: evalId, rol: 'COLABORADOR',
      usuario_nombre: 'Colaborador',
      aceptacion: aceptacion === 'true',
      comentario: comentario || null
    });

    await sb.from('evaluaciones').update({
      estado: 'firmada', updated_at: new Date().toISOString()
    }).eq('id', evalId);

    await sb.from('auditoria_evaluacion').insert({
      tabla: 'evaluaciones', registro_id: evalId,
      accion: 'cambio_estado', valor_anterior: 'socializada', valor_nuevo: 'firmada',
      usuario_nombre: 'colaborador'
    });

    toast('Evaluación firmada ✓', 'success');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  /* ════════════════════════════════════════════════════════
     CREAR EVALUACIÓN DE PRUEBA DESDE CONTRATACIÓN
     Llamar cuando se aprueba una orden de contratación
     ════════════════════════════════════════════════════════ */
  async crearEvaluacionPruebaDesdeOrden(ordenId) {
    const { data, error } = await sb.rpc('fn_crear_evaluacion_prueba', {
      p_orden_id: ordenId
    });
    if (error) {
      console.error('Error al crear evaluación de periodo de prueba:', error.message);
      return null;
    }
    return data; // UUID de la evaluación creada
  },

  /* ════════════════════════════════════════════════════════
     PARÁMETROS
     ════════════════════════════════════════════════════════ */
  async mostrarParametros() {
    const contenedor = document.getElementById('eval-contenido');
    contenedor.innerHTML = '<div class="loading">Cargando parámetros…</div>';

    const { data, error } = await sb
      .from('parametros_evaluacion').select('*').order('clave');
    if (error) { contenedor.innerHTML = `<p class="error">${error.message}</p>`; return; }

    const filas = (data || []).map(p => `
      <tr>
        <td><code>${esc(p.clave)}</code></td>
        <td><small class="text-muted">${esc(p.descripcion || '')}</small></td>
        <td>
          <input type="text" class="form-control form-control-sm"
            id="param-${esc(p.clave)}" value="${esc(p.valor)}"
            onchange="EvalMod.guardarParametro('${esc(p.clave)}', this.value)" />
        </td>
      </tr>
    `).join('');

    contenedor.innerHTML = `
      <div class="eval-toolbar">
        <h2>⚙ Parámetros del módulo</h2>
        <button class="btn btn-sm btn-ghost" onclick="EvalMod.mostrarBandeja()">← Volver</button>
      </div>
      <p class="text-muted">Los cambios se guardan automáticamente al modificar cada valor.</p>
      <table class="tabla-gh">
        <thead><tr><th>Parámetro</th><th>Descripción</th><th>Valor</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  },

  async guardarParametro(clave, valor) {
    const { error } = await sb.from('parametros_evaluacion')
      .update({ valor })
      .eq('clave', clave);
    if (error) toast('Error al guardar: ' + error.message, 'error');
    else {
      this.parametros[clave] = valor;
      toast(`Parámetro "${clave}" actualizado ✓`);
    }
  }
};

/* ════════════════════════════════════════════════════════════
   HOOK DE INTEGRACIÓN CON CONTRATACIÓN
   Llama esto desde contratacion-app.js cuando una orden
   pasa a estado 'aprobada' o 'contrato_generado'
   ════════════════════════════════════════════════════════════ */
async function onOrdenAprobada(ordenId) {
  const evalId = await EvalMod.crearEvaluacionPruebaDesdeOrden(ordenId);
  if (evalId) {
    console.log(`✅ Evaluación de periodo de prueba creada: ${evalId}`);
  }
}
