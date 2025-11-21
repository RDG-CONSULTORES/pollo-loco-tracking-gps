/**
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
      content = content.replace(/const zenputDB = require\('\.\/config\/zenput-database'\);\n?/g, '');
      content = content.replace(/const zenputDB = require\("\.\/config\/zenput-database"\);\n?/g, '');
      
      // Remover test zenput en main function
      content = content.replace(/\s*\/\/ Test conexiones de BD[\s\S]*?await testDatabaseConnections\(\);\n?/g, '\n    // Test conexión principal\n    console.log(\'🔍 Verificando conexión...\');\n    await testDatabaseConnection();\n');
      
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
      content = content.replace(/const zenputDB = require\('.*zenput-database.*'\);\n?/g, '');
      
      // Remover zenput_db del status
      content = content.replace(/,\s*"zenput_db":\s*\{[^}]*\}/g, '');
      content = content.replace(/"zenput_db":\s*\{[^}]*\},?/g, '');
      
      fs.writeFileSync(healthPath, content);
      console.log('✅ Health check limpiado');
    }
  }
  
  // Crear función test simple
  createSimpleDBTest() {
    const testFunction = `
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
`;
    
    const indexPath = './src/index.js';
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Agregar función si no existe
    if (!content.includes('async function testDatabaseConnection')) {
      const insertPoint = content.indexOf('async function main()');
      if (insertPoint > -1) {
        content = content.slice(0, insertPoint) + testFunction + '\n\n' + content.slice(insertPoint);
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
      content = content.replace(/const zenputDB = require\('.*zenput.*'\);\n?/g, '');
      
      // Remover jobs zenput sync
      content = content.replace(/\/\*\*[\s\S]*?zenput[\s\S]*?\*\/[\s\S]*?cron\.schedule[\s\S]*?\}\);\n?/gi, '');
      
      fs.writeFileSync(schedulerPath, content);
      console.log('✅ Scheduler limpiado');
    }
  }
  
  // Generar reporte de limpieza
  generateReport() {
    console.log('\n📊 REPORTE LIMPIEZA ZENPUT:');
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
    console.log('🚀 Iniciando limpieza completa Zenput...\n');
    
    this.removeZenputDatabase();
    this.cleanIndex();
    this.createSimpleDBTest();
    this.cleanHealthCheck();
    this.cleanScheduler();
    
    this.generateReport();
    
    console.log('\n✅ Limpieza Zenput completada!');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const cleaner = new ZenputCleaner();
  cleaner.runCleanup();
}

module.exports = ZenputCleaner;