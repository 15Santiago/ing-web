// =========================================================
// Página principal — franja de estadísticas en vivo del hero.
// Consume /api/dashboard; si falla (o la API no está arriba)
// simplemente no muestra la franja, sin romper el resto de la
// página.
// =========================================================
async function cargarEstadisticas() {
  const contenedor = document.getElementById('hero-stats');
  if (!contenedor) return;
  try {
    const respuesta = await fetch('/api/dashboard', { headers: { 'Content-Type': 'application/json' } });
    if (!respuesta.ok) throw new Error('No se pudo cargar el dashboard.');
    const d = await respuesta.json();

    const estadisticas = [
      [`${d.cursosActivos}`, `de ${d.totalCursos} cursos activos`],
      [`${d.totalEstudiantes}`, 'estudiantes matriculados'],
      [`${d.docentesActivos}`, 'docentes en nómina'],
    ];

    contenedor.innerHTML = estadisticas.map(([valor, etiqueta]) => `
      <div class="hero__stat"><strong>${valor}</strong><span>${etiqueta}</span></div>
    `).join('');
  } catch (error) {
    console.error(error);
  }
}

cargarEstadisticas();
