// =========================================================
// Personal docente y horarios — front end (vanilla JS)
// Consume la API real (/api/docentes, /api/cursos, /api/horarios,
// /api/materias, /api/areas, /api/dashboard), respaldada por MySQL.
// =========================================================
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const DIAS_ETIQUETA = { Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes' };

let areasCache = [];
let docentesCache = [];

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
      ['Cursos', d.totalCursos, `${d.totalEstudiantes} estudiantes`],
      ['Docentes activos', d.docentesActivos, `${d.docentesInactivos} inactivos`],
      ['Horas semanales', Math.round(d.horasSemanalesTotales * 100) / 100, 'de clase dictadas'],
      ['Bloques de horario', d.totalBloques, `${d.bloquesVacantes} vacantes`],
      ['Conflictos', d.conflictos, d.conflictos ? 'requieren revisión' : 'sin choques de horario'],
      ['Jornadas', d.porJornada.map((j) => `${j.jornada === 'Manana' ? 'Mañana' : 'Tarde'}: ${j.cursos}`).join(' · '), 'cursos por jornada'],
    ];
    document.getElementById('tarjetas-dashboard').innerHTML = tarjetas.map(([titulo, valor, detalle]) => `
      <article class="summary-card ${titulo === 'Conflictos' && d.conflictos ? 'summary-card--alert' : ''}">
        <span>${titulo}</span><strong>${valor}</strong><small>${detalle}</small>
      </article>`).join('');
  } catch (error) {
    console.error(error);
  }
}

// ---------------------------------------------------------
// 02 · Cursos
// ---------------------------------------------------------
async function cargarCursos() {
  const jornada = document.getElementById('filtro-jornada').value;
  const cursos = await api(`/api/cursos${jornada ? `?jornada=${jornada}` : ''}`);
  document.getElementById('tabla-cursos').innerHTML = cursos.map((curso) => `
    <tr>
      <td><strong>${curso.grado}°${curso.seccion}</strong></td>
      <td>${curso.jornada === 'Manana' ? 'Mañana' : 'Tarde'}</td>
      <td>${curso.cupo_maximo}</td>
      <td><input type="number" min="0" max="${curso.cupo_maximo}" value="${curso.estudiantes}" data-curso-id="${curso.id}" data-cupo="${curso.cupo_maximo}"></td>
      <td><button class="btn btn--small" data-ver-curso="${curso.id}" type="button">Ver horario</button></td>
    </tr>`).join('');

  document.querySelectorAll('[data-curso-id]').forEach((input) => {
    input.addEventListener('change', async () => {
      const cursoId = input.dataset.cursoId;
      const cupo = Number(input.dataset.cupo);
      let valor = Number(input.value);
      if (valor > cupo) { valor = cupo; input.value = cupo; }
      try {
        const curso = cursos.find((c) => String(c.id) === cursoId);
        await api(`/api/cursos/${cursoId}`, {
          method: 'PUT',
          body: JSON.stringify({ grado: curso.grado, seccion: curso.seccion, jornada: curso.jornada, cupoMaximo: cupo, estudiantes: valor }),
        });
        cargarDashboard();
      } catch (error) {
        alert(error.message);
        cargarCursos();
      }
    });
  });

  document.querySelectorAll('[data-ver-curso]').forEach((boton) => {
    boton.addEventListener('click', () => mostrarHorarioCurso(boton.dataset.verCurso));
  });
}

async function mostrarHorarioCurso(cursoId) {
  const curso = await api(`/api/cursos/${cursoId}`);
  const filas = curso.horario.map((b) => `${DIAS_ETIQUETA[b.dia]} ${horaCorta(b.hora_inicio)}–${horaCorta(b.hora_fin)} · ${b.materia} · ${b.docente_nombre || 'VACANTE'}`).join('\n');
  alert(`Horario de ${curso.grado}°${curso.seccion} (${curso.estudiantes} estudiantes)\n\n${filas || 'Sin bloques registrados.'}`);
}

async function aleatorizarCupos() {
  await api('/api/cursos/aleatorizar-cupos', { method: 'POST', body: JSON.stringify({}) });
  cargarCursos();
  cargarDashboard();
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
      <td><button class="btn btn--small" data-ver-docente="${d.id}" type="button">Ver horario</button></td>
    </tr>`).join('');

  document.querySelectorAll('[data-ver-docente]').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.getElementById('selector-docente').value = boton.dataset.verDocente;
      cargarHorarioDocente(boton.dataset.verDocente);
      document.getElementById('titulo-horario-docente').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
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
  document.getElementById('btn-aleatorizar').addEventListener('click', aleatorizarCupos);
  document.getElementById('filtro-estado').addEventListener('change', cargarDocentes);
  document.getElementById('btn-despedir').addEventListener('click', despedirSeleccionados);
  document.getElementById('form-contratacion').addEventListener('submit', contratarDocente);
  document.getElementById('selector-docente').addEventListener('change', (e) => cargarHorarioDocente(e.target.value));
  document.getElementById('check-todos').addEventListener('change', (e) => {
    document.querySelectorAll('.check-docente').forEach((c) => { c.checked = e.target.checked; });
    actualizarBotonDespedir();
  });

  await llenarAreas();
  await cargarDashboard();
  await cargarCursos();
  await cargarDocentes();
  await cargarVacantes();
  await cargarMaterias();
}

iniciar();
