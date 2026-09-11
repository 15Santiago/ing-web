const express = require('express');
const router = express.Router();
const docenteController = require('../controllers/docenteController');

router.get('/', docenteController.consultarTodos);
router.get('/log', docenteController.consultarLogController);
router.post('/despedir', docenteController.despedir);
router.get('/:id', docenteController.consultarPorId);
router.post('/', docenteController.crear);
router.put('/:id', docenteController.actualizar);
router.delete('/:id', docenteController.eliminar);
router.post('/:id/activar', docenteController.activar);
router.post('/:id/asignar-vacantes', docenteController.asignarVacantes);

module.exports = router;
