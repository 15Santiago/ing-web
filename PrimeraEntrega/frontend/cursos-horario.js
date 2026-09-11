// =========================================================
// Gestión por curso — front end (vanilla JS)
// Consume /api/cursos y
// /api/dashboard (dashboard general + panel de necesidad de docentes).
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
// Docentes necesarios vs. docentes activos hoy, calculado en el
// servidor contra los cursos activos reales.
// ---------------------------------------------------------
function renderNecesidad(n) {
  const panel = document.getElementById('resumen-necesidad');
  if (!n) { panel.hidden = true; return; }
  panel.hidden = false;
  const diferencia = n.docentesActivos - n.docentesNecesarios;
  let accion = 'La nómina activa coincide con lo que hace falta.';
  if (diferencia > 0) accion = `Sobran ${diferencia} docente(s): revisa la nómina en "Gestión de docentes".`;
  else if (diferencia < 0) accion = `Faltan ${-diferencia} docente(s): revisa la nómina en "Gestión de docentes".`;
  panel.innerHTML = `
    <h3>Docentes necesarios: ${n.docentesNecesarios} de ${n.docentesDisponibles} máximo</h3>
    <p>Hoy hay <strong>${n.docentesActivos}</strong> activos. ${accion}</p>`;
}

// ---------------------------------------------------------
// Dashboard general
// ---------------------------------------------------------
async function cargarDashboard() {
  try {
    const d = await api('/api/dashboard');
    const tarjetas = [
      ['Cursos activos', `${d.cursosActivos} / ${d.totalCursos}`, `${d.totalEstudiantes} estudiantes`],
      ['Docentes activos', d.docentesActivos, `faltan ${Math.max(0, d.necesidadDocentes.docentesDisponibles - d.docentesActivos)} para la nómina máxima (${d.necesidadDocentes.docentesDisponibles})`],
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
// Cursos
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
    <dl class="course-summary__facts"><div><dt>Cupo máximo</dt><dd>${curso.cupo_maximo}</dd></div><div><dt>Estudiantes</dt><dd><input id="estudiantes-curso" type="number" min="0" max="${curso.cupo_maximo}" value="${curso.estudiantes}" ${curso.activo ? '' : 'disabled title="Reabre la sección con \'Aleatorizar estudiantes\'"'}></dd></div></dl>
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

function mostrarMensajeAleatorizar(resultado) {
  const mensaje = document.getElementById('mensaje-aleatorizar');
  if (!mensaje) return;
  const partes = [];
  if (resultado.docentesDesactivados?.length) {
    partes.push(`se despidieron ${resultado.docentesDesactivados.length} docente(s) (${resultado.docentesDesactivados.map((d) => d.nombre).join(', ')})`);
  }
  if (resultado.docentesReactivados?.length) {
    partes.push(`se recontrataron ${resultado.docentesReactivados.length} docente(s) (${resultado.docentesReactivados.map((d) => d.nombre).join(', ')})`);
  }
  mensaje.textContent = partes.length
    ? `Nómina ajustada automáticamente: ${partes.join(' y ')}.`
    : 'La nómina activa ya coincidía con lo que hacía falta: no fue necesario despedir ni recontratar docentes.';
  mensaje.className = 'feedback feedback--ok';
}

async function aleatorizarEstudiantes() {
  const boton = document.getElementById('btn-aleatorizar');
  boton.disabled = true;
  try {
    const resultado = await api('/api/cursos/aleatorizar-estudiantes', { method: 'POST', body: JSON.stringify({}) });
    mostrarMensajeAleatorizar(resultado);
    await cargarDashboard();
    await cargarCursos();
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
  }
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
async function iniciar() {
  document.getElementById('btn-refrescar').addEventListener('click', cargarDashboard);
  document.getElementById('filtro-jornada').addEventListener('change', cargarCursos);
  document.getElementById('selector-curso-resumen').addEventListener('change', (e) => renderResumenCurso(e.target.value));
  document.getElementById('btn-aleatorizar').addEventListener('click', aleatorizarEstudiantes);
  document.getElementById('selector-curso-horario').addEventListener('change', (e) => {
    const curso = cursosCache.find((item) => String(item.id) === e.target.value);
    if (!curso) return;
    renderHorarioCurso(curso.id);
  });
  document.getElementById('cerrar-dialogo-horario').addEventListener('click', () => document.getElementById('dialogo-horario').close());

  await cargarDashboard();
  await cargarCursos();
  await cargarMallaMaterias('malla-materias-cursos');
}

iniciar();
