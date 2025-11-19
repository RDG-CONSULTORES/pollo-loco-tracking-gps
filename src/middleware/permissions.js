const db = require('../config/database');

/**
 * Middleware de Control de Permisos
 * Sistema jerárquico: Admin → Director → Operador
 */

/**
 * Verificar si el usuario tiene un rol específico
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
      }
      
      // Verificar rol en base de datos
      const result = await db.query(`
        SELECT 
          tu.id,
          tu.role as legacy_role,
          r.name as role_name,
          r.level as role_level,
          d.id as director_id,
          d.region as director_region
        FROM tracking_users tu
        LEFT JOIN roles r ON tu.role_id = r.id
        LEFT JOIN directors d ON tu.director_id = d.id
        WHERE tu.id = $1 AND tu.active = true
      `, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Usuario no encontrado o inactivo',
          code: 'USER_INACTIVE'
        });
      }
      
      const user = result.rows[0];
      const currentRole = user.role_name || user.legacy_role;
      
      // Verificar si el rol está permitido
      if (!allowedRoles.includes(currentRole)) {
        return res.status(403).json({
          error: 'Permisos insuficientes',
          required: allowedRoles,
          current: currentRole,
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Agregar información del usuario al request
      req.user = {
        ...req.user,
        ...user
      };
      
      next();
      
    } catch (error) {
      console.error('Error en middleware requireRole:', error);
      res.status(500).json({
        error: 'Error verificando permisos',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
}

/**
 * Verificar permiso específico
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
      }
      
      const hasPermission = await checkUserPermission(userId, permissionName);
      
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Permiso denegado',
          permission: permissionName,
          code: 'PERMISSION_DENIED'
        });
      }
      
      next();
      
    } catch (error) {
      console.error('Error en middleware requirePermission:', error);
      res.status(500).json({
        error: 'Error verificando permiso específico',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
}

/**
 * Middleware para verificar acceso a región específica
 */
function requireRegionAccess() {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const targetRegion = req.params.region || req.query.region;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
      }
      
      // Obtener información del usuario
      const result = await db.query(`
        SELECT 
          tu.id,
          r.name as role_name,
          r.level as role_level,
          d.region as director_region
        FROM tracking_users tu
        LEFT JOIN roles r ON tu.role_id = r.id
        LEFT JOIN directors d ON tu.director_id = d.id
        WHERE tu.id = $1 AND tu.active = true
      `, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      const user = result.rows[0];
      
      // Admin puede acceder a todo
      if (user.role_level === 1) {
        next();
        return;
      }
      
      // Director solo puede acceder a su región
      if (user.role_level === 2) {
        if (!targetRegion) {
          // Sin región específica, permitir (verá solo su región)
          next();
          return;
        }
        
        if (user.director_region !== targetRegion) {
          return res.status(403).json({
            error: 'Acceso denegado a región',
            userRegion: user.director_region,
            requestedRegion: targetRegion,
            code: 'REGION_ACCESS_DENIED'
          });
        }
      }
      
      // Operadores y otros solo su propio acceso (manejado en otras funciones)
      next();
      
    } catch (error) {
      console.error('Error en middleware requireRegionAccess:', error);
      res.status(500).json({
        error: 'Error verificando acceso a región',
        code: 'REGION_CHECK_FAILED'
      });
    }
  };
}

/**
 * Verificar si el usuario tiene un permiso específico
 */
async function checkUserPermission(userId, permissionName) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM tracking_users tu
      JOIN roles r ON tu.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE tu.id = $1 
      AND p.name = $2 
      AND rp.granted = true
      AND tu.active = true
    `, [userId, permissionName]);
    
    return parseInt(result.rows[0].count) > 0;
    
  } catch (error) {
    console.error('Error checking user permission:', error);
    return false;
  }
}

/**
 * Obtener permisos de un usuario
 */
async function getUserPermissions(userId) {
  try {
    const result = await db.query(`
      SELECT 
        p.name,
        p.description,
        p.category,
        p.action,
        p.resource,
        rp.granted
      FROM tracking_users tu
      JOIN roles r ON tu.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE tu.id = $1 
      AND tu.active = true
      ORDER BY p.category, p.action
    `, [userId]);
    
    return result.rows;
    
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Filtrar datos basado en permisos del usuario
 */
async function filterDataByUserAccess(userId, query, baseWhere = '') {
  try {
    // Obtener información del usuario
    const userResult = await db.query(`
      SELECT 
        tu.id,
        r.name as role_name,
        r.level as role_level,
        d.id as director_id,
        d.region as director_region
      FROM tracking_users tu
      LEFT JOIN roles r ON tu.role_id = r.id
      LEFT JOIN directors d ON tu.director_id = d.id
      WHERE tu.id = $1 AND tu.active = true
    `, [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const user = userResult.rows[0];
    let whereClause = baseWhere;
    
    // Admin ve todo
    if (user.role_level === 1) {
      // Sin filtros adicionales
    }
    // Director ve solo su región
    else if (user.role_level === 2 && user.director_id) {
      const regionFilter = `director_id = ${user.director_id}`;
      whereClause = whereClause ? `${whereClause} AND ${regionFilter}` : `WHERE ${regionFilter}`;
    }
    // Operador ve solo sus propios datos
    else {
      const userFilter = `id = ${userId}`;
      whereClause = whereClause ? `${whereClause} AND ${userFilter}` : `WHERE ${userFilter}`;
    }
    
    const finalQuery = `${query} ${whereClause}`;
    return finalQuery;
    
  } catch (error) {
    console.error('Error filtering data by user access:', error);
    throw error;
  }
}

/**
 * Middleware para autenticación básica temporal
 * TODO: Reemplazar con JWT/session real
 */
function basicAuth(req, res, next) {
  // Por ahora, simular usuario admin
  const adminUserId = process.env.TELEGRAM_ADMIN_IDS?.split(',')[0] || '6932484342';
  
  req.user = {
    id: 1, // ID temporal del admin
    telegramId: adminUserId,
    role: 'admin'
  };
  
  next();
}

/**
 * Verificar si el usuario es admin
 */
function requireAdmin() {
  return requireRole(['admin']);
}

/**
 * Verificar si el usuario es director o admin
 */
function requireDirectorOrAdmin() {
  return requireRole(['admin', 'director']);
}

module.exports = {
  requireRole,
  requirePermission,
  requireRegionAccess,
  requireAdmin,
  requireDirectorOrAdmin,
  checkUserPermission,
  getUserPermissions,
  filterDataByUserAccess,
  basicAuth
};