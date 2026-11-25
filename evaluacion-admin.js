/* ============================================================
   GH PRO — Módulo Evaluación: Pantallas de administración GH
   Parametrización, Ciclos, Reportes
   Requiere: supabase.js, evaluacion-app.js
   ============================================================ */
'use strict';

const EvalAdmin = {

  /* ════════════════════════════════════════════════════════
     PARAMETRIZACIÓN
     ════════════════════════════════════════════════════════ */
  async mostrarParametrizacion() {
    EvalMod.renderTopbar('parametrizacion');
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando parámetros…</div>';

    const { data: params } = await sb.from('parametros_evaluacion').select('*').order('clave');
    const { data: cargos  } = await sb.from('cargos_evaluacion').select('*').order('area, nombre');
    const { data: comps   } = await sb.from('competencias').select('*').eq('version_diccionario',2).order('codigo');

    // Agrupar parámetros por categoría
    const grupos = {
      'Medición': ['modo_ponderacion','escala_A','escala_B','escala_C','escala_D',
                   'banda_cumple_perfil','banda_oportunidades','banda_parcial','decimales_indice'],
      'Ponderación por grupo': ['peso_transversales','peso_liderazgo','peso_funcionales','peso_tecnicas'],
      'Alertas y plazos': ['dias_apertura_prueba','dias_limite_lider_prueba','dias_recordatorio_prueba',
                           'dias_firma_colaborador','meses_antiguedad_ciclo'],
      'Seguimiento': ['dias_seguimiento_no_cumple','dias_seguimiento_parcial',
                      'umbral_diferencia_auto','umbral_capacitacion','min_fortalezas_reconocimiento'],
      'Validaciones': ['evidencia_min_chars','obs_no_continua_min_chars']
    };

    const paramMap = {};
    (params||[]).forEach(p => { paramMap[p.clave] = p; });

    let html = `
      <div class="main">
        <div class="bandeja-header">
          <div><h1>⚙ Parametrización</h1>
          <p>Solo el Administrador GH puede cambiar estos valores. Cada cambio queda en auditoría.</p></div>
        </div>

        <!-- Tabs -->
        <div class="filtros-tabs" style="margin-bottom:1.5rem">
          <button class="filtro-tab active" onclick="EvalAdmin.switchTab('params',this)">Parámetros</button>
          <button class="filtro-tab" onclick="EvalAdmin.switchTab('cargos',this)">Cargos</button>
          <button class="filtro-tab" onclick="EvalAdmin.switchTab('competencias',this)">Competencias</button>
          <button class="filtro-tab" onclick="EvalAdmin.switchTab('matriz',this)">Matriz</button>
          <button class="filtro-tab" onclick="EvalAdmin.switchTab('alias',this)">Alias de cargos</button>
        </div>

        <!-- PARÁMETROS -->
        <div id="tab-params">
          ${Object.entries(grupos).map(([grupo, claves]) => `
            <div class="eval-table-wrap" style="margin-bottom:1rem;">
              <div style="padding:.6rem 1rem;background:#f8fafc;border-bottom:1.5px solid #e2e8f0;font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">
                ${grupo}
              </div>
              <table class="eval-table">
                <thead><tr><th>Parámetro</th><th>Descripción</th><th style="width:200px">Valor</th></tr></thead>
                <tbody>
                  ${claves.map(clave => {
                    const p = paramMap[clave];
                    if (!p) return '';
                    const esModo = clave === 'modo_ponderacion';
                    return `
                      <tr>
                        <td><code style="font-size:.8rem;background:#f1f5f9;padding:.1em .4em;border-radius:4px;">${esc(clave)}</code></td>
                        <td style="font-size:.82rem;color:#64748b;">${esc(p.descripcion||'')}</td>
                        <td>
                          ${esModo ? `
                            <select class="form-control" style="font-size:.84rem;"
                              onchange="EvalAdmin.guardarParam('${clave}',this.value)">
                              <option value="POR_PUNTOS" ${p.valor==='POR_PUNTOS'?'selected':''}>Por puntos (default)</option>
                              <option value="POR_GRUPO"  ${p.valor==='POR_GRUPO' ?'selected':''}>Ponderado por grupo</option>
                            </select>` : `
                            <input type="text" class="form-control" style="font-size:.84rem;"
                              value="${esc(p.valor)}"
                              onchange="EvalAdmin.guardarParam('${clave}',this.value)" />`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}

          <!-- Vista previa de clasificación -->
          <div class="panel-card" style="margin-top:1rem;">
            <h3>Vista previa — Clasificación</h3>
            <p style="font-size:.82rem;color:#64748b;margin-bottom:.75rem;">
              Ingresa un índice para ver cómo lo clasifica el sistema con los parámetros actuales.
            </p>
            <div style="display:flex;gap:.75rem;align-items:center;">
              <input type="number" id="preview-indice" class="form-control" style="max-width:120px;"
                placeholder="Ej: 84.9" step="0.1" min="0" max="100"
                oninput="EvalAdmin.previewClasif()" />
              <div id="preview-resultado" style="font-size:.88rem;"></div>
            </div>
          </div>
        </div>

        <!-- CARGOS -->
        <div id="tab-cargos" style="display:none">
          <div class="eval-table-wrap">
            <table class="eval-table">
              <thead><tr>
                <th>Nombre</th><th>Área</th><th>Nivel</th>
                <th>Personal a cargo</th><th>Empresa</th><th>Activo</th>
              </tr></thead>
              <tbody>
                ${(cargos||[]).map(c => `
                  <tr>
                    <td><strong>${esc(c.nombre)}</strong></td>
                    <td>${esc(c.area)}</td>
                    <td>${esc(c.nivel||'')}</td>
                    <td>${c.tiene_personal_a_cargo ? '✓' : '—'}</td>
                    <td>${esc(c.empresa||'Ambas')}</td>
                    <td>${c.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-neutral">Inactivo</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- COMPETENCIAS -->
        <div id="tab-competencias" style="display:none">
          <div class="eval-table-wrap">
            <table class="eval-table">
              <thead><tr>
                <th>Código</th><th>Nombre</th><th>Tipo</th><th>Definición</th>
              </tr></thead>
              <tbody>
                ${(comps||[]).map(c => `
                  <tr>
                    <td><code style="font-size:.8rem;background:#dbeafe;color:#1e40af;padding:.1em .4em;border-radius:4px;">${esc(c.codigo)}</code></td>
                    <td><strong>${esc(c.nombre)}</strong></td>
                    <td><span class="badge badge-neutral" style="font-size:.72rem;">${esc(c.tipo)}</span></td>
                    <td style="font-size:.8rem;color:#64748b;max-width:300px;">${esc(c.definicion||'')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- MATRIZ -->
        <div id="tab-matriz" style="display:none">
          <p class="text-muted" style="margin-bottom:1rem;font-size:.85rem;">
            La matriz relaciona cada cargo con sus competencias y el grado exigido.
            Para modificarla, usa la pantalla de importación del Excel o edita directamente en Supabase.
          </p>
          <div id="matriz-contenido"><div class="loading">Cargando…</div></div>
        </div>

        <!-- ALIAS -->
        <div id="tab-alias" style="display:none">
          <p class="text-muted" style="margin-bottom:1rem;font-size:.85rem;">
            Los alias relacionan nombres de cargos anteriores (nómina, manuales) con el cargo del diccionario.
          </p>
          <div id="alias-contenido"><div class="loading">Cargando…</div></div>
        </div>

      </div>
    `;

    c.innerHTML = html;
  },

  switchTab(tab, btn) {
    ['params','cargos','competencias','matriz','alias'].forEach(t => {
      const el = document.getElementById(`tab-${t}`);
      if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.filtro-tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');

    if (tab === 'matriz') this.cargarMatriz();
    if (tab === 'alias')  this.cargarAlias();
  },

  async cargarMatriz() {
    const c = document.getElementById('matriz-contenido');
    const { data } = await sb.from('matriz_cargo_competencia')
      .select('grado_exigido, cargo:cargo_id(nombre,area), competencia:competencia_id(codigo,nombre,tipo)')
      .eq('version_diccionario',2)
      .order('cargo_id, competencia_id');

    if (!data?.length) { c.innerHTML = '<p class="empty-state">Sin datos en la matriz.</p>'; return; }

    const filas = data.map(m => `
      <tr>
        <td><strong>${esc(m.cargo?.nombre)}</strong></td>
        <td style="color:#64748b;font-size:.82rem;">${esc(m.cargo?.area)}</td>
        <td><code style="font-size:.78rem;background:#dbeafe;color:#1e40af;padding:.1em .4em;border-radius:4px;">${esc(m.competencia?.codigo)}</code></td>
        <td>${esc(m.competencia?.nombre)}</td>
        <td><span class="badge badge-info">${esc(m.grado_exigido)}</span></td>
      </tr>
    `).join('');

    c.innerHTML = `
      <div class="eval-table-wrap">
        <table class="eval-table">
          <thead><tr><th>Cargo</th><th>Área</th><th>Código</th><th>Competencia</th><th>Grado exigido</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;
  },

  async cargarAlias() {
    const c = document.getElementById('alias-contenido');
    const { data } = await sb.from('cargo_alias')
      .select('*, cargo:cargo_id(nombre)')
      .order('nombre_anterior');

    const filas = (data||[]).map(a => `
      <tr>
        <td>${esc(a.nombre_anterior)}</td>
        <td>→</td>
        <td><strong>${esc(a.cargo?.nombre||'—')}</strong></td>
      </tr>
    `).join('');

    c.innerHTML = `
      <div class="eval-table-wrap" style="margin-bottom:1rem;">
        <table class="eval-table">
          <thead><tr><th>Nombre anterior</th><th></th><th>Cargo en el diccionario</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="3" class="empty-state">Sin alias configurados.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  },

  async guardarParam(clave, valor) {
    const { error } = await sb.from('parametros_evaluacion')
      .update({ valor }).eq('clave', clave);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    if (EvalMod.parametros) EvalMod.parametros[clave] = valor;
    await sb.from('auditoria_evaluacion').insert({
      tabla: 'parametros_evaluacion', registro_id: '00000000-0000-0000-0000-000000000000',
      accion: 'edicion', campo: clave, valor_nuevo: valor,
      usuario_nombre: EvalMod.usuarioActual?.nombre || 'GH'
    });
    toast(`"${clave}" actualizado ✓`);
  },

  previewClasif() {
    const val = parseFloat(document.getElementById('preview-indice')?.value);
    const res = document.getElementById('preview-resultado');
    if (!res || isNaN(val)) return;
    const p  = EvalMod.parametros || {};
    const b1 = parseFloat(p.banda_cumple_perfil  || 100);
    const b2 = parseFloat(p.banda_oportunidades  || 85);
    const b3 = parseFloat(p.banda_parcial        || 70);
    const clasif = val >= b1 ? 'cumple_perfil'
                 : val >= b2 ? 'oportunidades_mejora'
                 : val >= b3 ? 'cumple_parcialmente'
                 :             'no_cumple';
    res.innerHTML = CLASIF_LABEL[clasif]
      ? `<span class="badge ${CLASIF_BADGE[clasif]}" style="font-size:.84rem">${CLASIF_LABEL[clasif]}</span>`
      : '';
  },

  /* ════════════════════════════════════════════════════════
     CICLOS DE DESEMPEÑO
     ════════════════════════════════════════════════════════ */
  async mostrarCiclos() {
    EvalMod.renderTopbar('ciclos');
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando ciclos…</div>';

    const { data: ciclos } = await sb.from('ciclos_evaluacion')
      .select('*').eq('tipo','DESEMPENO').order('created_at', { ascending: false });

    const filas = (ciclos||[]).map(ci => {
      const badge = ci.estado === 'en_curso'  ? '<span class="badge badge-info">En curso</span>'
                  : ci.estado === 'cerrado'   ? '<span class="badge badge-neutral">Cerrado</span>'
                  :                             '<span class="badge badge-warning">Abierto</span>';
      return `
        <tr>
          <td><strong>${esc(ci.nombre)}</strong></td>
          <td>${fmtDate(ci.fecha_corte)}</td>
          <td>${fmtDate(ci.fecha_fin_jefe)}</td>
          <td>${badge}</td>
          <td>
            ${ci.estado === 'abierto' ? `
              <button class="btn-accion" onclick="EvalAdmin.lanzarCiclo('${ci.id}')">
                🚀 Generar evaluaciones
              </button>` : ''}
            <button class="btn-accion secundario" onclick="EvalAdmin.verAvanceCiclo('${ci.id}','${esc(ci.nombre)}')">
              📊 Ver avance
            </button>
            ${ci.estado === 'en_curso' ? `
              <button class="btn-accion secundario" onclick="EvalAdmin.cerrarCiclo('${ci.id}')">
                🔒 Cerrar
              </button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    c.innerHTML = `
      <div class="main">
        <div class="bandeja-header">
          <div><h1>🔄 Ciclos de Desempeño</h1>
          <p>Ciclo I: julio (evalúa enero–junio) · Ciclo II: enero (evalúa julio–diciembre)</p></div>
          <button class="btn-accion" onclick="EvalAdmin.mostrarFormCiclo()">+ Nuevo ciclo</button>
        </div>

        <div class="eval-table-wrap">
          <table class="eval-table">
            <thead><tr>
              <th>Nombre</th><th>Fecha de corte</th><th>Límite jefe</th><th>Estado</th><th>Acciones</th>
            </tr></thead>
            <tbody>${filas || '<tr><td colspan="5" class="empty-state">Sin ciclos creados.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  mostrarFormCiclo() {
    const c = document.getElementById('app-contenido');
    const hoy = new Date().toISOString().split('T')[0];
    c.innerHTML = `
      <div class="main" style="max-width:640px">
        <div class="bandeja-header">
          <div><h1>Nuevo ciclo de desempeño</h1></div>
          <button class="btn-accion secundario" onclick="EvalAdmin.mostrarCiclos()">← Volver</button>
        </div>
        <div class="panel-card">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div style="grid-column:1/-1">
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Nombre del ciclo *</label>
              <input id="ci-nombre" type="text" class="form-control" placeholder="Ej: Desempeño 2026-II" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Periodo evaluado — inicio</label>
              <input id="ci-per-ini" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Periodo evaluado — fin (fecha de corte) *</label>
              <input id="ci-corte" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Inicio autoevaluación</label>
              <input id="ci-auto-ini" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Fin autoevaluación (día 7)</label>
              <input id="ci-auto-fin" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Inicio evaluación del jefe</label>
              <input id="ci-jefe-ini" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Límite evaluación del jefe (día 10) *</label>
              <input id="ci-jefe-fin" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Inicio revisión GH (día 11)</label>
              <input id="ci-rev-ini" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Fin revisión GH (día 15)</label>
              <input id="ci-rev-fin" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Inicio retroalimentación (día 16)</label>
              <input id="ci-retro-ini" type="date" class="form-control" />
            </div>
            <div>
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">Fin retroalimentación (día 25)</label>
              <input id="ci-retro-fin" type="date" class="form-control" />
            </div>
            <div style="grid-column:1/-1">
              <label style="font-size:.82rem;font-weight:700;display:block;margin-bottom:.3rem;">¿Incluye autoevaluación (180°)?</label>
              <select id="ci-auto" class="form-control">
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          <div style="margin-top:1.25rem;display:flex;gap:.75rem;">
            <button class="btn-accion" onclick="EvalAdmin.crearCiclo()">Crear ciclo</button>
            <button class="btn-accion secundario" onclick="EvalAdmin.mostrarCiclos()">Cancelar</button>
          </div>
        </div>
      </div>
    `;
  },

  async crearCiclo() {
    const nombre   = document.getElementById('ci-nombre')?.value.trim();
    const corte    = document.getElementById('ci-corte')?.value;
    const jefeFin  = document.getElementById('ci-jefe-fin')?.value;
    if (!nombre || !corte) { toast('Nombre y fecha de corte son obligatorios', 'warning'); return; }

    const { data, error } = await sb.from('ciclos_evaluacion').insert({
      tipo: 'DESEMPENO', nombre, estado: 'abierto',
      incluye_autoevaluacion: document.getElementById('ci-auto')?.value === 'true',
      periodo_evaluado_inicio: document.getElementById('ci-per-ini')?.value || null,
      periodo_evaluado_fin:    corte,
      fecha_corte:             corte,
      fecha_limite:            jefeFin || null,
      fecha_inicio_autoevaluacion: document.getElementById('ci-auto-ini')?.value || null,
      fecha_fin_autoevaluacion:    document.getElementById('ci-auto-fin')?.value || null,
      fecha_inicio_jefe:       document.getElementById('ci-jefe-ini')?.value || null,
      fecha_fin_jefe:          jefeFin || null,
      fecha_inicio_revision:   document.getElementById('ci-rev-ini')?.value || null,
      fecha_fin_revision:      document.getElementById('ci-rev-fin')?.value || null,
      fecha_inicio_retro:      document.getElementById('ci-retro-ini')?.value || null,
      fecha_fin_retro:         document.getElementById('ci-retro-fin')?.value || null,
      creado_por: EvalMod.usuarioActual?.nombre || 'GH'
    }).select().single();

    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast('Ciclo creado ✓');
    this.mostrarCiclos();
  },

  async lanzarCiclo(cicloId) {
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Calculando lista de evaluados…</div>';

    const { data, error } = await sb.rpc('fn_generar_ciclo_desempeno', { p_ciclo_id: cicloId });
    if (error) { toast('Error: ' + error.message, 'error'); this.mostrarCiclos(); return; }

    const excluidos = data.detalle_excluidos || [];
    c.innerHTML = `
      <div class="main">
        <h1>Resultado de generación</h1>
        <div class="resumen-grid" style="margin-bottom:1.5rem;">
          <div class="resumen-card">
            <div class="resumen-label">Evaluaciones creadas</div>
            <div class="resumen-num" style="color:#16a34a;">${data.incluidos}</div>
          </div>
          <div class="resumen-card">
            <div class="resumen-label">Excluidos</div>
            <div class="resumen-num" style="color:#d97706;">${data.excluidos}</div>
          </div>
        </div>
        ${excluidos.length > 0 ? `
          <div class="eval-table-wrap">
            <div style="padding:.6rem 1rem;background:#fffbeb;border-bottom:1.5px solid #fde68a;font-size:.8rem;font-weight:700;color:#92400e;">
              Colaboradores excluidos y motivo
            </div>
            <table class="eval-table">
              <thead><tr><th>Nombre</th><th>Cargo</th><th>Motivo</th></tr></thead>
              <tbody>
                ${excluidos.map(e => `
                  <tr>
                    <td>${esc(e.nombre)}</td>
                    <td>${esc(e.cargo)}</td>
                    <td style="color:#64748b;font-size:.82rem;">${esc(e.motivo)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>` : ''}
        <div style="margin-top:1.25rem;">
          <button class="btn-accion" onclick="EvalAdmin.mostrarCiclos()">← Volver a ciclos</button>
        </div>
      </div>
    `;
  },

  async verAvanceCiclo(cicloId, cicloNombre) {
    const c = document.getElementById('app-contenido');
    c.innerHTML = '<div class="loading">Cargando avance…</div>';

    const { data } = await sb.from('v_avance_ciclo')
      .select('*').eq('ciclo', cicloNombre);

    const total    = data?.length || 0;
    const enviadas = (data||[]).filter(e => ['enviada_gh','socializada','firmada','cerrada'].includes(e.estado)).length;
    const pct      = total ? Math.round(enviadas/total*100) : 0;

    const filas = (data||[]).map(e => `
      <tr>
        <td>${esc(e.colaborador)}</td>
        <td>${esc(e.cargo_nombre)}</td>
        <td>${esc(e.evaluador_nombre)}</td>
        <td>${esc(e.sede||'')}</td>
        <td>${estadoBadge(e.estado)}</td>
        <td>${e.indice_ajuste != null ? e.indice_ajuste+'%' : '—'}</td>
        <td>${fmtDate(e.fecha_envio?.split('T')[0])}</td>
      </tr>
    `).join('');

    c.innerHTML = `
      <div class="main">
        <div class="bandeja-header">
          <div><h1>📊 ${esc(cicloNombre)}</h1></div>
          <button class="btn-accion secundario" onclick="EvalAdmin.mostrarCiclos()">← Ciclos</button>
        </div>
        <div class="resumen-grid" style="margin-bottom:1.5rem;">
          <div class="resumen-card">
            <div class="resumen-label">Enviadas / Total</div>
            <div class="resumen-num">${enviadas} de ${total}</div>
            <div class="resumen-progress"><div class="resumen-progress-bar" style="width:${pct}%"></div></div>
          </div>
          <div class="resumen-card">
            <div class="resumen-label">Pendientes</div>
            <div class="resumen-num">${(data||[]).filter(e=>e.estado==='pendiente').length}</div>
          </div>
          <div class="resumen-card">
            <div class="resumen-label">Vencidas</div>
            <div class="resumen-num" style="color:#dc2626">${(data||[]).filter(e=>e.vencida).length}</div>
          </div>
        </div>
        <div class="eval-table-wrap">
          <table class="eval-table">
            <thead><tr>
              <th>Colaborador</th><th>Cargo</th><th>Líder</th><th>Sede</th>
              <th>Estado</th><th>Índice</th><th>Enviada</th>
            </tr></thead>
            <tbody>${filas || '<tr><td colspan="7" class="empty-state">Sin datos.</td></tr>'}</tbody>
          </table>
        </div>
        <div style="margin-top:1rem;">
          <button class="btn-accion" onclick="EvalAdmin.exportarExcel('avance','${esc(cicloNombre)}')">
            📥 Exportar a Excel
          </button>
        </div>
      </div>
    `;
  },

  async cerrarCiclo(cicloId) {
    if (!confirm('¿Cerrar este ciclo? Las evaluaciones pendientes quedarán como vencidas.')) return;
    await sb.from('ciclos_evaluacion').update({ estado:'cerrado' }).eq('id', cicloId);
    toast('Ciclo cerrado ✓');
    this.mostrarCiclos();
  },

  /* ════════════════════════════════════════════════════════
     REPORTES
     ════════════════════════════════════════════════════════ */
  async mostrarReportes() {
    EvalMod.renderTopbar('reportes');
    const c = document.getElementById('app-contenido');

    c.innerHTML = `
      <div class="main">
        <div class="bandeja-header">
          <div><h1>📈 Reportes</h1><p>Todos los reportes se pueden exportar a Excel.</p></div>
        </div>
        <div class="resumen-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;">
          ${[
            ['brechas',       '🔍 Brechas por competencia',    'Insumo para el plan de capacitación'],
            ['capacitacion',  '🎓 Necesidades de capacitación','Competencias con brecha ≥ 30 % del cargo'],
            ['promocion',     '⬆ Elegibles para promoción',   'Dos últimas evaluaciones en verde sin planes vencidos'],
            ['reconocimiento','🏆 Candidatos a reconocimiento','Cumple el perfil con fortalezas'],
            ['planes',        '📋 Planes de mejora',           'Seguimiento a compromisos por vencer o vencidos'],
            ['consolidado',   '📊 Informe consolidado',        'Resultados por empresa, área, cargo y sede'],
          ].map(([key, titulo, desc]) => `
            <div class="panel-card" style="cursor:pointer;" onclick="EvalAdmin.cargarReporte('${key}')">
              <h3 style="font-size:.95rem;">${titulo}</h3>
              <p style="font-size:.8rem;color:#64748b;margin-top:.3rem;">${desc}</p>
            </div>
          `).join('')}
        </div>
        <div id="reporte-contenido" style="margin-top:1.5rem;"></div>
      </div>
    `;
  },

  async cargarReporte(tipo) {
    const c = document.getElementById('reporte-contenido');
    c.innerHTML = '<div class="loading">Cargando…</div>';

    const vistas = {
      brechas:        { view: 'v_brechas_por_competencia',   cols: ['ciclo','cargo_nombre','codigo','nombre_comp','grupo_competencia','grado_exigido','total_evaluados','total_brechas','pct_brecha','requiere_capacitacion'] },
      capacitacion:   { view: 'v_necesidades_capacitacion',  cols: ['ciclo','cargo_nombre','codigo','nombre_comp','grupo_competencia','total_evaluados','total_brechas','pct_brecha'] },
      promocion:      { view: 'v_elegibles_promocion',       cols: ['colaborador','cedula','cargo','indice_ultimo','clasif_ultimo','indice_penultimo','clasif_penultimo'] },
      reconocimiento: { view: 'v_candidatos_reconocimiento', cols: ['colaborador','cedula','cargo_nombre','indice_ajuste','fortalezas','nombres_fortalezas'] },
      planes:         { view: 'v_planes_seguimiento',        cols: ['colaborador','cargo_nombre','lider','ciclo','nombre_competencia','accion','responsable_nombre','fecha_compromiso','fecha_seguimiento','estado','vencido_sin_seguimiento'] },
      consolidado:    { view: 'v_informe_consolidado',       cols: ['ciclo','empresa','area','cargo_nombre','sede','lider','total','cerradas','cumple_perfil','oportunidades_mejora','cumple_parcialmente','no_cumple','indice_promedio'] }
    };

    const cfg = vistas[tipo];
    if (!cfg) return;

    const { data, error } = await sb.from(cfg.view).select('*');
    if (error) { c.innerHTML = `<p class="text-danger">${error.message}</p>`; return; }

    this._reporteData  = data;
    this._reporteTipo  = tipo;
    this._reporteCols  = cfg.cols;

    const encabezados = cfg.cols.map(col =>
      `<th>${col.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</th>`
    ).join('');

    const filas = (data||[]).map(row =>
      `<tr>${cfg.cols.map(col => `<td style="font-size:.82rem;">${esc(String(row[col]??'—'))}</td>`).join('')}</tr>`
    ).join('');

    c.innerHTML = `
      <div class="eval-table-wrap">
        <div style="padding:.75rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #e2e8f0;">
          <span style="font-size:.85rem;color:#64748b;">${(data||[]).length} registros</span>
          <button class="btn-accion" onclick="EvalAdmin.exportarExcel('${tipo}')">📥 Exportar a Excel</button>
        </div>
        <div style="overflow-x:auto;">
          <table class="eval-table">
            <thead><tr>${encabezados}</tr></thead>
            <tbody>${filas || '<tr><td colspan="20" class="empty-state">Sin datos.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  exportarExcel(tipo, nombre) {
    const data = this._reporteData;
    const cols = this._reporteCols;
    if (!data || !cols) { toast('Carga primero el reporte', 'warning'); return; }

    // Construir CSV y descargarlo (Excel abre CSV directamente)
    const header = cols.join(';');
    const filas  = data.map(row =>
      cols.map(col => {
        const val = String(row[col] ?? '');
        return val.includes(';') || val.includes('"') ? `"${val.replace(/"/g,'""')}"` : val;
      }).join(';')
    );
    const csv = '\uFEFF' + [header, ...filas].join('\n'); // BOM para Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exportado ✓');
  }
};
