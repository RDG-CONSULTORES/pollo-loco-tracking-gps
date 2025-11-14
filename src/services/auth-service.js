const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');

/**
 * SERVICIO DE AUTENTICACIÓN
 * Sistema seguro de login/logout para usuarios del sistema
 */
class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
    this.saltRounds = 12;
    this.sessionDuration = 24 * 60 * 60 * 1000; // 24 horas
  }

  /**
   * Crear nuevo usuario
   */
  async createUser({ email, password, fullName, userType, phone = null }) {
    try {
      // Verificar si el email ya existe
      const existingUser = await db.query(
        'SELECT id FROM system_users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Email ya está registrado');
      }

      // Hash del password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Crear usuario
      const result = await db.query(`
        INSERT INTO system_users (email, password_hash, full_name, phone, user_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, user_type, active, created_at
      `, [
        email.toLowerCase(),
        passwordHash,
        fullName,
        phone,
        userType
      ]);

      const user = result.rows[0];

      // Log de auditoría
      await this.logAction(user.id, 'USER_CREATED', 'user', user.id, {
        email: user.email,
        user_type: user.user_type
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          userType: user.user_type,
          active: user.active
        }
      };

    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error(`Error creando usuario: ${error.message}`);
    }
  }

  /**
   * Login de usuario
   */
  async login({ email, password, ipAddress, userAgent }) {
    try {
      // Buscar usuario
      const result = await db.query(`
        SELECT id, email, password_hash, full_name, user_type, active
        FROM system_users 
        WHERE email = $1
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        throw new Error('Credenciales inválidas');
      }

      const user = result.rows[0];

      if (!user.active) {
        throw new Error('Usuario inactivo');
      }

      // Verificar password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        await this.logAction(user.id, 'LOGIN_FAILED', 'auth', null, {
          reason: 'invalid_password'
        }, ipAddress, userAgent);
        throw new Error('Credenciales inválidas');
      }

      // Generar token de sesión
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.sessionDuration);

      // Crear sesión en BD
      await db.query(`
        INSERT INTO user_sessions (user_id, session_token, expires_at)
        VALUES ($1, $2, $3)
      `, [user.id, sessionToken, expiresAt]);

      // Generar JWT
      const jwtToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          userType: user.user_type,
          sessionToken: sessionToken
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      // Log de auditoría
      await this.logAction(user.id, 'LOGIN_SUCCESS', 'auth', null, {
        session_token: sessionToken
      }, ipAddress, userAgent);

      return {
        success: true,
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          userType: user.user_type
        },
        expiresAt: expiresAt
      };

    } catch (error) {
      console.error('Error during login:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Verificar token de sesión
   */
  async verifyToken(token) {
    try {
      // Verificar JWT
      const decoded = jwt.verify(token, this.jwtSecret);

      // Verificar sesión en BD
      const sessionResult = await db.query(`
        SELECT us.*, su.email, su.full_name, su.user_type, su.active
        FROM user_sessions us
        INNER JOIN system_users su ON us.user_id = su.id
        WHERE us.session_token = $1 AND us.expires_at > NOW()
      `, [decoded.sessionToken]);

      if (sessionResult.rows.length === 0) {
        throw new Error('Sesión inválida o expirada');
      }

      const session = sessionResult.rows[0];

      if (!session.active) {
        throw new Error('Usuario inactivo');
      }

      // Actualizar última actividad
      await db.query(`
        UPDATE user_sessions 
        SET last_activity = NOW()
        WHERE session_token = $1
      `, [decoded.sessionToken]);

      return {
        success: true,
        user: {
          id: session.user_id,
          email: session.email,
          fullName: session.full_name,
          userType: session.user_type
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logout de usuario
   */
  async logout(sessionToken) {
    try {
      // Eliminar sesión
      const result = await db.query(`
        DELETE FROM user_sessions 
        WHERE session_token = $1
        RETURNING user_id
      `, [sessionToken]);

      if (result.rows.length > 0) {
        await this.logAction(result.rows[0].user_id, 'LOGOUT', 'auth');
      }

      return { success: true };

    } catch (error) {
      console.error('Error during logout:', error);
      throw new Error('Error cerrando sesión');
    }
  }

  /**
   * Cambiar password
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    try {
      // Verificar password actual
      const userResult = await db.query(`
        SELECT password_hash FROM system_users WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      if (!passwordValid) {
        throw new Error('Password actual incorrecto');
      }

      // Hash del nuevo password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

      // Actualizar password
      await db.query(`
        UPDATE system_users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `, [newPasswordHash, userId]);

      // Invalidar todas las sesiones del usuario
      await db.query(`
        DELETE FROM user_sessions WHERE user_id = $1
      `, [userId]);

      // Log de auditoría
      await this.logAction(userId, 'PASSWORD_CHANGED', 'user', userId);

      return { success: true };

    } catch (error) {
      console.error('Error changing password:', error);
      throw new Error(error.message);
    }
  }

  /**
   * Limpiar sesiones expiradas
   */
  async cleanExpiredSessions() {
    try {
      const result = await db.query(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW()
      `);

      console.log(`🧹 Cleaned ${result.rowCount} expired sessions`);
      return result.rowCount;

    } catch (error) {
      console.error('Error cleaning expired sessions:', error);
    }
  }

  /**
   * Log de auditoría
   */
  async logAction(userId, action, resourceType = null, resourceId = null, details = {}, ipAddress = null, userAgent = null) {
    try {
      await db.query(`
        INSERT INTO user_audit_log (
          user_id, action, resource_type, resource_id, 
          details, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
        userAgent
      ]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getUserStats() {
    try {
      const stats = await db.query(`
        SELECT 
          user_type,
          COUNT(*) as total,
          COUNT(CASE WHEN active = true THEN 1 END) as active,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_last_month
        FROM system_users
        GROUP BY user_type
      `);

      const activeSessions = await db.query(`
        SELECT COUNT(*) as active_sessions
        FROM user_sessions
        WHERE expires_at > NOW()
      `);

      return {
        usersByType: stats.rows,
        activeSessions: parseInt(activeSessions.rows[0].active_sessions)
      };

    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Error obteniendo estadísticas');
    }
  }
}

module.exports = new AuthService();