// =========================================================
// Rutas de la API: /api/estudiantes
// Coinciden exactamente con lo que consume script.js:
//   POST   /api/estudiantes       -> crear
//   GET    /api/estudiantes       -> listar todos
//   PUT    /api/estudiantes/:id   -> actualizar
//   DELETE /api/estudiantes/:id   -> eliminar
// Extra (no usadas por el front actual, pero disponibles):
//   POST   /api/estudiantes/calcular
//   GET    /api/estudiantes/:id
// =========================================================
const express = require('express');
const router = express.Router();
const estudianteController = require('../controllers/estudianteController');

router.post('/calcular', estudianteController.calcular);

router.post('/', estudianteController.registrar);         // Create
router.get('/', estudianteController.consultarTodos);      // Read (todos)
router.get('/:id', estudianteController.consultarPorId);   // Read (uno)
router.put('/:id', estudianteController.actualizar);       // Update
router.delete('/:id', estudianteController.eliminar);      // Delete

module.exports = router;
