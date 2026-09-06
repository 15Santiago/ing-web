const express = require('express');
const router = express.Router();
const horarioController = require('../controllers/horarioController');

router.get('/', horarioController.consultarTodos);
router.get('/conflictos', horarioController.consultarConflictos);
router.post('/', horarioController.crear);
router.put('/:id', horarioController.actualizar);
router.put('/:id/asignar', horarioController.asignarDocente);
router.delete('/:id', horarioController.eliminar);

module.exports = router;
