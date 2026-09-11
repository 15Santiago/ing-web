// =========================================================
// Servidor principal - Gestión de Notas Académicas
// Proyecto Integrador - Optativa II Desarrollo Móvil
//
// El proyecto está separado en tres carpetas hermanas dentro de
// PrimeraEntrega/: frontend/ (HTML/CSS/JS estático), backend/
// (este servidor + la API) y DB/ (schema.sql y el seed). Este
// servidor sirve ../frontend como archivos estáticos Y expone la
// API en /api/*. Al quedar ambos en el mismo origen (mismo
// host:puerto), el fetch('api/estudiantes') de script.js funciona
// directo, sin configurar CORS aparte.
// =========================================================
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verificarConexion } = require('./config/db');
const estudianteRoutes = require('./routes/estudianteRoutes');
const areaRoutes = require('./routes/areaRoutes');
const materiaRoutes = require('./routes/materiaRoutes');
const cursoRoutes = require('./routes/cursoRoutes');
const docenteRoutes = require('./routes/docenteRoutes');
const horarioRoutes = require('./routes/horarioRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(cors()); // por si en algún momento se sirve el front desde otro origen (ej. Live Server)
app.use(express.json());

// ---------- Front end estático ----------
// index.html (panel principal), boletin.html, docentes-horario.html,
// cursos-horario.html y sus CSS/JS viven en la carpeta hermana
// ../frontend (ver PrimeraEntrega/frontend/).
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ---------- API ----------
app.use('/api/estudiantes', estudianteRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/materias', materiaRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/docentes', docenteRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mensaje: 'API de gestión de notas funcionando correctamente.' });
});

// 404 solo para rutas de API que no existan
app.use('/api', (req, res) => {
  res.status(404).json({ mensaje: 'Ruta de API no encontrada.' });
});

// Manejador de errores general
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor.' });
});

// ---------- Arranque ----------
async function iniciar() {
  await verificarConexion();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`   Front end:  http://localhost:${PORT}/`);
    console.log(`   API:        http://localhost:${PORT}/api/estudiantes`);
  });
}

iniciar();
