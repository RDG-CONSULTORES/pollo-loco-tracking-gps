const express = require('express');
const router = express.Router();

/**
 * GET /health
 * Health check endpoint para Railway y monitoreo
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test básico de bases de datos
    const dbTests = await performDatabaseTests();
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.4',
      environment: process.env.NODE_ENV || 'development',
      response_time_ms: responseTime,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      database: dbTests,
      services: await checkServices()
    };
    
    // Determinar status general
    const hasErrors = dbTests.railway_db.error;
    
    if (hasErrors) {
      health.status = 'unhealthy';
      res.status(503);
    } else {
      res.status(200);
    }
    
    res.json(health);
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }
});

/**
 * GET /health/ready
 * Readiness check para Railway deployments
 */
router.get('/ready', async (req, res) => {
  try {
    // Verificaciones críticas para deployment
    const checks = {
      database: false,
      config: false,
      telegram: false
    };
    
    // Test database connection
    const db = require('../../config/database');
    try {
      await db.query('SELECT 1');
      checks.database = true;
    } catch (error) {
      console.error('❌ Database not ready:', error.message);
    }
    
    // Test config
    try {
      const systemActive = await db.getConfig('system_active');
      checks.config = systemActive !== null;
    } catch (error) {
      console.error('❌ Config not ready:', error.message);
    }
    
    // Test Telegram config
    try {
      const telegramConfig = require('../../config/telegram');
      checks.telegram = telegramConfig.validateConfig();
    } catch (error) {
      console.error('❌ Telegram not ready:', error.message);
    }
    
    const isReady = checks.database && checks.config;
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      checks,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /health/live
 * Liveness check para Railway
 */
router.get('/live', (req, res) => {
  // Check muy básico - solo verifica que el proceso esté vivo
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    uptime: process.uptime()
  });
});

/**
 * Realizar tests de base de datos
 */
async function performDatabaseTests() {
  const results = {
    railway_db: { status: 'unknown', error: null }
  };
  
  // Test Railway DB
  try {
    const db = require('../../config/database');
    const result = await db.query('SELECT COUNT(*) as count FROM tracking_users');
    results.railway_db = {
      status: 'connected',
      users_count: parseInt(result.rows[0].count),
      error: null
    };
  } catch (error) {
    results.railway_db = {
      status: 'error',
      error: error.message
    };
  }
  
  return results;
}

/**
 * Verificar estado de servicios
 */
async function checkServices() {
  const services = {
    tracking: 'unknown',
    telegram_bot: 'unknown',
    scheduler: 'unknown'
  };
  
  try {
    // Verificar tracking system
    const db = require('../../config/database');
    const systemActive = await db.getConfig('system_active');
    services.tracking = systemActive === 'true' ? 'active' : 'paused';
  } catch (error) {
    services.tracking = 'error';
  }
  
  try {
    // Verificar Telegram Bot
    const telegramConfig = require('../../config/telegram');
    services.telegram_bot = telegramConfig.validateConfig() ? 'configured' : 'not_configured';
  } catch (error) {
    services.telegram_bot = 'error';
  }
  
  // TODO: Verificar scheduler cuando se implemente
  services.scheduler = 'not_implemented';
  
  return services;
}

module.exports = router;