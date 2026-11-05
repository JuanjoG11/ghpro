/* ============================================================
   GH PRO — Módulo de Contratación · Lógica de interfaz
   Requiere: supabase.js, contratacion-data.js, app.js
   ============================================================ */
'use strict';

/* ════════════════════════════════════════════════════════════
   LABELS Y OPCIONES
   ════════════════════════════════════════════════════════════ */
const LBL = {
  empresa:          { TYM: 'TYM – Tiendas y Marcas', TAT: 'TAT – TAT Distribuciones' },
  estado_req:       { pendiente:'Pendiente', aprobada:'Aprobada', rechazada:'Rechazada',
                      en_seleccion:'En selección', cubierta:'Cubierta', cancelada:'Cancelada' },
  estado_vr:        { borrador:'Borrador', cerrada:'Cerrada' },
  estado_oc:        { borrador:'Borrador', pendiente_aprobacion:'Pend. Aprobación',
                      aprobada:'Aprobada', rechazada:'Rechazada',
                      contrato_generado:'Contrato Generado', anulada:'Anulada' },
  concepto_vr:      { favorable:'Favorable', favorable_con_obs:'Favorable c/Obs', no_favorable:'No favorable' },
  motivo_req:       { reemplazo_retiro:'Reemplazo por retiro', reemplazo_temporal:'Reemplazo temporal',
                      cargo_nuevo:'Cargo nuevo', aumento_operacion:'Aumento de operación', temporada:'Temporada' },
  tipo_contrato:    { termino_indefinido:'Término indefinido', termino_fijo:'Término fijo',
                      obra_labor:'Obra o labor', aprendizaje:'Aprendizaje (SENA)' },
  horario:          { tiempo_completo:'Tiempo completo', medio_tiempo:'Medio tiempo', por_turnos:'Por turnos' },
  jornada_oc:       {
    'Lun-Vie 7am-5pm':   'Lun – Vie  7:00 am – 5:00 pm',
    'Lun-Vie 7am-4pm':   'Lun – Vie  7:00 am – 4:00 pm',
    'Lun-Vie 8am-6pm':   'Lun – Vie  8:00 am – 6:00 pm',
    'Lun-Vie 8am-5pm':   'Lun – Vie  8:00 am – 5:00 pm',
    'Lun-Vie 8am-12pm-2pm-6pm': 'Lun – Vie  8:00 am – 12:00 m / 2:00 pm – 6:00 pm',
    'Lun-Sab 7am-1pm':   'Lun – Sáb  7:00 am – 1:00 pm',
    'Lun-Sab 8am-4pm':   'Lun – Sáb  8:00 am – 4:00 pm',
    'Lun-Sab 8am-6pm':   'Lun – Sáb  8:00 am – 6:00 pm',
    'Dom-Dom Turno-A':   'Domingo a Domingo – Turno A (6am-2pm)',
    'Dom-Dom Turno-B':   'Domingo a Domingo – Turno B (2pm-10pm)',
    'Dom-Dom Turno-C':   'Domingo a Domingo – Turno C (10pm-6am)',
    'Rotativo':          'Rotativo',
    'Otro':              'Otro / Especificar',
  },
  nivel_educativo:  { bachiller:'Bachiller', tecnico:'Técnico', tecnologo:'Tecnólogo',
                      profesional:'Profesional', posgrado:'Posgrado' },
  nivel_riesgo:     { I:'Nivel I', II:'Nivel II', III:'Nivel III', IV:'Nivel IV', V:'Nivel V' },
  fuente_rec:       { interna:'Interna', referido:'Referido', bolsa_empleo:'Bolsa de empleo',
                      sena:'SENA', redes_sociales:'Redes sociales', agencia_publica:'Agencia Pública' },
  motivo_retiro:    { renuncia:'Renuncia', terminacion:'Terminación', despido_justa:'Despido con justa causa',
                      despido_sin_justa:'Despido sin justa causa', otro:'Otro' },
  desempeno:        { excelente:'Excelente', bueno:'Bueno', regular:'Regular', deficiente:'Deficiente' },
  resultado_laboral:{ contactada:'Contactada', no_contesta:'No contesta',
                      empresa_no_existe:'Empresa no existe', no_entrega_info:'No entrega información' },
  resultado_personal:{ contactada:'Contactada', no_contesta:'No contesta',
                       numero_errado:'Número errado', no_conoce:'No conoce al candidato' },
  tipo_salario:     { ordinario:'Ordinario', integral:'Integral' },
  forma_pago:       { quincenal:'Quincenal', mensual:'Mensual' },
  tipo_cuenta:      { ahorros:'Ahorros', corriente:'Corriente' },
};

const BADGE_REQ = {
  pendiente:'badge-warning', aprobada:'badge-success', rechazada:'badge-danger',
  en_seleccion:'badge-info', cubierta:'badge-neutral', cancelada:'badge-danger'
};
const BADGE_OC = {
  borrador:'badge-neutral', pendiente_aprobacion:'badge-warning', aprobada:'badge-success',
  rechazada:'badge-danger', contrato_generado:'badge-info', anulada:'badge-danger'
};
const BADGE_VR = {
  borrador:'badge-neutral', cerrada:'badge-success'
};
const BADGE_CONCEPTO = {
  favorable:'badge-success', favorable_con_obs:'badge-warning', no_favorable:'badge-danger'
};

function badgeHtml(cls, label) {
  return `<span class="badge ${cls}">${label}</span>`;
}
function badgeReq(estado) {
  return badgeHtml(BADGE_REQ[estado]||'badge-neutral', LBL.estado_req[estado]||estado);
}
function badgeOC(estado) {
  return badgeHtml(BADGE_OC[estado]||'badge-neutral', LBL.estado_oc[estado]||estado);
}
function badgeVR(estado) {
  return badgeHtml(BADGE_VR[estado]||'badge-neutral', LBL.estado_vr[estado]||estado);
}
function badgeConcepto(c) {
  if (!c) return '';
  return badgeHtml(BADGE_CONCEPTO[c]||'badge-neutral', LBL.concepto_vr[c]||c);
}

/* ════════════════════════════════════════════════════════════
   HELPERS DE FORMULARIO
   ════════════════════════════════════════════════════════════ */
function selectOpts(map, valor='', placeholder='Seleccione...') {
  const opts = [`<option value="">${placeholder}</option>`];
  Object.entries(map).forEach(([v,l]) => {
    opts.push(`<option value="${v}" ${valor===v?'selected':''}>${l}</option>`);
  });
  return opts.join('');
}

function selectOptsArr(arr, key, label, valor='', placeholder='Seleccione...') {
  const opts = [`<option value="">${placeholder}</option>`];
  arr.forEach(item => {
    opts.push(`<option value="${item[key]}" ${valor===item[key]?'selected':''}>${item[label]}</option>`);
  });
  return opts.join('');
}

function fv(id) { return (document.getElementById(id)||{}).value || ''; }
function fc(id) { return document.getElementById(id)?.checked || false; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function sc(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; }
function show(id, vis) {
  const el = document.getElementById(id);
  if (el) el.style.display = vis ? '' : 'none';
}

/* ════════════════════════════════════════════════════════════
   CIUDADES DE COLOMBIA Y PARENTESCOS
   ════════════════════════════════════════════════════════════ */
const CIUDADES_CO = [
  'Bogotá D.C.','Medellín','Cali','Barranquilla','Cartagena','Cúcuta','Bucaramanga',
  'Pereira','Santa Marta','Ibagué','Pasto','Manizales','Neiva','Villavicencio',
  'Armenia','Valledupar','Montería','Sincelejo','Popayán','Palmira','Buenaventura',
  'Floridablanca','Soledad','Dosquebradas','Bello','Soacha','Itagüí','Barrancabermeja',
  'Tunja','Riohacha','Quibdó','Mocoa','Mitú','Puerto Carreño','San José del Guaviare',
  'Leticia','Arauca','Yopal','Florencia','San Andrés',
  'Aguachica','Aguadas','Anserma','Apartadó','Arauca','Barbosa','Buga','Caldas',
  'Calarcá','Cartago','Cereté','Chaparral','Chía','Chigorodó','Chinchiná','Ciénaga',
  'Corozal','Duitama','El Banco','Espinal','Facatativá','Fusagasugá','Funza',
  'Girardot','Girón','Granada','Guarne','Honda','Ipiales','Istmina','Jamundí',
  'La Ceja','La Dorada','La Estrella','La Plata','La Virginia','Lorica','Magangué',
  'Maicao','Málaga','Malambo','Maní','Manta','Marmato','Miraflores','Montelíbano',
  'Muzo','Ocaña','Pamplona','Pitalito','Puerto Asís','Puerto Berrío','Puerto Boyacá',
  'Rionegro','Riosucio','Sabaneta','Salamina','San Gil','San Juan de Pasto',
  'San Juan del Cesar','Santa Rosa de Cabal','Santa Rosa de Osos','Santiago de Cali',
  'Sevilla','Sogamoso','Tumaco','Turbo','Ubaté','Vélez','Villamaría','Villanueva',
  'Yarumal','Zarzal',
].sort();

const PARENTESCOS = {
  'Cónyuge':                  'Cónyuge',
  'Compañero(a) permanente':  'Compañero(a) permanente',
  'Hijo(a)':                  'Hijo(a)',
  'Padre':                    'Padre',
  'Madre':                    'Madre',
  'Hermano(a)':               'Hermano(a)',
  'Abuelo(a)':                'Abuelo(a)',
  'Nieto(a)':                 'Nieto(a)',
  'Tío(a)':                   'Tío(a)',
  'Sobrino(a)':               'Sobrino(a)',
  'Primo(a)':                 'Primo(a)',
  'Suegro(a)':                'Suegro(a)',
  'Cuñado(a)':                'Cuñado(a)',
  'Amigo(a)':                 'Amigo(a)',
  'Otro':                     'Otro',
};

/** Genera <option> para ciudades de Colombia */
function selectCiudad(valor = '', disabled = false) {
  const opts = [`<option value="">Seleccione ciudad...</option>`];
  CIUDADES_CO.forEach(c => {
    opts.push(`<option value="${c}" ${valor === c ? 'selected' : ''}>${c}</option>`);
  });
  return `<select class="form-select" id="__CIUDAD_PLACEHOLDER__" ${disabled ? 'disabled' : ''}>${opts.join('')}</select>`;
}

/** Genera el HTML completo de un select de ciudades con un id dado */
function ciudadSelectHtml(id, valor = '', disabled = false) {
  const opts = [`<option value="">Seleccione ciudad...</option>`];
  CIUDADES_CO.forEach(c => {
    opts.push(`<option value="${c}" ${valor === c ? 'selected' : ''}>${c}</option>`);
  });
  return `<select class="form-select" id="${id}" ${disabled ? 'disabled' : ''}>${opts.join('')}</select>`;
}

/* ════════════════════════════════════════════════════════════
   SUB-TABS DE CONTRATACIÓN
   ════════════════════════════════════════════════════════════ */
let _contratacionTab = 'requisiciones'; // 'requisiciones' | 'referencias' | 'ordenes'

function switchContratacionTab(tab) {
  _contratacionTab = tab;
  document.querySelectorAll('#contratacionTabs .ctab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ctab === tab);
  });
  document.querySelectorAll('#contratacionContent .ctab-panel').forEach(p => {
    p.style.display = p.dataset.ctab === tab ? '' : 'none';
  });
  const renders = {
    requisiciones: renderRequisiciones,
    referencias: renderValidaciones,
    ordenes: renderOrdenes,
  };
  if (renders[tab]) renders[tab]();
}

/* ════════════════════════════════════════════════════════════
   RENDER PRINCIPAL DEL MÓDULO
   ════════════════════════════════════════════════════════════ */
async function renderContratacion() {
  const container = document.getElementById('page-contratacion');
  if (!container) return;

  // Encabezado + tabs
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">📋 <span>Contratación</span></div>
      <div class="page-subtitle">GH-F01 Requisición · GH-F02 Referencias · GH-F03 Orden de contratación</div>
      <div class="page-actions">
        <a href="requisicion-jefes.html" target="_blank" class="btn btn-secondary" style="text-decoration:none">
          👤 Portal Jefes — Nueva Requisición ↗
        </a>
      </div>
    </div>
    <!-- Sub-tabs -->
    <div id="contratacionTabs" style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      <button class="ctab-btn btn btn-secondary active" data-ctab="requisiciones"
              onclick="switchContratacionTab('requisiciones')">📄 Requisiciones</button>
      <button class="ctab-btn btn btn-secondary" data-ctab="referencias"
              onclick="switchContratacionTab('referencias')">🔍 Referencias</button>
      <button class="ctab-btn btn btn-secondary" data-ctab="ordenes"
              onclick="switchContratacionTab('ordenes')">✅ Órdenes</button>
    </div>
    <div id="contratacionContent">
      <div class="ctab-panel" data-ctab="requisiciones" id="panelRequisiciones"></div>
      <div class="ctab-panel" data-ctab="referencias"   id="panelValidaciones" style="display:none"></div>
      <div class="ctab-panel" data-ctab="ordenes"       id="panelOrdenes"      style="display:none"></div>
    </div>`;

  // Mostrar tab activo
  switchContratacionTab(_contratacionTab);
}

/* ════════════════════════════════════════════════════════════
   GH-F01 — REQUISICIONES
   ════════════════════════════════════════════════════════════ */
async function renderRequisiciones() {
  const panel = document.getElementById('panelRequisiciones');
  if (!panel) return;
  panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Cargando...</div></div>';

  const datos = await Requisicion.getAll();

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="filter-select" id="fReqEmpresa" onchange="renderRequisiciones()">
          <option value="">Ambas empresas</option>
          <option value="TYM">TYM</option><option value="TAT">TAT</option>
        </select>
        <select class="filter-select" id="fReqEstado" onchange="renderRequisiciones()">
          <option value="">Todos los estados</option>
          ${Object.entries(LBL.estado_req).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
        </select>
        <input type="text" class="search-input" id="fReqBuscar" placeholder="Buscar cargo / solicitante..."
               oninput="renderRequisicionesFiltered()"
               style="padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px">
      </div>
      <button class="btn btn-primary" onclick="abrirModalRequisicion()">➕ Nueva requisición</button>
    </div>
    <div id="reqTableWrap"></div>`;

  _reqDatos = datos;
  renderRequisicionesFiltered();
}

let _reqDatos = [];
function renderRequisicionesFiltered() {
  const empresa = fv('fReqEmpresa');
  const estado  = fv('fReqEstado');
  const buscar  = (fv('fReqBuscar')||'').toLowerCase();

  const filtrado = _reqDatos.filter(r => {
    if (empresa && r.empresa !== empresa) return false;
    if (estado  && r.estado  !== estado)  return false;
    if (buscar  && !`${r.cargo_nombre} ${r.nombre_solicitante} ${r.area}`.toLowerCase().includes(buscar)) return false;
    return true;
  });

  const wrap = document.getElementById('reqTableWrap');
  if (!wrap) return;

  if (!filtrado.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div>
      <div class="empty-state-text">No hay requisiciones con estos filtros</div></div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>No.</th><th>Empresa</th><th>Cargo</th><th>Área</th>
            <th>Solicitante</th><th>F. Solicitud</th><th>Vacantes</th>
            <th>Tipo contrato</th><th>Estado</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${filtrado.map(r => `
            <tr>
              <td><span style="font-family:monospace;font-size:12px;color:var(--accent)">${r.numero}</span></td>
              <td><span class="chip">${r.empresa}</span></td>
              <td style="font-weight:600">${r.cargo_nombre}${r.hv_candidato_nombre?` <span title="Candidato: ${r.hv_candidato_nombre}" style="font-size:13px">📎</span>`:''}</td>
              <td>${r.area}</td>
              <td><div style="font-size:13px">${r.nombre_solicitante}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${r.cargo_solicitante}</div></td>
              <td>${fmtDate(r.fecha_solicitud)}</td>
              <td style="text-align:center">
                <span style="font-weight:700">${r.vacantes_cubiertas||0}/${r.num_vacantes}</span>
              </td>
              <td style="font-size:12px">${LBL.tipo_contrato[r.tipo_contrato]||r.tipo_contrato}</td>
              <td>${badgeReq(r.estado)}</td>
              <td>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px"
                          onclick="verRequisicion('${r.id}')">👁 Ver</button>
                  ${r.estado==='pendiente'?`
                  <button class="btn btn-primary" style="padding:5px 8px;font-size:11px"
                          onclick="abrirModalRequisicion('${r.id}')">✏️</button>`:
                  (!['aprobada','rechazada','cubierta','cancelada'].includes(r.estado)?`
                  <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px"
                          onclick="abrirModalRequisicion('${r.id}')">✏️</button>`:'') }
                  ${r.estado==='pendiente'?`
                  <button class="btn" style="padding:5px 8px;font-size:11px;background:rgba(58,170,128,0.2);color:var(--success)"
                          onclick="abrirModalAprobacionReq('${r.id}')">✔ Decidir</button>`:''}
                  ${r.estado==='aprobada'?`
                  <button class="btn" style="padding:5px 8px;font-size:11px;background:rgba(58,130,200,0.2);color:var(--accent)"
                          onclick="abrirModalAprobacionReq('${r.id}')">🗓 Entrevista</button>`:''}

              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${filtrado.length} registros</div>`;
}

/* ════════════════════════════════════════════════════════════
   MODAL REQUISICIÓN (GH-F01)
   ════════════════════════════════════════════════════════════ */
let _reqEditId = null;
let _paramVigente = null;

async function abrirModalRequisicion(id = null) {
  _reqEditId = id;
  _paramVigente = await MaestrasContratacion.getParametroVigente();
  const [sedes, cargos] = await Promise.all([
    MaestrasContratacion.getSedes(),
    MaestrasContratacion.getCargos(),
  ]);

  let d = {};
  if (id) {
    d = await Requisicion.getById(id) || {};
  }

  const isReadOnly = ['aprobada','rechazada','cubierta','cancelada'].includes(d.estado);

  const html = `
  <div class="modal-overlay open" id="modalRequisicion">
    <div class="modal" style="max-width:800px;width:95vw;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-title">${id ? (isReadOnly?'👁 Ver':'✏️ Editar') : '➕ Nueva'} Requisición de Personal <span style="font-size:12px;color:var(--accent);font-family:monospace">${d.numero||'GH-F01'}</span></div>
        <button class="modal-close" onclick="cerrarModalRequisicion()">✕</button>
      </div>
      <div class="modal-body">

        <div class="form-section-title">📌 Datos de la solicitud</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Empresa <span class="req-star">*</span></label>
            <select class="form-select" id="rEmpresa" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.empresa, d.empresa)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sede / Ciudad <span class="req-star">*</span></label>
            <select class="form-select" id="rSede" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(sedes,'id','nombre',d.sede_id)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Área / Dependencia <span class="req-star">*</span></label>
            <select class="form-select" id="rArea" ${isReadOnly?'disabled':''}>
              ${selectOpts({Bodega:'Bodega',Comercial:'Comercial',Administrativa:'Administrativa',
                Logística:'Logística',Operaciones:'Operaciones',Sistemas:'Sistemas'}, d.area)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre del solicitante <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="rSolicitante" value="${d.nombre_solicitante||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Cargo del solicitante <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="rCargoSol" value="${d.cargo_solicitante||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha requerida de ingreso <span class="req-star">*</span></label>
            <input type="date" class="form-input" id="rFechaReq" value="${d.fecha_requerida||''}" ${isReadOnly?'readonly':''}>
          </div>
        </div>

        <div class="form-section-title" style="margin-top:20px">🏷️ Datos del cargo</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nombre del cargo <span class="req-star">*</span></label>
            <select class="form-select" id="rCargo" onchange="syncCargoNombre()" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(cargos,'id','nombre',d.cargo_id)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre de cargo (libre) <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="rCargoNombre" value="${d.cargo_nombre||''}"
                   placeholder="Si no está en la lista, escríbelo aquí" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">N° de vacantes <span class="req-star">*</span></label>
            <input type="number" class="form-input" id="rVacantes" value="${d.num_vacantes||1}" min="1" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Jefe inmediato <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="rJefe" value="${d.jefe_inmediato||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Horario / Jornada <span class="req-star">*</span></label>
            <select class="form-select" id="rHorario" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.horario, d.horario)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Lugar de trabajo <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="rLugar" value="${d.lugar_trabajo||''}" ${isReadOnly?'readonly':''}>
          </div>
        </div>
        <div class="form-group" style="margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:var(--text-secondary)">
            <input type="checkbox" id="rCargoNuevo" ${d.cargo_nuevo?'checked':''} ${isReadOnly?'disabled':''}>
            ¿Es un cargo nuevo en la estructura?
          </label>
        </div>

        <div class="form-section-title" style="margin-top:20px">📝 Motivo de la requisición</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Motivo <span class="req-star">*</span></label>
            <select class="form-select" id="rMotivo" onchange="togglePersonaReemplazar()" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.motivo_req, d.motivo)}
            </select>
          </div>
          <div class="form-group" id="grpPersonaReemplazar" style="display:none">
            <label class="form-label">Persona a reemplazar</label>
            <input type="text" class="form-input" id="rPersonaReemplazar" value="${d.persona_reemplazar||''}" ${isReadOnly?'readonly':''}>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Justificación <span class="req-star">*</span></label>
          <textarea class="form-input" id="rJustificacion" rows="3" ${isReadOnly?'readonly':''}>${d.justificacion||''}</textarea>
        </div>

        <div class="form-section-title" style="margin-top:20px">💼 Condiciones de contratación</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Tipo de contrato <span class="req-star">*</span></label>
            <select class="form-select" id="rTipoContrato" onchange="toggleDuracion()" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.tipo_contrato, d.tipo_contrato)}
            </select>
          </div>
          <div class="form-group" id="grpDuracion" style="display:none">
            <label class="form-label">Duración (meses)</label>
            <input type="number" class="form-input" id="rDuracion" value="${d.duracion_meses||''}" min="1" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Salario básico mensual (COP) <span class="req-star">*</span></label>
            <input type="number" class="form-input" id="rSalario" value="${d.salario||''}"
                   oninput="calcAuxTransporte()" placeholder="Ej: 1560000" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Auxilio de transporte</label>
            <select class="form-select" id="rAuxTransporte" ${isReadOnly?'disabled':''}>
              <option value="true"  ${d.auxilio_transporte===true?'selected':''}>Sí</option>
              <option value="false" ${d.auxilio_transporte===false?'selected':''}>No</option>
            </select>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px" id="auxHint"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Nivel de riesgo ARL <span class="req-star">*</span></label>
            <select class="form-select" id="rRiesgo" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.nivel_riesgo, d.nivel_riesgo_arl)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Otros pagos / bonificaciones</label>
            <input type="text" class="form-input" id="rOtrosPagos" value="${d.otros_pagos||''}" ${isReadOnly?'readonly':''}>
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:var(--text-secondary)">
            <input type="checkbox" id="rDotacion" onchange="toggleTallas()" ${d.requiere_dotacion?'checked':''} ${isReadOnly?'disabled':''}>
            ¿Requiere dotación?
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Herramientas o equipos a asignar</label>
          <input type="text" class="form-input" id="rHerramientas" value="${d.herramientas||''}"
                 placeholder="Celular, computador, montacargas, EPP..." ${isReadOnly?'readonly':''}>
        </div>

        <div class="form-section-title" style="margin-top:20px">🎓 Perfil requerido</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nivel educativo <span class="req-star">*</span></label>
            <select class="form-select" id="rNivelEdu" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.nivel_educativo, d.nivel_educativo)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Formación / título específico</label>
            <input type="text" class="form-input" id="rFormacion" value="${d.formacion_especifica||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Experiencia mínima (meses) <span class="req-star">*</span></label>
            <input type="number" class="form-input" id="rExpMeses" value="${d.experiencia_meses||0}" min="0" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Experiencia específica</label>
            <input type="text" class="form-input" id="rExpEsp" value="${d.experiencia_especifica||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Conocimientos técnicos</label>
            <input type="text" class="form-input" id="rConocimientos" value="${d.conocimientos_tecnicos||''}" ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Licencias / certificaciones</label>
            <input type="text" class="form-input" id="rLicencias" value="${d.licencias||''}"
                   placeholder="Licencia C1/C2, montacargas, alturas..." ${isReadOnly?'readonly':''}>
          </div>
          <div class="form-group">
            <label class="form-label">Fuente de reclutamiento sugerida</label>
            <select class="form-select" id="rFuente" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.fuente_rec, d.fuente_reclutamiento, 'Sin preferencia')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Funciones principales <span class="req-star">*</span></label>
          <textarea class="form-input" id="rFunciones" rows="4" ${isReadOnly?'readonly':''}>${d.funciones||''}</textarea>
        </div>

      </div><!-- /modal-body -->
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrarModalRequisicion()">Cancelar</button>
        ${!isReadOnly?`<button class="btn btn-primary" onclick="guardarRequisicion()">💾 Guardar requisición</button>`:''}
      </div>
    </div>
  </div>`;

  // Remover si ya existe
  const prev = document.getElementById('modalRequisicion');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

  // Condicionales iniciales
  togglePersonaReemplazar();
  toggleDuracion();
  calcAuxTransporte();
}

function syncCargoNombre() {
  const sel = document.getElementById('rCargo');
  if (!sel) return;
  const txt = sel.options[sel.selectedIndex]?.text;
  if (txt && txt !== 'Seleccione...') sv('rCargoNombre', txt);
}

function togglePersonaReemplazar() {
  const m = fv('rMotivo');
  show('grpPersonaReemplazar', m.startsWith('reemplazo'));
}

function toggleDuracion() {
  const tc = fv('rTipoContrato');
  show('grpDuracion', tc==='termino_fijo'||tc==='obra_labor');
}

async function calcAuxTransporte() {
  if (!_paramVigente) return;
  const sal = parseFloat(fv('rSalario')) || 0;
  const aplica = ReglasContratacion.aplicaAuxTransporte(sal, _paramVigente);
  sv('rAuxTransporte', aplica ? 'true' : 'false');
  const hint = document.getElementById('auxHint');
  if (hint) {
    hint.textContent = aplica
      ? `✅ Aplica (salario ≤ 2 SMMLV = ${fmtCOP(_paramVigente.smmlv*2)})`
      : `❌ No aplica (salario > 2 SMMLV)`;
    hint.style.color = aplica ? 'var(--success)' : 'var(--text-muted)';
  }
}

function cerrarModalRequisicion() {
  const m = document.getElementById('modalRequisicion');
  if (m) m.remove();
  document.body.style.overflow = '';
}

async function guardarRequisicion() {
  const empresa   = fv('rEmpresa');
  const sede_id   = fv('rSede');
  const area      = fv('rArea');
  const solicitante = fv('rSolicitante');
  const cargo_sol = fv('rCargoSol');
  const fecha_req = fv('rFechaReq');
  const cargo_id  = fv('rCargo');
  const cargo_nom = fv('rCargoNombre');
  const vacantes  = parseInt(fv('rVacantes'))||1;
  const jefe      = fv('rJefe');
  const horario   = fv('rHorario');
  const lugar     = fv('rLugar');
  const motivo    = fv('rMotivo');
  const justif    = fv('rJustificacion');
  const tipo_c    = fv('rTipoContrato');
  const salario   = parseFloat(fv('rSalario'))||0;
  const riesgo    = fv('rRiesgo');
  const funciones = fv('rFunciones');
  const exp_meses = parseInt(fv('rExpMeses'))||0;
  const nivel_edu = fv('rNivelEdu');

  if (!empresa||!area||!solicitante||!cargo_sol||!fecha_req||!cargo_nom||!jefe||!horario||!lugar||
      !motivo||!justif||!tipo_c||!salario||!riesgo||!funciones||!nivel_edu) {
    toast('Complete los campos obligatorios (*)', 'warning');
    return;
  }

  // Buscar nombre de la sede
  const sedes = await MaestrasContratacion.getSedes();
  const sedeSel = sedes.find(s => s.id === sede_id);

  const payload = {
    empresa, sede_id: sede_id||null, sede_nombre: sedeSel?.nombre||'',
    area, nombre_solicitante: solicitante, cargo_solicitante: cargo_sol,
    fecha_requerida: fecha_req,
    cargo_id: cargo_id||null, cargo_nombre: cargo_nom,
    num_vacantes: vacantes, jefe_inmediato: jefe, horario, lugar_trabajo: lugar,
    cargo_nuevo: fc('rCargoNuevo'), motivo,
    persona_reemplazar: fv('rPersonaReemplazar')||null,
    justificacion: justif,
    tipo_contrato: tipo_c,
    duracion_meses: (tipo_c==='termino_fijo'||tipo_c==='obra_labor') ? (parseInt(fv('rDuracion'))||null) : null,
    salario, auxilio_transporte: fv('rAuxTransporte')==='true',
    otros_pagos: fv('rOtrosPagos')||null,
    nivel_riesgo_arl: riesgo,
    requiere_dotacion: fc('rDotacion'),
    herramientas: fv('rHerramientas')||null,
    nivel_educativo: nivel_edu,
    formacion_especifica: fv('rFormacion')||null,
    experiencia_meses: exp_meses,
    experiencia_especifica: fv('rExpEsp')||null,
    conocimientos_tecnicos: fv('rConocimientos')||null,
    licencias: fv('rLicencias')||null,
    fuente_reclutamiento: fv('rFuente')||null,
    funciones,
  };

  showLoading(true);
  let ok;
  if (_reqEditId) {
    ok = await Requisicion.update(_reqEditId, payload);
  } else {
    ok = await Requisicion.insert(payload);
  }
  showLoading(false);

  if (ok) {
    toast(_reqEditId ? 'Requisición actualizada' : `Requisición creada: ${ok.numero}`, 'success');
    cerrarModalRequisicion();
    renderRequisiciones();
  }
}

/* ════════════════════════════════════════════════════════════
   MODAL APROBACIÓN / ENTREVISTAS REQUISICIÓN
   ════════════════════════════════════════════════════════════ */
async function abrirModalAprobacionReq(reqId) {
  showLoading(true);
  const [req, aprobaciones, candidatos, entrevistas] = await Promise.all([
    Requisicion.getById(reqId),
    Aprobaciones.get('requisicion_personal', reqId),
    Candidatos.getByRequisicion(reqId),
    Entrevistas.getByRequisicion(reqId),
  ]);
  showLoading(false);
  if (!req) return;

  const yaAprobada  = req.estado === 'aprobada' || req.estado === 'en_seleccion';
  const yaRechazada = req.estado === 'rechazada';
  const bloqueada   = yaRechazada;   // solo el rechazo bloquea; aprobada puede seguir gestionando

  // ── Aprobación GH ──
  const apGH = aprobaciones.find(a => a.rol === 'gh');
  const decGH = apGH?.decision || 'pendiente';

  const aprobHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;
                border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid var(--border)">
      <div>
        <div style="font-size:13px;font-weight:600">GH — Gestión Humana</div>
        ${apGH
          ? `<div style="font-size:12px;color:var(--text-muted)">${apGH.nombre_usuario} · ${fmtDate(apGH.fecha?.split('T')[0])}</div>
             ${apGH.comentario?`<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;font-style:italic">"${apGH.comentario}"</div>`:''}` 
          : `<div style="font-size:12px;color:var(--text-muted)">Sin registrar</div>`}
      </div>
      <span style="font-weight:700;font-size:12px;white-space:nowrap;color:${
        decGH==='aprobado'?'var(--success)':decGH==='rechazado'?'var(--danger)':'var(--text-muted)'}">${
        decGH==='aprobado'?'✔ Aprobado':decGH==='rechazado'?'✘ Rechazado':'⏳ Pendiente'}</span>
    </div>`;

  // ── Candidato propuesto por el jefe ──
  const secCandJefe = (req.hv_candidato_nombre || req.hv_candidato_url) ? `
    <div style="padding:12px 14px;background:rgba(58,130,200,0.08);
                border:1px solid rgba(58,130,200,0.25);border-radius:10px;margin-bottom:14px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;
                  color:var(--text-muted);margin-bottom:8px">📎 Candidato propuesto por el jefe</div>
      ${req.hv_candidato_nombre
        ?`<div style="font-size:14px;font-weight:700;margin-bottom:6px">👤 ${req.hv_candidato_nombre}</div>`:''}
      ${req.hv_candidato_url
        ?`<a href="${req.hv_candidato_url}" target="_blank"
               style="display:inline-flex;align-items:center;gap:6px;font-size:13px;
                      color:var(--accent);text-decoration:none;padding:5px 10px;
                      background:rgba(58,130,200,0.12);border-radius:6px;
                      border:1px solid rgba(58,130,200,0.25)">📄 Ver hoja de vida</a>`
        :'<div style="font-size:12px;color:var(--text-muted)">Sin hoja de vida adjunta</div>'}
    </div>` : '';

  // ── Entrevista — check simple por candidato ──
  // ── Candidatos para entrevista: propuesto por jefe + registrados en req + pool del cargo ──
  // 1. Buscar trabajadores activos con el mismo cargo (pool interno)
  const { data: poolCargo } = await sb
    .from('trabajadores')
    .select('id,nombre,cedula,cargo,estado')
    .eq('cargo', req.cargo_nombre)
    .eq('estado', 'activo')
    .order('nombre')
    .limit(30);

  // Buscar el estado de entrevista de cada candidato (si existe)
  const entMap = {};
  entrevistas.forEach(e => { entMap[e.candidato_nombre] = e; });

  // Construir lista unificada sin duplicados:
  // Primero los candidatos registrados en la requisición
  const listaCand = [...candidatos];
  const nombresYa = new Set(candidatos.map(c => c.nombre.toLowerCase()));

  // Agregar propuesto por el jefe si no está ya
  if (req.hv_candidato_nombre && !nombresYa.has(req.hv_candidato_nombre.toLowerCase())) {
    listaCand.unshift({ nombre: req.hv_candidato_nombre, numero_id: '—', _propuesto: true });
    nombresYa.add(req.hv_candidato_nombre.toLowerCase());
  }

  // Agregar del pool del cargo si no están ya (como candidatos potenciales del cargo)
  (poolCargo || []).forEach(t => {
    if (!nombresYa.has(t.nombre.toLowerCase())) {
      listaCand.push({ nombre: t.nombre, numero_id: t.cedula || '—', id: t.id, _pool: true });
      nombresYa.add(t.nombre.toLowerCase());
    }
  });

  const COLORES_AVATAR = ['#6c63ff','#ff6584','#43e97b','#f7971e','#1e90ff','#ff9f43'];
  const avatarC = n => COLORES_AVATAR[(n||'').charCodeAt(0) % COLORES_AVATAR.length];

  const tarjetaCandidato = (c) => {
    const ent = entMap[c.nombre];
    const est = ent?.estado;  // 'paso','no_paso','no_asistio' o undefined

    const badgeEnt = est === 'asistio'
      ? `<span style="background:rgba(58,170,128,0.2);color:#4ab896;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px">✅ Pasó entrevista</span>`
      : est === 'no_asistio'
      ? `<span style="background:rgba(224,85,85,0.15);color:#e05555;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px">❌ No asistió</span>`
      : est === 'no_paso'
      ? `<span style="background:rgba(200,124,58,0.15);color:#d4964a;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px">✘ No pasó</span>`
      : '';

    const botonesEnt = !est ? `
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn" style="flex:1;padding:6px 8px;font-size:12px;background:rgba(58,170,128,0.18);color:#4ab896;font-weight:600"
                onclick="marcarEntrevista('${reqId}','${c.nombre.replace(/'/g,"\\'")}','asistio')">✅ Pasó</button>
        <button class="btn" style="flex:1;padding:6px 8px;font-size:12px;background:rgba(200,124,58,0.18);color:#d4964a;font-weight:600"
                onclick="marcarEntrevista('${reqId}','${c.nombre.replace(/'/g,"\\'")}','no_paso')">✘ No pasó</button>
        <button class="btn" style="flex:1;padding:6px 8px;font-size:12px;background:rgba(224,85,85,0.15);color:#e05555;font-weight:600"
                onclick="marcarEntrevista('${reqId}','${c.nombre.replace(/'/g,"\\'")}','no_asistio')">🚫 No asistió</button>
      </div>` : '';

    // Si pasó la entrevista, mostrar botón ir a referencias
    const btnReferencias = est === 'asistio' && c.id ? `
      <div style="margin-top:8px">
        <button class="btn btn-primary" style="width:100%;padding:7px;font-size:12px"
                onclick="cerrar('modalAprobReq');abrirModalVR('${c.id}','${reqId}','${c.nombre.replace(/'/g,"\\'")}','${(req.cargo_nombre||'').replace(/'/g,"\\'")}','${req.numero}')">
          🔍 Ir a verificación de referencias →
        </button>
      </div>` : '';

    return `
    <div style="padding:11px 13px;border-radius:9px;margin-bottom:8px;
                border:1px solid var(--border);background:rgba(255,255,255,0.03)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:${avatarC(c.nombre)};
                    display:flex;align-items:center;justify-content:center;
                    font-size:13px;font-weight:700;flex-shrink:0;color:#fff">${c.nombre.charAt(0)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${c.nombre}${
            c._propuesto ? ` <span style="font-size:10px;color:var(--accent);background:rgba(58,130,200,0.15);padding:1px 6px;border-radius:10px">propuesto</span>` :
            c._pool      ? ` <span style="font-size:10px;color:var(--text-muted);background:rgba(255,255,255,0.07);padding:1px 6px;border-radius:10px">pool cargo</span>` : ''
          }</div>
          ${c.numero_id && c.numero_id !== '—' ? `<div style="font-size:11px;color:var(--text-muted)">CC ${c.numero_id}</div>` : ''}
        </div>
        ${badgeEnt}
      </div>
      ${botonesEnt}
      ${btnReferencias}
    </div>`;
  };

  const secEntrevistas = yaAprobada ? `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;
                  color:var(--text-muted);margin-bottom:8px">
        🗓 Entrevista · candidatos para <strong style="color:var(--text-primary)">${req.cargo_nombre}</strong>
        <span style="font-weight:400">(${listaCand.length})</span>
      </div>
      ${listaCand.length
        ? listaCand.map(tarjetaCandidato).join('')
        : `<div style="text-align:center;color:var(--text-muted);padding:16px;font-size:13px">
             No hay candidatos registrados ni trabajadores activos con el cargo "${req.cargo_nombre}"
           </div>`}
    </div>` : '';

  const html = `
  <div class="modal-overlay open" id="modalAprobReq">
    <div class="modal" style="max-width:580px;width:95vw;max-height:92vh;overflow-y:auto">
      <div class="modal-header">
        <div>
          <div class="modal-title">${yaRechazada?'❌':yaAprobada?'✅':'📋'} ${req.numero}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            ${req.cargo_nombre} · ${req.empresa} · ${req.num_vacantes} vacante(s) · ${badgeReq(req.estado)}
          </div>
        </div>
        <button class="modal-close" onclick="cerrar('modalAprobReq')">✕</button>
      </div>
      <div class="modal-body">

        <!-- Justificación -->
        ${req.justificacion?`
        <div style="margin-bottom:14px;padding:10px 14px;background:rgba(255,255,255,0.03);
                    border-left:3px solid var(--accent);border-radius:0 8px 8px 0">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Justificación del jefe</div>
          <div style="font-size:13px;color:var(--text-secondary)">${req.justificacion}</div>
        </div>`:''}

        <!-- Candidato propuesto por el jefe -->
        ${secCandJefe}

        <!-- Estado aprobación GH -->
        <div style="margin-bottom:14px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:8px">Aprobación</div>
          ${aprobHtml}
          ${req.motivo_rechazo?`
          <div style="margin-top:8px;padding:9px 12px;background:rgba(224,85,85,0.08);
                      border-radius:8px;border:1px solid rgba(224,85,85,0.25)">
            <div style="font-size:11px;font-weight:700;color:var(--danger)">Motivo de rechazo</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${req.motivo_rechazo}</div>
          </div>`:''}
        </div>

        <!-- Entrevistas -->
        ${secEntrevistas}

        <!-- Formulario decisión (solo si pendiente) -->
        ${!bloqueada && req.estado === 'pendiente' ?`
        <div style="padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;
                      color:var(--text-muted);margin-bottom:10px">Registrar decisión GH</div>
          <div class="form-grid-2" style="gap:10px;margin-bottom:10px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Decisión <span class="req-star">*</span></label>
              <select class="form-select" id="aprobDecision" style="font-size:13px">
                <option value="aprobado">✔ Aprobar</option>
                <option value="rechazado">✘ Rechazar</option>
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Responsable GH <span class="req-star">*</span></label>
              <input type="text" class="form-input" id="aprobNombre" style="font-size:13px"
                     placeholder="Nombre de GH">
            </div>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Comentario <span style="color:var(--text-muted);font-weight:400">(obligatorio si rechaza)</span></label>
            <textarea class="form-input" id="aprobComentario" rows="2" style="font-size:13px"
                      placeholder="Observaciones…"></textarea>
          </div>
        </div>`:''}

      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrar('modalAprobReq')">Cerrar</button>
        ${req.estado === 'pendiente' && !bloqueada
          ?`<button class="btn btn-primary" onclick="registrarAprobacionReq('${reqId}')">💾 Registrar decisión</button>`:'' }
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalAprobReq');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

async function registrarAprobacionReq(reqId) {
  const nombre   = fv('aprobNombre').trim();
  const decision = fv('aprobDecision');
  const coment   = fv('aprobComentario').trim();

  if (!nombre) { toast('Ingrese el nombre del responsable de GH', 'warning'); return; }
  if (decision === 'rechazado' && !coment) { toast('El motivo de rechazo es obligatorio', 'warning'); return; }

  showLoading(true);
  const ok = await Requisicion.aprobar(reqId, 'gh', nombre, decision, coment);
  showLoading(false);

  if (ok) {
    toast(decision === 'aprobado'
      ? `✅ Requisición aprobada por ${nombre}`
      : `❌ Requisición rechazada por ${nombre}`,
      decision === 'aprobado' ? 'success' : 'warning');
    cerrar('modalAprobReq');
    renderRequisiciones();
    if (decision === 'aprobado') {
      setTimeout(() => abrirModalAprobacionReq(reqId), 400);
    }
  }
}

async function marcarEntrevista(reqId, candidatoNombre, estado) {
  // Buscar si ya existe un registro para este candidato en esta req
  const todas = await Entrevistas.getByRequisicion(reqId);
  const existente = todas.find(e => e.candidato_nombre === candidatoNombre);

  showLoading(true);
  if (existente) {
    await Entrevistas.update(existente.id, { estado });
  } else {
    await Entrevistas.insert({
      requisicion_id:  reqId,
      candidato_nombre: candidatoNombre,
      entrevistador:   'GH',
      fecha:           new Date().toISOString().split('T')[0],
      estado,
    });
  }
  showLoading(false);

  const lbl = { asistio:'✅ Pasó la entrevista', no_paso:'✘ No pasó', no_asistio:'🚫 No asistió' };
  toast(lbl[estado] || 'Guardado', estado === 'asistio' ? 'success' : 'warning');
  cerrar('modalAprobReq');
  setTimeout(() => abrirModalAprobacionReq(reqId), 250);
}

async function actualizarEstadoEntrevista(entId, nuevoEstado, reqId) {
  showLoading(true);
  await Entrevistas.update(entId, { estado: nuevoEstado });
  showLoading(false);
  cerrar('modalAprobReq');
  setTimeout(() => abrirModalAprobacionReq(reqId), 250);
}

async function actualizarResultadoEntrevista(entId, resultado, reqId) {
  showLoading(true);
  await Entrevistas.update(entId, { resultado });
  showLoading(false);
  cerrar('modalAprobReq');
  setTimeout(() => abrirModalAprobacionReq(reqId), 250);
}

/* ════════════════════════════════════════════════════════════
   VER REQUISICIÓN (detalle completo + candidatos)
   ════════════════════════════════════════════════════════════ */
async function verRequisicion(reqId) {
  const [req, candidatos] = await Promise.all([
    Requisicion.getById(reqId),
    Candidatos.getByRequisicion(reqId),
  ]);
  if (!req) return;

  const row = (label, val) => val
    ? `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-val">${val}</span></div>` : '';

  const html = `
  <div class="modal-overlay open" id="modalVerReq">
    <div class="modal" style="max-width:720px;width:95vw;max-height:90vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-title">📋 ${req.numero} · ${req.cargo_nombre}</div>
        <button class="modal-close" onclick="cerrar('modalVerReq')">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <span class="chip">${req.empresa}</span>
          ${badgeReq(req.estado)}
          <span class="chip">${req.area}</span>
          <span class="chip">${LBL.tipo_contrato[req.tipo_contrato]||req.tipo_contrato}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${row('Solicitante', `${req.nombre_solicitante} (${req.cargo_solicitante})`)}
          ${row('Sede', req.sede_nombre)}
          ${row('Fecha solicitud', fmtDate(req.fecha_solicitud))}
          ${row('Fecha requerida', fmtDate(req.fecha_requerida))}
          ${row('Jefe inmediato', req.jefe_inmediato)}
          ${row('N° vacantes', `${req.vacantes_cubiertas||0} cubiertas / ${req.num_vacantes} solicitadas`)}
          ${row('Motivo', LBL.motivo_req[req.motivo]||req.motivo)}
          ${row('Persona a reemplazar', req.persona_reemplazar)}
          ${row('Salario', fmtCOP(req.salario))}
          ${row('Aux. transporte', req.auxilio_transporte?'Sí':'No')}
          ${row('Riesgo ARL', req.nivel_riesgo_arl)}
          ${row('Nivel educativo', LBL.nivel_educativo[req.nivel_educativo]||req.nivel_educativo)}
          ${row('Experiencia', `${req.experiencia_meses} mes(es)`)}
        </div>
        ${req.justificacion?`<div style="margin-top:12px"><div class="detail-label">Justificación</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${req.justificacion}</div></div>`:''}
        ${req.funciones?`<div style="margin-top:12px"><div class="detail-label">Funciones principales</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${req.funciones}</div></div>`:''}
        ${req.motivo_rechazo?`<div style="margin-top:12px;padding:10px;background:rgba(224,85,85,0.1);border-radius:8px;border:1px solid rgba(224,85,85,0.3)"><div style="font-size:12px;font-weight:700;color:var(--danger)">Motivo de rechazo</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${req.motivo_rechazo}</div></div>`:''}

        ${(req.hv_candidato_nombre||req.hv_candidato_url)?`
        <div style="margin-top:16px;padding:14px;background:rgba(58,130,200,0.08);border-radius:10px;border:1px solid rgba(58,130,200,0.25)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:16px">📎</span>
            <span style="font-size:13px;font-weight:700;color:var(--accent)">Candidato propuesto por el jefe</span>
            <span class="chip" style="font-size:10px">Portal</span>
          </div>
          ${req.hv_candidato_nombre?`<div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px"><strong>Nombre:</strong> ${req.hv_candidato_nombre}</div>`:''}
          ${req.hv_candidato_url?`<div><a href="${req.hv_candidato_url}" target="_blank" style="font-size:13px;color:var(--accent);text-decoration:underline">📄 Ver hoja de vida</a></div>`:''}
        </div>`:''}

        <div class="form-section-title" style="margin-top:24px">
          👤 Candidatos (${candidatos.length})
          ${req.estado!=='rechazada'&&req.estado!=='cubierta'?`
          <button class="btn btn-primary" style="padding:5px 10px;font-size:12px;margin-left:12px"
                  onclick="abrirModalCandidato('${reqId}','${req.cargo_nombre}','${req.numero}')">➕ Agregar</button>`:''}
        </div>
        ${candidatos.length?`
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>Nombre</th><th>Documento</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${candidatos.map(c=>`
              <tr>
                <td>${c.nombre}</td>
                <td style="font-family:monospace">${c.tipo_id} ${c.numero_id}</td>
                <td><span class="badge ${c.estado==='seleccionado'?'badge-success':c.estado==='descartado'?'badge-danger':'badge-neutral'}">${c.estado}</span></td>
                <td>
                  <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px"
                          onclick="abrirModalVR('${c.id}','${req.id}','${c.nombre}','${req.cargo_nombre}','${req.numero}')">🔍 Referencias</button>
                  <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px"
                          onclick="crearOrdenDesdeCandidato('${req.id}','${c.id}')">📋 Orden</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`:`<div class="empty-state" style="padding:20px"><div class="empty-state-icon">👤</div><div class="empty-state-text">Sin candidatos registrados</div></div>`}
      </div>
      <div class="modal-footer">
        ${req.estado==='pendiente'?`
        <button class="btn btn-primary" style="margin-right:auto"
                onclick="cerrar('modalVerReq');abrirModalAprobacionReq('${reqId}')">✔ Aprobar / Rechazar</button>`:''}
        <button class="btn btn-secondary" onclick="cerrar('modalVerReq')">Cerrar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalVerReq');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

/* ════════════════════════════════════════════════════════════
   MODAL CANDIDATO
   ════════════════════════════════════════════════════════════ */
async function abrirModalCandidato(reqId, cargoNombre, reqNum) {
  const html = `
  <div class="modal-overlay open" id="modalCandidato">
    <div class="modal" style="max-width:480px;width:95vw">
      <div class="modal-header">
        <div class="modal-title">👤 Registrar candidato — ${cargoNombre}</div>
        <button class="modal-close" onclick="cerrar('modalCandidato')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre completo <span class="req-star">*</span></label>
          <input type="text" class="form-input" id="cNombre">
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Tipo de documento</label>
            <select class="form-select" id="cTipoId">
              <option value="CC">CC</option><option value="CE">CE</option>
              <option value="PPT">PPT</option><option value="PA">PA</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Número de documento <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="cNumId">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input type="text" class="form-input" id="cTelefono">
          </div>
          <div class="form-group">
            <label class="form-label">Correo electrónico</label>
            <input type="email" class="form-input" id="cEmail">
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
            <input type="checkbox" id="cAutorizacion">
            Autorización de tratamiento de datos firmada (Ley 1581/2012)
          </label>
          <div style="font-size:11px;color:var(--warning);margin-top:4px">⚠️ Requerida antes de verificar referencias</div>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-input" id="cObs" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrar('modalCandidato')">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarCandidato('${reqId}','${reqNum}')">💾 Guardar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalCandidato');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

async function guardarCandidato(reqId, reqNum) {
  const nombre  = fv('cNombre').trim();
  const numId   = fv('cNumId').trim();
  if (!nombre || !numId) { toast('Nombre y documento son obligatorios', 'warning'); return; }

  showLoading(true);
  const ok = await Candidatos.insert({
    requisicion_id: reqId, requisicion_num: reqNum,
    nombre, tipo_id: fv('cTipoId'), numero_id: numId,
    telefono: fv('cTelefono')||null, email: fv('cEmail')||null,
    autorizacion_datos: fc('cAutorizacion'),
    obs: fv('cObs')||null,
  });
  showLoading(false);

  if (ok) {
    toast(`Candidato "${nombre}" registrado`, 'success');
    cerrar('modalCandidato');
    // Refrescar la vista de detalle de requisición
    verRequisicion(reqId);
  }
}

/* ════════════════════════════════════════════════════════════
   GH-F02 — VALIDACIÓN DE REFERENCIAS · lista general
   ════════════════════════════════════════════════════════════ */
async function renderValidaciones() {
  const panel = document.getElementById('panelValidaciones');
  if (!panel) return;
  panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Cargando...</div></div>';

  const datos = await ValidacionReferencias.getAll();

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div style="font-size:13px;color:var(--text-muted)">${datos.length} registros</div>
      <div style="font-size:12px;color:var(--text-muted)">💡 Las referencias se crean desde el detalle de una requisición</div>
    </div>
    ${datos.length?`
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>No.</th><th>Candidato</th><th>Cargo aspira</th><th>Requisición</th>
              <th>Responsable</th><th>F. Verificación</th><th>Concepto</th><th>Estado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          ${datos.map(v=>`
          <tr>
            <td style="font-family:monospace;font-size:12px;color:var(--accent)">${v.numero}</td>
            <td style="font-weight:600">${v.candidato_nombre}</td>
            <td style="font-size:12px">${v.cargo_aspira}</td>
            <td style="font-family:monospace;font-size:11px">${v.requisicion_num||'—'}</td>
            <td style="font-size:12px">${v.responsable}</td>
            <td>${fmtDate(v.fecha_verificacion)}</td>
            <td>${badgeConcepto(v.concepto)}</td>
            <td>${badgeVR(v.estado)}</td>
            <td>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px"
                        onclick="verValidacion('${v.id}')">👁 Ver / Editar</button>
                ${v.estado === 'cerrada' && (v.concepto === 'favorable' || v.concepto === 'favorable_con_obs') ? `
                <button class="btn" style="padding:5px 8px;font-size:11px;
                        background:rgba(58,170,128,0.2);color:#4ab896;font-weight:600;white-space:nowrap"
                        onclick="crearOrdenDesdeVR('${v.id}','${v.requisicion_id||''}','${v.candidato_id||''}')">
                  📋 Crear orden
                </button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`:`<div class="empty-state"><div class="empty-state-icon">🔍</div>
    <div class="empty-state-text">Sin validaciones de referencias</div>
    <div class="empty-state-sub">Créalas desde el detalle de una requisición → candidato → Referencias</div></div>`}`;
}

/* ════════════════════════════════════════════════════════════
   MODAL NUEVA VALIDACIÓN DE REFERENCIAS
   ════════════════════════════════════════════════════════════ */
async function abrirModalVR(candidatoId, reqId, candidatoNombre, cargo, reqNum) {
  // Verificar autorización de datos del candidato
  const candidato = (await Candidatos.getByRequisicion(reqId)).find(c => c.id === candidatoId);
  if (candidato && !candidato.autorizacion_datos) {
    if (!confirm('⚠️ El candidato no tiene autorización de tratamiento de datos registrada.\n\n' +
                 'Según la Ley 1581/2012, debe obtenerse antes de verificar referencias.\n\n¿Continuar de todas formas?')) return;
  }

  // ¿Ya existe una validación para este candidato?
  const existentes = await ValidacionReferencias.getAll({ candidato_id: candidatoId });
  if (existentes.length) {
    verValidacion(existentes[0].id);
    return;
  }

  const html = `
  <div class="modal-overlay open" id="modalNuevaVR">
    <div class="modal" style="max-width:480px;width:95vw">
      <div class="modal-header">
        <div class="modal-title">🔍 Nueva Validación de Referencias</div>
        <button class="modal-close" onclick="cerrar('modalNuevaVR')">✕</button>
      </div>
      <div class="modal-body">
        <div style="padding:12px;background:rgba(58,130,200,0.08);border-radius:8px;margin-bottom:16px;font-size:13px">
          <strong>${candidatoNombre}</strong> · ${cargo} · ${reqNum}
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Tipo de documento</label>
            <select class="form-select" id="vrTipoId">
              <option value="CC">CC</option><option value="CE">CE</option><option value="PPT">PPT</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Número de documento <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="vrNumId" value="${candidato?.numero_id||''}">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Fecha de verificación <span class="req-star">*</span></label>
            <input type="date" class="form-input" id="vrFecha" value="${today()}">
          </div>
          <div class="form-group">
            <label class="form-label">Responsable de la verificación <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="vrResponsable" placeholder="Nombre del verificador">
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
            <input type="checkbox" id="vrAutorizacion" ${candidato?.autorizacion_datos?'checked':''}>
            Autorización de verificación firmada por el candidato
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrar('modalNuevaVR')">Cancelar</button>
        <button class="btn btn-primary" onclick="crearValidacion('${candidatoId}','${reqId}','${candidatoNombre.replace(/'/g,"\\'")}','${cargo.replace(/'/g,"\\'")}','${reqNum}')">💾 Crear y continuar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalNuevaVR');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

async function crearValidacion(candidatoId, reqId, candidatoNombre, cargo, reqNum) {
  const numId       = fv('vrNumId').trim();
  const fecha       = fv('vrFecha');
  const responsable = fv('vrResponsable').trim();
  if (!numId||!fecha||!responsable) { toast('Complete los campos obligatorios', 'warning'); return; }

  showLoading(true);
  const vr = await ValidacionReferencias.insert({
    requisicion_id: reqId, requisicion_num: reqNum,
    candidato_id: candidatoId, candidato_nombre: candidatoNombre,
    tipo_id: fv('vrTipoId'), numero_id: numId,
    cargo_aspira: cargo,
    autorizacion_firmada: fc('vrAutorizacion'),
    fecha_verificacion: fecha, responsable,
  });
  showLoading(false);

  if (vr) {
    toast(`Validación ${vr.numero} creada`, 'success');
    cerrar('modalNuevaVR');
    verValidacion(vr.id);
  }
}

/* ════════════════════════════════════════════════════════════
   VER / EDITAR VALIDACIÓN (con referencias y concepto final)
   ════════════════════════════════════════════════════════════ */
let _vrId = null;

async function verValidacion(vrId) {
  _vrId = vrId;
  const [vr, refPers, refLab] = await Promise.all([
    ValidacionReferencias.getById(vrId),
    ValidacionReferencias.getPersonales(vrId),
    ValidacionReferencias.getLaborales(vrId),
  ]);
  if (!vr) return;
  const isCerrada = vr.estado === 'cerrada';

  const buildRefPersRow = (r) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600;font-size:13px">${r.nombre_referencia} <span style="color:var(--text-muted);font-weight:400">(${r.relacion||'—'})</span></div>
        ${!isCerrada?`<button class="btn btn-secondary" style="padding:3px 8px;font-size:11px" onclick="eliminarRefPersonal('${r.id}','${vrId}')">🗑</button>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:var(--text-secondary)">
        <div>📞 ${r.telefono||'—'}</div>
        <div>⏱ ${r.tiempo_conoce||'—'}</div>
        <div>✔ Responsable: ${r.es_responsable?'Sí':'No'}</div>
        <div>🏠 Dirección: ${r.conoce_direccion||'—'}</div>
        <div>👍 Recomienda: ${r.recomienda||'—'}</div>
        <div>📡 Contacto: ${LBL.resultado_personal[r.resultado_contacto]||r.resultado_contacto||'—'}</div>
      </div>
      ${r.descripcion_persona?`<div style="font-size:12px;color:var(--text-muted);margin-top:4px">"${r.descripcion_persona}"</div>`:''}
    </div>`;

  const buildRefLabRow = (r) => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600;font-size:13px">${r.empresa}</div>
        ${!isCerrada?`<button class="btn btn-secondary" style="padding:3px 8px;font-size:11px" onclick="eliminarRefLaboral('${r.id}','${vrId}')">🗑</button>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:var(--text-secondary)">
        <div>👤 ${r.nombre_contacto||'—'} (${r.cargo_contacto||'—'})</div>
        <div>📞 ${r.telefono||'—'}</div>
        <div>💼 Cargo: ${r.cargo_candidato||'—'}</div>
        <div>📅 ${fmtDate(r.fecha_ingreso)} → ${fmtDate(r.fecha_retiro)}</div>
        <div>📊 Desempeño: ${r.desempeno||'—'}</div>
        <div>⏰ Puntualidad: ${r.puntualidad||'—'}</div>
        <div>🤝 Relaciones: ${r.relacion_jefes||'—'}</div>
        <div>🔄 Recontrata: ${r.volveria_contratar?'Sí':'No'}</div>
        <div>📋 Coincide HV: ${r.coincide_hv?'Sí':'No'}</div>
        <div>📡 Contacto: ${LBL.resultado_laboral[r.resultado_contacto]||r.resultado_contacto||'—'}</div>
      </div>
      ${r.tuvo_disciplinarios?`<div style="font-size:12px;color:var(--warning);margin-top:4px">⚠️ Disciplinarios: ${r.obs_disciplinarios||'Sí'}</div>`:''}
      ${!r.coincide_hv?`<div style="font-size:12px;color:var(--danger);margin-top:4px">⚠️ Información no coincide con la HV</div>`:''}
    </div>`;

  const html = `
  <div class="modal-overlay open" id="modalVerVR">
    <div class="modal" style="max-width:780px;width:95vw;max-height:92vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-title">🔍 ${vr.numero} · ${vr.candidato_nombre} ${badgeVR(vr.estado)} ${badgeConcepto(vr.concepto)}</div>
        <button class="modal-close" onclick="cerrar('modalVerVR')">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:16px">
          <div class="detail-row"><span class="detail-label">Cargo aspira</span><span class="detail-val">${vr.cargo_aspira}</span></div>
          <div class="detail-row"><span class="detail-label">Requisición</span><span class="detail-val" style="font-family:monospace">${vr.requisicion_num||'—'}</span></div>
          <div class="detail-row"><span class="detail-label">Responsable</span><span class="detail-val">${vr.responsable}</span></div>
          <div class="detail-row"><span class="detail-label">Fecha verificación</span><span class="detail-val">${fmtDate(vr.fecha_verificacion)}</span></div>
          <div class="detail-row"><span class="detail-label">Autorización firmada</span><span class="detail-val">${vr.autorizacion_firmada?'✅ Sí':'⚠️ No'}</span></div>
        </div>

        <!-- REFERENCIAS PERSONALES -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="form-section-title" style="margin:0">👥 Referencias personales (${refPers.length}/mín.2)</div>
          ${!isCerrada?`<button class="btn btn-secondary" style="padding:5px 10px;font-size:12px"
                  onclick="abrirFormRefPersonal('${vrId}')">➕ Agregar</button>`:''}
        </div>
        <div id="listRefPers">
          ${refPers.length?refPers.map(buildRefPersRow).join(''):`<div style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Sin referencias personales</div>`}
        </div>
        <div id="formRefPersonal" style="display:none"></div>

        <!-- REFERENCIAS LABORALES -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;margin-top:20px">
          <div class="form-section-title" style="margin:0">🏢 Referencias laborales (${refLab.length})</div>
          ${!isCerrada?`<button class="btn btn-secondary" style="padding:5px 10px;font-size:12px"
                  onclick="abrirFormRefLaboral('${vrId}')">➕ Agregar</button>`:''}
        </div>
        <div id="listRefLab">
          ${refLab.length?refLab.map(buildRefLabRow).join(''):`<div style="color:var(--text-muted);font-size:13px;margin-bottom:12px">Sin referencias laborales</div>`}
        </div>
        <div id="formRefLaboral" style="display:none"></div>

        <!-- CONCEPTO FINAL -->
        ${!isCerrada?`
        <div class="form-section-title" style="margin-top:24px">📝 Concepto final</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Concepto <span class="req-star">*</span></label>
            <select class="form-select" id="vrConcepto">
              ${selectOpts(LBL.concepto_vr, vr.concepto, 'Seleccione concepto...')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Inconsistencias encontradas</label>
          <textarea class="form-input" id="vrInconsistencias" rows="2">${vr.inconsistencias||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones generales</label>
          <textarea class="form-input" id="vrObs" rows="2">${vr.observaciones||''}</textarea>
        </div>
        <div class="form-group" id="grpObsGH" style="display:none">
          <label class="form-label">Observación de Gestión Humana <span class="req-star">*</span> <span style="color:var(--warning);font-size:11px">(requerida por referencia no favorable)</span></label>
          <textarea class="form-input" id="vrObsGH" rows="2">${vr.obs_gh||''}</textarea>
        </div>`:`
        <div class="form-section-title" style="margin-top:20px">📝 Concepto final</div>
        <div style="display:flex;gap:12px;align-items:center;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px">
          ${badgeConcepto(vr.concepto)}
          ${vr.inconsistencias?`<span style="font-size:13px;color:var(--text-secondary)">${vr.inconsistencias}</span>`:''}
        </div>
        ${vr.obs_gh?`<div style="margin-top:8px;padding:10px;background:rgba(200,124,58,0.1);border-radius:8px;font-size:13px"><strong>Obs. GH:</strong> ${vr.obs_gh}</div>`:''}
        `}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrar('modalVerVR')">Cerrar</button>
        ${!isCerrada ? `<button class="btn btn-primary" onclick="cerrarValidacion('${vrId}')">🔒 Cerrar validación</button>` : ''}
        ${isCerrada && (vr.concepto === 'favorable' || vr.concepto === 'favorable_con_obs') ? `
        <button class="btn" style="background:rgba(58,170,128,0.2);color:#4ab896;font-weight:600;border:1px solid rgba(58,170,128,0.3)"
                onclick="cerrar('modalVerVR');crearOrdenDesdeVR('${vrId}','${vr.requisicion_id||''}','${vr.candidato_id||''}')">
          📋 Crear orden de contrato
        </button>` : ''}
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalVerVR');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

  // Listener concepto → mostrar obs GH
  const sel = document.getElementById('vrConcepto');
  if (sel) {
    sel.addEventListener('change', () => {
      show('grpObsGH', sel.value === 'no_favorable');
    });
  }
}

async function cerrarValidacion(vrId) {
  const concepto = fv('vrConcepto');
  const inconsist = fv('vrInconsistencias');
  const obs      = fv('vrObs');
  const obsGH    = fv('vrObsGH');
  const responsable = document.querySelector('#modalVerVR .detail-val')?.textContent || '';

  if (!concepto) { toast('Seleccione un concepto final', 'warning'); return; }

  // Validar mínimo 2 referencias personales
  const refPers = await ValidacionReferencias.getPersonales(vrId);
  if (refPers.length < 2) { toast('Se requieren al menos 2 referencias personales para cerrar', 'warning'); return; }

  showLoading(true);
  const ok = await ValidacionReferencias.cerrar(vrId, concepto, inconsist, obs, obsGH, responsable);
  showLoading(false);

  if (ok) {
    toast(`Validación cerrada con concepto: ${LBL.concepto_vr[concepto]}`, 'success');
    cerrar('modalVerVR');
    renderValidaciones();
  }
}

/* Formularios inline de referencias */
function abrirFormRefPersonal(vrId) {
  const div = document.getElementById('formRefPersonal');
  if (!div) return;
  div.style.display = 'block';
  div.innerHTML = `
    <div style="border:1px dashed var(--accent);border-radius:10px;padding:16px;margin-bottom:12px;background:rgba(58,130,200,0.05)">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--accent)">➕ Nueva referencia personal</div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Nombre <span class="req-star">*</span></label>
          <input type="text" class="form-input" id="rpNombre"></div>
        <div class="form-group"><label class="form-label">Teléfono</label>
          <input type="text" class="form-input" id="rpTelefono"></div>
        <div class="form-group"><label class="form-label">Relación</label>
          <select class="form-select" id="rpRelacion">
            <option value="">—</option><option value="amigo">Amigo</option>
            <option value="vecino">Vecino</option><option value="excompanero">Ex compañero</option>
            <option value="otro">Otro</option></select></div>
        <div class="form-group"><label class="form-label">¿Hace cuánto lo conoce?</label>
          <input type="text" class="form-input" id="rpTiempoConoce"></div>
        <div class="form-group"><label class="form-label">¿Lo recomendaría?</label>
          <select class="form-select" id="rpRecomienda">
            <option value="">—</option><option value="si">Sí</option>
            <option value="no">No</option><option value="con_reservas">Con reservas</option></select></div>
        <div class="form-group"><label class="form-label">Resultado del contacto</label>
          <select class="form-select" id="rpResultado">
            ${selectOpts(LBL.resultado_personal,'')}</select></div>
      </div>
      <div class="form-group"><label class="form-label">¿Cómo lo describiría como persona?</label>
        <textarea class="form-input" id="rpDescripcion" rows="2"></textarea></div>
      <div class="form-grid-2">
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
            <input type="checkbox" id="rpResponsable"> ¿Es responsable y honesto?</label></div>
        <div class="form-group"><label class="form-label">¿Conoce dónde vive el candidato?</label>
          <input type="text" class="form-input" id="rpDireccion" placeholder="Confirma la dirección reportada"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="show('formRefPersonal',false)">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarRefPersonal('${vrId}')">💾 Guardar</button>
      </div>
    </div>`;
}

async function guardarRefPersonal(vrId) {
  const nombre = fv('rpNombre').trim();
  if (!nombre) { toast('El nombre es obligatorio', 'warning'); return; }
  showLoading(true);
  const ok = await ValidacionReferencias.insertPersonal({
    validacion_id: vrId, nombre_referencia: nombre,
    telefono: fv('rpTelefono')||null, relacion: fv('rpRelacion')||null,
    tiempo_conoce: fv('rpTiempoConoce')||null,
    descripcion_persona: fv('rpDescripcion')||null,
    es_responsable: fc('rpResponsable'), conoce_direccion: fv('rpDireccion')||null,
    recomienda: fv('rpRecomienda')||null, resultado_contacto: fv('rpResultado')||null,
  });
  showLoading(false);
  if (ok) { toast('Referencia personal guardada', 'success'); verValidacion(vrId); }
}

function abrirFormRefLaboral(vrId) {
  const div = document.getElementById('formRefLaboral');
  if (!div) return;
  div.style.display = 'block';
  div.innerHTML = `
    <div style="border:1px dashed var(--accent3);border-radius:10px;padding:16px;margin-bottom:12px;background:rgba(74,184,160,0.05)">
      <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--accent3)">➕ Nueva referencia laboral</div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Empresa <span class="req-star">*</span></label>
          <input type="text" class="form-input" id="rlEmpresa"></div>
        <div class="form-group"><label class="form-label">Nombre de quien da la referencia</label>
          <input type="text" class="form-input" id="rlNombreContacto"></div>
        <div class="form-group"><label class="form-label">Cargo de quien da la referencia</label>
          <input type="text" class="form-input" id="rlCargoContacto"></div>
        <div class="form-group"><label class="form-label">Teléfono</label>
          <input type="text" class="form-input" id="rlTelefono"></div>
        <div class="form-group"><label class="form-label">Cargo del candidato en esa empresa</label>
          <input type="text" class="form-input" id="rlCargoCandidato"></div>
        <div class="form-group"><label class="form-label">Motivo de retiro</label>
          <select class="form-select" id="rlMotivoRetiro">${selectOpts(LBL.motivo_retiro,'')}</select></div>
        <div class="form-group"><label class="form-label">Fecha de ingreso</label>
          <input type="date" class="form-input" id="rlFechaIngreso"></div>
        <div class="form-group"><label class="form-label">Fecha de retiro</label>
          <input type="date" class="form-input" id="rlFechaRetiro"></div>
        <div class="form-group"><label class="form-label">Desempeño general</label>
          <select class="form-select" id="rlDesempeno">${selectOpts(LBL.desempeno,'')}</select></div>
        <div class="form-group"><label class="form-label">Puntualidad y asistencia</label>
          <select class="form-select" id="rlPuntualidad">${selectOpts(LBL.desempeno,'')}</select></div>
        <div class="form-group"><label class="form-label">Relación con jefes y compañeros</label>
          <select class="form-select" id="rlRelaciones">${selectOpts(LBL.desempeno,'')}</select></div>
        <div class="form-group"><label class="form-label">Resultado del contacto</label>
          <select class="form-select" id="rlResultado">${selectOpts(LBL.resultado_laboral,'')}</select></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
          <input type="checkbox" id="rlDisciplinarios"> Tuvo procesos disciplinarios</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
          <input type="checkbox" id="rlVolveriaContratar" checked> ¿Lo volvería a contratar?</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;color:var(--text-secondary)">
          <input type="checkbox" id="rlCoincideHV" checked> ¿Información coincide con HV?</label>
      </div>
      <div class="form-group"><label class="form-label">Observaciones disciplinarias / motivo no contratar</label>
        <textarea class="form-input" id="rlObsDisciplinarios" rows="2"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="show('formRefLaboral',false)">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarRefLaboral('${vrId}')">💾 Guardar</button>
      </div>
    </div>`;
}

async function guardarRefLaboral(vrId) {
  const empresa = fv('rlEmpresa').trim();
  if (!empresa) { toast('El nombre de la empresa es obligatorio', 'warning'); return; }
  showLoading(true);
  const ok = await ValidacionReferencias.insertLaboral({
    validacion_id: vrId, empresa,
    nombre_contacto: fv('rlNombreContacto')||null, cargo_contacto: fv('rlCargoContacto')||null,
    telefono: fv('rlTelefono')||null, cargo_candidato: fv('rlCargoCandidato')||null,
    fecha_ingreso: fv('rlFechaIngreso')||null, fecha_retiro: fv('rlFechaRetiro')||null,
    motivo_retiro: fv('rlMotivoRetiro')||null, desempeno: fv('rlDesempeno')||null,
    puntualidad: fv('rlPuntualidad')||null, relacion_jefes: fv('rlRelaciones')||null,
    tuvo_disciplinarios: fc('rlDisciplinarios'),
    obs_disciplinarios: fv('rlObsDisciplinarios')||null,
    volveria_contratar: fc('rlVolveriaContratar'),
    coincide_hv: fc('rlCoincideHV'),
    resultado_contacto: fv('rlResultado')||null,
  });
  showLoading(false);
  if (ok) { toast('Referencia laboral guardada', 'success'); verValidacion(vrId); }
}

async function eliminarRefPersonal(id, vrId) {
  if (!confirm('¿Eliminar esta referencia personal?')) return;
  showLoading(true);
  await ValidacionReferencias.deletePersonal(id);
  showLoading(false);
  verValidacion(vrId);
}

async function eliminarRefLaboral(id, vrId) {
  if (!confirm('¿Eliminar esta referencia laboral?')) return;
  showLoading(true);
  await ValidacionReferencias.deleteLaboral(id);
  showLoading(false);
  verValidacion(vrId);
}

/* ════════════════════════════════════════════════════════════
   GH-F03 — ÓRDENES DE CONTRATACIÓN · lista general
   ════════════════════════════════════════════════════════════ */
async function renderOrdenes() {
  const panel = document.getElementById('panelOrdenes');
  if (!panel) return;
  panel.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div>Cargando...</div></div>';

  const datos = await OrdenContratacion.getAll();

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="filter-select" id="fOCEstado" onchange="renderOrdenesFiltered()">
          <option value="">Todos los estados</option>
          ${Object.entries(LBL.estado_oc).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
        </select>
        <select class="filter-select" id="fOCEmpresa" onchange="renderOrdenesFiltered()">
          <option value="">Ambas empresas</option>
          <option value="TYM">TYM</option><option value="TAT">TAT</option>
        </select>
      </div>
      <div style="font-size:12px;color:var(--text-muted)">💡 Las órdenes se crean desde el detalle de una requisición → candidato → Orden</div>
    </div>
    <div id="ocTableWrap"></div>`;

  _ocDatos = datos;
  renderOrdenesFiltered();
}

let _ocDatos = [];
function renderOrdenesFiltered() {
  const estado  = fv('fOCEstado');
  const empresa = fv('fOCEmpresa');
  const filtrado = _ocDatos.filter(o => {
    if (estado  && o.estado  !== estado)  return false;
    if (empresa && o.empresa !== empresa) return false;
    return true;
  });
  const wrap = document.getElementById('ocTableWrap');
  if (!wrap) return;
  if (!filtrado.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div>
      <div class="empty-state-text">No hay órdenes con estos filtros</div></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>No.</th><th>Empresa</th><th>Candidato</th><th>Cargo</th><th>Área</th>
              <th>F. Ingreso</th><th>Tipo contrato</th><th>Salario</th><th>Estado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          ${filtrado.map(o=>`
          <tr>
            <td style="font-family:monospace;font-size:12px;color:var(--accent)">${o.numero}</td>
            <td><span class="chip">${o.empresa}</span></td>
            <td style="font-weight:600">${o.nombres}</td>
            <td style="font-size:12px">${o.cargo}</td>
            <td style="font-size:12px">${o.area}</td>
            <td>${fmtDate(o.fecha_ingreso)}</td>
            <td style="font-size:12px">${LBL.tipo_contrato[o.tipo_contrato]||o.tipo_contrato}</td>
            <td style="font-size:12px">${fmtCOP(o.salario)}</td>
            <td>${badgeOC(o.estado)}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px"
                        onclick="verOrden('${o.id}')">👁 Ver</button>
                ${o.estado==='borrador'?`
                <button class="btn btn-primary" style="padding:5px 8px;font-size:11px"
                        onclick="abrirModalOrden('${o.id}')">✏️</button>
                <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px;background:rgba(58,170,128,0.2);color:var(--success)"
                        onclick="enviarAprobacionOC('${o.id}')">📨 Enviar</button>`:''}
                ${o.estado==='pendiente_aprobacion'?`
                <button class="btn" style="padding:5px 8px;font-size:11px;background:rgba(58,170,128,0.2);color:var(--success)"
                        onclick="abrirModalAprobacionOC('${o.id}')">✔ Aprobar</button>`:''}
                ${!['anulada','contrato_generado'].includes(o.estado)?`
                <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px;color:var(--danger)"
                        onclick="anularOrden('${o.id}')">🚫</button>`:''}
                <button class="btn btn-secondary" style="padding:5px 8px;font-size:11px;background:rgba(130,80,200,0.18);color:#a78bfa"
                        onclick="abrirModalPortalCandidato('${o.id}')">📲 Portal</button>              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:8px">${filtrado.length} registros</div>`;
}

async function enviarAprobacionOC(ocId) {
  showLoading(true);
  await OrdenContratacion.update(ocId, { estado: 'pendiente_aprobacion' });
  showLoading(false);
  toast('Orden enviada a aprobación', 'info');
  renderOrdenes();
}

async function anularOrden(ocId) {
  const motivo = prompt('Motivo de anulación (obligatorio):');
  if (!motivo) return;
  showLoading(true);
  const ok = await OrdenContratacion.anular(ocId, motivo, 'Sistema');
  showLoading(false);
  if (ok) { toast('Orden anulada', 'warning'); renderOrdenes(); }
}

/* ════════════════════════════════════════════════════════════
   MODAL ORDEN DE CONTRATACIÓN (GH-F03)
   ════════════════════════════════════════════════════════════ */
let _ocEditId = null;

async function crearOrdenDesdeCandidato(reqId, candidatoId) {
  cerrar('modalVerReq');
  await abrirModalOrden(null, reqId, candidatoId);
}

async function crearOrdenDesdeVR(vrId, reqId, candidatoId) {
  // Si tenemos todos los datos, abrir directo
  if (reqId && candidatoId) {
    await abrirModalOrden(null, reqId, candidatoId);
    return;
  }
  // Si faltan datos, cargar la VR primero
  showLoading(true);
  const vr = await ValidacionReferencias.getById(vrId);
  showLoading(false);
  if (!vr) { toast('No se encontró la validación', 'error'); return; }
  await abrirModalOrden(null, vr.requisicion_id, vr.candidato_id);
}

async function abrirModalOrden(ocId = null, reqIdPre = null, candidatoIdPre = null) {
  _ocEditId = ocId;
  _paramVigente = _paramVigente || await MaestrasContratacion.getParametroVigente();

  const [sedes, eps, afp, cesantias, arl, cajas, bancos] = await Promise.all([
    MaestrasContratacion.getSedes(),
    MaestrasContratacion.getEPS(),
    MaestrasContratacion.getAFP(),
    MaestrasContratacion.getCesantias(),
    MaestrasContratacion.getARL(),
    MaestrasContratacion.getCajas(),
    MaestrasContratacion.getBancos(),
  ]);

  let d = {};
  let req = null;
  let candidato = null;

  if (ocId) {
    d = await OrdenContratacion.getById(ocId) || {};
    if (d.requisicion_id) req = await Requisicion.getById(d.requisicion_id);
  } else if (reqIdPre) {
    req = await Requisicion.getById(reqIdPre);
    if (candidatoIdPre) {
      const cands = await Candidatos.getByRequisicion(reqIdPre);
      candidato = cands.find(c => c.id === candidatoIdPre);
    }
    if (req) {
      d = {
        empresa: req.empresa, cargo: req.cargo_nombre, area: req.area,
        jefe_inmediato: req.jefe_inmediato, tipo_contrato: req.tipo_contrato,
        duracion_meses: req.duracion_meses, salario: req.salario,
        auxilio_transporte: req.auxilio_transporte, tipo_salario: 'ordinario',
        nivel_riesgo_arl: req.nivel_riesgo_arl, sede_id: req.sede_id, sede_nombre: req.sede_nombre,
        requisicion_id: req.id, requisicion_num: req.numero,
      };
    }
    if (candidato) {
      d.candidato_id = candidato.id;
      d.nombres = candidato.nombre;
      d.tipo_id = candidato.tipo_id;
      d.numero_id = candidato.numero_id;
      d.telefono = candidato.telefono;
      d.email = candidato.email;
    }
  }

  const isReadOnly = ['aprobada','contrato_generado','anulada'].includes(d.estado);

  const CHECKLIST_ITEMS = [
    { key:'hv',              label:'Hoja de Vida' },
    { key:'cedula',          label:'Fotocopia de la Cédula' },
    { key:'acta_grado',      label:'Fotocopia Acta de Grado y Diplomas' },
    { key:'antecedentes',    label:'Antecedentes Contraloría, Procuraduría y Policía' },
    { key:'eps',             label:'Certificado de E.P.S.' },
    { key:'afp',             label:'Certificado de A.F.P.' },
    { key:'ref_laborales',   label:'2 - Referencias Laborales' },
    { key:'ref_personales',  label:'2 - Referencias Personales' },
    { key:'foto',            label:'Foto fondo blanco' },
    { key:'carnet_covid',    label:'Carnet COVID - 19' },
    { key:'carnet_alimentos',label:'Carnet de Manipulación de Alimentos (vigencia mayor a 6 meses)' },
    { key:'cuenta_bancaria', label:'Constancia de Apertura de Cuenta' },
    { key:'soat',            label:'Copia Soat, Tecnomecánica, Licencia de Conducción y Tarjeta de Propiedad' },
    { key:'funeraria',       label:'Certificado Funerario' },
  ];
  const checklist = d.checklist || {};

  const checklistOpts = (key, isExamen=false) => {
    const estados = isExamen
      ? { apto:'Apto', apto_con_restricciones:'Apto con restricciones', no_apto:'No apto' }
      : key==='vr'
        ? { cumple:'✅ Cumple', no_cumple:'❌ No cumple' }
        : { recibido:'✅ Recibido', pendiente:'⏳ Pendiente', no_aplica:'N/A' };
    return selectOpts(estados, checklist[key]||'', 'Pendiente');
  };

  const html = `
  <div class="modal-overlay open" id="modalOrden">
    <div class="modal" style="max-width:860px;width:95vw;max-height:92vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-title">${ocId?(isReadOnly?'👁 Ver':'✏️ Editar'):'➕ Nueva'} Orden de Contratación <span style="font-size:12px;color:var(--accent);font-family:monospace">${d.numero||'GH-F03'}</span></div>
        <button class="modal-close" onclick="cerrarModalOrden()">✕</button>
      </div>
      <div class="modal-body">

        ${req?`<div style="padding:10px 14px;background:rgba(58,130,200,0.08);border-radius:8px;margin-bottom:16px;font-size:13px">
          📋 Requisición: <strong style="font-family:monospace">${req.numero}</strong> · ${req.cargo_nombre} · ${req.empresa}</div>
          <input type="hidden" name="ocReqId"  value="${req?.id||d.requisicion_id||''}">
          <input type="hidden" name="ocReqNum" value="${req?.numero||d.requisicion_num||''}">
          <input type="hidden" name="ocCandId" value="${candidato?.id||d.candidato_id||''}">
          `:`<input type="hidden" name="ocReqId"  value="${d.requisicion_id||''}">
          <input type="hidden" name="ocReqNum" value="${d.requisicion_num||''}">
          <input type="hidden" name="ocCandId" value="${d.candidato_id||''}">`}
        <div class="form-section-title">👤 5.1 Datos del seleccionado</div>
        <div class="form-grid-2">
          <div class="form-group"><label class="form-label">Nombres y apellidos <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocNombres" value="${d.nombres||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Tipo de documento</label>
            <select class="form-select" id="ocTipoId" ${isReadOnly?'disabled':''}>
              <option value="CC" ${d.tipo_id==='CC'?'selected':''}>CC</option>
              <option value="CE" ${d.tipo_id==='CE'?'selected':''}>CE</option>
              <option value="PPT" ${d.tipo_id==='PPT'?'selected':''}>PPT</option>
            </select></div>
          <div class="form-group"><label class="form-label">Número de documento <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocNumId" value="${d.numero_id||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Lugar de expedición</label>
            ${ciudadSelectHtml('ocLugarExp', d.lugar_expedicion||'', isReadOnly)}</div>
          <div class="form-group"><label class="form-label">Fecha de expedición</label>
            <input type="date" class="form-input" id="ocFechaExp" value="${d.fecha_expedicion||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Fecha de nacimiento</label>
            <input type="date" class="form-input" id="ocFechaNac" value="${d.fecha_nacimiento||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Lugar de nacimiento</label>
            ${ciudadSelectHtml('ocLugarNac', d.lugar_nacimiento||'', isReadOnly)}</div>
          <div class="form-group"><label class="form-label">Dirección <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocDireccion" value="${d.direccion||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Barrio</label>
            <input type="text" class="form-input" id="ocBarrio" value="${d.barrio||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Ciudad <span class="req-star">*</span></label>
            ${ciudadSelectHtml('ocCiudad', d.ciudad||'', isReadOnly)}</div>
          <div class="form-group"><label class="form-label">Teléfono <span class="req-star">*</span></label>
            <input type="tel" class="form-input" id="ocTelefono" value="${d.telefono||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Correo electrónico <span class="req-star">*</span></label>
            <input type="email" class="form-input" id="ocEmail" value="${d.email||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Estado civil</label>
            <select class="form-select" id="ocEstadoCivil" ${isReadOnly?'disabled':''}>
              ${selectOpts({soltero:'Soltero(a)',casado:'Casado(a)',unionlibre:'Unión libre',divorciado:'Divorciado(a)',viudo:'Viudo(a)'}, d.estado_civil, 'Sin especificar')}
            </select></div>
        </div>
        <div class="form-grid-2">
          <div class="form-group"><label class="form-label">Contacto de emergencia <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocContactoEmerg" value="${d.contacto_emergencia||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Parentesco</label>
            <select class="form-select" id="ocParentesco" ${isReadOnly?'disabled':''}>
              ${selectOpts(PARENTESCOS, d.parentesco_emergencia||'', 'Seleccione...')}
            </select></div>
          <div class="form-group"><label class="form-label">Teléfono de emergencia</label>
            <input type="tel" class="form-input" id="ocTelEmerg" value="${d.telefono_emergencia||''}" ${isReadOnly?'readonly':''}></div>
        </div>
        <div id="grpTallas" ${req?.requiere_dotacion||d.talla_camisa?'':'style="display:none"'}>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">👕 Tallas (si recibe dotación)</div>
          <div class="form-grid-2" style="max-width:480px">
            <div class="form-group"><label class="form-label">Talla camisa</label>
              <input type="text" class="form-input" id="ocTallaCamisa" value="${d.talla_camisa||''}" placeholder="XS/S/M/L/XL" ${isReadOnly?'readonly':''}></div>
            <div class="form-group"><label class="form-label">Talla pantalón</label>
              <input type="text" class="form-input" id="ocTallaPantalon" value="${d.talla_pantalon||''}" ${isReadOnly?'readonly':''}></div>
            <div class="form-group"><label class="form-label">Talla calzado</label>
              <input type="text" class="form-input" id="ocTallaCalzado" value="${d.talla_calzado||''}" ${isReadOnly?'readonly':''}></div>
          </div>
        </div>

        <div class="form-section-title" style="margin-top:20px">💼 5.2 Condiciones del contrato</div>
        <div class="form-grid-2">
          <div class="form-group"><label class="form-label">Empresa empleadora <span class="req-star">*</span></label>
            <select class="form-select" id="ocEmpresa" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.empresa, d.empresa)}</select></div>
          <div class="form-group"><label class="form-label">Cargo <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocCargo" value="${d.cargo||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Área <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocArea" value="${d.area||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Jefe inmediato <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocJefe" value="${d.jefe_inmediato||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Tipo de contrato <span class="req-star">*</span></label>
            <select class="form-select" id="ocTipoContrato" onchange="toggleOCFechaTerminacion()" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.tipo_contrato, d.tipo_contrato)}</select></div>
          <div class="form-group"><label class="form-label">Fecha de ingreso <span class="req-star">*</span></label>
            <input type="date" class="form-input" id="ocFechaIngreso" value="${d.fecha_ingreso||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group" id="grpFechaTermOC" style="display:none">
            <label class="form-label">Fecha de terminación</label>
            <input type="date" class="form-input" id="ocFechaTerminacion" value="${d.fecha_terminacion||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Periodo de prueba (días) <span class="req-star">*</span> <span style="font-size:11px;color:var(--text-muted)">(máx. 60)</span></label>
            <input type="number" class="form-input" id="ocPeriodoPrueba" value="${d.periodo_prueba_dias||60}" min="0" max="60" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Salario básico mensual (COP) <span class="req-star">*</span></label>
            <input type="number" class="form-input" id="ocSalario" value="${d.salario||''}" oninput="calcAuxTransporteOC()" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Tipo de salario</label>
            <select class="form-select" id="ocTipoSalario" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.tipo_salario, d.tipo_salario||'ordinario')}</select></div>
          <div class="form-group"><label class="form-label">Auxilio de transporte</label>
            <select class="form-select" id="ocAuxTransporte" ${isReadOnly?'disabled':''}>
              <option value="true"  ${d.auxilio_transporte===true?'selected':''}>Sí</option>
              <option value="false" ${d.auxilio_transporte===false?'selected':''}>No</option>
            </select>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px" id="auxHintOC"></div></div>
          <div class="form-group"><label class="form-label">Otros pagos / beneficios</label>
            <input type="text" class="form-input" id="ocOtrosPagos" value="${d.otros_pagos||''}" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Jornada / Horario <span class="req-star">*</span></label>
            <select class="form-select" id="ocJornada" onchange="toggleJornadaOtro()" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.jornada_oc, Object.keys(LBL.jornada_oc).includes(d.jornada) ? d.jornada : (d.jornada?'Otro':''), 'Seleccione jornada...')}
            </select></div>
          <div class="form-group" id="grpJornadaOtro" style="display:none">
            <label class="form-label">Especificar jornada</label>
            <input type="text" class="form-input" id="ocJornadaOtro" value="${(!Object.keys(LBL.jornada_oc).includes(d.jornada)&&d.jornada&&d.jornada!=='Otro')?d.jornada:''}" placeholder="Ej: Mar-Sáb 9am-5pm" ${isReadOnly?'readonly':''}></div>
          <div class="form-group"><label class="form-label">Sede / Lugar de trabajo</label>
            <select class="form-select" id="ocSede" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(sedes,'id','nombre',d.sede_id)}</select></div>
          <div class="form-group"><label class="form-label">Forma de pago <span class="req-star">*</span></label>
            <select class="form-select" id="ocFormaPago" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.forma_pago, d.forma_pago)}</select></div>
          <div class="form-group"><label class="form-label">Banco para nómina <span class="req-star">*</span></label>
            <select class="form-select" id="ocBanco" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(bancos,'id','nombre',d.banco_id)}</select></div>
          <div class="form-group"><label class="form-label">Tipo de cuenta</label>
            <select class="form-select" id="ocTipoCuenta" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.tipo_cuenta, d.tipo_cuenta)}</select></div>
          <div class="form-group"><label class="form-label">Número de cuenta <span class="req-star">*</span></label>
            <input type="text" class="form-input" id="ocNumeroCuenta" value="${d.numero_cuenta||''}" placeholder="Ej: 1234567890" ${isReadOnly?'readonly':''}></div>
        </div>

        <div class="form-section-title" style="margin-top:20px">🏥 5.3 Seguridad social y parafiscales</div>
        <div class="form-grid-2">
          <div class="form-group"><label class="form-label">EPS <span class="req-star">*</span></label>
            <select class="form-select" id="ocEPS" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(eps,'id','nombre',d.eps_id)}</select></div>
          <div class="form-group"><label class="form-label">Fondo de pensiones <span class="req-star">*</span></label>
            <select class="form-select" id="ocAFP" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(afp,'id','nombre',d.afp_id)}</select></div>
          <div class="form-group"><label class="form-label">Fondo de cesantías <span class="req-star">*</span></label>
            <select class="form-select" id="ocCesantias" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(cesantias,'id','nombre',d.cesantias_id)}</select></div>
          <div class="form-group"><label class="form-label">ARL <span class="req-star">*</span></label>
            <select class="form-select" id="ocARL" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(arl,'id','nombre',d.arl_id)}</select></div>
          <div class="form-group"><label class="form-label">Clase de riesgo ARL</label>
            <select class="form-select" id="ocClaseRiesgo" ${isReadOnly?'disabled':''}>
              ${selectOpts(LBL.nivel_riesgo, d.clase_riesgo)}</select></div>
          <div class="form-group"><label class="form-label">Caja de compensación <span class="req-star">*</span></label>
            <select class="form-select" id="ocCaja" ${isReadOnly?'disabled':''}>
              ${selectOptsArr(cajas,'id','nombre',d.caja_id)}</select></div>
        </div>

        <div class="form-section-title" style="margin-top:20px">✅ 5.4 Lista de chequeo de ingreso</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Documento / Requisito</th><th style="width:180px">Estado</th></tr></thead>
            <tbody>
              ${CHECKLIST_ITEMS.map(ci=>`
              <tr>
                <td style="font-size:13px">${ci.label}</td>
                <td><select class="form-select" id="ck_${ci.key}" ${isReadOnly?'disabled':''}>
                  ${checklistOpts(ci.key, ci.key==='examen')}
                </select></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

      </div><!-- /modal-body -->
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrarModalOrden()">Cerrar</button>
        ${!isReadOnly?`<button class="btn btn-primary" onclick="guardarOrden()">💾 Guardar orden</button>`:''}
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalOrden');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
  toggleOCFechaTerminacion();
  toggleJornadaOtro();
  calcAuxTransporteOC();
}

function toggleOCFechaTerminacion() {
  const tc = fv('ocTipoContrato');
  show('grpFechaTermOC', tc==='termino_fijo'||tc==='obra_labor');
}

function toggleJornadaOtro() {
  show('grpJornadaOtro', fv('ocJornada') === 'Otro');
}

function getJornadaOC() {
  const sel = fv('ocJornada');
  if (sel === 'Otro') return fv('ocJornadaOtro').trim() || 'Otro';
  return sel;
}

async function calcAuxTransporteOC() {
  if (!_paramVigente) return;
  const sal = parseFloat(fv('ocSalario'))||0;
  if (!sal) return;
  const aplica = ReglasContratacion.aplicaAuxTransporte(sal, _paramVigente);
  sv('ocAuxTransporte', aplica?'true':'false');
  const hint = document.getElementById('auxHintOC');
  if (hint) {
    hint.textContent = aplica ? `✅ Aplica automáticamente` : `❌ No aplica`;
    hint.style.color = aplica ? 'var(--success)' : 'var(--text-muted)';
  }
}

function cerrarModalOrden() {
  const m = document.getElementById('modalOrden');
  if (m) m.remove();
  document.body.style.overflow = '';
}

async function guardarOrden() {
  // Validaciones mínimas
  const nombres   = fv('ocNombres').trim();
  const numId     = fv('ocNumId').trim();
  const empresa   = fv('ocEmpresa');
  const cargo     = fv('ocCargo').trim();
  const area      = fv('ocArea').trim();
  const jefe      = fv('ocJefe').trim();
  const tipoC     = fv('ocTipoContrato');
  const fIngreso  = fv('ocFechaIngreso');
  const jornada   = getJornadaOC();
  const salario   = parseFloat(fv('ocSalario'))||0;
  const formaPago = fv('ocFormaPago');
  const ciudad    = fv('ocCiudad').trim();
  const direccion = fv('ocDireccion').trim();
  const telefono  = fv('ocTelefono').trim();
  const email     = fv('ocEmail').trim();
  const contactoEmerg = fv('ocContactoEmerg').trim();
  const periodo   = parseInt(fv('ocPeriodoPrueba'))||0;
  const tipoSal   = fv('ocTipoSalario');
  const durMeses  = parseInt(fv('ocDuracion'))||null;

  if (!nombres||!numId||!empresa||!cargo||!area||!jefe||!tipoC||!fIngreso||!salario||!formaPago||!ciudad||!direccion||!telefono||!email||!contactoEmerg) {
    // Identificar qué campo falta para dar mensaje útil
    const faltantes = [];
    if (!nombres)      faltantes.push('Nombres y apellidos');
    if (!numId)        faltantes.push('Número de documento');
    if (!empresa)      faltantes.push('Empresa empleadora');
    if (!cargo)        faltantes.push('Cargo');
    if (!area)         faltantes.push('Área');
    if (!jefe)         faltantes.push('Jefe inmediato');
    if (!tipoC)        faltantes.push('Tipo de contrato');
    if (!fIngreso)     faltantes.push('Fecha de ingreso');
    if (!salario)      faltantes.push('Salario');
    if (!formaPago)    faltantes.push('Forma de pago');
    if (!ciudad)       faltantes.push('Ciudad');
    if (!direccion)    faltantes.push('Dirección');
    if (!telefono)     faltantes.push('Teléfono');
    if (!email)        faltantes.push('Correo electrónico');
    if (!contactoEmerg) faltantes.push('Contacto de emergencia');
    toast('Faltan campos: ' + faltantes.join(', '), 'warning');
    return;
  }

  if (!jornada) {
    toast('Selecciona la Jornada / Horario', 'warning'); return;
  }

  // Validar email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Formato de correo electrónico inválido', 'warning'); return;
  }

  // Validar periodo de prueba
  const errPeriodo = ReglasContratacion.validarPeriodoPrueba(tipoC, periodo, durMeses);
  if (errPeriodo) { toast(errPeriodo, 'warning'); return; }

  // Validar salario integral
  const errIntegral = ReglasContratacion.validarSalarioIntegral(tipoSal, salario, _paramVigente?.smmlv||1560000);
  if (errIntegral) { toast(errIntegral, 'warning'); return; }

  // Checklist
  const checklist = {};
  ['hv','cedula','acta_grado','antecedentes','eps','afp','ref_laborales','ref_personales',
   'foto','carnet_covid','carnet_alimentos','cuenta_bancaria','soat','funeraria'].forEach(k => {
    const v = fv('ck_'+k); if (v) checklist[k] = v;
  });

  // Datos de listas para guardar nombres
  const sedes  = await MaestrasContratacion.getSedes();
  const eps    = await MaestrasContratacion.getEPS();
  const afp    = await MaestrasContratacion.getAFP();
  const ces    = await MaestrasContratacion.getCesantias();
  const arl    = await MaestrasContratacion.getARL();
  const cajas  = await MaestrasContratacion.getCajas();
  const bancos = await MaestrasContratacion.getBancos();

  const fNombre = (arr, id) => arr.find(x => x.id===id)?.nombre||'';

  const eps_id   = fv('ocEPS');
  const afp_id   = fv('ocAFP');
  const ces_id   = fv('ocCesantias');
  const arl_id   = fv('ocARL');
  const caja_id  = fv('ocCaja');
  const banco_id = fv('ocBanco');
  const sede_id  = fv('ocSede');

  const payload = {
    nombres, tipo_id: fv('ocTipoId'), numero_id: numId,
    lugar_expedicion: fv('ocLugarExp')||null, fecha_expedicion: fv('ocFechaExp')||null,
    fecha_nacimiento: fv('ocFechaNac')||null, lugar_nacimiento: fv('ocLugarNac')||null,
    direccion, barrio: fv('ocBarrio')||null, ciudad, telefono, email,
    estado_civil: fv('ocEstadoCivil')||null,
    contacto_emergencia: contactoEmerg,
    parentesco_emergencia: fv('ocParentesco')||null,
    telefono_emergencia: fv('ocTelEmerg')||null,
    talla_camisa: fv('ocTallaCamisa')||null,
    talla_pantalon: fv('ocTallaPantalon')||null,
    talla_calzado: fv('ocTallaCalzado')||null,
    empresa, cargo, area, jefe_inmediato: jefe,
    tipo_contrato: tipoC,
    fecha_ingreso: fIngreso,
    fecha_terminacion: (tipoC==='termino_fijo'||tipoC==='obra_labor') ? (fv('ocFechaTerminacion')||null) : null,
    periodo_prueba_dias: periodo, salario, tipo_salario: tipoSal,
    auxilio_transporte: fv('ocAuxTransporte')==='true',
    otros_pagos: fv('ocOtrosPagos')||null,
    jornada, forma_pago: formaPago,
    sede_id: sede_id||null, sede_nombre: fNombre(sedes, sede_id),
    banco_id: banco_id||null, banco_nombre: fNombre(bancos, banco_id),
    tipo_cuenta: fv('ocTipoCuenta')||null,
    numero_cuenta: fv('ocNumeroCuenta')||null,
    eps_id: eps_id||null, eps_nombre: fNombre(eps, eps_id),
    afp_id: afp_id||null, afp_nombre: fNombre(afp, afp_id),
    cesantias_id: ces_id||null, cesantias_nombre: fNombre(ces, ces_id),
    arl_id: arl_id||null, arl_nombre: fNombre(arl, arl_id),
    clase_riesgo: fv('ocClaseRiesgo')||null,
    caja_id: caja_id||null, caja_nombre: fNombre(cajas, caja_id),
    checklist,
    // Heredados de requisición / candidato
    requisicion_id:  document.querySelector('#modalOrden input[name="ocReqId"]')?.value  || null,
    requisicion_num: document.querySelector('#modalOrden input[name="ocReqNum"]')?.value || null,
    candidato_id:    document.querySelector('#modalOrden input[name="ocCandId"]')?.value || null,
  };

  showLoading(true);
  let ok;
  if (_ocEditId) {
    ok = await OrdenContratacion.update(_ocEditId, payload);
  } else {
    ok = await OrdenContratacion.insert(payload);
  }
  showLoading(false);

  if (ok) {
    if (!_ocEditId) {
      // Nueva orden: inicializar checklist y generar link automáticamente
      await ChecklistDocs.inicializar(ok.id, ok.numero, ok.nombres);
      const token = await PortalCandidato.crearToken(
        ok.id, ok.numero, ok.nombres, ok.email, ok.telefono
      );
      cerrarModalOrden();
      switchContratacionTab('ordenes');
      await renderOrdenes();
      // Abrir modal del portal directamente para que GH envíe el link
      if (token) {
        toast(`Orden creada: ${ok.numero} — envía el link al candidato`, 'success');
        await abrirModalPortalCandidato(ok.id);
      } else {
        toast(`Orden creada: ${ok.numero}`, 'success');
      }
    } else {
      toast('Orden actualizada', 'success');
      cerrarModalOrden();
      switchContratacionTab('ordenes');
      renderOrdenes();
    }
  }
}

/* ════════════════════════════════════════════════════════════
   VER ORDEN (detalle completo)
   ════════════════════════════════════════════════════════════ */
async function verOrden(ocId) {
  const [oc, beneficiarios, aprobaciones] = await Promise.all([
    OrdenContratacion.getById(ocId),
    OrdenContratacion.getBeneficiarios(ocId),
    Aprobaciones.get('orden_contratacion', ocId),
  ]);
  if (!oc) return;

  const row = (l, v) => v ? `<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${v}</span></div>` : '';

  const checklistItems = [
    { key:'hv', label:'Hoja de vida' }, { key:'id', label:'Cédula al 150%' },
    { key:'estudios', label:'Estudios' }, { key:'laborales', label:'Certif. laborales' },
    { key:'vr', label:'Validación referencias' }, { key:'examen', label:'Examen médico' },
    { key:'antecedentes', label:'Antecedentes' }, { key:'afiliaciones', label:'Afiliaciones' },
    { key:'cert_bancaria', label:'Certif. bancaria' }, { key:'licencia', label:'Licencia/Montacargas' },
    { key:'autorizacion', label:'Autorización datos' }, { key:'foto', label:'Fotografía' },
  ];
  const checklist = oc.checklist || {};

  const aprolHtml = (rol, label) => {
    const ap = aprobaciones.find(a => a.rol === rol);
    const color = !ap?'var(--text-muted)':ap.decision==='aprobado'?'var(--success)':'var(--danger)';
    return `<tr>
      <td style="font-size:13px">${label}</td>
      <td style="font-size:12px;color:var(--text-muted)">${ap?.nombre_usuario||'—'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${ap?fmtDate(ap.fecha?.split('T')[0]):'—'}</td>
      <td><span style="color:${color};font-weight:700;font-size:12px">${!ap?'⏳ Pendiente':ap.decision==='aprobado'?'✔ Aprobado':'✘ Rechazado'}</span></td>
    </tr>`;
  };

  const html = `
  <div class="modal-overlay open" id="modalVerOC">
    <div class="modal" style="max-width:760px;width:95vw;max-height:92vh;overflow-y:auto">
      <div class="modal-header">
        <div class="modal-title">📋 ${oc.numero} ${badgeOC(oc.estado)}</div>
        <button class="modal-close" onclick="cerrar('modalVerOC')">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <span class="chip">${oc.empresa}</span>
          <span class="chip">${oc.cargo}</span>
          <span class="chip">${oc.area}</span>
          <span class="chip">${LBL.tipo_contrato[oc.tipo_contrato]||oc.tipo_contrato}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
          ${row('Nombre completo', oc.nombres)}
          ${row('Documento', `${oc.tipo_id} ${oc.numero_id}`)}
          ${row('Fecha nacimiento', fmtDate(oc.fecha_nacimiento))}
          ${row('Ciudad', oc.ciudad)}
          ${row('Dirección', oc.direccion)}
          ${row('Teléfono', oc.telefono)}
          ${row('Correo', oc.email)}
          ${row('Contacto emergencia', oc.contacto_emergencia)}
          ${row('Fecha ingreso', fmtDate(oc.fecha_ingreso))}
          ${row('Periodo de prueba', `${oc.periodo_prueba_dias} días`)}
          ${row('Salario', fmtCOP(oc.salario))}
          ${row('Tipo salario', LBL.tipo_salario[oc.tipo_salario]||oc.tipo_salario)}
          ${row('Aux. transporte', oc.auxilio_transporte?'Sí':'No')}
          ${row('Jornada', oc.jornada)}
          ${row('Forma de pago', LBL.forma_pago[oc.forma_pago]||oc.forma_pago)}
          ${row('Banco', oc.banco_nombre)}
          ${row('Tipo cuenta', LBL.tipo_cuenta[oc.tipo_cuenta]||oc.tipo_cuenta)}
          ${row('N° cuenta', oc.numero_cuenta)}
          ${row('EPS', oc.eps_nombre)}
          ${row('AFP / Pensión', oc.afp_nombre)}
          ${row('Cesantías', oc.cesantias_nombre)}
          ${row('ARL', `${oc.arl_nombre||''} (Clase ${oc.clase_riesgo||'—'})`)}
          ${row('Caja compensación', oc.caja_nombre)}
        </div>

        <!-- Checklist -->
        <div class="form-section-title" style="margin-top:20px">✅ Lista de chequeo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
          ${checklistItems.map(ci => {
            const v = checklist[ci.key]||'pendiente';
            const ok2 = ['recibido','apto','apto_con_restricciones','cumple'].includes(v);
            const nok = ['no_apto','no_cumple'].includes(v);
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:12px">
              <span>${ok2?'✅':nok?'❌':'⏳'}</span>
              <span>${ci.label}</span>
              <span style="margin-left:auto;color:${ok2?'var(--success)':nok?'var(--danger)':'var(--text-muted)'};font-weight:600">${v}</span>
            </div>`;
          }).join('')}
        </div>

        <!-- Beneficiarios -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px">
          <div class="form-section-title" style="margin:0">👨‍👩‍👧 Beneficiarios (${beneficiarios.length})</div>
          ${oc.estado==='borrador'?`<button class="btn btn-secondary" style="padding:5px 10px;font-size:12px"
                  onclick="abrirFormBeneficiario('${ocId}')">➕ Agregar</button>`:''}
        </div>
        <div id="listBeneficiarios" style="margin-top:8px">
          ${beneficiarios.length?`
          <div class="table-wrap"><table>
            <thead><tr><th>Nombre</th><th>Documento</th><th>Parentesco</th><th></th></tr></thead>
            <tbody>${beneficiarios.map(b=>`
              <tr>
                <td>${b.nombre}</td>
                <td style="font-family:monospace">${b.tipo_id||''} ${b.numero_id||''}</td>
                <td>${b.parentesco||'—'}</td>
                <td>${oc.estado==='borrador'?`<button class="btn btn-secondary" style="padding:3px 6px;font-size:11px" onclick="eliminarBeneficiario('${b.id}','${ocId}')">🗑</button>`:''}</td>
              </tr>`).join('')}
            </tbody></table></div>`:`<div style="color:var(--text-muted);font-size:13px">Sin beneficiarios</div>`}
        </div>
        <div id="formBeneficiario" style="display:none"></div>

        <!-- Aprobaciones -->
        <div class="form-section-title" style="margin-top:20px">✔ Aprobaciones</div>
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead><tr><th>Rol</th><th>Nombre</th><th>Fecha</th><th>Decisión</th></tr></thead>
            <tbody>
              ${aprolHtml('gh','Jefe de Gestión Humana')}
              ${aprolHtml('jefe_inmediato','Jefe inmediato')}
              ${aprolHtml('gerencia','Gerente General')}
            </tbody>
          </table>
        </div>
        ${oc.motivo_rechazo?`<div style="margin-top:8px;padding:10px;background:rgba(224,85,85,0.1);border-radius:8px"><div style="font-size:12px;font-weight:700;color:var(--danger)">Motivo de rechazo</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${oc.motivo_rechazo}</div></div>`:''}
        ${oc.motivo_anulacion?`<div style="margin-top:8px;padding:10px;background:rgba(224,85,85,0.1);border-radius:8px"><div style="font-size:12px;font-weight:700;color:var(--danger)">Motivo de anulación</div><div style="font-size:13px;color:var(--text-secondary);margin-top:4px">${oc.motivo_anulacion}</div></div>`:''}
      </div>
      <div class="modal-footer">
        ${oc.estado==='pendiente_aprobacion'?`<button class="btn btn-primary" style="margin-right:auto" onclick="cerrar('modalVerOC');abrirModalAprobacionOC('${ocId}')">✔ Registrar aprobación</button>`:''}
        ${oc.estado==='borrador'?`<button class="btn btn-primary" style="margin-right:auto" onclick="cerrar('modalVerOC');abrirModalOrden('${ocId}')">✏️ Editar</button>`:''}
        <button class="btn btn-secondary" onclick="cerrar('modalVerOC')">Cerrar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalVerOC');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

/* Beneficiarios inline */
function abrirFormBeneficiario(ocId) {
  const div = document.getElementById('formBeneficiario');
  if (!div) return;
  div.style.display = 'block';
  div.innerHTML = `
    <div style="border:1px dashed var(--accent);border-radius:10px;padding:14px;margin-top:10px;background:rgba(58,130,200,0.05)">
      <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--accent)">➕ Nuevo beneficiario</div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label">Nombre completo <span class="req-star">*</span></label>
          <input type="text" class="form-input" id="bNombre"></div>
        <div class="form-group"><label class="form-label">Parentesco</label>
          <select class="form-select" id="bParentesco">
            ${selectOpts(PARENTESCOS, '', 'Seleccione...')}
          </select></div>
        <div class="form-group"><label class="form-label">Tipo documento</label>
          <select class="form-select" id="bTipoId">
            <option value="CC">CC</option><option value="RC">RC</option>
            <option value="TI">TI</option><option value="CE">CE</option>
          </select></div>
        <div class="form-group"><label class="form-label">Número documento</label>
          <input type="text" class="form-input" id="bNumId"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="show('formBeneficiario',false)">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarBeneficiario('${ocId}')">💾 Guardar</button>
      </div>
    </div>`;
}

async function guardarBeneficiario(ocId) {
  const nombre = fv('bNombre').trim();
  if (!nombre) { toast('Nombre obligatorio', 'warning'); return; }
  showLoading(true);
  const ok = await OrdenContratacion.insertBeneficiario({
    orden_id: ocId, nombre, parentesco: fv('bParentesco')||null,
    tipo_id: fv('bTipoId'), numero_id: fv('bNumId')||null,
  });
  showLoading(false);
  if (ok) { toast('Beneficiario agregado', 'success'); verOrden(ocId); }
}

async function eliminarBeneficiario(benId, ocId) {
  if (!confirm('¿Eliminar este beneficiario?')) return;
  await OrdenContratacion.deleteBeneficiario(benId);
  verOrden(ocId);
}

/* ════════════════════════════════════════════════════════════
   MODAL APROBACIÓN ORDEN
   ════════════════════════════════════════════════════════════ */
async function abrirModalAprobacionOC(ocId) {
  const oc = await OrdenContratacion.getById(ocId);
  if (!oc) return;
  const aprobaciones = await Aprobaciones.get('orden_contratacion', ocId);

  const rolHtml = (rol, label) => {
    const ap = aprobaciones.find(a => a.rol === rol);
    const color = !ap?'var(--text-muted)':ap.decision==='aprobado'?'var(--success)':'var(--danger)';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <div><div style="font-size:13px;font-weight:600">${label}</div>
      ${ap?`<div style="font-size:12px;color:var(--text-muted)">${ap.nombre_usuario} · ${fmtDate(ap.fecha?.split('T')[0])}</div>`:''}
      </div>
      <span style="color:${color};font-size:12px;font-weight:700">${!ap?'⏳':ap.decision==='aprobado'?'✔ Aprobado':'✘ Rechazado'}</span>
    </div>`;
  };

  const html = `
  <div class="modal-overlay open" id="modalAprobOC">
    <div class="modal" style="max-width:520px;width:95vw">
      <div class="modal-header">
        <div class="modal-title">✔ Aprobación Orden — ${oc.numero}</div>
        <button class="modal-close" onclick="cerrar('modalAprobOC')">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom:14px;font-size:13px;color:var(--text-secondary)">${oc.nombres} · ${oc.cargo} · ${oc.empresa}</div>
        ${rolHtml('gh','Jefe de Gestión Humana')}
        ${rolHtml('jefe_inmediato','Jefe inmediato')}
        ${rolHtml('gerencia','Gerente General')}
        <div class="form-section-title" style="margin-top:18px">Registrar aprobación</div>
        <div class="form-group"><label class="form-label">Rol <span class="req-star">*</span></label>
          <select class="form-select" id="ocAprobRol">
            <option value="gh">Jefe de Gestión Humana</option>
            <option value="jefe_inmediato">Jefe inmediato</option>
            <option value="gerencia">Gerente General</option>
          </select></div>
        <div class="form-group"><label class="form-label">Nombre <span class="req-star">*</span></label>
          <input type="text" class="form-input" id="ocAprobNombre"></div>
        <div class="form-group"><label class="form-label">Decisión</label>
          <select class="form-select" id="ocAprobDecision">
            <option value="aprobado">✔ Aprobar</option>
            <option value="rechazado">✘ Rechazar</option>
          </select></div>
        <div class="form-group"><label class="form-label">Comentario</label>
          <textarea class="form-input" id="ocAprobComentario" rows="2"></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="cerrar('modalAprobOC')">Cancelar</button>
        <button class="btn btn-primary" onclick="registrarAprobacionOC('${ocId}')">💾 Registrar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalAprobOC');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';
}

async function registrarAprobacionOC(ocId) {
  const rol    = fv('ocAprobRol');
  const nombre = fv('ocAprobNombre').trim();
  const dec    = fv('ocAprobDecision');
  const coment = fv('ocAprobComentario').trim();
  if (!nombre) { toast('Ingrese el nombre del aprobador', 'warning'); return; }
  if (dec==='rechazado' && !coment) { toast('El motivo de rechazo es obligatorio', 'warning'); return; }

  showLoading(true);
  const ok = await OrdenContratacion.aprobar(ocId, rol, nombre, dec, coment);
  showLoading(false);

  if (ok) {
    toast(`Registrado: ${dec==='aprobado'?'Aprobado':'Rechazado'} por ${nombre}`, dec==='aprobado'?'success':'warning');
    cerrar('modalAprobOC');
    renderOrdenes();
  }
}

/* ════════════════════════════════════════════════════════════
   HELPER GLOBAL cerrar()
   ════════════════════════════════════════════════════════════ */
function cerrar(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.remove();
  document.body.style.overflow = '';
}

/* ════════════════════════════════════════════════════════════
   PORTAL CANDIDATO — generar link + ver checklist GH
   ════════════════════════════════════════════════════════════ */
async function abrirModalPortalCandidato(ocId) {
  showLoading(true);
  const [oc, docs, tokenData] = await Promise.all([
    OrdenContratacion.getById(ocId),
    ChecklistDocs.getByOrden(ocId),
    PortalCandidato.getByOrden(ocId),
  ]);
  showLoading(false);
  if (!oc) return;

  // Si no hay docs inicializados, crearlos
  if (!docs.length) {
    await ChecklistDocs.inicializar(ocId, oc.numero, oc.nombres);
    const nuevos = await ChecklistDocs.getByOrden(ocId);
    docs.splice(0, 0, ...nuevos);
  }

  const portalUrl = tokenData ? PortalCandidato.urlPortal(tokenData.token) : null;
  const expirado  = tokenData ? new Date(tokenData.expira_en) < new Date() : false;

  const estadoColor = {
    pendiente:          'var(--text-muted)',
    pendiente_revision: 'var(--warning)',
    aprobado:           'var(--success)',
    rechazado:          'var(--danger)',
    no_aplica:          'var(--text-muted)',
  };
  const estadoIcon = {
    pendiente: '⏳', pendiente_revision: '🔍', aprobado: '✅', rechazado: '❌', no_aplica: 'N/A',
  };

  const filasChecklist = docs.map(doc => {
    // Columna extra de info para funeraria
    let extraInfo = '';
    if (doc.item_key === 'funeraria') {
      if (doc.funeraria_acepta === true) {
        extraInfo = `<div style="font-size:11px;color:var(--purple);margin-top:2px">🕊️ Afiliación Los Olivos — $11.500/mes</div>`;
      } else if (doc.funeraria_acepta === false) {
        extraInfo = `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Tiene certificado propio</div>`;
      }
    }
    return `
    <tr>
      <td style="font-size:13px">${doc.item_label}${extraInfo}</td>
      <td style="text-align:center">
        <span style="font-weight:700;color:${estadoColor[doc.estado]||'var(--text-muted)'}">
          ${estadoIcon[doc.estado]||doc.estado}
        </span>
        <div style="font-size:11px;color:var(--text-muted)">${doc.subido_por?`por ${doc.subido_por}`:''}</div>
      </td>
      <td>
        ${doc.archivo_url
          ? `<a href="${doc.archivo_url}" target="_blank" style="color:var(--accent);font-size:12px">📎 Ver</a>`
          : '<span style="color:var(--text-muted);font-size:12px">—</span>'}
      </td>
      <td>
        ${doc.estado === 'pendiente_revision'
          ? `<div style="display:flex;gap:4px;flex-wrap:wrap">
               <button class="btn" style="padding:4px 8px;font-size:11px;background:rgba(58,170,128,0.2);color:var(--success)"
                       onclick="aprobarDocumento('${doc.id}','${ocId}')">✅ Aprobar</button>
               <button class="btn" style="padding:4px 8px;font-size:11px;background:rgba(224,85,85,0.15);color:var(--danger)"
                       onclick="rechazarDocumento('${doc.id}','${ocId}')">❌ Rechazar</button>
             </div>`
          : `<select class="form-select" style="font-size:12px;padding:4px 8px"
                      onchange="cambiarEstadoDocGH('${doc.id}','${ocId}',this.value)">
               <option value="">— Cambiar —</option>
               <option value="aprobado">✅ Aprobado</option>
               <option value="pendiente">⏳ Pendiente</option>
               <option value="rechazado">❌ Rechazado</option>
               <option value="no_aplica">N/A</option>
             </select>`}
      </td>
    </tr>`;
  }).join('');

  const html = `
  <div class="modal-overlay open" id="modalPortalCandidato">
    <div class="modal" style="max-width:780px;width:95vw;max-height:92vh;overflow-y:auto">
      <div class="modal-header">
        <div>
          <div class="modal-title">📲 Portal Candidato · ${oc.numero}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
            ${oc.nombres} · ${oc.empresa} · ${oc.cargo}
          </div>
        </div>
        <button class="modal-close" onclick="cerrar('modalPortalCandidato')">✕</button>
      </div>
      <div class="modal-body">

        <!-- Link del portal -->
        <div style="padding:16px;background:rgba(130,80,200,0.08);border:1px solid rgba(130,80,200,0.25);
                    border-radius:12px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;color:#a78bfa;margin-bottom:12px">
            🔗 Link de acceso para el candidato
          </div>
          ${portalUrl && !expirado
            ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                 <input type="text" class="form-input" id="portalUrlInput" readonly
                        style="flex:1;font-size:12px;font-family:monospace;min-width:200px">
                 <button class="btn" style="background:rgba(130,80,200,0.25);color:#a78bfa;font-weight:600;white-space:nowrap"
                         onclick="copiarPortalUrl()">📋 Copiar</button>
                 <button class="btn" onclick="window.open(document.getElementById('portalUrlInput').value,'_blank')"
                    style="background:rgba(58,130,200,0.2);color:var(--accent);white-space:nowrap">
                   🔍 Abrir
                 </button>
               </div>
               <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
                 ⏰ Expira: ${new Date(tokenData.expira_en).toLocaleDateString('es-CO')}
               </div>`
            : `<div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">
                 ${expirado ? '⚠️ El link anterior expiró.' : '⚠️ No se ha generado un link aún.'}
               </div>`}
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            ${expirado
              ? `<button class="btn" style="background:rgba(130,80,200,0.25);color:#a78bfa;font-weight:600"
                      onclick="generarLinkPortal('${ocId}','${oc.numero}','${oc.nombres.replace(/'/g,"\\'")}','${oc.email||''}','${oc.telefono||''}')">
                  🔄 Renovar link (el anterior expiró)
                </button>`
              : !portalUrl
              ? `<button class="btn" style="background:rgba(130,80,200,0.25);color:#a78bfa;font-weight:600"
                      onclick="generarLinkPortal('${ocId}','${oc.numero}','${oc.nombres.replace(/'/g,"\\'")}','${oc.email||''}','${oc.telefono||''}')">
                  ✨ Generar link
                </button>`
              : ''}
            ${oc.email
              ? `<button class="btn" style="background:rgba(58,170,128,0.15);color:var(--success)"
                         onclick="compartirPorEmail('${oc.email}','${oc.nombres.replace(/'/g,"\\'")}',document.getElementById('portalUrlInput')?.value||'','${ocId}')">
                   📧 Enviar por correo
                 </button>`
              : '<span style="font-size:12px;color:var(--text-muted)">Sin email registrado para notificación</span>'}
            ${oc.telefono
              ? `<button class="btn" style="background:rgba(37,211,102,0.15);color:#25d366"
                         onclick="compartirPorWhatsApp('${oc.telefono}','${oc.nombres.replace(/'/g,"\\'")}',document.getElementById('portalUrlInput')?.value||'','${ocId}')">
                   💬 WhatsApp
                 </button>`
              : ''}
          </div>
        </div>

        <!-- Checklist GH -->
        <div class="form-section-title">✅ Lista de chequeo — estado de documentos</div>
        <div class="table-wrap" style="margin-top:8px">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th style="width:120px;text-align:center">Estado</th>
                <th style="width:130px">Archivo</th>
                <th style="width:200px">Acción GH</th>
              </tr>
            </thead>
            <tbody>${filasChecklist}</tbody>
          </table>
        </div>

        <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;
                    font-size:12px;color:var(--text-muted);line-height:1.7">
          <strong>Cómo funciona:</strong><br>
          1. Genera el link y envíalo al candidato por correo o WhatsApp.<br>
          2. El candidato entra al link, ve qué documentos debe cargar y los sube desde su celular.<br>
          3. Cada documento queda en estado <strong>🔍 Pendiente revisión</strong> y GH lo aprueba o rechaza aquí.<br>
          4. GH también puede subir o actualizar documentos directamente desde este panel.
        </div>

        <!-- Firma digital del candidato -->
        ${tokenData?.firma_url ? `
        <div style="margin-top:20px;padding:14px 16px;background:rgba(58,170,128,0.08);border:1px solid rgba(58,170,128,0.25);border-radius:12px">
          <div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:10px">✍️ Firma digital del candidato</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
            Firmado por <strong>${tokenData.firma_nombre||oc.nombres}</strong> el
            ${new Date(tokenData.firma_fecha).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}
          </div>
          <img src="${tokenData.firma_url}" alt="Firma" style="max-width:280px;background:#fff;padding:8px;border-radius:8px;display:block">
        </div>` : `
        <div style="margin-top:16px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-muted)">
          ✍️ El candidato aún no ha firmado digitalmente el documento.
        </div>`}

      </div>
      <div class="modal-footer">
        ${tokenData?.firma_url
          ? `<button class="btn btn-success" onclick="generarListaChequeo('${ocId}')">📄 Descargar Lista de Chequeo</button>`
          : ''}
        <button class="btn btn-secondary" onclick="cerrar('modalPortalCandidato')">Cerrar</button>
      </div>
    </div>
  </div>`;

  const prev = document.getElementById('modalPortalCandidato');
  if (prev) prev.remove();
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

  // Asignar URL por JS para evitar truncamiento en atributos HTML
  if (portalUrl && !expirado) {
    const inp = document.getElementById('portalUrlInput');
    if (inp) inp.value = portalUrl;
  }
}

async function generarLinkPortal(ocId, ocNum, nombre, email, tel) {
  showLoading(true);
  const token = await PortalCandidato.crearToken(ocId, ocNum, nombre, email, tel);
  showLoading(false);
  if (!token) { toast('No se pudo generar el link', 'error'); return; }
  toast('Link generado correctamente', 'success');
  cerrar('modalPortalCandidato');
  setTimeout(() => abrirModalPortalCandidato(ocId), 300);
}

function copiarPortalUrl() {
  const inp = document.getElementById('portalUrlInput');
  if (!inp) return;
  inp.select();
  navigator.clipboard.writeText(inp.value).then(() => toast('Link copiado al portapapeles', 'success'));
}

function compartirPorWhatsApp(tel, nombre, portalUrl, ocId) {
  if (!portalUrl) {
    toast('Primero genera el link del portal', 'warning');
    return;
  }
  // Limpiar teléfono (solo dígitos) y agregar código país Colombia
  const telLimpio = tel.replace(/\D/g, '');
  const telFinal  = telLimpio.startsWith('57') ? telLimpio : '57' + telLimpio;
  const msg = encodeURIComponent(
    `¡Hola ${nombre}! 👋\n\n` +
    `Te enviamos el enlace para cargar los documentos requeridos para tu proceso de contratación:\n\n` +
    `🔗 ${portalUrl}\n\n` +
    `*Lista de documentos:*\n` +
    `• Hoja de vida actualizada\n` +
    `• Fotocopia cédula al 150%\n` +
    `• Certificados de estudio\n` +
    `• Certificados laborales\n` +
    `• Examen médico de ingreso\n` +
    `• Antecedentes (Policía, Procuraduría, Contraloría)\n` +
    `• Certificación bancaria\n` +
    `• Autorización tratamiento de datos\n` +
    `• Fotografía para carné\n\n` +
    `Por favor cárgalos antes de tu fecha de ingreso. ¡Éxitos! 🎉`
  );
  window.open(`https://wa.me/${telFinal}?text=${msg}`, '_blank');
}

function compartirPorEmail(email, nombre, portalUrl, ocId) {
  if (!portalUrl) {
    toast('Primero genera el link del portal', 'warning');
    return;
  }
  const asunto = encodeURIComponent('Documentos para proceso de contratación');
  const cuerpo = encodeURIComponent(
    `Estimado/a ${nombre},\n\n` +
    `Nos complace informarle que ha sido seleccionado/a para iniciar su proceso de contratación.\n\n` +
    `A continuación encontrará el enlace para cargar los documentos requeridos:\n` +
    `${portalUrl}\n\n` +
    `Documentos requeridos:\n` +
    `- Hoja de vida actualizada\n` +
    `- Fotocopia cédula al 150%\n` +
    `- Certificados de estudio\n` +
    `- Certificados laborales\n` +
    `- Examen médico de ingreso\n` +
    `- Antecedentes (Policía, Procuraduría, Contraloría)\n` +
    `- Certificación bancaria\n` +
    `- Autorización tratamiento de datos\n` +
    `- Fotografía para carné\n\n` +
    `Por favor cargue los documentos antes de su fecha de ingreso.\n\n` +
    `Atentamente,\nGestión Humana`
  );
  window.location.href = `mailto:${email}?subject=${asunto}&body=${cuerpo}`;
}

async function aprobarDocumento(docId, ocId) {
  await ChecklistDocs.actualizarEstado(docId, 'aprobado');
  toast('Documento aprobado', 'success');
  cerrar('modalPortalCandidato');
  setTimeout(() => abrirModalPortalCandidato(ocId), 250);
}

async function rechazarDocumento(docId, ocId) {
  const obs = prompt('Motivo del rechazo (el candidato podrá ver este mensaje):');
  if (obs === null) return;
  await ChecklistDocs.actualizarEstado(docId, 'rechazado', obs);
  toast('Documento rechazado', 'warning');
  cerrar('modalPortalCandidato');
  setTimeout(() => abrirModalPortalCandidato(ocId), 250);
}

async function cambiarEstadoDocGH(docId, ocId, estado) {
  if (!estado) return;
  await ChecklistDocs.actualizarEstado(docId, estado);
  toast('Estado actualizado', 'success');
  cerrar('modalPortalCandidato');
  setTimeout(() => abrirModalPortalCandidato(ocId), 250);
}

/* ════════════════════════════════════════════════════════════
   LISTA DE CHEQUEO PDF
   ════════════════════════════════════════════════════════════ */
async function generarListaChequeo(ocId) {
  showLoading(true);
  const [oc, docs, tokenData] = await Promise.all([
    OrdenContratacion.getById(ocId),
    ChecklistDocs.getByOrden(ocId),
    PortalCandidato.getByOrden(ocId),
  ]);
  showLoading(false);
  if (!oc) { toast('No se encontró la orden', 'error'); return; }

  // Separar nombres y apellidos (primeras 2 palabras = nombres, resto = apellidos)
  const palabras   = (oc.nombres || '').trim().split(/\s+/);
  const nombres    = palabras.slice(0, 2).join(' ');
  const apellidos  = palabras.slice(2).join(' ') || '';

  // Tipo de documento
  const tipoIdMap  = { CC: 'C.C.', TI: 'T.I.', CE: 'C.E.' };
  const tipoIdKey  = oc.tipo_id || 'CC';

  // Fecha actual
  const hoy = new Date();
  const dd  = String(hoy.getDate()).padStart(2, '0');
  const mmm = hoy.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase();
  const aaaa = hoy.getFullYear();

  // Estado de cada doc: Si=aprobado, No=rechazado/pendiente, vacío=sin info
  const docMap = {};
  docs.forEach(d => { docMap[d.item_key] = d; });

  function checkSiNo(key) {
    const d = docMap[key];
    if (!d) return { si: '', no: '' };
    if (d.estado === 'aprobado') return { si: '✓', no: '' };
    if (d.estado === 'rechazado') return { si: '', no: '✗' };
    if (d.estado === 'pendiente_revision') return { si: '○', no: '' };
    return { si: '', no: '' };
  }

  function fila(key, label, obs = '') {
    const c = checkSiNo(key);
    // Observación especial para funeraria
    let obsExtra = obs;
    if (key === 'funeraria') {
      const d = docMap['funeraria'];
      if (d?.funeraria_acepta === true)  obsExtra = 'Afiliación Los Olivos $11.500/mes';
      if (d?.funeraria_acepta === false) obsExtra = 'Certificado propio';
    }
    return `<tr>
      <td class="cell-check">${c.si}</td>
      <td class="cell-check">${c.no}</td>
      <td class="cell-doc">${label}</td>
      <td class="cell-obs">${obsExtra}</td>
    </tr>`;
  }

  function filaSeccion(label) {
    return `<tr class="row-seccion"><td colspan="4">${label}</td></tr>`;
  }

  const firmaImg = tokenData?.firma_url
    ? `<img src="${tokenData.firma_url}" style="height:48px;max-width:160px;object-fit:contain" alt="Firma">`
    : '';
  const firmaNombre = tokenData?.firma_nombre || oc.nombres || '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Lista de Chequeo — ${oc.nombres}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    color: #000;
    background: #fff;
    padding: 18px 22px;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    border: 2px solid #000;
    padding: 12px 14px;
  }
  .header-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-bottom: 10px;
  }
  .header-row img { height: 54px; }
  .header-title {
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    letter-spacing: 0.5px;
  }
  .section-label {
    font-weight: bold;
    font-size: 10px;
    margin: 6px 0 4px;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
    border: 1px solid #000;
    margin-bottom: 4px;
  }
  .info-grid .cell {
    border-right: 1px solid #000;
    padding: 4px 6px;
  }
  .info-grid .cell:last-child { border-right: none; }
  .info-label { font-size: 8px; color: #555; margin-bottom: 2px; }
  .info-value { font-size: 10px; font-weight: bold; min-height: 14px; }
  .info-row2 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 0;
    border: 1px solid #000;
    border-top: none;
    margin-bottom: 8px;
  }
  .info-row2 .cell {
    border-right: 1px solid #000;
    padding: 4px 6px;
  }
  .info-row2 .cell:last-child { border-right: none; }
  .tipoid-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
  }
  .tipoid-box {
    border: 1px solid #555;
    padding: 1px 4px;
    font-size: 9px;
    min-width: 24px;
    text-align: center;
  }
  .tipoid-box.marcado { border-color: #000; font-weight: bold; }

  /* Tabla checklist */
  table.checklist {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }
  table.checklist th {
    background: #e0e0e0;
    border: 1px solid #888;
    padding: 3px 5px;
    font-size: 9px;
    text-align: center;
  }
  table.checklist td {
    border: 1px solid #aaa;
    padding: 3px 5px;
    vertical-align: top;
  }
  .cell-check {
    width: 24px;
    text-align: center;
    font-size: 11px;
  }
  .cell-doc  { font-size: 9.5px; }
  .cell-obs  { font-size: 9px; color: #333; min-width: 80px; }
  .row-seccion td {
    background: #d0d0d0;
    font-weight: bold;
    font-size: 9.5px;
    padding: 3px 5px;
    border: 1px solid #888;
  }
  /* Declaración */
  .declaracion {
    font-size: 9px;
    color: #222;
    line-height: 1.5;
    margin: 8px 0;
    text-align: justify;
  }
  .declaracion span { color: #0000cc; }
  /* Pie */
  .pie {
    display: grid;
    grid-template-columns: 55px 65px 65px 1fr 1fr 1fr;
    gap: 0;
    border: 1px solid #000;
    margin-top: 6px;
  }
  .pie .pcell {
    border-right: 1px solid #000;
    padding: 4px 6px;
    min-height: 52px;
  }
  .pie .pcell:last-child { border-right: none; }
  .pie .plabel { font-size: 8px; font-weight: bold; margin-bottom: 4px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
    .page { border: 2px solid #000; }
  }
</style>
</head>
<body>
<div class="no-print" style="text-align:center;margin-bottom:14px">
  <button onclick="window.print()" style="padding:9px 28px;background:#1a5caa;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;cursor:pointer">🖨️ Imprimir / Guardar PDF</button>
  <button onclick="window.close()" style="padding:9px 18px;background:#888;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;margin-left:8px">✕ Cerrar</button>
</div>

<div class="page">

  <!-- Encabezado -->
  <div class="header-row">
    <img src="icons/logo_tym.png" alt="Logo" onerror="this.style.display='none'">
    <div class="header-title">LISTA DE CHEQUEO DE CONTRATACIÓN</div>
  </div>

  <!-- Información del empleado -->
  <div class="section-label">Información del Empleado</div>
  <div class="info-grid">
    <div class="cell">
      <div class="info-label">Nombre(s)</div>
      <div class="info-value">${nombres}</div>
    </div>
    <div class="cell">
      <div class="info-label">Apellido(s)</div>
      <div class="info-value">${apellidos}</div>
    </div>
    <div class="cell">
      <div class="info-label">Doc. Identidad</div>
      <div class="tipoid-row">
        <span class="tipoid-box ${tipoIdKey==='CC'?'marcado':''}">C.C.</span>
        <span class="tipoid-box ${tipoIdKey==='TI'?'marcado':''}">T.I.</span>
        <span class="tipoid-box ${tipoIdKey==='CE'?'marcado':''}">C.E.</span>
      </div>
      <div style="font-size:9px;margin-top:3px;font-weight:bold">${oc.numero_id || ''}</div>
    </div>
  </div>
  <div class="info-row2">
    <div class="cell">
      <div class="info-label">Empresa</div>
      <div class="info-value">${oc.empresa || ''}</div>
    </div>
    <div class="cell">
      <div class="info-label">E.P.S.</div>
      <div class="info-value">${oc.eps_nombre || ''}</div>
    </div>
    <div class="cell">
      <div class="info-label">A.F.P.</div>
      <div class="info-value">${oc.afp_nombre || ''}</div>
    </div>
    <div class="cell">
      <div class="info-label">C.C.F.</div>
      <div class="info-value">${oc.caja_nombre || ''}</div>
    </div>
  </div>

  <!-- Verificación de documentos -->
  <div class="section-label">Verificación de Documentos</div>
  <table class="checklist">
    <thead>
      <tr>
        <th colspan="3" style="text-align:center">Documentos Entregados</th>
        <th rowspan="2" style="width:120px">Observaciones</th>
      </tr>
      <tr>
        <th style="width:24px">Si</th>
        <th style="width:24px">No</th>
        <th>Documento</th>
      </tr>
    </thead>
    <tbody>
      ${fila('hv',              'Hoja de Vida')}
      ${fila('cedula',          'Fotocopia de la Cédula')}
      ${fila('acta_grado',      'Fotocopia Acta de Grado y Diplomas')}
      ${fila('antecedentes',    'Antecedentes contraloría, procuraduría y policía')}
      ${fila('eps',             'Certificado de E.P.S.')}
      ${fila('afp',             'Certificado de A.F.P.')}
      ${fila('ref_laborales',   '2 - Referencias Laborales')}
      ${fila('ref_personales',  '2 - Referencias Personales')}
      ${fila('foto',            'Foto fondo blanco')}
      ${fila('carnet_covid',    'Carnet COVID - 19')}
      ${fila('carnet_alimentos','Carnet de Manipulación de Alimentos (vigencia mayor a 6 meses)')}
      ${fila('cuenta_bancaria', 'Constancia de Apertura de Cuenta')}
      ${fila('soat',            'Copia Soat, Tecnomecánica, licencia de conducción y tarjeta de propiedad')}
      ${fila('funeraria',       'Certificado Funerario')}

      ${filaSeccion('Afiliación Hijos')}
      ${fila('afil_hijos',      'Registro Civil de Nacimiento')}
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Tarjeta de Identidad Mayores de 7 años</td><td class="cell-obs"></td></tr>
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Constancia de Estudio Mayores de 12 años</td><td class="cell-obs"></td></tr>

      ${filaSeccion('Afiliación Padres')}
      ${fila('afil_padres',     'Registro Civil de Nacimiento del Cotizante')}
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Fotocopia de Cédula de Padres Mayores a 58 años</td><td class="cell-obs"></td></tr>
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Declaración de Supervivencia</td><td class="cell-obs"></td></tr>
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Declaración de Dependencia Económica</td><td class="cell-obs"></td></tr>

      ${filaSeccion('Afiliación Cónyugues — Unión Libre')}
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Fotocopia de la Cédula</td><td class="cell-obs"></td></tr>
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Declaración Extrajuicio</td><td class="cell-obs"></td></tr>

      ${filaSeccion('Afiliación Cónyugues — Matrimonio')}
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Fotocopia de la Cédula</td><td class="cell-obs"></td></tr>
      <tr><td class="cell-check"></td><td class="cell-check"></td><td class="cell-doc">Registro Civil de Matrimonio</td><td class="cell-obs"></td></tr>
    </tbody>
  </table>

  <!-- Declaración -->
  <div class="declaracion">
    <span>Declaro que he suministrado información real y precisa, y que conozco los efectos que causaría que ésta no lo sea, y los que se produzcan por la falta de documentos no entregados.</span>
    <br><br>
    <span>De igual manera, autorizo a que me sean pagadas las prestaciones sociales y mis pagos por concepto de nómina a la cuenta bancaria que certifico mediante constancia entregada.</span>
  </div>

  <!-- Pie: fecha, contrato, firma, doc identidad -->
  <div class="pie">
    <div class="pcell">
      <div class="plabel">DD</div>
      <div style="font-size:13px;font-weight:bold;margin-top:4px">${dd}</div>
    </div>
    <div class="pcell">
      <div class="plabel">MMM</div>
      <div style="font-size:11px;font-weight:bold;margin-top:4px">${mmm}</div>
    </div>
    <div class="pcell" style="grid-column:span 1">
      <div class="plabel">AAAA</div>
      <div style="font-size:11px;font-weight:bold;margin-top:4px">${aaaa}</div>
    </div>
    <div class="pcell">
      <div class="plabel">Contrato</div>
      <div style="font-size:9px;margin-top:4px">${oc.numero || ''}</div>
      <div style="font-size:8px;color:#555">${oc.tipo_contrato ? oc.tipo_contrato.replace(/_/g,' ') : ''}</div>
    </div>
    <div class="pcell">
      <div class="plabel">Firma Empleado</div>
      <div style="margin-top:4px">${firmaImg}</div>
      <div style="font-size:8px;color:#444;margin-top:2px">${firmaNombre}</div>
    </div>
    <div class="pcell">
      <div class="plabel">Doc. Identidad</div>
      <div style="font-size:10px;font-weight:bold;margin-top:4px">${oc.numero_id || ''}</div>
      <div style="font-size:8px;color:#555">${tipoIdMap[tipoIdKey] || tipoIdKey}</div>
    </div>
  </div>

</div><!-- /page -->
</body>
</html>`;

  // Abrir en ventana nueva para imprimir / guardar como PDF
  const win = window.open('', '_blank');
  if (!win) { toast('Permite las ventanas emergentes para generar el PDF', 'warning'); return; }
  win.document.write(html);
  win.document.close();
}

/* ════════════════════════════════════════════════════════════
   CSS ADICIONAL PARA CONTRATACIÓN
   ════════════════════════════════════════════════════════════ */
(function injectContratacionCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .form-section-title {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px;
      color: var(--text-muted); padding: 8px 0 4px;
      border-bottom: 1px solid var(--border); margin-bottom: 12px; margin-top: 8px;
    }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .form-grid-2 { grid-template-columns: 1fr; } }
    .detail-row {
      display: flex; flex-direction: column; padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .detail-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
    .detail-val   { font-size: 13px; color: var(--text-primary); margin-top: 2px; }
    .req-star { color: var(--danger); }
    .ctab-btn.active {
      background: linear-gradient(135deg, rgba(58,130,200,0.25), rgba(58,130,200,0.1)) !important;
      color: #7ab4e8 !important;
      border-color: rgba(58,130,200,0.4) !important;
    }
    .badge-neutral { background: rgba(255,255,255,0.08); color: var(--text-secondary); border: 1px solid var(--border); }
    .badge-info    { background: rgba(58,130,200,0.15); color: #7ab4e8; border: 1px solid rgba(58,130,200,0.3); }
  `;
  document.head.appendChild(style);
})();
