/**
 * Configuración de Telegram Bot
 */

const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  adminIds: process.env.TELEGRAM_ADMIN_IDS ? 
    process.env.TELEGRAM_ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
  
  // Configuración del bot - SIN polling para Railway (evita conflicto 409)
  botOptions: {
    polling: false,
    request: {
      agentOptions: {
        keepAlive: true,
        family: 4
      }
    }
  },
  
  // URLs de la Web App
  webAppUrl: process.env.WEB_APP_URL || 'http://localhost:3000'
};

/**
 * Validar configuración de Telegram
 */
function validateConfig() {
  const errors = [];
  
  if (!config.botToken) {
    errors.push('❌ TELEGRAM_BOT_TOKEN no configurado');
  }
  
  if (config.adminIds.length === 0) {
    errors.push('❌ TELEGRAM_ADMIN_IDS no configurados');
  }
  
  if (!config.webAppUrl) {
    errors.push('❌ WEB_APP_URL no configurado');
  }
  
  if (errors.length > 0) {
    console.error('❌ Errores de configuración de Telegram:');
    errors.forEach(error => console.error('  ', error));
    return false;
  }
  
  console.log('✅ Configuración de Telegram válida');
  console.log(`📱 Bot Token: ${config.botToken.substring(0, 10)}...`);
  console.log(`👥 Admins: ${config.adminIds.length} configurados`);
  console.log(`🌐 Web App URL: ${config.webAppUrl}`);
  
  return true;
}

/**
 * Verificar si un usuario es admin
 */
function isAdmin(userId) {
  return config.adminIds.includes(userId);
}

/**
 * Formatear mensajes de Telegram
 */
const messages = {
  unauthorized: '❌ No tienes permisos para usar este bot',
  
  welcome: `
🐔 *POLLO LOCO TRACKING GPS*
¡Bienvenido al sistema de supervisión!

*Comandos disponibles:*

👥 *Usuarios*
• /usuarios - Ver lista de usuarios
• /nuevo\\_usuario - Crear usuario
• /pausar \\[tid\\] - Pausar usuario
• /activar \\[tid\\] - Activar usuario

📊 *Reportes*
• /reporte - Reporte del día
• /ubicaciones - Ubicaciones actuales
• /visitas\\_hoy - Visitas de hoy

⚙️ *Configuración*
• /config - Ver configuración
• /horarios \\[inicio\\] \\[fin\\] - Cambiar horarios
• /pausar\\_sistema - Pausar tracking
• /activar\\_sistema - Activar tracking

🖥️ *Panel Web*
• /webapp - Abrir panel administrativo

❓ *Ayuda*
• /help - Ver esta ayuda
`,

  help: `
📋 *AYUDA DETALLADA*

*Formato de comandos:*

\`/pausar JP\` - Pausar usuario JP
\`/horarios 07:00 21:00\` - Horarios 7AM-9PM
\`/activar MG\` - Activar usuario MG

*Códigos de usuario:*
- JP = Juan Pérez
- MG = María González
- etc.

*Estados del sistema:*
🟢 Activo - Tracking funcionando
🟡 Pausado - Sin tracking
🔴 Error - Revisar logs

Para soporte técnico, contacta al administrador.
`
};

module.exports = {
  config,
  validateConfig,
  isAdmin,
  messages
};