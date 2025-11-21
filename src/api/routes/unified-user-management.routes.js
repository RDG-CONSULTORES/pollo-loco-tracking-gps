const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../../config/database');

/**
 * Unified User Management Routes - EPL CAS
 * Panel Unificado para creación de usuarios con permisos granulares
 * Mini-Step 1B Plus: Complete user onboarding system
 */

/**
 * POST /api/users/create-unified
 * Create user with complete onboarding and permissions
 */
router.post('/create-unified', async (req, res) => {
  try {
    console.log('👥 Iniciando creación de usuario unificada EPL CAS...');
    
    const {
      // Datos básicos
      full_name,
      email,
      phone,
      position,
      
      // Jerarquía organizacional
      role,
      operational_groups = [],
      
      // Permisos del sistema
      permissions = {},
      
      // Configuraciones digitales
      telegram_required = false,
      owntracks_required = true,
      
      // Credenciales
      auto_generate_password = true,
      custom_password = null,
      send_credentials_method = 'email' // email, whatsapp, manual
      
    } = req.body;
    
    // Validaciones básicas
    if (!full_name || !email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Datos básicos requeridos: full_name, email, role',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Validación de grupos operativos para directors
    if (role === 'director' && operational_groups.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Director debe tener al menos un grupo operativo asignado',
        code: 'DIRECTOR_NEEDS_GROUPS'
      });
    }
    
    // Verificar si el email ya existe
    const existingUser = await db.query(
      'SELECT id, email FROM tracking_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email ya está registrado en el sistema',
        code: 'EMAIL_EXISTS',
        existing_user_id: existingUser.rows[0].id
      });
    }
    
    // Generar tracker_id único (max 6 chars)
    const nameBase = full_name.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
    const randomId = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const tracker_id = `${nameBase}${randomId}`;
    
    // Generar username para sistema
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Generar password
    const password = auto_generate_password 
      ? generateSecurePassword() 
      : custom_password;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password requerida (auto-generada o personalizada)',
        code: 'PASSWORD_REQUIRED'
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Configurar permisos por defecto según rol
    const defaultPermissions = getDefaultPermissionsByRole(role);
    const finalPermissions = { ...defaultPermissions, ...permissions };
    
    // Debug lengths before insert
    console.log('🔍 Debug lengths:', {
      tracker_id: tracker_id.length + ' chars: ' + tracker_id,
      email: email.length + ' chars: ' + email.substring(0, 30),
      username: username.length + ' chars: ' + username,
      role: role.length + ' chars: ' + role
    });

    // Insertar usuario principal (solo columnas básicas)
    const userResult = await db.query(`
      INSERT INTO tracking_users (
        tracker_id,
        display_name,
        role,
        active,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [
      tracker_id,
      full_name,
      role,
      true
    ]);
    
    // Update with additional fields
    await db.query(`
      UPDATE tracking_users SET
        email = $1,
        phone = $2,
        position = $3,
        username = $4,
        password_hash = $5,
        permissions = $6,
        telegram_required = $7,
        owntracks_required = $8
      WHERE id = $9
    `, [
      email.toLowerCase().trim(),
      phone,
      position,
      username,
      passwordHash,
      JSON.stringify(finalPermissions),
      telegram_required,
      owntracks_required,
      userResult.rows[0].id
    ]);
    
    const newUser = userResult.rows[0];
    
    // Asignar grupos operativos (si es director) - TODO: Create table
    // if (operational_groups.length > 0) {
    //   for (const groupId of operational_groups) {
    //     await db.query(`
    //       INSERT INTO user_group_permissions (user_id, operational_group_id, granted_at)
    //       VALUES ($1, $2, NOW())
    //       ON CONFLICT (user_id, operational_group_id) DO NOTHING
    //     `, [newUser.id, groupId]);
    //   }
    // }
    
    // Crear entrada en system_users para login web
    await db.query(`
      INSERT INTO system_users (
        tracking_user_id,
        email,
        password_hash,
        full_name,
        phone,
        user_type,
        active,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `, [
      newUser.id,
      email.toLowerCase().trim(),
      passwordHash,
      full_name,
      phone,
      role,
      true
    ]);
    
    // Generar QR codes según configuración
    const qrCodes = {};
    
    if (telegram_required) {
      qrCodes.telegram = await generateTelegramBotQR(newUser.tracker_id);
    }
    
    if (owntracks_required) {
      qrCodes.owntracks = await generateOwnTracksQR(newUser.tracker_id);
    }
    
    // Log de creación
    console.log('✅ Usuario EPL CAS creado exitosamente:', {
      tracker_id: newUser.tracker_id,
      email: newUser.email,
      role: newUser.role,
      groups: operational_groups.length,
      permissions: Object.keys(finalPermissions).length
    });
    
    // Respuesta completa
    res.json({
      success: true,
      message: 'Usuario EPL CAS creado exitosamente',
      user: {
        id: newUser.id,
        tracker_id: newUser.tracker_id,
        full_name: newUser.display_name,
        email: newUser.email,
        username: username,
        role: newUser.role,
        permissions: finalPermissions,
        operational_groups: operational_groups
      },
      credentials: {
        username: username,
        password: password, // Solo en respuesta, nunca almacenar en logs
        login_url: `${process.env.WEB_APP_URL}/webapp/login.html`
      },
      qr_codes: qrCodes,
      next_steps: {
        telegram_setup: telegram_required ? 'Usuario debe escanear QR del bot Telegram' : 'No requerido',
        owntracks_setup: owntracks_required ? 'Usuario debe escanear QR de OwnTracks' : 'No requerido',
        credentials_delivery: `Enviar credenciales por ${send_credentials_method}`,
        testing: 'Verificar accesos y permisos'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en creación unificada de usuario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message,
      code: 'UNIFIED_CREATION_ERROR'
    });
  }
});

/**
 * GET /api/users/available-groups
 * Get available operational groups for assignment
 */
router.get('/available-groups', async (req, res) => {
  try {
    console.log('📋 Obteniendo grupos operativos disponibles...');
    
    // Get real operational groups from database (simplified for compatibility)
    const groupsResult = await db.query(`
      SELECT 
        id, name, 
        SUBSTRING(name FROM 1 FOR 3) as code,
        description,
        0 as branches_count
      FROM operational_groups 
      WHERE active = true
      ORDER BY name
    `);
    
    const realGroups = groupsResult.rows;
    
    res.json({
      success: true,
      operational_groups: realGroups,
      total_groups: realGroups.length,
      note: 'Estructura EPL CAS real cargada - 20 grupos operativos y 82 sucursales'
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo grupos:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo grupos operativos',
      message: error.message
    });
  }
});

/**
 * GET /api/users/permission-templates/:role
 * Get permission templates by role
 */
router.get('/permission-templates/:role', async (req, res) => {
  try {
    const { role } = req.params;
    
    console.log(`🔐 Obteniendo plantilla de permisos para rol: ${role}`);
    
    const permissions = getDefaultPermissionsByRole(role);
    const permissionGroups = getPermissionGroups();
    
    res.json({
      success: true,
      role: role,
      default_permissions: permissions,
      permission_groups: permissionGroups,
      description: `Permisos por defecto para ${role}`
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo plantilla de permisos:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo plantilla de permisos',
      message: error.message
    });
  }
});

/**
 * Generate default permissions by role
 */
function getDefaultPermissionsByRole(role) {
  const basePermissions = {
    // Acceso general
    login_webapp: false,
    view_dashboard: false,
    receive_notifications: false,
    readonly_mode: false,
    
    // Gestión usuarios
    view_users: false,
    create_users: false,
    edit_users: false,
    delete_users: false,
    
    // Geofences & GPS
    view_realtime_locations: false,
    configure_geofences: false,
    edit_coordinates: false,
    delete_geofences: false,
    
    // Reportes & Análisis
    basic_reports: false,
    advanced_reports: false,
    export_data: false,
    consolidated_reports: false,
    
    // Sistema & Config
    configure_system: false,
    manage_branches: false,
    system_logs: false,
    backup_restore: false
  };
  
  switch (role) {
    case 'director':
      return {
        ...basePermissions,
        login_webapp: true,
        view_dashboard: true,
        receive_notifications: true,
        view_users: true,
        create_users: true,
        view_realtime_locations: true,
        configure_geofences: true,
        basic_reports: true,
        advanced_reports: true,
        export_data: true,
        consolidated_reports: true
      };
      
    case 'manager':
      return {
        ...basePermissions,
        login_webapp: true,
        view_dashboard: true,
        receive_notifications: true,
        view_users: true,
        view_realtime_locations: true,
        basic_reports: true,
        export_data: true
      };
      
    case 'supervisor':
      return {
        ...basePermissions,
        login_webapp: true,
        view_dashboard: true,
        view_realtime_locations: true,
        basic_reports: true
      };
      
    case 'employee':
      return {
        ...basePermissions,
        // Solo tracking pasivo
        receive_notifications: false
      };
      
    default:
      return basePermissions;
  }
}

/**
 * Get permission groups for UI organization
 */
function getPermissionGroups() {
  return {
    'Acceso General': [
      { key: 'login_webapp', name: 'Login WebApp', description: 'Acceso al panel web' },
      { key: 'view_dashboard', name: 'Ver Dashboard', description: 'Acceso al dashboard principal' },
      { key: 'receive_notifications', name: 'Recibir Notificaciones', description: 'Alertas por Telegram/Email' },
      { key: 'readonly_mode', name: 'Modo Solo Lectura', description: 'Sin permisos de modificación' }
    ],
    'Gestión Usuarios': [
      { key: 'view_users', name: 'Ver Lista Usuarios', description: 'Ver información de usuarios' },
      { key: 'create_users', name: 'Crear Usuarios', description: 'Dar de alta nuevos usuarios' },
      { key: 'edit_users', name: 'Editar Usuarios', description: 'Modificar información de usuarios' },
      { key: 'delete_users', name: 'Eliminar Usuarios', description: 'Eliminar usuarios del sistema' }
    ],
    'Geofences & GPS': [
      { key: 'view_realtime_locations', name: 'Ver Ubicaciones Tiempo Real', description: 'Tracking en vivo' },
      { key: 'configure_geofences', name: 'Configurar Geofences', description: 'Crear y modificar geofences' },
      { key: 'edit_coordinates', name: 'Editar Coordenadas', description: 'Modificar ubicaciones' },
      { key: 'delete_geofences', name: 'Eliminar Geofences', description: 'Eliminar zonas de seguimiento' }
    ],
    'Reportes & Análisis': [
      { key: 'basic_reports', name: 'Reportes Básicos', description: 'Reportes estándar del sistema' },
      { key: 'advanced_reports', name: 'Reportes Avanzados', description: 'Análisis detallados' },
      { key: 'export_data', name: 'Exportar Datos', description: 'Descarga de información' },
      { key: 'consolidated_reports', name: 'Reportes Consolidados EPL CAS', description: 'Reportes corporativos' }
    ],
    'Sistema & Config': [
      { key: 'configure_system', name: 'Configurar Sistema', description: 'Ajustes generales' },
      { key: 'manage_branches', name: 'Gestionar Sucursales', description: 'Administrar sucursales' },
      { key: 'system_logs', name: 'Logs del Sistema', description: 'Ver registros del sistema' },
      { key: 'backup_restore', name: 'Backup & Restore', description: 'Respaldos y restauración' }
    ]
  };
}

/**
 * Generate secure random password
 */
function generateSecurePassword() {
  const length = 12;
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
}

/**
 * Generate Telegram Bot QR (placeholder)
 */
async function generateTelegramBotQR(trackerId) {
  // TODO: Implementar generación QR real
  const botUrl = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || 'YourBot'}?start=${trackerId}`;
  
  return {
    url: botUrl,
    qr_data: botUrl,
    instructions: 'Escanea este QR con Telegram para conectar automáticamente',
    status: 'pending_scan'
  };
}

/**
 * Generate OwnTracks QR (placeholder)
 */
async function generateOwnTracksQR(trackerId) {
  // TODO: Implementar generación QR real OwnTracks
  const ownTracksConfig = {
    _type: 'configuration',
    host: process.env.WEB_APP_URL?.replace('https://', '') || 'localhost',
    port: 443,
    path: '/api/owntracks/location',
    deviceId: trackerId,
    username: trackerId,
    password: 'owntracks123'
  };
  
  return {
    config: ownTracksConfig,
    qr_data: JSON.stringify(ownTracksConfig),
    instructions: 'Escanea este QR con OwnTracks para configurar automáticamente',
    status: 'ready_to_scan'
  };
}

module.exports = router;