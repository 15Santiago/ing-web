const express = require('express');
const router = express.Router();
const areaController = require('../controllers/areaController');

router.get('/', areaController.consultarTodas);
router.get('/:id/horas-sugeridas', areaController.consultarHorasSugeridas);

module.exports = router;
