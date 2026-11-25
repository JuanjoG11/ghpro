/* ============================================================
   GH PRO — Módulo de Evaluación de Desempeño
   Requiere: supabase.js (cliente Supabase global `sb`)
   ============================================================ */
'use strict';

/* ════════════════════════════════════════════════════════════
   CONSTANTES
   ════════════════════════════════════════════════════════════ */
const EVAL_ESTADO = {
  pendiente:'Pendiente', en_diligenciamiento:'En borrador',
  enviada_gh:'Enviada a GH', devuelta:'Devuelta',
  socializada:'Socializada', firmada:'Firmada',
  cerrada:'Cerrada', anulada:'Anulada', vencida:'Vencida'
};
const EVAL_BADGE_CLASS = {
  pendiente:'badge-pendiente', en_diligenciamiento:'badge-borrador',
  enviada_gh:'badge-enviada', devuelta:'badge-devuelta',
  socializada:'badge-socializada', firmada:'badge-firmada',
  cerrada:'badge-cerrada', anulada:'badge-danger', vencida:'badge-vencida'
};
const CLASIF_LABEL = {
  cumple_perfil:'Cumple el perfil',
  oportunidades_mejora:'Cumple con oportunidades de mejora',
  cumple_parcialmente:'Cumple parcialmente',
  no_cumple:'No cumple'
};
const PUNTAJE = { A:4, B:3, C:2, D:1 };
const GRADO_NOMBRE = { A:'A – Alto', B:'B – Bueno', C:'C – Mínimo', D:'D – Insuficiente' };

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,dd] = d.split('T')[0].split('-');
  return `${dd}/${m}/${y}`;
}
function estadoBadge(estado) {
  return `<span class="badge ${EVAL_BADGE_CLASS[estado]||'badge-neutral'}">${EVAL_ESTADO[estado]||estado}</span>`;
}
function diasLabel(dias) {
  if (dias === null || dias === undefined) return { html:'—', cls:'' };
  if (dias < 0)   return { html:`Vencida hace ${Math.abs(dias)} día${Math.abs(dias)>1?'s':''}`, cls:'fecha-danger' };
  if (dias === 0) return { html:'Vence hoy', cls:'fecha-danger' };
  if (dias <= 5)  return { html:`En ${dias} día${dias>1?'s':''}`, cls:'fecha-danger' };
  if (dias <= 10) return { html:`En ${dias} días`, cls:'fecha-warn' };
  return { html:`Día ${dias} del ciclo`, cls:'fecha-ok' };
}
function btnAccion(estado, evalId, esGH) {
  if (estado === 'pendiente')           return `<button class="btn-accion" onclick="EvalMod.abrirFormulario('${evalId}')">Evaluar</button>`;
  if (estado === 'en_diligenciamiento') return `<button class="btn-accion" onclick="EvalMod.abrirFormulario('${evalId}')">Continuar</button>`;
  if (estado === 'devuelta')            return `<button class="btn-accion" onclick="EvalMod.abrirFormulario('${evalId}')">Corregir</button>`;
  if (estado === 'vencida')             return `<button class="btn-accion" onclick="EvalMod.abrirFormulario('${evalId}')">Evaluar</button>`;
  if ((estado === 'enviada_gh' || estado === 'socializada') && esGH)
                                        return `<button class="btn-accion" onclick="EvalMod.abrirRevisionGH('${evalId}')">Revisar</button>`;
  return `<button class="btn-accion secundario" onclick="EvalMod.abrirFormulario('${evalId}')">Ver</button>`;
}
function toast(msg, tipo='success') {
  const t = document.createElement('div');
  t.className = `toast${tipo==='error'?' toast-error':tipo==='warning'?' toast-warning':''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ════════════════════════════════════════════════════════════
   MÓDULO
   ════════════════════════════════════════════════════════════ */
const EvalMod = {

  usuarioActual: null,
  evaluacionActiva: null,
  detalleCache: [],
  planesCache: [],
  parametros: {},
  compActual: 0,   // índice de competencia en formulario paso a paso

  /* ── INIT ─────────────────────────────────────────────── */
  async init() {
    await this.cargarParametros();
    const guardado = sessionStorage.getItem('eval_usuario');
    if (guardado) { try { this.usuarioActual = JSON.parse(guardado); } catch(e){} }
    if (!this.usuarioActual) { this.renderLogin(); return; }
    this.renderTopbar();
    await this.mostrarBandeja();
  },

  async cargarParametros() {
    const { data } = await sb.from('parametros_evaluacion').select('clave,valor');
    if (data) data.forEach(p => { this.parametros[p.clave] = p.valor; });
  },

  /* ── LOGIN ────────────────────────────────────────────── */
  renderLogin() {
    document.getElementById('app-contenido').innerHTML = `
      <div class="login-wrap">
        <div class="login-card">
          <div class="login-icon">📊</div>
          <h2>Evaluación de Desempeño</h2>
          <p>Ingresa tu cédula y PIN para continuar</p>
          <div class="login-campo">
            <label>Número de cédula</label>
            <input id="ev-ced" type="text" class="login-input" placeholder="Ej: 1234567890"
              inputmode="numeric"
              onkeydown="if(event.key==='Enter') document.getElementById('ev-pin').focus()" />
          </div>
          <div class="login-campo">
            <label>PIN</label>
            <input id="ev-pin" type="password" class="login-input" placeholder="PIN de 4-6 dígitos"
              maxlength="6"
              onkeydown="if(event.key==='Enter') EvalMod.login()" />
          </div>
          <div id="ev-err" class="login-error"></div>
          <button class="btn-login" onclick="EvalMod.login()">Ingresar →</button>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('ev-ced')?.focus(), 100);
  },

  async login() {
    const cedula = (document.getElementById('ev-ced')?.value||'').trim();
    const pin    = (document.getElementById('ev-pin')?.value||'').trim();
    const err    = document.getElementById('ev-err');
    if (!cedula||!pin) { err.textContent='Ingresa tu cédula y PIN.'; err.style.display='block'; return; }

    const { data } = await sb.from('usuarios_evaluacion')
      .select('*').eq('cedula',cedula).eq('activo',true).limit(1);

    if (!data||data.length===0) {
      err.textContent='Cédula no encontrada. Verifica o contacta a Gestión Humana.';
      err.style.display='block'; return;
    }
    if (data[0].pin !== pin) {
      err.textContent='PIN incorrecto.'; err.style.display='block';
      document.getElementById('ev-pin').value='';
      document.getElementById('ev-pin').focus(); return;
    }
    this.usuarioActual = data[0];
    sessionStorage.setItem('eval_usuario', JSON.stringify(data[0]));
    this.renderTopbar();
    await this.mostrarBandeja();
  },

  /* ── TOPBAR ───────────────────────────────────────────── */
  renderTopbar(tab='evaluaciones') {
    const u = this.usuarioActual;
    if (!u) return;
    const esGH = u.rol === 'gh' || u.rol === 'gerencia';

    document.getElementById('topbar-nav').innerHTML = `
      <button class="topbar-nav-btn ${tab==='evaluaciones'?'active':''}"
        onclick="EvalMod.mostrarBandeja()">Evaluaciones</button>
      ${esGH ? `<button class="topbar-nav-btn ${tab==='periodos'?'active':''}"
        onclick="EvalMod.mostrarPeriodosPrueba()">Periodos de prueba</button>` : ''}
      <button class="topbar-nav-btn" onclick="window.location.href='index.html'">← GH PRO</button>
    `;
    document.getElementById('topbar-user').innerHTML = `
      <span>[${esc(u.nombre)}] · ${esc(u.cargo)}</span>
      <button onclick="EvalMod.logout()">Salir</button>
    `;
  },

  logout() {
    this.usuarioActual = null;
    sessionStorage.removeItem('eval_usuario');
    this.renderLogin();
    document.getElementById('topbar-nav').innerHTML = '';
    document.getElementById('topbar-user').innerHTML = '';
  },

  /* ── BANDEJA ──────────────────────────────────────────── */
  async mostrarBandeja(filtro='pendiente') {
    if (!this.usuarioActual) { this.renderLogin(); return; }
    this.renderTopbar('evaluaciones');
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando…</div>';

    const u = this.usuarioActual;
    const esGH = u.rol === 'gh' || u.rol === 'gerencia';

    // Cargar evaluaciones
    let q = sb.from('evaluaciones').select(`
      id, estado, cargo_nombre, evaluador_nombre,
      fecha_limite, concepto_prueba, indice_ajuste, clasificacion,
      orden_contratacion_num, created_at, updated_at,
      colaborador:colaborador_id (nombres, numero_id, empresa, sede_nombre, fecha_ingreso, periodo_prueba_dias),
      trabajador:trabajador_id (nombre, cedula, empresa, ciudad, fecha_ingreso, periodo_prueba_dias),
      ciclo:ciclo_id (tipo, nombre)
    `).order('created_at', { ascending: false });

    if (u.rol === 'lider' || u.rol === 'gerencia') q = q.eq('evaluador_nombre', u.nombre);

    const { data: evals } = await q;
    const todos = (evals || []).map(e => {
      // Normalizar: si viene de trabajador_id, unificar estructura
      const colab = e.colaborador || (e.trabajador ? {
        nombres:          e.trabajador.nombre,
        numero_id:        e.trabajador.cedula,
        empresa:          e.trabajador.empresa,
        sede_nombre:      e.trabajador.ciudad,
        fecha_ingreso:    e.trabajador.fecha_ingreso,
        periodo_prueba_dias: e.trabajador.periodo_prueba_dias
      } : null);
      return { ...e, _colab: colab };
    });

    // Calcular días restantes para cada evaluación
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const conDias = todos.map(e => {
      const colab = e._colab;
      let dias = null;
      if (colab?.fecha_ingreso && colab?.periodo_prueba_dias && e.ciclo?.tipo === 'PRUEBA') {
        const venc = new Date(colab.fecha_ingreso);
        venc.setDate(venc.getDate() + colab.periodo_prueba_dias - 1);
        dias = Math.ceil((venc - hoy) / 86400000);
      } else if (e.fecha_limite) {
        const lim = new Date(e.fecha_limite + 'T00:00:00');
        dias = Math.ceil((lim - hoy) / 86400000);
      }
      return { ...e, _dias: dias };
    });

    // Filtros
    const pendientes  = conDias.filter(e => ['pendiente','en_diligenciamiento'].includes(e.estado));
    const enviadas    = conDias.filter(e => ['enviada_gh','socializada','firmada'].includes(e.estado));
    const devueltas   = conDias.filter(e => e.estado === 'devuelta');
    const vencidas    = conDias.filter(e => e.estado === 'vencida');
    const planes      = conDias.filter(e => ['socializada','firmada','cerrada'].includes(e.estado));

    const grupos = { pendiente: pendientes, enviada: enviadas, devuelta: devueltas, vencida: vencidas, planes };
    const activos = filtro === 'planes' ? planes :
                    filtro === 'enviada' ? enviadas :
                    filtro === 'devuelta' ? [...devueltas, ...vencidas] :
                    pendientes;

    // KPIs resumen
    const pruebaProximas = conDias.filter(e =>
      e.ciclo?.tipo === 'PRUEBA' && e._dias !== null && e._dias <= 15 &&
      !['cerrada','anulada'].includes(e.estado)
    );
    const masCercano = pruebaProximas.sort((a,b) => a._dias - b._dias)[0];

    // Ciclo desempeño activo
    const { data: cicloActivo } = await sb.from('ciclos_evaluacion')
      .select('*').eq('tipo','DESEMPENO').eq('estado','en_curso').limit(1);
    const ciclo = cicloActivo?.[0];
    const totalCiclo = ciclo ? conDias.filter(e => e.ciclo?.nombre === ciclo.nombre).length : 0;
    const enviadasCiclo = ciclo ? conDias.filter(e =>
      e.ciclo?.nombre === ciclo.nombre && ['enviada_gh','socializada','firmada','cerrada'].includes(e.estado)
    ).length : 0;
    const pct = totalCiclo ? Math.round(enviadasCiclo / totalCiclo * 100) : 0;

    // Planes con seguimiento este mes
    const { data: planesMes } = await sb.from('planes_mejora')
      .select('id, estado, fecha_seguimiento')
      .gte('fecha_seguimiento', new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0])
      .lte('fecha_seguimiento', new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).toISOString().split('T')[0]);
    const planesMesTotal = planesMes?.length || 0;
    const planesVencidos = (planesMes||[]).filter(p => p.estado === 'vencido' || (p.fecha_seguimiento < hoy.toISOString().split('T')[0] && p.estado === 'pendiente')).length;

    // Tabla
    const filas = activos.map(e => {
      const tipo = e.ciclo?.tipo === 'PRUEBA' ? 'Periodo de prueba' : (e.ciclo?.nombre || 'Desempeño');
      const dl   = diasLabel(e._dias);
      const colab = e._colab;
      return `
        <tr>
          <td class="col-colaborador">
            <strong>${esc(colab?.nombres || colab?.nombre || '—')}</strong>
            <small>${esc(colab?.numero_id || colab?.cedula || '')}${colab?.sede_nombre || colab?.ciudad ? ' · ' + esc(colab?.sede_nombre || colab?.ciudad) : ''}</small>
          </td>
          <td>${esc(e.cargo_nombre)}</td>
          <td>${esc(tipo)}</td>
          <td class="${dl.cls}">${dl.html}</td>
          <td>${estadoBadge(e.estado)}</td>
          <td>${btnAccion(e.estado, e.id, esGH)}</td>
        </tr>
      `;
    }).join('');

    const tabFiltro = (key, label, count) => `
      <button class="filtro-tab ${filtro===key?'active':''}"
        onclick="EvalMod.mostrarBandeja('${key}')">
        ${label}${count ? ` (${count})` : ''}
      </button>
    `;

    c.innerHTML = `
      <div class="main">
        <div class="bandeja-header">
          <div>
            <h1>Mis evaluaciones</h1>
            <p>Califica a tu equipo antes de la fecha límite. Las vencidas se reportan a Gestión Humana.</p>
          </div>
          <div class="filtros-tabs">
            ${tabFiltro('pendiente',  'Pendientes',    pendientes.length + devueltas.length + vencidas.length)}
            ${tabFiltro('enviada',    'Enviadas',       enviadas.length)}
            ${tabFiltro('planes',     'Planes de mejora', '')}
          </div>
        </div>

        <div class="resumen-grid">
          <div class="resumen-card">
            <div class="resumen-label">${ciclo ? ciclo.nombre : 'Sin ciclo activo'}</div>
            <div class="resumen-num">${enviadasCiclo} de ${totalCiclo}</div>
            <div class="resumen-progress"><div class="resumen-progress-bar" style="width:${pct}%"></div></div>
            <div class="resumen-sub">Fecha límite: ${ciclo ? fmtDate(ciclo.fecha_limite) : '—'}</div>
          </div>
          <div class="resumen-card ${pruebaProximas.length > 0 ? 'warn' : ''}">
            <div class="resumen-label">Periodos de prueba por vencer</div>
            <div class="resumen-num ${pruebaProximas.length > 0 ? 'warn' : ''}">${pruebaProximas.length}</div>
            <div class="resumen-sub">
              ${masCercano
                ? `El más próximo vence en <strong>${masCercano._dias} días</strong>. Debes entregar el concepto ${this.parametros.dias_limite_lider_prueba || 10} días antes.`
                : 'Sin periodos de prueba próximos.'}
            </div>
          </div>
          <div class="resumen-card">
            <div class="resumen-label">Planes de mejora con seguimiento este mes</div>
            <div class="resumen-num">${planesMesTotal}</div>
            <div class="resumen-sub">${planesVencidos > 0 ? `${planesVencidos} compromiso${planesVencidos>1?'s':''} vencido${planesVencidos>1?'s':''} sin seguimiento.` : 'Sin compromisos vencidos.'}</div>
          </div>
        </div>

        <div class="eval-table-wrap">
          <table class="eval-table">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Cargo</th>
                <th>Tipo</th>
                <th>Fecha límite</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${activos.length === 0
                ? `<tr><td colspan="6" class="empty-state">No hay evaluaciones en esta sección.</td></tr>`
                : filas}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* ── PERIODOS DE PRUEBA (vista GH) ───────────────────── */
  async mostrarPeriodosPrueba() {
    this.renderTopbar('periodos');
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb.from('v_periodos_prueba')
      .select('*').order('dias_restantes', { ascending: true });
    if (error) { c.innerHTML = `<p class="text-danger">${error.message}</p>`; return; }

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const filas = (data||[]).map(p => {
      const dl = diasLabel(p.dias_restantes);
      return `
        <tr>
          <td class="col-colaborador">
            <strong>${esc(p.colaborador)}</strong>
            <small>${esc(p.cedula)} · ${esc(p.empresa)}</small>
          </td>
          <td>${esc(p.cargo)}</td>
          <td>${esc(p.lider)}</td>
          <td class="${dl.cls}">${dl.html}</td>
          <td>${estadoBadge(p.estado)}</td>
          <td>${p.concepto_prueba
            ? (p.concepto_prueba==='CONTINUA'
              ? '<span class="badge badge-success">Continúa</span>'
              : '<span class="badge badge-danger">No continúa</span>')
            : '—'}</td>
          <td>${btnAccion(p.estado, p.evaluacion_id, true)}</td>
        </tr>
      `;
    }).join('');

    c.innerHTML = `
      <div class="main">
        <div class="bandeja-header">
          <div><h1>Periodos de prueba</h1><p>Seguimiento a todas las evaluaciones de periodo de prueba activas.</p></div>
        </div>
        <div class="eval-table-wrap">
          <table class="eval-table">
            <thead><tr>
              <th>Colaborador</th><th>Cargo</th><th>Líder</th>
              <th>Vencimiento</th><th>Estado</th><th>Concepto</th><th></th>
            </tr></thead>
            <tbody>${filas || '<tr><td colspan="7" class="empty-state">Sin periodos de prueba activos.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  /* ── FORMULARIO PASO A PASO ───────────────────────────── */
  async abrirFormulario(evalId) {
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: ev, error } = await sb.from('evaluaciones')
      .select('*, colaborador:colaborador_id(*), trabajador:trabajador_id(*), ciclo:ciclo_id(*)')
      .eq('id', evalId).single();
    if (error) { c.innerHTML = `<p class="text-danger">${error.message}</p>`; return; }

    // Normalizar colaborador desde cualquiera de las dos fuentes
    if (!ev.colaborador && ev.trabajador) {
      ev.colaborador = {
        nombres:             ev.trabajador.nombre,
        numero_id:           ev.trabajador.cedula,
        empresa:             ev.trabajador.empresa,
        sede_nombre:         ev.trabajador.ciudad,
        fecha_ingreso:       ev.trabajador.fecha_ingreso,
        periodo_prueba_dias: ev.trabajador.periodo_prueba_dias
      };
    }

    const { data: detalle } = await sb.from('evaluacion_detalle')
      .select('*, competencia:competencia_id(codigo, nombre, tipo, definicion)')
      .eq('evaluacion_id', evalId).order('codigo');

    const compIds = (detalle||[]).map(d => d.competencia_id);
    let gradosMap = {};
    if (compIds.length > 0) {
      const { data: grados } = await sb.from('competencia_grados')
        .select('*').in('competencia_id', compIds).order('puntaje', { ascending: false });
      (grados||[]).forEach(g => {
        if (!gradosMap[g.competencia_id]) gradosMap[g.competencia_id] = {};
        gradosMap[g.competencia_id][g.grado] = g.conducta;
      });
    }

    const { data: planes } = await sb.from('planes_mejora')
      .select('*').eq('evaluacion_id', evalId);

    this.evaluacionActiva = ev;
    this.detalleCache     = detalle || [];
    this.planesCache      = planes  || [];
    this.gradosMapCache   = gradosMap;
    this.compActual       = 0;

    const u = this.usuarioActual;
    const esEvaluador = !u || u.rol==='gh' ||
      ev.evaluador_nombre?.toLowerCase() === u.nombre?.toLowerCase();
    const editable = ['pendiente','en_diligenciamiento','devuelta'].includes(ev.estado) && esEvaluador;

    this._evalId   = evalId;
    this._editable = editable;

    if (editable && this.detalleCache.length > 0) {
      // Ir a la primera competencia sin calificar, o la primera si todas ya tienen
      const primeraSinCal = this.detalleCache.findIndex(d => !d.grado_observado);
      this.compActual = primeraSinCal >= 0 ? primeraSinCal : 0;
      this.renderCompetencia();
    } else {
      // Vista de solo lectura — mostrar resumen
      this.renderResumenFormulario();
    }
  },

  renderCompetencia() {
    const c = document.getElementById('app-contenido');
    const ev = this.evaluacionActiva;
    const detalle = this.detalleCache;
    const d = detalle[this.compActual];
    const grados = this.gradosMapCache[d.competencia_id] || {};
    const total = detalle.length;
    const idx   = this.compActual;
    const esPrueba = ev.ciclo?.tipo === 'PRUEBA';
    const bajoPerfil = d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido];
    const evidReq    = d.grado_observado && (d.grado_observado === 'D' || bajoPerfil);

    // Es última competencia → mostrar botón "Revisar y enviar"
    const esUltima = idx === total - 1;

    c.innerHTML = `
      <div style="max-width:540px;margin:0 auto;background:#fff;min-height:100vh;display:flex;flex-direction:column;">
        <!-- Topbar formulario -->
        <div class="form-topbar">
          <button class="form-topbar-back" onclick="EvalMod.mostrarBandeja()">‹ Bandeja</button>
          <span class="form-topbar-auto" id="autosave-label">Guardado automático</span>
        </div>

        <!-- Cabecera colaborador -->
        <div class="form-collab-header">
          <h2>${esc(ev.colaborador?.nombres || '—')}</h2>
          <p>${esc(ev.cargo_nombre)} · ${esPrueba ? 'Periodo de prueba' : esc(ev.ciclo?.nombre || 'Desempeño')}</p>
          <div class="form-progress-bar">
            <div class="form-progress-fill" style="width:${Math.round((idx+1)/total*100)}%"></div>
          </div>
          <div class="form-progress-label">${idx+1} de ${total}</div>
        </div>

        <!-- Cuerpo competencia -->
        <div class="form-comp-body" id="comp-body">
          <div class="form-comp-codigo">${esc(d.codigo)} · ${esc(d.competencia?.tipo || '')}</div>
          <div class="form-comp-nombre">${esc(d.nombre_comp)}</div>
          ${d.competencia?.definicion
            ? `<div class="form-comp-definicion">${esc(d.competencia.definicion)}</div>`
            : ''}
          <div class="form-comp-pregunta">¿Qué conducta describe mejor lo que has observado?</div>

          <div class="opcion-lista" id="opciones-lista">
            ${['A','B','C','D'].map(g => `
              <label class="opcion-item ${d.grado_observado===g?'sel':''}" id="opcion-${g}">
                <input type="radio" name="grado_comp" value="${g}"
                  ${d.grado_observado===g?'checked':''}
                  onchange="EvalMod.seleccionarGrado('${d.id}', '${this._evalId}', '${g}', ${PUNTAJE[d.grado_exigido]})" />
                <div class="opcion-letra">${g}</div>
                <div class="opcion-texto">
                  <strong>${GRADO_NOMBRE[g]}</strong>
                  <span>${esc(grados[g]||'')}</span>
                </div>
              </label>
            `).join('')}
          </div>

          <div id="evidencia-wrap" style="display:${evidReq||d.evidencia?'block':'none'}">
            <div class="form-evidencia">
              <label>Evidencia concreta <span style="color:#dc2626">*</span>
                <small style="font-weight:400;color:#92400e"> — mínimo 30 caracteres</small>
              </label>
              <textarea id="evidencia-input" rows="3"
                placeholder="Describe lo que observaste concretamente…">${esc(d.evidencia||'')}</textarea>
            </div>
          </div>

          <div class="form-hint">
            El grado exigido para el cargo se muestra al enviar, para que califiques lo observado y no lo esperado.
          </div>
        </div>

        <!-- Navegación -->
        <div class="form-nav">
          <button class="btn-nav" onclick="EvalMod.navComp(-1)" ${idx===0?'disabled':''}>Anterior</button>
          ${esUltima
            ? `<button class="btn-nav primario" onclick="EvalMod.irARevisionEnvio()">Revisar y enviar</button>`
            : `<button class="btn-nav primario" onclick="EvalMod.navComp(1)">Siguiente</button>`}
        </div>
      </div>
    `;
  },

  async seleccionarGrado(detalleId, evalId, grado, puntajeExigido) {
    // Marcar visualmente
    document.querySelectorAll('.opcion-item').forEach(el => el.classList.remove('sel'));
    document.getElementById(`opcion-${grado}`)?.classList.add('sel');

    const puntaje    = PUNTAJE[grado];
    const bajoPerfil = puntaje < puntajeExigido;
    const evidWrap   = document.getElementById('evidencia-wrap');
    if (evidWrap) evidWrap.style.display = (grado==='D'||bajoPerfil) ? 'block' : 'none';

    // Actualizar cache local
    const d = this.detalleCache.find(x => x.id === detalleId);
    if (d) { d.grado_observado = grado; d.puntaje_observado = puntaje; }

    // Guardar en BD
    document.getElementById('autosave-label').textContent = 'Guardando…';
    await sb.from('evaluacion_detalle')
      .update({ grado_observado: grado, puntaje_observado: puntaje })
      .eq('id', detalleId);
    await sb.from('evaluaciones')
      .update({ estado: 'en_diligenciamiento', updated_at: new Date().toISOString() })
      .eq('id', evalId).eq('estado', 'pendiente');
    document.getElementById('autosave-label').textContent = 'Guardado automático ✓';
  },

  async navComp(dir) {
    // Guardar evidencia del campo actual antes de navegar
    const d = this.detalleCache[this.compActual];
    const evidInput = document.getElementById('evidencia-input');
    if (evidInput && d) {
      const val = evidInput.value.trim();
      if (val !== (d.evidencia||'')) {
        await sb.from('evaluacion_detalle').update({ evidencia: val }).eq('id', d.id);
        d.evidencia = val;
      }
    }
    this.compActual = Math.max(0, Math.min(this.detalleCache.length - 1, this.compActual + dir));
    this.renderCompetencia();
  },

  /* ── REVISIÓN ANTES DE ENVIAR ─────────────────────────── */
  async irARevisionEnvio() {
    // Guardar evidencia de la última competencia
    const d = this.detalleCache[this.compActual];
    const evidInput = document.getElementById('evidencia-input');
    if (evidInput && d) {
      const val = evidInput.value.trim();
      if (val !== (d.evidencia||'')) {
        await sb.from('evaluacion_detalle').update({ evidencia: val }).eq('id', d.id);
        d.evidencia = val;
      }
    }
    this.renderResumenFormulario();
  },

  renderResumenFormulario() {
    const c   = document.getElementById('app-contenido');
    const ev  = this.evaluacionActiva;
    const det = this.detalleCache;
    const esPrueba = ev.ciclo?.tipo === 'PRUEBA';
    const editable = this._editable;

    const brechas    = det.filter(d => d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);
    const sinCal     = det.filter(d => !d.grado_observado);
    const calificadas = det.filter(d => d.grado_observado);

    // Calcular índice provisional
    let sumMin = 0, sumEx = 0;
    calificadas.forEach(d => {
      sumEx  += PUNTAJE[d.grado_exigido];
      sumMin += Math.min(PUNTAJE[d.grado_observado], PUNTAJE[d.grado_exigido]);
    });
    const indiceProvisional = sumEx > 0 ? Math.round(sumMin / sumEx * 100 * 10) / 10 : null;

    const filaComp = det.map(d => `
      <tr>
        <td class="td-comp-nombre"><small>${esc(d.codigo)}</small> ${esc(d.nombre_comp)}</td>
        <td class="td-grado">${d.grado_exigido}</td>
        <td class="td-grado">${d.grado_observado||'<span style="color:#dc2626">—</span>'}</td>
        <td>${!d.grado_observado
          ? '<span class="badge badge-vencida">Sin calificar</span>'
          : PUNTAJE[d.grado_observado] > PUNTAJE[d.grado_exigido]
            ? '<span class="badge badge-info">Fortaleza</span>'
            : PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]
              ? '<span class="badge badge-brecha">Brecha</span>'
              : '<span class="badge badge-cumple">Cumple</span>'}</td>
      </tr>
    `).join('');

    const planFila = brechas.map(b => {
      const p = this.planesCache.find(pl => pl.competencia_id === b.competencia_id) || {};
      return `
        <div class="plan-fila">
          <div class="plan-fila-header">
            <span class="badge badge-brecha">Brecha ${b.brecha_grados||PUNTAJE[b.grado_exigido]-PUNTAJE[b.grado_observado]}g</span>
            ${esc(b.nombre_comp)}
          </div>
          <div class="plan-campos">
            <div class="plan-campo">
              <label>Acción concreta *</label>
              <input type="text" class="form-control" id="p-accion-${b.competencia_id}"
                value="${esc(p.accion||'')}" placeholder="Ej: Capacitación en servicio al cliente" ${!editable?'readonly':''}/>
            </div>
            <div class="plan-campo">
              <label>Responsable</label>
              <input type="text" class="form-control" id="p-resp-${b.competencia_id}"
                value="${esc(p.responsable_nombre||'')}" placeholder="Nombre" ${!editable?'readonly':''}/>
            </div>
            <div class="plan-campo">
              <label>Fecha compromiso *</label>
              <input type="date" class="form-control" id="p-fecha-${b.competencia_id}"
                value="${p.fecha_compromiso||''}" ${!editable?'readonly':''}/>
            </div>
            <div class="plan-campo">
              <label>Fecha seguimiento</label>
              <input type="date" class="form-control" id="p-seg-${b.competencia_id}"
                value="${p.fecha_seguimiento||''}" ${!editable?'readonly':''}/>
            </div>
          </div>
        </div>
      `;
    }).join('');

    c.innerHTML = `
      <div style="max-width:540px;margin:0 auto;background:#fff;min-height:100vh;">
        <div class="form-topbar">
          <button class="form-topbar-back" onclick="EvalMod.compActual=${this.detalleCache.length-1};EvalMod.renderCompetencia()">‹ Volver</button>
          <span class="form-topbar-auto"></span>
        </div>
        <div class="form-collab-header">
          <h2>${esc(ev.colaborador?.nombres||'—')}</h2>
          <p>${esc(ev.cargo_nombre)} · ${esPrueba?'Periodo de prueba':esc(ev.ciclo?.nombre||'')}</p>
        </div>
        <div style="padding:1.25rem;">

          ${sinCal.length>0 ? `
            <div class="alert alert-danger">
              Faltan <strong>${sinCal.length}</strong> competencia(s) por calificar:
              ${sinCal.map(d=>`<br>· ${d.codigo} ${d.nombre_comp}`).join('')}
            </div>` : ''}

          ${ev.observacion_devolucion ? `
            <div class="alert alert-warn">
              <strong>GH devolvió:</strong> ${esc(ev.observacion_devolucion)}
            </div>` : ''}

          <!-- Resumen índice provisional -->
          ${indiceProvisional !== null && sinCal.length === 0 ? `
            <div style="background:#f0f4ff;border-radius:10px;padding:1rem;margin-bottom:1rem;display:flex;align-items:center;gap:1rem;">
              <div style="font-size:2rem;font-weight:800;color:#1d3a6e;">${indiceProvisional}%</div>
              <div>
                <div style="font-size:.78rem;color:#64748b;">Índice provisional</div>
                <div style="font-size:.84rem;font-weight:700;">${brechas.length} brecha(s) · ${det.filter(d=>d.grado_observado&&PUNTAJE[d.grado_observado]>PUNTAJE[d.grado_exigido]).length} fortaleza(s)</div>
              </div>
            </div>` : ''}

          <!-- Tabla competencias -->
          <div class="revision-tabla-wrap" style="margin-bottom:1.25rem;">
            <table class="revision-tabla">
              <thead><tr><th>Competencia</th><th>Exigido</th><th>Observado</th><th>Resultado</th></tr></thead>
              <tbody>${filaComp}</tbody>
            </table>
          </div>

          ${esPrueba && editable ? `
            <div style="margin-bottom:1rem;">
              <div style="font-size:.88rem;font-weight:700;margin-bottom:.5rem;">Concepto del periodo de prueba *</div>
              <div class="concepto-wrap">
                <button type="button" class="concepto-btn ${ev.concepto_prueba==='CONTINUA'?'sel-continua':''}"
                  onclick="EvalMod.selConcepto('CONTINUA',this)">✅ Continúa</button>
                <button type="button" class="concepto-btn ${ev.concepto_prueba==='NO_CONTINUA'?'sel-nocontinua':''}"
                  onclick="EvalMod.selConcepto('NO_CONTINUA',this)">❌ No continúa</button>
              </div>
              <div id="alerta-no-continua" style="display:${ev.concepto_prueba==='NO_CONTINUA'?'block':'none'}">
                <div class="alert alert-danger">Esta decisión activa una alerta inmediata a Gestión Humana.</div>
              </div>
            </div>` : esPrueba && ev.concepto_prueba ? `
            <div style="margin-bottom:1rem;">
              <div style="font-size:.88rem;font-weight:700;margin-bottom:.4rem;">Concepto:</div>
              ${ev.concepto_prueba==='CONTINUA'
                ? '<span class="badge badge-success" style="font-size:.88rem">✅ Continúa</span>'
                : '<span class="badge badge-danger" style="font-size:.88rem">❌ No continúa</span>'}
            </div>` : ''}

          <!-- Observaciones generales -->
          <div style="margin-bottom:1rem;">
            <div style="font-size:.88rem;font-weight:700;margin-bottom:.4rem;">Observaciones generales</div>
            <textarea id="obs-generales" rows="3" class="form-control"
              ${!editable?'readonly':''}
              placeholder="Observaciones del evaluador…">${esc(ev.observaciones_generales||'')}</textarea>
          </div>

          <!-- Planes de mejora -->
          ${brechas.length > 0 ? `
            <div style="margin-bottom:1rem;">
              <div style="font-size:.88rem;font-weight:700;margin-bottom:.5rem;">Plan de mejora</div>
              <div style="font-size:.8rem;color:#64748b;margin-bottom:.75rem;">Obligatorio para cada brecha.</div>
              ${planFila}
            </div>` : ''}

          ${editable ? `
            <div style="display:flex;gap:.75rem;padding:.75rem 0;">
              <button class="btn-nav" style="flex:1;padding:.75rem;border-radius:10px;font-size:.88rem;font-weight:600;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#1a2332;"
                onclick="EvalMod.guardarBorrador()">Guardar borrador</button>
              <button class="btn-nav primario" style="flex:1;padding:.75rem;border-radius:10px;font-size:.88rem;font-weight:700;cursor:pointer;border:none;background:#1a2332;color:#fff;"
                onclick="EvalMod.enviarEvaluacion()">Enviar a GH</button>
            </div>` : ''}

          ${ev.estado==='socializada' ? `
            <div style="margin-top:1rem;">
              <div style="font-size:.88rem;font-weight:700;margin-bottom:.5rem;">¿Estás de acuerdo con tu evaluación?</div>
              <div class="firma-opciones">
                <button class="firma-btn" id="firma-si" onclick="EvalMod.selFirma(true,this)">Sí, estoy de acuerdo</button>
                <button class="firma-btn peligro" id="firma-no" onclick="EvalMod.selFirma(false,this)">No estoy de acuerdo</button>
              </div>
              <textarea id="firma-comentario" rows="2" class="form-control"
                placeholder="Comentario o motivo de desacuerdo (opcional)" style="display:none;margin-bottom:.5rem;"></textarea>
              <button class="btn-firmar" id="btn-firmar" onclick="EvalMod.firmarColaborador('${this._evalId}')">
                Firmar enterado
              </button>
              <div class="firma-disclaimer">Firmar significa que conoces el resultado, no que estés de acuerdo.</div>
            </div>` : ''}
        </div>
      </div>
    `;
  },

  selConcepto(val, btn) {
    document.querySelectorAll('.concepto-btn').forEach(b => { b.classList.remove('sel-continua','sel-nocontinua'); });
    btn.classList.add(val==='CONTINUA'?'sel-continua':'sel-nocontinua');
    if (this.evaluacionActiva) this.evaluacionActiva.concepto_prueba = val;
    const alerta = document.getElementById('alerta-no-continua');
    if (alerta) alerta.style.display = val==='NO_CONTINUA'?'block':'none';
  },

  selFirma(acepta, btn) {
    document.querySelectorAll('.firma-btn').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    this._firmaAcepta = acepta;
    const com = document.getElementById('firma-comentario');
    if (com) com.style.display = !acepta ? 'block' : 'none';
    const btnF = document.getElementById('btn-firmar');
    if (btnF) btnF.classList.add('activo');
  },

  /* ── GUARDAR BORRADOR ─────────────────────────────────── */
  async guardarBorrador() {
    const obs     = document.getElementById('obs-generales')?.value || '';
    const concepto = this.evaluacionActiva?.concepto_prueba;
    const upd = { observaciones_generales: obs, updated_at: new Date().toISOString() };
    if (concepto) upd.concepto_prueba = concepto;
    await sb.from('evaluaciones').update(upd).eq('id', this._evalId);
    await this._guardarPlanesDesdeUI();
    toast('Borrador guardado ✓');
  },

  async _guardarPlanesDesdeUI() {
    const brechas = this.detalleCache.filter(d =>
      d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);
    for (const b of brechas) {
      const accion = document.getElementById(`p-accion-${b.competencia_id}`)?.value||'';
      const resp   = document.getElementById(`p-resp-${b.competencia_id}`)?.value||'';
      const fecha  = document.getElementById(`p-fecha-${b.competencia_id}`)?.value||null;
      const seg    = document.getElementById(`p-seg-${b.competencia_id}`)?.value||null;
      if (!accion) continue;
      const existing = this.planesCache.find(p => p.competencia_id === b.competencia_id);
      if (existing) {
        await sb.from('planes_mejora').update({
          accion, responsable_nombre: resp,
          fecha_compromiso: fecha, fecha_seguimiento: seg, updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        const { data: np } = await sb.from('planes_mejora').insert({
          evaluacion_id: this._evalId, competencia_id: b.competencia_id,
          codigo_competencia: b.codigo, nombre_competencia: b.nombre_comp,
          accion, responsable_nombre: resp,
          fecha_compromiso: fecha, fecha_seguimiento: seg
        }).select().single();
        if (np) this.planesCache.push(np);
      }
    }
  },

  /* ── ENVIAR A GH ──────────────────────────────────────── */
  async enviarEvaluacion() {
    const ev      = this.evaluacionActiva;
    const det     = this.detalleCache;
    const esPrueba = ev.ciclo?.tipo === 'PRUEBA';
    const errores = [];
    const minChars = parseInt(this.parametros.evidencia_min_chars||'30');
    const obsMin   = parseInt(this.parametros.obs_no_continua_min_chars||'100');

    const sinCal = det.filter(d => !d.grado_observado);
    if (sinCal.length > 0)
      errores.push(`Faltan ${sinCal.length} competencia(s) sin calificar: ${sinCal.map(d=>d.codigo).join(', ')}`);

    det.forEach(d => {
      if (!d.grado_observado) return;
      if (d.grado_observado === 'D' || PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]) {
        const ev2 = document.getElementById(`p-accion-${d.competencia_id}`) ? '' :
          (d.evidencia||'').trim();
        const evActual = d.evidencia||'';
        if (evActual.trim().length < minChars)
          errores.push(`Evidencia insuficiente en "${d.nombre_comp}" (mín. ${minChars} caracteres)`);
      }
    });

    const concepto = ev.concepto_prueba;
    if (esPrueba && !concepto)
      errores.push('Selecciona el concepto: Continúa o No continúa');

    const obs = (document.getElementById('obs-generales')?.value||'').trim();
    if (esPrueba && concepto === 'NO_CONTINUA' && obs.length < obsMin)
      errores.push(`Observaciones deben tener al menos ${obsMin} caracteres cuando el concepto es "No continúa"`);

    const brechas = det.filter(d => d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);
    brechas.forEach(b => {
      const accion = document.getElementById(`p-accion-${b.competencia_id}`)?.value||'';
      const fecha  = document.getElementById(`p-fecha-${b.competencia_id}`)?.value||'';
      if (!accion||!fecha)
        errores.push(`Plan de mejora incompleto para "${b.nombre_comp}"`);
    });

    if (errores.length > 0) {
      const existing = document.getElementById('errores-envio');
      if (existing) existing.remove();
      const div = document.createElement('div');
      div.id = 'errores-envio';
      div.className = 'alert alert-danger';
      div.style.cssText = 'position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);max-width:480px;width:90vw;z-index:999;';
      div.innerHTML = `<strong>Corrige antes de enviar:</strong><ul>${errores.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 6000);
      return;
    }

    await this._guardarPlanesDesdeUI();
    await sb.rpc('fn_calcular_indice', { p_evaluacion_id: this._evalId });
    const updEval = {
      estado: 'enviada_gh', observaciones_generales: obs,
      fecha_envio: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    if (concepto) updEval.concepto_prueba = concepto;
    await sb.from('evaluaciones').update(updEval).eq('id', this._evalId);
    await sb.from('auditoria_evaluacion').insert({
      tabla:'evaluaciones', registro_id: this._evalId,
      accion:'cambio_estado', valor_anterior: ev.estado, valor_nuevo:'enviada_gh',
      usuario_nombre: this.usuarioActual?.nombre || 'líder'
    });
    toast('Evaluación enviada a Gestión Humana ✓');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  /* ── REVISIÓN GH ──────────────────────────────────────── */
  async abrirRevisionGH(evalId) {
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: ev } = await sb.from('evaluaciones')
      .select('*, colaborador:colaborador_id(*), trabajador:trabajador_id(*), ciclo:ciclo_id(*)')
      .eq('id', evalId).single();

    if (!ev.colaborador && ev.trabajador) {
      ev.colaborador = {
        nombres:   ev.trabajador.nombre,
        numero_id: ev.trabajador.cedula,
        empresa:   ev.trabajador.empresa
      };
    }

    const { data: det } = await sb.from('evaluacion_detalle')
      .select('*, competencia:competencia_id(codigo, nombre, tipo)')
      .eq('evaluacion_id', evalId).order('codigo');

    const { data: planes } = await sb.from('planes_mejora')
      .select('*').eq('evaluacion_id', evalId);

    // Buscar autoevaluación
    let autoMap = {};
    if (ev?.ciclo?.incluye_autoevaluacion) {
      const { data: ae } = await sb.from('evaluaciones')
        .select('id').eq('colaborador_id', ev.colaborador_id)
        .eq('ciclo_id', ev.ciclo_id).eq('rol_evaluador','AUTO').single();
      if (ae) {
        const { data: aeDet } = await sb.from('evaluacion_detalle')
          .select('competencia_id, grado_observado').eq('evaluacion_id', ae.id);
        (aeDet||[]).forEach(x => { autoMap[x.competencia_id] = x.grado_observado; });
      }
    }

    this._evalId = evalId;
    const brechas    = (det||[]).filter(d => d.grado_observado && PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]);
    const fortalezas = (det||[]).filter(d => d.grado_observado && PUNTAJE[d.grado_observado] > PUNTAJE[d.grado_exigido]);
    const alertasDif = (det||[]).filter(d => {
      const ag = autoMap[d.competencia_id];
      return ag && d.grado_observado && Math.abs(PUNTAJE[d.grado_observado] - PUNTAJE[ag]) >= 2;
    });

    const filas = (det||[]).map(d => {
      const ag   = autoMap[d.competencia_id];
      const diff = ag && d.grado_observado && Math.abs(PUNTAJE[d.grado_observado] - PUNTAJE[ag]) >= 2;
      return `
        <tr>
          <td class="td-comp-nombre"><small>${esc(d.codigo)}</small> ${esc(d.nombre_comp)}</td>
          <td class="td-grado">${d.grado_exigido}</td>
          <td class="td-grado">${d.grado_observado||'—'}</td>
          <td class="td-grado">${ag ? (diff ? `<span class="td-auto-warn">${ag}</span>` : ag) : '—'}</td>
          <td>${!d.grado_observado ? '—'
            : PUNTAJE[d.grado_observado] > PUNTAJE[d.grado_exigido]
              ? '<span class="badge badge-fortaleza">Fortaleza</span>'
              : PUNTAJE[d.grado_observado] < PUNTAJE[d.grado_exigido]
                ? '<span class="badge badge-brecha">Brecha</span>'
                : '<span class="badge badge-cumple">Cumple</span>'}</td>
        </tr>
      `;
    }).join('');

    const planItems = (planes||[]).map(p => `
      <div class="plan-item">
        <strong>${esc(p.nombre_competencia)}</strong>
        <span>${esc(p.accion)} · Responsable: ${esc(p.responsable_nombre||'—')}</span>
        <span>Seguimiento: ${p.fecha_seguimiento ? fmtDate(p.fecha_seguimiento) : 'en el siguiente ciclo'}</span>
      </div>
    `).join('');

    c.innerHTML = `
      <div class="main">
        <div class="revision-header">
          <div class="breadcrumb">${esc(ev.ciclo?.nombre||'')} · Enviada por ${esc(ev.evaluador_nombre||'')}</div>
          <h1>${esc(ev.colaborador?.nombres||'—')} · ${esc(ev.cargo_nombre)}</h1>
        </div>

        <div class="revision-layout">
          <!-- Columna izquierda -->
          <div>
            <div class="kpi-grid">
              <div class="kpi-card">
                <label>Índice de ajuste</label>
                <div class="kpi-num">${ev.indice_ajuste != null ? ev.indice_ajuste+'%' : '—'}</div>
                <div class="kpi-sub">${ev.indice_ajuste != null ? `${Math.round(ev.indice_ajuste/100 * this._sumEx(det))} de ${this._sumEx(det)} puntos` : ''}</div>
              </div>
              <div class="kpi-card">
                <label>Clasificación</label>
                <div class="kpi-clasif">${CLASIF_LABEL[ev.clasificacion]||'—'}</div>
              </div>
              <div class="kpi-card">
                <label>Brechas</label>
                <div class="kpi-num" style="color:#dc2626">${brechas.length}</div>
                <div class="kpi-sub">con plan de mejora</div>
              </div>
              <div class="kpi-card">
                <label>Fortalezas</label>
                <div class="kpi-num" style="color:#0369a1">${fortalezas.length}</div>
                <div class="kpi-sub">por encima de lo exigido</div>
              </div>
            </div>

            <div class="revision-tabla-wrap">
              <table class="revision-tabla">
                <thead><tr>
                  <th>Competencia</th><th>Exigido</th><th>Jefe</th><th>Auto</th><th>Resultado</th>
                </tr></thead>
                <tbody>${filas}</tbody>
              </table>
            </div>
          </div>

          <!-- Panel derecho -->
          <div class="revision-panel">
            ${alertasDif.length > 0 ? `
              <div class="panel-card alerta-revision">
                <h3>⚠ Revisar evidencias</h3>
                ${alertasDif.map(d => {
                  const ag = autoMap[d.competencia_id];
                  return `<p style="font-size:.82rem;margin-bottom:.4rem;">
                    <strong>${esc(d.codigo)} ${esc(d.nombre_comp)}</strong>: el jefe calificó ${d.grado_observado} y el colaborador se autoevaluó en ${ag}. Hay ${Math.abs(PUNTAJE[d.grado_observado]-PUNTAJE[ag])} grados de diferencia.
                  </p>`;
                }).join('')}
              </div>` : ''}

            ${planItems ? `
              <div class="panel-card">
                <h3>Plan de mejora propuesto por el líder</h3>
                ${planItems}
              </div>` : ''}

            <div class="panel-card">
              <h3>Observaciones del líder</h3>
              <p style="font-size:.84rem;color:#64748b;">${esc(ev.observaciones_generales||'Sin observaciones')}</p>
            </div>

            ${ev.estado === 'enviada_gh' ? `
              <div class="panel-card">
                <h3>Decisión de Gestión Humana</h3>
                <textarea class="obs-textarea" id="obs-gh"
                  placeholder="Obligatoria si la devuelves al líder"></textarea>
                <button class="btn-aprobar" onclick="EvalMod.aprobarEval('${evalId}')">
                  Aprobar y pasar a socialización
                </button>
                <button class="btn-devolver" onclick="EvalMod.devolverEval('${evalId}')">
                  Devolver al líder
                </button>
              </div>` : `
              <div class="panel-card">
                <p style="font-size:.84rem;color:#64748b;">Estado: ${estadoBadge(ev.estado)}</p>
                <button class="btn-accion secundario" style="width:100%;margin-top:.5rem"
                  onclick="EvalMod.mostrarBandeja()">← Volver a la bandeja</button>
              </div>`}
          </div>
        </div>
      </div>
    `;
  },

  _sumEx(det) {
    return (det||[]).reduce((s,d) => s + (PUNTAJE[d.grado_exigido]||0), 0);
  },

  async aprobarEval(evalId) {
    await sb.from('evaluaciones').update({ estado:'socializada', updated_at: new Date().toISOString() }).eq('id', evalId);
    await sb.from('evaluacion_firmas').insert({ evaluacion_id: evalId, rol:'GH', usuario_nombre:'Gestión Humana', aceptacion: true });
    await sb.from('auditoria_evaluacion').insert({ tabla:'evaluaciones', registro_id: evalId, accion:'cambio_estado', valor_anterior:'enviada_gh', valor_nuevo:'socializada', usuario_nombre: this.usuarioActual?.nombre||'GH' });
    toast('Evaluación aprobada y socializada ✓');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  async devolverEval(evalId) {
    const obs = (document.getElementById('obs-gh')?.value||'').trim();
    if (!obs) { toast('Escribe el motivo de devolución', 'warning'); return; }
    await sb.from('evaluaciones').update({ estado:'devuelta', observacion_devolucion: obs, updated_at: new Date().toISOString() }).eq('id', evalId);
    await sb.from('auditoria_evaluacion').insert({ tabla:'evaluaciones', registro_id: evalId, accion:'cambio_estado', valor_anterior:'enviada_gh', valor_nuevo:'devuelta', usuario_nombre: this.usuarioActual?.nombre||'GH' });
    toast('Evaluación devuelta al líder ✓');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  /* ── FIRMA COLABORADOR ────────────────────────────────── */
  async firmarColaborador(evalId) {
    if (this._firmaAcepta === undefined) { toast('Selecciona si estás de acuerdo o no', 'warning'); return; }
    const comentario = document.getElementById('firma-comentario')?.value||'';
    await sb.from('evaluacion_firmas').insert({ evaluacion_id: evalId, rol:'COLABORADOR', usuario_nombre: this.usuarioActual?.nombre||'Colaborador', aceptacion: this._firmaAcepta, comentario: comentario||null });
    await sb.from('evaluaciones').update({ estado:'firmada', updated_at: new Date().toISOString() }).eq('id', evalId);
    await sb.from('auditoria_evaluacion').insert({ tabla:'evaluaciones', registro_id: evalId, accion:'cambio_estado', valor_anterior:'socializada', valor_nuevo:'firmada', usuario_nombre: this.usuarioActual?.nombre||'colaborador' });
    toast('Evaluación firmada ✓');
    setTimeout(() => this.mostrarBandeja(), 1200);
  },

  /* ── PARÁMETROS ───────────────────────────────────────── */
  async guardarParametro(clave, valor) {
    await sb.from('parametros_evaluacion').update({ valor }).eq('clave', clave);
    this.parametros[clave] = valor;
    toast(`Parámetro "${clave}" actualizado ✓`);
  }
};

/* Hook de integración con contratación */
async function onOrdenAprobada(ordenId) {
  const { data, error } = await sb.rpc('fn_crear_evaluacion_prueba', { p_orden_id: ordenId });
  if (!error && data) console.log('✅ Evaluación de periodo de prueba creada:', data);
}
