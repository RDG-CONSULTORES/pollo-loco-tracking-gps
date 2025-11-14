const express = require('express');
const router = express.Router();
const configGenerator = require('../../services/owntracks-config-generator');
const db = require('../../config/database');

/**
 * API Routes para Configuración Automática de OwnTracks
 * Proporciona endpoints para generar y distribuir configuraciones inteligentes
 */

/**
 * GET /api/owntracks/config/:trackerId
 * Generar configuración automática para un tracker específico
 */
router.get('/config/:trackerId', async (req, res) => {
  try {
    const { trackerId } = req.params;
    const { profile, context, format } = req.query;
    
    console.log(`⚙️ [CONFIG-API] Generating config for ${trackerId}`);
    
    // Validar que el usuario existe y está activo
    const user = await configGenerator.getUserData(trackerId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        trackerId: trackerId,
        message: 'The specified tracker ID does not exist or is inactive'
      });
    }
    
    // Generar configuración
    let config;
    if (context) {
      config = await configGenerator.generateAdaptiveConfig(trackerId, context);
    } else {
      config = await configGenerator.generateConfig(trackerId, { 
        forcedProfile: profile 
      });
    }
    
    // Validar configuración
    const validation = configGenerator.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration generated',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // Log de auditoría
    await logConfigRequest(trackerId, req.ip, context || 'automatic');
    
    // Determinar formato de respuesta
    switch (format) {
      case 'json':
        res.json(config);
        break;
        
      case 'otrc':
        // Formato .otrc para importación directa en OwnTracks
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${trackerId}.otrc"`);
        res.send(JSON.stringify(config));
        break;
        
      default:
        // JSON con metadatos adicionales
        res.json({
          configuration: config,
          metadata: {
            generatedFor: trackerId,
            userName: user.display_name,
            profile: config.profile || 'auto',
            generatedAt: new Date().toISOString(),
            serverVersion: '2.0',
            validation: validation
          }
        });
    }
    
    console.log(`✅ [CONFIG-API] Config delivered for ${trackerId} (${config.profile} profile)`);
    
  } catch (error) {
    console.error('❌ [CONFIG-API] Error generating config:', error);
    res.status(500).json({
      error: 'Configuration generation failed',
      message: error.message,
      trackerId: req.params.trackerId
    });
  }
});

/**
 * GET /api/owntracks/config/:trackerId/qr
 * Generar código QR para importación rápida en OwnTracks
 */
router.get('/config/:trackerId/qr', async (req, res) => {
  try {
    const { trackerId } = req.params;
    
    // Generar URL de configuración
    const configUrl = `${process.env.WEB_APP_URL}/api/owntracks/config/${trackerId}?format=otrc`;
    
    // TODO: Implementar generación de QR
    // Por ahora, devolver la URL
    res.json({
      configUrl: configUrl,
      qrData: configUrl,
      instructions: [
        "1. Abrir OwnTracks en tu dispositivo",
        "2. Ir a Configuración → Import/Export", 
        "3. Escanear este código QR o usar la URL",
        "4. Confirmar la importación",
        "5. El tracking automático se iniciará"
      ]
    });
    
  } catch (error) {
    console.error('❌ [CONFIG-API] Error generating QR:', error);
    res.status(500).json({
      error: 'QR generation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/owntracks/config/:trackerId/update
 * Actualizar configuración basada en feedback del dispositivo
 */
router.post('/config/:trackerId/update', async (req, res) => {
  try {
    const { trackerId } = req.params;
    const { batteryLevel, networkType, accuracy, feedback } = req.body;
    
    console.log(`🔄 [CONFIG-API] Update request for ${trackerId}:`, { batteryLevel, networkType, accuracy });
    
    // Determinar necesidad de adaptación
    let adaptedContext = 'work'; // Default
    
    if (batteryLevel && batteryLevel < 20) {
      adaptedContext = 'battery_low';
    } else if (networkType === '2G' || accuracy > 100) {
      adaptedContext = 'conservative';
    } else if (feedback === 'too_frequent') {
      adaptedContext = 'conservative';
    } else if (feedback === 'not_frequent_enough') {
      adaptedContext = 'active';
    }
    
    // Generar nueva configuración adaptada
    const updatedConfig = await configGenerator.generateAdaptiveConfig(trackerId, adaptedContext);
    
    // Log de adaptación
    await logConfigAdaptation(trackerId, adaptedContext, { 
      batteryLevel, 
      networkType, 
      accuracy, 
      feedback 
    });
    
    res.json({
      adapted: true,
      newContext: adaptedContext,
      configuration: updatedConfig,
      reason: `Adapted to ${adaptedContext} due to device conditions`
    });
    
    console.log(`🔄 [CONFIG-API] Config adapted for ${trackerId}: ${adaptedContext}`);
    
  } catch (error) {
    console.error('❌ [CONFIG-API] Error updating config:', error);
    res.status(500).json({
      error: 'Configuration update failed',
      message: error.message
    });
  }
});

/**
 * GET /api/owntracks/profiles
 * Obtener información sobre perfiles de tracking disponibles
 */
router.get('/profiles', async (req, res) => {
  try {
    const profiles = {
      active: {
        name: 'Supervisor Activo',
        description: 'Máxima frecuencia de tracking para supervisores muy activos',
        interval: '30 segundos',
        batteryImpact: 'Alto',
        precision: 'Máxima',
        recommended: 'Supervisores que visitan +10 sucursales/día'
      },
      
      normal: {
        name: 'Supervisor Normal', 
        description: 'Configuración balanceada para uso diario',
        interval: '1 minuto',
        batteryImpact: 'Medio',
        precision: 'Alta',
        recommended: 'Mayoría de supervisores - configuración por defecto'
      },
      
      conservative: {
        name: 'Supervisor Conservativo',
        description: 'Menor frecuencia para conservar batería',
        interval: '2 minutos', 
        batteryImpact: 'Bajo',
        precision: 'Media',
        recommended: 'Supervisores con uso limitado o dispositivos antiguos'
      },
      
      battery_saver: {
        name: 'Ahorro de Batería',
        description: 'Mínima frecuencia para máximo ahorro de batería',
        interval: '5 minutos',
        batteryImpact: 'Muy Bajo',
        precision: 'Básica',
        recommended: 'Dispositivos con batería baja o uso esporádico'
      }
    };
    
    res.json({
      profiles: profiles,
      defaultProfile: 'normal',
      adaptiveFeatures: [
        'Detección automática de actividad',
        'Ajuste dinámico según batería',
        'Optimización por red disponible',
        'Horarios laborales inteligentes'
      ]
    });
    
  } catch (error) {
    console.error('❌ [CONFIG-API] Error getting profiles:', error);
    res.status(500).json({
      error: 'Failed to get profiles',
      message: error.message
    });
  }
});

/**
 * GET /api/owntracks/config/:trackerId/status
 * Obtener estado actual de configuración del usuario
 */
router.get('/config/:trackerId/status', async (req, res) => {
  try {
    const { trackerId } = req.params;
    
    // Obtener datos del usuario
    const user = await configGenerator.getUserData(trackerId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        trackerId: trackerId
      });
    }
    
    // Obtener estadísticas de actividad
    const activityResult = await db.query(`
      SELECT 
        COUNT(*) as total_locations,
        MAX(gps_timestamp) as last_location_time,
        AVG(accuracy) as avg_accuracy,
        AVG(battery) as avg_battery
      FROM gps_locations 
      WHERE user_id = $1 
        AND gps_timestamp >= NOW() - INTERVAL '24 hours'
    `, [user.id]);
    
    const activity = activityResult.rows[0];
    
    // Obtener último perfil determinado
    const currentProfile = await configGenerator.determineTrackingProfile(user);
    
    // Calcular estado del tracking
    const lastLocationTime = activity.last_location_time ? 
      new Date(activity.last_location_time) : null;
    const minutesSinceLastLocation = lastLocationTime ? 
      Math.floor((new Date() - lastLocationTime) / (1000 * 60)) : null;
    
    let trackingStatus = 'unknown';
    if (minutesSinceLastLocation !== null) {
      if (minutesSinceLastLocation < 5) {
        trackingStatus = 'active';
      } else if (minutesSinceLastLocation < 60) {
        trackingStatus = 'recent';
      } else if (minutesSinceLastLocation < 1440) { // 24 hours
        trackingStatus = 'inactive';
      } else {
        trackingStatus = 'offline';
      }
    }
    
    res.json({
      trackerId: trackerId,
      userName: user.display_name,
      trackingStatus: trackingStatus,
      currentProfile: currentProfile,
      lastSeen: lastLocationTime,
      minutesSinceLastLocation: minutesSinceLastLocation,
      activity24h: {
        totalLocations: parseInt(activity.total_locations) || 0,
        averageAccuracy: Math.round(parseFloat(activity.avg_accuracy)) || null,
        averageBattery: Math.round(parseFloat(activity.avg_battery)) || null
      },
      configurationReady: true,
      configUrl: `${process.env.WEB_APP_URL}/api/owntracks/config/${trackerId}`
    });
    
  } catch (error) {
    console.error('❌ [CONFIG-API] Error getting status:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

/**
 * Funciones auxiliares
 */

async function logConfigRequest(trackerId, ip, context) {
  try {
    await db.query(`
      INSERT INTO tracking_config_log (tracker_id, action, context, ip_address, timestamp)
      VALUES ($1, 'config_requested', $2, $3, NOW())
      ON CONFLICT DO NOTHING
    `, [trackerId, context, ip]);
  } catch (error) {
    console.error('❌ Error logging config request:', error);
  }
}

async function logConfigAdaptation(trackerId, newContext, conditions) {
  try {
    await db.query(`
      INSERT INTO tracking_config_log (tracker_id, action, context, metadata, timestamp)
      VALUES ($1, 'config_adapted', $2, $3, NOW())
    `, [trackerId, newContext, JSON.stringify(conditions)]);
  } catch (error) {
    console.error('❌ Error logging config adaptation:', error);
  }
}

module.exports = router;