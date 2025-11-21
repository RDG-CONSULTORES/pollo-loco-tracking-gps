/**
 * Execute Railway Migration - Complete Schema Update
 * Run: node scripts/execute-railway-migration.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function executeRailwayMigration() {
  console.log('🚂 Ejecutando migración completa en Railway...');
  
  try {
    // Import database after dotenv loads
    const db = require('../src/config/database');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'manual-railway-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📄 Ejecutando ${statements.length} declaraciones SQL...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.toLowerCase().includes('select')) {
        // Skip verification selects for now
        continue;
      }
      
      try {
        console.log(`  ${i+1}. Ejecutando: ${statement.substring(0, 60)}...`);
        await db.query(statement);
        successCount++;
        
        // Small delay to avoid overwhelming Railway
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('does not exist')) {
          console.log(`  ⚠️ Esperado: ${error.message.split(':')[0]}`);
        } else {
          console.error(`  ❌ Error en statement ${i+1}:`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log(`\n✅ Migración completada: ${successCount} exitosas, ${errorCount} errores`);
    
    // Verification queries
    console.log('\n🔍 Verificando migración...');
    
    try {
      // Check tracking_users columns
      const columnsResult = await db.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'tracking_users' 
          AND column_name IN ('email', 'phone', 'position', 'username', 'password_hash', 'permissions')
        ORDER BY column_name
      `);
      
      console.log('📋 Columnas tracking_users:');
      columnsResult.rows.forEach(col => {
        console.log(`  ✅ ${col.column_name}: ${col.data_type}`);
      });
      
      // Check operational_groups
      const groupsResult = await db.query('SELECT COUNT(*) as count FROM operational_groups');
      console.log(`📊 Grupos operativos: ${groupsResult.rows[0].count}`);
      
      // Check tables
      const tablesResult = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('operational_groups', 'branches', 'user_group_permissions') 
          AND table_schema = 'public'
      `);
      
      console.log('🗄️ Tablas creadas:');
      tablesResult.rows.forEach(table => {
        console.log(`  ✅ ${table.table_name}`);
      });
      
    } catch (verifyError) {
      console.warn('⚠️ Error en verificación:', verifyError.message);
    }
    
    console.log('\n🎯 MIGRACIÓN RAILWAY COMPLETADA - Panel Unificado ready!');
    return true;
    
  } catch (error) {
    console.error('❌ Error fatal en migración:', error.message);
    throw error;
  }
}

// Execute migration
if (require.main === module) {
  executeRailwayMigration()
    .then(() => {
      console.log('🚀 Migration successful, exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = { executeRailwayMigration };