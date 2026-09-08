// Refleja la misma programación real que carga ../DB/seed/seed.js
// (42 cursos, máximo 30 docentes, sin horas de trabajo autónomo: la
// jornada completa -30 bloques de 45 min/semana por curso- son clases
// reales). Este simulador aproxima cada materia con una única
// intensidad horaria por todos los grados en los que se dicta (a
// diferencia de plan_materias, que sí varía por nivel), así que sus
// números son un estimado rápido, no un espejo exacto del horario
// real que se consulta en /personal.html.
const DEFAULT_CONFIG = {
  docentesDisponibles: 30,
  maxDocentes: 30,
  diasLaboralesSemana: 5,
  horasTrabajoDiarias: 8,
  horasAlmuerzoDiarias: 1,
  horasTrabajoDocenteSemana: 34.5,
  horasExtraSemanaMax: 1,
  horasExtraMesMax: 4,
  horasJornadaCursoDia: 4.5,
  semanasAnioLectivo: 40,
  semanasExtraPermitidasMes: 4,
  cursos: {
    11: { total: 2, manana: 2, tarde: 0, estudiantes: 30 },
    10: { total: 3, manana: 3, tarde: 0, estudiantes: 30 },
    9: { total: 3, manana: 1, tarde: 2, estudiantes: 28 },
    8: { total: 3, manana: 1, tarde: 2, estudiantes: 28 },
    7: { total: 3, manana: 2, tarde: 1, estudiantes: 28 },
    6: { total: 3, manana: 2, tarde: 1, estudiantes: 30 },
    5: { total: 5, manana: 3, tarde: 2, estudiantes: 28 },
    4: { total: 5, manana: 3, tarde: 2, estudiantes: 26 },
    3: { total: 5, manana: 3, tarde: 2, estudiantes: 30 },
    2: { total: 5, manana: 3, tarde: 2, estudiantes: 30 },
    1: { total: 5, manana: 3, tarde: 2, estudiantes: 26 },
  },
  materias: [
    { nombre: 'Matemáticas', horas: 5, intensidad: '+', desde: 1 },
    { nombre: 'Física', horas: 3, intensidad: '+', desde: 6 },
    { nombre: 'Química', horas: 3, intensidad: '+', desde: 6 },
    { nombre: 'Biología', horas: 3, intensidad: '+', desde: 6 },
    { nombre: 'Ciencias naturales', horas: 4, intensidad: '+', desde: 1, hasta: 5 },
    { nombre: 'Inglés', horas: 3, intensidad: '-', desde: 1 },
    { nombre: 'Español', horas: 4, intensidad: '+', desde: 1 },
    { nombre: 'Educación física', horas: 2, intensidad: '-', desde: 1 },
    { nombre: 'Ética', horas: 1, intensidad: '-', desde: 1 },
    { nombre: 'Ciencias sociales', horas: 3, intensidad: '-', desde: 1, hasta: 10 },
    { nombre: 'Filosofía', horas: 2, intensidad: '-', desde: 11 },
    { nombre: 'Informática', horas: 2, intensidad: '-', desde: 1 },
    { nombre: 'Artística', horas: 3, intensidad: '-', desde: 1, hasta: 5 },
    { nombre: 'Proyecto de vida', horas: 1, intensidad: '-', desde: 6 },
  ],
};

function numeroPositivo(valor, porDefecto) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : porDefecto;
}

function fusionarConfiguracion(entrada = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    docentesDisponibles: Math.min(DEFAULT_CONFIG.maxDocentes, Math.floor(numeroPositivo(entrada.docentesDisponibles, DEFAULT_CONFIG.docentesDisponibles))),
    maxDocentes: DEFAULT_CONFIG.maxDocentes,
    diasLaboralesSemana: DEFAULT_CONFIG.diasLaboralesSemana,
    horasTrabajoDiarias: DEFAULT_CONFIG.horasTrabajoDiarias,
    horasAlmuerzoDiarias: DEFAULT_CONFIG.horasAlmuerzoDiarias,
    horasTrabajoDocenteSemana: numeroPositivo(entrada.horasTrabajoDocenteSemana, DEFAULT_CONFIG.horasTrabajoDocenteSemana),
    horasExtraSemanaMax: DEFAULT_CONFIG.horasExtraSemanaMax,
    horasExtraMesMax: DEFAULT_CONFIG.horasExtraMesMax,
    horasJornadaCursoDia: numeroPositivo(entrada.horasJornadaCursoDia, DEFAULT_CONFIG.horasJornadaCursoDia),
    semanasAnioLectivo: Math.floor(numeroPositivo(entrada.semanasAnioLectivo, DEFAULT_CONFIG.semanasAnioLectivo)),
    semanasExtraPermitidasMes: Math.floor(numeroPositivo(entrada.semanasExtraPermitidasMes, DEFAULT_CONFIG.semanasExtraPermitidasMes)),
    cursos: DEFAULT_CONFIG.cursos,
    materias: DEFAULT_CONFIG.materias,
  };

  return config;
}

function cursosPorMateria(config, materia) {
  return Object.entries(config.cursos)
    .filter(([grado, curso]) => curso.total > 0 && Number(grado) >= materia.desde && (!materia.hasta || Number(grado) <= materia.hasta))
    .map(([grado, curso]) => ({ grado: Number(grado), ...curso }));
}

function calcularOrganizacion(entrada) {
  const config = fusionarConfiguracion(entrada);
  const cursos = Object.entries(config.cursos).map(([grado, curso]) => ({ grado: Number(grado), ...curso }));
  const totalCursos = cursos.reduce((total, curso) => total + curso.total, 0);
  const estudiantes = cursos.reduce((total, curso) => total + curso.total * curso.estudiantes, 0);

  const materias = config.materias.map((materia) => {
    const cursosMateria = cursosPorMateria(config, materia);
    const cursosAtendidos = cursosMateria.reduce((total, curso) => total + curso.total, 0);
    const horasSemanales = cursosAtendidos * materia.horas;
    const docentesRequeridos = Math.ceil(horasSemanales / config.horasTrabajoDocenteSemana);

    return {
      ...materia,
      cursosAtendidos,
      horasSemanales,
      horasAnuales: horasSemanales * config.semanasAnioLectivo,
      docentesRequeridos,
      asignaciones: crearAsignaciones(materia, cursosMateria, config.horasTrabajoDocenteSemana),
    };
  });

  const horasSemanalesTotales = materias.reduce((total, materia) => total + materia.horasSemanales, 0);
  const docentesRequeridos = Math.ceil(horasSemanalesTotales / config.horasTrabajoDocenteSemana);
  const capacidadConExtra = config.horasTrabajoDocenteSemana + config.horasExtraSemanaMax;
  const docentes = asignarDocentesGlobales(materias, config.docentesDisponibles, config.horasTrabajoDocenteSemana, capacidadConExtra);
  const horasExtraSemanales = docentes.reduce((total, docente) => total + docente.horasExtraSemanales, 0);
  const horasPendientes = docentes.reduce((total, docente) => total + docente.horasPendientes, 0);
  const turnos = cursos.reduce((resultado, curso) => {
    resultado.manana.cursos += curso.manana;
    resultado.tarde.cursos += curso.tarde;
    resultado.manana.estudiantes += curso.manana * curso.estudiantes;
    resultado.tarde.estudiantes += curso.tarde * curso.estudiantes;
    return resultado;
  }, { manana: { cursos: 0, estudiantes: 0 }, tarde: { cursos: 0, estudiantes: 0 } });

  return {
    configuracion: {
      docentesDisponibles: config.docentesDisponibles,
      maxDocentes: config.maxDocentes,
      diasLaboralesSemana: config.diasLaboralesSemana,
      horasTrabajoDiarias: config.horasTrabajoDiarias,
      horasAlmuerzoDiarias: config.horasAlmuerzoDiarias,
      horasTrabajoDocenteSemana: config.horasTrabajoDocenteSemana,
      horasExtraSemanaMax: config.horasExtraSemanaMax,
      horasExtraMesMax: config.horasExtraMesMax,
      horasJornadaCursoDia: config.horasJornadaCursoDia,
      semanasAnioLectivo: config.semanasAnioLectivo,
      semanasExtraPermitidasMes: config.semanasExtraPermitidasMes,
    },
    resumen: {
      totalCursos,
      estudiantes,
      horasSemanalesTotales,
      horasAnualesTotales: horasSemanalesTotales * config.semanasAnioLectivo,
      docentesRequeridos,
      docentesDisponibles: config.docentesDisponibles,
      docentesFaltantes: Math.max(0, docentesRequeridos - config.docentesDisponibles),
      docentesContratables: 0,
      horasExtraSemanales,
      horasExtraMensualesMaximas: config.docentesDisponibles * config.horasExtraMesMax,
      horasPendientes,
      capacidadMaximaConExtras: config.docentesDisponibles * capacidadConExtra,
      turnos,
    },
    cursos,
    materias,
    docentes,
    reglas: [
      'Los signos + se modelan como materias de mayor intensidad horaria.',
      'La nómina está limitada a 30 docentes y no se pueden contratar docentes adicionales.',
      'Cada docente trabaja 8 horas diarias durante 5 días, con 1 hora diaria de almuerzo fuera de la jornada laboral; de esas horas, hasta 34.5 h/semana son de clase efectiva.',
      `Cada docente puede recibir como máximo ${config.horasExtraSemanaMax} hora extra semanal y ${config.horasExtraMesMax} horas extra mensuales.`,
      'Las horas que no puedan cubrirse con los 30 docentes se reportan como pendientes; no se crean docentes adicionales.',
      'La jornada mañana va de 7:00 a 12:00 y la tarde de 13:00 a 18:00, cada una con un receso de 30 minutos; ya no hay horas de "trabajo autónomo": todo bloque de la jornada es una clase real.',
      'El número de secciones por grado es el máximo físico disponible; "aleatorizar estudiantes" en /personal.html abre o cierra secciones según la matrícula sorteada, sin superar nunca los 30 docentes.',
    ],
  };
}

function crearAsignaciones(materia, cursos, capacidad) {
  const asignaciones = [];
  let docente = 1;
  let horasDisponibles = 0;

  cursos.forEach((curso) => {
    for (let numeroCurso = 1; numeroCurso <= curso.total; numeroCurso += 1) {
      if (horasDisponibles < materia.horas) {
        horasDisponibles = capacidad;
        docente += asignaciones.length === 0 ? 0 : 1;
      }
      asignaciones.push({
        docente: `${materia.nombre} ${docente}`,
        grado: curso.grado,
        curso: numeroCurso,
        jornada: numeroCurso <= curso.manana ? 'Mañana' : 'Tarde',
        horasSemanales: materia.horas,
      });
      horasDisponibles -= materia.horas;
    }
  });

  return asignaciones;
}

function asignarDocentesGlobales(materias, cantidadDocentes, capacidad, capacidadConExtra) {
  const tareas = materias.flatMap((materia) => materia.asignaciones.map((asignacion) => ({
    ...asignacion,
    materia: materia.nombre,
  })));
  const docentes = Array.from({ length: cantidadDocentes }, (_, indice) => ({
    nombre: `Docente ${indice + 1}`,
    horasAsignadas: 0,
    horasExtraSemanales: 0,
    horasPendientes: 0,
    asignaciones: [],
  }));

  tareas.sort((a, b) => b.horasSemanales - a.horasSemanales).forEach((tarea) => {
    const disponibles = docentes
      .filter((docente) => docente.horasAsignadas + tarea.horasSemanales <= capacidadConExtra)
      .sort((a, b) => a.horasAsignadas - b.horasAsignadas);
    const docente = disponibles[0];

    if (!docente) {
      docentes[0].horasPendientes += tarea.horasSemanales;
      return;
    }

    docente.asignaciones.push({ materia: tarea.materia, grado: tarea.grado, curso: tarea.curso, jornada: tarea.jornada, horasSemanales: tarea.horasSemanales });
    docente.horasAsignadas += tarea.horasSemanales;
    docente.horasExtraSemanales = Math.max(0, docente.horasAsignadas - capacidad);
  });

  return docentes.map((docenteAsignado) => ({
    ...docenteAsignado,
    horasLibres: Math.max(0, capacidad - docenteAsignado.horasAsignadas),
  }));
}

module.exports = { DEFAULT_CONFIG, calcularOrganizacion };
