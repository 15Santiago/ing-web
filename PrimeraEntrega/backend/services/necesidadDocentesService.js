// =========================================================
// Cuántos docentes hacen falta HOY, calculado contra la base de
// datos real (no una simulación aparte): agrupa los bloques de
// horario de los cursos activos por área y divide entre el máximo
// de bloques semanales por docente definido en configuracion_colegio.
// Lo usan cursoController (tras aleatorizar-estudiantes) y
// dashboardController (resumen general).
// =========================================================
const { pool } = require('../config/db');

async function obtenerConfiguracion() {
  const [filas] = await pool.query(
    'SELECT capacidad_nomina, bloques_max_docente_semana FROM configuracion_colegio LIMIT 1'
  );
  return filas[0] || { capacidad_nomina: 30, bloques_max_docente_semana: 46 };
}

// ---------------------------------------------------------
// Docentes necesarios para los cursos ACTIVOS actuales, por área
// y en total, comparado contra los docentes activos hoy.
// ---------------------------------------------------------
async function calcularNecesidadDocentes() {
  const config = await obtenerConfiguracion();

  const [porArea] = await pool.query(
    `SELECT a.id AS area_id, a.codigo, a.nombre, COUNT(*) AS bloques
     FROM horarios h
     JOIN cursos c ON c.id = h.curso_id
     JOIN materias m ON m.id = h.materia_id
     LEFT JOIN areas a ON a.id = m.area_id
     WHERE c.activo = TRUE
     GROUP BY a.id, a.codigo, a.nombre
     ORDER BY a.nombre`
  );

  const detallePorArea = porArea.map((fila) => ({
    areaId: fila.area_id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    bloques: fila.bloques,
    docentesNecesarios: Math.ceil(fila.bloques / config.bloques_max_docente_semana),
  }));
  const docentesNecesarios = detallePorArea.reduce((total, area) => total + area.docentesNecesarios, 0);

  const [[docentesActivos]] = await pool.query('SELECT COUNT(*) AS total FROM docentes WHERE activo = TRUE');
  const [[cursosActivos]] = await pool.query('SELECT COUNT(*) AS total, COALESCE(SUM(estudiantes), 0) AS estudiantes FROM cursos WHERE activo = TRUE');
  const [[cursosTotales]] = await pool.query('SELECT COUNT(*) AS total FROM cursos');

  return {
    docentesNecesarios,
    docentesDisponibles: config.capacidad_nomina,
    docentesActivos: Number(docentesActivos.total),
    docentesSobrantes: Math.max(0, Number(docentesActivos.total) - docentesNecesarios),
    docentesFaltantes: Math.max(0, docentesNecesarios - Number(docentesActivos.total)),
    cursosActivos: Number(cursosActivos.total),
    cursosTotales: Number(cursosTotales.total),
    estudiantesActivos: Number(cursosActivos.estudiantes),
    bloquesMaxDocenteSemana: config.bloques_max_docente_semana,
    porArea: detallePorArea,
  };
}

module.exports = { calcularNecesidadDocentes, obtenerConfiguracion };
