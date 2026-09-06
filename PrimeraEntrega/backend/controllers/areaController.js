// =========================================================
// Áreas / especialidades docentes (MAT-FIS, ESP-ING, etc.)
// Catálogo de solo lectura: se usa para clasificar materias
// y docentes; se carga con el seed y no se edita desde el front.
// =========================================================
const { pool } = require('../config/db');

async function consultarTodas(req, res) {
  try {
    const [filas] = await pool.query('SELECT id, codigo, nombre FROM areas ORDER BY nombre');
    return res.status(200).json(filas);
  } catch (error) {
    console.error('Error en consultarTodas() [areas]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar las áreas.' });
  }
}

module.exports = { consultarTodas };
