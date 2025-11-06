/**
 * Índice de comandos de Telegram
 */

const ayuda = require('./ayuda');
const usuarios = require('./usuarios');
const config = require('./config');
const control = require('./control');
const reportes = require('./reportes');

module.exports = {
  ayuda,
  usuarios,
  config,
  control,
  reportes
};