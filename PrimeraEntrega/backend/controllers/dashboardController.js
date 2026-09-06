// =========================================================
// Dashboard: información general de la programación académica.
// =========================================================
const { pool } = require('../config/db');

async function resumen(req, res) {
  try {
    const [[cursos]] = await pool.query(
      `SELECT COUNT(*) AS totalCursos, COALESCE(SUM(estudiantes), 0) AS totalEstudiantes,
              COALESCE(SUM(cupo_maximo), 0) AS capacidadTotal
       FROM cursos`
    );
    const [[docentes]] = await pool.query(
      `SELECT
         SUM(activo = TRUE) AS activos,
         SUM(activo = FALSE) AS inactivos
       FROM docentes`
    );
    const [[horas]] = await pool.query(
      `SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, hora_inicio, hora_fin)) / 60, 0) AS horasSemanalesTotales,
              COUNT(*) AS totalBloques,
              SUM(docente_id IS NULL) AS bloquesVacantes
       FROM horarios`
    );
    const [porJornada] = await pool.query(
      `SELECT jornada, COUNT(*) AS cursos, COALESCE(SUM(estudiantes), 0) AS estudiantes
       FROM cursos GROUP BY jornada`
    );
    const [porArea] = await pool.query(
      `SELECT a.codigo, a.nombre, COUNT(d.id) AS docentes,
              COALESCE(SUM(d.activo = TRUE), 0) AS activos
       FROM areas a LEFT JOIN docentes d ON d.area_id = a.id
       GROUP BY a.id, a.codigo, a.nombre
       ORDER BY a.nombre`
    );
    const [[conflictosDocente]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT docente_id FROM horarios WHERE docente_id IS NOT NULL
         GROUP BY docente_id, dia, hora_inicio HAVING COUNT(*) > 1
       ) t`
    );
    const [[conflictosCurso]] = await pool.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT curso_id FROM horarios GROUP BY curso_id, dia, hora_inicio HAVING COUNT(*) > 1
       ) t`
    );

    return res.status(200).json({
      totalCursos: cursos.totalCursos,
      totalEstudiantes: cursos.totalEstudiantes,
      capacidadTotal: cursos.capacidadTotal,
      docentesActivos: Number(docentes.activos || 0),
      docentesInactivos: Number(docentes.inactivos || 0),
      horasSemanalesTotales: Number(horas.horasSemanalesTotales),
      totalBloques: horas.totalBloques,
      bloquesVacantes: Number(horas.bloquesVacantes || 0),
      porJornada,
      porArea,
      conflictos: Number(conflictosDocente.total) + Number(conflictosCurso.total),
    });
  } catch (error) {
    console.error('Error en resumen() [dashboard]:', error);
    return res.status(500).json({ mensaje: 'Error interno al calcular el dashboard.' });
  }
}

module.exports = { resumen };
