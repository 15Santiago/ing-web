// =========================================================
// Gestión de docentes — front end (vanilla JS)
// Dashboard general, CRUD de docentes (contratar, buscar,
// actualizar, despedir, recontratar) con horas contratadas
// calculadas automáticamente por área, visualizador de horario
// semanal por docente (independiente del CRUD) y bitácora de
// movimientos. Consume /api/docentes, /api/areas,
// /api/areas/:id/horas-sugeridas, /api/dashboard,
// /api/cursos/aleatorizar-estudiantes y /api/docentes/log.
// =========================================================
const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
const DIAS_ETIQUETA = { Lunes: 'Lunes', Martes: 'Martes', Miercoles: 'Miércoles', Jueves: 'Jueves', Viernes: 'Viernes' };

let docentesCache = [];
let docentesTodosCache = [];
let areasCache = [];
let docenteEnEdicion = null;

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
  } catch (error) {
    console.error(error);
  }
}

// ---------------------------------------------------------
// Áreas (para el selector del formulario) y horas sugeridas
// ---------------------------------------------------------
async function cargarAreas() {
  areasCache = await api('/api/areas');
  document.getElementById('area-docente').innerHTML = areasCache.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join('');
}

async function actualizarHorasSugeridas() {
  const areaId = document.getElementById('area-docente').value;
  const input = document.getElementById('horas-docente');
  const ayuda = document.getElementById('ayuda-horas-docente');
  if (!areaId) return;
  try {
    const sugerencia = await api(`/api/areas/${areaId}/horas-sugeridas`);
    input.value = sugerencia.horasSugeridas;
    ayuda.textContent = sugerencia.horasFaltantes > 0
      ? `A esta área le faltan ${sugerencia.horasFaltantes} h semanales: el programa sugiere contratar ${sugerencia.horasSugeridas} h.`
      : `Esta área no tiene horas pendientes ahora mismo: el programa sugiere tiempo completo (${sugerencia.horasSugeridas} h).`;
  } catch (error) {
    console.error(error);
  }
}

// ---------------------------------------------------------
// Docentes: listar, buscar, despedir, recontratar (CRUD) — un
// desplegable + tarjeta de resumen, igual estilo que "Horario
// semanal por docente".
// ---------------------------------------------------------
async function cargarDocentes() {
  const estado = document.getElementById('filtro-estado').value;
  const query = estado ? `?activo=${estado}` : '';
  docentesCache = await api(`/api/docentes${query}`);
  renderSelectorDocentesCrud();
}

function docentesCrudFiltrados() {
  const texto = document.getElementById('buscar-docente').value.trim().toLowerCase();
  return texto
    ? docentesCache.filter((d) => d.nombre.toLowerCase().includes(texto) || d.id.toLowerCase().includes(texto))
    : docentesCache;
}

function renderSelectorDocentesCrud() {
  const visibles = docentesCrudFiltrados();
  const selector = document.getElementById('selector-docente-crud');
  const valorPrevio = selector.value;
  selector.innerHTML = visibles.length
    ? visibles.map((d) => `<option value="${d.id}">${etiquetaDocenteResumen(d)}</option>`).join('')
    : '<option value="">No hay docentes que coincidan</option>';
  if (visibles.some((d) => String(d.id) === valorPrevio)) selector.value = valorPrevio;
  renderResumenDocenteCrud(selector.value);
}

function renderResumenDocenteCrud(docenteId) {
  const docente = docentesCache.find((d) => String(d.id) === String(docenteId));
  const resumen = document.getElementById('resumen-docente-crud');
  if (!docente) {
    resumen.innerHTML = '<p class="empty-note">No hay docentes que coincidan con la búsqueda.</p>';
    return;
  }
  resumen.innerHTML = `
    <div class="course-summary__identity"><span class="section-number">Docente seleccionado</span><strong>${docente.nombre}</strong><span>${docente.area_nombre || 'Sin área asignada'}${docente.activo ? '' : ' · <span class="badge badge--inactivo">Despedido</span>'}</span></div>
    <dl class="course-summary__facts"><div><dt>Horas contratadas</dt><dd>${docente.horas_contratadas} h</dd></div><div><dt>Horas asignadas</dt><dd>${Math.round(docente.horas_asignadas * 100) / 100} h</dd></div></dl>
    <div class="course-summary__actions">
      <button class="btn btn--small" id="btn-editar-docente-crud" type="button">Editar</button>
      ${docente.activo
        ? '<button class="btn btn--small btn--danger" id="btn-despedir-docente-crud" type="button">Despedir</button>'
        : '<button class="btn btn--small btn--primary" id="btn-recontratar-docente-crud" type="button">Recontratar</button>'}
    </div>`;
  document.getElementById('btn-editar-docente-crud').addEventListener('click', () => editarDocente(docente));
  const botonDespedir = document.getElementById('btn-despedir-docente-crud');
  if (botonDespedir) botonDespedir.addEventListener('click', () => despedirDocente(docente));
  const botonRecontratar = document.getElementById('btn-recontratar-docente-crud');
  if (botonRecontratar) botonRecontratar.addEventListener('click', () => recontratarDocente(docente.id));
}

async function despedirDocente(docente) {
  if (!confirm(`¿Despedir a ${docente.nombre}? Sus clases quedarán vacantes.`)) return;
  try {
    await api('/api/docentes/despedir', { method: 'POST', body: JSON.stringify({ ids: [docente.id] }) });
    await cargarDocentes();
    await cargarDashboard();
    await cargarBitacora();
    await cargarHorarioDocentes();
  } catch (error) {
    alert(error.message);
  }
}

async function recontratarDocente(id) {
  try {
    await api(`/api/docentes/${id}/activar`, { method: 'POST' });
    await cargarDocentes();
    await cargarDashboard();
    await cargarBitacora();
    await cargarHorarioDocentes();
  } catch (error) {
    alert(error.message);
  }
}

// ---------------------------------------------------------
// Contratar / actualizar (mismo formulario, dos modos). Las
// horas contratadas no se escriben a mano: se recalculan según
// el área elegida y lo que haga falta ahí (ver actualizarHorasSugeridas).
// ---------------------------------------------------------
function editarDocente(docente) {
  docenteEnEdicion = docente.id;
  document.getElementById('nombre-docente').value = docente.nombre;
  document.getElementById('area-docente').value = docente.area_id || '';
  document.getElementById('titulo-formulario-docente').textContent = `Editar docente: ${docente.nombre}`;
  document.getElementById('btn-guardar-docente').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-edicion').hidden = false;
  actualizarHorasSugeridas();
  document.getElementById('form-docente').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelarEdicion() {
  docenteEnEdicion = null;
  document.getElementById('form-docente').reset();
  document.getElementById('titulo-formulario-docente').textContent = 'Contratar nuevo docente';
  document.getElementById('btn-guardar-docente').textContent = 'Contratar';
  document.getElementById('btn-cancelar-edicion').hidden = true;
  actualizarHorasSugeridas();
}

async function guardarDocente(evento) {
  evento.preventDefault();
  const feedback = document.getElementById('feedback-docente');
  const nombre = document.getElementById('nombre-docente').value.trim();
  const areaId = Number(document.getElementById('area-docente').value);
  const horasContratadas = Number(document.getElementById('horas-docente').value);
  try {
    if (docenteEnEdicion) {
      const actualizado = await api(`/api/docentes/${docenteEnEdicion}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre, areaId, horasContratadas }),
      });
      feedback.textContent = `${actualizado.nombre} fue actualizado correctamente.`;
      feedback.className = 'feedback feedback--ok';
      cancelarEdicion();
    } else {
      const creado = await api('/api/docentes', {
        method: 'POST',
        body: JSON.stringify({ nombre, areaId, horasContratadas }),
      });
      feedback.textContent = `${creado.nombre} fue contratado con el identificador ${creado.id}.`;
      feedback.className = 'feedback feedback--ok';
      evento.target.reset();
      actualizarHorasSugeridas();
    }
    await cargarDocentes();
    await cargarDashboard();
    await cargarBitacora();
    await cargarHorarioDocentes();
  } catch (error) {
    feedback.textContent = error.message;
    feedback.className = 'feedback feedback--error';
  }
}

// ---------------------------------------------------------
// Horario semanal por docente — visualizador aparte del CRUD:
// selector + tarjeta de resumen, con "Ver horario" abriendo el
// diálogo con la grilla semanal completa (mismo estilo que
// "Cursos" en Gestión por curso).
// ---------------------------------------------------------
async function cargarHorarioDocentes() {
  docentesTodosCache = await api('/api/docentes');
  llenarSelectorDocentesResumen(docentesTodosCache);
  llenarSelectorDocentesHorario(docentesTodosCache);
  renderResumenDocente(docentesTodosCache[0]?.id);
}

function etiquetaDocenteResumen(docente) {
  return `${docente.nombre}${docente.activo ? '' : ' (despedido)'}`;
}

function llenarSelectorDocentesResumen(docentes) {
  const selector = document.getElementById('selector-docente-resumen');
  const valorPrevio = selector.value;
  selector.innerHTML = docentes.length
    ? docentes.map((d) => `<option value="${d.id}">${etiquetaDocenteResumen(d)}</option>`).join('')
    : '<option value="">No hay docentes registrados</option>';
  if (docentes.some((d) => String(d.id) === valorPrevio)) selector.value = valorPrevio;
}

function renderResumenDocente(docenteId) {
  const docente = docentesTodosCache.find((d) => String(d.id) === String(docenteId));
  const resumen = document.getElementById('resumen-docente-seleccionado');
  if (!docente) {
    resumen.innerHTML = '<p class="empty-note">No hay docentes registrados todavía.</p>';
    return;
  }
  resumen.innerHTML = `
    <div class="course-summary__identity"><span class="section-number">Docente seleccionado</span><strong>${docente.nombre}</strong><span>${docente.area_nombre || 'Sin área asignada'}${docente.activo ? '' : ' · <span class="badge badge--inactivo">Despedido</span>'}</span></div>
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
    `${docente.nombre} · ${docente.area_nombre || 'sin área asignada'} · ${Math.round(docente.horasAsignadas * 100) / 100} de ${docente.horas_contratadas} horas semanales${docente.activo ? '' : ' · DESPEDIDO'}`;

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
    ? docentes.map((d) => `<option value="${d.id}">${d.nombre}${d.activo ? '' : ' (despedido)'}</option>`).join('')
    : '<option value="">No hay docentes registrados</option>';
  if (docentes.some((d) => String(d.id) === valorPrevio)) selector.value = valorPrevio;
}

// ---------------------------------------------------------
// Aleatorizar estudiantes (recalcula matrícula y balancea la
// nómina de docentes activos/despedidos por área en el servidor)
// ---------------------------------------------------------
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
    await cargarDocentes();
    await cargarBitacora();
    await cargarHorarioDocentes();
  } catch (error) {
    alert(error.message);
  } finally {
    boton.disabled = false;
  }
}

// ---------------------------------------------------------
// Bitácora de docentes
// ---------------------------------------------------------
function etiquetaAccion(accion) {
  return { contratado: 'Contratado', despedido: 'Despedido', reactivado: 'Recontratado', actualizado: 'Actualizado' }[accion] || accion;
}

function etiquetaOrigen(origen) {
  return origen === 'automatico' ? 'Automático (aleatorizar)' : 'Manual';
}

function formatearFecha(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

async function cargarBitacora() {
  try {
    const eventos = await api('/api/docentes/log?limite=20');
    document.getElementById('tabla-bitacora').innerHTML = eventos.length ? eventos.map((e) => `
      <tr>
        <td>${formatearFecha(e.creado_en)}</td>
        <td><strong>${e.docente_nombre}</strong><br><small>${e.docente_id}</small></td>
        <td>${etiquetaAccion(e.accion)}</td>
        <td>${etiquetaOrigen(e.origen)}</td>
        <td>${e.detalle || '—'}</td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty-note">Todavía no hay movimientos registrados.</td></tr>';
  } catch (error) {
    console.error(error);
  }
}

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
async function iniciar() {
  document.getElementById('btn-refrescar').addEventListener('click', cargarDashboard);
  document.getElementById('btn-refrescar-bitacora').addEventListener('click', cargarBitacora);
  document.getElementById('filtro-estado').addEventListener('change', cargarDocentes);
  document.getElementById('buscar-docente').addEventListener('input', renderSelectorDocentesCrud);
  document.getElementById('btn-aleatorizar').addEventListener('click', aleatorizarEstudiantes);
  document.getElementById('area-docente').addEventListener('change', actualizarHorasSugeridas);
  document.getElementById('form-docente').addEventListener('submit', guardarDocente);
  document.getElementById('btn-cancelar-edicion').addEventListener('click', cancelarEdicion);
  document.getElementById('selector-docente-crud').addEventListener('change', (e) => renderResumenDocenteCrud(e.target.value));
  document.getElementById('selector-docente-resumen').addEventListener('change', (e) => renderResumenDocente(e.target.value));
  document.getElementById('selector-docente-horario').addEventListener('change', (e) => {
    const docente = docentesTodosCache.find((item) => String(item.id) === e.target.value);
    if (!docente) return;
    renderHorarioDocente(docente.id);
  });
  document.getElementById('cerrar-dialogo-horario').addEventListener('click', () => document.getElementById('dialogo-horario').close());

  await cargarAreas();
  await actualizarHorasSugeridas();
  await cargarDashboard();
  await cargarDocentes();
  await cargarHorarioDocentes();
  await cargarBitacora();
  await cargarMallaMaterias('malla-materias-docentes');
}

iniciar();
