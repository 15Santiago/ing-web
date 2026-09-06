// =========================================================
// Gestión de docentes: alta (contratación), baja (despido) y
// consulta de su carga académica y horario semanal.
//
// Reglas de negocio clave que pide el proyecto:
//   - Despedir a uno o varios docentes deja sus bloques de
//     horario "vacantes" (docente_id = NULL) y responde con el
//     detalle de los cursos/bloques afectados.
//   - Contratar crea el docente; para cargarle horario se usa
//     PUT /api/horarios/:id/asignar (o el bulk de aquí abajo)
//     sobre bloques vacantes, validando choques y horas máximas.
// =========================================================
const { pool } = require('../config/db');

const DIAS_ORDEN = "FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes')";

// ---------------------------------------------------------
// GET /api/docentes?activo=true&areaId=
// Incluye horas_asignadas calculadas a partir de sus bloques
// de horario vigentes (cada bloque dura 45 min = 0.75 h).
// ---------------------------------------------------------
async function consultarTodos(req, res) {
  try {
    const { activo, areaId } = req.query;
    const condiciones = [];
    const parametros = [];
    if (activo !== undefined) { condiciones.push('d.activo = ?'); parametros.push(activo === 'true' ? 1 : 0); }
    if (areaId) { condiciones.push('d.area_id = ?'); parametros.push(areaId); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [docentes] = await pool.query(
      `SELECT d.id, d.nombre, d.area_id, a.codigo AS area_codigo, a.nombre AS area_nombre,
              d.horas_contratadas, d.activo, d.fecha_baja,
              COALESCE(SUM(TIMESTAMPDIFF(MINUTE, h.hora_inicio, h.hora_fin)) / 60, 0) AS horas_asignadas,
              COUNT(h.id) AS bloques_asignados
       FROM docentes d
       LEFT JOIN areas a ON a.id = d.area_id
       LEFT JOIN horarios h ON h.docente_id = d.id
       ${where}
       GROUP BY d.id, d.nombre, d.area_id, a.codigo, a.nombre, d.horas_contratadas, d.activo, d.fecha_baja
       ORDER BY d.activo DESC, d.nombre`,
      parametros
    );
    return res.status(200).json(docentes);
  } catch (error) {
    console.error('Error en consultarTodos() [docentes]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los docentes.' });
  }
}

// ---------------------------------------------------------
// GET /api/docentes/:id
// Detalle de un docente: datos, horas y su horario semanal
// completo (día, hora, curso, materia y estudiantes del curso).
// ---------------------------------------------------------
async function consultarPorId(req, res) {
  try {
    const { id } = req.params;
    const [docentes] = await pool.query(
      `SELECT d.id, d.nombre, d.area_id, a.codigo AS area_codigo, a.nombre AS area_nombre,
              d.horas_contratadas, d.activo, d.fecha_baja
       FROM docentes d LEFT JOIN areas a ON a.id = d.area_id
       WHERE d.id = ?`,
      [id]
    );
    if (docentes.length === 0) {
      return res.status(404).json({ mensaje: 'Docente no encontrado.' });
    }

    const [horario] = await pool.query(
      `SELECT h.id, h.dia, h.hora_inicio, h.hora_fin, m.nombre AS materia,
              c.id AS curso_id, c.grado, c.seccion, c.jornada, c.estudiantes
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id
       JOIN cursos c ON c.id = h.curso_id
       WHERE h.docente_id = ?
       ORDER BY ${DIAS_ORDEN}, h.hora_inicio`,
      [id]
    );
    const horasAsignadas = horario.reduce((total, bloque) => total + minutosBloque(bloque) / 60, 0);

    return res.status(200).json({ ...docentes[0], horasAsignadas, horario });
  } catch (error) {
    console.error('Error en consultarPorId() [docentes]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar el docente.' });
  }
}

function minutosBloque(bloque) {
  const [hi, mi] = bloque.hora_inicio.split(':').map(Number);
  const [hf, mf] = bloque.hora_fin.split(':').map(Number);
  return (hf * 60 + mf) - (hi * 60 + mi);
}

// ---------------------------------------------------------
// POST /api/docentes  (contratar)
// Si no se manda "id", se genera uno correlativo dentro del
// área (ej. area MAT-FIS -> siguiente MAT-FIS-07).
// ---------------------------------------------------------
async function crear(req, res) {
  try {
    const { id, nombre, areaId, horasContratadas } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'El nombre del docente es obligatorio.' });
    }

    let idDocente = id;
    if (!idDocente) {
      idDocente = await generarIdDocente(areaId);
    }

    await pool.query(
      'INSERT INTO docentes (id, nombre, area_id, horas_contratadas, activo) VALUES (?, ?, ?, ?, TRUE)',
      [idDocente, nombre.trim(), areaId || null, horasContratadas || 34.5]
    );
    const [creado] = await pool.query(
      `SELECT d.*, a.codigo AS area_codigo, a.nombre AS area_nombre
       FROM docentes d LEFT JOIN areas a ON a.id = d.area_id WHERE d.id = ?`,
      [idDocente]
    );
    return res.status(201).json({ ...creado[0], horasAsignadas: 0 });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un docente con ese identificador.' });
    }
    console.error('Error en crear() [docentes]:', error);
    return res.status(500).json({ mensaje: 'Error interno al contratar el docente.' });
  }
}

async function generarIdDocente(areaId) {
  let prefijo = 'DOC';
  if (areaId) {
    const [areas] = await pool.query('SELECT codigo FROM areas WHERE id = ?', [areaId]);
    if (areas.length > 0) prefijo = areas[0].codigo;
  }
  const [existentes] = await pool.query('SELECT id FROM docentes WHERE id LIKE ?', [`${prefijo}-%`]);
  let maximo = 0;
  existentes.forEach((fila) => {
    const numero = Number(fila.id.slice(prefijo.length + 1));
    if (Number.isFinite(numero) && numero > maximo) maximo = numero;
  });
  const siguiente = String(maximo + 1).padStart(2, '0');
  return `${prefijo}-${siguiente}`;
}

// ---------------------------------------------------------
// PUT /api/docentes/:id
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, areaId, horasContratadas } = req.body;
    const [resultado] = await pool.query(
      'UPDATE docentes SET nombre = ?, area_id = ?, horas_contratadas = ? WHERE id = ?',
      [nombre, areaId || null, horasContratadas, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Docente no encontrado.' });
    }
    const [actualizado] = await pool.query('SELECT * FROM docentes WHERE id = ?', [id]);
    return res.status(200).json(actualizado[0]);
  } catch (error) {
    console.error('Error en actualizar() [docentes]:', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar el docente.' });
  }
}

// ---------------------------------------------------------
// POST /api/docentes/despedir  { ids: ["MAT-FIS-01", ...] }
// Marca los docentes como inactivos, vacía sus bloques de
// horario (quedan sin docente, listos para reasignar) y
// responde con el impacto: cursos y bloques afectados.
// ---------------------------------------------------------
async function despedir(req, res) {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ mensaje: 'Debes indicar al menos un id de docente en "ids".' });
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [docentes] = await conexion.query(
      `SELECT id, nombre FROM docentes WHERE id IN (?) AND activo = TRUE FOR UPDATE`,
      [ids]
    );
    if (docentes.length === 0) {
      await conexion.rollback();
      return res.status(404).json({ mensaje: 'Ninguno de los docentes indicados existe o ya estaba inactivo.' });
    }
    const idsValidos = docentes.map((d) => d.id);

    const [bloques] = await conexion.query(
      `SELECT h.id AS horario_id, h.docente_id, h.dia, h.hora_inicio, h.hora_fin,
              c.id AS curso_id, c.grado, c.seccion, c.jornada, c.estudiantes,
              m.nombre AS materia
       FROM horarios h
       JOIN cursos c ON c.id = h.curso_id
       JOIN materias m ON m.id = h.materia_id
       WHERE h.docente_id IN (?)
       ORDER BY c.grado, c.seccion, ${DIAS_ORDEN}, h.hora_inicio`,
      [idsValidos]
    );

    await conexion.query('UPDATE docentes SET activo = FALSE, fecha_baja = NOW() WHERE id IN (?)', [idsValidos]);
    await conexion.query('UPDATE horarios SET docente_id = NULL WHERE docente_id IN (?)', [idsValidos]);

    await conexion.commit();

    const cursosAfectadosMapa = new Map();
    bloques.forEach((bloque) => {
      const clave = bloque.curso_id;
      if (!cursosAfectadosMapa.has(clave)) {
        cursosAfectadosMapa.set(clave, {
          cursoId: bloque.curso_id,
          curso: `${bloque.grado}°${bloque.seccion}`,
          jornada: bloque.jornada,
          estudiantes: bloque.estudiantes,
          bloquesVacantes: [],
        });
      }
      cursosAfectadosMapa.get(clave).bloquesVacantes.push({
        horarioId: bloque.horario_id,
        docenteAnterior: bloque.docente_id,
        dia: bloque.dia,
        horaInicio: bloque.hora_inicio,
        horaFin: bloque.hora_fin,
        materia: bloque.materia,
      });
    });

    return res.status(200).json({
      docentesDespedidos: docentes,
      totalBloquesAfectados: bloques.length,
      cursosAfectados: Array.from(cursosAfectadosMapa.values()),
    });
  } catch (error) {
    await conexion.rollback();
    console.error('Error en despedir():', error);
    return res.status(500).json({ mensaje: 'Error interno al procesar el despido.' });
  } finally {
    conexion.release();
  }
}

// ---------------------------------------------------------
// DELETE /api/docentes/:id  (alias de despedir, para un solo docente)
// ---------------------------------------------------------
async function eliminar(req, res) {
  req.body = { ids: [req.params.id] };
  return despedir(req, res);
}

// ---------------------------------------------------------
// POST /api/docentes/:id/asignar-vacantes { horarioIds: [...] }
// Asigna en bloque varios horarios vacantes (o de otro docente)
// a este docente, validando choques de horario y el máximo de
// horas contratadas. Responde detalle de éxitos y rechazos.
// ---------------------------------------------------------
async function asignarVacantes(req, res) {
  const { id } = req.params;
  const { horarioIds } = req.body || {};
  if (!Array.isArray(horarioIds) || horarioIds.length === 0) {
    return res.status(400).json({ mensaje: 'Debes indicar al menos un id de horario en "horarioIds".' });
  }

  try {
    const [docentes] = await pool.query('SELECT * FROM docentes WHERE id = ?', [id]);
    if (docentes.length === 0) {
      return res.status(404).json({ mensaje: 'Docente no encontrado.' });
    }
    const docente = docentes[0];
    if (!docente.activo) {
      return res.status(422).json({ mensaje: 'No se puede asignar horario a un docente inactivo.' });
    }

    const [actuales] = await pool.query(
      `SELECT dia, hora_inicio, hora_fin FROM horarios WHERE docente_id = ?`,
      [id]
    );
    let horasOcupadas = actuales.reduce((total, b) => total + minutosBloque(b) / 60, 0);
    const ocupacionPorDiaHora = new Set(actuales.map((b) => `${b.dia}-${b.hora_inicio}`));

    const resultados = [];
    for (const horarioId of horarioIds) {
      // eslint-disable-next-line no-await-in-loop
      const [filas] = await pool.query('SELECT * FROM horarios WHERE id = ?', [horarioId]);
      if (filas.length === 0) {
        resultados.push({ horarioId, asignado: false, motivo: 'El bloque de horario no existe.' });
        continue;
      }
      const bloque = filas[0];
      const clave = `${bloque.dia}-${bloque.hora_inicio}`;
      if (ocupacionPorDiaHora.has(clave)) {
        resultados.push({ horarioId, asignado: false, motivo: 'El docente ya tiene otra clase ese día y hora.' });
        continue;
      }
      const duracionHoras = minutosBloque(bloque) / 60;
      if (horasOcupadas + duracionHoras > Number(docente.horas_contratadas)) {
        resultados.push({ horarioId, asignado: false, motivo: 'Se superaría el máximo de horas contratadas del docente.' });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await pool.query('UPDATE horarios SET docente_id = ? WHERE id = ?', [id, horarioId]);
      ocupacionPorDiaHora.add(clave);
      horasOcupadas += duracionHoras;
      resultados.push({ horarioId, asignado: true });
    }

    return res.status(200).json({ docenteId: id, horasAsignadasTotales: horasOcupadas, resultados });
  } catch (error) {
    console.error('Error en asignarVacantes():', error);
    return res.status(500).json({ mensaje: 'Error interno al asignar las vacantes.' });
  }
}

module.exports = {
  consultarTodos,
  consultarPorId,
  crear,
  actualizar,
  despedir,
  eliminar,
  asignarVacantes,
};
