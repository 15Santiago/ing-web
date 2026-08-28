// =========================================================
// Controlador de Estudiantes
// Usa la clase Estudiante (POO) para validar/calcular y el
// pool de MySQL para persistir en la tabla "Estudiantes".
//
// IMPORTANTE: las formas de respuesta están ajustadas a lo
// que espera script.js del front end:
//   - GET  /api/estudiantes      -> arreglo plano de registros
//   - POST /api/estudiantes      -> objeto plano del creado
//   - PUT  /api/estudiantes/:id  -> objeto plano actualizado
//   - DELETE /api/estudiantes/:id -> objeto simple de confirmación
// En caso de error, el front solo revisa resp.ok y muestra un
// mensaje genérico, así que el detalle va en el body igual
// (útil para depurar con las herramientas de red del navegador).
// =========================================================
const { pool } = require('../config/db');
const Estudiante = require('../models/Estudiante');

const TABLA = 'Estudiantes';

// ---------------------------------------------------------
// POST /api/estudiantes/calcular
// Calcula y devuelve el resultado SIN guardar en BD.
// (No usado por el front actual, que calcula en el cliente,
// pero se deja disponible como utilidad / para pruebas).
// ---------------------------------------------------------
async function calcular(req, res) {
  try {
    const { nombre, nota1, nota2, nota3, nota4 } = req.body;
    const estudiante = new Estudiante(nombre, nota1, nota2, nota3, nota4);

    const errores = estudiante.validar();
    if (errores.length > 0) {
      return res.status(400).json({ mensaje: 'Datos inválidos.', errores });
    }

    estudiante.procesar();
    return res.status(200).json(estudiante.toJSON());
  } catch (error) {
    console.error('Error en calcular():', error);
    return res.status(500).json({ mensaje: 'Error interno al calcular el promedio.' });
  }
}

// ---------------------------------------------------------
// POST /api/estudiantes
// Registrar: guarda un estudiante con sus cuatro notas.
// Recalcula promedio/estado/rendimiento en el servidor
// (no confía ciegamente en lo que mande el front).
// ---------------------------------------------------------
async function registrar(req, res) {
  try {
    const { nombre, nota1, nota2, nota3, nota4 } = req.body;
    const estudiante = new Estudiante(nombre, nota1, nota2, nota3, nota4);

    const errores = estudiante.validar();
    if (errores.length > 0) {
      return res.status(400).json({ mensaje: 'Datos inválidos.', errores });
    }

    estudiante.procesar();

    const [resultado] = await pool.query(
      `INSERT INTO ${TABLA}
        (nombre, nota1, nota2, nota3, nota4, promedio, estado, rendimiento, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        estudiante.nombre,
        estudiante.nota1,
        estudiante.nota2,
        estudiante.nota3,
        estudiante.nota4,
        estudiante.promedio,
        estudiante.estado,
        estudiante.rendimiento,
      ]
    );

    estudiante.id = resultado.insertId;
    return res.status(201).json(estudiante.toJSON());
  } catch (error) {
    console.error('Error en registrar():', error);
    return res.status(500).json({ mensaje: 'Error interno al registrar el estudiante.' });
  }
}

// ---------------------------------------------------------
// GET /api/estudiantes
// Consultar: lista todos los estudiantes registrados.
// Devuelve un ARREGLO PLANO (script.js hace registros.forEach
// directamente sobre la respuesta).
// ---------------------------------------------------------
async function consultarTodos(req, res) {
  try {
    const [filas] = await pool.query(
      `SELECT * FROM ${TABLA} ORDER BY creado_en DESC, id DESC`
    );
    const estudiantes = filas.map((fila) => Estudiante.fromRow(fila).toJSON());
    return res.status(200).json(estudiantes);
  } catch (error) {
    console.error('Error en consultarTodos():', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar los registros.' });
  }
}

// ---------------------------------------------------------
// GET /api/estudiantes/:id
// Consultar un estudiante puntual por su id (utilidad extra;
// el front actual filtra la lista completa en el cliente).
// ---------------------------------------------------------
async function consultarPorId(req, res) {
  try {
    const { id } = req.params;
    const [filas] = await pool.query(`SELECT * FROM ${TABLA} WHERE id = ?`, [id]);

    if (filas.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    const estudiante = Estudiante.fromRow(filas[0]);
    return res.status(200).json(estudiante.toJSON());
  } catch (error) {
    console.error('Error en consultarPorId():', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar el estudiante.' });
  }
}

// ---------------------------------------------------------
// PUT /api/estudiantes/:id
// Actualizar: modifica notas/nombre y recalcula todo.
// ---------------------------------------------------------
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, nota1, nota2, nota3, nota4 } = req.body;

    const [existe] = await pool.query(`SELECT id FROM ${TABLA} WHERE id = ?`, [id]);
    if (existe.length === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    const estudiante = new Estudiante(nombre, nota1, nota2, nota3, nota4, id);
    const errores = estudiante.validar();
    if (errores.length > 0) {
      return res.status(400).json({ mensaje: 'Datos inválidos.', errores });
    }

    estudiante.procesar();

    await pool.query(
      `UPDATE ${TABLA}
       SET nombre = ?, nota1 = ?, nota2 = ?, nota3 = ?, nota4 = ?,
           promedio = ?, estado = ?, rendimiento = ?
       WHERE id = ?`,
      [
        estudiante.nombre,
        estudiante.nota1,
        estudiante.nota2,
        estudiante.nota3,
        estudiante.nota4,
        estudiante.promedio,
        estudiante.estado,
        estudiante.rendimiento,
        id,
      ]
    );

    return res.status(200).json(estudiante.toJSON());
  } catch (error) {
    console.error('Error en actualizar():', error);
    return res.status(500).json({ mensaje: 'Error interno al actualizar el estudiante.' });
  }
}

// ---------------------------------------------------------
// DELETE /api/estudiantes/:id
// Eliminar: borra un registro cuando sea necesario.
// ---------------------------------------------------------
async function eliminar(req, res) {
  try {
    const { id } = req.params;

    const [resultado] = await pool.query(`DELETE FROM ${TABLA} WHERE id = ?`, [id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Estudiante no encontrado.' });
    }

    return res.status(200).json({ mensaje: 'Estudiante eliminado correctamente.', id: Number(id) });
  } catch (error) {
    console.error('Error en eliminar():', error);
    return res.status(500).json({ mensaje: 'Error interno al eliminar el estudiante.' });
  }
}

module.exports = {
  calcular,
  registrar,
  consultarTodos,
  consultarPorId,
  actualizar,
  eliminar,
};
