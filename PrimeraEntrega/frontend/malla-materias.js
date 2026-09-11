// =========================================================
// Malla de asignaturas e intensidad horaria — compartida entre
// Gestión por curso y Gestión de docentes. Agrupa las materias
// (GET /api/materias) por área ("componente") y las distribuye
// en columnas por grado (1°-11°), con una fila de subtotal por
// componente y una fila de total general, al estilo de una malla
// curricular. Además, por cada materia calcula cuántos cursos
// activos la reciben, sus horas semanales totales en el colegio y
// cuántos docentes hacen falta solo para ella — contra los cursos
// reales (GET /api/cursos) y el máximo de bloques por docente
// (GET /api/dashboard), no una simulación aparte.
// =========================================================
const MALLA_GRADOS = Array.from({ length: 11 }, (_, i) => i + 1);
const MALLA_PALETA = ['#dbe7f5', '#fdecd2', '#dcece7', '#f6dede', '#e6e0f5', '#fdf3cf'];

function mallaAgruparPorArea(materias) {
  const mapa = new Map();
  materias.forEach((m) => {
    const clave = m.area_id ?? 'sin-area';
    if (!mapa.has(clave)) {
      mapa.set(clave, { areaId: m.area_id, nombre: m.area_nombre || 'Sin área', materias: [] });
    }
    mapa.get(clave).materias.push(m);
  });
  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function mallaTotalesPorGrado(materias) {
  const totales = MALLA_GRADOS.map(() => ({ bloques: 0, horas: 0 }));
  materias.forEach((m) => {
    (m.intensidadPorNivel || []).forEach((plan) => {
      for (let grado = plan.grado_min; grado <= plan.grado_max; grado += 1) {
        if (grado >= 1 && grado <= 11) {
          totales[grado - 1].bloques += plan.bloques_semana;
          totales[grado - 1].horas += Number(plan.horas_semana);
        }
      }
    });
  });
  return totales;
}

function mallaCursosActivosPorGrado(cursos) {
  const mapa = new Map();
  cursos.forEach((c) => {
    if (!c.activo) return;
    mapa.set(c.grado, (mapa.get(c.grado) || 0) + 1);
  });
  return mapa;
}

// Cursos atendidos, horas/semana en todo el colegio y docentes que
// hacen falta solo para esta materia, contra los cursos ACTIVOS reales.
function mallaResumenMateria(materia, cursosPorGrado, horasMaxDocente) {
  let cursosAtendidos = 0;
  let horasSemana = 0;
  (materia.intensidadPorNivel || []).forEach((plan) => {
    for (let grado = plan.grado_min; grado <= plan.grado_max; grado += 1) {
      const cantidad = cursosPorGrado.get(grado) || 0;
      cursosAtendidos += cantidad;
      horasSemana += cantidad * Number(plan.horas_semana);
    }
  });
  const docentesNecesarios = horasSemana > 0 ? Math.ceil(horasSemana / horasMaxDocente) : 0;
  return { cursosAtendidos, horasSemana, docentesNecesarios };
}

function mallaFilaMateria(materia, color) {
  const planes = [...(materia.intensidadPorNivel || [])].sort((a, b) => a.grado_min - b.grado_min);
  let planIndex = 0;
  let grado = 1;
  const celdas = [];
  while (grado <= 11) {
    const plan = planes[planIndex];
    if (plan && plan.grado_min === grado) {
      const span = plan.grado_max - plan.grado_min + 1;
      celdas.push(`<td colspan="${span}" class="malla-celda" style="background:${color}"><strong>${materia.nombre}</strong><small>${plan.bloques_semana} bloques · ${Number(plan.horas_semana)} h</small></td>`);
      grado += span;
      planIndex += 1;
    } else {
      celdas.push('<td class="malla-celda malla-celda--vacia"></td>');
      grado += 1;
    }
  }
  return celdas.join('');
}

function construirMallaMaterias(materias, cursos, horasMaxDocente) {
  const cursosPorGrado = mallaCursosActivosPorGrado(cursos || []);
  const resumenes = new Map(materias.map((m) => [m.id, mallaResumenMateria(m, cursosPorGrado, horasMaxDocente)]));

  const grupos = mallaAgruparPorArea(materias);
  const encabezado = `<thead><tr><th>Componente</th><th>Asignatura</th>${MALLA_GRADOS.map((g) => `<th>${g}°</th>`).join('')}<th>Cursos</th><th>Docentes</th></tr></thead>`;

  let cuerpo = '<tbody>';
  grupos.forEach((grupo, indice) => {
    const color = MALLA_PALETA[indice % MALLA_PALETA.length];
    grupo.materias.forEach((materia, i) => {
      const resumen = resumenes.get(materia.id);
      cuerpo += '<tr>';
      if (i === 0) {
        cuerpo += `<th rowspan="${grupo.materias.length + 1}" class="malla-componente" style="background:${color}">${grupo.nombre}</th>`;
      }
      cuerpo += `<td class="malla-asignatura">${materia.nombre}</td>`;
      cuerpo += mallaFilaMateria(materia, color);
      cuerpo += `<td class="malla-resumen">${resumen.cursosAtendidos}<br><small>${Math.round(resumen.horasSemana * 100) / 100} h/sem</small></td>`;
      cuerpo += `<td class="malla-resumen">${resumen.docentesNecesarios}</td>`;
      cuerpo += '</tr>';
    });
    const subtotales = mallaTotalesPorGrado(grupo.materias);
    const cursosGrupo = grupo.materias.reduce((total, m) => total + resumenes.get(m.id).cursosAtendidos, 0);
    const horasGrupo = grupo.materias.reduce((total, m) => total + resumenes.get(m.id).horasSemana, 0);
    const docentesGrupo = grupo.materias.reduce((total, m) => total + resumenes.get(m.id).docentesNecesarios, 0);
    cuerpo += `<tr class="malla-subtotal"><td>Total ${grupo.nombre}</td>${subtotales.map((t) => `<td>${t.bloques}<br><small>${Math.round(t.horas * 100) / 100} h</small></td>`).join('')}<td>${cursosGrupo}<br><small>${Math.round(horasGrupo * 100) / 100} h/sem</small></td><td>${docentesGrupo}</td></tr>`;
  });

  const totalesGenerales = mallaTotalesPorGrado(materias);
  const cursosTotal = materias.reduce((total, m) => total + resumenes.get(m.id).cursosAtendidos, 0);
  const horasTotal = materias.reduce((total, m) => total + resumenes.get(m.id).horasSemana, 0);
  const docentesTotal = materias.reduce((total, m) => total + resumenes.get(m.id).docentesNecesarios, 0);
  cuerpo += `<tr class="malla-total-general"><th colspan="2">Total general</th>${totalesGenerales.map((t) => `<td>${t.bloques}<br><small>${Math.round(t.horas * 100) / 100} h</small></td>`).join('')}<td>${cursosTotal}<br><small>${Math.round(horasTotal * 100) / 100} h/sem</small></td><td>${docentesTotal}</td></tr>`;
  cuerpo += '</tbody>';

  return `<table class="malla-materias">${encabezado}${cuerpo}</table>`;
}

async function cargarMallaMaterias(contenedorId) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  try {
    const opciones = { headers: { 'Content-Type': 'application/json' } };
    const [materias, cursos, dashboard] = await Promise.all([
      fetch('/api/materias', opciones).then((r) => r.json()),
      fetch('/api/cursos', opciones).then((r) => r.json()),
      fetch('/api/dashboard', opciones).then((r) => r.json()),
    ]);
    const horasMaxDocente = Number(dashboard?.necesidadDocentes?.bloquesMaxDocenteSemana || 46) * 0.75;
    contenedor.innerHTML = construirMallaMaterias(materias, cursos, horasMaxDocente);
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = '<p class="empty-note">No se pudo cargar la malla de asignaturas.</p>';
  }
}
