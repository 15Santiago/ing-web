const cursos = [
  { grado: 11, cursos: 4, maximo: 30, cupos: [], manana: 4, tarde: 0 },
  { grado: 10, cursos: 5, maximo: 30, cupos: [], manana: 5, tarde: 0 },
  { grado: 9, cursos: 5, maximo: 28, cupos: [], manana: 2, tarde: 3 },
  { grado: 8, cursos: 6, maximo: 28, cupos: [], manana: 3, tarde: 3 },
  { grado: 7, cursos: 6, maximo: 28, cupos: [], manana: 3, tarde: 3 },
  { grado: 6, cursos: 6, maximo: 30, cupos: [], manana: 3, tarde: 3 },
  { grado: 5, cursos: 9, maximo: 28, cupos: [], manana: 5, tarde: 4 },
  { grado: 4, cursos: 9, maximo: 26, cupos: [], manana: 5, tarde: 4 },
  { grado: 3, cursos: 9, maximo: 30, cupos: [], manana: 5, tarde: 4 },
  { grado: 2, cursos: 10, maximo: 30, cupos: [], manana: 6, tarde: 4 },
  { grado: 1, cursos: 10, maximo: 26, cupos: [], manana: 5, tarde: 5 },
];

const materias = [
  { nombre: 'Matemáticas', grados: '1° a 11°', horas: 5, todos: true },
  { nombre: 'Español', grados: '1° a 11°', horas: 5, todos: true },
  { nombre: 'Ciencias sociales', grados: '1° a 9°', horas: 3, hasta: 9 },
  { nombre: 'Física', grados: 'Desde 9°', horas: 4, desde: 9 },
  { nombre: 'Química', grados: 'Desde 9°', horas: 4, desde: 9 },
  { nombre: 'Biología', grados: 'Desde 1°', horas: 4, desde: 1 },
  { nombre: 'Inglés', grados: '1° a 11°', horas: 3, todos: true },
  { nombre: 'Educación física', grados: '1° a 11°', horas: 2, todos: true },
  { nombre: 'Informática', grados: '1° a 11°', horas: 2, todos: true },
  { nombre: 'Ética', grados: '1° a 11°', horas: 1, todos: true },
  { nombre: 'Filosofía', grados: 'Desde 10°', horas: 3, desde: 10 },
];

const MAX_DOCENTES = 30;
const personal = JSON.parse(localStorage.getItem('colegio-personal') || '[]');

const $ = (selector) => document.querySelector(selector);
const total = (items, property) => items.reduce((sum, item) => sum + item[property], 0);

function gradosAplicables(nombre) {
  const materia = materias.find((item) => item.nombre === nombre);
  if (materia.hasta) return cursos.filter((curso) => curso.grado <= materia.hasta);
  if (materia.desde) return cursos.filter((curso) => curso.grado >= materia.desde);
  return cursos;
}

function aleatorizarCupos() {
  cursos.forEach((curso) => {
    curso.cupos = Array.from({ length: curso.cursos }, () => {
      const minimo = Math.max(1, Math.ceil(curso.maximo * 0.75));
      return Math.floor(Math.random() * (curso.maximo - minimo + 1)) + minimo;
    });
  });
  renderCursos();
}

function renderCursos() {
  $('#tabla-cursos').innerHTML = cursos.map((curso) => `
    <tr>
      <th scope="row"><span class="grade-number">${curso.grado}</span>°</th>
      <td>${curso.cursos}</td>
      <td>${curso.maximo}</td>
      <td><span class="shift shift--morning">${curso.manana}</span></td>
      <td><span class="shift shift--afternoon">${curso.tarde}</span></td>
      <td>${curso.cupos.reduce((sum, cupo) => sum + cupo, 0)} <small class="assigned-note">(${curso.cupos.join(' · ')})</small></td>
    </tr>`).join('');

  const estudiantes = cursos.reduce((sum, curso) => sum + curso.cupos.reduce((subtotal, cupo) => subtotal + cupo, 0), 0);
  $('#total-cursos').textContent = total(cursos, 'cursos');
  $('#total-estudiantes').textContent = estudiantes.toLocaleString('es-CO');
  $('#pie-cursos').textContent = total(cursos, 'cursos');
  $('#pie-manana').textContent = total(cursos, 'manana');
  $('#pie-tarde').textContent = total(cursos, 'tarde');
  $('#pie-estudiantes').textContent = estudiantes.toLocaleString('es-CO');
}

function renderMaterias() {
  $('#lista-materias').innerHTML = materias.map((materia, index) => `
    <label class="subject-row" for="materia-${index}">
      <span><strong>${materia.nombre}</strong><small>${materia.grados}</small></span>
      <span class="hours-input"><input id="materia-${index}" data-materia="${index}" type="number" min="0" max="15" value="${materia.horas}" aria-label="Horas semanales de ${materia.nombre}"><small>h/sem</small></span>
    </label>`).join('');
  document.querySelectorAll('[data-materia]').forEach((input) => input.addEventListener('input', actualizar));
}

function calcular() {
  const capacidad = Math.min(41, Math.max(1, Number($('#capacidad-docente').value) || 41));
  const semanas = Math.max(1, Number($('#semanas-anuales').value) || 40);
  const horasPorJornada = materias.reduce((totales, materia) => {
    const input = document.querySelector(`[data-materia="${materias.indexOf(materia)}"]`);
    const intensidad = Math.max(0, Number(input.value) || 0);
    materia.horas = intensidad;
    const grados = gradosAplicables(materia.nombre);
    return {
      manana: totales.manana + intensidad * total(grados, 'manana'),
      tarde: totales.tarde + intensidad * total(grados, 'tarde'),
    };
  }, { manana: 0, tarde: 0 });
  const horas = horasPorJornada.manana + horasPorJornada.tarde;
  const docentesManana = Math.ceil(horasPorJornada.manana / capacidad);
  const docentesTarde = Math.ceil(horasPorJornada.tarde / capacidad);
  const docentesRequeridos = docentesManana + docentesTarde;
  const docentesMostrados = MAX_DOCENTES;
  const horasContratadas = personal.reduce((sum, docente) => sum + docente.horas, 0);
  const horasPendientes = Math.max(0, horas - horasContratadas);
  const horasAnuales = horas * semanas;
  const horasPorDocente = capacidad * semanas;

  $('#total-horas').textContent = horas.toLocaleString('es-CO');
  $('#docentes-requeridos').textContent = docentesMostrados;
  $('#horas-anuales').textContent = horasAnuales.toLocaleString('es-CO');
  $('#horas-docente-anuales').textContent = horasPorDocente.toLocaleString('es-CO');
  $('#contrataciones').textContent = horasPendientes.toLocaleString('es-CO');
  $('#estado-nomina').textContent = 'límite institucional';
  $('#estado-detallado').className = `payroll-status ${horasPendientes ? 'payroll-status--warning' : 'payroll-status--ok'}`;
  $('#estado-detallado').innerHTML = horasPendientes
    ? `<strong>Revisar contratación.</strong><span>Quedan ${horasPendientes.toLocaleString('es-CO')} horas semanales por cubrir. Hay ${personal.length} personas registradas.</span>`
    : `<strong>La nómina cubre la carga.</strong><span>Las ${personal.length} personas registradas cubren las horas de las dos jornadas.</span>`;

  renderBarras();
  renderReparto(docentesMostrados, capacidad);
  renderResumenPersonal();
  renderPersonal();
  renderHorarios();
}

function renderBarras() {
  const maxHoras = Math.max(...materias.map((materia) => materia.horas), 1);
  $('#barras-materias').innerHTML = materias.map((materia) => {
    const horasTotales = materia.horas * total(gradosAplicables(materia.nombre), 'cursos');
    const porcentaje = (materia.horas / maxHoras) * 100;
    return `<div class="bar-row"><div class="bar-label"><span>${materia.nombre}</span><strong>${horasTotales} h</strong></div><div class="bar-track"><span style="width: ${porcentaje}%"></span></div><small>${materia.horas} h por curso · ${gradosAplicables(materia.nombre).length} grados</small></div>`;
  }).join('');
}

function renderReparto(docentesRequeridos, capacidad) {
  const docentes = Array.from({ length: docentesRequeridos }, (_, index) => ({
    nombre: `Docente ${String(index + 1).padStart(2, '0')}`,
    horas: 0,
    materias: [],
  }));
  let docenteActual = 0;
  let horasSinAsignar = 0;

  materias.forEach((materia) => {
    let pendientes = materia.horas * total(gradosAplicables(materia.nombre), 'cursos');
    while (pendientes > 0 && docenteActual < docentes.length) {
      const docente = docentes[docenteActual];
      const asignadas = Math.min(capacidad - docente.horas, pendientes);
      docente.horas += asignadas;
      pendientes -= asignadas;
      docente.materias.push(`${materia.nombre} · ${asignadas} h`);
      if (docente.horas === capacidad) docenteActual += 1;
    }
    horasSinAsignar += pendientes;
  });

  $('#reparto-docentes').innerHTML = docentes.map((docente) => `
    <article class="teacher-card">
      <div class="teacher-card__top"><strong>${docente.nombre}</strong><span>${docente.horas}/${capacidad} h</span></div>
      <div class="teacher-load"><span style="width: ${(docente.horas / capacidad) * 100}%"></span></div>
      <p>${docente.materias.join(' · ') || 'Sin carga asignada'}</p>
    </article>`).join('') + (horasSinAsignar > 0
      ? `<p class="unassigned-note">${horasSinAsignar} horas semanales quedan sin asignar porque se alcanzó el máximo de ${MAX_DOCENTES} docentes.</p>`
      : '');
}

function actualizar() {
  calcular();
}

function renderMateriaOptions() {
  $('#materia-docente').innerHTML = materias.map((materia) => `<option value="${materia.nombre}">${materia.nombre}</option>`).join('');
}

function actualizarHorasTipo() {
  $('#horas-docente').value = $('#tipo-docente').value === 'Medio tiempo' ? 20.5 : 41;
}

function contratarDocente(evento) {
  evento.preventDefault();
  const feedback = $('#feedback-contratacion');
  if (personal.length >= MAX_DOCENTES) {
    feedback.textContent = 'No se puede agregar más personal: el máximo institucional es de 30 docentes.';
    feedback.className = 'form-feedback form-feedback--error';
    return;
  }

  const nombre = $('#nombre-docente').value.trim();
  const horas = Math.min(41, Math.max(1, Number($('#horas-docente').value) || 0));
  personal.push({
    id: `docente-${Date.now()}`,
    nombre,
    materia: $('#materia-docente').value,
    jornada: $('#jornada-docente').value,
    tipo: $('#tipo-docente').value,
    horas,
  });
  guardarPersonal();
  evento.target.reset();
  actualizarHorasTipo();
  feedback.textContent = `${nombre} fue agregado al personal.`;
  feedback.className = 'form-feedback form-feedback--ok';
  calcular();
}

function eliminarDocente(id) {
  const indice = personal.findIndex((docente) => docente.id === id);
  if (indice !== -1) personal.splice(indice, 1);
  guardarPersonal();
  calcular();
}

function guardarPersonal() {
  localStorage.setItem('colegio-personal', JSON.stringify(personal));
}

function renderResumenPersonal() {
  $('#personal-total').textContent = `${personal.length} / ${MAX_DOCENTES}`;
  $('#personal-completo').textContent = personal.filter((docente) => docente.tipo === 'Completo').length;
  $('#personal-medio').textContent = personal.filter((docente) => docente.tipo === 'Medio tiempo').length;
  $('#personal-horas').textContent = personal.reduce((sum, docente) => sum + docente.horas, 0);
}

function renderPersonal() {
  $('#tabla-personal').innerHTML = personal.length
    ? personal.map((docente) => `
      <tr>
        <th scope="row">${docente.nombre}</th>
        <td>${docente.materia}</td>
        <td><span class="shift shift--${docente.jornada === 'Manana' ? 'morning' : 'afternoon'}">${docente.jornada === 'Manana' ? 'Mañana' : 'Tarde'}</span></td>
        <td>${docente.tipo}</td>
        <td>${docente.horas} h</td>
        <td><button class="remove-button" type="button" data-remove-docente="${docente.id}">Retirar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-cell">No hay docentes registrados.</td></tr>';
  document.querySelectorAll('[data-remove-docente]').forEach((button) => {
    button.addEventListener('click', () => eliminarDocente(button.dataset.removeDocente));
  });
}

function renderHorarios() {
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
  $('#tabla-horarios').innerHTML = personal.length
    ? personal.map((docente) => {
      const horasDiarias = docente.horas / 5;
      const celdas = dias.map((dia) => `<td><strong>${docente.materia}</strong><small>${dia} · ${horasDiarias} h</small></td>`).join('');
      return `<tr><th scope="row">${docente.nombre}</th><td>${docente.jornada === 'Manana' ? '7:00–12:00' : '13:00–18:00'}</td>${celdas}</tr>`;
    }).join('')
    : '<tr><td colspan="7" class="empty-cell">No hay horarios para mostrar.</td></tr>';
}

renderCursos();
renderMaterias();
renderMateriaOptions();
aleatorizarCupos();
$('#aleatorizar-cupos').addEventListener('click', aleatorizarCupos);
['capacidad-docente', 'semanas-anuales'].forEach((id) => $(`#${id}`).addEventListener('input', actualizar));
$('#form-contratacion').addEventListener('submit', contratarDocente);
$('#tipo-docente').addEventListener('change', actualizarHorasTipo);
calcular();
