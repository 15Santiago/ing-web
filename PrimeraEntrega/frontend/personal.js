// =========================================================
// Personal docente y horarios — front end (vanilla JS)
// Consume la API real (/api/docentes, /api/cursos, /api/horarios,
// /api/materias, /api/areas, /api/dashboard), respaldada por MySQL.
// =========================================================
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const DIAS_ETIQUETA = { Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes' };
const MATERIAS_ETIQUETA = {
  Espanol: 'Español',
  Matematicas: 'Matemáticas',
  Ingles: 'Inglés',
  'Educacion Fisica': 'Educación Física',
  Etica: 'Ética',
  Informatica: 'Informática',
  'Ciencias Sociales': 'Ciencias Sociales',
  'Ciencias Naturales': 'Ciencias Naturales',
  Filosofia: 'Filosofía',
  Fisica: 'Física',
  Quimica: 'Química',
  Biologia: 'Biología',
  Artistica: 'Artística',
  'Proyecto de vida': 'Proyecto de vida',
};

let areasCache = [];
let docentesCache = [];
let cursosCache = [];

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(cuerpo.mensaje || `Error ${respuesta.status}`);
  }
  return cuerpo;
}

function horaCorta(hora) {
  return hora ? hora.slice(0, 5) : '';
}

// ---------------------------------------------------------
// 01 · Dashboard
// ---------------------------------------------------------
async function cargarDashboard() {
  try {
    const d = await api('/api/dashboard');
    const tarjetas = [
      ['Cursos activos', `${d.cursosActivos} / ${d.totalCursos}`, `${d.totalEstudiantes} estudiantes`],
      ['Docentes activos', d.docentesActivos, `${d.docentesInactivos} inactivos`],
      ['Horas semanales', Math.round(d.horasSemanalesTotales * 100) / 100, 'de clase dictadas'],
      ['Bloques de horario', d.totalBloques, `${d.bloquesVacantes} vacantes`],
      ['Conflictos', d.conflictos, d.conflictos ? 'requieren revisión' : 'sin choques de horario'],
      ['Jornadas', d.porJornada.map((j) => `${j.jornada === 'Manana' ? 'Mañana' : 'Tarde'}: ${j.cursos}`).join(' · '), 'cursos activos por jornada'],
    ];
    document.getElementById('tarjetas-dashboard').innerHTML = tarjetas.map(([titulo, valor, detalle]) => `
      <article class="summary-card ${titulo === 'Conflictos' && d.conflictos ? 'summary-card--alert' : ''}">
        <span>${titulo}</span><strong>${valor}</strong><small>${detalle}</small>
      </article>`).join('');
    renderNecesidad(d.necesidadDocentes);
  } catch (error) {
    console.error(error);
  }
}

// ---------------------------------------------------------
// Docentes necesarios vs. docentes activos hoy, calculado en el
// servidor contra los cursos activos reales (services/necesidad
// DocentesService.js), no una simulación aparte.
// ---------------------------------------------------------
function renderNecesidad(n) {
  const panel = document.getElementById('resumen-necesidad');
  if (!n) { panel.hidden = true; return; }
  panel.hidden = false;
  const diferencia = n.docentesActivos - n.docentesNecesarios;
  let accion = 'La nómina activa coincide con lo que hace falta.';
  if (diferencia > 0) accion = `Sobran ${diferencia} docente(s): selecciónalos abajo y usa "Despedir seleccionados".`;
  else if (diferencia < 0) accion = `Faltan ${-diferencia} docente(s): reactiva alguno inactivo o contrata uno nuevo.`;
  panel.innerHTML = `
    <h3>Docentes necesarios: ${n.docentesNecesarios} de ${n.docentesDisponibles} máximo</h3>
    <p>Con ${n.cursosActivos} de ${n.cursosTotales} cursos activos (${n.estudiantesActivos} estudiantes matriculados) hacen falta <strong>${n.docentesNecesarios}</strong> docentes. Hoy hay <strong>${n.docentesActivos}</strong> activos. ${accion}</p>`;
}

// ---------------------------------------------------------
// 02 · Cursos
// ---------------------------------------------------------
async function cargarCursos() {
  const jornada = document.getElementById('filtro-jornada').value;
  cursosCache = await api('/api/cursos');
  const cursosVisibles = jornada ? cursosCache.filter((curso) => curso.jornada === jornada) : cursosCache;
  llenarSelectorCursosResumen(cursosVisibles);
  llenarSelectorCursosHorario(cursosCache);
  renderResumenCurso(cursosVisibles[0]?.id);
}

function etiquetaCurso(curso) {
  return `${curso.grado}°${curso.seccion} · ${curso.jornada === 'Manana' ? 'Mañana' : 'Tarde'}${curso.activo ? '' : ' (cerrado)'}`;
}

function llenarSelectorCursosResumen(cursos) {
  const selector = document.getElementById('selector-curso-resumen');
  const valorPrevio = selector.value;
  selector.innerHTML = cursos.length
    ? cursos.map((curso) => `<option value="${curso.id}">${etiquetaCurso(curso)}</option>`).join('')
    : '<option value="">No hay cursos para esta jornada</option>';
  if (cursos.some((curso) => String(curso.id) === valorPrevio)) selector.value = valorPrevio;
}

function renderResumenCurso(cursoId) {
  const curso = cursosCache.find((item) => String(item.id) === String(cursoId));
  const resumen = document.getElementById('resumen-curso-seleccionado');
  if (!curso) {
    resumen.innerHTML = '<p class="empty-note">No hay cursos disponibles para esta jornada.</p>';
    return;
  }
  resumen.innerHTML = `
    <div class="course-summary__identity"><span class="section-number">Curso seleccionado</span><strong>${curso.grado}°${curso.seccion}</strong><span>${curso.jornada === 'Manana' ? 'Mañana' : 'Tarde'}${curso.activo ? '' : ' · <span class="badge badge--inactivo">Cerrado</span>'}</span></div>
    <dl class="course-summary__facts"><div><dt>Cupo máximo</dt><dd>${curso.cupo_maximo}</dd></div><div><dt>Estudiantes</dt><dd><input id="estudiantes-curso" type="number" min="0" max="${curso.cupo_maximo}" value="${curso.estudiantes}" ${curso.activo ? '' : 'disabled title="Reabre la sección con \'Aleatorizar estudiantes\' o edítala manualmente"'}></dd></div></dl>
    <button class="btn btn--small" id="btn-ver-curso-resumen" type="button">Ver horario</button>`;
  document.getElementById('btn-ver-curso-resumen').addEventListener('click', () => mostrarHorarioCurso(curso.id));
  const inputEstudiantes = document.getElementById('estudiantes-curso');
  if (curso.activo) inputEstudiantes.addEventListener('change', () => actualizarEstudiantesCurso(curso));
}

async function actualizarEstudiantesCurso(curso) {
  const input = document.getElementById('estudiantes-curso');
  const valor = Math.min(Math.max(Number(input.value) || 0, 0), curso.cupo_maximo);
  input.value = valor;
  try {
    await api(`/api/cursos/${curso.id}`, {
      method: 'PUT',
      body: JSON.stringify({ grado: curso.grado, seccion: curso.seccion, jornada: curso.jornada, cupoMaximo: curso.cupo_maximo, estudiantes: valor }),
    });
    curso.estudiantes = valor;
    cargarDashboard();
  } catch (error) {
    alert(error.message);
    cargarCursos();
  }
}

async function mostrarHorarioCurso(cursoId) {
  document.getElementById('selector-curso-horario').value = cursoId;
  document.getElementById('dialogo-horario').showModal();
  await renderHorarioCurso(cursoId);
}

async function renderHorarioCurso(cursoId) {
  if (!cursoId) return;
  const curso = await api(`/api/cursos/${cursoId}`);
  document.getElementById('resumen-horario-curso').textContent =
    `${curso.grado}°${curso.seccion} · ${curso.jornada === 'Manana' ? 'Mañana' : 'Tarde'} · ${curso.estudiantes} estudiantes`;

  const bloquesPorHora = new Map();
  curso.horario.forEach((bloque) => {
    const clave = `${bloque.hora_inicio}-${bloque.hora_fin}`;
    if (!bloquesPorHora.has(clave)) {
      bloquesPorHora.set(clave, { horaInicio: bloque.hora_inicio, horaFin: bloque.hora_fin, porDia: {} });
    }
    bloquesPorHora.get(clave).porDia[bloque.dia] = bloque;
  });
  const filas = Array.from(bloquesPorHora.values()).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const grid = document.getElementById('grid-horario-curso');
  grid.innerHTML = filas.length ? `
    <thead><tr><th>Hora</th>${DIAS.map((dia) => `<th>${DIAS_ETIQUETA[dia]}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((fila) => `<tr>
      <td><strong>${horaCorta(fila.horaInicio)}–${horaCorta(fila.horaFin)}</strong></td>
      ${DIAS.map((dia) => {
        const bloque = fila.porDia[dia];
        if (!bloque) return '<td class="empty">—</td>';
        const detalle = `Clase · ${bloque.docente_nombre || 'Docente vacante'}`;
        return `<td><div class="schedule-cell"><strong>${MATERIAS_ETIQUETA[bloque.materia] || bloque.materia}</strong><small>${detalle}</small></div></td>`;
      }).join('')}
    </tr>`).join('')}</tbody>` : '<tbody><tr><td colspan="6" class="empty-note">Este curso no tiene bloques de horario registrados.</td></tr></tbody>';
}

function llenarSelectorCursosHorario(cursos) {
  const selector = document.getElementById('selector-curso-horario');
  const valorPrevio = selector.value;
  selector.innerHTML = cursos.length
    ? cursos.map((curso) => `<option value="${curso.id}">${etiquetaCurso(curso)}</option>`).join('')
    : '<option value="">No hay cursos para esta jornada</option>';
  if (cursos.some((curso) => String(curso.id) === valorPrevio)) selector.value = valorPrevio;
}

async function aleatorizarEstudiantes() {
  const boton = document.getElementById('btn-aleatorizar');
  boton.disabled = true;
  try {
    const resultado = await api('/api/cursos/aleatorizar-estudiantes', { method: 'POST', body: JSON.stringify({}) });
    renderNecesidad(resultado.necesidadDocentes);
    await cargarCursos();
    await cargarDashboard();
    await cargarVacantes();
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
  }
}

// ---------------------------------------------------------
// 03 · Docentes
// ---------------------------------------------------------
async function cargarDocentes() {
  const estado = document.getElementById('filtro-estado').value;
  const query = estado ? `?activo=${estado}` : '';
  docentesCache = await api(`/api/docentes${query}`);
  document.getElementById('tabla-docentes').innerHTML = docentesCache.map((d) => `
    <tr>
      <td class="checkbox-cell">${d.activo ? `<input type="checkbox" class="check-docente" value="${d.id}">` : ''}</td>
      <td><strong>${d.nombre}</strong><br><small>${d.id}</small></td>
      <td>${d.area_nombre || '—'}</td>
      <td>${Math.round(d.horas_asignadas * 100) / 100} h</td>
      <td>${d.horas_contratadas} h</td>
      <td><span class="badge ${d.activo ? 'badge--activo' : 'badge--inactivo'}">${d.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn btn--small" data-ver-docente="${d.id}" type="button">Ver horario</button>
        ${d.activo ? '' : `<button class="btn btn--small btn--primary" data-activar-docente="${d.id}" type="button">Reactivar</button>`}
      </td>
    </tr>`).join('');

  document.querySelectorAll('[data-ver-docente]').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.getElementById('selector-docente').value = boton.dataset.verDocente;
      cargarHorarioDocente(boton.dataset.verDocente);
      document.getElementById('titulo-horario-docente').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.querySelectorAll('[data-activar-docente]').forEach((boton) => {
    boton.addEventListener('click', () => activarDocente(boton.dataset.activarDocente));
  });

  document.querySelectorAll('.check-docente').forEach((casilla) => {
    casilla.addEventListener('change', actualizarBotonDespedir);
  });
  document.getElementById('check-todos').checked = false;
  actualizarBotonDespedir();
  llenarSelectorDocentes();
  llenarSelectDocentesVacantes();
}

function actualizarBotonDespedir() {
  const seleccionados = document.querySelectorAll('.check-docente:checked').length;
  const boton = document.getElementById('btn-despedir');
  boton.disabled = seleccionados === 0;
  boton.textContent = seleccionados > 0 ? `Despedir seleccionados (${seleccionados})` : 'Despedir seleccionados';
}

async function despedirSeleccionados() {
  const ids = Array.from(document.querySelectorAll('.check-docente:checked')).map((c) => c.value);
  if (ids.length === 0) return;
  if (!confirm(`¿Despedir a ${ids.length} docente(s)? Sus clases quedarán vacantes.`)) return;

  try {
    const resultado = await api('/api/docentes/despedir', { method: 'POST', body: JSON.stringify({ ids }) });
    mostrarImpacto(resultado);
    cargarDocentes();
    cargarDashboard();
    cargarVacantes();
  } catch (error) {
    alert(error.message);
  }
}

async function activarDocente(id) {
  try {
    await api(`/api/docentes/${id}/activar`, { method: 'POST' });
    cargarDocentes();
    cargarDashboard();
  } catch (error) {
    alert(error.message);
  }
}

function mostrarImpacto(resultado) {
  const panel = document.getElementById('panel-impacto');
  panel.hidden = false;
  const nombres = resultado.docentesDespedidos.map((d) => d.nombre).join(', ');
  document.getElementById('resumen-impacto').textContent = `Se despidió a ${nombres}. Quedaron ${resultado.totalBloquesAfectados} bloques de horario vacantes en ${resultado.cursosAfectados.length} curso(s).`;
  document.getElementById('lista-impacto').innerHTML = resultado.cursosAfectados.map((curso) => `
    <article class="impact-card">
      <h3>${curso.curso} — ${curso.jornada === 'Manana' ? 'Mañana' : 'Tarde'} · ${curso.estudiantes} estudiantes</h3>
      <ul>${curso.bloquesVacantes.map((b) => `<li>${DIAS_ETIQUETA[b.dia]} ${horaCorta(b.horaInicio)}–${horaCorta(b.horaFin)} · ${b.materia}</li>`).join('')}</ul>
    </article>`).join('');
}

async function llenarAreas() {
  areasCache = await api('/api/areas');
  document.getElementById('area-docente').innerHTML = areasCache.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join('');
}

async function contratarDocente(evento) {
  evento.preventDefault();
  const feedback = document.getElementById('feedback-contratacion');
  try {
    const nombre = document.getElementById('nombre-docente').value.trim();
    const areaId = Number(document.getElementById('area-docente').value);
    const horasContratadas = Number(document.getElementById('horas-docente').value);
    const creado = await api('/api/docentes', {
      method: 'POST',
      body: JSON.stringify({ nombre, areaId, horasContratadas }),
    });
    feedback.textContent = `${creado.nombre} fue contratado con el identificador ${creado.id}. Asígnale bloques desde "Bloques vacantes".`;
    feedback.className = 'feedback feedback--ok';
    evento.target.reset();
    document.getElementById('horas-docente').value = 34.5;
    cargarDocentes();
    cargarDashboard();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = 'feedback feedback--error';
  }
}

// ---------------------------------------------------------
// 05 · Vacantes
// ---------------------------------------------------------
async function cargarVacantes() {
  const vacantes = await api('/api/horarios?vacantes=true');
  document.getElementById('tabla-vacantes').innerHTML = vacantes.length
    ? vacantes.map((v) => `
      <tr class="vacante-row" data-horario-id="${v.id}">
        <td>${v.grado}°${v.seccion}</td>
        <td>${v.jornada === 'Manana' ? 'Mañana' : 'Tarde'}</td>
        <td>${v.materia}</td>
        <td>${DIAS_ETIQUETA[v.dia]}</td>
        <td>${horaCorta(v.hora_inicio)}–${horaCorta(v.hora_fin)}</td>
        <td>
          <select class="select-docente-vacante"></select>
          <button class="btn btn--small btn--primary" data-asignar="${v.id}" type="button">Asignar</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="empty-note">No hay bloques vacantes en este momento.</td></tr>';

  llenarSelectDocentesVacantes();

  document.querySelectorAll('[data-asignar]').forEach((boton) => {
    boton.addEventListener('click', async () => {
      const fila = boton.closest('tr');
      const docenteId = fila.querySelector('.select-docente-vacante').value;
      if (!docenteId) { alert('Selecciona un docente primero.'); return; }
      try {
        const resultado = await api(`/api/horarios/${boton.dataset.asignar}/asignar`, {
          method: 'PUT',
          body: JSON.stringify({ docenteId }),
        });
        if (resultado.advertencia) alert(resultado.advertencia);
        cargarVacantes();
        cargarDocentes();
        cargarDashboard();
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

function llenarSelectDocentesVacantes() {
  const activos = docentesCache.filter((d) => d.activo);
  document.querySelectorAll('.select-docente-vacante').forEach((select) => {
    select.innerHTML = '<option value="">— elegir docente —</option>' + activos.map((d) => `<option value="${d.id}">${d.nombre} (${d.area_codigo || 'sin área'})</option>`).join('');
  });
}

// ---------------------------------------------------------
// 06 · Horario por docente
// ---------------------------------------------------------
function llenarSelectorDocentes() {
  const selector = document.getElementById('selector-docente');
  const valorPrevio = selector.value;
  selector.innerHTML = docentesCache.map((d) => `<option value="${d.id}">${d.nombre}${d.activo ? '' : ' (inactivo)'}</option>`).join('');
  if (valorPrevio && docentesCache.some((d) => d.id === valorPrevio)) {
    selector.value = valorPrevio;
  } else if (docentesCache.length) {
    cargarHorarioDocente(selector.value);
  }
}

async function cargarHorarioDocente(docenteId) {
  if (!docenteId) return;
  const docente = await api(`/api/docentes/${docenteId}`);
  document.getElementById('resumen-docente').textContent =
    `${docente.nombre} · ${docente.area_nombre || 'sin área asignada'} · ${Math.round(docente.horasAsignadas * 100) / 100} de ${docente.horas_contratadas} horas semanales${docente.activo ? '' : ' · INACTIVO'}`;

  const bloquesPorHora = new Map();
  docente.horario.forEach((b) => {
    const clave = `${b.hora_inicio}-${b.hora_fin}`;
    if (!bloquesPorHora.has(clave)) bloquesPorHora.set(clave, { horaInicio: b.hora_inicio, horaFin: b.hora_fin, porDia: {} });
    bloquesPorHora.get(clave).porDia[b.dia] = b;
  });
  const filasHora = Array.from(bloquesPorHora.values()).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  const grid = document.getElementById('grid-horario-docente');
  if (filasHora.length === 0) {
    grid.innerHTML = '<tr><td class="empty-note">Este docente no tiene bloques de horario asignados.</td></tr>';
    return;
  }
  grid.innerHTML = `
    <thead><tr><th>Hora</th>${DIAS.map((d) => `<th>${DIAS_ETIQUETA[d]}</th>`).join('')}</tr></thead>
    <tbody>
      ${filasHora.map((fila) => `
        <tr>
          <td><strong>${horaCorta(fila.horaInicio)}–${horaCorta(fila.horaFin)}</strong></td>
          ${DIAS.map((dia) => {
            const bloque = fila.porDia[dia];
            if (!bloque) return '<td class="empty">—</td>';
            return `<td><div class="schedule-cell"><strong>${bloque.materia}</strong><small>${bloque.grado}°${bloque.seccion} · ${bloque.estudiantes} estudiantes</small></div></td>`;
          }).join('')}
        </tr>`).join('')}
    </tbody>`;
}

// ---------------------------------------------------------
// 07 · Materias / intensidad horaria
// ---------------------------------------------------------
async function cargarMaterias() {
  const materias = await api('/api/materias');
  const filas = [];
  materias.forEach((m) => {
    if (m.intensidadPorNivel.length === 0) {
      filas.push(`<tr><td>${m.nombre}</td><td>${m.area_nombre || '—'}</td><td colspan="3">Sin datos de intensidad</td></tr>`);
    } else {
      m.intensidadPorNivel.forEach((p) => {
        filas.push(`<tr><td>${m.nombre}</td><td>${m.area_nombre || '—'}</td><td>${p.nivel}</td><td>${p.bloques_semana}</td><td>${p.horas_semana}</td></tr>`);
      });
    }
  });
  document.getElementById('tabla-materias').innerHTML = filas.join('');
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
async function iniciar() {
  document.getElementById('btn-refrescar').addEventListener('click', cargarDashboard);
  document.getElementById('btn-refrescar-vacantes').addEventListener('click', cargarVacantes);
  document.getElementById('filtro-jornada').addEventListener('change', cargarCursos);
  document.getElementById('selector-curso-resumen').addEventListener('change', (e) => renderResumenCurso(e.target.value));
  document.getElementById('btn-aleatorizar').addEventListener('click', aleatorizarEstudiantes);
  document.getElementById('filtro-estado').addEventListener('change', cargarDocentes);
  document.getElementById('btn-despedir').addEventListener('click', despedirSeleccionados);
  document.getElementById('form-contratacion').addEventListener('submit', contratarDocente);
  document.getElementById('selector-docente').addEventListener('change', (e) => cargarHorarioDocente(e.target.value));
  document.getElementById('check-todos').addEventListener('change', (e) => {
    document.querySelectorAll('.check-docente').forEach((c) => { c.checked = e.target.checked; });
    actualizarBotonDespedir();
  });
  document.getElementById('selector-curso-horario').addEventListener('change', (e) => {
    const curso = cursosCache.find((item) => String(item.id) === e.target.value);
    if (!curso) return;
    renderHorarioCurso(curso.id);
  });
  document.getElementById('cerrar-dialogo-horario').addEventListener('click', () => document.getElementById('dialogo-horario').close());

  await llenarAreas();
  await cargarDashboard();
  await cargarCursos();
  await cargarDocentes();
  await cargarVacantes();
  await cargarMaterias();
}

iniciar();
