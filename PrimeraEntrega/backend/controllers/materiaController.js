// =========================================================
// Gestión de asignaturas (materias) y su intensidad horaria
// por nivel (plan_materias). CRUD completo, tal como pide la
// guía: "Gestionar asignaturas: nombre e intensidad horaria".
// =========================================================
const { pool } = require('../config/db');

// ---------------------------------------------------------
// GET /api/materias
// Lista las materias con su área responsable y, si existen,
// las filas de intensidad horaria por nivel.
// ---------------------------------------------------------
async function consultarTodas(req, res) {
  try {
    const [materias] = await pool.query(
      `SELECT m.id, m.nombre, m.area_id, a.codigo AS area_codigo, a.nombre AS area_nombre
       FROM materias m
       LEFT JOIN areas a ON a.id = m.area_id
       ORDER BY m.nombre`
    );
    const [planes] = await pool.query(
      `SELECT id, nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana FROM plan_materias`
    );
    const planesPorMateria = new Map();
    planes.forEach((plan) => {
      const lista = planesPorMateria.get(plan.materia_id) || [];
      lista.push(plan);
      planesPorMateria.set(plan.materia_id, lista);
    });

    const respuesta = materias.map((materia) => ({
      ...materia,
      intensidadPorNivel: planesPorMateria.get(materia.id) || [],
    }));
    return res.status(200).json(respuesta);
  } catch (error) {
    console.error('Error en consultarTodas() [materias]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar las materias.' });
  }
}

// ---------------------------------------------------------
// POST /api/materias
// ---------------------------------------------------------
async function crear(req, res) {
  try {
    const { nombre, areaId } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'El nombre de la materia es obligatorio.' });
    }
    const [resultado] = await pool.query(
      'INSERT INTO materias (nombre, area_id) VALUES (?, ?)',
      [nombre.trim(), areaId || null]
    );
    return res.status(201).json({ id: resultado.insertId, nombre: nombre.trim(), areaId: areaId || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una materia con ese nombre.' });
    }
    console.error('Error en crear() [materias]:', error);
    return res.status(500).json({ mensaje: 'Error interno al crear la materia.' });
  }
}

// ---------------------------------------------------------
// PUT /api/materias/:id
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, areaId } = req.body;
    const [resultado] = await pool.query(
      'UPDATE materias SET nombre = ?, area_id = ? WHERE id = ?',
      [nombre, areaId || null, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Materia no encontrada.' });
    }
    return res.status(200).json({ id: Number(id), nombre, areaId: areaId || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe una materia con ese nombre.' });
    }
    console.error('Error en actualizar() [materias]:', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar la materia.' });
  }
}

// ---------------------------------------------------------
// DELETE /api/materias/:id
// ---------------------------------------------------------
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const [enUso] = await pool.query('SELECT COUNT(*) AS total FROM horarios WHERE materia_id = ?', [id]);
    if (enUso[0].total > 0) {
      return res.status(409).json({ mensaje: `No se puede eliminar: la materia tiene ${enUso[0].total} bloques de horario asignados.` });
    }
    const [resultado] = await pool.query('DELETE FROM materias WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Materia no encontrada.' });
    }
    return res.status(200).json({ mensaje: 'Materia eliminada correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminar() [materias]:', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar la materia.' });
  }
}

// ---------------------------------------------------------
// Intensidad horaria por nivel (plan_materias)
// ---------------------------------------------------------
async function crearPlan(req, res) {
  try {
    const { nivel, gradoMin, gradoMax, materiaId, bloquesSemana, horasSemana } = req.body;
    if (!nivel || !materiaId || !bloquesSemana || !horasSemana) {
      return res.status(400).json({ mensaje: 'nivel, materiaId, bloquesSemana y horasSemana son obligatorios.' });
    }
    const [resultado] = await pool.query(
      'INSERT INTO plan_materias (nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana) VALUES (?, ?, ?, ?, ?, ?)',
      [nivel, gradoMin || 1, gradoMax || 11, materiaId, bloquesSemana, horasSemana]
    );
    return res.status(201).json({ id: resultado.insertId, nivel, gradoMin, gradoMax, materiaId, bloquesSemana, horasSemana });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ya existe un plan para esa materia en ese nivel.' });
    }
    console.error('Error en crearPlan():', error);
    return res.status(500).json({ mensaje: 'Error interno al crear el plan de materia.' });
  }
}

async function actualizarPlan(req, res) {
  try {
    const { id } = req.params;
    const { nivel, gradoMin, gradoMax, bloquesSemana, horasSemana } = req.body;
    const [resultado] = await pool.query(
      'UPDATE plan_materias SET nivel = ?, grado_min = ?, grado_max = ?, bloques_semana = ?, horas_semana = ? WHERE id = ?',
      [nivel, gradoMin, gradoMax, bloquesSemana, horasSemana, id]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Plan de materia no encontrado.' });
    }
    return res.status(200).json({ id: Number(id), nivel, gradoMin, gradoMax, bloquesSemana, horasSemana });
  } catch (error) {
    console.error('Error en actualizarPlan():', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar el plan de materia.' });
  }
}

async function eliminarPlan(req, res) {
  try {
    const { id } = req.params;
    const [resultado] = await pool.query('DELETE FROM plan_materias WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Plan de materia no encontrado.' });
    }
    return res.status(200).json({ mensaje: 'Plan de materia eliminado correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminarPlan():', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar el plan de materia.' });
  }
}

module.exports = {
  consultarTodas,
  crear,
  actualizar,
  eliminar,
  crearPlan,
  actualizarPlan,
  eliminarPlan,
};
