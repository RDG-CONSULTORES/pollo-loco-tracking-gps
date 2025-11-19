const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const crypto = require('crypto');

/**
 * GPS Wizard - Sistema fácil para configurar usuarios GPS
 * Con generación automática de QR codes
 */

/**
 * POST /api/gps-wizard/create-user
 * Crear usuario GPS completo con configuración automática
 */
router.post('/create-user', async (req, res) => {
  try {
    const { displayName, email, phone, role, region, groupName } = req.body;
    
    // Validaciones
    if (!displayName || !email || !role) {
      return res.status(400).json({
        error: 'Campos requeridos: displayName, email, role',
        step: 'validation'
      });
    }
    
    await db.query('BEGIN');
    
    try {
      // 1. Generar tracker ID único
      const trackerId = await generateUniqueTrackerId(role);
      
      // 2. Generar credenciales seguras
      const credentials = generateSecureCredentials(trackerId);
      
      // 3. Obtener role_id
      const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [role]);
      const roleId = roleResult.rows[0]?.id || 5; // default operador
      
      // 4. Obtener director_id si aplica
      let directorId = null;
      if (region) {
        const directorResult = await db.query(
          'SELECT id FROM directors WHERE region = $1 AND active = true LIMIT 1',
          [region]
        );
        directorId = directorResult.rows[0]?.id || null;
      }
      
      // 5. Crear usuario en tracking_users
      const userResult = await db.query(`
        INSERT INTO tracking_users (
          tracker_id, display_name, zenput_email, phone, role, group_name,
          role_id, director_id, active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
        RETURNING *
      `, [
        trackerId, displayName, email, phone, role, 
        groupName || region || 'General', roleId, directorId
      ]);
      
      const newUser = userResult.rows[0];
      
      // 6. Generar configuración OwnTracks
      const ownTracksConfig = generateOwnTracksConfig(newUser, credentials);
      
      // 7. Generar QR code data
      const qrData = generateQRCodeData(ownTracksConfig);
      
      // 8. Guardar credenciales (simplificado - en producción usar vault)
      await db.query(`
        INSERT INTO user_credentials (user_id, tracker_id, username, password_hash, config_data, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          config_data = EXCLUDED.config_data,
          updated_at = NOW()
      `, [
        newUser.id, trackerId, credentials.username, 
        credentials.passwordHash, JSON.stringify(ownTracksConfig)
      ]);
      
      await db.query('COMMIT');
      
      res.status(201).json({
        success: true,
        step: 'completed',
        user: {
          id: newUser.id,
          trackerId,
          displayName,
          email,
          role,
          region,
          active: true
        },
        credentials: {
          username: credentials.username,
          password: credentials.password
        },
        ownTracksConfig,
        qrCode: {
          data: qrData,
          format: 'otpauth://totp/PolloLocoGPS',
          instructions: 'Escanea este código QR con OwnTracks para configuración automática'
        },
        nextSteps: [
          'Descargar OwnTracks desde App Store/Google Play',
          'Escanear código QR con la app',
          'Permitir permisos de ubicación',
          'Verificar primera ubicación'
        ],
        message: `Usuario ${displayName} creado exitosamente con ID: ${trackerId}`
      });
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error in GPS wizard:', error.message);
    res.status(500).json({
      error: 'Error creando usuario GPS',
      step: 'creation_failed',
      details: error.message
    });
  }
});

/**
 * GET /api/gps-wizard/test-connection/:trackerId
 * Verificar primera conexión GPS
 */
router.get('/test-connection/:trackerId', async (req, res) => {
  try {
    const { trackerId } = req.params;
    
    // Buscar usuario
    const userResult = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [trackerId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }
    
    const user = userResult.rows[0];
    
    // Buscar última ubicación (últimos 10 minutos)
    const locationResult = await db.query(`
      SELECT * FROM gps_locations 
      WHERE user_id = $1 
      AND received_at > NOW() - INTERVAL '10 minutes'
      ORDER BY received_at DESC 
      LIMIT 1
    `, [user.id]);
    
    const hasRecentLocation = locationResult.rows.length > 0;
    const lastLocation = locationResult.rows[0];
    
    res.json({
      trackerId,
      user: {
        id: user.id,
        name: user.display_name,
        active: user.active
      },
      connectionStatus: hasRecentLocation ? 'connected' : 'waiting',
      lastLocation: lastLocation ? {
        latitude: lastLocation.latitude,
        longitude: lastLocation.longitude,
        timestamp: lastLocation.received_at,
        accuracy: lastLocation.accuracy,
        battery: lastLocation.battery
      } : null,
      message: hasRecentLocation 
        ? '✅ GPS conectado correctamente'
        : '⏳ Esperando primera ubicación GPS...'
    });
    
  } catch (error) {
    console.error('❌ Error testing GPS connection:', error.message);
    res.status(500).json({
      error: 'Error verificando conexión GPS'
    });
  }
});

/**
 * POST /api/gps-wizard/regenerate-config/:trackerId
 * Regenerar configuración y QR code
 */
router.post('/regenerate-config/:trackerId', async (req, res) => {
  try {
    const { trackerId } = req.params;
    
    // Buscar usuario
    const userResult = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [trackerId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }
    
    const user = userResult.rows[0];
    
    // Generar nuevas credenciales
    const credentials = generateSecureCredentials(trackerId);
    const ownTracksConfig = generateOwnTracksConfig(user, credentials);
    const qrData = generateQRCodeData(ownTracksConfig);
    
    // Actualizar credenciales
    await db.query(`
      UPDATE user_credentials 
      SET username = $1, password_hash = $2, config_data = $3, updated_at = NOW()
      WHERE user_id = $4
    `, [
      credentials.username, credentials.passwordHash, 
      JSON.stringify(ownTracksConfig), user.id
    ]);
    
    res.json({
      success: true,
      trackerId,
      credentials: {
        username: credentials.username,
        password: credentials.password
      },
      ownTracksConfig,
      qrCode: {
        data: qrData,
        format: 'otpauth://totp/PolloLocoGPS'
      },
      message: 'Configuración regenerada exitosamente'
    });
    
  } catch (error) {
    console.error('❌ Error regenerating config:', error.message);
    res.status(500).json({
      error: 'Error regenerando configuración'
    });
  }
});

/**
 * GET /api/gps-wizard/download-config/:trackerId
 * Descargar archivo de configuración
 */
router.get('/download-config/:trackerId', async (req, res) => {
  try {
    const { trackerId } = req.params;
    const { format = 'json' } = req.query;
    
    // Buscar configuración
    const result = await db.query(`
      SELECT tu.*, uc.config_data, uc.username 
      FROM tracking_users tu
      JOIN user_credentials uc ON tu.id = uc.user_id
      WHERE tu.tracker_id = $1
    `, [trackerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Configuración no encontrada'
      });
    }
    
    const user = result.rows[0];
    const config = JSON.parse(user.config_data);
    
    if (format === 'otrc') {
      // Formato OwnTracks
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${trackerId}-config.otrc"`);
      res.json(config);
    } else {
      // Formato JSON legible
      const readableConfig = {
        user: {
          name: user.display_name,
          trackerId: user.tracker_id,
          email: user.zenput_email
        },
        server: {
          url: config.settings.url,
          username: config.settings.username,
          clientId: config.settings.clientId
        },
        instructions: [
          '1. Descargar OwnTracks app',
          '2. Ir a Configuración > Importar',
          '3. Seleccionar este archivo',
          '4. Activar seguimiento'
        ]
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${trackerId}-setup.json"`);
      res.json(readableConfig);
    }
    
  } catch (error) {
    console.error('❌ Error downloading config:', error.message);
    res.status(500).json({
      error: 'Error descargando configuración'
    });
  }
});

/**
 * FUNCIONES AUXILIARES
 */

// Crear tabla de credenciales si no existe
async function ensureCredentialsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES tracking_users(id) ON DELETE CASCADE,
        tracker_id VARCHAR(50) NOT NULL,
        username VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        config_data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_credentials_tracker 
      ON user_credentials(tracker_id)
    `);
    
  } catch (error) {
    console.error('Error ensuring credentials table:', error);
  }
}

// Ejecutar al cargar el módulo
ensureCredentialsTable();

async function generateUniqueTrackerId(role) {
  const prefix = {
    'admin': 'ADM',
    'director': 'DIR',
    'gerente': 'GER', 
    'supervisor': 'SUP',
    'auditor': 'AUD',
    'operador': 'OPR'
  }[role] || 'USR';

  let trackerId;
  let isUnique = false;
  let counter = 1;

  while (!isUnique && counter <= 999) {
    trackerId = `${prefix}${counter.toString().padStart(3, '0')}`;
    
    const result = await db.query(
      'SELECT id FROM tracking_users WHERE tracker_id = $1',
      [trackerId]
    );
    
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      counter++;
    }
  }

  if (!isUnique) {
    throw new Error('No se pueden generar más IDs únicos para este rol');
  }

  return trackerId;
}

function generateSecureCredentials(trackerId) {
  const username = `plgps_${trackerId.toLowerCase()}_${Date.now()}`;
  const password = crypto.randomBytes(16).toString('base64').substring(0, 22);
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
  
  return {
    username,
    password,
    passwordHash
  };
}

function generateOwnTracksConfig(user, credentials) {
  const serverUrl = process.env.WEB_APP_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app';
  
  return {
    "_type": "configuration",
    "version": "1.0.0",
    "created": new Date().toISOString(),
    "settings": {
      "_type": "configuration",
      "mode": 3,  // HTTP mode
      "url": `${serverUrl}/api/owntracks/location`,
      "deviceId": user.tracker_id,
      "tid": user.tracker_id.substring(0, 2),
      "clientId": user.tracker_id,
      "username": credentials.username,
      "password": credentials.password,
      "host": serverUrl.replace('https://', '').replace('http://', ''),
      "port": 443,
      "ws": false,
      "tls": true,
      "auth": true,
      "cleanSession": true,
      "keepalive": 60,
      "locatorInterval": 300,      // 5 minutos normal
      "moveModeLocatorInterval": 60, // 1 minuto en movimiento
      "monitoring": 1,             // Monitoring significativo
      "ranging": true,
      "ignoreStaleLocations": 168, // 7 días
      "autostart": true,
      "notificationEvents": true,
      "notificationLocation": true
    },
    "metadata": {
      "user": user.display_name,
      "email": user.zenput_email,
      "role": user.role,
      "trackerId": user.tracker_id,
      "created": new Date().toISOString(),
      "instructions": {
        "es": [
          "1. Instala OwnTracks desde App Store o Google Play",
          "2. Abre la app y ve a Configuración",
          "3. Selecciona 'Importar configuración'",
          "4. Escanea el código QR o importa este archivo",
          "5. Acepta los permisos de ubicación",
          "6. ¡Listo! Tu GPS está configurado"
        ],
        "en": [
          "1. Install OwnTracks from App Store or Google Play",
          "2. Open app and go to Settings",
          "3. Select 'Import configuration'", 
          "4. Scan QR code or import this file",
          "5. Accept location permissions",
          "6. Done! Your GPS is configured"
        ]
      }
    }
  };
}

function generateQRCodeData(config) {
  // Generar datos para QR compatible con OwnTracks
  const qrData = {
    "_type": "configuration", 
    "settings": config.settings
  };
  
  // Comprimir y codificar
  const jsonString = JSON.stringify(qrData);
  const base64Data = Buffer.from(jsonString).toString('base64');
  
  return {
    raw: jsonString,
    base64: base64Data,
    url: `otpauth://totp/PolloLocoGPS?secret=${base64Data}`,
    qrString: base64Data
  };
}

module.exports = router;