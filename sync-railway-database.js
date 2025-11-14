/**
 * Script para sincronizar la base de datos de Railway con el schema correcto
 * y cargar todos los grupos operativos y sucursales
 */

const fs = require('fs');

console.log('📋 PLAN DE SINCRONIZACIÓN PARA RAILWAY DATABASE\n');
console.log('=' .repeat(70));

console.log('\n🔍 PROBLEMAS IDENTIFICADOS:');
console.log('1. ❌ Tablas inconsistentes: auth-service usa "system_users" pero existe "users"');
console.log('2. ❌ Falta schema completo de user-management');  
console.log('3. ❌ No hay sucursales/geofences cargadas por grupos operativos');
console.log('4. ❌ Falta configuración de permisos por tipo de usuario');

console.log('\n🎯 PLAN DE ACCIÓN:');
console.log('\n**FASE 1: Sincronizar Schema de Autenticación**');

console.log('\n```sql');
console.log('-- 1. Crear tabla system_users (que usa auth-service.js)');
console.log(`CREATE TABLE IF NOT EXISTS system_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  user_type VARCHAR(20) CHECK (user_type IN ('admin', 'director', 'manager', 'supervisor')) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`);

console.log('\n-- 2. Migrar datos de "users" a "system_users"');
console.log(`INSERT INTO system_users (email, password_hash, full_name, user_type, active)
SELECT 
  email,
  password_hash,
  full_name,
  user_type,
  active
FROM users 
ON CONFLICT (email) DO NOTHING;`);

console.log('\n-- 3. Crear sesiones con la tabla correcta');
console.log(`CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);`);

console.log('\n-- 4. Crear logs de auditoria');
console.log(`CREATE TABLE IF NOT EXISTS user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(50),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);`);

console.log('```');

console.log('\n**FASE 2: Cargar Grupos Operativos y Sucursales**');

console.log('\n```sql');
console.log('-- Verificar si existen las tablas de tracking locations');
console.log('SELECT table_name FROM information_schema.tables WHERE table_name LIKE \'%tracking%\';');

console.log('\n-- Si no existe, crear tabla de ubicaciones de tracking');
console.log(`CREATE TABLE IF NOT EXISTS tracking_locations_cache (
  id SERIAL PRIMARY KEY,
  location_code VARCHAR(10) UNIQUE NOT NULL,
  location_name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  group_name VARCHAR(100) NOT NULL,
  director_name VARCHAR(100),
  active BOOLEAN DEFAULT true,
  geofence_radius INTEGER DEFAULT 100,
  geofence_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`);

console.log('\n-- Crear índices para optimización');
console.log(`CREATE INDEX IF NOT EXISTS idx_tracking_locations_group ON tracking_locations_cache(group_name);
CREATE INDEX IF NOT EXISTS idx_tracking_locations_active ON tracking_locations_cache(active);
CREATE INDEX IF NOT EXISTS idx_tracking_locations_geofence ON tracking_locations_cache(geofence_enabled);`);

console.log('```');

console.log('\n**FASE 3: Datos de Ejemplo (Grupos Operativos)**');

const gruposOperativos = [
  {
    name: 'TEPEYAC',
    director: 'Director Tepeyac',
    sucursales: [
      { code: '001', name: '001 - Plaza Tepeyac', lat: 25.6866, lng: -100.3161 },
      { code: '002', name: '002 - Centro Tepeyac', lat: 25.6920, lng: -100.3200 },
      { code: '003', name: '003 - Norte Tepeyac', lat: 25.7000, lng: -100.3100 }
    ]
  },
  {
    name: 'GUADALUPE',
    director: 'Director Guadalupe', 
    sucursales: [
      { code: '101', name: '101 - Plaza Guadalupe', lat: 25.6750, lng: -100.2600 },
      { code: '102', name: '102 - Centro Guadalupe', lat: 25.6800, lng: -100.2650 },
      { code: '103', name: '103 - Sur Guadalupe', lat: 25.6700, lng: -100.2550 }
    ]
  },
  {
    name: 'CENTRO',
    director: 'Director Centro',
    sucursales: [
      { code: '201', name: '201 - Centro Histórico', lat: 25.6691, lng: -100.3099 },
      { code: '202', name: '202 - Plaza Centro', lat: 25.6720, lng: -100.3150 },
      { code: '203', name: '203 - Mercado Centro', lat: 25.6650, lng: -100.3050 }
    ]
  }
];

console.log('\n```sql');
console.log('-- Insertar grupos operativos con sucursales');
gruposOperativos.forEach(grupo => {
  grupo.sucursales.forEach(sucursal => {
    console.log(`INSERT INTO tracking_locations_cache 
(location_code, location_name, latitude, longitude, group_name, director_name, active, geofence_enabled)
VALUES ('${sucursal.code}', '${sucursal.name}', ${sucursal.lat}, ${sucursal.lng}, '${grupo.name}', '${grupo.director}', true, true);`);
  });
});
console.log('```');

console.log('\n**FASE 4: Verificar Todo**');

console.log('\n```sql');
console.log('-- Verificar usuarios');
console.log('SELECT id, email, user_type, full_name, active FROM system_users;');

console.log('\n-- Verificar grupos operativos');
console.log(`SELECT 
  group_name,
  COUNT(*) as total_sucursales,
  director_name,
  COUNT(CASE WHEN geofence_enabled THEN 1 END) as geofences_activos
FROM tracking_locations_cache 
GROUP BY group_name, director_name 
ORDER BY group_name;`);

console.log('\n-- Verificar sucursales por grupo');
console.log(`SELECT 
  location_code,
  location_name,
  group_name,
  latitude,
  longitude,
  geofence_enabled
FROM tracking_locations_cache 
ORDER BY group_name, location_code;`);

console.log('```');

console.log('\n' + '=' .repeat(70));
console.log('🚀 INSTRUCCIONES PARA RAILWAY:');
console.log('\n1. Ve al dashboard de Railway');
console.log('2. Abre la consola de PostgreSQL');
console.log('3. Ejecuta FASE 1 (sincronización de autenticación)');
console.log('4. Ejecuta FASE 2 (estructura de ubicaciones)');
console.log('5. Ejecuta FASE 3 (datos de ejemplo)');
console.log('6. Ejecuta FASE 4 (verificación)');

console.log('\n📊 RESULTADO ESPERADO:');
console.log('✅ 3 grupos operativos (TEPEYAC, GUADALUPE, CENTRO)');
console.log('✅ 9 sucursales totales (3 por grupo)');
console.log('✅ Geofences configuradas para cada sucursal');
console.log('✅ Sistema de autenticación funcionando');
console.log('✅ Panel de admin con datos reales');

console.log('\n🔧 DESPUÉS DE LA SINCRONIZACIÓN:');
console.log('- El login admin funcionará correctamente');
console.log('- El panel mostrará sucursales por grupo operativo');
console.log('- Se podrán activar/desactivar geofences');  
console.log('- Los permisos funcionarán por tipo de usuario');

console.log('\n💡 NOTAS IMPORTANTES:');
console.log('- Las coordenadas son de ejemplo (área de Monterrey)');
console.log('- Los directores son de prueba');
console.log('- El radio de geofence por defecto es 100 metros');
console.log('- Todo está configurado como activo por defecto');

console.log('\n⚡ PRÓXIMO: Actualizar código para usar datos reales');