/* ============================================================
   GH PRO — Módulo de Contratación · Capa de datos
   Requiere: supabase.js (sb ya definido)
   ============================================================ */
'use strict';

/* ── Helpers de formateo local ────────────────────────────────*/
const fmtCOP = (n) => {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
};
/* ── Tablas maestras ─────────────────────────────────────────*/
const MaestrasContratacion = {
  _cache: {},

  async _get(tabla, orderBy = 'nombre') {
    if (this._cache[tabla]) return this._cache[tabla];
    const { data, error } = await sb.from(tabla).select('*').eq('activo', true).order(orderBy);
    if (sbErr(error, tabla)) return [];
    this._cache[tabla] = data;
    return data;
  },

  getSedes()     { return this._get('sedes'); },
  getCargos()    { return this._get('cargos_maestros'); },
  getEPS()       { return this._get('eps_lista'); },
  getAFP()       { return this._get('afp_lista'); },
  getCesantias() { return this._get('cesantias_lista'); },
  getARL()       { return this._get('arl_lista'); },
  getCajas()     { return this._get('cajas_lista'); },
  getBancos()    { return this._get('bancos_lista'); },

  async getParametro(anio) {
    const a = anio || new Date().getFullYear();
    const { data, error } = await sb.from('parametros_legales').select('*').eq('anio', a).single();
    if (error) return null;
    return data;
  },

  async getParametroVigente() {
    const { data, error } = await sb
      .from('parametros_legales').select('*').order('anio', { ascending: false }).limit(1).single();
    if (error) return { smmlv: 1560000, aux_transporte: 220000 };
    return data;
  },

  invalidate() { this._cache = {}; },
};

/* ── Consecutivos ────────────────────────────────────────────*/
const Consecutivos = {
  async siguiente(tipo) {
    const { data, error } = await sb.rpc('fn_siguiente_consecutivo', { p_tipo: tipo });
    if (sbErr(error, 'consecutivo.' + tipo)) return null;
    return data;
  },
};

/* ── Requisición GH-F01 ──────────────────────────────────────*/
const Requisicion = {
  async getAll(filtros = {}) {
    let q = sb.from('requisicion_personal').select('*').order('created_at', { ascending: false });
    if (filtros.empresa) q = q.eq('empresa', filtros.empresa);
    if (filtros.estado)  q = q.eq('estado', filtros.estado);
    if (filtros.area)    q = q.eq('area', filtros.area);
    const { data, error } = await q;
    if (sbErr(error, 'requisicion.getAll')) return [];
    return data;
  },

  async getById(id) {
    const { data, error } = await sb.from('requisicion_personal').select('*').eq('id', id).single();
    if (sbErr(error, 'requisicion.getById')) return null;
    return data;
  },

  async insert(row) {
    const num = await Consecutivos.siguiente('REQ');
    if (!num) return null;
    const payload = { ...row, numero: num };
    const { data, error } = await sb.from('requisicion_personal').insert([payload]).select().single();
    if (sbErr(error, 'requisicion.insert')) return null;
    return data;
  },

  async update(id, row, usuario = 'Sistema') {
    // Log historial de campos sensibles
    const original = await this.getById(id);
    if (original) {
      const campos = ['cargo_nombre', 'salario', 'tipo_contrato', 'jefe_inmediato', 'estado'];
      for (const c of campos) {
        if (row[c] !== undefined && String(row[c]) !== String(original[c])) {
          await Historial.log('requisicion_personal', id, c, original[c], row[c], usuario);
        }
      }
    }
    const { data, error } = await sb
      .from('requisicion_personal').update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (sbErr(error, 'requisicion.update')) return null;
    return data;
  },

  async aprobar(id, rol, nombre, decision, comentario = '') {
    const req = await this.getById(id);
    if (!req) return false;
    if (['rechazada','cubierta','cancelada'].includes(req.estado)) {
      toast('La requisición ya fue ' + req.estado + '. No se puede modificar.', 'warning');
      return false;
    }
    // Registrar aprobación
    await Aprobaciones.registrar('requisicion_personal', id, rol, nombre, decision, comentario);
    // Cambiar estado según decisión (cualquier rol que rechace → rechazada; gh que aprueba → aprobada)
    let nuevoEstado = req.estado;
    if (decision === 'rechazado') {
      nuevoEstado = 'rechazada';
    } else if (decision === 'aprobado') {
      nuevoEstado = 'aprobada';
    }
    const upd = { estado: nuevoEstado };
    if (decision === 'rechazado' && comentario) upd.motivo_rechazo = comentario;
    if (decision === 'aprobado') upd.motivo_rechazo = null;
    await this.update(id, upd, nombre);
    return true;
  },
};

/* ── Candidatos ──────────────────────────────────────────────*/
const Candidatos = {
  async getByRequisicion(requisicion_id) {
    const { data, error } = await sb
      .from('candidatos').select('*').eq('requisicion_id', requisicion_id)
      .neq('estado', 'eliminado').order('nombre');
    if (sbErr(error, 'candidatos.getByRequisicion')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb.from('candidatos').insert([row]).select().single();
    if (sbErr(error, 'candidatos.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb.from('candidatos').update(row).eq('id', id).select().single();
    if (sbErr(error, 'candidatos.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb.from('candidatos').update({ estado: 'eliminado' }).eq('id', id);
    return !sbErr(error, 'candidatos.delete');
  },
};

/* ── Validación de Referencias GH-F02 ───────────────────────*/
const ValidacionReferencias = {
  async getAll(filtros = {}) {
    let q = sb.from('validacion_referencias').select('*').order('created_at', { ascending: false });
    if (filtros.requisicion_id) q = q.eq('requisicion_id', filtros.requisicion_id);
    if (filtros.candidato_id)   q = q.eq('candidato_id', filtros.candidato_id);
    const { data, error } = await q;
    if (sbErr(error, 'vr.getAll')) return [];
    return data;
  },

  async getById(id) {
    const { data, error } = await sb.from('validacion_referencias').select('*').eq('id', id).single();
    if (sbErr(error, 'vr.getById')) return null;
    return data;
  },

  async insert(row) {
    const num = await Consecutivos.siguiente('VR');
    if (!num) return null;
    const { data, error } = await sb
      .from('validacion_referencias').insert([{ ...row, numero: num }]).select().single();
    if (sbErr(error, 'vr.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('validacion_referencias').update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (sbErr(error, 'vr.update')) return null;
    return data;
  },

  async cerrar(id, concepto, inconsistencias, obs, obs_gh, responsable) {
    // Regla: si hay ref no favorable, obs_gh es obligatoria
    if ((concepto === 'no_favorable' || inconsistencias) && !obs_gh) {
      toast('Debe agregar observación de GH cuando hay referencias no favorables o inconsistencias.', 'warning');
      return false;
    }
    const { data, error } = await sb.from('validacion_referencias')
      .update({ estado: 'cerrada', concepto, inconsistencias, observaciones: obs,
                obs_gh, responsable, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (sbErr(error, 'vr.cerrar')) return false;
    return data;
  },

  // Referencias personales
  async getPersonales(validacion_id) {
    const { data, error } = await sb.from('referencias_personales')
      .select('*').eq('validacion_id', validacion_id).order('created_at');
    if (sbErr(error, 'ref_personales.get')) return [];
    return data;
  },

  async insertPersonal(row) {
    const { data, error } = await sb.from('referencias_personales').insert([row]).select().single();
    if (sbErr(error, 'ref_personales.insert')) return null;
    return data;
  },

  async updatePersonal(id, row) {
    const { data, error } = await sb.from('referencias_personales').update(row).eq('id', id).select().single();
    if (sbErr(error, 'ref_personales.update')) return null;
    return data;
  },

  async deletePersonal(id) {
    const { error } = await sb.from('referencias_personales').delete().eq('id', id);
    return !sbErr(error, 'ref_personales.delete');
  },

  // Referencias laborales
  async getLaborales(validacion_id) {
    const { data, error } = await sb.from('referencias_laborales')
      .select('*').eq('validacion_id', validacion_id).order('fecha_retiro', { ascending: false });
    if (sbErr(error, 'ref_laborales.get')) return [];
    return data;
  },

  async insertLaboral(row) {
    const { data, error } = await sb.from('referencias_laborales').insert([row]).select().single();
    if (sbErr(error, 'ref_laborales.insert')) return null;
    return data;
  },

  async updateLaboral(id, row) {
    const { data, error } = await sb.from('referencias_laborales').update(row).eq('id', id).select().single();
    if (sbErr(error, 'ref_laborales.update')) return null;
    return data;
  },

  async deleteLaboral(id) {
    const { error } = await sb.from('referencias_laborales').delete().eq('id', id);
    return !sbErr(error, 'ref_laborales.delete');
  },
};

/* ── Orden de Contratación GH-F03 ────────────────────────────*/
const OrdenContratacion = {
  async getAll(filtros = {}) {
    let q = sb.from('orden_contratacion').select('*').order('created_at', { ascending: false });
    if (filtros.empresa) q = q.eq('empresa', filtros.empresa);
    if (filtros.estado)  q = q.eq('estado', filtros.estado);
    const { data, error } = await q;
    if (sbErr(error, 'oc.getAll')) return [];
    return data;
  },

  async getById(id) {
    const { data, error } = await sb.from('orden_contratacion').select('*').eq('id', id).single();
    if (sbErr(error, 'oc.getById')) return null;
    return data;
  },

  async insert(row) {
    // Bloqueos de negocio
    const bloqueo = await this._validarBloqueos(row);
    if (bloqueo) { toast(bloqueo, 'error'); return null; }

    const num = await Consecutivos.siguiente('OC');
    if (!num) return null;
    const { data, error } = await sb
      .from('orden_contratacion').insert([{ ...row, numero: num }]).select().single();
    if (sbErr(error, 'oc.insert')) return null;
    return data;
  },

  async update(id, row, usuario = 'Sistema') {
    const original = await this.getById(id);
    if (original && ['aprobada','contrato_generado'].includes(original.estado) && !row.estado) {
      toast('No se puede modificar una orden aprobada. Use Anular.', 'warning');
      return null;
    }
    // Log historial
    if (original) {
      const campos = ['cargo','salario','tipo_contrato','fecha_ingreso','jefe_inmediato','empresa'];
      for (const c of campos) {
        if (row[c] !== undefined && String(row[c]) !== String(original[c])) {
          await Historial.log('orden_contratacion', id, c, original[c], row[c], usuario);
        }
      }
    }
    const { data, error } = await sb
      .from('orden_contratacion').update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (sbErr(error, 'oc.update')) return null;
    return data;
  },

  async aprobar(id, rol, nombre, decision, comentario = '') {
    const oc = await this.getById(id);
    if (!oc) return false;
    if (['aprobada','rechazada','anulada'].includes(oc.estado)) {
      toast('La orden ya fue procesada.', 'warning');
      return false;
    }
    await Aprobaciones.registrar('orden_contratacion', id, rol, nombre, decision, comentario);
    if (rol === 'gerencia') {
      const nuevoEstado = decision === 'aprobado' ? 'aprobada' : 'rechazada';
      await this.update(id, { estado: nuevoEstado, motivo_rechazo: decision === 'rechazado' ? comentario : null }, nombre);
      // Si aprobada: marcar candidato como seleccionado y requisición
      if (decision === 'aprobado' && oc.candidato_id) {
        await Candidatos.update(oc.candidato_id, { estado: 'seleccionado' });
      }
      if (decision === 'aprobado' && oc.requisicion_id) {
        await _actualizarEstadoRequisicion(oc.requisicion_id);
      }
    }
    return true;
  },

  async anular(id, motivo, usuario) {
    const oc = await this.getById(id);
    if (!oc) return false;
    if (oc.estado === 'anulada') { toast('Ya está anulada.', 'warning'); return false; }
    await Historial.log('orden_contratacion', id, 'estado', oc.estado, 'anulada', usuario);
    const { error } = await sb.from('orden_contratacion')
      .update({ estado: 'anulada', motivo_anulacion: motivo, updated_at: new Date().toISOString() })
      .eq('id', id);
    return !sbErr(error, 'oc.anular');
  },

  async _validarBloqueos(row) {
    if (!row.requisicion_id) return 'Debe asociar una requisición.';
    const req = await Requisicion.getById(row.requisicion_id);
    if (!req) return 'Requisición no encontrada.';
    if (req.estado !== 'aprobada' && req.estado !== 'en_seleccion') {
      return `La requisición no está aprobada (estado: ${req.estado}).`;
    }
    if (row.validacion_id) {
      const vr = await ValidacionReferencias.getById(row.validacion_id);
      if (!vr || vr.estado !== 'cerrada') {
        return 'La validación de referencias debe estar cerrada.';
      }
      if (vr.concepto === 'no_favorable') {
        return 'La validación de referencias tiene concepto no favorable. No se puede proceder.';
      }
    }
    return null; // sin bloqueo
  },

  // Beneficiarios
  async getBeneficiarios(orden_id) {
    const { data, error } = await sb.from('beneficiarios_orden')
      .select('*').eq('orden_id', orden_id).order('nombre');
    if (sbErr(error, 'beneficiarios.get')) return [];
    return data;
  },

  async insertBeneficiario(row) {
    const { data, error } = await sb.from('beneficiarios_orden').insert([row]).select().single();
    if (sbErr(error, 'beneficiarios.insert')) return null;
    return data;
  },

  async deleteBeneficiario(id) {
    const { error } = await sb.from('beneficiarios_orden').delete().eq('id', id);
    return !sbErr(error, 'beneficiarios.delete');
  },
};

/* ── Aprobaciones ────────────────────────────────────────────*/
const Aprobaciones = {
  async get(tabla, registro_id) {
    const { data, error } = await sb.from('aprobaciones_contratacion')
      .select('*').eq('tabla_origen', tabla).eq('registro_id', registro_id)
      .order('fecha', { ascending: true });
    if (sbErr(error, 'aprobaciones.get')) return [];
    return data;
  },

  async registrar(tabla, registro_id, rol, nombre, decision, comentario = '') {
    // Elimina aprobación anterior del mismo rol si existe
    await sb.from('aprobaciones_contratacion')
      .delete().eq('tabla_origen', tabla).eq('registro_id', registro_id).eq('rol', rol);
    const { error } = await sb.from('aprobaciones_contratacion')
      .insert([{ tabla_origen: tabla, registro_id, rol, nombre_usuario: nombre, decision, comentario }]);
    return !sbErr(error, 'aprobaciones.registrar');
  },
};

/* ── Historial de cambios ────────────────────────────────────*/
const Historial = {
  async get(tabla, registro_id) {
    const { data, error } = await sb.from('historial_contratacion')
      .select('*').eq('tabla_origen', tabla).eq('registro_id', registro_id)
      .order('fecha', { ascending: false });
    if (sbErr(error, 'historial.get')) return [];
    return data;
  },

  async log(tabla, registro_id, campo, val_anterior, val_nuevo, usuario) {
    const { error } = await sb.from('historial_contratacion')
      .insert([{ tabla_origen: tabla, registro_id, campo,
                 valor_anterior: String(val_anterior ?? ''),
                 valor_nuevo: String(val_nuevo ?? ''), usuario }]);
    if (error) console.warn('[Historial] No se pudo guardar:', error.message);
  },
};

/* ── Reglas de negocio ───────────────────────────────────────*/
const ReglasContratacion = {
  /**
   * Calcula si aplica auxilio de transporte.
   * @param {number} salario
   * @param {{smmlv:number}} param
   */
  aplicaAuxTransporte(salario, param) {
    return salario <= (param.smmlv * 2);
  },

  /**
   * Valida periodo de prueba según tipo y duración.
   * @returns {string|null} mensaje de error o null si es válido
   */
  validarPeriodoPrueba(tipo_contrato, periodo_dias, duracion_meses) {
    if (periodo_dias < 0) return 'El periodo de prueba no puede ser negativo.';
    if (periodo_dias > 60) return 'El periodo de prueba no puede superar 60 días.';
    if (tipo_contrato === 'termino_fijo' && duracion_meses && duracion_meses < 12) {
      const maxDias = Math.floor((duracion_meses * 30) / 5);
      if (periodo_dias > maxDias) {
        return `Para contrato de ${duracion_meses} mes(es), el periodo de prueba no puede superar ${maxDias} días (1/5 de la duración).`;
      }
    }
    return null;
  },

  /**
   * Valida salario integral (mínimo 13 SMMLV).
   */
  validarSalarioIntegral(tipo_salario, salario, smmlv) {
    if (tipo_salario === 'integral' && salario < smmlv * 13) {
      return `Salario integral debe ser al menos ${fmtCOP(smmlv * 13)} (13 SMMLV).`;
    }
    return null;
  },

  /**
   * Valida que la fecha de ingreso no sea anterior a la aprobación de la orden.
   */
  validarFechaIngreso(fecha_ingreso, fecha_aprobacion) {
    if (!fecha_aprobacion) return null;
    if (new Date(fecha_ingreso) < new Date(fecha_aprobacion.split('T')[0])) {
      return 'La fecha de ingreso no puede ser anterior a la fecha de aprobación de la orden.';
    }
    return null;
  },
};

/* ── Entrevistas ─────────────────────────────────────────────*/
const Entrevistas = {
  async getByRequisicion(requisicion_id) {
    const { data, error } = await sb
      .from('entrevistas').select('*')
      .eq('requisicion_id', requisicion_id)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });
    if (sbErr(error, 'entrevistas.getByRequisicion')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('entrevistas').insert([{ ...row, updated_at: new Date().toISOString() }]).select().single();
    if (sbErr(error, 'entrevistas.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('entrevistas').update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (sbErr(error, 'entrevistas.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb.from('entrevistas').delete().eq('id', id);
    return !sbErr(error, 'entrevistas.delete');
  },
};

/* ── Helper interno ──────────────────────────────────────────*/
async function _actualizarEstadoRequisicion(requisicion_id) {
  const req = await Requisicion.getById(requisicion_id);
  if (!req) return;
  // Contar órdenes aprobadas para esta requisición
  const { count } = await sb.from('orden_contratacion')
    .select('id', { count: 'exact', head: true })
    .eq('requisicion_id', requisicion_id).eq('estado', 'aprobada');
  const cubiertas = count || 0;
  let nuevoEstado = req.estado;
  if (cubiertas >= req.num_vacantes) {
    nuevoEstado = 'cubierta';
  } else if (cubiertas > 0) {
    nuevoEstado = 'en_seleccion';
  }
  if (nuevoEstado !== req.estado) {
    await sb.from('requisicion_personal')
      .update({ estado: nuevoEstado, vacantes_cubiertas: cubiertas })
      .eq('id', requisicion_id);
  }
}

/* ── Reportes ────────────────────────────────────────────────*/
const ReportesContratacion = {
  async resumen() {
    const [reqs, ocs] = await Promise.all([
      Requisicion.getAll(),
      OrdenContratacion.getAll(),
    ]);
    return {
      total_requisiciones: reqs.length,
      pendientes: reqs.filter(r => r.estado === 'pendiente').length,
      aprobadas: reqs.filter(r => r.estado === 'aprobada').length,
      en_seleccion: reqs.filter(r => r.estado === 'en_seleccion').length,
      cubiertas: reqs.filter(r => r.estado === 'cubierta').length,
      ordenes_aprobadas: ocs.filter(o => o.estado === 'aprobada').length,
      ordenes_pendientes: ocs.filter(o => o.estado === 'pendiente_aprobacion').length,
    };
  },
};
