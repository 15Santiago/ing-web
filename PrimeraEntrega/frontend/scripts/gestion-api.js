const API_BASE = window.location.port === '3000'
  ? '/api'
  : 'http://localhost:3000/api';

const $ = (selector) => document.querySelector(selector);

async function api(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.mensaje || 'No se pudo consultar la API.');
  return data;
}

function renderRows(selector, rows, emptyMessage, columns) {
  const body = $(selector);
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="${columns}" class="section-note">${emptyMessage}</td></tr>`;
    return;
  }
  body.innerHTML = rows.join('');
}

async function loadDashboard() {
  const [dashboard, courses, teachers, schedules, subjects] = await Promise.all([
    api('/dashboard'), api('/cursos'), api('/docentes'), api('/horarios'), api('/materias'),
  ]);

  $('#total-cursos').textContent = dashboard.totalCursos;
  $('#total-estudiantes').textContent = dashboard.totalEstudiantes;
  $('#total-docentes').textContent = dashboard.docentesActivos;
  $('#total-vacantes').textContent = dashboard.bloquesVacantes;

  renderRows('#tabla-cursos', courses.map((course) => `<tr><th scope="row">${course.grado}°${course.seccion}</th><td>${course.jornada}</td><td>${course.cupo_maximo}</td><td>${course.estudiantes}</td></tr>`), 'No hay cursos registrados.', 4);
  renderRows('#tabla-docentes', teachers.map((teacher) => `<tr><th scope="row">${teacher.id}</th><td>${teacher.nombre}</td><td>${teacher.area_nombre || 'Sin área'}</td><td>${teacher.horas_asignadas}</td><td>${teacher.activo ? 'Activo' : 'Inactivo'}</td></tr>`), 'No hay profesores registrados.', 5);
  renderRows('#tabla-horarios', schedules.map((schedule) => `<tr><th scope="row">${schedule.grado}°${schedule.seccion}</th><td>${schedule.materia}</td><td>${schedule.dia}</td><td>${schedule.hora_inicio} - ${schedule.hora_fin}</td><td>${schedule.docente_nombre || 'Vacante'}</td></tr>`), 'No hay horarios registrados.', 5);
  renderRows('#tabla-materias', subjects.map((subject) => `<tr><th scope="row">${subject.nombre}</th><td>${subject.area_nombre || 'Sin área'}</td><td>${subject.intensidadPorNivel.length}</td></tr>`), 'No hay materias registradas.', 3);
}

async function refresh() {
  $('#estado-api').textContent = 'Consultando la API...';
  try {
    await loadDashboard();
    $('#estado-api').textContent = 'API conectada';
  } catch (error) {
    $('#estado-api').textContent = error.message;
  }
}

$('#btn-refrescar').addEventListener('click', refresh);
refresh();
