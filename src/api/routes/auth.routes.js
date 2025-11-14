const express = require('express');
const router = express.Router();
const authService = require('../../services/auth-service');
const { extractClientInfo, requireAuth, logAction } = require('../../middleware/auth-middleware');

/**
 * RUTAS DE AUTENTICACIÓN
 * Sistema de login/logout para usuarios del sistema
 */

// Middleware para todas las rutas
router.use(extractClientInfo);

/**
 * POST /api/auth/login
 * Login de usuario
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y password son requeridos',
        code: 'VALIDATION_ERROR'
      });
    }

    const result = await authService.login({
      email,
      password,
      ipAddress: req.clientIp,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      data: result
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      error: error.message,
      code: 'LOGIN_FAILED'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout de usuario
 */
router.post('/logout', requireAuth, logAction('LOGOUT', 'auth'), async (req, res) => {
  try {
    // Extraer session token del JWT
    const sessionToken = req.sessionToken;
    
    await authService.logout(sessionToken);

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Error cerrando sesión',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Error obteniendo información del usuario',
      code: 'USER_INFO_ERROR'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Cambiar password del usuario
 */
router.post('/change-password', requireAuth, logAction('PASSWORD_CHANGE', 'user'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Password actual y nuevo password son requeridos',
        code: 'VALIDATION_ERROR'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'El nuevo password debe tener al menos 6 caracteres',
        code: 'VALIDATION_ERROR'
      });
    }

    await authService.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword
    });

    res.json({
      success: true,
      message: 'Password cambiado exitosamente'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({
      error: error.message,
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Verificar si un token es válido
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token es requerido',
        code: 'VALIDATION_ERROR'
      });
    }

    const verification = await authService.verifyToken(token);

    if (verification.success) {
      res.json({
        success: true,
        valid: true,
        user: verification.user
      });
    } else {
      res.status(401).json({
        success: false,
        valid: false,
        error: verification.error
      });
    }

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      error: 'Error verificando token',
      code: 'TOKEN_VERIFY_ERROR'
    });
  }
});

/**
 * GET /api/auth/stats
 * Estadísticas de usuarios (solo admin)
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    // Solo admin puede ver estadísticas
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const stats = await authService.getUserStats();

    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Error obteniendo estadísticas',
      code: 'STATS_ERROR'
    });
  }
});

module.exports = router;