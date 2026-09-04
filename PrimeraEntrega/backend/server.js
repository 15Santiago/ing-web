// =========================================================
// Servidor principal - Gestión de Notas Académicas
// Proyecto Integrador - Optativa II Desarrollo Móvil
//
// Sirve el front end estático (carpeta /public, tal cual fue
// entregado por el compañero de front end, sin modificar) Y
// expone la API en /api/estudiantes. Como ambos quedan en el
// mismo origen (mismo host:puerto), el fetch('api/estudiantes')
// de script.js funciona directo, sin configurar CORS aparte.
// =========================================================
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verificarConexion } = require('./config/db');
const estudianteRoutes = require('./routes/estudianteRoutes');
const organizacionRoutes = require('./routes/organizacionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(cors()); // por si en algún momento se sirve el front desde otro origen (ej. Live Server)
app.use(express.json());

// ---------- Front end estático ----------
// index.html, styles.css y script.js van en /public sin modificar.
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ----------
app.use('/api/estudiantes', estudianteRoutes);
app.use('/api/organizacion', organizacionRoutes);

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
