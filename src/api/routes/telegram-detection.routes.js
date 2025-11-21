const express = require('express');
const router = express.Router();
const TelegramBot = require('node-telegram-bot-api');
const db = require('../../config/database');
const { config } = require('../../config/telegram');

/**
 * Telegram Detection Routes - Mini-Step 1B
 * AUTO-DETECTION @username → Telegram ID
 * ZERO MODIFICATION to existing functionality
 */

/**
 * POST /api/telegram/detect-user
 * Auto-detect Telegram user from @username
 */
router.post('/detect-user', async (req, res) => {
  try {
    const { username, display_name, role = 'employee', group_name = 'general' } = req.body;
    
    console.log('🔍 Iniciando detección de usuario Telegram...', { username, display_name });
    
    // Validate input
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username de Telegram requerido',
        code: 'USERNAME_REQUIRED'
      });
    }
    
    // Clean username (remove @ if provided)
    const cleanUsername = username.replace('@', '').toLowerCase().trim();
    
    if (cleanUsername.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Username debe tener al menos 2 caracteres',
        code: 'USERNAME_TOO_SHORT'
      });
    }
    
    // Check if bot is available
    if (!config.botToken) {
      return res.status(500).json({
        success: false,
        error: 'Bot de Telegram no configurado',
        code: 'BOT_NOT_CONFIGURED'
      });
    }
    
    // Try to detect user via Telegram Bot API
    let telegramId = null;
    let telegramInfo = null;
    
    try {
      // Create temporary bot instance for detection
      const bot = new TelegramBot(config.botToken, { polling: false });
      
      // Strategy 1: Try to get user info if they have interacted with bot
      // Note: This requires the user to have started the bot first
      // We'll implement a fallback system for this
      
      console.log(`🔍 Buscando @${cleanUsername} en Telegram...`);
      
      // For now, we'll store the username and generate a tracking ID
      // The actual telegram_id will be resolved when user starts the bot
      
    } catch (telegramError) {
      console.log('⚠️ No se pudo detectar automáticamente, usando modo manual:', telegramError.message);
      // This is expected - we'll handle it gracefully
    }
    
    // Generate tracker_id from username
    const trackerIdBase = cleanUsername.toUpperCase().substring(0, 8);
    const timestamp = Date.now().toString().slice(-4);
    const trackerId = `${trackerIdBase}_${timestamp}`;
    
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1 OR telegram_username = $2',
      [trackerId, cleanUsername]
    );
    
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      return res.json({
        success: true,
        message: 'Usuario ya existe en el sistema',
        user: {
          tracker_id: user.tracker_id,
          display_name: user.display_name,
          telegram_username: user.telegram_username,
          telegram_id: user.telegram_id,
          role: user.role,
          active: user.active,
          detection_status: user.telegram_id ? 'detected' : 'pending'
        },
        action: 'existing'
      });
    }
    
    // Create new user with pending Telegram detection
    const insertResult = await db.query(`
      INSERT INTO tracking_users (
        tracker_id,
        display_name,
        telegram_username,
        telegram_id,
        role,
        group_name,
        active,
        created_at,
        detection_status,
        detection_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
      RETURNING *
    `, [
      trackerId,
      display_name || `User ${cleanUsername}`,
      cleanUsername,
      telegramId, // Will be null initially
      role,
      group_name,
      true,
      'pending_detection',
      'api_automatic'
    ]);
    
    const newUser = insertResult.rows[0];
    
    // Log the detection attempt
    console.log('✅ Usuario creado con detección pendiente:', {
      tracker_id: newUser.tracker_id,
      username: cleanUsername,
      telegram_id: telegramId || 'pending'
    });
    
    res.json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        tracker_id: newUser.tracker_id,
        display_name: newUser.display_name,
        telegram_username: newUser.telegram_username,
        telegram_id: newUser.telegram_id,
        role: newUser.role,
        active: newUser.active,
        detection_status: telegramId ? 'detected' : 'pending'
      },
      action: 'created',
      next_steps: {
        telegram_setup: `Usuario debe iniciar conversación con el bot: /start`,
        owntracks_config: `Configurar OwnTracks con tracker_id: ${newUser.tracker_id}`,
        manual_detection: telegramId ? false : true
      }
    });
    
  } catch (error) {
    console.error('❌ Error en detección de usuario Telegram:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/telegram/detection-status/:tracker_id
 * Check detection status for a user
 */
router.get('/detection-status/:tracker_id', async (req, res) => {
  try {
    const { tracker_id } = req.params;
    
    console.log(`🔍 Verificando status de detección para: ${tracker_id}`);
    
    const result = await db.query(`
      SELECT 
        tracker_id,
        display_name,
        telegram_username,
        telegram_id,
        role,
        active,
        detection_status,
        detection_method,
        created_at,
        last_location_time
      FROM tracking_users 
      WHERE tracker_id = $1
    `, [tracker_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    const user = result.rows[0];
    
    res.json({
      success: true,
      user: {
        tracker_id: user.tracker_id,
        display_name: user.display_name,
        telegram_username: user.telegram_username,
        telegram_id: user.telegram_id,
        role: user.role,
        active: user.active,
        detection_status: user.detection_status || (user.telegram_id ? 'detected' : 'pending'),
        last_activity: user.last_location_time,
        created_at: user.created_at
      },
      status: {
        telegram_detected: !!user.telegram_id,
        owntracks_active: !!user.last_location_time,
        fully_configured: !!(user.telegram_id && user.last_location_time)
      }
    });
    
  } catch (error) {
    console.error('❌ Error verificando status de detección:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * GET /api/telegram/pending-detections
 * Get list of users with pending Telegram detection
 */
router.get('/pending-detections', async (req, res) => {
  try {
    console.log('📋 Obteniendo usuarios con detección pendiente...');
    
    const result = await db.query(`
      SELECT 
        tracker_id,
        display_name,
        telegram_username,
        telegram_id,
        role,
        group_name,
        active,
        created_at,
        detection_status
      FROM tracking_users 
      WHERE telegram_id IS NULL 
        AND telegram_username IS NOT NULL
        AND active = true
      ORDER BY created_at DESC
    `);
    
    const pendingUsers = result.rows.map(user => ({
      tracker_id: user.tracker_id,
      display_name: user.display_name,
      telegram_username: user.telegram_username,
      role: user.role,
      group_name: user.group_name,
      created_at: user.created_at,
      pending_days: Math.ceil((Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
    }));
    
    res.json({
      success: true,
      pending_users: pendingUsers,
      total_pending: pendingUsers.length,
      summary: {
        total: pendingUsers.length,
        recent_24h: pendingUsers.filter(u => u.pending_days <= 1).length,
        older_than_week: pendingUsers.filter(u => u.pending_days > 7).length
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios pendientes:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/telegram/manual-link
 * Manually link telegram_id to existing user
 */
router.post('/manual-link', async (req, res) => {
  try {
    const { tracker_id, telegram_id } = req.body;
    
    console.log(`🔗 Vinculación manual: ${tracker_id} → ${telegram_id}`);
    
    if (!tracker_id || !telegram_id) {
      return res.status(400).json({
        success: false,
        error: 'tracker_id y telegram_id requeridos',
        code: 'MISSING_PARAMETERS'
      });
    }
    
    // Verify user exists
    const userCheck = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Check if telegram_id is already used
    const telegramCheck = await db.query(
      'SELECT * FROM tracking_users WHERE telegram_id = $1 AND tracker_id != $2',
      [telegram_id, tracker_id]
    );
    
    if (telegramCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID ya está vinculado a otro usuario',
        code: 'TELEGRAM_ID_IN_USE',
        existing_user: telegramCheck.rows[0].tracker_id
      });
    }
    
    // Update user with telegram_id
    const updateResult = await db.query(`
      UPDATE tracking_users 
      SET 
        telegram_id = $1,
        detection_status = 'manual_linked',
        detection_method = 'manual_admin',
        updated_at = NOW()
      WHERE tracker_id = $2
      RETURNING *
    `, [telegram_id, tracker_id]);
    
    const updatedUser = updateResult.rows[0];
    
    console.log('✅ Vinculación manual exitosa:', {
      tracker_id: updatedUser.tracker_id,
      telegram_id: updatedUser.telegram_id
    });
    
    res.json({
      success: true,
      message: 'Usuario vinculado exitosamente',
      user: {
        tracker_id: updatedUser.tracker_id,
        display_name: updatedUser.display_name,
        telegram_username: updatedUser.telegram_username,
        telegram_id: updatedUser.telegram_id,
        detection_status: 'manual_linked'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en vinculación manual:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
});

module.exports = router;