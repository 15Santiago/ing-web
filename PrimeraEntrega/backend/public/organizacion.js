const PLANIFICAR_URL = '/api/organizacion/planificar';
const resultados = document.getElementById('resultados');
const mensaje = document.getElementById('mensaje');

function numero(id) {
  return Number(document.getElementById(id).value);
}

function mostrarMensaje(texto, error = false) {
  mensaje.textContent = texto;
  mensaje.className = error ? 'message message--error' : 'message';
}

function renderResumen(plan) {
  const { resumen } = plan;
  const tarjetas = [
    ['Cursos', resumen.totalCursos, 'grupos activos'],
    ['Estudiantes', resumen.estudiantes.toLocaleString('es-CO'), 'matriculados'],
    ['Horas semanales', resumen.horasSemanalesTotales, 'de todas las materias'],
    ['Docentes requeridos', resumen.docentesRequeridos, resumen.docentesFaltantes ? `faltan ${resumen.docentesFaltantes}; no se contrata` : 'nómina suficiente'],
    ['Horas pendientes', resumen.horasPendientes, 'no cubiertas con 30 docentes'],
  ];
  document.getElementById('tarjetas-resumen').innerHTML = tarjetas.map(([titulo, valor, detalle]) => `<article class="summary-card"><span>${titulo}</span><strong>${valor}</strong><small>${detalle}</small></article>`).join('');

  document.getElementById('jornadas').innerHTML = Object.entries(resumen.turnos).map(([jornada, datos]) => `<article class="shift-card"><span>${jornada === 'manana' ? 'Mañana' : 'Tarde'}</span><strong>${datos.cursos} cursos</strong><small>${datos.estudiantes.toLocaleString('es-CO')} estudiantes</small></article>`).join('');
}

function renderMaterias(materias) {
  document.getElementById('tabla-materias').innerHTML = materias.map((materia) => `<tr><td>${materia.nombre}</td><td><b class="intensity intensity--${materia.intensidad === '+' ? 'high' : 'low'}">${materia.intensidad}</b></td><td>${materia.cursosAtendidos}</td><td>${materia.horasSemanales}</td><td>${materia.horasAnuales}</td><td>${materia.docentesRequeridos}</td></tr>`).join('');
}

function renderCursos(cursos) {
  document.getElementById('tabla-cursos').innerHTML = cursos.sort((a, b) => b.grado - a.grado).map((curso) => `<tr><td><strong>${curso.grado}°</strong></td><td>${curso.total}</td><td>${curso.manana}</td><td>${curso.tarde}</td><td>${curso.estudiantes}</td><td>${curso.inferido ? 'Configurado por distribución indicada' : 'Dato suministrado'}</td></tr>`).join('');
}

function renderDocentes(docentes) {
  document.getElementById('tabla-docentes').innerHTML = docentes.map((docente) => {
    const detalle = docente.asignaciones.map((asignacion) => `${asignacion.materia} ${asignacion.grado}-${asignacion.curso} (${asignacion.jornada})`).join(', ');
    return `<tr><td><strong>${docente.nombre}</strong></td><td>${docente.horasAsignadas} h</td><td>${docente.horasExtraSemanales} h / semana</td><td>${docente.horasLibres} h</td><td>${docente.horasPendientes} h</td><td>${detalle || 'Sin asignación'}</td></tr>`;
  }).join('');
}

async function generarPlan() {
  const boton = document.getElementById('btn-planificar');
  boton.disabled = true;
  mostrarMensaje('Calculando distribución...');
  try {
    const respuesta = await fetch(PLANIFICAR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docentesDisponibles: numero('docentes'), horasTrabajoDocenteSemana: numero('horas-docente'), semanasAnioLectivo: numero('semanas'), horasExtraMesMax: numero('horas-extra-mes') }) });
    if (!respuesta.ok) throw new Error('La API no pudo generar la organización.');
    const plan = await respuesta.json();
    renderResumen(plan);
    renderMaterias(plan.materias);
    renderCursos(plan.cursos);
    renderDocentes(plan.docentes);
    document.getElementById('reglas').innerHTML = plan.reglas.map((regla) => `<li>${regla}</li>`).join('');
    resultados.hidden = false;
    mostrarMensaje('Organización generada correctamente.');
  } catch (error) {
    mostrarMensaje(error.message, true);
  } finally {
    boton.disabled = false;
  }
}

document.getElementById('btn-planificar').addEventListener('click', generarPlan);
generarPlan();
