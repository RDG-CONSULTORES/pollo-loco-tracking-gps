require('dotenv').config();
const { Client } = require('pg');

/**
 * Crear tabla para eventos de geofence (entrada/salida sucursales)
 */

async function createGeofenceEventsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('🏗️ Creando tabla geofence_events...');
    
    // Crear tabla de eventos geofence
    await client.query(`
      CREATE TABLE IF NOT EXISTS geofence_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('entry', 'exit')),
        event_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        distance_meters INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Crear constraint único simple
    try {
      await client.query(`
        ALTER TABLE geofence_events 
        ADD CONSTRAINT IF NOT EXISTS unique_geofence_event_per_minute 
        UNIQUE (user_id, store_id, event_type);
      `);
    } catch (error) {
      // Ignorar si el constraint ya existe
      console.log('⚠️ Constraint ya existe o hay conflicto');
    }
    console.log('✅ Tabla geofence_events creada');
    
    // Crear índices para performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_geofence_events_user_time 
      ON geofence_events (user_id, event_time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_geofence_events_store_time 
      ON geofence_events (store_id, event_time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_geofence_events_type_time 
      ON geofence_events (event_type, event_time DESC);
    `);
    console.log('✅ Índices creados');
    
    // Verificar estructura
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'geofence_events' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Estructura de geofence_events:');
    tableInfo.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    console.log('\n🎉 Sistema de alertas geofence configurado correctamente');
    console.log('🚨 Las alertas de entrada/salida de sucursales ahora están disponibles');
    
  } catch (error) {
    console.error('💥 Error creando tabla geofence_events:', error);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  createGeofenceEventsTable()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createGeofenceEventsTable;