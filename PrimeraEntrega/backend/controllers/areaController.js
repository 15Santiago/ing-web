// =========================================================
// Áreas / especialidades docentes (MAT-FIS, ESP-ING, etc.)
// Catálogo de solo lectura: se usa para clasificar materias
// y docentes; se carga con el seed y no se edita desde el front.
// =========================================================
const { pool } = require('../config/db');
const { calcularHorasSugeridasArea } = require('../services/necesidadDocentesService');

async function consultarTodas(req, res) {
  try {
    const [filas] = await pool.query('SELECT id, codigo, nombre FROM areas ORDER BY nombre');
    return res.status(200).json(filas);
  } catch (error) {
    console.error('Error en consultarTodas() [areas]:', error);
    return res.status(500).json({ mensaje: 'Error interno al consultar las áreas.' });
  }
}

// ---------------------------------------------------------
// GET /api/areas/:id/horas-sugeridas
// Cuántas horas semanales conviene contratarle a un docente
// nuevo de esta área, según lo que haga falta ahí mismo hoy.
// ---------------------------------------------------------
async function consultarHorasSugeridas(req, res) {
  try {
    const { id } = req.params;
    const sugerencia = await calcularHorasSugeridasArea(id);
    return res.status(200).json(sugerencia);
  } catch (error) {
    console.error('Error en consultarHorasSugeridas() [areas]:', error);
    return res.status(500).json({ mensaje: 'Error interno al calcular las horas sugeridas.' });
  }
}

module.exports = { consultarTodas, consultarHorasSugeridas };
