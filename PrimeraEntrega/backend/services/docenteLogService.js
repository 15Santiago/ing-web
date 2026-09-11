// =========================================================
// Bitácora de docentes (tabla docentes_log): trazabilidad de
// contrataciones, despidos, reactivaciones y actualizaciones,
// tanto manuales (desde "Gestión de docentes") como automáticas
// (el balanceo de nómina que corre dentro de
// aleatorizar-estudiantes, ver necesidadDocentesService).
// =========================================================
const { pool } = require('../config/db');

// ejecutor: pasa la conexión de una transacción en curso para que
// el registro quede atado a ella (se deshace si la transacción
// hace rollback); si se omite, usa el pool directamente.
async function registrarEvento(ejecutor, { docenteId, docenteNombre, accion, origen = 'manual', detalle = null }) {
  const conexion = ejecutor || pool;
  await conexion.query(
    'INSERT INTO docentes_log (docente_id, docente_nombre, accion, origen, detalle) VALUES (?, ?, ?, ?, ?)',
    [docenteId, docenteNombre, accion, origen, detalle]
  );
}

async function consultarLog({ docenteId, limite = 50 } = {}) {
  const condiciones = [];
  const parametros = [];
  if (docenteId) { condiciones.push('docente_id = ?'); parametros.push(docenteId); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const limiteSeguro = Number.isFinite(Number(limite)) ? Math.min(Math.max(Number(limite), 1), 200) : 50;

  const [filas] = await pool.query(
    `SELECT id, docente_id, docente_nombre, accion, origen, detalle, creado_en
     FROM docentes_log
     ${where}
     ORDER BY creado_en DESC, id DESC
     LIMIT ${limiteSeguro}`,
    parametros
  );
  return filas;
}

module.exports = { registrarEvento, consultarLog };
