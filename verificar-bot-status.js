require('dotenv').config();
const axios = require('axios');

/**
 * Verificar si el bot de Telegram está funcionando
 */

async function verificarBotStatus() {
  console.log('🤖 Verificando estado del bot de Telegram...\n');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken || botToken === '0') {
    console.log('❌ ERROR: TELEGRAM_BOT_TOKEN no configurado o es inválido');
    console.log(`   Token actual: ${botToken}`);
    return;
  }
  
  console.log('✅ Token encontrado:', botToken.substring(0, 10) + '...');
  
  try {
    // 1. Verificar si el bot está activo usando Telegram API
    console.log('\n📡 Verificando conexión con Telegram API...');
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    
    if (response.data.ok) {
      const botInfo = response.data.result;
      console.log('✅ Bot conectado exitosamente:');
      console.log(`   👤 Nombre: ${botInfo.first_name}`);
      console.log(`   🏷️  Username: @${botInfo.username}`);
      console.log(`   🆔 ID: ${botInfo.id}`);
      console.log(`   🤖 Es Bot: ${botInfo.is_bot}`);
    }
    
    // 2. Verificar últimas actualizaciones del bot
    console.log('\n📩 Verificando últimas actualizaciones...');
    const updatesResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates?limit=5`);
    
    if (updatesResponse.data.ok) {
      const updates = updatesResponse.data.result;
      console.log(`✅ ${updates.length} actualizaciones recientes encontradas`);
      
      if (updates.length > 0) {
        console.log('\n📋 Últimas actividades:');
        updates.slice(0, 3).forEach((update, index) => {
          const msg = update.message;
          if (msg) {
            const fecha = new Date(msg.date * 1000).toLocaleString('es-MX');
            console.log(`   ${index + 1}. ${fecha} - ${msg.from.first_name}: "${msg.text}"`);
          }
        });
      } else {
        console.log('⚠️  No hay actividad reciente en el bot');
      }
    }
    
    // 3. Verificar webhook si está configurado
    console.log('\n🔗 Verificando configuración webhook...');
    const webhookResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    
    if (webhookResponse.data.ok) {
      const webhookInfo = webhookResponse.data.result;
      if (webhookInfo.url) {
        console.log(`✅ Webhook configurado: ${webhookInfo.url}`);
        console.log(`   Últimos errores: ${webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toLocaleString('es-MX') : 'Ninguno'}`);
      } else {
        console.log('📱 Modo polling (sin webhook configurado)');
      }
    }
    
  } catch (error) {
    console.log('❌ ERROR conectando con Telegram API:');
    console.log(`   ${error.message}`);
    
    if (error.response && error.response.data) {
      console.log(`   Respuesta: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
  
  // 4. Verificar admins configurados
  console.log('\n👥 Verificando admins configurados...');
  const adminIds = process.env.TELEGRAM_ADMIN_IDS;
  if (!adminIds || adminIds === '0') {
    console.log('⚠️  WARNING: TELEGRAM_ADMIN_IDS no configurado correctamente');
    console.log('   Valor actual:', adminIds);
    console.log('   💡 Para configurar: TELEGRAM_ADMIN_IDS=tu_user_id_de_telegram');
  } else {
    const ids = adminIds.split(',').map(id => id.trim());
    console.log(`✅ ${ids.length} admin(s) configurado(s): ${ids.join(', ')}`);
  }
  
  // 5. Verificar URL del Web App
  console.log('\n🌐 Verificando Web App URL...');
  const webAppUrl = process.env.WEB_APP_URL;
  if (webAppUrl && webAppUrl !== 'undefined') {
    console.log(`✅ Web App URL: ${webAppUrl}`);
    
    // Verificar si la URL responde
    try {
      const appResponse = await axios.get(webAppUrl, { timeout: 5000 });
      if (appResponse.status === 200) {
        console.log('✅ Web App está respondiendo correctamente');
      }
    } catch (appError) {
      console.log('⚠️  Web App no responde o está caída');
    }
  } else {
    console.log('⚠️  WEB_APP_URL no configurada');
  }
}

// Función para obtener tu User ID de Telegram
async function obtenerMiUserId() {
  console.log('\n\n🔍 CÓMO OBTENER TU USER ID DE TELEGRAM:');
  console.log('1. Envía un mensaje al bot @userinfobot');
  console.log('2. Te responderá con tu User ID');
  console.log('3. Agrega ese número a TELEGRAM_ADMIN_IDS en .env');
  console.log('\nEjemplo en .env:');
  console.log('TELEGRAM_ADMIN_IDS=123456789');
}

if (require.main === module) {
  verificarBotStatus()
    .then(() => {
      obtenerMiUserId();
      console.log('\n🎯 RESUMEN DE VERIFICACIÓN COMPLETADO');
    })
    .catch(error => {
      console.error('💥 Error:', error);
    });
}

module.exports = verificarBotStatus;