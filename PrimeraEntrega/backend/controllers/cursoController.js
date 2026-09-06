// =========================================================
// Gestión de cursos: grado, sección, jornada y número de
// estudiantes. Incluye la "aleatorización" del número de
// estudiantes matriculados (variable aleatoria, acotada por
// el cupo máximo del curso) y la consulta del horario de un
// curso puntual.
// =========================================================
const { pool } = require('../config/db');

function estudiantesAleatorios(cupoMaximo) {
  const minimo = Math.max(1, Math.round(cupoMaximo * 0.75));
  return Math.floor(Math.random() * (cupoMaximo - minimo + 1)) + minimo;
}

// ---------------------------------------------------------
// GET /api/cursos?jornada=&grado=
// ---------------------------------------------------------
async function consultarTodos(req, res) {
  try {
    const { jornada, grado } = req.query;
    const condiciones = [];
    const parametros = [];
    if (jornada) { condiciones.push('jornada = ?'); parametros.push(jornada); }
    if (grado) { condiciones.push('grado = ?'); parametros.push(grado); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [cursos] = await pool.query(
      `SELECT id, grado, seccion, jornada, cupo_maximo, estudiantes
       FROM cursos ${where}
       ORDER BY grado, seccion`,
      parametros
    );
    return res.status(200).json(cursos);
  } catch (error) {
    console.error('Error en consultarTodos() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los cursos.' });
  }
}

// ---------------------------------------------------------
// GET /api/cursos/:id  (incluye su horario semanal completo)
// ---------------------------------------------------------
async function consultarPorId(req, res) {
  try {
    const { id } = req.params;
    const [cursos] = await pool.query('SELECT * FROM cursos WHERE id = ?', [id]);
    if (cursos.length === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    const [horario] = await pool.query(
      `SELECT h.id, h.dia, h.hora_inicio, h.hora_fin, m.nombre AS materia,
              h.docente_id, d.nombre AS docente_nombre
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id
       LEFT JOIN docentes d ON d.id = h.docente_id
       WHERE h.curso_id = ?
       ORDER BY FIELD(h.dia, 'Lunes','Martes','Miercoles','Jueves','Viernes'), h.hora_inicio`,
      [id]
    );
    return res.status(200).json({ ...cursos[0], horario });
  } catch (error) {
    console.error('Error en consultarPorId() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar el curso.' });
  }
}

// ---------------------------------------------------------
// POST /api/cursos
// ---------------------------------------------------------
async function crear(req, res) {
  try {
    const { grado, seccion, jornada, cupoMaximo, estudiantes } = req.body;
    if (!grado || !seccion || !jornada || !cupoMaximo) {
      return res.status(400).json({ mensaje: 'grado, seccion, jornada y cupoMaximo son obligatorios.' });
    }
    const cantidadEstudiantes = estudiantes !== undefined ? estudiantes : estudiantesAleatorios(cupoMaximo);
    const [resultado] = await pool.query(
      'INSERT INTO cursos (grado, seccion, jornada, cupo_maximo, estudiantes) VALUES (?, ?, ?, ?, ?)',
      [grado, seccion, jornada, cupoMaximo, cantidadEstudiantes]
    );
    const [creado] = await pool.query('SELECT * FROM cursos WHERE id = ?', [resultado.insertId]);
    return res.status(201).json(creado[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un curso con ese grado y sección.' });
    }
    console.error('Error en crear() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al crear el curso.' });
  }
}

// ---------------------------------------------------------
// PUT /api/cursos/:id
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { grado, seccion, jornada, cupoMaximo, estudiantes } = req.body;
    const [resultado] = await pool.query(
      'UPDATE cursos SET grado = ?, seccion = ?, jornada = ?, cupo_maximo = ?, estudiantes = ? WHERE id = ?',
      [grado, seccion, jornada, cupoMaximo, estudiantes, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    const [actualizado] = await pool.query('SELECT * FROM cursos WHERE id = ?', [id]);
    return res.status(200).json(actualizado[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un curso con ese grado y sección.' });
    }
    if (error.errno === 3819) { // CHECK constraint (estudiantes > cupo_maximo)
      return res.status(422).json({ mensaje: 'El número de estudiantes no puede superar el cupo máximo.' });
    }
    console.error('Error en actualizar() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar el curso.' });
  }
}

// ---------------------------------------------------------
// DELETE /api/cursos/:id (borra en cascada su horario)
// ---------------------------------------------------------
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM cursos WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    return res.status(200).json({ mensaje: 'Curso eliminado correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminar() [cursos]:', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar el curso.' });
  }
}

// ---------------------------------------------------------
// POST /api/cursos/aleatorizar-cupos
// Recalcula "estudiantes" para todos los cursos (o uno solo si
// se manda cursoId), entre el 75% y el 100% del cupo máximo.
// ---------------------------------------------------------
async function aleatorizarCupos(req, res) {
  try {
    const { cursoId } = req.body || {};
    const [cursos] = await pool.query(
      cursoId ? 'SELECT id, cupo_maximo FROM cursos WHERE id = ?' : 'SELECT id, cupo_maximo FROM cursos',
      cursoId ? [cursoId] : []
    );
    if (cursoId && cursos.length === 0) {
      return res.status(404).json({ mensaje: 'Curso no encontrado.' });
    }
    for (const curso of cursos) {
      await pool.query('UPDATE cursos SET estudiantes = ? WHERE id = ?', [estudiantesAleatorios(curso.cupo_maximo), curso.id]);
    }
    const [actualizados] = await pool.query('SELECT * FROM cursos ORDER BY grado, seccion');
    return res.status(200).json(actualizados);
  } catch (error) {
    console.error('Error en aleatorizarCupos():', error);
    return res.status(500).json({ mensaje: 'Error interno al aleatorizar los cupos.' });
  }
}

module.exports = {
  consultarTodos,
  consultarPorId,
  crear,
  actualizar,
  eliminar,
  aleatorizarCupos,
};
