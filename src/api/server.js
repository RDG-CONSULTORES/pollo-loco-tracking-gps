const express = require('express');
const cors = require('cors');
const path = require('path');
require('express-async-errors');

// Routes
const ownTracksRoutes = require('./routes/owntracks.routes');
const ownTracksConfigRoutes = require('./routes/owntracks-config.routes');
const trackingRoutes = require('./routes/tracking.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');
const debugRoutes = require('./routes/debug.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const routesRoutes = require('./routes/routes.routes');

// NEW: User Management Routes
const authRoutes = require('./routes/auth.routes');

// NEW: Mobile Admin Routes
const mobileAdminRoutes = require('./routes/mobile-admin.routes');

// NEW: Directors Management Routes
const directorsRoutes = require('./routes/directors.routes');

// NEW: GPS Wizard Routes
const gpsWizardRoutes = require('./routes/gps-wizard.routes');

// NEW: Alerts Configuration Routes
const alertsConfigRoutes = require('./routes/alerts-config.routes');

// NEW: Admin Dashboard Routes (Foundation Phase)
const adminDashboardRoutes = require('./routes/admin-dashboard.routes');

// NEW: Public Dashboard Routes (NO AUTH REQUIRED)
const publicDashboardRoutes = require('./routes/public-dashboard.routes');

// NEW: Telegram Detection Routes (Mini-Step 1B)
const telegramDetectionRoutes = require('./routes/telegram-detection.routes');

// NEW: Unified User Management Routes (Panel Unificado EPL CAS)
const unifiedUserRoutes = require('./routes/unified-user-management.routes');

// NEW: QR System Routes (RE-HABILITADO)
const qrRoutes = require('./routes/qr-system');

// NEW: Detection Management Routes (RE-HABILITADO)
const detectionManagementRoutes = require('./routes/detection-management');

// NEW: OwnTracks Remote Configuration (RE-HABILITADO)
const ownTracksRemoteConfig = require('./routes/owntracks-remote-config');

// NEW: Setup Generator Routes (Configuración automática para empleados)
const setupGeneratorRoutes = require('./routes/setup-generator.routes');

// NEW: Branch Validation Routes (Sistema de Validación de 85 Sucursales)
const branchValidationRoutes = require('./routes/branch-validation.routes');

// NEW: Fresh Coordinates Routes (Sin Cache - Fix Coordenadas)
const freshCoordinatesRoutes = require('./routes/fresh-coordinates.routes');

// NEW: Traccar Integration Routes (Sistema Dual GPS)
const traccarRoutes = require('./routes/traccar.routes');
const traccarConfigRoutes = require('./routes/traccar-config.routes');

// NEW: Real-time processing middleware (RE-HABILITADO)
const { processLocationMiddleware } = require('../middleware/realtime-processor');

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
  
  // Ruta específica para validación de sucursales
  app.get('/validation', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/branch-validation.html'));
  });
  
  app.get('/validacion-sucursales', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/branch-validation.html'));
  });
  
  // Página de acceso principal para validación
  app.get('/validacion', (req, res) => {
    res.sendFile(path.join(__dirname, '../../validacion.html'));
  });
  
  // Rutas específicas para el dashboard
  app.get('/webapp/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/dashboard.html'));
  });
  
  // Dashboard fresco sin cache - FIX COORDENADAS
  app.get('/webapp/fresh-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/fresh-dashboard.html'));
  });
  
  // Admin panel - redirigir a versión móvil para Telegram
  app.get('/webapp/admin.html', (req, res) => {
    const userAgent = req.get('User-Agent') || '';
    const isTelegram = userAgent.includes('Telegram') || userAgent.includes('TelegramBot');
    
    if (isTelegram) {
      res.sendFile(path.join(__dirname, '../webapp/admin-mobile.html'));
    } else {
      res.sendFile(path.join(__dirname, '../webapp/admin.html'));
    }
  });
  
  // Director panel - específico para directores
  app.get('/webapp/director.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/director-panel.html'));
  });
  
  // GPS Wizard - configuración fácil usuarios
  app.get('/webapp/gps-wizard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/gps-wizard.html'));
  });
  
  // Alerts Configuration - configuración de alertas
  app.get('/webapp/alerts-config.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/alerts-config.html'));
  });
  
  // QR Management - sistema QR automático OwnTracks
  app.get('/webapp/qr-management.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/qr-management.html'));
  });
  
  // Admin Dashboard - Foundation Phase
  app.get('/webapp/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/admin-dashboard.html'));
  });
  
  // Telegram Detection - Mini-Step 1B
  app.get('/webapp/telegram-detection.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/telegram-detection.html'));
  });
  
  // Unified User Panel - Panel Unificado EPL CAS
  app.get('/webapp/unified-user-panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/unified-user-panel.html'));
  });
  
  // Dual GPS Demo - Sistema Traccar + OwnTracks
  app.get('/webapp/dual-gps-demo.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/dual-gps-demo.html'));
  });
  
  // Setup Instructions redirect
  app.get('/setup-instructions', (req, res) => {
    res.redirect('/api/qr/instructions');
  });
  
  // Versión móvil específica
  app.get('/webapp/admin-mobile.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/admin-mobile.html'));
  });
  
  app.get('/webapp/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/login.html'));
  });
  
  app.get('/webapp/redirect.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/redirect.html'));
  });
  
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
  
  // Ruta por defecto PRIMERO - redirigir al nuevo dashboard
  app.get('/', (req, res) => {
    res.redirect('/webapp/redirect.html');
  });
  
  // API info endpoint
  app.get('/api', (req, res) => {
    res.json({
      name: 'Pollo Loco Tracking GPS',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        owntracks: '/api/owntracks/location',
        admin: '/api/admin/*',
        debug: '/api/debug/*',
        dashboard: '/api/dashboard/*',
        webapp: '/webapp'
      }
    });
  });
  
  // Routes (middleware de tiempo real en OwnTracks)
  app.use('/api/owntracks', processLocationMiddleware); // Real-time processing - RE-HABILITADO
  app.use('/api/owntracks', ownTracksRoutes);
  app.use('/api/owntracks', ownTracksConfigRoutes);
  app.use('/api/owntracks-remote', ownTracksRemoteConfig); // Configuración remota optimizada - RE-HABILITADO
  app.use('/api/tracking', trackingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin', mobileAdminRoutes);  // Mobile admin routes
  app.use('/api/admin', adminDashboardRoutes); // Admin Dashboard Foundation Phase
  app.use('/api/public', publicDashboardRoutes); // Public Dashboard - NO AUTH REQUIRED
  app.use('/api/telegram', telegramDetectionRoutes); // Telegram Detection - Mini-Step 1B
  app.use('/api/fresh-coordinates', freshCoordinatesRoutes); // Fresh Coordinates - Sin Cache Fix
  app.use('/api/users', unifiedUserRoutes); // Unified User Management - Panel EPL CAS
  app.use('/api/directors', directorsRoutes); // Directors management routes
  app.use('/api/gps-wizard', gpsWizardRoutes); // GPS setup wizard routes
  app.use('/api/alerts-config', alertsConfigRoutes); // Alerts configuration routes
  app.use('/api/branch-validation', branchValidationRoutes); // Branch validation system
  app.use('/api/qr', qrRoutes); // QR system for automatic OwnTracks setup - RE-HABILITADO
  app.use('/api/detection', detectionManagementRoutes); // Detection management endpoints - RE-HABILITADO
  app.use('/api/setup', setupGeneratorRoutes); // Setup generator for employees - NUEVO
  
  // NEW: Traccar Integration Routes (Sistema Dual GPS)
  app.use('/api/traccar', processLocationMiddleware); // Real-time processing for Traccar - NUEVO
  app.use('/api/traccar', traccarRoutes); // Traccar Client protocol support - NUEVO
  app.use('/api/traccar-config', traccarConfigRoutes); // Traccar configuration generator - NUEVO
  app.use('/api/debug', debugRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/routes', routesRoutes);
  app.use('/health', healthRoutes);
  
  // NEW: User Management Routes
  app.use('/api/auth', authRoutes);
  
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
    console.log(`🗺️ Dashboard available at: /webapp/dashboard.html`);
    console.log(`🔗 OwnTracks endpoint: /api/owntracks/location`);
    console.log(`💚 Health endpoint: /health`);
    
    if (process.env.NODE_ENV === 'production') {
      console.log(`🌐 Public URL: ${process.env.WEB_APP_URL}`);
    } else {
      console.log(`🌐 Local URL: http://localhost:${port}`);
    }
    
    // Inicializar WebSocket
    const websocketManager = require('../services/websocket-manager');
    websocketManager.initialize(server);
    websocketManager.startHeartbeat();
    
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
// DEPLOY TRIGGER - 2025-11-26T22:30:43.072Z
// Coordenadas actualizadas desde CSV normalizado de Roberto
// Total branches: 82
// Total geofences: 85
// Status: PRODUCTION READY
console.log('🎯 COORDENADAS ACTUALIZADAS: 2025-11-26T22:30:43.072Z');
