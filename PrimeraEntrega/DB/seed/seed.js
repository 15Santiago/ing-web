// =========================================================
// Seed de la programación académica real del colegio.
// Lee los CSV extraídos de Horario_Colegio.xlsx (DB/seed/data) y
// carga areas, materias, plan_materias, cursos, docentes y
// horarios en MySQL. Es idempotente: vacía las tablas antes de
// insertar, así que se puede correr varias veces sin duplicar.
//
// Uso (desde PrimeraEntrega/backend):  npm run seed
// =========================================================
const fs = require('fs');
const path = require('path');
const { pool } = require('../../backend/config/db');

const DATA_DIR = path.join(__dirname, 'data');

const AREAS = [
  { codigo: 'MAT-FIS', nombre: 'Matemáticas y Física' },
  { codigo: 'ESP-ING', nombre: 'Español e Inglés' },
  { codigo: 'CIENCIAS', nombre: 'Ciencias Naturales (Biología / Química)' },
  { codigo: 'EDF-ETICA', nombre: 'Educación Física y Ética' },
  { codigo: 'FLEX', nombre: 'Informática, Sociales, Filosofía y Artística' },
];

const DIAS_SIN_TILDE = {
  Lunes: 'Lunes',
  Martes: 'Martes',
  Miércoles: 'Miercoles',
  Jueves: 'Jueves',
  Viernes: 'Viernes',
};

const JORNADA_SIN_TILDE = {
  Mañana: 'Manana',
  Tarde: 'Tarde',
};

// ---------------------------------------------------------
// Parser de CSV simple: cada fila viene con TODOS los campos
// entre comillas y separados por comas, sin comillas ni comas
// escapadas dentro de un campo (así se generó el archivo).
// ---------------------------------------------------------
function leerCsv(nombreArchivo) {
  const contenido = fs.readFileSync(path.join(DATA_DIR, nombreArchivo), 'utf8');
  const lineas = contenido.split(/\r?\n/).filter((l) => l.length > 0);
  const encabezado = parsearFila(lineas[0]);
  return lineas.slice(1).map((linea) => {
    const valores = parsearFila(linea);
    const fila = {};
    encabezado.forEach((clave, indice) => { fila[clave] = valores[indice]; });
    return fila;
  });
}

function parsearFila(linea) {
  return linea
    .slice(1, -1) // quita la comilla inicial y final de toda la línea
    .split('","');
}

function normalizarHora(horaTexto) {
  const [inicio, fin] = horaTexto.split('–'); // en-dash, no guion normal
  return [normalizarHHMM(inicio), normalizarHHMM(fin)];
}

function normalizarHHMM(hhmm) {
  const [h, m] = hhmm.split(':');
  return `${h.padStart(2, '0')}:${m}:00`;
}

function estudiantesAleatorios(cupoMaximo) {
  const minimo = Math.max(1, Math.round(cupoMaximo * 0.75));
  return Math.floor(Math.random() * (cupoMaximo - minimo + 1)) + minimo;
}

async function seed() {
  const cursosCsv = leerCsv('cursos.csv');
  const docentesCsv = leerCsv('docentes.csv');
  const planMateriasCsv = leerCsv('plan_materias.csv');
  const horariosCsv = leerCsv('horarios.csv');

  // Materias únicas + a qué área pertenecen, tomado de la columna
  // "Responsable" del plan de materias. Todas las filas del plan
  // consumen horas docente: ya no hay bloques de "trabajo autónomo"
  // (biblioteca) sin profesor asignado por diseño.
  const materiasMapa = new Map(); // nombre -> { areaCodigo }
  planMateriasCsv.forEach((fila) => {
    const nombre = fila.Materia;
    if (!materiasMapa.has(nombre)) {
      materiasMapa.set(nombre, { areaCodigo: fila.Responsable });
    }
  });

  // Nota: TRUNCATE hace COMMIT implícito en MySQL, así que este
  // bloque no es una transacción real; si algo falla a mitad de
  // camino, hay que volver a correr el seed completo.
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    await conexion.query('TRUNCATE TABLE horarios');
    await conexion.query('TRUNCATE TABLE docentes');
    await conexion.query('TRUNCATE TABLE cursos');
    await conexion.query('TRUNCATE TABLE plan_materias');
    await conexion.query('TRUNCATE TABLE materias');
    await conexion.query('TRUNCATE TABLE areas');
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');

    // ---- areas ----
    const areaIdPorCodigo = new Map();
    for (const area of AREAS) {
      const [resultado] = await conexion.query('INSERT INTO areas (codigo, nombre) VALUES (?, ?)', [area.codigo, area.nombre]);
      areaIdPorCodigo.set(area.codigo, resultado.insertId);
    }

    // ---- materias ----
    const materiaIdPorNombre = new Map();
    for (const [nombre, info] of materiasMapa.entries()) {
      const areaId = areaIdPorCodigo.get(info.areaCodigo) || null;
      const [resultado] = await conexion.query(
        'INSERT INTO materias (nombre, area_id) VALUES (?, ?)',
        [nombre, areaId]
      );
      materiaIdPorNombre.set(nombre, resultado.insertId);
    }

    // ---- plan_materias ----
    const RANGOS_NIVEL = {
      'Primaria (1°-5°)': [1, 5],
      'Bachillerato (6°-10°)': [6, 10],
      'Grado 11°': [11, 11],
    };
    const filasPlan = planMateriasCsv.map((fila) => {
      const [gradoMin, gradoMax] = RANGOS_NIVEL[fila.Nivel] || [1, 11];
      return [fila.Nivel, gradoMin, gradoMax, materiaIdPorNombre.get(fila.Materia), Number(fila.Bloques_semana), Number(fila.Horas_semana)];
    });
    await conexion.query(
      'INSERT INTO plan_materias (nivel, grado_min, grado_max, materia_id, bloques_semana, horas_semana) VALUES ?',
      [filasPlan]
    );

    // ---- cursos (se conserva el Curso_ID original; todas las
    // secciones nacen activas, "aleatorizar-estudiantes" abre/cierra
    // según la matrícula) ----
    const filasCursos = cursosCsv.map((fila) => {
      const jornadaTexto = fila.Jornada.split(' ')[0];
      const cupoMaximo = Number(fila['Máx. estudiantes']);
      return [
        Number(fila.Curso_ID),
        Number(fila.Grado),
        fila['Sección'],
        JORNADA_SIN_TILDE[jornadaTexto] || jornadaTexto,
        cupoMaximo,
        estudiantesAleatorios(cupoMaximo),
        true,
      ];
    });
    await conexion.query(
      'INSERT INTO cursos (id, grado, seccion, jornada, cupo_maximo, estudiantes, activo) VALUES ?',
      [filasCursos]
    );

    // ---- docentes (se conserva el Docente_ID original, ej. MAT-FIS-01) ----
    const filasDocentes = docentesCsv.map((fila) => {
      const codigoArea = fila.Docente_ID.replace(/-\d+$/, '');
      return [fila.Docente_ID, fila.Nombre, areaIdPorCodigo.get(codigoArea) || null, Number(fila.Horas_contratadas)];
    });
    await conexion.query(
      'INSERT INTO docentes (id, nombre, area_id, horas_contratadas) VALUES ?',
      [filasDocentes]
    );

    // ---- horarios docentes (bloques reales de 45 min; Docente_ID
    // vacío = bloque vacante, aún sin cubrir con un docente) ----
    const filasHorarios = horariosCsv.map((fila) => {
      const materiaId = materiaIdPorNombre.get(fila.Materia);
      if (!materiaId) {
        throw new Error(`Materia desconocida "${fila.Materia}" en horarios.csv (curso ${fila.Curso_ID}). Revisa que exista en plan_materias.csv.`);
      }
      const [horaInicio, horaFin] = normalizarHora(fila.Hora);
      return [
        Number(fila.Curso_ID),
        materiaId,
        fila.Docente_ID || null,
        DIAS_SIN_TILDE[fila['Día']] || fila['Día'],
        horaInicio,
        horaFin,
      ];
    });
    await conexion.query(
      'INSERT INTO horarios (curso_id, materia_id, docente_id, dia, hora_inicio, hora_fin) VALUES ?',
      [filasHorarios]
    );

    const vacantes = filasHorarios.filter((fila) => fila[2] === null).length;
    console.log(`✅ Seed completo: ${AREAS.length} áreas, ${materiaIdPorNombre.size} materias, ${filasCursos.length} cursos, ${filasDocentes.length} docentes, ${filasHorarios.length} bloques de horario (${vacantes} vacantes).`);
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exitCode = 1;
  } finally {
    conexion.release();
    await pool.end();
  }
}

seed();
