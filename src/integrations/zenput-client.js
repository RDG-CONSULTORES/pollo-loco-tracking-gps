const zenputDB = require('../config/zenput-database');

/**
 * Cliente para integración con base de datos Zenput
 * IMPORTANTE: Ajustar nombres de tablas/columnas según la BD real
 */
class ZenputClient {
  
  /**
   * Obtener sucursales desde BD de Zenput
   * NOTA: Los nombres de tablas/columnas se deben ajustar según la BD real
   */
  async getLocations() {
    try {
      // TODO: Ajustar nombres de tabla y columnas según BD real
      const query = `
        SELECT 
          code as location_code,
          name,
          address,
          latitude,
          longitude,
          group_name,
          director_name,
          active
        FROM zenput_locations
        WHERE active = true
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
        ORDER BY name
      `;
      
      const result = await zenputDB.query(query);
      
      console.log(`📍 Sucursales obtenidas desde Zenput: ${result.rows.length}`);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo sucursales desde Zenput:', error.message);
      
      // Si hay error de tabla no existe, mostrar ayuda
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('\n💡 AYUDA: La tabla "zenput_locations" no existe.');
        console.log('Ejecuta este comando para ver las tablas disponibles:');
        console.log('npm run test:zenput');
      }
      
      throw error;
    }
  }
  
  /**
   * Obtener sucursal por código
   */
  async getLocationByCode(code) {
    try {
      // TODO: Ajustar nombres según BD real
      const query = `
        SELECT 
          code as location_code,
          name,
          address,
          latitude,
          longitude,
          group_name,
          director_name
        FROM zenput_locations
        WHERE code = $1
          AND active = true
      `;
      
      const result = await zenputDB.query(query, [code]);
      
      if (result.rows.length === 0) {
        console.log(`⚠️ Sucursal no encontrada: ${code}`);
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error(`❌ Error obteniendo sucursal ${code}:`, error.message);
      return null;
    }
  }
  
  /**
   * Obtener usuarios desde BD de Zenput (si existen ahí)
   */
  async getUsers() {
    try {
      // TODO: Ajustar nombres según BD real
      const query = `
        SELECT 
          id as zenput_user_id,
          email,
          display_name,
          phone_number as phone,
          active
        FROM zenput_users
        WHERE active = true
        ORDER BY display_name
      `;
      
      const result = await zenputDB.query(query);
      
      console.log(`👥 Usuarios obtenidos desde Zenput: ${result.rows.length}`);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo usuarios desde Zenput:', error.message);
      
      // Esto es normal, muchas veces los usuarios están en API, no en BD
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('💡 INFO: Tabla de usuarios no encontrada. Probablemente están en Zenput API.');
        return [];
      }
      
      return [];
    }
  }
  
  /**
   * Buscar sucursal más cercana a coordenadas usando Haversine
   */
  async findNearestLocation(lat, lon, maxDistanceKm = 0.5) {
    try {
      // TODO: Ajustar nombres según BD real
      const query = `
        SELECT 
          code as location_code,
          name,
          latitude,
          longitude,
          group_name,
          (
            6371 * acos(
              cos(radians($1)) * cos(radians(latitude)) * 
              cos(radians(longitude) - radians($2)) + 
              sin(radians($1)) * sin(radians(latitude))
            )
          ) as distance_km
        FROM zenput_locations
        WHERE active = true
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY distance_km
        LIMIT 1
      `;
      
      const result = await zenputDB.query(query, [lat, lon]);
      
      if (result.rows.length === 0) {
        console.log('⚠️ No hay sucursales disponibles');
        return null;
      }
      
      const location = result.rows[0];
      
      if (location.distance_km <= maxDistanceKm) {
        console.log(`📍 Sucursal cercana encontrada: ${location.name} (${Math.round(location.distance_km * 1000)}m)`);
        return location;
      }
      
      console.log(`📍 Sucursal más cercana demasiado lejos: ${location.name} (${Math.round(location.distance_km * 1000)}m)`);
      return null;
    } catch (error) {
      console.error('❌ Error buscando sucursal cercana:', error.message);
      return null;
    }
  }
  
  /**
   * Test de conexión y exploración de estructura
   */
  async testConnection() {
    try {
      console.log('\n🔍 Probando conexión a Zenput...');
      
      // Test básico
      await zenputDB.testConnection();
      
      // Listar tablas
      console.log('\n📋 Explorando estructura de BD...');
      const tables = await zenputDB.listTables();
      
      // Buscar tablas relacionadas con sucursales
      const locationTables = tables.filter(t => 
        t.table_name.toLowerCase().includes('location') ||
        t.table_name.toLowerCase().includes('store') ||
        t.table_name.toLowerCase().includes('branch') ||
        t.table_name.toLowerCase().includes('sucursal')
      );
      
      if (locationTables.length > 0) {
        console.log('\n📍 Tablas que podrían contener sucursales:');
        locationTables.forEach(table => {
          console.log(`   - ${table.table_name}`);
        });
        
        // Describir la primera tabla
        console.log(`\n🔍 Explorando tabla: ${locationTables[0].table_name}`);
        await zenputDB.describeTable(locationTables[0].table_name);
      }
      
      // Buscar tablas relacionadas con usuarios
      const userTables = tables.filter(t => 
        t.table_name.toLowerCase().includes('user') ||
        t.table_name.toLowerCase().includes('employee') ||
        t.table_name.toLowerCase().includes('supervisor')
      );
      
      if (userTables.length > 0) {
        console.log('\n👥 Tablas que podrían contener usuarios:');
        userTables.forEach(table => {
          console.log(`   - ${table.table_name}`);
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error en test de conexión:', error.message);
      return false;
    }
  }
  
  /**
   * Obtener muestra de datos de una tabla
   */
  async sampleData(tableName, limit = 3) {
    try {
      const query = `SELECT * FROM ${tableName} LIMIT $1`;
      const result = await zenputDB.query(query, [limit]);
      
      console.log(`\n📊 Muestra de datos de ${tableName}:`);
      console.log(JSON.stringify(result.rows, null, 2));
      
      return result.rows;
    } catch (error) {
      console.error(`❌ Error obteniendo muestra de ${tableName}:`, error.message);
      return [];
    }
  }
}

module.exports = new ZenputClient();