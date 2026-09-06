const API_BASE = window.location.port === '3000'
  ? '/api'
  : 'http://localhost:3000/api';

const $ = (selector) => document.querySelector(selector);

const views = {
  cursos: { section: 'titulo-configuracion', title: 'Gestión de cursos' },
  profesores: { section: 'titulo-personal', title: 'Gestión de profesores' },
  horarios: { section: 'titulo-horarios', title: 'Gestión de horarios' },
};

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

const weekDays = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const dayLabels = { Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes' };
const weeklyShifts = [
  {
    name: 'Mañana',
    range: '07:00 - 12:00',
    slots: [
      ['07:00:00', '07:45:00'], ['07:45:00', '08:30:00'], ['08:30:00', '09:15:00'],
      ['break', '09:15 - 09:45'], ['09:45:00', '10:30:00'],
      ['10:30:00', '11:15:00'], ['11:15:00', '12:00:00'],
    ],
  },
  {
    name: 'Tarde',
    range: '13:00 - 18:00',
    slots: [
      ['13:00:00', '13:45:00'], ['13:45:00', '14:30:00'], ['14:30:00', '15:15:00'],
      ['break', '15:15 - 15:45'], ['15:45:00', '16:30:00'],
      ['16:30:00', '17:15:00'], ['17:15:00', '18:00:00'],
    ],
  },
];

function secondsFromTime(value) {
  if (typeof value === 'number') return value;
  const parts = String(value).split(':').map(Number);
  return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
}

function timeLabel(value) {
  return String(value).slice(0, 5);
}

function scheduleCell(items) {
  if (!items.length) return '<span class="schedule-empty">—</span>';
  return items.map((item) => `<div class="schedule-entry"><strong>${item.materia}</strong><span>${item.grado}°${item.seccion}</span><small>${item.docente_nombre || 'Vacante'}</small></div>`).join('');
}

function renderWeeklyCalendar(schedules) {
  const calendar = $('#calendario-horarios');
  calendar.innerHTML = weeklyShifts.map((shift) => {
    const rows = shift.slots.map(([start, label]) => {
      if (start === 'break') {
        return `<tr class="schedule-break"><th scope="row">${label}</th><td colspan="5">Descanso</td></tr>`;
      }
      const startSeconds = secondsFromTime(start);
      const cells = weekDays.map((day) => {
        const items = schedules.filter((item) => item.dia === day && secondsFromTime(item.hora_inicio) === startSeconds);
        return `<td>${scheduleCell(items)}</td>`;
      }).join('');
      return `<tr><th scope="row">${timeLabel(start)}<span>${timeLabel(label)}</span></th>${cells}</tr>`;
    }).join('');
    return `<section class="weekly-schedule" aria-labelledby="jornada-${shift.name.toLowerCase()}"><div class="weekly-schedule__heading"><div><h3 id="jornada-${shift.name.toLowerCase()}">${shift.name}</h3><p>${shift.range} · 5 horas · un descanso de 30 minutos</p></div></div><div class="table-scroll"><table class="schedule-calendar"><thead><tr><th scope="col">Hora</th>${weekDays.map((day) => `<th scope="col">${dayLabels[day]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
}

function renderScheduleMessage(message) {
  $('#mensaje-filtro-horario').textContent = message;
  $('#calendario-horarios').innerHTML = '';
}

function fillScheduleFilters(courses, teachers) {
  const courseFilter = $('#filtro-curso');
  const teacherFilter = $('#filtro-profesor');
  if (courseFilter.options.length === 1) {
    courses.forEach((course) => courseFilter.add(new Option(`${course.grado}°${course.seccion} · ${course.jornada}`, course.id)));
    teachers.forEach((teacher) => teacherFilter.add(new Option(teacher.nombre, teacher.id)));
  }
}

function activeView() {
  const hash = window.location.hash.slice(1);
  return hash === 'titulo-personal' ? 'profesores' : hash === 'titulo-horarios' ? 'horarios' : 'cursos';
}

function selectView() {
  const view = activeView();
  document.querySelectorAll('.gestion-view').forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  document.title = views[view].title;
  return view;
}

async function loadView() {
  const view = selectView();
  if (view === 'cursos') {
    const courses = await api('/cursos');
    renderRows('#tabla-cursos', courses.map((course) => `<tr><th scope="row">${course.grado}°${course.seccion}</th><td>${course.jornada}</td><td>${course.cupo_maximo}</td><td>${course.estudiantes}</td></tr>`), 'No hay cursos registrados.', 4);
  }
  if (view === 'profesores') {
    const teachers = await api('/docentes');
    renderRows('#tabla-docentes', teachers.map((teacher) => `<tr><th scope="row">${teacher.id}</th><td>${teacher.nombre}</td><td>${teacher.area_nombre || 'Sin área'}</td><td>${teacher.horas_asignadas}</td><td>${teacher.activo ? 'Activo' : 'Inactivo'}</td></tr>`), 'No hay profesores registrados.', 5);
  }
  if (view === 'horarios') {
    const [courses, teachers] = await Promise.all([api('/cursos'), api('/docentes')]);
    fillScheduleFilters(courses, teachers);
    const courseId = $('#filtro-curso').value;
    const teacherId = $('#filtro-profesor').value;
    if (!courseId && !teacherId) {
      renderScheduleMessage('Selecciona un curso o un profesor para ver su horario semanal.');
      return;
    }
    const query = courseId ? `?cursoId=${encodeURIComponent(courseId)}` : `?docenteId=${encodeURIComponent(teacherId)}`;
    const schedules = await api(`/horarios${query}`);
    $('#mensaje-filtro-horario').textContent = schedules.length ? '' : 'No hay bloques para el filtro seleccionado.';
    renderWeeklyCalendar(schedules);
  }
}

async function refresh() {
  try {
    await loadView();
  } catch (error) {
    console.error('No se pudieron cargar los datos académicos:', error);
  }
}

$('#btn-refrescar').addEventListener('click', refresh);
window.addEventListener('hashchange', refresh);
$('#filtro-curso').addEventListener('change', (event) => {
  if (event.target.value) $('#filtro-profesor').value = '';
  refresh();
});
$('#filtro-profesor').addEventListener('change', (event) => {
  if (event.target.value) $('#filtro-curso').value = '';
  refresh();
});
refresh();
