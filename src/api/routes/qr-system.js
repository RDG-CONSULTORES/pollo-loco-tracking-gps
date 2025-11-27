/**
 * API Routes para sistema QR automático
 */

const express = require('express');
const router = express.Router();
const qrGenerator = require('../../services/qr-generator');

// Generar QR para usuario específico
router.get('/qr/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const format = req.query.format || 'base64';
    
    console.log(`📱 Generando QR para usuario ${userId}`);
    
    const qrData = await qrGenerator.generateQRCode(userId, format);
    
    if (format === 'image') {
      res.setHeader('Content-Type', 'image/png');
      res.send(qrData.qrCode);
    } else {
      res.json({
        success: true,
        qr_code: qrData.qrCode,
        config_url: qrData.configUrl,
        owntracks_url: qrData.ownTracksUrl,
        instructions: 'Escanea el QR con OwnTracks para configuración automática'
      });
    }
    
  } catch (error) {
    console.error('❌ Error generando QR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Servir configuración OwnTracks por usuario  
router.get('/config/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    console.log(`⚙️ Sirviendo configuración para usuario ${userId}`);
    
    const config = await qrGenerator.generateOwnTracksConfig(userId);
    
    // Headers para OwnTracks
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="pollo-loco-${userId}.otrc"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.json(config);
    
  } catch (error) {
    console.error('❌ Error sirviendo config:', error.message);
    res.status(500).json({
      error: 'Error generando configuración'
    });
  }
});

// Verificar estado configuración usuario
router.get('/verify/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const configured = await qrGenerator.verifyConfigurationApplied(userId);
    
    res.json({
      success: true,
      user_id: userId,
      configured: configured,
      message: configured ? 
        'Usuario configurado correctamente' : 
        'Usuario no ha completado configuración',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Página de instrucciones
router.get('/instructions', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración OwnTracks - Pollo Loco GPS</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
      .container { max-width: 600px; margin: 0 auto; }
      .step { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 10px; }
      .highlight { color: #007AFF; font-weight: bold; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>📱 Configuración OwnTracks</h1>
      
      <div class="step">
        <h3>1. Instalar OwnTracks</h3>
        <p><strong>Android:</strong> <a href="https://play.google.com/store/apps/details?id=org.owntracks.android">Google Play Store</a></p>
        <p><strong>iOS:</strong> <a href="https://apps.apple.com/app/owntracks/id692424691">App Store</a></p>
      </div>
      
      <div class="step">
        <h3>2. Escanear QR</h3>
        <p>Abre OwnTracks → <span class="highlight">Configuración</span> → <span class="highlight">Configurar</span> → <span class="highlight">Escanear QR</span></p>
        <p>Escanea el código QR que recibiste</p>
      </div>
      
      <div class="step">
        <h3>3. Verificar conexión</h3>
        <p>Verifica que aparezca <span class="highlight">Conectado</span> en la app</p>
        <p>Tu ubicación debería aparecer automáticamente en el sistema</p>
      </div>
      
      <div class="step">
        <h3>📞 Soporte</h3>
        <p>¿Problemas? Contacta: <strong>roberto@pollolocogps.com</strong></p>
      </div>
    </div>
  </body>
  </html>
  `;
  
  res.send(html);
});

module.exports = router;