const { DEFAULT_CONFIG, calcularOrganizacion } = require('../services/organizacionService');

function configuracion(req, res) {
  return res.status(200).json(DEFAULT_CONFIG);
}

function planificar(req, res) {
  try {
    return res.status(200).json(calcularOrganizacion(req.body || {}));
  } catch (error) {
    console.error('Error en planificar():', error);
    return res.status(400).json({ mensaje: 'No se pudo generar la organización académica.' });
  }
}

module.exports = { configuracion, planificar };
