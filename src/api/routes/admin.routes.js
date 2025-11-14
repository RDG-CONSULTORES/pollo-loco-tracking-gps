const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { logAdminAction } = require('../../utils/admin-logger');
const { requireAdmin, extractClientInfo, logAction } = require('../../middleware/auth-middleware');

/**
 * Middleware: Verificar autenticación
 * Solo administradores pueden acceder a estas rutas
 */
router.use(extractClientInfo);
router.use(requireAdmin);

/**
 * GET /api/admin/debug/schema/:table
 * Emergency schema debugging endpoint
 */
router.get('/debug/schema/:table', async (req, res) => {
  try {
    const tableName = req.params.table;
    
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    res.json({
      table: tableName,
      columns: columns.rows,
      count: columns.rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/import-real-data  
 * Importar estructura real desde Neon (triggered via GET for Railway compatibility)
 */
router.get('/import-real-data', async (req, res) => {
  try {
    console.log('🏢 Iniciando importación de estructura real...');
    
    const { Client } = require('pg');
    
    // Conectar a Neon
    const neonClient = new Client({
      connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ssl: { rejectUnauthorized: false }
    });
    
    await neonClient.connect();
    
    // Obtener estructura real
    const estructuraResult = await neonClient.query(`
      SELECT DISTINCT
        location_name,
        sucursal_clean,
        latitud,
        longitud,
        estado_normalizado,
        municipio,
        grupo_operativo_limpio,
        director_operativo
      FROM supervision_operativa_clean
      WHERE latitud IS NOT NULL 
        AND longitud IS NOT NULL
        AND location_name IS NOT NULL
        AND grupo_operativo_limpio IS NOT NULL
      ORDER BY grupo_operativo_limpio, location_name
    `);
    
    // Agrupar por grupo operativo
    const gruposPorOperativo = new Map();
    estructuraResult.rows.forEach(row => {
      const grupo = row.grupo_operativo_limpio;
      if (!gruposPorOperativo.has(grupo)) {
        gruposPorOperativo.set(grupo, []);
      }
      gruposPorOperativo.get(grupo).push(row);
    });
    
    // Limpiar tabla actual
    await db.query('DELETE FROM tracking_locations_cache');
    
    // Importar estructura real
    let totalImportadas = 0;
    for (const [grupoNombre, sucursalesGrupo] of gruposPorOperativo.entries()) {
      for (const sucursal of sucursalesGrupo) {
        const codigoMatch = sucursal.location_name.match(/^(\\d+)/);
        const locationCode = codigoMatch ? codigoMatch[1] : `AUTO_${totalImportadas + 1}`;
        
        await db.query(`
          INSERT INTO tracking_locations_cache (
            location_code, name, address, latitude, longitude,
            group_name, director_name, active, geofence_radius, synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (location_code) DO UPDATE SET
            name = EXCLUDED.name, group_name = EXCLUDED.group_name,
            latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
            director_name = EXCLUDED.director_name, synced_at = NOW()
        `, [
          locationCode, sucursal.location_name,
          `${sucursal.municipio}, ${sucursal.estado_normalizado}`,
          parseFloat(sucursal.latitud), parseFloat(sucursal.longitud),
          grupoNombre, sucursal.director_operativo || 'Director TBD',
          true, 150
        ]);
        
        totalImportadas++;
      }
    }
    
    await neonClient.end();
    
    // Verificación final
    const verificacion = await db.query(`
      SELECT group_name, COUNT(*) as total
      FROM tracking_locations_cache 
      WHERE active = true
      GROUP BY group_name
      ORDER BY group_name
    `);
    
    res.json({
      success: true,
      message: 'Estructura real importada exitosamente',
      stats: {
        grupos_importados: gruposPorOperativo.size,
        sucursales_importadas: totalImportadas,
        grupos_detalle: verificacion.rows
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en importación:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/users
 * Obtener lista de usuarios de tracking
 */
router.get('/users', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT 
        tu.id,
        tu.tracker_id,
        tu.display_name,
        tu.zenput_email,
        tu.phone,
        tu.active,
        tu.created_at,
        -- Información adicional si existe
        COALESCE(s.primary_group, 'SIN_GRUPO') as grupo,
        COALESCE(su.user_type, 'usuario') as rol
      FROM tracking_users tu
      LEFT JOIN supervisors s ON tu.tracker_id = s.tracker_id
      LEFT JOIN system_users su ON tu.zenput_email = su.email
      ORDER BY tu.created_at DESC
    `);

    // Mapear resultados con formato esperado por el frontend
    const usersFormatted = users.rows.map(user => ({
      tracker_id: user.tracker_id,
      display_name: user.display_name,
      zenput_email: user.zenput_email,
      phone: user.phone,
      active: user.active,
      grupo: user.grupo,
      rol: user.rol,
      created_at: user.created_at
    }));

    res.json(usersFormatted);
    
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code 
    });
  }
});

/**
 * POST /api/admin/users
 * Crear nuevo usuario de tracking
 */
router.post('/users', async (req, res) => {
  try {
    const { tracker_id, display_name, zenput_email, phone, grupo, rol } = req.body;

    // Validaciones
    if (!tracker_id || !display_name || !zenput_email) {
      return res.status(400).json({ error: 'Campos requeridos: tracker_id, display_name, zenput_email' });
    }

    // Verificar que el tracker_id no exista
    const existingUser = await db.query(
      'SELECT id FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Tracker ID ya existe' });
    }

    // 1. Crear en tracking_users
    const userResult = await db.query(`
      INSERT INTO tracking_users (tracker_id, display_name, zenput_email, phone, active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, tracker_id, display_name, zenput_email, active, created_at
    `, [tracker_id, display_name, zenput_email, phone]);

    const newUser = userResult.rows[0];

    // 2. Si hay grupo, crear en supervisors
    if (grupo && grupo !== 'SIN_GRUPO') {
      try {
        await db.query(`
          INSERT INTO supervisors (tracker_id, full_name, primary_group, active_tracking)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (tracker_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            primary_group = EXCLUDED.primary_group
        `, [tracker_id, display_name, grupo]);
      } catch (supervisorError) {
        console.warn('Error creating supervisor record:', supervisorError.message);
      }
    }

    // 3. Log de auditoría
    await logAdminAction(req.user.id, 'USER_CREATED', 'tracking_user', newUser.id, {
      tracker_id: newUser.tracker_id,
      display_name: newUser.display_name,
      grupo: grupo
    });

    res.json({
      success: true,
      user: {
        ...newUser,
        grupo: grupo || 'SIN_GRUPO',
        rol: rol || 'usuario'
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code 
    });
  }
});

/**
 * GET /api/admin/stats/dashboard
 * Estadísticas para el dashboard del admin
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    // Estadísticas de usuarios
    const userStats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as active
      FROM tracking_users
    `);

    // Estadísticas de ubicaciones/sucursales
    const locationStats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as active
      FROM tracking_locations_cache
    `);

    // Estadísticas de visitas del día (usando geofence_events)
    const visitsStats = await db.query(`
      SELECT 
        COUNT(CASE WHEN event_type = 'enter' AND DATE(event_timestamp) = CURRENT_DATE THEN 1 END) as entries_today,
        COUNT(CASE WHEN event_type = 'exit' AND DATE(event_timestamp) = CURRENT_DATE THEN 1 END) as exits_today
      FROM geofence_events
    `);

    // Estados de usuarios actualmente en sucursales
    const activeVisits = await db.query(`
      SELECT COUNT(*) as active_visits
      FROM user_sucursal_state
      WHERE is_inside = true
    `);

    const stats = {
      users: {
        total: parseInt(userStats.rows[0]?.total || 0),
        active: parseInt(userStats.rows[0]?.active || 0)
      },
      locations: {
        total: parseInt(locationStats.rows[0]?.total || 0),
        active: parseInt(locationStats.rows[0]?.active || 0)
      },
      visits_today: {
        completed: parseInt(visitsStats.rows[0]?.exits_today || 0),
        open: parseInt(activeVisits.rows[0]?.active_visits || 0)
      },
      system_status: 'active'
    };

    res.json(stats);

  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code 
    });
  }
});

// Debug endpoints remain the same
router.get('/users/debug/gps', async (req, res) => {
  try {
    
    // Debug: Check what columns tracking_locations actually has
    if (req.query.debug === 'describe') {
      try {
        // Use PostgreSQL specific query to describe table
        const result = await db.query(`
          SELECT * FROM tracking_locations LIMIT 0
        `);
        
        return res.json({
          debug: 'tracking_locations_describe',
          fields: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID })),
          message: 'Table exists - showing actual fields',
          timestamp: new Date().toISOString()
        });
      } catch (describeError) {
        return res.json({
          debug: 'describe_error',
          error: describeError.message,
          code: describeError.code,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Test tracking_locations schema if ?debug=schema query param
    if (req.query.debug === 'schema') {
      try {
        const columns = await db.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'tracking_locations'
          ORDER BY ordinal_position
        `);
        
        return res.json({
          debug: 'tracking_locations_schema',
          columns: columns.rows,
          timestamp: new Date().toISOString()
        });
      } catch (schemaError) {
        return res.json({
          debug: 'schema_error',
          error: schemaError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Create tracking_locations table if ?debug=create_table query param
    if (req.query.debug === 'create_table') {
      try {
        console.log('[ADMIN] Creating tracking_locations table...');
        
        await db.query(`
          CREATE TABLE IF NOT EXISTS gps_locations (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            zenput_email VARCHAR(100),
            
            -- Datos GPS
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            accuracy INT,           -- Precisión en metros
            altitude INT,
            battery INT,            -- Porcentaje batería
            velocity DECIMAL(5, 2), -- Velocidad km/h
            heading INT,            -- Dirección 0-360°
            
            -- Timestamps
            gps_timestamp TIMESTAMP NOT NULL,
            received_at TIMESTAMP DEFAULT NOW(),
            
            -- Metadata
            raw_payload JSONB
          )
        `);
        
        console.log('[ADMIN] Creating indexes...');
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_gps_locations_user_time ON gps_locations(user_id, gps_timestamp DESC)
        `);
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_gps_locations_timestamp ON gps_locations(gps_timestamp DESC)
        `);
        
        return res.json({
          debug: 'create_table',
          success: true,
          message: 'gps_locations table created successfully',
          timestamp: new Date().toISOString()
        });
      } catch (createError) {
        console.error('[ADMIN] Error creating table:', createError);
        return res.json({
          debug: 'create_table_error',
          error: createError.message,
          code: createError.code,
          detail: createError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Debug: Create geofencing tables if ?debug=setup_geofencing query param
    if (req.query.debug === 'setup_geofencing') {
      try {
        console.log('[ADMIN] Setting up geofencing system...');
        
        // 1. Crear tabla sucursal_geofences
        console.log('[ADMIN] Creating sucursal_geofences table...');
        await db.query(`
          CREATE TABLE IF NOT EXISTS sucursal_geofences (
              id BIGSERIAL PRIMARY KEY,
              location_code VARCHAR(50) NOT NULL,
              store_name VARCHAR(200),
              group_name VARCHAR(100),
              
              -- Coordenadas del centro del geofence
              latitude DECIMAL(10, 8) NOT NULL,
              longitude DECIMAL(11, 8) NOT NULL,
              
              -- Radio en metros (default 150m)
              radius_meters INTEGER DEFAULT 150,
              
              -- Control
              active BOOLEAN DEFAULT true,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW(),
              
              -- Constraint para location_code
              CONSTRAINT fk_geofence_location 
                  FOREIGN KEY (location_code) 
                  REFERENCES tracking_locations_cache(location_code)
                  ON DELETE CASCADE
          )
        `);

        // 2. Crear tabla geofence_events
        console.log('[ADMIN] Creating geofence_events table...');
        await db.query(`
          CREATE TABLE IF NOT EXISTS geofence_events (
              id BIGSERIAL PRIMARY KEY,
              
              -- Referencias
              user_id INTEGER NOT NULL,
              location_code VARCHAR(50) NOT NULL,
              raw_location_id BIGINT,
              
              -- Tipo de evento
              event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('enter', 'exit')),
              
              -- Ubicación del evento
              latitude DECIMAL(10, 8) NOT NULL,
              longitude DECIMAL(11, 8) NOT NULL,
              distance_from_center DECIMAL(8, 2),
              
              -- Timestamp del evento
              event_timestamp TIMESTAMP DEFAULT NOW(),
              
              -- Estado de notificaciones
              telegram_sent BOOLEAN DEFAULT false,
              telegram_sent_at TIMESTAMP,
              telegram_error TEXT,
              
              -- Metadatos
              accuracy_meters INTEGER,
              battery_percentage INTEGER,
              
              -- Constraints
              CONSTRAINT fk_geofence_event_user 
                  FOREIGN KEY (user_id) 
                  REFERENCES tracking_users(id)
                  ON DELETE CASCADE,
              
              CONSTRAINT fk_geofence_event_raw_location 
                  FOREIGN KEY (raw_location_id) 
                  REFERENCES gps_locations(id)
                  ON DELETE SET NULL
          )
        `);

        // 3. Crear tabla user_sucursal_state
        console.log('[ADMIN] Creating user_sucursal_state table...');
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_sucursal_state (
              id BIGSERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL,
              location_code VARCHAR(50) NOT NULL,
              
              -- Estado actual
              is_inside BOOLEAN DEFAULT false,
              last_enter_event_id BIGINT,
              last_exit_event_id BIGINT,
              
              -- Timestamps
              last_enter_time TIMESTAMP,
              last_exit_time TIMESTAMP,
              updated_at TIMESTAMP DEFAULT NOW(),
              
              -- Unique constraint para evitar duplicados
              CONSTRAINT unique_user_location 
                  UNIQUE (user_id, location_code),
              
              -- Foreign keys
              CONSTRAINT fk_user_state_user 
                  FOREIGN KEY (user_id) 
                  REFERENCES tracking_users(id)
                  ON DELETE CASCADE,
                  
              CONSTRAINT fk_user_state_enter_event 
                  FOREIGN KEY (last_enter_event_id) 
                  REFERENCES geofence_events(id)
                  ON DELETE SET NULL,
                  
              CONSTRAINT fk_user_state_exit_event 
                  FOREIGN KEY (last_exit_event_id) 
                  REFERENCES geofence_events(id)
                  ON DELETE SET NULL
          )
        `);

        // 4. Crear función de distancia
        console.log('[ADMIN] Creating distance calculation function...');
        await db.query(`
          CREATE OR REPLACE FUNCTION calculate_distance_meters(
              lat1 DECIMAL(10,8), 
              lon1 DECIMAL(11,8), 
              lat2 DECIMAL(10,8), 
              lon2 DECIMAL(11,8)
          ) RETURNS DECIMAL(10,2) AS $$
          DECLARE
              R CONSTANT DECIMAL := 6371000; -- Radio de la Tierra en metros
              lat1_rad DECIMAL;
              lat2_rad DECIMAL;
              delta_lat DECIMAL;
              delta_lon DECIMAL;
              a DECIMAL;
              c DECIMAL;
          BEGIN
              -- Convertir a radianes
              lat1_rad := radians(lat1);
              lat2_rad := radians(lat2);
              delta_lat := radians(lat2 - lat1);
              delta_lon := radians(lon2 - lon1);
              
              -- Fórmula Haversine
              a := sin(delta_lat/2) * sin(delta_lat/2) + 
                   cos(lat1_rad) * cos(lat2_rad) * 
                   sin(delta_lon/2) * sin(delta_lon/2);
              c := 2 * atan2(sqrt(a), sqrt(1-a));
              
              RETURN R * c;
          END;
          $$ LANGUAGE plpgsql IMMUTABLE
        `);

        // 5. Crear función para encontrar geofences cercanos
        console.log('[ADMIN] Creating nearby geofences function...');
        await db.query(`
          CREATE OR REPLACE FUNCTION get_nearby_geofences(
              user_lat DECIMAL(10,8), 
              user_lon DECIMAL(11,8), 
              max_distance_meters INTEGER DEFAULT 200
          ) RETURNS TABLE (
              geofence_id BIGINT,
              location_code VARCHAR(50),
              store_name VARCHAR(200),
              distance_meters DECIMAL(10,2),
              is_inside BOOLEAN
          ) AS $$
          BEGIN
              RETURN QUERY
              SELECT 
                  sg.id,
                  sg.location_code,
                  sg.store_name,
                  calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) as distance,
                  (calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) <= sg.radius_meters) as inside
              FROM sucursal_geofences sg
              WHERE sg.active = true
                AND calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) <= max_distance_meters
              ORDER BY distance;
          END;
          $$ LANGUAGE plpgsql
        `);

        // 6. Crear índices
        console.log('[ADMIN] Creating geofencing indexes...');
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofences_location_code ON sucursal_geofences(location_code)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofences_coordinates ON sucursal_geofences(latitude, longitude)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofences_active ON sucursal_geofences(active) WHERE active = true`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofence_events_user_timestamp ON geofence_events(user_id, event_timestamp DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofence_events_location_timestamp ON geofence_events(location_code, event_timestamp DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofence_events_type_timestamp ON geofence_events(event_type, event_timestamp DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_geofence_events_telegram_pending ON geofence_events(telegram_sent) WHERE telegram_sent = false`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_state_user ON user_sucursal_state(user_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_state_location ON user_sucursal_state(location_code)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_user_state_inside ON user_sucursal_state(is_inside) WHERE is_inside = true`);

        // 7. Insertar configuración
        console.log('[ADMIN] Inserting geofencing configuration...');
        await db.query(`
          INSERT INTO tracking_config (key, value, data_type, description) VALUES 
          ('geofencing_enabled', 'true', 'boolean', 'Activar/desactivar sistema de geofencing'),
          ('geofence_default_radius', '150', 'integer', 'Radio por defecto para geofences en metros'),
          ('geofence_max_search_radius', '200', 'integer', 'Radio máximo para buscar geofences cercanos'),
          ('geofence_telegram_alerts', 'true', 'boolean', 'Enviar alertas de geofencing por Telegram'),
          ('geofence_alert_channels', '[]', 'json', 'Configuración de canales para alertas de geofencing')
          ON CONFLICT (key) DO NOTHING
        `);
        
        // Verificar instalación
        const tablesResult = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN ('sucursal_geofences', 'geofence_events', 'user_sucursal_state')
          ORDER BY table_name
        `);
        
        const functionsResult = await db.query(`
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
            AND routine_name IN ('calculate_distance_meters', 'get_nearby_geofences')
          ORDER BY routine_name
        `);
        
        const configResult = await db.query(`
          SELECT key, value 
          FROM tracking_config 
          WHERE key LIKE 'geofenc%'
          ORDER BY key
        `);

        return res.json({
          debug: 'setup_geofencing',
          success: true,
          message: 'Geofencing system setup completed successfully',
          created_tables: tablesResult.rows.map(r => r.table_name),
          created_functions: functionsResult.rows.map(r => r.routine_name),
          config_entries: configResult.rows.length,
          timestamp: new Date().toISOString()
        });
        
      } catch (createError) {
        console.error('[ADMIN] Error setting up geofencing:', createError);
        return res.json({
          debug: 'setup_geofencing_error',
          error: createError.message,
          code: createError.code,
          detail: createError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Test location insert if ?debug=insert query param
    if (req.query.debug === 'insert') {
      try {
        const testResult = await db.query(`
          INSERT INTO gps_locations 
          (user_id, zenput_email, latitude, longitude, accuracy, 
           battery, velocity, heading, gps_timestamp, raw_payload)
          VALUES (3, 'test@example.com', 25.6866, -100.3161, 5, 
                  85, 0, 0, NOW(), '{"test": true}')
          RETURNING id, user_id, latitude, longitude, gps_timestamp
        `);
        
        return res.json({
          debug: 'insert_test',
          success: true,
          inserted: testResult.rows[0],
          timestamp: new Date().toISOString()
        });
      } catch (insertError) {
        return res.json({
          debug: 'insert_error',
          error: insertError.message,
          code: insertError.code,
          detail: insertError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Debug: Import geofences if ?debug=import_geofences query param
    if (req.query.debug === 'import_geofences') {
      try {
        console.log('[ADMIN] Importing geofences from sucursales...');
        
        // 1. Obtener sucursales existentes
        const sucursalesResult = await db.query(`
          SELECT 
            location_code,
            name as store_name,
            group_name,
            latitude,
            longitude,
            active,
            synced_at
          FROM tracking_locations_cache
          WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND latitude != 0 
            AND longitude != 0
          ORDER BY group_name, name
        `);
        
        console.log(`[ADMIN] Found ${sucursalesResult.rows.length} sucursales with coordinates`);
        
        // 2. Limpiar geofences existentes
        const deleteResult = await db.query(`DELETE FROM sucursal_geofences`);
        console.log(`[ADMIN] Deleted ${deleteResult.rowCount} existing geofences`);
        
        // 3. Obtener radio por defecto
        const defaultRadius = 150;
        
        // 4. Insertar geofences
        let imported = 0;
        let skipped = 0;
        
        for (const sucursal of sucursalesResult.rows) {
          try {
            const lat = parseFloat(sucursal.latitude);
            const lon = parseFloat(sucursal.longitude);
            
            // Validar coordenadas
            if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
              skipped++;
              continue;
            }
            
            // Validar rango México
            if (lat < 14 || lat > 33 || lon < -118 || lon > -86) {
              skipped++;
              continue;
            }
            
            // Insertar geofence
            await db.query(`
              INSERT INTO sucursal_geofences (
                location_code, store_name, group_name, 
                latitude, longitude, radius_meters, active, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [
              sucursal.location_code,
              sucursal.store_name,
              sucursal.group_name,
              lat,
              lon,
              defaultRadius,
              sucursal.active || true
            ]);
            
            imported++;
            
          } catch (error) {
            console.error(`[ADMIN] Error importing ${sucursal.store_name}:`, error.message);
            skipped++;
          }
        }
        
        // 5. Verificar resultados
        const verifyResult = await db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE active = true) as active,
            COUNT(DISTINCT group_name) as groups
          FROM sucursal_geofences
        `);
        
        const stats = verifyResult.rows[0];
        
        // 6. Obtener resumen por grupo
        const groupSummary = await db.query(`
          SELECT 
            group_name,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE active = true) as active
          FROM sucursal_geofences
          GROUP BY group_name
          ORDER BY count DESC
        `);
        
        // 7. Probar función de búsqueda
        const testResult = await db.query(`
          SELECT * FROM get_nearby_geofences(25.6866, -100.3161, 500) LIMIT 3
        `);

        return res.json({
          debug: 'import_geofences',
          success: true,
          message: 'Geofences imported successfully',
          stats: {
            imported: imported,
            skipped: skipped,
            total: parseInt(stats.total),
            active: parseInt(stats.active),
            groups: parseInt(stats.groups)
          },
          groups: groupSummary.rows,
          test_search: testResult.rows.map(gf => ({
            store_name: gf.store_name,
            distance_meters: Math.round(parseFloat(gf.distance_meters))
          })),
          timestamp: new Date().toISOString()
        });
        
      } catch (importError) {
        console.error('[ADMIN] Error importing geofences:', importError);
        return res.json({
          debug: 'import_geofences_error',
          error: importError.message,
          code: importError.code,
          detail: importError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Debug: Setup adaptive tracking tables if ?debug=setup_adaptive query param
    if (req.query.debug === 'setup_adaptive') {
      try {
        console.log('[ADMIN] Setting up adaptive tracking tables...');
        
        // 1. Create tracking_config_log table
        await db.query(`
          CREATE TABLE IF NOT EXISTS tracking_config_log (
              id BIGSERIAL PRIMARY KEY,
              tracker_id VARCHAR(50) NOT NULL,
              action VARCHAR(50) NOT NULL,
              context VARCHAR(50),
              ip_address INET,
              metadata JSONB,
              timestamp TIMESTAMP DEFAULT NOW()
          )
        `);

        // 2. Create tracking_adaptation_log table
        await db.query(`
          CREATE TABLE IF NOT EXISTS tracking_adaptation_log (
              id BIGSERIAL PRIMARY KEY,
              tracker_id VARCHAR(50) NOT NULL,
              old_profile VARCHAR(50),
              new_profile VARCHAR(50) NOT NULL,
              reasons JSONB NOT NULL,
              priority INTEGER,
              conditions JSONB,
              effectiveness_score DECIMAL(3,2),
              timestamp TIMESTAMP DEFAULT NOW()
          )
        `);

        // 3. Create tracking_profile_stats table
        await db.query(`
          CREATE TABLE IF NOT EXISTS tracking_profile_stats (
              id BIGSERIAL PRIMARY KEY,
              tracker_id VARCHAR(50) NOT NULL,
              profile VARCHAR(50) NOT NULL,
              usage_duration_minutes INTEGER DEFAULT 0,
              locations_received INTEGER DEFAULT 0,
              average_accuracy DECIMAL(6,2),
              average_battery_drain DECIMAL(5,2),
              geofence_events INTEGER DEFAULT 0,
              battery_efficiency_score DECIMAL(3,2),
              accuracy_score DECIMAL(3,2),
              coverage_score DECIMAL(3,2),
              started_at TIMESTAMP NOT NULL,
              ended_at TIMESTAMP,
              last_updated TIMESTAMP DEFAULT NOW()
          )
        `);

        // 4. Create indexes
        await db.query(`CREATE INDEX IF NOT EXISTS idx_config_log_tracker ON tracking_config_log(tracker_id, timestamp DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_adaptation_log_tracker ON tracking_adaptation_log(tracker_id, timestamp DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_profile_stats_tracker ON tracking_profile_stats(tracker_id, started_at DESC)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_gps_locations_user_battery ON gps_locations(user_id, battery) WHERE battery IS NOT NULL`);

        // 5. Insert adaptive tracking configuration
        await db.query(`
          INSERT INTO tracking_config (key, value, data_type, description) VALUES 
          ('adaptive_tracking_enabled', 'true', 'boolean', 'Activar/desactivar tracking adaptativo automático'),
          ('adaptation_cooldown_minutes', '5', 'integer', 'Minutos entre adaptaciones automáticas'),
          ('battery_critical_threshold', '10', 'integer', 'Porcentaje de batería crítico'),
          ('battery_low_threshold', '20', 'integer', 'Porcentaje de batería bajo'),
          ('accuracy_poor_threshold', '100', 'integer', 'Precisión GPS pobre (metros)'),
          ('movement_stationary_threshold', '5', 'integer', 'Velocidad estacionaria (km/h)'),
          ('adaptation_min_priority', '5', 'integer', 'Prioridad mínima para adaptación'),
          ('profile_effectiveness_weight', '0.7', 'decimal', 'Peso del score de efectividad')
          ON CONFLICT (key) DO NOTHING
        `);

        // 6. Verify tables created
        const tablesResult = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN ('tracking_config_log', 'tracking_adaptation_log', 'tracking_profile_stats')
          ORDER BY table_name
        `);

        const configResult = await db.query(`
          SELECT key, value 
          FROM tracking_config 
          WHERE key LIKE 'adaptive_%' OR key LIKE '%threshold%' OR key LIKE '%cooldown%'
          ORDER BY key
        `);

        return res.json({
          debug: 'setup_adaptive',
          success: true,
          message: 'Adaptive tracking system setup completed successfully',
          created_tables: tablesResult.rows.map(r => r.table_name),
          config_entries: configResult.rows.length,
          adaptive_configs: configResult.rows,
          timestamp: new Date().toISOString()
        });
        
      } catch (adaptiveError) {
        console.error('[ADMIN] Error setting up adaptive tracking:', adaptiveError);
        return res.json({
          debug: 'setup_adaptive_error',
          error: adaptiveError.message,
          code: adaptiveError.code,
          detail: adaptiveError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Setup roles and permissions if ?debug=setup_roles query param
    if (req.query.debug === 'setup_roles') {
      try {
        console.log('[ADMIN] Setting up roles and permissions system...');
        
        // Agregar columnas de rol y grupo si no existen
        await db.query(`
          ALTER TABLE tracking_users 
          ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT 'usuario',
          ADD COLUMN IF NOT EXISTS grupo VARCHAR(50) DEFAULT NULL
        `);
        
        // Crear tabla de roles si no existe
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_roles (
            id SERIAL PRIMARY KEY,
            role_name VARCHAR(20) UNIQUE NOT NULL,
            display_name VARCHAR(50) NOT NULL,
            description TEXT,
            permissions JSONB DEFAULT '{}',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Insertar roles por defecto
        await db.query(`
          INSERT INTO user_roles (role_name, display_name, description, permissions) VALUES
          ('auditor', 'Auditor', 'Acceso completo a todos los usuarios y sucursales', '{"view_all_users": true, "view_all_geofences": true, "view_all_reports": true, "admin_access": true}'),
          ('director', 'Director', 'Acceso a usuarios y sucursales de su grupo', '{"view_group_users": true, "view_group_geofences": true, "view_group_reports": true}'),
          ('gerente', 'Gerente', 'Acceso a usuarios de su grupo', '{"view_group_users": true, "view_group_reports": true}'),
          ('supervisor', 'Supervisor', 'Acceso limitado de solo lectura', '{"view_own_reports": true}'),
          ('usuario', 'Usuario', 'Acceso básico de tracking', '{"basic_tracking": true}')
          ON CONFLICT (role_name) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            permissions = EXCLUDED.permissions
        `);
        
        // Actualizar usuarios existentes con roles por defecto
        await db.query(`
          UPDATE tracking_users 
          SET rol = 'auditor',
              grupo = 'TEPEYAC'
          WHERE tracker_id = 'RD01' OR tracker_id = '01'
        `);
        
        // Verificar setup
        const rolesResult = await db.query('SELECT * FROM user_roles ORDER BY role_name');
        const usersResult = await db.query(`
          SELECT tracker_id, display_name, rol, grupo 
          FROM tracking_users 
          WHERE rol IS NOT NULL 
          ORDER BY display_name
        `);
        
        return res.json({
          debug: 'setup_roles',
          success: true,
          message: 'Roles and permissions setup completed',
          roles_created: rolesResult.rows.length,
          roles: rolesResult.rows,
          users_with_roles: usersResult.rows.length,
          users: usersResult.rows,
          timestamp: new Date().toISOString()
        });
        
      } catch (rolesError) {
        console.error('[ADMIN] Error setting up roles:', rolesError);
        return res.json({
          debug: 'setup_roles_error',
          error: rolesError.message,
          code: rolesError.code,
          detail: rolesError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Clean import (normalized structure) from Neon if ?debug=clean_import query param
    if (req.query.debug === 'clean_import') {
      try {
        console.log('🧹 === IMPORTACIÓN LIMPIA DE ESTRUCTURA ===');
        console.log('📊 Objetivo: 20 Grupos + 83 Sucursales (sin duplicados)');
        
        const { Client } = require('pg');
        
        // Conectar a Neon
        const neonClient = new Client({
          connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
          ssl: { rejectUnauthorized: false }
        });
        
        await neonClient.connect();
        
        // Obtener estructura limpia (excluir duplicados)
        const estructuraResult = await neonClient.query(`
          SELECT DISTINCT
            location_name,
            sucursal_clean,
            latitud,
            longitud,
            estado_normalizado,
            municipio,
            grupo_operativo_limpio,
            director_operativo
          FROM supervision_operativa_clean
          WHERE latitud IS NOT NULL 
            AND longitud IS NOT NULL
            AND location_name IS NOT NULL
            AND grupo_operativo_limpio IS NOT NULL
            AND grupo_operativo_limpio != 'NO_ENCONTRADO'
            AND grupo_operativo_limpio != 'SIN_MAPEO'
          ORDER BY grupo_operativo_limpio, location_name
        `);
        
        // Normalizar TEPEYAC (eliminar duplicados formato "Sucursal XX")
        const sucursalesLimpias = estructuraResult.rows.filter(row => {
          const nombre = row.location_name;
          
          if (row.grupo_operativo_limpio === 'TEPEYAC') {
            if (nombre.startsWith('Sucursal ')) {
              console.log(`  🚫 Eliminando duplicado TEPEYAC: ${nombre}`);
              return false;
            }
          }
          
          return true;
        });
        
        console.log(`✅ Después de limpieza: ${sucursalesLimpias.length} sucursales`);
        
        // Agrupar por grupo operativo
        const gruposPorOperativo = new Map();
        sucursalesLimpias.forEach(row => {
          const grupo = row.grupo_operativo_limpio;
          if (!gruposPorOperativo.has(grupo)) {
            gruposPorOperativo.set(grupo, []);
          }
          gruposPorOperativo.get(grupo).push(row);
        });
        
        // Limpiar tabla actual
        await db.query('DELETE FROM tracking_locations_cache');
        
        // Importar estructura limpia
        let totalImportadas = 0;
        const gruposImportados = [];
        
        for (const [grupoNombre, sucursalesGrupo] of gruposPorOperativo.entries()) {
          let sucursalesGrupoImportadas = 0;
          
          for (const sucursal of sucursalesGrupo) {
            const codigoMatch = sucursal.location_name.match(/^(\\\\d+)/);
            const locationCode = codigoMatch ? codigoMatch[1] : `AUTO_${totalImportadas + 1}`;
            
            await db.query(`
              INSERT INTO tracking_locations_cache (
                location_code, name, address, latitude, longitude,
                group_name, director_name, active, geofence_radius, synced_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              ON CONFLICT (location_code) DO UPDATE SET
                name = EXCLUDED.name, group_name = EXCLUDED.group_name,
                latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                director_name = EXCLUDED.director_name, synced_at = NOW()
            `, [
              locationCode, sucursal.location_name,
              `${sucursal.municipio}, ${sucursal.estado_normalizado}`,
              parseFloat(sucursal.latitud), parseFloat(sucursal.longitud),
              grupoNombre, sucursal.director_operativo || 'Director TBD',
              true, 150
            ]);
            
            totalImportadas++;
            sucursalesGrupoImportadas++;
          }
          
          gruposImportados.push({
            grupo: grupoNombre,
            sucursales: sucursalesGrupoImportadas
          });
        }
        
        await neonClient.end();
        
        // Verificación final
        const verificacion = await db.query(`
          SELECT group_name, COUNT(*) as total
          FROM tracking_locations_cache 
          WHERE active = true
          GROUP BY group_name
          ORDER BY group_name
        `);
        
        return res.json({
          debug: 'clean_import',
          success: true,
          message: '🧹 Estructura limpia importada (sin duplicados)',
          stats: {
            grupos_importados: gruposPorOperativo.size,
            sucursales_importadas: totalImportadas,
            grupos_detalle: gruposImportados,
            verificacion_final: verificacion.rows,
            tepeyac_normalizado: true
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error en importación limpia:', error);
        return res.json({
          debug: 'clean_import_error',
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Debug: Import real data from Neon if ?debug=import_real query param
    if (req.query.debug === 'import_real') {
      try {
        console.log('🏢 Iniciando importación de estructura real desde Neon...');
        
        const { Client } = require('pg');
        
        // Conectar a Neon
        const neonClient = new Client({
          connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
          ssl: { rejectUnauthorized: false }
        });
        
        await neonClient.connect();
        
        // Obtener estructura real
        const estructuraResult = await neonClient.query(`
          SELECT DISTINCT
            location_name,
            sucursal_clean,
            latitud,
            longitud,
            estado_normalizado,
            municipio,
            grupo_operativo_limpio,
            director_operativo
          FROM supervision_operativa_clean
          WHERE latitud IS NOT NULL 
            AND longitud IS NOT NULL
            AND location_name IS NOT NULL
            AND grupo_operativo_limpio IS NOT NULL
          ORDER BY grupo_operativo_limpio, location_name
        `);
        
        // Agrupar por grupo operativo
        const gruposPorOperativo = new Map();
        estructuraResult.rows.forEach(row => {
          const grupo = row.grupo_operativo_limpio;
          if (!gruposPorOperativo.has(grupo)) {
            gruposPorOperativo.set(grupo, []);
          }
          gruposPorOperativo.get(grupo).push(row);
        });
        
        // Limpiar tabla actual
        await db.query('DELETE FROM tracking_locations_cache');
        
        // Importar estructura real
        let totalImportadas = 0;
        const gruposImportados = [];
        
        for (const [grupoNombre, sucursalesGrupo] of gruposPorOperativo.entries()) {
          let sucursalesGrupoImportadas = 0;
          
          for (const sucursal of sucursalesGrupo) {
            const codigoMatch = sucursal.location_name.match(/^(\\\\d+)/);
            const locationCode = codigoMatch ? codigoMatch[1] : `AUTO_${totalImportadas + 1}`;
            
            await db.query(`
              INSERT INTO tracking_locations_cache (
                location_code, name, address, latitude, longitude,
                group_name, director_name, active, geofence_radius, synced_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
              ON CONFLICT (location_code) DO UPDATE SET
                name = EXCLUDED.name, group_name = EXCLUDED.group_name,
                latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                director_name = EXCLUDED.director_name, synced_at = NOW()
            `, [
              locationCode, sucursal.location_name,
              `${sucursal.municipio}, ${sucursal.estado_normalizado}`,
              parseFloat(sucursal.latitud), parseFloat(sucursal.longitud),
              grupoNombre, sucursal.director_operativo || 'Director TBD',
              true, 150
            ]);
            
            totalImportadas++;
            sucursalesGrupoImportadas++;
          }
          
          gruposImportados.push({
            grupo: grupoNombre,
            sucursales: sucursalesGrupoImportadas
          });
        }
        
        await neonClient.end();
        
        // Verificación final
        const verificacion = await db.query(`
          SELECT group_name, COUNT(*) as total
          FROM tracking_locations_cache 
          WHERE active = true
          GROUP BY group_name
          ORDER BY group_name
        `);
        
        return res.json({
          debug: 'import_real',
          success: true,
          message: '🎉 Estructura real importada desde Neon Clean View',
          stats: {
            grupos_importados: gruposPorOperativo.size,
            sucursales_importadas: totalImportadas,
            grupos_detalle: gruposImportados,
            verificacion_final: verificacion.rows
          },
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error en importación real:', error);
        return res.json({
          debug: 'import_real_error',
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }

/**
 * GET /api/admin/setup-user-management
 * Setup user management system via API endpoint
 */
router.get('/setup-user-management', async (req, res) => {
  try {
    console.log('🚀 Setup de Sistema de Gestión de Usuarios via API');
    
    const bcrypt = require('bcrypt');
    const fs = require('fs');
    const path = require('path');
    
    // Leer schema de user management
    const schemaPath = path.join(__dirname, '../../database/user-management-schema.sql');
    
    let schemaSql;
    try {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } catch (err) {
      return res.json({
        success: false,
        error: 'Schema file not found: ' + schemaPath,
        timestamp: new Date().toISOString()
      });
    }
    
    // Ejecutar schema
    await db.query(schemaSql);
    
    // Crear usuario administrador
    const defaultPassword = 'admin123';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    
    const adminResult = await db.query(`
      INSERT INTO system_users (email, password_hash, full_name, user_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING id, email, full_name
    `, [
      'admin@polloloco.com',
      passwordHash,
      'Administrador Sistema',
      'admin'
    ]);
    
    // Verificar tablas creadas
    const newTablesCheck = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN (
          'system_users', 'directors', 'supervisors', 
          'director_groups', 'supervisor_assignments'
        )
      ORDER BY tablename
    `);
    
    return res.json({
      success: true,
      message: '🚀 Sistema de Gestión de Usuarios instalado',
      stats: {
        tables_created: newTablesCheck.rows.length,
        tables_list: newTablesCheck.rows.map(r => r.tablename),
        admin_user: {
          email: adminResult.rows[0].email,
          password: 'admin123 (¡CAMBIAR!)',
          id: adminResult.rows[0].id
        }
      },
      endpoints_available: [
        'POST /api/auth/login',
        'GET /api/auth/me',
        'POST /api/auth/logout'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error en setup user management:', error);
    return res.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

    // Debug: Setup user management system if ?debug=setup_users query param
    if (req.query.debug === 'setup_users') {
      try {
        console.log('🚀 Setup de Sistema de Gestión de Usuarios');
        
        const bcrypt = require('bcrypt');
        const fs = require('fs');
        const path = require('path');
        
        // Leer schema de user management
        const schemaPath = path.join(__dirname, '../../database/user-management-schema.sql');
        
        let schemaSql;
        try {
          schemaSql = fs.readFileSync(schemaPath, 'utf8');
        } catch (err) {
          return res.json({
            debug: 'setup_users_error',
            success: false,
            error: 'Schema file not found: ' + schemaPath,
            timestamp: new Date().toISOString()
          });
        }
        
        // Ejecutar schema
        await db.query(schemaSql);
        
        // Crear usuario administrador
        const defaultPassword = 'admin123';
        const passwordHash = await bcrypt.hash(defaultPassword, 12);
        
        const adminResult = await db.query(`
          INSERT INTO system_users (email, password_hash, full_name, user_type)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO UPDATE SET
            password_hash = EXCLUDED.password_hash,
            updated_at = NOW()
          RETURNING id, email, full_name
        `, [
          'admin@polloloco.com',
          passwordHash,
          'Administrador Sistema',
          'admin'
        ]);
        
        // Verificar tablas creadas
        const newTablesCheck = await db.query(`
          SELECT tablename 
          FROM pg_tables 
          WHERE schemaname = 'public' 
            AND tablename IN (
              'system_users', 'directors', 'supervisors', 
              'director_groups', 'supervisor_assignments'
            )
          ORDER BY tablename
        `);
        
        return res.json({
          debug: 'setup_users',
          success: true,
          message: '🚀 Sistema de Gestión de Usuarios instalado',
          stats: {
            tables_created: newTablesCheck.rows.length,
            tables_list: newTablesCheck.rows.map(r => r.tablename),
            admin_user: {
              email: adminResult.rows[0].email,
              password: 'admin123 (¡CAMBIAR!)',
              id: adminResult.rows[0].id
            }
          },
          endpoints_available: [
            'POST /api/auth/login',
            'GET /api/auth/me',
            'POST /api/auth/logout'
          ],
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error en setup users:', error);
        return res.json({
          debug: 'setup_users_error',
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Debug: Setup route system tables if ?debug=setup_routes query param  
    if (req.query.debug === 'setup_routes') {
      try {
        console.log('[ADMIN] Setting up route system tables...');
        
        // Tabla para rutas calculadas
        await db.query(`
          CREATE TABLE IF NOT EXISTS calculated_routes (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES tracking_users(id),
            
            -- Datos de la ruta
            waypoints JSONB NOT NULL,
            metrics JSONB NOT NULL,
            directions JSONB,
            
            -- Configuración de cálculo
            algorithm VARCHAR(50) NOT NULL,
            constraints JSONB DEFAULT '{}',
            preferences JSONB DEFAULT '{}',
            
            -- Estado y metadata
            status VARCHAR(20) DEFAULT 'calculated',
            start_location JSONB,
            total_sucursales INTEGER,
            
            -- Timestamps
            created_at TIMESTAMP DEFAULT NOW(),
            started_at TIMESTAMP,
            completed_at TIMESTAMP
          )
        `);
        
        // Tabla para optimizaciones de rutas
        await db.query(`
          CREATE TABLE IF NOT EXISTS route_optimizations (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES tracking_users(id),
            
            -- Rutas comparadas
            base_route JSONB NOT NULL,
            optimized_route JSONB NOT NULL,
            
            -- Estrategia y análisis
            strategy VARCHAR(50) NOT NULL,
            recommendations JSONB DEFAULT '[]',
            metrics JSONB NOT NULL,
            improvements JSONB,
            
            -- APIs utilizadas
            external_apis_used JSONB DEFAULT '[]',
            api_response_times JSONB DEFAULT '{}',
            
            -- Calidad y feedback
            quality_score INTEGER,
            user_feedback INTEGER,
            user_notes TEXT,
            
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Tabla para ejecución de rutas en tiempo real
        await db.query(`
          CREATE TABLE IF NOT EXISTS route_executions (
            id BIGSERIAL PRIMARY KEY,
            route_id BIGINT REFERENCES calculated_routes(id),
            user_id INTEGER REFERENCES tracking_users(id),
            
            -- Progreso de ejecución
            current_waypoint_index INTEGER DEFAULT 0,
            completed_waypoints INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            
            -- Métricas de ejecución real
            actual_start_time TIMESTAMP,
            actual_end_time TIMESTAMP,
            actual_distance_km DECIMAL(8,2),
            actual_duration_minutes INTEGER,
            
            -- Desviaciones vs. plan
            route_deviations JSONB DEFAULT '[]',
            unplanned_stops JSONB DEFAULT '[]',
            delays JSONB DEFAULT '[]',
            
            -- Eficiencia
            efficiency_score INTEGER,
            fuel_consumption_actual DECIMAL(6,2),
            
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Tabla para análisis de visitas a sucursales en rutas
        await db.query(`
          CREATE TABLE IF NOT EXISTS route_sucursal_visits (
            id BIGSERIAL PRIMARY KEY,
            route_execution_id BIGINT REFERENCES route_executions(id),
            geofence_id INTEGER REFERENCES geofences(id),
            user_id INTEGER REFERENCES tracking_users(id),
            
            -- Timing de la visita
            planned_arrival TIMESTAMP,
            actual_arrival TIMESTAMP,
            planned_departure TIMESTAMP,
            actual_departure TIMESTAMP,
            duration_minutes INTEGER,
            
            -- Orden en la ruta
            planned_order INTEGER,
            actual_order INTEGER,
            was_skipped BOOLEAN DEFAULT FALSE,
            skip_reason TEXT,
            
            -- Métricas de la visita
            distance_from_previous_km DECIMAL(6,2),
            travel_time_minutes INTEGER,
            visit_efficiency_score INTEGER,
            
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Tabla para configuración del sistema de rutas
        await db.query(`
          CREATE TABLE IF NOT EXISTS route_system_config (
            id SERIAL PRIMARY KEY,
            config_key VARCHAR(100) UNIQUE NOT NULL,
            config_value TEXT NOT NULL,
            data_type VARCHAR(20) DEFAULT 'string',
            description TEXT,
            category VARCHAR(50) DEFAULT 'general',
            
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Insertar configuraciones por defecto
        await db.query(`
          INSERT INTO route_system_config (config_key, config_value, data_type, description, category) VALUES
          ('max_sucursales_per_route', '10', 'integer', 'Número máximo de sucursales por ruta', 'limits'),
          ('max_route_duration_hours', '8', 'integer', 'Duración máxima de ruta en horas', 'limits'),
          ('max_route_distance_km', '150', 'integer', 'Distancia máxima de ruta en kilómetros', 'limits'),
          ('default_visit_time_minutes', '30', 'integer', 'Tiempo promedio por visita en minutos', 'timing'),
          ('average_speed_kmh', '40', 'integer', 'Velocidad promedio en ciudad km/h', 'timing'),
          ('fuel_cost_per_km', '2.50', 'decimal', 'Costo estimado de combustible por km (MXN)', 'costs'),
          ('route_optimization_enabled', 'true', 'boolean', 'Habilitar optimización inteligente de rutas', 'features')
          ON CONFLICT (config_key) DO NOTHING
        `);
        
        // Crear índices
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_calculated_routes_user ON calculated_routes(user_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_route_executions_user ON route_executions(user_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_route_visits_execution ON route_sucursal_visits(route_execution_id);
        `);
        
        // Verificar tablas creadas
        const tablesResult = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name LIKE '%route%' 
          ORDER BY table_name
        `);
        
        // Verificar configuraciones
        const configResult = await db.query('SELECT * FROM route_system_config ORDER BY config_key');
        
        return res.json({
          debug: 'setup_routes',
          success: true,
          message: 'Route system setup completed successfully',
          tables_created: tablesResult.rows.length,
          tables: tablesResult.rows.map(r => r.table_name),
          config_entries: configResult.rows.length,
          configurations: configResult.rows,
          timestamp: new Date().toISOString()
        });
        
      } catch (routeError) {
        console.error('[ADMIN] Error setting up route system:', routeError);
        return res.json({
          debug: 'setup_routes_error',
          error: routeError.message,
          code: routeError.code,
          detail: routeError.detail,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Normal users listing with roles and groups
    const result = await db.query(`
      SELECT 
        id,
        tracker_id,
        zenput_email,
        zenput_user_id,
        display_name,
        phone,
        active,
        rol,
        grupo,
        created_at,
        updated_at
      FROM tracking_users
      ORDER BY display_name
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo usuarios:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users
 * Crear nuevo usuario de tracking
 */
router.post('/users', logAction('CREATE_USER', 'user'), async (req, res) => {
  try {
    const {
      tracker_id,
      zenput_email,
      zenput_user_id,
      display_name,
      phone,
      rol,
      grupo
    } = req.body;
    
    // Validaciones
    if (!tracker_id || !zenput_email || !display_name) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: tracker_id, zenput_email, display_name'
      });
    }
    
    // Verificar que tracker_id no exista
    const existingUser = await db.query(
      'SELECT id FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: `Tracker ID '${tracker_id}' ya existe`
      });
    }
    
    // Crear usuario
    const result = await db.query(`
      INSERT INTO tracking_users 
      (tracker_id, zenput_email, zenput_user_id, display_name, phone, rol, grupo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [tracker_id, zenput_email, zenput_user_id, display_name, phone, rol, grupo]);
    
    const newUser = result.rows[0];
    
    // Log de auditoría
    await logAdminAction('create_user', 'tracking_users', newUser.id, null, JSON.stringify(newUser));
    
    console.log(`✅ Usuario creado: ${tracker_id} (${display_name})`);
    
    res.status(201).json(newUser);
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:tracker_id
 * Actualizar usuario de tracking
 */
router.put('/users/:tracker_id', logAction('UPDATE_USER', 'user'), async (req, res) => {
  try {
    const { tracker_id } = req.params;
    const { active, display_name, phone, zenput_email } = req.body;
    
    // Obtener usuario actual para auditoría
    const currentResult = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [tracker_id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: `Usuario '${tracker_id}' no encontrado`
      });
    }
    
    const currentUser = currentResult.rows[0];
    
    // Construir query dinámico
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(active);
    }
    
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(display_name);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (zenput_email !== undefined) {
      updates.push(`zenput_email = $${paramIndex++}`);
      values.push(zenput_email);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No hay campos para actualizar'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(tracker_id);
    
    const query = `
      UPDATE tracking_users 
      SET ${updates.join(', ')}
      WHERE tracker_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await db.query(query, values);
    const updatedUser = result.rows[0];
    
    // Log de auditoría
    await logAdminAction('update_user', 'tracking_users', tracker_id, 
      JSON.stringify(currentUser), JSON.stringify(updatedUser));
    
    console.log(`✅ Usuario actualizado: ${tracker_id}`);
    
    res.json(updatedUser);
    
  } catch (error) {
    console.error('❌ Error actualizando usuario:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/config
 * Obtener configuración del sistema
 */
router.get('/config', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT key, value, data_type, description
      FROM tracking_config
      ORDER BY key
    `);
    
    const config = {};
    result.rows.forEach(row => {
      config[row.key] = {
        value: row.value,
        type: row.data_type,
        description: row.description
      };
    });
    
    res.json(config);
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/config/:key
 * Actualizar configuración
 */
router.put('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({
        error: 'Valor requerido'
      });
    }
    
    // Obtener valor actual
    const currentResult = await db.query(
      'SELECT value FROM tracking_config WHERE key = $1',
      [key]
    );
    
    const oldValue = currentResult.rows[0]?.value;
    
    const success = await db.setConfig(key, value, 'admin_api');
    
    if (success) {
      // Log de auditoría (deshabilitado temporalmente)
      // await logAdminAction('update_config', 'tracking_config', key, oldValue, value);
      
      res.json({ 
        key, 
        value, 
        old_value: oldValue,
        updated_at: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'Error actualizando configuración' });
    }
    
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/visits/today
 * Visitas de hoy para panel admin
 */
router.get('/visits/today', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        v.id,
        v.user_id,
        tu.display_name as supervisor_name,
        v.location_code,
        lc.name as location_name,
        lc.group_name,
        v.entry_time,
        v.exit_time,
        v.duration_minutes,
        v.visit_type,
        v.is_valid
      FROM tracking_visits v
      LEFT JOIN tracking_users tu ON v.user_id = tu.id
      LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code
      WHERE DATE(v.entry_time) = CURRENT_DATE
      ORDER BY v.entry_time DESC
      LIMIT 50
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo visitas admin:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/stats/dashboard
 * Estadísticas para dashboard
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    const stats = {};
    
    // Usuarios activos
    const usersResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM tracking_users
    `);
    stats.users = usersResult.rows[0];
    
    // Sucursales
    const locationsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM tracking_locations_cache
    `);
    stats.locations = locationsResult.rows[0];
    
    // Visitas hoy
    const visitsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE exit_time IS NOT NULL) as completed,
        COUNT(*) FILTER (WHERE exit_time IS NULL) as open
      FROM tracking_visits
      WHERE DATE(entry_time) = CURRENT_DATE
    `);
    stats.visits_today = visitsResult.rows[0];
    
    // Sistema activo
    const systemActive = await db.getConfig('system_active', 'false');
    stats.system_status = systemActive === 'true' ? 'active' : 'paused';
    
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas dashboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/logs
 * Obtener logs de auditoría
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT 
        id,
        admin_user,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value,
        timestamp
      FROM tracking_admin_log
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    
    res.json({
      logs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo logs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/gps/locations
 * Obtener ubicaciones GPS recientes
 */
router.get('/gps/locations', async (req, res) => {
  try {
    const { limit = 100, hours = 24, user_id } = req.query;
    
    let query = `
      SELECT 
        gl.id,
        gl.user_id,
        tu.tracker_id,
        tu.display_name,
        gl.latitude,
        gl.longitude,
        gl.accuracy,
        gl.altitude,
        gl.battery,
        gl.velocity,
        gl.heading,
        gl.gps_timestamp,
        gl.received_at,
        EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/60 as minutes_ago,
        CASE 
          WHEN EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/60 < 60 
          THEN CONCAT(ROUND(EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/60), ' min')
          ELSE CONCAT(ROUND(EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/3600, 1), ' horas')
        END as time_ago
      FROM gps_locations gl
      INNER JOIN tracking_users tu ON gl.user_id = tu.id
      WHERE gl.gps_timestamp >= NOW() - INTERVAL '${parseInt(hours)} hours'
    `;
    
    const queryParams = [];
    
    if (user_id) {
      queryParams.push(parseInt(user_id));
      query += ` AND gl.user_id = $${queryParams.length}`;
    }
    
    query += `
      ORDER BY gl.gps_timestamp DESC
      LIMIT ${parseInt(limit)}
    `;
    
    const result = await db.query(query, queryParams);
    
    res.json({
      locations: result.rows,
      count: result.rows.length,
      filters: {
        hours: parseInt(hours),
        user_id: user_id ? parseInt(user_id) : null,
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo ubicaciones GPS:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/gps/latest
 * Obtener última ubicación de cada usuario
 */
router.get('/gps/latest', async (req, res) => {
  try {
    const result = await db.query(`
      WITH latest_locations AS (
        SELECT DISTINCT ON (user_id)
          gl.id,
          gl.user_id,
          tu.tracker_id,
          tu.display_name,
          tu.active as user_active,
          gl.latitude,
          gl.longitude,
          gl.accuracy,
          gl.battery,
          gl.velocity,
          gl.gps_timestamp,
          EXTRACT(EPOCH FROM (NOW() - gl.gps_timestamp))/60 as minutes_ago
        FROM gps_locations gl
        INNER JOIN tracking_users tu ON gl.user_id = tu.id
        WHERE gl.gps_timestamp >= NOW() - INTERVAL '24 hours'
        ORDER BY user_id, gps_timestamp DESC
      )
      SELECT 
        *,
        CASE 
          WHEN minutes_ago < 5 THEN 'online'
          WHEN minutes_ago < 15 THEN 'recent'
          WHEN minutes_ago < 60 THEN 'away'
          ELSE 'offline'
        END as status,
        CASE 
          WHEN minutes_ago < 60 
          THEN CONCAT(ROUND(minutes_ago), ' min')
          ELSE CONCAT(ROUND(minutes_ago/60, 1), ' horas')
        END as time_ago
      FROM latest_locations
      ORDER BY user_active DESC, minutes_ago ASC
    `);
    
    res.json({
      users: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo últimas ubicaciones:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/directors
 * Crear nuevo director
 */
router.post('/directors', logAction('CREATE_DIRECTOR', 'director'), async (req, res) => {
  try {
    const {
      director_code,
      full_name,
      email,
      telegram_chat_id
    } = req.body;
    
    // Validaciones
    if (!director_code || !full_name || !email) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: director_code, full_name, email'
      });
    }
    
    // Verificar que director_code no exista
    const existingDirector = await db.query(
      'SELECT id FROM directors WHERE director_code = $1',
      [director_code]
    );
    
    if (existingDirector.rows.length > 0) {
      return res.status(409).json({
        error: `Código de director '${director_code}' ya existe`
      });
    }
    
    // Primero crear usuario del sistema
    const bcrypt = require('bcrypt');
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    
    const systemUserResult = await db.query(`
      INSERT INTO system_users (email, password_hash, full_name, user_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [email, passwordHash, full_name, 'director']);
    
    const systemUserId = systemUserResult.rows[0].id;
    
    // Luego crear director
    const result = await db.query(`
      INSERT INTO directors 
      (user_id, director_code, full_name, telegram_chat_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [systemUserId, director_code, full_name, telegram_chat_id]);
    
    const newDirector = result.rows[0];
    
    console.log(`✅ Director creado: ${director_code} (${full_name})`);
    console.log(`🔑 Password temporal: ${tempPassword}`);
    
    res.status(201).json({
      ...newDirector,
      temp_password: tempPassword,
      login_email: email
    });
    
  } catch (error) {
    console.error('❌ Error creando director:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/directors
 * Obtener lista de directores
 */
router.get('/directors', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        d.id,
        d.director_code,
        d.full_name,
        d.telegram_chat_id,
        d.active,
        d.created_at,
        su.email,
        array_agg(dg.group_name) FILTER (WHERE dg.group_name IS NOT NULL) as groups
      FROM directors d
      LEFT JOIN system_users su ON d.user_id = su.id
      LEFT JOIN director_groups dg ON d.id = dg.director_id
      GROUP BY d.id, d.director_code, d.full_name, d.telegram_chat_id, d.active, d.created_at, su.email
      ORDER BY d.full_name
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo directores:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/actions/cleanup
 * Limpiar datos antiguos
 */
router.post('/actions/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    
    const locationProcessor = require('../../services/location-processor');
    const visitDetector = require('../../services/visit-detector');
    
    const results = {
      old_locations: await locationProcessor.cleanupOldLocations(days),
      invalid_visits: await visitDetector.cleanupInvalidVisits()
    };
    
    // Log de auditoría (deshabilitado temporalmente)
    // await logAdminAction('cleanup', 'system', 'maintenance', null, JSON.stringify(results));
    
    res.json({
      status: 'completed',
      results
    });
    
  } catch (error) {
    console.error('❌ Error en cleanup:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GESTIÓN DE GRUPOS OPERATIVOS Y GEOFENCES
 * Nuevos endpoints para el panel de administración completo
 */

/**
 * GET /api/admin/groups
 * Obtener todos los grupos operativos con sucursales
 */
router.get('/groups', logAction('VIEW_GROUPS', 'groups'), async (req, res) => {
  try {
    // Obtener grupos con sucursales y estadísticas
    const result = await db.query(`
      SELECT 
        group_name,
        director_name,
        COUNT(*) as total_sucursales,
        COUNT(CASE WHEN active THEN 1 END) as sucursales_activas,
        COUNT(CASE WHEN geofence_enabled THEN 1 END) as geofences_activos,
        AVG(geofence_radius) as radio_promedio,
        MIN(created_at) as fecha_creacion
      FROM tracking_locations_cache
      GROUP BY group_name, director_name
      ORDER BY group_name
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo grupos:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/groups/:groupName/locations
 * Obtener sucursales de un grupo específico
 */
router.get('/groups/:groupName/locations', logAction('VIEW_GROUP_LOCATIONS', 'locations'), async (req, res) => {
  try {
    const { groupName } = req.params;
    
    const result = await db.query(`
      SELECT 
        id,
        location_code,
        location_name,
        address,
        latitude,
        longitude,
        group_name,
        director_name,
        active,
        geofence_radius,
        geofence_enabled,
        created_at,
        updated_at
      FROM tracking_locations_cache
      WHERE group_name = $1
      ORDER BY location_code
    `, [groupName]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo ubicaciones del grupo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/locations/:id/geofence
 * Activar/desactivar geofence de una sucursal
 */
router.put('/locations/:id/geofence', logAction('UPDATE_GEOFENCE', 'location'), async (req, res) => {
  try {
    const { id } = req.params;
    const { geofence_enabled, geofence_radius } = req.body;
    
    // Validaciones
    if (typeof geofence_enabled !== 'boolean') {
      return res.status(400).json({
        error: 'geofence_enabled debe ser true o false'
      });
    }
    
    if (geofence_radius && (geofence_radius < 10 || geofence_radius > 1000)) {
      return res.status(400).json({
        error: 'geofence_radius debe estar entre 10 y 1000 metros'
      });
    }
    
    // Actualizar geofence
    const updateFields = ['geofence_enabled = $2', 'updated_at = NOW()'];
    const values = [id, geofence_enabled];
    
    if (geofence_radius) {
      updateFields.push('geofence_radius = $3');
      values.push(geofence_radius);
    }
    
    const result = await db.query(`
      UPDATE tracking_locations_cache 
      SET ${updateFields.join(', ')}
      WHERE id = $1
      RETURNING 
        id, location_code, location_name, group_name,
        geofence_enabled, geofence_radius, updated_at
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }
    
    res.json({
      success: true,
      message: `Geofence ${geofence_enabled ? 'activado' : 'desactivado'} exitosamente`,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error actualizando geofence:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/locations
 * Crear nueva sucursal
 */
router.post('/locations', logAction('CREATE_LOCATION', 'location'), async (req, res) => {
  try {
    const {
      location_code,
      location_name,
      address,
      latitude,
      longitude,
      group_name,
      director_name,
      geofence_radius = 100
    } = req.body;
    
    // Validaciones
    if (!location_code || !location_name || !latitude || !longitude || !group_name) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: location_code, location_name, latitude, longitude, group_name'
      });
    }
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Coordenadas inválidas'
      });
    }
    
    // Verificar que el código no exista
    const existingLocation = await db.query(
      'SELECT id FROM tracking_locations_cache WHERE location_code = $1',
      [location_code]
    );
    
    if (existingLocation.rows.length > 0) {
      return res.status(409).json({
        error: `Código de sucursal '${location_code}' ya existe`
      });
    }
    
    // Crear sucursal
    const result = await db.query(`
      INSERT INTO tracking_locations_cache 
      (location_code, location_name, address, latitude, longitude, group_name, director_name, geofence_radius, geofence_enabled, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true)
      RETURNING 
        id, location_code, location_name, group_name, latitude, longitude,
        geofence_enabled, geofence_radius, created_at
    `, [
      location_code,
      location_name,
      address || null,
      latitude,
      longitude,
      group_name,
      director_name || null,
      geofence_radius
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Sucursal creada exitosamente',
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error creando sucursal:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/geofences/summary
 * Resumen de geofences por grupo operativo
 */
router.get('/geofences/summary', logAction('VIEW_GEOFENCES_SUMMARY', 'geofences'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        group_name,
        COUNT(*) as total_sucursales,
        COUNT(CASE WHEN geofence_enabled THEN 1 END) as geofences_activos,
        COUNT(CASE WHEN NOT geofence_enabled THEN 1 END) as geofences_inactivos,
        ROUND(AVG(geofence_radius)) as radio_promedio,
        MIN(geofence_radius) as radio_minimo,
        MAX(geofence_radius) as radio_maximo
      FROM tracking_locations_cache
      WHERE active = true
      GROUP BY group_name
      ORDER BY group_name
    `);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error obteniendo resumen de geofences:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/groups/:groupName/geofences
 * Activar/desactivar todos los geofences de un grupo
 */
router.put('/groups/:groupName/geofences', logAction('BULK_UPDATE_GEOFENCES', 'geofences'), async (req, res) => {
  try {
    const { groupName } = req.params;
    const { geofence_enabled, geofence_radius } = req.body;
    
    if (typeof geofence_enabled !== 'boolean') {
      return res.status(400).json({
        error: 'geofence_enabled debe ser true o false'
      });
    }
    
    const updateFields = ['geofence_enabled = $2', 'updated_at = NOW()'];
    const values = [groupName, geofence_enabled];
    
    if (geofence_radius && geofence_radius >= 10 && geofence_radius <= 1000) {
      updateFields.push('geofence_radius = $3');
      values.push(geofence_radius);
    }
    
    const result = await db.query(`
      UPDATE tracking_locations_cache 
      SET ${updateFields.join(', ')}
      WHERE group_name = $1 AND active = true
      RETURNING COUNT(*) as updated_count
    `, values);
    
    const countResult = await db.query(
      'SELECT COUNT(*) as updated_count FROM tracking_locations_cache WHERE group_name = $1 AND active = true',
      [groupName]
    );
    
    res.json({
      success: true,
      message: `${geofence_enabled ? 'Activados' : 'Desactivados'} todos los geofences del grupo ${groupName}`,
      updated_count: parseInt(countResult.rows[0].updated_count),
      group_name: groupName,
      geofence_enabled
    });
    
  } catch (error) {
    console.error('❌ Error actualizando geofences del grupo:', error.message);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;