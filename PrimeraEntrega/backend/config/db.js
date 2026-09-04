// =========================================================
// Configuración de conexión a la base de datos MySQL
// =========================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

// Pool de conexiones: mejor rendimiento que abrir/cerrar
// una conexión nueva en cada consulta.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'notasAcademicas',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Función de utilidad para probar la conexión al iniciar el servidor
async function verificarConexion() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión a la base de datos MySQL establecida correctamente.');
    conn.release();
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    console.error('   Revisa el archivo .env y que el servidor MySQL esté activo,');
    console.error('   y que ya hayas ejecutado database/schema.sql.');
    process.exit(1);
  }
}

module.exports = { pool, verificarConexion };
