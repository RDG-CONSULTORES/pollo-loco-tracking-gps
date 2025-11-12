require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Script automático para configurar TODA la base de datos
 */
async function autoSetup() {
  console.log('🚀 CONFIGURACIÓN AUTOMÁTICA DE POLLO LOCO TRACKING\n');
  
  // URL de Railway
  const databaseUrl = process.env.DATABASE_URL || 
    'postgresql://postgres:pVjizvmiwNUsTigkNvVZNRjOWVaHglpG@yamabiko.proxy.rlwy.net:42861/railway';
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    // 1. Crear schema sin PostGIS (usar cálculos matemáticos)
    console.log('📄 Creando tablas...');
    
    const sqlSchema = `
-- Tabla de usuarios autorizados para tracking
CREATE TABLE IF NOT EXISTS tracking_users (
  id SERIAL PRIMARY KEY,
  tracker_id VARCHAR(10) UNIQUE NOT NULL,
  zenput_email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  last_location_time TIMESTAMP,
  last_battery_level INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sucursales (cache local)
CREATE TABLE IF NOT EXISTS tracking_locations (
  id SERIAL PRIMARY KEY,
  location_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  geofence_radius INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache de sucursales desde Zenput
CREATE TABLE IF NOT EXISTS tracking_locations_cache (
  id SERIAL PRIMARY KEY,
  location_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200),
  address TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  group_name VARCHAR(100),
  director_name VARCHAR(100),
  active BOOLEAN DEFAULT true,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cache de usuarios desde Zenput
CREATE TABLE IF NOT EXISTS tracking_users_zenput_cache (
  id SERIAL PRIMARY KEY,
  zenput_user_id VARCHAR(50) UNIQUE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50),
  active BOOLEAN DEFAULT true,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registro de ubicaciones GPS (raw data de OwnTracks)
CREATE TABLE IF NOT EXISTS tracking_locations_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tracking_users(id),
  tracker_id VARCHAR(10) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  accuracy INTEGER,
  battery_level INTEGER,
  velocity INTEGER,
  altitude INTEGER,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registro de visitas detectadas
CREATE TABLE IF NOT EXISTS tracking_visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tracking_users(id),
  location_id INTEGER REFERENCES tracking_locations(id),
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  duration_minutes INTEGER,
  entry_accuracy INTEGER,
  exit_accuracy INTEGER,
  max_accuracy INTEGER,
  location_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Configuración del sistema
CREATE TABLE IF NOT EXISTS tracking_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  data_type VARCHAR(20) DEFAULT 'string',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs de auditoría
CREATE TABLE IF NOT EXISTS tracking_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_locations_history_user_time 
  ON tracking_locations_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_locations_history_tracker_time 
  ON tracking_locations_history(tracker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visits_user_time 
  ON tracking_visits(user_id, entry_time DESC);

CREATE INDEX IF NOT EXISTS idx_visits_location_time 
  ON tracking_visits(location_id, entry_time DESC);

CREATE INDEX IF NOT EXISTS idx_visits_active 
  ON tracking_visits(user_id, exit_time) 
  WHERE exit_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_locations_active 
  ON tracking_locations(is_active) 
  WHERE is_active = true;
`;

    await client.query(sqlSchema);
    console.log('✅ Tablas creadas exitosamente\n');
    
    // 2. Insertar configuración inicial
    console.log('⚙️ Insertando configuración inicial...');
    
    const configValues = [
      ['system_active', 'true', 'Sistema activo/pausado', 'boolean'],
      ['work_hours_start', '07:00', 'Hora de inicio de jornada laboral', 'time'],
      ['work_hours_end', '21:00', 'Hora de fin de jornada laboral', 'time'],
      ['work_days', '1,2,3,4,5,6', 'Días laborales (0=Dom, 6=Sáb)', 'string'],
      ['geofence_radius_meters', '100', 'Radio de geofence en metros', 'number'],
      ['gps_accuracy_threshold', '100', 'Umbral de precisión GPS en metros', 'number'],
      ['visit_min_duration_minutes', '5', 'Duración mínima de visita en minutos', 'number'],
      ['location_timeout_minutes', '10', 'Timeout para considerar salida de sucursal', 'number'],
      ['max_visit_duration_hours', '8', 'Duración máxima de visita en horas', 'number'],
      ['daily_report_time', '21:00', 'Hora de envío de reporte diario', 'time']
    ];
    
    for (const [key, value, description, dataType] of configValues) {
      await client.query(`
        INSERT INTO tracking_config (key, value, description, data_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value, description = EXCLUDED.description
      `, [key, value, description, dataType]);
    }
    
    console.log('✅ Configuración inicial agregada\n');
    
    // 3. Crear funciones helper para cálculos geoespaciales
    console.log('🧮 Creando funciones de cálculo...');
    
    const sqlFunctions = `
-- Función para calcular distancia entre dos puntos (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R CONSTANT DECIMAL := 6371000; -- Radio de la Tierra en metros
  rad_lat1 DECIMAL := radians(lat1);
  rad_lat2 DECIMAL := radians(lat2);
  delta_lat DECIMAL := radians(lat2 - lat1);
  delta_lon DECIMAL := radians(lon2 - lon1);
  a DECIMAL;
  c DECIMAL;
BEGIN
  a := sin(delta_lat/2) * sin(delta_lat/2) +
       cos(rad_lat1) * cos(rad_lat2) *
       sin(delta_lon/2) * sin(delta_lon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para verificar si un punto está dentro del geofence
CREATE OR REPLACE FUNCTION is_within_geofence(
  user_lat DECIMAL, user_lon DECIMAL,
  location_lat DECIMAL, location_lon DECIMAL,
  radius_meters INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN calculate_distance(user_lat, user_lon, location_lat, location_lon) <= radius_meters;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

    await client.query(sqlFunctions);
    console.log('✅ Funciones creadas exitosamente\n');
    
    // 4. Verificar estructura
    console.log('📊 VERIFICANDO ESTRUCTURA CREADA:');
    
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log(`\n✅ ${tables.rows.length} tablas creadas:`);
    tables.rows.forEach(t => console.log(`   - ${t.tablename}`));
    
    // 5. Mostrar siguiente paso
    console.log('\n' + '='.repeat(50));
    console.log('✅ BASE DE DATOS CONFIGURADA EXITOSAMENTE');
    console.log('='.repeat(50));
    
    console.log('\n📋 SIGUIENTE PASO:');
    console.log('\n1. Actualiza las variables en Railway:');
    console.log(`   WEB_APP_URL=https://pollo-loco-tracking-gps-production.up.railway.app`);
    console.log('\n2. Crea el bot de Telegram:');
    console.log('   - Busca @BotFather en Telegram');
    console.log('   - Envía /newbot');
    console.log('   - Nombre: Pollo Loco Admin Bot');
    console.log('   - Username: pollolocotracking_bot');
    console.log('   - Copia el token y agrégalo a Railway');
    console.log('\n3. Obtén tu Telegram ID:');
    console.log('   - Busca @userinfobot');
    console.log('   - Envía cualquier mensaje');
    console.log('   - Copia tu ID y agrégalo a Railway');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetalles:', error);
  } finally {
    await client.end();
  }
}

// Ejecutar
if (require.main === module) {
  autoSetup();
}

module.exports = { autoSetup };