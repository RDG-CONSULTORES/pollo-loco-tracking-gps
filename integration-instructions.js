/**
 * Script para integrar optimizaciones con el sistema principal
 */

// En src/index.js agregar:
/*
const { startUniversalMonitoring } = require('./jobs/universal-geofence');
const { processLocationMiddleware } = require('./middleware/realtime-processor');

// Después de inicializar el servidor:
startUniversalMonitoring();

// En las rutas de OwnTracks:
app.use('/api/owntracks', processLocationMiddleware);
*/

// En src/api/server.js agregar:
/*
const detectionManagement = require('./routes/detection-management');
app.use('/api', detectionManagement);
*/