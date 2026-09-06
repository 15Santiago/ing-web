const express = require('express');
const router = express.Router();
const materiaController = require('../controllers/materiaController');

router.get('/', materiaController.consultarTodas);
router.post('/', materiaController.crear);
router.put('/:id', materiaController.actualizar);
router.delete('/:id', materiaController.eliminar);

router.post('/plan', materiaController.crearPlan);
router.put('/plan/:id', materiaController.actualizarPlan);
router.delete('/plan/:id', materiaController.eliminarPlan);

module.exports = router;
