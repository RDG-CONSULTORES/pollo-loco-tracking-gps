const authService = require('../services/auth-service');

/**
 * MIDDLEWARE DE AUTENTICACIÓN
 * Protege rutas y maneja permisos de usuarios
 */

/**
 * Middleware básico de autenticación
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de autenticación requerido',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    const token = authHeader.substring(7); // Remover "Bearer "
    
    const verification = await authService.verifyToken(token);
    
    if (!verification.success) {
      return res.status(401).json({
        error: 'Token inválido o expirado',
        code: 'AUTH_TOKEN_INVALID',
        details: verification.error
      });
    }

    // Agregar información del usuario al request
    req.user = verification.user;
    req.sessionToken = token;

    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Error de autenticación interno',
      code: 'AUTH_INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware para verificar roles específicos
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'AUTH_USER_MISSING'
      });
    }

    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.userType
      });
    }

    next();
  };
}

/**
 * Middleware solo para administradores
 */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/**
 * Middleware para directores y administradores
 */
function requireDirectorOrAdmin(req, res, next) {
  return requireRole('admin', 'director')(req, res, next);
}

/**
 * Middleware para cualquier usuario autenticado
 */
function requireAuth(req, res, next) {
  return authenticate(req, res, next);
}

/**
 * Middleware opcional de autenticación (no bloquea si no hay token)
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verification = await authService.verifyToken(token);
      
      if (verification.success) {
        req.user = verification.user;
      }
    }

    next();

  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // No bloquear en caso de error, continuar sin usuario
    next();
  }
}

/**
 * Middleware para logging de acciones
 */
function logAction(action, resourceType = null) {
  return async (req, res, next) => {
    // Guardar la función original de res.json
    const originalJson = res.json;
    
    // Sobrescribir res.json para capturar cuando se envía la respuesta
    res.json = function(body) {
      // Solo log si la operación fue exitosa (status < 400)
      if (req.user && res.statusCode < 400) {
        authService.logAction(
          req.user.id,
          action,
          resourceType,
          req.params.id || req.body.id || null,
          {
            method: req.method,
            path: req.path,
            query: req.query,
            body_keys: req.body ? Object.keys(req.body) : []
          },
          req.ip,
          req.get('User-Agent')
        ).catch(err => {
          console.error('Error logging action:', err);
        });
      }
      
      // Llamar a la función original
      return originalJson.call(this, body);
    };
    
    next();
  };
}

/**
 * Middleware para extraer información de IP
 */
function extractClientInfo(req, res, next) {
  // IP del cliente (considerando proxies)
  req.clientIp = req.ip || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress ||
                 (req.connection.socket ? req.connection.socket.remoteAddress : null);

  next();
}

/**
 * Middleware para rate limiting por usuario
 */
const userRateLimit = new Map();

function rateLimit(maxRequests = 100, windowMs = 60 * 1000) {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    
    if (!userRateLimit.has(userId)) {
      userRateLimit.set(userId, {
        requests: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    const userLimit = userRateLimit.get(userId);
    
    if (now > userLimit.resetTime) {
      // Reset del contador
      userLimit.requests = 1;
      userLimit.resetTime = now + windowMs;
      return next();
    }

    if (userLimit.requests >= maxRequests) {
      return res.status(429).json({
        error: 'Demasiadas peticiones',
        code: 'RATE_LIMIT_EXCEEDED',
        resetTime: new Date(userLimit.resetTime).toISOString()
      });
    }

    userLimit.requests++;
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  requireAdmin,
  requireDirectorOrAdmin,
  requireAuth,
  optionalAuth,
  logAction,
  extractClientInfo,
  rateLimit
};