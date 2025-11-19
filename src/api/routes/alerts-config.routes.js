const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * Sistema de Alertas Configurables por Director
 * Cada director puede configurar qué alertas recibir de su región
 */

/**
 * GET /api/alerts-config/director/:directorId
 * Obtener configuración de alertas de un director
 */
router.get('/director/:directorId', async (req, res) => {
  try {
    const { directorId } = req.params;
    
    // Verificar que el director existe
    const directorResult = await db.query(
      'SELECT * FROM directors WHERE id = $1 AND active = true',
      [directorId]
    );
    
    if (directorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const director = directorResult.rows[0];
    
    // Obtener configuración de alertas
    const alertsResult = await db.query(`
      SELECT 
        id, alert_type, enabled, settings, 
        telegram_enabled, email_enabled,
        created_at, updated_at
      FROM director_alerts_config 
      WHERE director_id = $1
      ORDER BY alert_type
    `, [directorId]);
    
    // Si no tiene configuración, crear la default
    if (alertsResult.rows.length === 0) {
      await createDefaultAlertConfig(directorId);
      
      // Obtener la configuración recién creada
      const newAlertsResult = await db.query(`
        SELECT 
          id, alert_type, enabled, settings, 
          telegram_enabled, email_enabled,
          created_at, updated_at
        FROM director_alerts_config 
        WHERE director_id = $1
        ORDER BY alert_type
      `, [directorId]);
      
      return res.json({
        director: {
          id: director.id,
          name: director.name || director.full_name,
          region: director.region
        },
        alerts: newAlertsResult.rows,
        isDefault: true
      });
    }
    
    res.json({
      director: {
        id: director.id,
        name: director.name || director.full_name,
        region: director.region
      },
      alerts: alertsResult.rows,
      isDefault: false
    });
    
  } catch (error) {
    console.error('❌ Error getting director alerts config:', error.message);
    res.status(500).json({
      error: 'Error obteniendo configuración de alertas'
    });
  }
});

/**
 * PUT /api/alerts-config/director/:directorId
 * Actualizar configuración de alertas de un director
 */
router.put('/director/:directorId', async (req, res) => {
  try {
    const { directorId } = req.params;
    const { alerts } = req.body;
    
    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({
        error: 'Se requiere array de alertas'
      });
    }
    
    // Verificar director
    const directorResult = await db.query(
      'SELECT * FROM directors WHERE id = $1 AND active = true',
      [directorId]
    );
    
    if (directorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    await db.query('BEGIN');
    
    try {
      // Actualizar cada configuración de alerta
      for (const alert of alerts) {
        await db.query(`
          UPDATE director_alerts_config 
          SET 
            enabled = $1,
            telegram_enabled = $2,
            email_enabled = $3,
            settings = $4,
            updated_at = NOW()
          WHERE director_id = $5 AND alert_type = $6
        `, [
          alert.enabled,
          alert.telegram_enabled,
          alert.email_enabled,
          JSON.stringify(alert.settings || {}),
          directorId,
          alert.alert_type
        ]);
      }
      
      await db.query('COMMIT');
      
      // Obtener configuración actualizada
      const updatedResult = await db.query(`
        SELECT 
          id, alert_type, enabled, settings, 
          telegram_enabled, email_enabled,
          updated_at
        FROM director_alerts_config 
        WHERE director_id = $1
        ORDER BY alert_type
      `, [directorId]);
      
      res.json({
        success: true,
        message: 'Configuración de alertas actualizada',
        alerts: updatedResult.rows
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error updating director alerts config:', error.message);
    res.status(500).json({
      error: 'Error actualizando configuración de alertas'
    });
  }
});

/**
 * GET /api/alerts-config/types
 * Obtener tipos de alertas disponibles
 */
router.get('/types', async (req, res) => {
  try {
    const alertTypes = [
      {
        type: 'geofence_entry',
        name: 'Entrada a Sucursal',
        description: 'Cuando un usuario entra a una sucursal',
        icon: '📍',
        category: 'location',
        defaultEnabled: true,
        settings: {
          workingHoursOnly: true,
          minInterval: 60, // minutos
          includeUserInfo: true
        }
      },
      {
        type: 'geofence_exit',
        name: 'Salida de Sucursal', 
        description: 'Cuando un usuario sale de una sucursal',
        icon: '🚪',
        category: 'location',
        defaultEnabled: false,
        settings: {
          workingHoursOnly: true,
          minInterval: 60,
          includeUserInfo: true
        }
      },
      {
        type: 'user_offline',
        name: 'Usuario Desconectado',
        description: 'Cuando un usuario no envía ubicación por tiempo prolongado',
        icon: '📵',
        category: 'connectivity',
        defaultEnabled: true,
        settings: {
          timeoutMinutes: 30,
          workingHoursOnly: true,
          excludeWeekends: true
        }
      },
      {
        type: 'low_battery',
        name: 'Batería Baja',
        description: 'Cuando la batería del dispositivo está baja',
        icon: '🔋',
        category: 'device',
        defaultEnabled: true,
        settings: {
          batteryThreshold: 20,
          workingHoursOnly: false,
          maxAlertsPerDay: 3
        }
      },
      {
        type: 'route_deviation',
        name: 'Desviación de Ruta',
        description: 'Cuando un usuario se desvía significativamente de la ruta',
        icon: '🛣️',
        category: 'route',
        defaultEnabled: false,
        settings: {
          deviationThresholdKm: 2,
          workingHoursOnly: true,
          alertAfterMinutes: 15
        }
      },
      {
        type: 'long_stop',
        name: 'Parada Prolongada',
        description: 'Cuando un usuario permanece en un lugar por mucho tiempo',
        icon: '⏰',
        category: 'behavior', 
        defaultEnabled: false,
        settings: {
          stopThresholdMinutes: 60,
          workingHoursOnly: true,
          excludeBreakTime: true
        }
      },
      {
        type: 'daily_summary',
        name: 'Resumen Diario',
        description: 'Reporte diario de actividad de la región',
        icon: '📊',
        category: 'reports',
        defaultEnabled: true,
        settings: {
          sendTime: '18:00',
          includeMetrics: true,
          includeTopVisits: true
        }
      },
      {
        type: 'weekly_summary',
        name: 'Resumen Semanal',
        description: 'Reporte semanal de métricas y rendimiento',
        icon: '📈',
        category: 'reports',
        defaultEnabled: true,
        settings: {
          sendDay: 'friday',
          sendTime: '17:00',
          includeComparison: true
        }
      }
    ];
    
    res.json({
      alertTypes,
      categories: [
        { id: 'location', name: 'Ubicación', icon: '📍' },
        { id: 'connectivity', name: 'Conectividad', icon: '📶' },
        { id: 'device', name: 'Dispositivo', icon: '📱' },
        { id: 'route', name: 'Rutas', icon: '🛣️' },
        { id: 'behavior', name: 'Comportamiento', icon: '👤' },
        { id: 'reports', name: 'Reportes', icon: '📊' }
      ]
    });
    
  } catch (error) {
    console.error('❌ Error getting alert types:', error.message);
    res.status(500).json({
      error: 'Error obteniendo tipos de alertas'
    });
  }
});

/**
 * POST /api/alerts-config/test/:directorId/:alertType
 * Enviar alerta de prueba
 */
router.post('/test/:directorId/:alertType', async (req, res) => {
  try {
    const { directorId, alertType } = req.params;
    
    // Verificar director
    const directorResult = await db.query(
      'SELECT * FROM directors WHERE id = $1 AND active = true',
      [directorId]
    );
    
    if (directorResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Director no encontrado'
      });
    }
    
    const director = directorResult.rows[0];
    
    // Verificar configuración de alerta
    const alertResult = await db.query(
      'SELECT * FROM director_alerts_config WHERE director_id = $1 AND alert_type = $2',
      [directorId, alertType]
    );
    
    if (alertResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Configuración de alerta no encontrada'
      });
    }
    
    const alertConfig = alertResult.rows[0];
    
    // Simular envío de alerta de prueba
    const testAlert = {
      type: alertType,
      director: director.name || director.full_name,
      region: director.region,
      timestamp: new Date().toISOString(),
      message: `🧪 PRUEBA: Esta es una alerta de prueba del tipo "${alertType}"`,
      isTest: true
    };
    
    // TODO: Aquí se integraría con el sistema real de notificaciones
    // Por ahora solo simulamos
    
    res.json({
      success: true,
      message: 'Alerta de prueba enviada',
      alert: testAlert,
      sent: {
        telegram: alertConfig.telegram_enabled,
        email: alertConfig.email_enabled
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending test alert:', error.message);
    res.status(500).json({
      error: 'Error enviando alerta de prueba'
    });
  }
});

/**
 * FUNCIONES AUXILIARES
 */

// Crear tabla de configuración de alertas si no existe
async function ensureAlertsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS director_alerts_config (
        id SERIAL PRIMARY KEY,
        director_id INTEGER REFERENCES directors(id) ON DELETE CASCADE,
        alert_type VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        telegram_enabled BOOLEAN DEFAULT true,
        email_enabled BOOLEAN DEFAULT false,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(director_id, alert_type)
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_director_alerts_director
      ON director_alerts_config(director_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_director_alerts_type
      ON director_alerts_config(alert_type)
    `);
    
  } catch (error) {
    console.error('Error ensuring alerts table:', error);
  }
}

// Crear configuración por defecto para un director
async function createDefaultAlertConfig(directorId) {
  const defaultAlerts = [
    {
      type: 'geofence_entry',
      enabled: true,
      telegram_enabled: true,
      email_enabled: false,
      settings: { workingHoursOnly: true, minInterval: 60 }
    },
    {
      type: 'geofence_exit', 
      enabled: false,
      telegram_enabled: true,
      email_enabled: false,
      settings: { workingHoursOnly: true, minInterval: 60 }
    },
    {
      type: 'user_offline',
      enabled: true,
      telegram_enabled: true,
      email_enabled: false,
      settings: { timeoutMinutes: 30, workingHoursOnly: true }
    },
    {
      type: 'low_battery',
      enabled: true,
      telegram_enabled: true,
      email_enabled: false,
      settings: { batteryThreshold: 20, maxAlertsPerDay: 3 }
    },
    {
      type: 'route_deviation',
      enabled: false,
      telegram_enabled: true,
      email_enabled: false,
      settings: { deviationThresholdKm: 2, alertAfterMinutes: 15 }
    },
    {
      type: 'long_stop',
      enabled: false,
      telegram_enabled: true,
      email_enabled: false,
      settings: { stopThresholdMinutes: 60, workingHoursOnly: true }
    },
    {
      type: 'daily_summary',
      enabled: true,
      telegram_enabled: true,
      email_enabled: false,
      settings: { sendTime: '18:00', includeMetrics: true }
    },
    {
      type: 'weekly_summary',
      enabled: true,
      telegram_enabled: true,
      email_enabled: false,
      settings: { sendDay: 'friday', sendTime: '17:00' }
    }
  ];
  
  for (const alert of defaultAlerts) {
    await db.query(`
      INSERT INTO director_alerts_config (
        director_id, alert_type, enabled, telegram_enabled, 
        email_enabled, settings, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (director_id, alert_type) DO NOTHING
    `, [
      directorId, alert.type, alert.enabled, 
      alert.telegram_enabled, alert.email_enabled,
      JSON.stringify(alert.settings)
    ]);
  }
}

// Ejecutar al cargar el módulo
ensureAlertsTable();

module.exports = router;