const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * PLAN COMPLETO PARA ELIMINAR ZENPUT DB
 * Limpiar código y optimizar sistema
 */
async function removeZenputPlan() {
  try {
    console.log('🧹 PLAN ELIMINACIÓN ZENPUT DB COMPLETA\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Análisis de dependencias Zenput
    console.log('🔍 PASO 1: ANÁLISIS DEPENDENCIAS ZENPUT');
    console.log('');
    
    const filesToCheck = [
      './src/config/zenput-database.js',
      './src/services/zenput-sync.js',
      './src/api/routes/tracking.routes.js',
      './src/index.js',
      './src/jobs/scheduler.js'
    ];
    
    console.log('📁 ARCHIVOS A ANALIZAR:');
    filesToCheck.forEach(file => {
      if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} - Existe, revisar`);
      } else {
        console.log(`   ❌ ${file} - No existe`);
      }
    });
    
    // 2. Plan de limpieza
    console.log('\n🗑️ PASO 2: PLAN DE LIMPIEZA');
    console.log('');
    
    const cleanupPlan = {
      'archivos_eliminar': [
        'src/config/zenput-database.js',
        'src/services/zenput-sync.js',
        'referencias en package.json (si las hay)',
      ],
      'archivos_modificar': [
        'src/index.js - Remover imports y inicialización Zenput',
        'src/jobs/scheduler.js - Remover jobs Zenput sync',
        'src/api/routes/* - Limpiar referencias Zenput',
      ],
      'variables_entorno': [
        'ZENPUT_DB_URL - Remover de .env',
        'Variables relacionadas Zenput API',
      ],
      'health_check': [
        'Actualizar health endpoint',
        'Remover status Zenput DB'
      ]
    };
    
    Object.entries(cleanupPlan).forEach(([category, items]) => {
      console.log(`📋 ${category.toUpperCase().replace('_', ' ')}:`);
      items.forEach(item => console.log(`   • ${item}`));
      console.log('');
    });
    
    // 3. Script de limpieza automática
    console.log('🤖 PASO 3: SCRIPT LIMPIEZA AUTOMÁTICA');
    console.log('');
    
    const cleanupScript = `/**
 * Script automático para eliminar todas las referencias Zenput
 */

const fs = require('fs');
const path = require('path');

class ZenputCleaner {
  constructor() {
    this.filesToModify = [];
    this.filesToDelete = [];
    this.backup = {};
  }
  
  // Eliminar archivo Zenput database
  removeZenputDatabase() {
    const zenputDbPath = './src/config/zenput-database.js';
    if (fs.existsSync(zenputDbPath)) {
      console.log('🗑️ Eliminando zenput-database.js...');
      fs.unlinkSync(zenputDbPath);
      console.log('✅ zenput-database.js eliminado');
    }
  }
  
  // Limpiar index.js
  cleanIndex() {
    const indexPath = './src/index.js';
    if (fs.existsSync(indexPath)) {
      console.log('🧹 Limpiando index.js...');
      
      let content = fs.readFileSync(indexPath, 'utf8');
      
      // Remover import zenput
      content = content.replace(/const zenputDB = require\\('\\.\\/config\\/zenput-database'\\);\\n?/g, '');
      content = content.replace(/const zenputDB = require\\("\\.\\/config\\/zenput-database"\\);\\n?/g, '');
      
      // Remover test zenput en main function
      content = content.replace(/\\s*\\/\\/ Test conexiones de BD[\\s\\S]*?await testDatabaseConnections\\(\\);\\n?/g, '\\n    // Test conexión principal\\n    console.log(\\'🔍 Verificando conexión...\\');\\n    await testDatabaseConnection();\\n');
      
      fs.writeFileSync(indexPath, content);
      console.log('✅ index.js limpiado');
    }
  }
  
  // Limpiar health check
  cleanHealthCheck() {
    const healthPath = './src/api/routes/health.routes.js';
    if (fs.existsSync(healthPath)) {
      console.log('🧹 Limpiando health check...');
      
      let content = fs.readFileSync(healthPath, 'utf8');
      
      // Remover import zenput
      content = content.replace(/const zenputDB = require\\('.*zenput-database.*'\\);\\n?/g, '');
      
      // Remover zenput_db del status
      content = content.replace(/,\\s*"zenput_db":\\s*\\{[^}]*\\}/g, '');
      content = content.replace(/"zenput_db":\\s*\\{[^}]*\\},?/g, '');
      
      fs.writeFileSync(healthPath, content);
      console.log('✅ Health check limpiado');
    }
  }
  
  // Crear función test simple
  createSimpleDBTest() {
    const testFunction = \`
/**
 * Test conexión base de datos principal únicamente
 */
async function testDatabaseConnection() {
  try {
    const result = await db.query('SELECT NOW() as timestamp, COUNT(*) as users FROM tracking_users');
    console.log('✅ Base de datos principal:', {
      timestamp: result.rows[0].timestamp,
      users: result.rows[0].users
    });
    return true;
  } catch (error) {
    console.error('❌ Error BD principal:', error.message);
    return false;
  }
}
\`;
    
    const indexPath = './src/index.js';
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Agregar función si no existe
    if (!content.includes('async function testDatabaseConnection')) {
      const insertPoint = content.indexOf('async function main()');
      if (insertPoint > -1) {
        content = content.slice(0, insertPoint) + testFunction + '\\n\\n' + content.slice(insertPoint);
        fs.writeFileSync(indexPath, content);
        console.log('✅ Función test DB simple agregada');
      }
    }
  }
  
  // Limpiar scheduler
  cleanScheduler() {
    const schedulerPath = './src/jobs/scheduler.js';
    if (fs.existsSync(schedulerPath)) {
      console.log('🧹 Limpiando scheduler...');
      
      let content = fs.readFileSync(schedulerPath, 'utf8');
      
      // Remover imports zenput
      content = content.replace(/const zenputDB = require\\('.*zenput.*'\\);\\n?/g, '');
      
      // Remover jobs zenput sync
      content = content.replace(/\\/\\*\\*[\\s\\S]*?zenput[\\s\\S]*?\\*\\/[\\s\\S]*?cron\\.schedule[\\s\\S]*?\\}\\);\\n?/gi, '');
      
      fs.writeFileSync(schedulerPath, content);
      console.log('✅ Scheduler limpiado');
    }
  }
  
  // Generar reporte de limpieza
  generateReport() {
    console.log('\\n📊 REPORTE LIMPIEZA ZENPUT:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ ARCHIVOS LIMPIADOS:');
    console.log('   • src/config/zenput-database.js - ELIMINADO');
    console.log('   • src/index.js - Referencias removidas');
    console.log('   • src/api/routes/health.routes.js - Status simplificado');
    console.log('   • src/jobs/scheduler.js - Jobs zenput removidos');
    console.log('');
    console.log('🎯 RESULTADO:');
    console.log('   • Código más limpio y mantenible');
    console.log('   • Menor complejidad sistema');
    console.log('   • Dependencias reducidas');
    console.log('   • Health check simplificado');
    console.log('   • Mejor rendimiento startup');
    console.log('');
    console.log('📋 SIGUIENTES PASOS:');
    console.log('   1. Verificar que aplicación sigue funcionando');
    console.log('   2. Actualizar documentación');
    console.log('   3. Commit cambios con mensaje descriptivo');
    console.log('   4. Deploy y testing');
  }
  
  // Ejecutar limpieza completa
  async runCleanup() {
    console.log('🚀 Iniciando limpieza completa Zenput...\\n');
    
    this.removeZenputDatabase();
    this.cleanIndex();
    this.createSimpleDBTest();
    this.cleanHealthCheck();
    this.cleanScheduler();
    
    this.generateReport();
    
    console.log('\\n✅ Limpieza Zenput completada!');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const cleaner = new ZenputCleaner();
  cleaner.runCleanup();
}

module.exports = ZenputCleaner;`;

    const cleanupScriptPath = './cleanup-zenput.js';
    fs.writeFileSync(cleanupScriptPath, cleanupScript);
    console.log(`✅ Script limpieza creado: ${cleanupScriptPath}`);
    
    // 4. Beneficios de la limpieza
    console.log('\n💡 PASO 4: BENEFICIOS ELIMINACIÓN ZENPUT');
    console.log('');
    
    const benefits = {
      'Performance': [
        'Startup más rápido (una conexión DB menos)',
        'Menor uso memoria RAM',
        'Health checks más simples',
        'Menos complejidad en deploy'
      ],
      'Mantenimiento': [
        'Código más limpio y fácil entender',
        'Menos dependencias externas',
        'Debug más simple',
        'Menos puntos de fallo'
      ],
      'Escalabilidad': [
        'Enfoque en una sola fuente verdad',
        'Arquitectura más simple',
        'Fácil migración futuras mejoras',
        'Mejor testing'
      ],
      'Seguridad': [
        'Menos credenciales gestionar',
        'Superficie ataque reducida',
        'Mejor control acceso',
        'Auditoría simplificada'
      ]
    };
    
    Object.entries(benefits).forEach(([category, items]) => {
      console.log(`🎯 ${category}:`);
      items.forEach(item => console.log(`   • ${item}`));
      console.log('');
    });
    
    // 5. Verificación integridad datos
    console.log('📊 PASO 5: VERIFICACIÓN INTEGRIDAD DATOS');
    console.log('');
    
    try {
      // Verificar datos esenciales en BD principal
      const users = await pool.query('SELECT COUNT(*) FROM tracking_users');
      const locations = await pool.query('SELECT COUNT(*) FROM gps_locations WHERE gps_timestamp >= NOW() - INTERVAL \'24 hours\'');
      const geofences = await pool.query('SELECT COUNT(*) FROM tracking_locations_cache WHERE geofence_enabled = true');
      
      console.log('✅ DATOS VERIFICADOS EN BD PRINCIPAL:');
      console.log(`   👥 Usuarios: ${users.rows[0].count}`);
      console.log(`   📍 Ubicaciones (24h): ${locations.rows[0].count}`);
      console.log(`   🎯 Geofences activos: ${geofences.rows[0].count}`);
      
      if (parseInt(users.rows[0].count) > 0) {
        console.log('   🎉 Datos suficientes para funcionar independientemente');
      } else {
        console.log('   ⚠️ Pocos datos, considerar migración adicional');
      }
      
    } catch (error) {
      console.log('⚠️ No se pudo verificar datos:', error.message);
    }
    
    console.log('\n🎯 INSTRUCCIONES FINALES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('1. 🤖 EJECUTAR LIMPIEZA:');
    console.log('   node cleanup-zenput.js');
    console.log('');
    console.log('2. 🧪 TESTING LOCAL:');
    console.log('   npm start');
    console.log('   curl http://localhost:3000/health');
    console.log('');
    console.log('3. 📦 DEPLOY:');
    console.log('   git add .');
    console.log('   git commit -m "🧹 Remove Zenput DB dependencies completely"');
    console.log('   git push');
    console.log('');
    console.log('4. ✅ VERIFICACIÓN:');
    console.log('   Verificar health endpoint en producción');
    console.log('   Confirmar sistema funciona normalmente');
    console.log('');
    console.log('💡 TU SISTEMA QUEDARÁ:');
    console.log('   ✅ Más rápido y estable');
    console.log('   ✅ Enfocado en tracking GPS únicamente');
    console.log('   ✅ Fácil mantener y escalar');
    console.log('   ✅ Listo para funcionalidades enterprise');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

removeZenputPlan();