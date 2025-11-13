const fs = require('fs');
const path = require('path');

/**
 * Actualizar todas las consultas SQL para usar columnas en inglés
 */

const replacements = [
  // Columnas de tracking_visits
  { from: /salida_at/g, to: 'exit_time' },
  { from: /entrada_at/g, to: 'entry_time' },
  { from: /duracion_minutos/g, to: 'duration_minutes' },
  { from: /entrada_lat/g, to: 'entry_lat' },
  { from: /entrada_lon/g, to: 'entry_lon' },
  { from: /salida_lat/g, to: 'exit_lat' },
  { from: /salida_lon/g, to: 'exit_lon' },
  
  // Columna user_id (mantener tracker_id en tracking_users, cambiar en tracking_visits)
  { from: /v\.tracker_id/g, to: 'v.user_id' },
  { from: /tv\.tracker_id/g, to: 'tv.user_id' }
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    replacements.forEach(({ from, to }) => {
      if (content.match(from)) {
        content = content.replace(from, to);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Actualizado: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error actualizando ${filePath}: ${error.message}`);
    return false;
  }
}

function updateDirectory(dirPath) {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  let totalUpdated = 0;
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    
    if (file.isDirectory() && file.name !== 'node_modules' && file.name !== '.git') {
      totalUpdated += updateDirectory(fullPath);
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.sql'))) {
      if (updateFile(fullPath)) {
        totalUpdated++;
      }
    }
  }
  
  return totalUpdated;
}

function main() {
  console.log('🔧 Actualizando consultas SQL para usar columnas en inglés...');
  console.log('📁 Directorio: /Users/robertodavila/pollo-loco-tracking-gps/src');
  
  const updated = updateDirectory('/Users/robertodavila/pollo-loco-tracking-gps/src');
  
  console.log(`\n✅ Actualización completada: ${updated} archivos modificados`);
  console.log('\n📋 Cambios realizados:');
  console.log('   - salida_at → exit_time');
  console.log('   - entrada_at → entry_time');
  console.log('   - v.tracker_id → v.user_id (solo tracking_visits)');
  console.log('\n🚀 Ahora ejecuta git add, commit y push para aplicar los cambios');
}

if (require.main === module) {
  main();
}

module.exports = { updateDirectory, updateFile };