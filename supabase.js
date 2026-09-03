/* ============================================================
   GH PRO — Supabase client + data layer
   ============================================================ */

const SUPABASE_URL = 'https://rvosdhqidjqxzcbcdgzl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b3NkaHFpZGpxeHpjYmNkZ3psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzYwMjYsImV4cCI6MjEwMjkxMjAyNn0.CI2G80McLHoINOvAhrFT5t5ft7WX4H-H1BwdfPD--EM';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Error handler ─────────────────────────────────────────── */
function sbErr(error, ctx) {
  if (!error) return false;
  console.error(`[Supabase:${ctx}]`, error.message);
  toast(`Error en ${ctx}: ${error.message}`, 'error');
  return true;
}

/* ── Loading overlay ───────────────────────────────────────── */
function showLoading(show) {
  let el = document.getElementById('globalLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalLoader';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(10,10,26,0.7);z-index:9998;
      display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(4px);transition:opacity 0.2s;
    `;
    el.innerHTML = `<div style="text-align:center">
      <div style="width:48px;height:48px;border:3px solid rgba(108,99,255,0.3);
        border-top-color:#6c63ff;border-radius:50%;animation:spin 0.8s linear infinite;margin:auto"></div>
      <div style="margin-top:12px;color:#a0a0c0;font-size:13px">Cargando...</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

/* ============================================================
   TRABAJADORES
   ============================================================ */
const Trabajadores = {
  async getAll() {
    const { data, error } = await sb
      .from('trabajadores')
      .select('*')
      .order('nombre');
    if (sbErr(error, 'trabajadores.getAll')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('trabajadores')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'trabajadores.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('trabajadores')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'trabajadores.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('trabajadores')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'trabajadores.delete');
  },
};

/* ============================================================
   DOTACION
   ============================================================ */
const Dotacion = {
  async getAll() {
    const { data, error } = await sb
      .from('dotacion')
      .select('*')
      .order('nombre');
    if (sbErr(error, 'dotacion.getAll')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('dotacion')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'dotacion.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('dotacion')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'dotacion.update')) return null;
    return data;
  },

  async updateStock(id, delta) {
    // Read-modify-write: safe for low concurrency internal tool
    const { data: current, error: re } = await sb
      .from('dotacion')
      .select('stock')
      .eq('id', id)
      .single();
    if (sbErr(re, 'dotacion.updateStock.read')) return null;
    const newStock = Math.max(0, (current.stock || 0) + delta);
    const { data, error } = await sb
      .from('dotacion')
      .update({ stock: newStock })
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'dotacion.updateStock')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('dotacion')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'dotacion.delete');
  },
};

/* ============================================================
   ENTREGAS
   ============================================================ */
const Entregas = {
  async getAll() {
    const { data, error } = await sb
      .from('entregas')
      .select('*')
      .order('fecha', { ascending: false });
    if (sbErr(error, 'entregas.getAll')) return [];
    return data;
  },

  async insert(row) {
    // 1. Verificación de stock en dotacion_prendas si viene articulo_id
    if (row.articulo_id) {
      const { data: prenda, error: pErr } = await sb
        .from('dotacion_prendas')
        .select('id, stock, referencia, tipo, genero, talla')
        .eq('id', row.articulo_id)
        .single();
      
      if (pErr || !prenda) {
        toast('No se encontró la prenda seleccionada en inventario', 'error');
        return null;
      }
      if ((prenda.stock || 0) < row.cantidad) {
        toast(`Stock insuficiente para ${prenda.referencia} (${prenda.talla}). Disponible: ${prenda.stock || 0}`, 'error');
        return null;
      }
    }

    // 2. Insertar en tabla entregas
    let { data, error } = await sb
      .from('entregas')
      .insert([row])
      .select()
      .single();

    // Fallback de compatibilidad: si la BD aún tiene la FK antigua apuntando a tabla 'dotacion' (código 23503)
    if (error && error.code === '23503') {
      console.warn('[Entregas.insert] FK a dotacion antigua detectada. Reintentando con articulo_id = null...');
      const fallbackRow = { ...row, articulo_id: null };
      const resFallback = await sb
        .from('entregas')
        .insert([fallbackRow])
        .select()
        .single();
      data = resFallback.data;
      error = resFallback.error;
    }

    if (sbErr(error, 'entregas.insert')) return null;

    // 3. Descontar stock directamente de dotacion_prendas
    if (row.articulo_id) {
      await DotacionPrendas.ajustarStock(row.articulo_id, -row.cantidad);
    }

    return data;
  },

  async delete(id) {
    // Obtener la entrega antes de borrarla para saber qué prenda y cantidad restaurar
    const { data: entrega } = await sb
      .from('entregas')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await sb
      .from('entregas')
      .delete()
      .eq('id', id);

    if (sbErr(error, 'entregas.delete')) return false;

    // Restaurar stock en dotacion_prendas
    if (entrega && entrega.articulo_id) {
      await DotacionPrendas.ajustarStock(entrega.articulo_id, entrega.cantidad || 1);
    } else if (entrega && entrega.articulo_nombre && entrega.talla) {
      // Fallback si articulo_id era null por FK antigua
      const allPrendas = Cache.prendas || await DotacionPrendas.getAll();
      const match = allPrendas.find(p =>
        entrega.articulo_nombre.includes(p.referencia) && p.talla === entrega.talla
      );
      if (match) {
        await DotacionPrendas.ajustarStock(match.id, entrega.cantidad || 1);
      }
    }

    return true;
  },
};

/* ============================================================
   BPM
   ============================================================ */
const BPM = {
  async getAll() {
    const { data, error } = await sb
      .from('bpm')
      .select('*')
      .order('vencimiento');
    if (sbErr(error, 'bpm.getAll')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('bpm')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'bpm.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('bpm')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'bpm.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('bpm')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'bpm.delete');
  },
};

/* ============================================================
   VEHICULOS
   ============================================================ */
const Vehiculos = {
  async getAll() {
    const { data, error } = await sb
      .from('vehiculos')
      .select('*')
      .order('created_at', { ascending: false });
    if (sbErr(error, 'vehiculos.getAll')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('vehiculos')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'vehiculos.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('vehiculos')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'vehiculos.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('vehiculos')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'vehiculos.delete');
  },
};

/* ============================================================
   ALERTAS (computed from bpm + vehiculos + examenes + incapacidades)
   ============================================================ */
const Alertas = {
  async getAll() {
    const [bpmList, vehList, incapList, examList] = await Promise.all([
      BPM.getAll(),
      Vehiculos.getAll(),
      Incapacidades.getAll(),
      ExamenesMedicos.getAll(),
    ]);
    const alertas = [];
    const tipoLabel = { soat: 'SOAT', tecno: 'Tecnomecánica', licencia: 'Licencia' };

    bpmList.forEach(b => {
      const days = daysUntil(b.vencimiento);
      alertas.push({
        tipo: '📋 BPM',
        persona: b.trabajador_nombre,
        desc: `Carnet ${b.numero || 'BPM'}`,
        days,
        vencimiento: b.vencimiento,
      });
    });

    vehList.filter(v => v.tipo !== 'propiedad').forEach(v => {
      const days = daysUntil(v.vencimiento);
      const iconos = { soat: '🛡️', tecno: '🔧', licencia: '🪪' };
      const ident = v.tipo === 'licencia'
        ? v.conductor_nombre
        : `${v.placa || ''} - ${v.conductor_nombre || ''}`;
      alertas.push({
        tipo: `${iconos[v.tipo] || '📄'} ${tipoLabel[v.tipo] || v.tipo}`,
        persona: ident,
        desc: 'Doc. vehicular',
        days,
        vencimiento: v.vencimiento,
      });
    });

    // Incapacidades pendientes de gestión (sin físico o sin historia clínica)
    const STATUS_PENDIENTE = new Set(['ingresada', 'cobrada', 'en_tramite', 'radicada']);
    incapList
      .filter(i => STATUS_PENDIENTE.has(i.status) && (!i.tiene_fisico || !i.historia_clinica))
      .forEach(i => {
        const faltantes = [];
        if (!i.tiene_fisico)     faltantes.push('sin físico');
        if (!i.historia_clinica) faltantes.push('sin HC');
        alertas.push({
          tipo: '🏥 Incapacidad',
          persona: i.trabajador_nombre,
          desc: `${i.tipo || 'EG'} · ${faltantes.join(', ')} · Estado: ${i.status}`,
          days: 0,           // siempre aparece en sección "pendientes"
          vencimiento: i.fecha_inicio,
        });
      });

    // Exámenes médicos ocupacionales (por vencer o sin concepto físico)
    examList.forEach(e => {
      if (e.fecha_vencimiento) {
        const days = daysUntil(e.fecha_vencimiento);
        if (days !== null && days <= 30) {
          const tipoNom = {
            ingreso: 'Ingreso', periodico: 'Periódico', egreso: 'Egreso',
            post_incapacidad: 'Reintegro', reubicacion: 'Reubicación', otro: 'Médico'
          }[e.tipo_examen] || 'Médico';
          alertas.push({
            tipo: '🩺 Examen Médico',
            persona: e.trabajador_nombre,
            desc: `Examen ${tipoNom} · ${e.concepto.replace(/_/g, ' ')}`,
            days,
            vencimiento: e.fecha_vencimiento,
          });
        }
      }
      if (!e.tiene_concepto_fisico) {
        alertas.push({
          tipo: '🩺 Examen Médico',
          persona: e.trabajador_nombre,
          desc: `${e.tipo_examen} · Sin concepto físico recibido`,
          days: 0,
          vencimiento: e.fecha_examen,
        });
      }
    });

    return alertas.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  },
};

/* ============================================================
   SEED — carga inicial si las tablas están vacías
   ============================================================ */
async function checkAndSeed() {
  const { count, error } = await sb
    .from('trabajadores')
    .select('id', { count: 'exact', head: true });

  if (error) { sbErr(error, 'checkAndSeed'); return; }
  if (count > 0) return; // Ya hay datos

  showLoading(true);
  try {
    await seedTrabajadores();
    await seedDotacion();
  } finally {
    showLoading(false);
  }
}

async function seedTrabajadores() {
  function parseUnidad(unidad) {
    // Proveedores conocidos (segunda parte de la unidad)
    const PROVEEDORES_CONOCIDOS = new Set([
      'ZENU', 'Zenu', 'zenu',
      'FLEISCHMANN', 'Fleischmann', 'fleischmann',
    ]);
    const proveedorMap = {
      'ZENU': 'Zenú', 'Zenu': 'Zenú', 'zenu': 'Zenú',
      'FLEISCHMANN': 'Fleischmann', 'Fleischmann': 'Fleischmann', 'fleischmann': 'Fleischmann',
    };
    const cargoMap = {
      'ADMINISTRATIVO':             'Administrativo',
      'ASESORES COMERCIALES':       'Asesor Comercial',
      'Asesores comerciales':       'Asesor Comercial',
      'asesores comerciales':       'Asesor Comercial',
      'Asesores Comerciales':       'Asesor Comercial',
      'AUXILIAR LOGISTICO/ENTREGA': 'Auxiliar Logístico',
      'AUXILIAR LOGISTICO':         'Auxiliar Logístico',
      'AUXILIAR SEPARACION':        'Auxiliar de Separación',
      'AUXILIARES DE BODEGA':       'Auxiliar de Bodega',
      'AUXILIARES LOGISTICOS':      'Auxiliar Logístico',
      'auxiliares logisticos':      'Auxiliar Logístico',
    };

    const parts = unidad.trim().split('/').map(p => p.trim());
    const ciudad = parts[0] || '';
    let proveedor = '';
    let cargo = '';

    if (parts.length >= 3 && PROVEEDORES_CONOCIDOS.has(parts[1])) {
      // CIUDAD / PROVEEDOR / CARGO  — proveedor reconocido
      proveedor = parts[1];
      cargo     = parts.slice(2).join('/').trim();
    } else {
      // CIUDAD / CARGO  — todo lo que no es ciudad ni proveedor conocido es cargo
      proveedor = '';
      cargo     = parts.slice(1).join('/').trim();
    }

    const cargoCleaned     = cargoMap[cargo] || cargo
      .replace(/\b\w/g, c => c.toUpperCase()).replace(/De /g, 'de ');
    const proveedorCleaned = proveedorMap[proveedor] || 'General';
    const ciudadCleaned    = ciudad.charAt(0).toUpperCase() + ciudad.slice(1).toLowerCase();
    return { ciudad: ciudadCleaned, proveedor: proveedorCleaned, cargo: cargoCleaned };
  }

  const raw = [
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1002730727','JHON WILSON GIRALDO CARVAJAL','2025-08-14'],
    ['PEREIRA / ZENU / ADMINISTRATIVO','CC','1030140156','YERLY LICETH ARBOLEDA BOTERO','2025-07-28'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1005021309','ADRIANA CALLE ALVAREZ','2025-11-26'],
    ['PEREIRA / ADMINISTRATIVO','CC','1004682583','CRISTIAN FELIPE BALLESTEROS ARBOLEDA','2025-08-01'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1059696809','SANDRA MILENA GARCIA BERMUDEZ','2019-08-03'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1092914838','YONIER AUGUSTO MEJIA SALAZAR','2017-10-21'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1004965052','BIBIANA ESMILDA MONTOYA TABARQUINO','2016-06-21'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1053849016','YHONY ALEXANDER LOPEZ LOPEZ','2024-11-09'],
    ['ARMENIA / ASESORES COMERCIALES','CC','53102728','JEIMY ALEJANDRA TRUJILLO MALDONADO','2023-11-14'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1097401529','JOHAN SEBASTIAN BURITICA GONZALEZ','2022-07-26'],
    ['PEREIRA / ADMINISTRATIVO','CC','1004737633','KELLY TATIANA BETANCUR CASTAÑEDA','2026-05-01'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1002954362','BLADIMIR HOYOS','2018-05-29'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088037113','JUAN CAMILO ZAPATA ACEVEDO','2024-09-26'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1094883769','YOHANNA MARCELA OSORIO VILLADA','2021-07-01'],
    ['PEREIRA / ASESORES COMERCIALES','CC','9866688','GERMAN HURTADO TORRES','2023-10-11'],
    ['ARMENIA / ASESORES COMERCIALES','CC','66954110','OLGA PATRICIA MANCERA DIAZ','2019-12-13'],
    ['ARMENIA / ASESORES COMERCIALES','CC','18370852','JUAN JOSE GUZMAN HENAO','2021-03-13'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1117013879','CAMILA ALEJANDRA MATAJUDIOS MOSQUERA','2025-12-04'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1088294338','DIEGO ALEJANDRO GONZALEZ VALENCIA','2020-03-17'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','10138323','ROVINSON TORRES RIVERA','2016-08-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088352440','JUAN ESTEBAN GALLEGO DIEZ','2026-05-08'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1059698128','ELIANA MARCELA CALVO IGLESIAS','2019-02-23'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1054924071','NEIBER FABIAN CARDONA CARDONA','2025-06-06'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1007364349','NATHALIA DIAZ VELEZ','2023-10-14'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1099204769','MILTON GILMER OSORIO CALLE','2026-05-08'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','9910933','ARBEY DE JESUS LARGO LARGO','2016-06-01'],
    ['PEREIRA / ASESORES COMERCIALES','CC','18617007','ALEXANDER OROZCO RAMIREZ','2022-05-07'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1097394727','ERIKA TATIANA GONZALEZ AGUIRRE','2023-01-17'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1112790130','JHONIER ALEJANDRO QUINTERO MEDINA','2022-07-25'],
    ['MANIZALES / FLEISCHMANN / Asesores comerciales','CC','1087487317','JOHNATAN ZAPATA ARISMENDI','2025-03-06'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1007220971','MARIA ISABEL CARVAJAL RIOS','2026-05-19'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1093216057','ELIANA MARCELA SANCHEZ CASTAÑO','2025-12-12'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','10033035','CESAR AUGUSTO CASTILLO LONDOÑO','2025-12-05'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','8769712','MICHEL TORRES ACOSTA','2025-12-04'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','1112776419','JAMMES ALBERTO RAMIREZ NIETO','2025-12-04'],
    ['ARMENIA / ASESORES COMERCIALES','CC','41951273','SANDRA MILENA CUBILLOS HENAO','2022-08-16'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1094898957','JOHN ANDERSON GARZON ORDOÑEZ','2022-11-04'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1064310724','JUAN JOSE CONTRERAS HERNANDEZ','2026-05-19'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1060652216','CRISTIAN CAMILO OSPINA PARRA','2022-11-12'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1041610706','MANUEL FERNANDO NOREÑA BALLESTEROS','2026-05-19'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1112774849','ANYIE VIVIANA CARDONA DUQUE','2022-12-21'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1023378066','ANDRES MATEO VILLALBA DIAZ','2026-05-14'],
    ['PEREIRA / ASESORES COMERCIALES','CC','31437338','JESSICA AGUDELO ORTEGA','2025-05-28'],
    ['PEREIRA / ASESORES COMERCIALES','CC','66980511','YUDI MONDRAGON SEGURA','2023-01-25'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1053810420','YENNY MARCELA HENAO AGUDELO','2023-01-23'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1094896147','LOLA ANDREA GAVIRIA GONZALEZ','2023-02-20'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1093212000','ANGIE PAOLA HERNANDEZ BAÑOL','2023-03-07'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1058821245','VICTOR ALFONSO PULGARIN MEJIA','2023-03-28'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1088004142','THANY YANINA ACOSTA ARIAS','2023-04-06'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1053875645','SINDY PAOLA AMARIS DUARTE','2023-04-25'],
    ['PEREIRA / ADMINISTRATIVO','CC','1010131278','ANYI PAOLA MOSQUERA HURTADO','2023-06-01'],
    ['PEREIRA / ADMINISTRATIVO','CC','66970417','JULIANA CLEMENCIA GUTIERREZ GRANADA','2018-02-01'],
    ['PEREIRA / ADMINISTRATIVO','CC','16774226','MARCO AURELIO PARRA AVILA','2022-04-01'],
    ['PEREIRA / ADMINISTRATIVO','CC','10016570','ROBINSON HERMES CALDERON NIETO','2016-06-01'],
    ['PEREIRA / ADMINISTRATIVO','CC','1112774677','ERIKA LORENA VALENCIA RESTREPO','2017-09-01'],
    ['PEREIRA / ZENU / ADMINISTRATIVO','CC','1004756577','ESTEBAN LOAIZA OSSA','2025-06-05'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1112400353','KAREN JULIETH CARVAJAL RAMIREZ','2023-09-06'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1094940114','LIZETH TATIANA PELAEZ NIETO','2020-12-19'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1112227774','CHRISTIAN DAVID CAICEDO MONTAÑO','2021-09-02'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1112226698','JOSE ALEXANDER CONSTAIN PERLAZA','2021-01-19'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','18524020','EDWIN MAURICIO GOMEZ GALINDO','2018-09-03'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1054990990','ALEJANDRO LOPEZ VANEGAS','2016-06-01'],
    ['PEREIRA / ASESORES COMERCIALES','CC','24397385','NINI JOHANA FORONDA OSORIO','2016-06-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1053866136','ADRIAN FELIPE MARTINEZ ORTEGON','2023-08-10'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088038989','DIEGO ALEJANDRO HERNANDEZ HERNANDEZ','2025-12-25'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088253407','CARLOS ANDRES PINEDA CANO','2024-04-03'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088291925','JULIO ANDRES LONDOÑO CORREA','2025-12-25'],
    ['MANIZALES / ASESORES COMERCIALES','CC','30373892','BEATRIZ ELENA ALVAREZ LEON','2024-07-12'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1087559558','JUAN ALEJANDRO FRANCO MARIN','2024-01-16'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1112778308','LUIS CARLOS CADAVID RESTREPO','2024-04-03'],
    ['MANIZALES / ASESORES COMERCIALES','CC','1053786463','DIANA MILENA ARANGO ARIAS','2024-04-03'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1112783158','BRAYAN CAMILO ALZATE BUSTAMANTE','2026-05-19'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088247897','YHON SEBASTIAN OSORIO MORALES','2024-04-19'],
    ['PEREIRA / FLEISCHMANN / asesores comerciales','CC','9957009','JOSE MANUEL HOLGUIN CASTAÑO','2024-12-30'],
    ['PEREIRA / FLEISCHMANN / auxiliares logisticos','CC','1007232739','GERMAN DANIEL PATIÑO VELASQUEZ','2023-03-22'],
    ['ARMENIA / ASESORES COMERCIALES','CC','1097038327','DANIEL MONTES CASTRO','2024-11-26'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1089933391','BRAHIAN STIVEN VALENCIA IGLESIAS','2025-01-03'],
    ['ARMENIA / FLEISCHMANN / asesores comerciales','CC','1097394251','YEIMY VIVIANA GALVIS SALAZAR','2025-01-02'],
    ['ARMENIA / FLEISCHMANN / asesores comerciales','CC','41957502','CLARA INES TORO MARTINEZ','2025-01-17'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088249115','JOHN EDWAR ZAPATA ACEVEDO','2016-06-11'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','75034180','JOSE FERNEY BOTERO GIRALDO','2019-10-15'],
    ['ARMENIA / FLEISCHMANN / asesores comerciales','CC','1110502918','LINA MARCELA ARBOLEDA RIVERA','2025-01-02'],
    ['MANIZALES / ASESORES COMERCIALES','CC','30238299','VIVIANA VERA ESPINOSA','2024-05-02'],
    ['PEREIRA / FLEISCHMANN / asesores comerciales','CC','79643219','OMAR ALBERTO BERMUDEZ CAPERA','2025-01-02'],
    ['MANIZALES / ASESORES COMERCIALES','CC','24346532','LINA ZULAY GUZMAN VILLEGAS','2026-01-06'],
    ['ARMENIA / ASESORES COMERCIALES','CC','26163487','YERINA DEL CARMEN GUEVARA COGOLLO','2025-06-11'],
    ['PEREIRA / ASESORES COMERCIALES','CC','18617100','JULIAN ORLANDO GALVIS MARIN','2024-09-02'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1004671619','BRANDON STEVEN GIL BAEZ','2024-09-10'],
    ['PEREIRA / ADMINISTRATIVO','CC','24396430','BEATRIZ ELIANA GONZALEZ RINCON','2024-09-17'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1004778577','JUAN MANUEL DELGADO NARVAEZ','2024-09-23'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','1088037094','DANIEL FELIPE MURILLO GRANDA','2025-06-04'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1004717691','GENNY MARCELA GAVIRIA MORALES','2024-05-16'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1225089403','VALENTINA GUEVARA MONTOYA','2024-06-05'],
    ['PEREIRA / ADMINISTRATIVO','CC','42131453','DIANA PATRICIA GARCIA GUTIERREZ','2021-11-16'],
    ['PEREIRA / FLEISCHMANN / asesores comerciales','CC','1088347925','DEBANY ALBERTO MARIN PEREZ','2025-06-24'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1088348091','JEISON STIVEN LAVADO MARIN','2019-12-10'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','4514577','CARLOS AUGUSTO VELASQUEZ CORTES','2016-06-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1007783801','YEISON DAVID RENDON SOTO','2025-03-10'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088334475','SEBASTIAN VILLADA VELASQUEZ','2025-03-21'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1127384755','CAMILO ANDRES CONTRERAS RIVAS','2025-04-09'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','1089601941','FELIPE MONTES RIVERA','2025-07-03'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1088327362','YEISSON STIVEN GAÑAN NIETO','2025-05-27'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1004917529','WUILMAR ESTIBEN OSORIO MORALES','2026-01-10'],
    ['PEREIRA / ADMINISTRATIVO','CC','1089380738','JUAN JOSE COLORADO GUTIERREZ','2026-01-02'],
    ['PEREIRA / FLEISCHMANN / asesores comerciales','CC','1053785307','JULIANA ANDREA DUQUE GONZALEZ','2025-08-28'],
    ['PEREIRA / FLEISCHMANN / auxiliares logisticos','CC','1093220521','JUAN DIEGO FRANCO VERGARA','2026-01-16'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','18520635','JOHN QUEBIN LOTERO GARCIA','2025-09-17'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1088829645','NICOLAS LOTERO GUTIERREZ','2025-10-03'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1102873486','ROBERT DE JESUS OCHOA URIETA','2025-10-09'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','18616231','MAURICIO TORO ACOSTA','2025-10-09'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088308341','JUAN DAVID QUINTERO GRAJALES','2026-01-16'],
    ['ARMENIA / ASESORES COMERCIALES','CC','41961191','ANGELA JANETH GONZALEZ HERRERA','2025-10-14'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088326959','JEFFERSON DAVID RIVERA CORAL','2025-10-28'],
    ['PEREIRA / ADMINISTRATIVO','CC','1091272573','YISETH MANUELA PINEDA FLOREZ','2025-10-28'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1088008480','ANA MARIA ACERO OCAMPO','2025-11-04'],
    ['PEREIRA / ADMINISTRATIVO','CC','1087992814','CAMILA GONZALEZ MORALES','2026-01-22'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1088252454','ALBA YANETH SANCHEZ SOSSA','2026-01-27'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088344809','ANGIE YULIANA PATIÑO VALENCIA','2026-02-03'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1123141444','CRISTIAN FABIAN CAMACHO MARTINEZ','2026-02-10'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','9862197','GUSTAVO ADOLFO MORALES TIRADO','2026-02-11'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1013536164','JULIAN SANTIAGO VALDERRAMA ARIAS','2026-02-10'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1038926903','DIORLAN ANTONIO MESA FLOREZ','2026-02-10'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1088253404','CAMILO ANDRES GUAPACHA GARCIA','2026-06-04'],
    ['PEREIRA / ADMINISTRATIVO','CC','42117837','MARIA CRISTINA SANCHEZ GRANADA','2026-03-03'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','10005257','OSCAR MAURICIO GUARUMO CLAVIJO','2026-03-02'],
    ['PEREIRA / ADMINISTRATIVO','CC','1004736311','CARLOS ENRIQUE DIAZ ARENAS','2026-02-26'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1038768016','ANDRES FELIPE RIOS CAICEDO','2026-02-25'],
    ['PEREIRA / ASESORES COMERCIALES','CC','9696829','OSCAR DAVID ALZATE TOBON','2026-03-03'],
    ['PEREIRA / ADMINISTRATIVO','CC','1005048479','NATALY MOLINA BECERRA','2026-03-16'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1088238883','MARIA YESENIA GUTIERREZ GRANADA','2026-03-16'],
    ['PEREIRA / ADMINISTRATIVO','CC','1073522992','HEATHER STEFAN CASTRO MORALES','2026-03-25'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1004719311','JUAN MANUEL RESTREPO ORREGO','2026-06-10'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','42016714','LUZ ANDREA (GEMELA) ALVAREZ MONTOYA','2026-04-07'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1004669724','QUEBIN ANDRES LOTERO ZAPATA','2026-04-14'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1004737907','SANTIAGO HENAO MORALES','2026-04-17'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1112764385','JUAN GABRIEL OCAMPO MARIN','2026-04-17'],
    ['PEREIRA / ADMINISTRATIVO','CC','1004719230','NATALIA CHICA MARTINEZ','2026-04-16'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1093226863','LEIDY VANESSA RAMIREZ PEREZ','2026-04-29'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1007605268','ANDRES CAMILO MUÑOZ CAICEDO','2026-04-24'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1006128361','CAMILO LEANDRO GUECHE PEÑA','2026-04-24'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','10027683','GERMAN GALVEZ CORTES','2026-04-24'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','18517128','JHON FREDY MORENO','2026-06-11'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','9726421','ELKIN GARCIA OCAMPO','2026-06-17'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','1088030902','JEAN MICHAEL ZULUAGA MORANTE','2026-06-19'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1064723579','CARLOS ALBERTO JIMENEZ JACOME','2026-07-04'],
    ['ARMENIA / ASESORES COMERCIALES','CC','41941302','AIDA LUZ PINZON VALENCIA','2026-07-10'],
    ['PEREIRA / ADMINISTRATIVO','CC','1085718260','MARIA JOSE FRANCO RAMIREZ','2026-07-16'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1087493266','TANIA ALEJANDRA ISAZA ARICAPA','2026-07-16'],
    ['MANIZALES / ASESORES COMERCIALES','CC','24646047','JENNI CARDENAS CARDONA','2026-07-23'],
    ['PEREIRA / ADMINISTRATIVO','CC','1004736293','KARINA TABA GALLON','2026-08-01'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1112785365','ANGIE TATIANA BEDOYA CORREA','2026-08-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1089097145','MANUEL ALEJANDRO RAMIREZ OVALLE','2026-08-03'],
    ['PEREIRA / AUXILIAR SEPARACION','CC','1088017580','JOHN ANDRES CASTILLO GIRALDO','2026-08-03'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1007476838','SANTIAGO VELASQUEZ CAICEDO','2026-08-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1055831421','SAMUEL ANDRES ARIAS ARCILA','2026-08-03'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1004680120','VALENTINA GARCIA GOMEZ','2026-08-03'],
    ['PEREIRA / ZENU / AUXILIARES LOGISTICOS','CC','1004669887','CRISTIAN MAURICIO GIRALDO RAMIREZ','2026-08-03'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1076350176','DANIELA CASTIBLANCO RAMIREZ','2026-08-03'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1004669260','JUAN SEBASTIAN ARIAS MARULANDA','2026-08-03'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','1002576440','ALBERT DAVID AGUIRRE MESA','2025-07-11'],
    ['PEREIRA / AUXILIARES DE BODEGA','CC','18615944','WILSON DE JESUS ARIAS GIRALDO','2025-05-19'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','18519474','OSCAR MAURICIO RESTREPO MORENO','2025-05-19'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1112794463','CRISTIAN DAVID GRAJALES MARIN','2025-05-19'],
    ['PEREIRA / ASESORES COMERCIALES','CC','1088259774','LINA MARCELA CARDONA CORREA','2025-08-01'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1088331177','MICHAEL STEVEN HENAO RODRIGUEZ','2025-05-26'],
    ['PEREIRA / ZENU / ASESORES COMERCIALES','CC','1088334239','CRISTHIAN DAVID CASTAÑO CORREA','2025-06-03'],
    ['PEREIRA / AUXILIAR LOGISTICO/ENTREGA','CC','1002718622','JUAN CAMILO COCOMA OROZCO','2023-04-12'],
    ['PEREIRA / FLEISCHMANN / asesores comerciales','CC','43907591','MARIA YESENIA CAÑAS GARCIA','2025-08-01'],
  ];

  const rows = raw.map(([unidad, tipoId, cedula, nombre, fechaIngreso]) => {
    const { ciudad, proveedor, cargo } = parseUnidad(unidad);
    const nombreCap = nombre.split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return {
      nombre: nombreCap, cedula, tipo_id: tipoId, cargo,
      marca: proveedor, ciudad,
      unidad_organizacional: unidad.trim(),
      fecha_ingreso: fechaIngreso,
      estado: 'activo', jefe: '', telefono: '', obs: '',
    };
  });

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await sb.from('trabajadores').insert(rows.slice(i, i + 50));
    if (error) { sbErr(error, 'seed.trabajadores'); break; }
  }
  console.log(`[Seed] ${rows.length} trabajadores insertados`);
}

async function seedDotacion() {
  const items = [
    { nombre: 'Camiseta Corporativa',  categoria: 'ropa',     stock: 120, stock_min: 20, unidad: 'und',   emoji: '👕', descripcion: 'Camiseta corporativa con logo' },
    { nombre: 'Pantalón Industrial',   categoria: 'ropa',     stock: 85,  stock_min: 15, unidad: 'und',   emoji: '👖', descripcion: 'Pantalón beige reforzado' },
    { nombre: 'Botas de Seguridad',    categoria: 'calzado',  stock: 60,  stock_min: 10, unidad: 'pares', emoji: '🥾', descripcion: 'Puntera de acero' },
    { nombre: 'Casco de Seguridad',    categoria: 'epp',      stock: 8,   stock_min: 10, unidad: 'und',   emoji: '⛑️', descripcion: 'Casco clase A blanco' },
    { nombre: 'Guantes de Nitrilo',    categoria: 'epp',      stock: 200, stock_min: 40, unidad: 'pares', emoji: '🧤', descripcion: 'Tallas S, M, L, XL' },
    { nombre: 'Chaleco Reflectivo',    categoria: 'accesorio',stock: 45,  stock_min: 8,  unidad: 'und',   emoji: '🦺', descripcion: 'Chaleco naranja reflectivo' },
    { nombre: 'Cofia Desechable',      categoria: 'epp',      stock: 500, stock_min: 100,unidad: 'und',   emoji: '🩺', descripcion: 'Para área de alimentos' },
    { nombre: 'Tapabocas / Mascarilla',categoria: 'epp',      stock: 300, stock_min: 50, unidad: 'und',   emoji: '😷', descripcion: 'Mascarilla quirúrgica' },
    { nombre: 'Delantal',              categoria: 'ropa',     stock: 40,  stock_min: 8,  unidad: 'und',   emoji: '🧥', descripcion: 'Delantal de trabajo' },
    { nombre: 'Gafas de Seguridad',    categoria: 'epp',      stock: 25,  stock_min: 5,  unidad: 'und',   emoji: '🥽', descripcion: 'Gafas antiimpacto transparentes' },
  ];
  const { error } = await sb.from('dotacion').insert(items);
  if (error) sbErr(error, 'seed.dotacion');
  else console.log(`[Seed] ${items.length} ítems de dotación insertados`);
}

/* ============================================================
   UTILIDAD DE RESET — solo accesible con clave de administrador
   Para usar: desde la consola del navegador en la app principal,
   ejecutar: await ghproAdminReset('CLAVE_ADMIN')
   ============================================================ */
(function() {
  // Hash simple de la clave para no guardarla en texto plano
  // Clave actual: GHpro2024admin! — cambiar el hash si cambias la clave
  const ADMIN_HASH = '4059cefc'; // cyrb53('GHpro2024admin!')

  function hashClave(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return ((4294967296 * (2097151 & h2) + (h1 >>> 0)) >>> 0).toString(16);
  }

  window.ghproAdminReset = async function(clave) {
    if (!clave || hashClave(clave) !== ADMIN_HASH) {
      console.error('[GHPro] Clave incorrecta. Acceso denegado.');
      return;
    }
    if (!confirm('⚠️ Esto borrará TODOS los trabajadores y dotación y los recargará desde cero. ¿Continuar?')) return;
    showLoading(true);
    try {
      // Borrar en orden (FK constraints)
      await sb.from('entregas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('bpm').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('vehiculos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('dotacion').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await sb.from('trabajadores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('[Reset] Tablas vaciadas');
      await seedTrabajadores();
      await seedDotacion();
      // Invalidar cache y refrescar
      if (typeof Cache !== 'undefined') Cache.invalidate();
      if (typeof renderDashboard === 'function') await renderDashboard();
      toast('Base de datos recargada con datos correctos ✅', 'success', 5000);
    } catch(e) {
      console.error('[Reset] Error:', e);
      toast('Error al resetear: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  };
})();

/* ============================================================
   INCAPACIDADES — capa de datos
   ============================================================ */
const Incapacidades = {

  async getAll() {
    const { data, error } = await sb
      .from('incapacidades')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    if (sbErr(error, 'incapacidades.getAll')) return [];
    return data;
  },

  async getByTrabajador(trabajadorId) {
    const { data, error } = await sb
      .from('incapacidades')
      .select('*')
      .eq('trabajador_id', trabajadorId)
      .order('fecha_inicio', { ascending: false });
    if (sbErr(error, 'incapacidades.getByTrabajador')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('incapacidades')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'incapacidades.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('incapacidades')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'incapacidades.update')) return null;
    return data;
  },

  async updateStatus(id, status) {
    const { data, error } = await sb
      .from('incapacidades')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'incapacidades.updateStatus')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('incapacidades')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'incapacidades.delete');
  },

  // Resumen agrupado por trabajador (calculado en cliente desde cache)
  resumenPorTrabajador(lista) {
    const map = {};
    lista.forEach(i => {
      const k = i.trabajador_id;
      if (!map[k]) map[k] = {
        trabajador_id: k,
        trabajador_nombre: i.trabajador_nombre,
        total: 0, total_dias: 0,
        pagadas: 0, en_tramite: 0, radicadas: 0,
        sin_fisico: 0, sin_historia: 0,
        ultima_fecha: null,
      };
      const r = map[k];
      r.total++;
      r.total_dias += (i.dias || 0);
      if (i.status === 'pagada')     r.pagadas++;
      if (i.status === 'en_tramite') r.en_tramite++;
      if (i.status === 'radicada')   r.radicadas++;
      if (!i.tiene_fisico)           r.sin_fisico++;
      if (!i.historia_clinica)       r.sin_historia++;
      if (!r.ultima_fecha || i.fecha_inicio > r.ultima_fecha) r.ultima_fecha = i.fecha_inicio;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  },
};

/* ============================================================
   VACACIONES — capa de datos
   ============================================================ */
const Vacaciones = {

  async getAll() {
    const { data, error } = await sb
      .from('vacaciones')
      .select('*')
      .order('fecha_inicio', { ascending: false });
    if (sbErr(error, 'vacaciones.getAll')) return [];
    return data;
  },

  async getByTrabajador(trabajadorId) {
    const { data, error } = await sb
      .from('vacaciones')
      .select('*')
      .eq('trabajador_id', trabajadorId)
      .order('fecha_inicio', { ascending: false });
    if (sbErr(error, 'vacaciones.getByTrabajador')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('vacaciones')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'vacaciones.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('vacaciones')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'vacaciones.update')) return null;
    return data;
  },

  async updateStatus(id, status) {
    const { data, error } = await sb
      .from('vacaciones')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'vacaciones.updateStatus')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('vacaciones')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'vacaciones.delete');
  },

  // Resumen agrupado por trabajador (calculado en cliente)
  resumenPorTrabajador(lista, trabajadores = []) {
    const map = {};
    lista.forEach(v => {
      const k = v.trabajador_id;
      if (!map[k]) {
        // Calcular días disponibles según fecha de ingreso (ley colombiana: 15 días hábiles/año ≈ 18 días calendario)
        const t = trabajadores.find(w => w.id === k);
        let diasDisponibles = null;
        if (t?.fecha_ingreso) {
          const añosServicio = (new Date() - new Date(t.fecha_ingreso)) / (365.25 * 86400000);
          diasDisponibles = Math.floor(añosServicio * 18); // 18 días calendario por año
        }
        map[k] = {
          trabajador_id:     k,
          trabajador_nombre: v.trabajador_nombre,
          total_solicitudes: 0,
          dias_tomados:      0,
          dias_aprobados:    0,
          dias_disponibles:  diasDisponibles,
          pendientes:        0,
          ultima_fecha:      null,
        };
      }
      const r = map[k];
      r.total_solicitudes++;
      r.dias_tomados   += (v.dias || 0);
      if (v.status === 'aprobada')                    r.dias_aprobados += (v.dias || 0);
      if (v.status === 'en_proceso') r.pendientes++;
      if (!r.ultima_fecha || v.fecha_fin > r.ultima_fecha) r.ultima_fecha = v.fecha_fin;
    });
    return Object.values(map).sort((a, b) =>
      (a.trabajador_nombre || '').localeCompare(b.trabajador_nombre || '')
    );
  },
};

/* ============================================================
   ASISTENCIA — capa de datos
   ============================================================ */
const Asistencia = {

  async getAll() {
    const { data, error } = await sb
      .from('asistencia')
      .select('*')
      .order('created_at', { ascending: false });
    if (sbErr(error, 'asistencia.getAll')) return [];
    return data;
  },

  async getByFecha(fecha) {
    const { data, error } = await sb
      .from('asistencia')
      .select('*')
      .eq('fecha', fecha)
      .order('hora', { ascending: false });
    if (sbErr(error, 'asistencia.getByFecha')) return [];
    return data;
  },

  async getByCedula(cedula, fecha) {
    const { data, error } = await sb
      .from('asistencia')
      .select('*')
      .eq('cedula', cedula)
      .eq('fecha', fecha)
      .order('hora', { ascending: false });
    if (sbErr(error, 'asistencia.getByCedula')) return [];
    return data;
  },

  async insert(row) {
    const { data, error } = await sb
      .from('asistencia')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'asistencia.insert')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('asistencia')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'asistencia.delete');
  },

  async resumenHoy(fecha) {
    const registros = await this.getByFecha(fecha);
    const mapa = {};
    registros.forEach(r => {
      if (!mapa[r.cedula]) mapa[r.cedula] = { trabajador_nombre: r.trabajador_nombre, cedula: r.cedula, cargo: r.cargo, ciudad: r.ciudad, entradas: [], salidas: [] };
      if (r.tipo === 'entrada') mapa[r.cedula].entradas.push(r.hora);
      else                      mapa[r.cedula].salidas.push(r.hora);
    });
    return Object.values(mapa);
  },
};

/* ============================================================
   EXAMENES MEDICOS OCUPACIONALES — capa de datos
   ============================================================ */
const ExamenesMedicos = {

  async getAll() {
    const { data, error } = await sb
      .from('examenes_medicos')
      .select('*')
      .order('fecha_examen', { ascending: false });
    if (sbErr(error, 'examenes_medicos.getAll')) return [];
    return data || [];
  },

  async getByTrabajador(trabajadorId) {
    const { data, error } = await sb
      .from('examenes_medicos')
      .select('*')
      .eq('trabajador_id', trabajadorId)
      .order('fecha_examen', { ascending: false });
    if (sbErr(error, 'examenes_medicos.getByTrabajador')) return [];
    return data || [];
  },

  async insert(row) {
    const { data, error } = await sb
      .from('examenes_medicos')
      .insert([row])
      .select()
      .single();
    if (sbErr(error, 'examenes_medicos.insert')) return null;
    return data;
  },

  async update(id, row) {
    const { data, error } = await sb
      .from('examenes_medicos')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (sbErr(error, 'examenes_medicos.update')) return null;
    return data;
  },

  async delete(id) {
    const { error } = await sb
      .from('examenes_medicos')
      .delete()
      .eq('id', id);
    return !sbErr(error, 'examenes_medicos.delete');
  },

  // Resumen agrupado por trabajador (calculado en cliente)
  resumenPorTrabajador(lista) {
    const map = {};
    lista.forEach(e => {
      const k = e.trabajador_id;
      if (!map[k]) {
        map[k] = {
          trabajador_id:     k,
          trabajador_nombre: e.trabajador_nombre,
          total_examenes:    0,
          aptos:             0,
          con_restricciones: 0,
          no_aptos:          0,
          aplazados:         0,
          sin_fisico:        0,
          ultimo_examen:     null,
          proximo_venc:      null,
          ultimo_concepto:   null,
        };
      }
      const r = map[k];
      r.total_examenes++;
      if (e.concepto === 'apto')                  r.aptos++;
      if (e.concepto === 'apto_con_restricciones') r.con_restricciones++;
      if (e.concepto === 'no_apto')               r.no_aptos++;
      if (e.concepto === 'aplazado')              r.aplazados++;
      if (!e.tiene_concepto_fisico)               r.sin_fisico++;

      if (!r.ultimo_examen || e.fecha_examen > r.ultimo_examen) {
        r.ultimo_examen   = e.fecha_examen;
        r.ultimo_concepto = e.concepto;
      }
      if (e.fecha_vencimiento && (!r.proximo_venc || e.fecha_vencimiento > r.proximo_venc)) {
        r.proximo_venc = e.fecha_vencimiento;
      }
    });

    return Object.values(map).sort((a, b) =>
      (a.trabajador_nombre || '').localeCompare(b.trabajador_nombre || '')
    );
  },
};


/* ============================================================
   DOTACION PRENDAS — capa de datos
   Tabla: dotacion_prendas
   Tipos: camisa · pantalon · chaqueta · calzado
   ============================================================ */
const DotacionPrendas = {

  /* ── Metadatos: tallas y referencias por tipo ── */
  TALLAS: {
    camisa:   { hombre: ['S','M','L','XL','XXL'], mujer: ['S','M','L','XL','XXL'] },
    chaqueta: { hombre: ['S','M','L','XL','XXL'], mujer: ['S','M','L','XL','XXL'] },
    pantalon: {
      hombre: ['28','30','32','34','36','38'],
      mujer:  ['6','8','10','12','14','16','18'],
    },
    calzado: {
      hombre: ['35','36','37','38','39','40','41','42','43','44','45'],
      mujer:  ['34','35','36','37','38','39','40','41','42','43','44','45'],
    },
    epp: {
      bodega:      ['M','L'],
      cuarto_frio: ['M','L'],
    },
  },

  REFERENCIAS: {
    camisa: [
      'Oxford ROSADA (Alpina + Tiendas y Marcas)',
      'Oxford AZUL (Flesichmann + Tiendas y Marcas)',
      'Oxford GRIS (ZENÚ + Tiendas y Marcas)',
      'Polo GRIS (Tiendas y Marcas)',
    ],
    pantalon: ['Jean Indigo Azul', 'Pantalon Térmico', 'Jean Elástico'],
    chaqueta: ['Chaqueta Cuarto Frío'],
    calzado:  ['Bota de Seguridad con Puntera'],
    epp:      ['Casco', 'Barbuquejo', 'Guantes'],
  },

  TIPO_LABEL: {
    camisa:   { label: 'Camisas',   icon: '👕' },
    pantalon: { label: 'Pantalones', icon: '👖' },
    chaqueta: { label: 'Chaquetas', icon: '🧥' },
    calzado:  { label: 'Calzado',   icon: '🥾' },
    epp:      { label: 'EPP',       icon: '⛑️' },
  },

  /* ── CRUD ── */
  async getAll() {
    const { data, error } = await sb
      .from('dotacion_prendas')
      .select('*')
      .order('tipo').order('referencia').order('genero').order('talla');
    if (sbErr(error, 'dotacion_prendas.getAll')) return [];
    return data || [];
  },

  async updateStock(id, nuevoStock) {
    const { data, error } = await sb
      .from('dotacion_prendas')
      .update({ stock: Math.max(0, nuevoStock) })
      .eq('id', id)
      .select().single();
    if (sbErr(error, 'dotacion_prendas.updateStock')) return null;
    return data;
  },

  async ajustarStock(id, delta) {
    const { data: cur, error: re } = await sb
      .from('dotacion_prendas').select('stock').eq('id', id).single();
    if (sbErr(re, 'dotacion_prendas.ajustarStock')) return null;
    return await this.updateStock(id, (cur.stock || 0) + delta);
  },

  async updateObs(id, obs) {
    const { data, error } = await sb
      .from('dotacion_prendas')
      .update({ obs })
      .eq('id', id)
      .select().single();
    if (sbErr(error, 'dotacion_prendas.updateObs')) return null;
    return data;
  },

  /* ── Helpers de agrupación (cliente) ── */

  // { referencia → { <genero|area>: { talla: row } } }
  agrupar(lista) {
    const map = {};
    lista.forEach(row => {
      if (!map[row.referencia]) map[row.referencia] = {};
      if (!map[row.referencia][row.genero]) map[row.referencia][row.genero] = {};
      map[row.referencia][row.genero][row.talla] = row;
    });
    return map;
  },

  stockBajo(lista) {
    return lista.filter(r => r.stock <= r.stock_min);
  },

  totalPorReferencia(lista) {
    const map = {};
    lista.forEach(r => { map[r.referencia] = (map[r.referencia] || 0) + r.stock; });
    return map;
  },
};
