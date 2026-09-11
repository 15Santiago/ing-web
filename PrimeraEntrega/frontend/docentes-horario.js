// =========================================================
// Horarios de docentes — front end (vanilla JS)
// Mismo estilo que cursos-horario.js: tarjeta de navegación con
// selector + resumen, y el horario semanal completo en un diálogo.
// Consume /api/docentes.
// =========================================================
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const DIAS_ETIQUETA = { Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes' };

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
// Docentes
// ---------------------------------------------------------
async function cargarDocentes() {
  const estado = document.getElementById('filtro-estado').value;
  const query = estado ? `?activo=${estado}` : '';
  docentesCache = await api(`/api/docentes${query}`);
  llenarSelectorDocentesResumen(docentesCache);
  llenarSelectorDocentesHorario(docentesCache);
  renderResumenDocente(docentesCache[0]?.id);
}

function etiquetaDocente(docente) {
  return `${docente.nombre}${docente.activo ? '' : ' (inactivo)'}`;
}

function llenarSelectorDocentesResumen(docentes) {
  const selector = document.getElementById('selector-docente-resumen');
  const valorPrevio = selector.value;
  selector.innerHTML = docentes.length
    ? docentes.map((docente) => `<option value="${docente.id}">${etiquetaDocente(docente)}</option>`).join('')
    : '<option value="">No hay docentes para este filtro</option>';
  if (docentes.some((docente) => String(docente.id) === valorPrevio)) selector.value = valorPrevio;
}

function renderResumenDocente(docenteId) {
  const docente = docentesCache.find((item) => String(item.id) === String(docenteId));
  const resumen = document.getElementById('resumen-docente-seleccionado');
  if (!docente) {
    resumen.innerHTML = '<p class="empty-note">No hay docentes disponibles para este filtro.</p>';
    return;
  }
  resumen.innerHTML = `
    <div class="course-summary__identity"><span class="section-number">Docente seleccionado</span><strong>${docente.nombre}</strong><span>${docente.area_nombre || 'Sin área asignada'}${docente.activo ? '' : ' · <span class="badge badge--inactivo">Inactivo</span>'}</span></div>
    <dl class="course-summary__facts"><div><dt>Horas contratadas</dt><dd>${docente.horas_contratadas} h</dd></div><div><dt>Horas asignadas</dt><dd>${Math.round(docente.horas_asignadas * 100) / 100} h</dd></div></dl>
    <button class="btn btn--small" id="btn-ver-docente-resumen" type="button">Ver horario</button>`;
  document.getElementById('btn-ver-docente-resumen').addEventListener('click', () => mostrarHorarioDocente(docente.id));
}

async function mostrarHorarioDocente(docenteId) {
  document.getElementById('selector-docente-horario').value = docenteId;
  document.getElementById('dialogo-horario').showModal();
  await renderHorarioDocente(docenteId);
}

async function renderHorarioDocente(docenteId) {
  if (!docenteId) return;
  const docente = await api(`/api/docentes/${docenteId}`);
  document.getElementById('resumen-horario-docente').textContent =
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

function llenarSelectorDocentesHorario(docentes) {
  const selector = document.getElementById('selector-docente-horario');
  const valorPrevio = selector.value;
  selector.innerHTML = docentes.length
    ? docentes.map((docente) => `<option value="${docente.id}">${etiquetaDocente(docente)}</option>`).join('')
    : '<option value="">No hay docentes para este filtro</option>';
  if (docentes.some((docente) => String(docente.id) === valorPrevio)) selector.value = valorPrevio;
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
async function iniciar() {
  document.getElementById('filtro-estado').addEventListener('change', cargarDocentes);
  document.getElementById('selector-docente-resumen').addEventListener('change', (e) => renderResumenDocente(e.target.value));
  document.getElementById('selector-docente-horario').addEventListener('change', (e) => {
    const docente = docentesCache.find((item) => String(item.id) === e.target.value);
    if (!docente) return;
    renderHorarioDocente(docente.id);
  });
  document.getElementById('cerrar-dialogo-horario').addEventListener('click', () => document.getElementById('dialogo-horario').close());

  await cargarDocentes();
}

iniciar();
