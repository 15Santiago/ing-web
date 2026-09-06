const express = require('express');
const router = express.Router();
const cursoController = require('../controllers/cursoController');

router.get('/', cursoController.consultarTodos);
router.post('/aleatorizar-cupos', cursoController.aleatorizarCupos);
router.get('/:id', cursoController.consultarPorId);
router.post('/', cursoController.crear);
router.put('/:id', cursoController.actualizar);
router.delete('/:id', cursoController.eliminar);

module.exports = router;
