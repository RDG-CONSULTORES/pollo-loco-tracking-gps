const express = require('express');
const cors = require('cors');
const path = require('path');
require('express-async-errors');

// Routes
const ownTracksRoutes = require('./routes/owntracks.routes');
const trackingRoutes = require('./routes/tracking.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');

/**
 * Configurar servidor Express
 */
function createServer() {
  const app = express();
  
  // Middleware básico
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // CORS
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.WEB_APP_URL, 'https://web.telegram.org']
      : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  // Servir archivos estáticos (Telegram Web App)
  app.use('/webapp', express.static(path.join(__dirname, '../webapp')));
  
  // Middleware de logging
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`📡 ${timestamp} ${req.method} ${req.path} - ${req.ip}`);
    
    // Log payload para debugging (solo en development)
    if (process.env.NODE_ENV !== 'production' && req.body && Object.keys(req.body).length > 0) {
      console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    }
    
    next();
  });
  
  // Ruta por defecto PRIMERO
  app.get('/', (req, res) => {
    res.json({
      name: 'Pollo Loco Tracking GPS',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        owntracks: '/api/owntracks/location',
        admin: '/api/admin/*',
        webapp: '/webapp'
      }
    });
  });
  
  // Routes
  app.use('/api/owntracks', ownTracksRoutes);
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/health', healthRoutes);
  
  // Middleware de manejo de errores
  app.use((error, req, res, next) => {
    console.error(`❌ Error en ${req.method} ${req.path}:`, error);
    
    // Log stack trace en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.error('Stack:', error.stack);
    }
    
    // Respuesta de error
    res.status(error.status || 500).json({
      error: error.message || 'Error interno del servidor',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  });
  
  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint no encontrado',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      available_endpoints: [
        '/health',
        '/api/owntracks/location',
        '/api/tracking/*',
        '/api/admin/*',
        '/webapp'
      ]
    });
  });
  
  return app;
}

/**
 * Iniciar servidor
 */
function startServer() {
  const app = createServer();
  const port = process.env.PORT || 3000;
  
  const server = app.listen(port, () => {
    console.log(`🚀 API Server running on port ${port}`);
    console.log(`📱 Web App available at: /webapp`);
    console.log(`🔗 OwnTracks endpoint: /api/owntracks/location`);
    console.log(`💚 Health endpoint: /health`);
    
    if (process.env.NODE_ENV === 'production') {
      console.log(`🌐 Public URL: ${process.env.WEB_APP_URL}`);
    } else {
      console.log(`🌐 Local URL: http://localhost:${port}`);
    }
    
    // Log todas las rutas registradas
    console.log('\n📋 Rutas registradas:');
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        console.log(`   ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} ${middleware.route.path}`);
      }
    });
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
  
  return server;
}

module.exports = { createServer, startServer };