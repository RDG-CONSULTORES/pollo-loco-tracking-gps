const db = require('../config/database');
const zenputClient = require('../integrations/zenput-client');
const zenputAPI = require('../integrations/zenput-api-client');

/**
 * Job para sincronizar datos desde Zenput
 */
class SyncZenputJob {
  
  /**
   * Sincronizar todos los datos de Zenput
   */
  async syncZenputData() {
    try {
      console.log('🔄 Iniciando sincronización con Zenput...');
      
      const results = {
        locations: { synced: 0, errors: 0 },
        users: { synced: 0, errors: 0 }
      };
      
      // 1. Sincronizar sucursales
      await this.syncLocations(results.locations);
      
      // 2. Sincronizar usuarios (desde API si está disponible)
      await this.syncUsers(results.users);
      
      console.log(`✅ Sincronización completada:
  📍 Sucursales: ${results.locations.synced} sincronizadas, ${results.locations.errors} errores
  👥 Usuarios: ${results.users.synced} sincronizados, ${results.users.errors} errores`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error en sincronización Zenput:', error.message);
      throw error;
    }
  }
  
  /**
   * Sincronizar sucursales desde Zenput DB
   */
  async syncLocations(results) {
    try {
      console.log('📍 Sincronizando sucursales...');
      
      // Obtener sucursales desde Zenput
      const zenputLocations = await zenputClient.getLocations();
      
      if (zenputLocations.length === 0) {
        console.warn('⚠️ No se obtuvieron sucursales desde Zenput');
        return;
      }
      
      console.log(`📊 Procesando ${zenputLocations.length} sucursales...`);
      
      for (const location of zenputLocations) {
        try {
          await this.syncSingleLocation(location);
          results.synced++;
        } catch (error) {
          console.error(`❌ Error sincronizando sucursal ${location.location_code}:`, error.message);
          results.errors++;
        }
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo sucursales desde Zenput:', error.message);
      results.errors++;
    }
  }
  
  /**
   * Sincronizar una sucursal individual
   */
  async syncSingleLocation(location) {
    const {
      location_code,
      name,
      address,
      latitude,
      longitude,
      group_name,
      director_name,
      active = true
    } = location;
    
    // Validar datos requeridos
    if (!location_code || !name || !latitude || !longitude) {
      throw new Error(`Datos incompletos para sucursal: ${JSON.stringify(location)}`);
    }
    
    // Validar coordenadas
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error(`Coordenadas inválidas: lat=${latitude}, lon=${longitude}`);
    }
    
    // Insertar o actualizar
    await db.query(`
      INSERT INTO tracking_locations_cache 
      (location_code, name, address, latitude, longitude, group_name, director_name, active, synced_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (location_code) 
      DO UPDATE SET 
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        group_name = EXCLUDED.group_name,
        director_name = EXCLUDED.director_name,
        active = EXCLUDED.active,
        synced_at = NOW()
    `, [location_code, name, address, latitude, longitude, group_name, director_name, active]);
  }
  
  /**
   * Sincronizar usuarios desde Zenput API
   */
  async syncUsers(results) {
    try {
      console.log('👥 Sincronizando usuarios...');
      
      // Intentar obtener desde API primero
      let zenputUsers = [];
      
      try {
        zenputUsers = await zenputAPI.getUsers();
        console.log(`📊 Obtenidos ${zenputUsers.length} usuarios desde API`);
      } catch (apiError) {
        console.log('💡 API no disponible, intentando BD...');
        
        try {
          zenputUsers = await zenputClient.getUsers();
          console.log(`📊 Obtenidos ${zenputUsers.length} usuarios desde BD`);
        } catch (dbError) {
          console.log('💡 BD no disponible, saltando usuarios...');
          return;
        }
      }
      
      if (zenputUsers.length === 0) {
        console.warn('⚠️ No se obtuvieron usuarios desde Zenput');
        return;
      }
      
      for (const user of zenputUsers) {
        try {
          await this.syncSingleUser(user);
          results.synced++;
        } catch (error) {
          console.error(`❌ Error sincronizando usuario ${user.email}:`, error.message);
          results.errors++;
        }
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo usuarios desde Zenput:', error.message);
      results.errors++;
    }
  }
  
  /**
   * Sincronizar un usuario individual
   */
  async syncSingleUser(user) {
    const {
      zenput_user_id,
      email,
      display_name,
      phone,
      role,
      active = true
    } = user;
    
    // Validar datos requeridos
    if (!email) {
      throw new Error(`Email requerido para usuario: ${JSON.stringify(user)}`);
    }
    
    // Insertar o actualizar en cache
    await db.query(`
      INSERT INTO tracking_users_zenput_cache 
      (zenput_user_id, email, display_name, phone, role, active, synced_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (zenput_user_id) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        phone = EXCLUDED.phone,
        role = EXCLUDED.role,
        active = EXCLUDED.active,
        synced_at = NOW()
    `, [zenput_user_id, email, display_name, phone, role, active]);
  }
  
  /**
   * Limpiar datos antiguos
   */
  async cleanupOldData() {
    try {
      console.log('🧹 Limpiando datos antiguos...');
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 días
      
      // Marcar sucursales no sincronizadas como inactivas
      const inactiveResult = await db.query(`
        UPDATE tracking_locations_cache 
        SET active = false
        WHERE synced_at < $1
          AND active = true
      `, [cutoffDate]);
      
      console.log(`📍 Sucursales marcadas como inactivas: ${inactiveResult.rowCount}`);
      
      // Limpiar usuarios antiguos del cache
      const cleanupResult = await db.query(`
        DELETE FROM tracking_users_zenput_cache 
        WHERE synced_at < $1
      `, [cutoffDate]);
      
      console.log(`👥 Usuarios antiguos limpiados: ${cleanupResult.rowCount}`);
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error.message);
    }
  }
  
  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats() {
    try {
      const stats = {};
      
      // Estadísticas de sucursales
      const locationsResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE active = true) as active,
          MAX(synced_at) as last_sync
        FROM tracking_locations_cache
      `);
      
      stats.locations = locationsResult.rows[0];
      
      // Estadísticas de usuarios
      const usersResult = await db.query(`
        SELECT 
          COUNT(*) as total_cache,
          COUNT(*) FILTER (WHERE active = true) as active_cache,
          MAX(synced_at) as last_sync
        FROM tracking_users_zenput_cache
      `);
      
      const trackingUsersResult = await db.query(`
        SELECT COUNT(*) as total_tracking
        FROM tracking_users
      `);
      
      stats.users = {
        ...usersResult.rows[0],
        total_tracking: parseInt(trackingUsersResult.rows[0].total_tracking)
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas sync:', error.message);
      return { error: error.message };
    }
  }
  
  /**
   * Sincronización manual (para comandos de admin)
   */
  async manualSync(chatId = null) {
    try {
      const result = await this.syncZenputData();
      
      if (chatId) {
        const { getBot } = require('../telegram/bot');
        const bot = getBot();
        
        if (bot) {
          const message = `
🔄 *SINCRONIZACIÓN COMPLETADA*

📍 *Sucursales:*
• Sincronizadas: ${result.locations.synced}
• Errores: ${result.locations.errors}

👥 *Usuarios:*
• Sincronizados: ${result.users.synced}
• Errores: ${result.users.errors}

⏰ ${new Date().toLocaleString('es-MX')}
`;
          
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error en sincronización manual:', error.message);
      
      if (chatId) {
        const { getBot } = require('../telegram/bot');
        const bot = getBot();
        
        if (bot) {
          await bot.sendMessage(chatId, `❌ Error en sincronización: ${error.message}`);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Verificar conexión a Zenput
   */
  async checkZenputConnection() {
    const status = {
      database: false,
      api: false,
      error: null
    };
    
    try {
      // Test BD
      await zenputClient.testConnection();
      status.database = true;
    } catch (error) {
      status.error = error.message;
    }
    
    try {
      // Test API
      await zenputAPI.testConnection();
      status.api = true;
    } catch (error) {
      // API opcional
    }
    
    return status;
  }
}

module.exports = new SyncZenputJob();