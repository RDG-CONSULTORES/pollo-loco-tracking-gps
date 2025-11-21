/**
 * Quick fix: Deshabilitar temporalmente nuevos motores para estabilizar deploy
 * Mantener solo optimizaciones que sabemos que funcionan
 */

const fs = require('fs');

console.log('🔧 QUICK FIX: Estabilizando deploy...\n');

// 1. Comentar motores avanzados en index.js temporalmente
const indexPath = './src/index.js';
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Comentar imports de motores nuevos
indexContent = indexContent.replace(
  "const { aiDetectionJob } = require('./jobs/ai-detection-engine');",
  "// const { aiDetectionJob } = require('./jobs/ai-detection-engine');"
);
indexContent = indexContent.replace(
  "const { gapFillJob } = require('./jobs/gap-fill-engine');",
  "// const { gapFillJob } = require('./jobs/gap-fill-engine');"
);

fs.writeFileSync(indexPath, indexContent);
console.log('✅ Motores avanzados comentados temporalmente en index.js');

// 2. Comentar ruta remota en server.js temporalmente  
const serverPath = './src/api/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

serverContent = serverContent.replace(
  "const ownTracksRemoteConfig = require('./routes/owntracks-remote-config');",
  "// const ownTracksRemoteConfig = require('./routes/owntracks-remote-config');"
);
serverContent = serverContent.replace(
  "app.use('/api/owntracks', ownTracksRemoteConfig); // Configuración remota optimizada",
  "// app.use('/api/owntracks', ownTracksRemoteConfig); // Configuración remota optimizada"
);

fs.writeFileSync(serverPath, serverContent);
console.log('✅ Ruta remota comentada temporalmente en server.js');

console.log('\n🎯 RESULTADO:');
console.log('   ✅ Sistema estable mantenido:');
console.log('      • Scheduler universal cada 30s');
console.log('      • Middleware tiempo real');
console.log('      • Endpoints gestión');
console.log('      • Sistema base funcionando');
console.log('');
console.log('   ⏳ Motores avanzados deshabilitados temporalmente:');
console.log('      • Motor IA (será reactivado después)');
console.log('      • Motor gap-fill (será reactivado después)');
console.log('      • Configuración remota (será reactivada después)');
console.log('');
console.log('📋 NEXT STEPS:');
console.log('   1. Deploy este fix inmediatamente');
console.log('   2. Verificar que sistema base funciona');
console.log('   3. Reactivar motores avanzados uno por uno');
console.log('   4. Testing step by step');

console.log('\n✅ Quick fix completado - listo para deploy estable');