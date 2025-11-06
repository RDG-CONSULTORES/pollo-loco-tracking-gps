require('dotenv').config();
const zenputDB = require('../src/config/zenput-database');
const zenputClient = require('../src/integrations/zenput-client');
const zenputAPI = require('../src/integrations/zenput-api-client');

/**
 * Script para probar conexión y explorar estructura de Zenput
 */
async function testZenputConnection() {
  console.log('🔍 Probando conexión a Zenput Database...\n');
  
  try {
    // 1. Test conexión básica
    console.log('1️⃣ Test de conexión básica:');
    const connected = await zenputDB.testConnection();
    
    if (!connected) {
      console.error('❌ No se pudo conectar a Zenput Database');
      console.log('\n💡 Verificar:');
      console.log('   - Variable ZENPUT_DATABASE_URL en .env');
      console.log('   - Permisos de red/firewall');
      console.log('   - Credenciales correctas');
      return false;
    }
    
    // 2. Explorar tablas
    console.log('\n2️⃣ Explorando estructura de base de datos:');
    const tables = await zenputDB.listTables();
    
    if (tables.length === 0) {
      console.log('⚠️ No se encontraron tablas o sin permisos');
      return false;
    }
    
    // 3. Buscar tablas relacionadas con sucursales
    console.log('\n3️⃣ Buscando tablas de sucursales:');
    const locationTables = tables.filter(t => 
      t.table_name.toLowerCase().includes('location') ||
      t.table_name.toLowerCase().includes('store') ||
      t.table_name.toLowerCase().includes('branch') ||
      t.table_name.toLowerCase().includes('sucursal') ||
      t.table_name.toLowerCase().includes('site')
    );
    
    if (locationTables.length > 0) {
      console.log('📍 Tablas candidatas para sucursales:');
      for (const table of locationTables) {
        console.log(`   - ${table.table_name}`);
        
        // Explorar columnas
        await zenputDB.describeTable(table.table_name);
        
        // Obtener muestra de datos
        try {
          const sampleResult = await zenputDB.query(
            `SELECT * FROM ${table.table_name} LIMIT 3`
          );
          
          if (sampleResult.rows.length > 0) {
            console.log(`\n📊 Muestra de datos (${table.table_name}):`);
            console.log(JSON.stringify(sampleResult.rows[0], null, 2));
          }
        } catch (error) {
          console.log(`   ⚠️ Error obteniendo muestra: ${error.message}`);
        }
        
        console.log(''); // Separador
      }
    } else {
      console.log('⚠️ No se encontraron tablas obvias de sucursales');
      console.log('📋 Todas las tablas disponibles:');
      tables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
    }
    
    // 4. Buscar tablas de usuarios
    console.log('\n4️⃣ Buscando tablas de usuarios:');
    const userTables = tables.filter(t => 
      t.table_name.toLowerCase().includes('user') ||
      t.table_name.toLowerCase().includes('employee') ||
      t.table_name.toLowerCase().includes('supervisor') ||
      t.table_name.toLowerCase().includes('person')
    );
    
    if (userTables.length > 0) {
      console.log('👥 Tablas candidatas para usuarios:');
      userTables.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
      
      // Explorar primera tabla de usuarios
      if (userTables.length > 0) {
        await zenputDB.describeTable(userTables[0].table_name);
      }
    } else {
      console.log('💡 No se encontraron tablas de usuarios en BD');
      console.log('   Los usuarios podrían estar en la API de Zenput');
    }
    
    // 5. Test cliente Zenput (con nombres ajustables)
    console.log('\n5️⃣ Test de integración con cliente:');
    try {
      await zenputClient.testConnection();
    } catch (error) {
      console.log(`⚠️ Error en cliente Zenput: ${error.message}`);
      console.log('💡 Esto es esperado si los nombres de tablas no coinciden');
    }
    
    // 6. Test API de Zenput (si está configurada)
    if (process.env.ZENPUT_API_KEY) {
      console.log('\n6️⃣ Test de API de Zenput:');
      try {
        const apiConnected = await zenputAPI.testConnection();
        if (apiConnected) {
          console.log('✅ API de Zenput conectada');
          
          // Probar obtener usuarios
          const users = await zenputAPI.getUsers();
          console.log(`👥 Usuarios encontrados en API: ${users.length}`);
          
          if (users.length > 0) {
            console.log('📊 Ejemplo de usuario:');
            console.log(JSON.stringify(users[0], null, 2));
          }
        }
      } catch (error) {
        console.log(`⚠️ Error en API: ${error.message}`);
      }
    } else {
      console.log('\n6️⃣ API de Zenput no configurada (ZENPUT_API_KEY faltante)');
    }
    
    // 7. Generar recomendaciones
    console.log('\n7️⃣ Recomendaciones para configuración:');
    console.log('\n📝 Para continuar, necesitas:');
    
    if (locationTables.length > 0) {
      console.log('✅ Identificar tabla correcta de sucursales');
      console.log(`   Candidatos: ${locationTables.map(t => t.table_name).join(', ')}`);
      console.log('   Actualizar nombres en: src/integrations/zenput-client.js');
    } else {
      console.log('❌ No se encontraron tablas de sucursales');
      console.log('   Verificar permisos o usar API de Zenput');
    }
    
    if (userTables.length > 0) {
      console.log('✅ Tabla de usuarios encontrada en BD');
      console.log(`   Usar: ${userTables[0].table_name}`);
    } else if (process.env.ZENPUT_API_KEY) {
      console.log('✅ Usuarios disponibles en API');
    } else {
      console.log('❌ Configurar ZENPUT_API_KEY para usuarios');
    }
    
    console.log('\n✅ Test de conexión completado');
    return true;
    
  } catch (error) {
    console.error('❌ Error en test de conexión:', error.message);
    console.log('\n🔧 Soluciones posibles:');
    console.log('   1. Verificar ZENPUT_DATABASE_URL en .env');
    console.log('   2. Verificar permisos de red');
    console.log('   3. Verificar credenciales de base de datos');
    console.log('   4. Contactar al administrador de Zenput');
    
    return false;
  }
}

/**
 * Generar archivo de configuración basado en exploración
 */
async function generateConfigTemplate() {
  console.log('📄 Generando template de configuración...\n');
  
  try {
    const tables = await zenputDB.listTables();
    
    let config = `# CONFIGURACIÓN DETECTADA PARA ZENPUT
    
## Tablas encontradas:
${tables.map(t => `# - ${t.table_name}`).join('\n')}

## Configuración sugerida para src/integrations/zenput-client.js:

`;
    
    // Buscar tablas de sucursales
    const locationTables = tables.filter(t => 
      t.table_name.toLowerCase().includes('location') ||
      t.table_name.toLowerCase().includes('store') ||
      t.table_name.toLowerCase().includes('branch')
    );
    
    if (locationTables.length > 0) {
      config += `### Para sucursales, reemplazar en getLocations():
# Usar tabla: ${locationTables[0].table_name}
# Verificar nombres de columnas y ajustar query

`;
    }
    
    // Buscar tablas de usuarios
    const userTables = tables.filter(t => 
      t.table_name.toLowerCase().includes('user') ||
      t.table_name.toLowerCase().includes('employee')
    );
    
    if (userTables.length > 0) {
      config += `### Para usuarios, reemplazar en getUsers():
# Usar tabla: ${userTables[0].table_name}
# Verificar nombres de columnas y ajustar query

`;
    }
    
    console.log(config);
    
  } catch (error) {
    console.error('❌ Error generando configuración:', error.message);
  }
}

// Ejecutar script si se llama directamente
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'config':
      generateConfigTemplate()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;
      
    default:
      testZenputConnection()
        .then(success => process.exit(success ? 0 : 1))
        .catch(() => process.exit(1));
  }
}

module.exports = { testZenputConnection, generateConfigTemplate };