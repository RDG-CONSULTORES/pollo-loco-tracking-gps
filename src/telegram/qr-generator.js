/**
 * Generador de QR Codes para Telegram y OwnTracks
 * Mini-Step 1C: QR codes funcionales para setup automático
 */

const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generar QR code para vinculación con Telegram Bot
 */
async function generateTelegramQR(trackerId, options = {}) {
  try {
    const {
      botUsername = process.env.TELEGRAM_BOT_USERNAME || 'PoloLocoTrackingBot',
      baseUrl = process.env.WEB_APP_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app',
      format = 'url' // 'url', 'base64', 'buffer', 'svg'
    } = options;

    console.log('📱 Generando QR Telegram para:', trackerId);

    // URL del bot con parámetro de start
    const telegramUrl = `https://t.me/${botUsername}?start=${trackerId}`;
    
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };

    let qrResult;
    
    switch (format) {
      case 'base64':
        qrResult = await QRCode.toDataURL(telegramUrl, qrOptions);
        break;
      case 'buffer':
        qrResult = await QRCode.toBuffer(telegramUrl, qrOptions);
        break;
      case 'svg':
        qrResult = await QRCode.toString(telegramUrl, { ...qrOptions, type: 'svg' });
        break;
      default:
        qrResult = telegramUrl;
    }

    const result = {
      url: telegramUrl,
      qr_data: qrResult,
      tracker_id: trackerId,
      bot_username: botUsername,
      type: 'telegram',
      format: format,
      instructions: {
        es: 'Escanea este QR con la cámara de Telegram para conectar automáticamente con el bot',
        en: 'Scan this QR with Telegram camera to automatically connect with the bot'
      },
      setup_steps: {
        es: [
          '1. Abre Telegram en tu teléfono',
          '2. Toca el icono de búsqueda o escáner QR',
          '3. Escanea este código QR',
          '4. Confirma tu identidad en el chat',
          '5. ¡Listo! Recibirás notificaciones automáticamente'
        ],
        en: [
          '1. Open Telegram on your phone',
          '2. Tap the search icon or QR scanner',
          '3. Scan this QR code',
          '4. Confirm your identity in the chat',
          '5. Done! You will receive automatic notifications'
        ]
      },
      generated_at: new Date().toISOString()
    };

    console.log('✅ QR Telegram generado exitosamente');
    return result;

  } catch (error) {
    console.error('❌ Error generando QR Telegram:', error.message);
    throw new Error(`Error generando QR Telegram: ${error.message}`);
  }
}

/**
 * Generar configuración QR para OwnTracks
 */
async function generateOwnTracksQR(trackerId, options = {}) {
  try {
    const {
      host = process.env.WEB_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000',
      useHttps = true,
      deviceId = trackerId,
      format = 'url'
    } = options;

    console.log('🗺️ Generando QR OwnTracks para:', trackerId);

    // Configuración OwnTracks
    const ownTracksConfig = {
      _type: 'configuration',
      host: host.replace(/^https?:\/\//, ''), // Remove protocol if present
      port: useHttps ? 443 : 80,
      path: '/api/owntracks/location',
      mode: 2, // HTTP mode
      deviceId: deviceId,
      username: trackerId,
      password: generateOwnTracksPassword(trackerId),
      tid: trackerId.substring(0, 2).toUpperCase(), // Tracker ID (2 chars)
      keepalive: 60,
      locatorInterval: 60,
      locatorDisplacement: 10,
      pubTopicBase: `owntracks/user/${trackerId}`,
      willTopic: `owntracks/user/${trackerId}`,
      clientpk: false, // Disable TLS client certificates
      tls: useHttps,
      ws: false, // Use HTTP POST instead of WebSocket
      sub: false, // Don't subscribe to topics
      pub: true,  // Publish location updates
      cleanSession: true,
      autostartOnBoot: true,
      locatorPriority: 2, // Balanced power
      monitoring: 1, // Significant location changes only
      cmd: true, // Allow remote commands
      remoteConfiguration: false,
      experimentalFeatures: []
    };

    const configJson = JSON.stringify(ownTracksConfig);

    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#1e3d59', // EPL CAS primary color
        light: '#FFFFFF'
      },
      width: 256
    };

    let qrResult;
    
    switch (format) {
      case 'base64':
        qrResult = await QRCode.toDataURL(configJson, qrOptions);
        break;
      case 'buffer':
        qrResult = await QRCode.toBuffer(configJson, qrOptions);
        break;
      case 'svg':
        qrResult = await QRCode.toString(configJson, { ...qrOptions, type: 'svg' });
        break;
      default:
        qrResult = configJson;
    }

    const result = {
      config: ownTracksConfig,
      qr_data: qrResult,
      tracker_id: trackerId,
      type: 'owntracks',
      format: format,
      endpoint_url: `${useHttps ? 'https' : 'http'}://${host}/api/owntracks/location`,
      instructions: {
        es: 'Escanea este QR con la app OwnTracks para configurar automáticamente el tracking GPS',
        en: 'Scan this QR with OwnTracks app to automatically configure GPS tracking'
      },
      setup_steps: {
        es: [
          '1. Instala OwnTracks desde tu app store',
          '2. Abre la aplicación OwnTracks',
          '3. Ve a Settings > Configuration',
          '4. Toca "Import" y escanea este QR',
          '5. Confirma la configuración',
          '6. ¡El tracking automático está activado!'
        ],
        en: [
          '1. Install OwnTracks from your app store',
          '2. Open the OwnTracks application',
          '3. Go to Settings > Configuration',
          '4. Tap "Import" and scan this QR',
          '5. Confirm the configuration',
          '6. Automatic tracking is now active!'
        ]
      },
      download_links: {
        android: 'https://play.google.com/store/apps/details?id=org.owntracks.android',
        ios: 'https://apps.apple.com/app/owntracks/id692424691'
      },
      generated_at: new Date().toISOString()
    };

    console.log('✅ QR OwnTracks generado exitosamente');
    return result;

  } catch (error) {
    console.error('❌ Error generando QR OwnTracks:', error.message);
    throw new Error(`Error generando QR OwnTracks: ${error.message}`);
  }
}

/**
 * Generar QR combinado con ambas configuraciones
 */
async function generateCombinedQR(trackerId, options = {}) {
  try {
    const { format = 'base64' } = options;

    console.log('🔗 Generando QR combinado para:', trackerId);

    // Generar ambos QRs
    const [telegramQR, ownTracksQR] = await Promise.all([
      generateTelegramQR(trackerId, { format }),
      generateOwnTracksQR(trackerId, { format })
    ]);

    const result = {
      tracker_id: trackerId,
      type: 'combined',
      telegram: telegramQR,
      owntracks: ownTracksQR,
      generated_at: new Date().toISOString(),
      instructions: {
        es: 'Configuración completa: escanea el QR de Telegram para notificaciones y el QR de OwnTracks para GPS',
        en: 'Complete setup: scan Telegram QR for notifications and OwnTracks QR for GPS'
      }
    };

    console.log('✅ QR combinado generado exitosamente');
    return result;

  } catch (error) {
    console.error('❌ Error generando QR combinado:', error.message);
    throw new Error(`Error generando QR combinado: ${error.message}`);
  }
}

/**
 * Guardar QR como archivo
 */
async function saveQRToFile(qrData, filename, directory = './temp') {
  try {
    // Crear directorio si no existe
    await fs.mkdir(directory, { recursive: true });

    const filePath = path.join(directory, filename);

    if (qrData.format === 'buffer') {
      await fs.writeFile(filePath, qrData.qr_data);
    } else if (qrData.format === 'base64') {
      const base64Data = qrData.qr_data.replace(/^data:image\/png;base64,/, '');
      await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
    } else if (qrData.format === 'svg') {
      await fs.writeFile(filePath, qrData.qr_data);
    } else {
      await fs.writeFile(filePath, JSON.stringify(qrData, null, 2));
    }

    console.log('✅ QR guardado en:', filePath);
    return filePath;

  } catch (error) {
    console.error('❌ Error guardando QR:', error.message);
    throw error;
  }
}

/**
 * Generar password único para OwnTracks
 */
function generateOwnTracksPassword(trackerId) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(`${trackerId}_owntracks_${process.env.DATABASE_URL || 'local'}`).digest('hex').substring(0, 12);
}

/**
 * Validar configuración QR
 */
function validateQRConfig(qrData) {
  try {
    if (!qrData.tracker_id) {
      throw new Error('Tracker ID requerido');
    }

    if (qrData.type === 'telegram') {
      if (!qrData.url || !qrData.url.includes('t.me')) {
        throw new Error('URL de Telegram inválida');
      }
    }

    if (qrData.type === 'owntracks') {
      if (!qrData.config || !qrData.config.host) {
        throw new Error('Configuración OwnTracks inválida');
      }
    }

    console.log('✅ Configuración QR válida');
    return true;

  } catch (error) {
    console.error('❌ Configuración QR inválida:', error.message);
    return false;
  }
}

module.exports = {
  generateTelegramQR,
  generateOwnTracksQR,
  generateCombinedQR,
  saveQRToFile,
  generateOwnTracksPassword,
  validateQRConfig
};