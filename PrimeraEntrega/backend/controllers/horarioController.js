// =========================================================
// Gestión de horarios: bloques de curso + asignatura + docente
// + día + hora. Permite consultar la programación por curso,
// docente, materia o jornada, y expone la asignación/reasignación
// de un docente a un bloque (vacante o no) validando choques.
//
// El choque de horario ("un docente o curso asignado
// simultáneamente") ya está impedido a nivel de base de datos
// con las llaves UNIQUE (curso_id, dia, hora_inicio) y
// (docente_id, dia, hora_inicio); aquí se traduce ese error en
// una respuesta 409 clara, y se ofrece /conflictos como
// verificación explícita para el dashboard.
// =========================================================
const { pool } = require('../config/db');

const DIAS_ORDEN = "FIELD(dia, 'Lunes','Martes','Miercoles','Jueves','Viernes')";

// ---------------------------------------------------------
// GET /api/horarios?cursoId=&docenteId=&materiaId=&jornada=&dia=&vacantes=true
// ---------------------------------------------------------
async function consultarTodos(req, res) {
  try {
    const { cursoId, docenteId, materiaId, jornada, dia, vacantes } = req.query;
    const condiciones = [];
    const parametros = [];
    if (cursoId) { condiciones.push('h.curso_id = ?'); parametros.push(cursoId); }
    if (docenteId) { condiciones.push('h.docente_id = ?'); parametros.push(docenteId); }
    if (materiaId) { condiciones.push('h.materia_id = ?'); parametros.push(materiaId); }
    if (jornada) { condiciones.push('c.jornada = ?'); parametros.push(jornada); }
    if (dia) { condiciones.push('h.dia = ?'); parametros.push(dia); }
    if (vacantes === 'true') {
      // Solo interesan como "vacantes por cubrir" los bloques de
      // cursos activos: una sección cerrada no necesita docente.
      condiciones.push('h.docente_id IS NULL', 'c.activo = TRUE');
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [filas] = await pool.query(
      `SELECT h.id, h.dia, h.hora_inicio, h.hora_fin, h.docente_id, d.nombre AS docente_nombre,
              h.materia_id, m.nombre AS materia, h.curso_id, c.grado, c.seccion, c.jornada, c.estudiantes, c.activo AS curso_activo
       FROM horarios h
       JOIN cursos c ON c.id = h.curso_id
       JOIN materias m ON m.id = h.materia_id
       LEFT JOIN docentes d ON d.id = h.docente_id
       ${where}
       ORDER BY c.grado, c.seccion, ${DIAS_ORDEN}, h.hora_inicio`,
      parametros
    );
    return res.status(200).json(filas);
  } catch (error) {
    console.error('Error en consultarTodos() [horarios]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los horarios.' });
  }
}

// ---------------------------------------------------------
// GET /api/horarios/conflictos
// Verificación explícita: un docente o un curso con dos
// bloques al mismo día y hora. Con las llaves UNIQUE de la
// tabla esto siempre debería devolver listas vacías; se deja
// como endpoint del dashboard y como red de seguridad ante
// datos cargados por fuera de la API (ej. un seed manual).
// ---------------------------------------------------------
async function consultarConflictos(req, res) {
  try {
    const [conflictosDocente] = await pool.query(
      `SELECT docente_id, dia, hora_inicio, COUNT(*) AS choques, GROUP_CONCAT(id) AS horario_ids
       FROM horarios
       WHERE docente_id IS NOT NULL
       GROUP BY docente_id, dia, hora_inicio
       HAVING COUNT(*) > 1`
    );
    const [conflictosCurso] = await pool.query(
      `SELECT curso_id, dia, hora_inicio, COUNT(*) AS choques, GROUP_CONCAT(id) AS horario_ids
       FROM horarios
       GROUP BY curso_id, dia, hora_inicio
       HAVING COUNT(*) > 1`
    );
    return res.status(200).json({ conflictosDocente, conflictosCurso, total: conflictosDocente.length + conflictosCurso.length });
  } catch (error) {
    console.error('Error en consultarConflictos():', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar conflictos.' });
  }
}

// ---------------------------------------------------------
// POST /api/horarios  (crear un bloque nuevo)
// ---------------------------------------------------------
async function crear(req, res) {
  try {
    const { cursoId, materiaId, docenteId, dia, horaInicio, horaFin } = req.body;
    if (!cursoId || !materiaId || !dia || !horaInicio || !horaFin) {
      return res.status(400).json({ mensaje: 'cursoId, materiaId, dia, horaInicio y horaFin son obligatorios.' });
    }
    const [resultado] = await pool.query(
      'INSERT INTO horarios (curso_id, materia_id, docente_id, dia, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?, ?)',
      [cursoId, materiaId, docenteId || null, dia, horaInicio, horaFin]
    );
    return res.status(201).json({ id: resultado.insertId, cursoId, materiaId, docenteId: docenteId || null, dia, horaInicio, horaFin });
  } catch (error) {
    return manejarErrorHorario(error, res);
  }
}

// ---------------------------------------------------------
// PUT /api/horarios/:id  (editar materia, día, hora o docente)
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { cursoId, materiaId, docenteId, dia, horaInicio, horaFin } = req.body;
    const [resultado] = await pool.query(
      'UPDATE horarios SET curso_id = ?, materia_id = ?, docente_id = ?, dia = ?, hora_inicio = ?, hora_fin = ? WHERE id = ?',
      [cursoId, materiaId, docenteId || null, dia, horaInicio, horaFin, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Bloque de horario no encontrado.' });
    }
    return res.status(200).json({ id: Number(id), cursoId, materiaId, docenteId: docenteId || null, dia, horaInicio, horaFin });
  } catch (error) {
    return manejarErrorHorario(error, res);
  }
}

// ---------------------------------------------------------
// PUT /api/horarios/:id/asignar  { docenteId }
// Asigna o reasigna el docente de UN bloque puntual (vacante o
// no), validando que no choque con otra clase suya y que no
// supere sus horas contratadas.
// ---------------------------------------------------------
async function asignarDocente(req, res) {
  try {
    const { id } = req.params;
    const { docenteId } = req.body;

    const [bloques] = await pool.query('SELECT * FROM horarios WHERE id = ?', [id]);
    if (bloques.length === 0) {
      return res.status(404).json({ mensaje: 'Bloque de horario no encontrado.' });
    }
    const bloque = bloques[0];

    if (!docenteId) {
      await pool.query('UPDATE horarios SET docente_id = NULL WHERE id = ?', [id]);
      return res.status(200).json({ id: Number(id), docenteId: null, mensaje: 'Bloque dejado vacante.' });
    }

    const [docentes] = await pool.query('SELECT * FROM docentes WHERE id = ?', [docenteId]);
    if (docentes.length === 0) {
      return res.status(404).json({ mensaje: 'Docente no encontrado.' });
    }
    const docente = docentes[0];
    if (!docente.activo) {
      return res.status(422).json({ mensaje: 'No se puede asignar horario a un docente inactivo.' });
    }

    const [ocupados] = await pool.query(
      'SELECT * FROM horarios WHERE docente_id = ? AND id != ?',
      [docenteId, id]
    );
    const chocaEnHorario = ocupados.some((otro) => otro.dia === bloque.dia && otro.hora_inicio === bloque.hora_inicio);
    if (chocaEnHorario) {
      return res.status(409).json({ mensaje: 'El docente ya tiene otra clase asignada ese día y hora.' });
    }

    const minutos = (b) => {
      const [hi, mi] = b.hora_inicio.split(':').map(Number);
      const [hf, mf] = b.hora_fin.split(':').map(Number);
      return (hf * 60 + mf) - (hi * 60 + mi);
    };
    const horasOcupadas = ocupados.reduce((total, b) => total + minutos(b) / 60, 0);
    const horasNuevoBloque = minutos(bloque) / 60;
    if (horasOcupadas + horasNuevoBloque > Number(docente.horas_contratadas)) {
      return res.status(422).json({ mensaje: 'Se superaría el máximo de horas contratadas del docente.' });
    }

    let advertencia = null;
    if (docente.area_id) {
      const [materias] = await pool.query('SELECT area_id FROM materias WHERE id = ?', [bloque.materia_id]);
      if (materias.length > 0 && materias[0].area_id && materias[0].area_id !== docente.area_id) {
        advertencia = 'La materia del bloque no corresponde a la especialidad principal del docente.';
      }
    }

    await pool.query('UPDATE horarios SET docente_id = ? WHERE id = ?', [docenteId, id]);
    return res.status(200).json({ id: Number(id), docenteId, advertencia });
  } catch (error) {
    return manejarErrorHorario(error, res);
  }
}

// ---------------------------------------------------------
// DELETE /api/horarios/:id
// ---------------------------------------------------------
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM horarios WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Bloque de horario no encontrado.' });
    }
    return res.status(200).json({ mensaje: 'Bloque de horario eliminado correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminar() [horarios]:', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar el bloque de horario.' });
  }
}

function manejarErrorHorario(error, res) {
  if (error.code === 'ER_DUP_ENTRY') {
    const chocaDocente = error.sqlMessage && error.sqlMessage.includes('uq_horario_docente');
    return res.status(409).json({
      mensaje: chocaDocente
        ? 'El docente ya tiene otra clase asignada ese día y hora.'
        : 'El curso ya tiene otra clase asignada ese día y hora.',
    });
  }
  console.error('Error en horarioController:', error);
  return res.status(500).json({ mensaje: 'Error interno al procesar el horario.' });
}

module.exports = {
  consultarTodos,
  consultarConflictos,
  crear,
  actualizar,
  asignarDocente,
  eliminar,
};
