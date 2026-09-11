// =========================================================
// Cuántos docentes hacen falta HOY, calculado contra la base de
// datos real (no una simulación aparte): agrupa los bloques de
// horario de los cursos activos por área y divide entre el máximo
// de bloques semanales por docente definido en configuracion_colegio.
// Lo usan cursoController (tras aleatorizar-estudiantes) y
// dashboardController (resumen general).
// =========================================================
const { pool } = require('../config/db');
const { registrarEvento } = require('./docenteLogService');

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

// ---------------------------------------------------------
// Ajusta automáticamente qué docentes están activos, área por
// área, para que la nómina activa coincida con lo que hace falta
// según los bloques de horario de los cursos ACTIVOS en este
// momento. Pensada para correr dentro de la MISMA transacción de
// quien la llama (p.ej. justo después de aleatorizar-estudiantes,
// una vez que ya se abrieron/cerraron secciones): recibe la
// conexión de esa transacción, nunca el pool.
//   - Si a un área le sobran docentes activos, desactiva primero
//     a los que menos horas tienen asignadas ahora mismo (son los
//     que quedaron con menos carga tras cerrar secciones) y vacía
//     los bloques que les queden, igual que despedir().
//   - Si a un área le faltan, reactiva docentes inactivos de esa
//     misma área (los dados de baja más recientemente primero),
//     sin superar el máximo de nómina del colegio. Sus bloques
//     anteriores siguen vacantes: se cubren desde "Bloques
//     vacantes", igual que al reactivar manualmente.
// ---------------------------------------------------------
async function balancearNomina(conexion) {
  const [[config]] = await conexion.query(
    'SELECT capacidad_nomina, bloques_max_docente_semana FROM configuracion_colegio LIMIT 1'
  );
  const capacidadNomina = Number(config?.capacidad_nomina ?? 30);
  const bloquesMax = Number(config?.bloques_max_docente_semana ?? 46);

  const [porArea] = await conexion.query(
    `SELECT a.id AS area_id, a.nombre, COUNT(*) AS bloques
     FROM horarios h
     JOIN cursos c ON c.id = h.curso_id
     JOIN materias m ON m.id = h.materia_id
     JOIN areas a ON a.id = m.area_id
     WHERE c.activo = TRUE
     GROUP BY a.id, a.nombre`
  );

  const [[{ total: totalActivosGlobal }]] = await conexion.query(
    'SELECT COUNT(*) AS total FROM docentes WHERE activo = TRUE'
  );
  let cupoRestante = capacidadNomina - Number(totalActivosGlobal);

  const desactivados = [];
  const reactivados = [];

  for (const area of porArea) {
    const necesarios = Math.ceil(area.bloques / bloquesMax);

    // eslint-disable-next-line no-await-in-loop
    const [activos] = await conexion.query(
      `SELECT d.id, d.nombre,
              COALESCE(SUM(TIMESTAMPDIFF(MINUTE, h.hora_inicio, h.hora_fin)) / 60, 0) AS horas_asignadas
       FROM docentes d
       LEFT JOIN horarios h ON h.docente_id = d.id
       WHERE d.area_id = ? AND d.activo = TRUE
       GROUP BY d.id, d.nombre
       ORDER BY horas_asignadas ASC, d.id ASC`,
      [area.area_id]
    );

    if (activos.length > necesarios) {
      const sobran = activos.slice(0, activos.length - necesarios);
      const idsSobran = sobran.map((d) => d.id);
      // eslint-disable-next-line no-await-in-loop
      await conexion.query('UPDATE docentes SET activo = FALSE, fecha_baja = NOW() WHERE id IN (?)', [idsSobran]);
      // eslint-disable-next-line no-await-in-loop
      await conexion.query('UPDATE horarios SET docente_id = NULL WHERE docente_id IN (?)', [idsSobran]);
      for (const d of sobran) {
        // eslint-disable-next-line no-await-in-loop
        await registrarEvento(conexion, {
          docenteId: d.id,
          docenteNombre: d.nombre,
          accion: 'despedido',
          origen: 'automatico',
          detalle: `Ajuste automático de nómina en ${area.nombre} al aleatorizar estudiantes`,
        });
      }
      cupoRestante += idsSobran.length;
      sobran.forEach((d) => desactivados.push({ id: d.id, nombre: d.nombre, area: area.nombre }));
    } else if (activos.length < necesarios && cupoRestante > 0) {
      const faltan = Math.min(necesarios - activos.length, cupoRestante);
      // eslint-disable-next-line no-await-in-loop
      const [inactivos] = await conexion.query(
        `SELECT id, nombre FROM docentes WHERE area_id = ? AND activo = FALSE
         ORDER BY fecha_baja IS NULL, fecha_baja DESC, id ASC LIMIT ${faltan}`,
        [area.area_id]
      );
      if (inactivos.length) {
        const idsFaltan = inactivos.map((d) => d.id);
        // eslint-disable-next-line no-await-in-loop
        await conexion.query('UPDATE docentes SET activo = TRUE, fecha_baja = NULL WHERE id IN (?)', [idsFaltan]);
        for (const d of inactivos) {
          // eslint-disable-next-line no-await-in-loop
          await registrarEvento(conexion, {
            docenteId: d.id,
            docenteNombre: d.nombre,
            accion: 'reactivado',
            origen: 'automatico',
            detalle: `Ajuste automático de nómina en ${area.nombre} al aleatorizar estudiantes`,
          });
        }
        cupoRestante -= idsFaltan.length;
        inactivos.forEach((d) => reactivados.push({ id: d.id, nombre: d.nombre, area: area.nombre }));
      }
    }
  }

  return { desactivados, reactivados };
}

// ---------------------------------------------------------
// Horas contratadas sugeridas para un docente nuevo de un área,
// según lo que haga falta ahí mismo: bloques de los cursos
// activos de esa área (convertidos a horas, 45 min = 0.75 h cada
// uno) menos las horas que ya cubren los docentes activos de esa
// misma área. Si no falta nada puntual, se sugiere tiempo
// completo (el máximo contratable de configuracion_colegio).
// ---------------------------------------------------------
const HORAS_POR_BLOQUE = 0.75;

async function calcularHorasSugeridasArea(areaId) {
  const config = await obtenerConfiguracion();
  const horasContratablesMax = Number(config.bloques_max_docente_semana) * HORAS_POR_BLOQUE;

  const [[bloquesArea]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM horarios h
     JOIN cursos c ON c.id = h.curso_id
     JOIN materias m ON m.id = h.materia_id
     WHERE c.activo = TRUE AND m.area_id = ?`,
    [areaId]
  );
  const horasNecesarias = Number(bloquesArea.total) * HORAS_POR_BLOQUE;

  const [[cubiertas]] = await pool.query(
    `SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, h.hora_inicio, h.hora_fin)) / 60, 0) AS horas
     FROM horarios h
     JOIN docentes d ON d.id = h.docente_id
     WHERE d.area_id = ? AND d.activo = TRUE`,
    [areaId]
  );
  const horasCubiertas = Number(cubiertas.horas);
  const horasFaltantes = Math.max(0, horasNecesarias - horasCubiertas);

  const horasSugeridas = horasFaltantes > 0
    ? Math.min(horasContratablesMax, Math.max(1, Math.round(horasFaltantes * 4) / 4))
    : horasContratablesMax;

  return {
    areaId: Number(areaId),
    horasNecesarias: Math.round(horasNecesarias * 100) / 100,
    horasCubiertas: Math.round(horasCubiertas * 100) / 100,
    horasFaltantes: Math.round(horasFaltantes * 100) / 100,
    horasContratablesMax,
    horasSugeridas,
  };
}

module.exports = {
  calcularNecesidadDocentes,
  obtenerConfiguracion,
  balancearNomina,
  calcularHorasSugeridasArea,
};
