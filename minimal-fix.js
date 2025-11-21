/**
 * Minimal fix: Solo mantener lo esencial que sabemos que funciona
 */

const fs = require('fs');

console.log('🔧 MINIMAL FIX: Solo sistema esencial...\n');

// 1. Comentar todo lo nuevo en server.js, mantener solo básico
const serverPath = './src/api/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Comentar middleware tiempo real temporalmente
serverContent = serverContent.replace(
  "const { processLocationMiddleware } = require('../middleware/realtime-processor');",
  "// const { processLocationMiddleware } = require('../middleware/realtime-processor');"
);
serverContent = serverContent.replace(
  "app.use('/api/owntracks', processLocationMiddleware, ownTracksRoutes);",
  "app.use('/api/owntracks', ownTracksRoutes);"
);
serverContent = serverContent.replace(
  "const detectionManagementRoutes = require('./routes/detection-management');",
  "// const detectionManagementRoutes = require('./routes/detection-management');"
);
serverContent = serverContent.replace(
  "app.use('/api', detectionManagementRoutes); // Detection management endpoints",
  "// app.use('/api', detectionManagementRoutes); // Detection management endpoints"
);

fs.writeFileSync(serverPath, serverContent);
console.log('✅ Server.js: Solo rutas básicas mantenidas');

// 2. Comentar scheduler universal en index.js temporalmente
const indexPath = './src/index.js';
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
  "const { startUniversalMonitoring } = require('./jobs/universal-geofence');",
  "// const { startUniversalMonitoring } = require('./jobs/universal-geofence');"
);
indexContent = indexContent.replace(
  "console.log('\\n⚡ Iniciando monitoreo universal geofence...');",
  "// console.log('\\n⚡ Iniciando monitoreo universal geofence...');"
);
indexContent = indexContent.replace(
  "startUniversalMonitoring();",
  "// startUniversalMonitoring();"
);

fs.writeFileSync(indexPath, indexContent);
console.log('✅ Index.js: Solo scheduler básico mantenido');

console.log('\n🎯 SISTEMA MÍNIMO:');
console.log('   ✅ Rutas básicas OwnTracks');
console.log('   ✅ Scheduler original');
console.log('   ✅ Telegram bot');
console.log('   ✅ Base de datos');
console.log('   ✅ Sistema geofence original');
console.log('');
console.log('   ❌ Temporalmente deshabilitado:');
console.log('      • Scheduler universal');
console.log('      • Middleware tiempo real');
console.log('      • Endpoints gestión');
console.log('      • Motores IA');
console.log('');
console.log('💡 PLAN:');
console.log('   1. Deploy este mínimo funcionando');
console.log('   2. Verificar que alertas básicas funcionan');
console.log('   3. Agregar optimizaciones una por una');
console.log('   4. Testing incremental');

console.log('\n✅ Sistema mínimo configurado - deploy para verificar funcionamiento básico');