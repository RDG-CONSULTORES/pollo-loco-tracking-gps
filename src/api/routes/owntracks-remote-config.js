/**
 * Sistema de configuración remota para OwnTracks
 * Optimiza automáticamente dispositivos sin tocarlos físicamente
 */

const express = require('express');
const router = express.Router();

// Configuración optimizada que se enviará a los dispositivos
const OPTIMAL_CONFIG = {
  // Configuraciones críticas para geofencing empresarial
  "_type": "configuration",
  "locatorInterval": 15,        // Ubicación cada 15 segundos cuando se mueve
  "locatorDisplacement": 5,     // Reportar cuando se mueva >5 metros
  "monitoring": 2,              // Modo alto rendimiento
  "ranging": true,              // Habilitar ranging para geofences
  "regionRadius": 100,          // Radio por defecto para regiones
  "pubRetain": false,           // No retener mensajes
  "cleanSession": true,         // Limpiar sesión en reconexión
  "keepalive": 60,              // Keep alive 60 segundos
  "ignoreInaccurateLocations": 50, // Ignorar ubicaciones >50m precisión
  "suppressedLocationMessages": false, // No suprimir mensajes
  
  // Configuraciones de batería optimizadas
  "ignoreStaleLocations": 300,  // Ignorar ubicaciones >5 minutos
  "locatorPriority": 2,         // Alta prioridad para GPS
  "moveModeLocatorInterval": 10, // Cada 10s cuando en movimiento
  "autostartOnBoot": true,      // Autostart
  
  // Configuraciones de conectividad
  "connectionTimeoutSeconds": 30,
  "mqttProtocolLevel": 4,       // MQTT 3.1.1
  "pubTopicBase": true,         // Usar topic base
  
  // Configuraciones específicas para empresa
  "tid": "auto",                // Tracker ID automático
  "deviceId": "auto",           // Device ID automático
  "clientId": "auto"            // Client ID automático
};

// Endpoint para servir configuración optimizada
router.get('/config/optimal', (req, res) => {
  console.log('📱 Enviando configuración optimizada a dispositivo');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="owntracks-optimal.otrc"');
  
  res.json(OPTIMAL_CONFIG);
});

// Endpoint para configuración específica por usuario
router.get('/config/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Personalizar configuración basada en usuario
    const userConfig = { ...OPTIMAL_CONFIG };
    
    // Si es admin o usuario VIP, configuración más agresiva
    const user = await req.db.query(
      'SELECT role, display_name FROM tracking_users WHERE id = $1',
      [userId]
    );
    
    if (user.rows.length > 0) {
      const userData = user.rows[0];
      
      if (userData.role === 'admin' || userData.display_name.includes('Roberto')) {
        // Configuración súper agresiva para testing/admin
        userConfig.locatorInterval = 10;      // Cada 10 segundos
        userConfig.locatorDisplacement = 3;   // Cada 3 metros
        userConfig.moveModeLocatorInterval = 5; // Cada 5s en movimiento
        
        console.log(`⚡ Usuario ${userId}: Configuración VIP aplicada`);
      }
      
      userConfig.tid = userId.toString();
      userConfig.deviceId = `pollo-loco-${userId}`;
      userConfig.clientId = `polloLoco${userId}`;
    }
    
    res.json(userConfig);
    
  } catch (error) {
    console.error('❌ Error configuración usuario:', error.message);
    res.status(500).json({ error: 'Error generating config' });
  }
});

// Endpoint para estadísticas de configuración
router.get('/config/stats', async (req, res) => {
  try {
    const stats = await req.db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_location_time >= NOW() - INTERVAL '1 hour' THEN 1 END) as active_hour,
        COUNT(CASE WHEN last_location_time >= NOW() - INTERVAL '10 minutes' THEN 1 END) as active_10min
      FROM tracking_users
      WHERE active = true
    `);
    
    res.json({
      success: true,
      stats: stats.rows[0],
      optimal_config_available: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;