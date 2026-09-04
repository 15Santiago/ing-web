const express = require('express');
const router = express.Router();
const organizacionController = require('../controllers/organizacionController');

router.get('/configuracion', organizacionController.configuracion);
router.post('/planificar', organizacionController.planificar);

module.exports = router;
