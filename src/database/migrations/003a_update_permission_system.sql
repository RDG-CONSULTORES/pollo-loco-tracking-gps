-- =====================================================
-- SISTEMA DE PERMISOS - ACTUALIZACIÓN INCREMENTAL
-- Trabaja con estructura existente
-- =====================================================

-- 1. Crear operational_groups (nueva tabla)
CREATE TABLE IF NOT EXISTS operational_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    director_id INTEGER REFERENCES directors(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crear tabla de permisos (nueva)
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'users', 'alerts', 'reports', 'system', 'gps'
    action VARCHAR(50) NOT NULL,   -- 'view', 'create', 'edit', 'delete', 'manage'
    resource VARCHAR(100),         -- 'own_region', 'all_regions', 'own_users', 'all_users'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla de roles (nueva)
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    level INTEGER NOT NULL, -- 1=Admin, 2=Director, 3=Supervisor, 4=Operador
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear relación roles-permisos (nueva)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 5. Actualizar tabla tracking_users con nuevas columnas
ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS operational_group_id INTEGER REFERENCES operational_groups(id),
ADD COLUMN IF NOT EXISTS director_id INTEGER REFERENCES directors(id),
ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'operador',
ADD COLUMN IF NOT EXISTS group_name VARCHAR(255);

-- 6. Actualizar tabla directors con columnas faltantes
ALTER TABLE directors 
ADD COLUMN IF NOT EXISTS created_by INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Copiar datos si existe full_name pero no name
UPDATE directors SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar roles básicos (solo si no existen)
INSERT INTO roles (name, description, level) 
SELECT * FROM (VALUES
    ('admin', 'Administrador del sistema completo', 1),
    ('director', 'Director de región con gestión de su equipo', 2),
    ('supervisor', 'Supervisor de campo con acceso limitado', 3),
    ('auditor', 'Auditor con acceso de solo lectura', 3),
    ('operador', 'Operador básico con GPS únicamente', 4)
) AS v(name, description, level)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = v.name);

-- Insertar permisos básicos (solo si no existen)
INSERT INTO permissions (name, description, category, action, resource) 
SELECT * FROM (VALUES
    -- Gestión de usuarios
    ('view_all_users', 'Ver todos los usuarios del sistema', 'users', 'view', 'all_users'),
    ('view_own_users', 'Ver usuarios de su región/grupo', 'users', 'view', 'own_region'),
    ('create_users', 'Crear nuevos usuarios GPS', 'users', 'create', 'own_region'),
    ('edit_users', 'Editar usuarios existentes', 'users', 'edit', 'own_region'),
    ('delete_users', 'Eliminar usuarios', 'users', 'delete', 'own_region'),
    
    -- Gestión de directores
    ('view_directors', 'Ver listado de directores', 'directors', 'view', 'all_regions'),
    ('create_directors', 'Crear nuevos directores', 'directors', 'create', 'all_regions'),
    ('edit_directors', 'Editar directores existentes', 'directors', 'edit', 'all_regions'),
    ('delete_directors', 'Eliminar directores', 'directors', 'delete', 'all_regions'),
    
    -- Alertas y notificaciones
    ('view_all_alerts', 'Ver todas las alertas del sistema', 'alerts', 'view', 'all_regions'),
    ('view_own_alerts', 'Ver alertas de su región', 'alerts', 'view', 'own_region'),
    ('configure_alerts', 'Configurar alertas personalizadas', 'alerts', 'manage', 'own_region'),
    ('manage_system_alerts', 'Gestionar alertas del sistema', 'alerts', 'manage', 'all_regions'),
    
    -- Reportes y métricas
    ('view_all_reports', 'Ver reportes de todo el sistema', 'reports', 'view', 'all_regions'),
    ('view_own_reports', 'Ver reportes de su región', 'reports', 'view', 'own_region'),
    ('export_reports', 'Exportar reportes', 'reports', 'export', 'own_region'),
    ('create_reports', 'Crear reportes personalizados', 'reports', 'create', 'own_region'),
    
    -- GPS y tracking
    ('view_all_gps', 'Ver tracking de todos los usuarios', 'gps', 'view', 'all_users'),
    ('view_own_gps', 'Ver tracking de su equipo', 'gps', 'view', 'own_region'),
    ('configure_gps', 'Configurar parámetros GPS', 'gps', 'manage', 'own_region'),
    
    -- Sistema
    ('system_config', 'Configuración del sistema', 'system', 'manage', 'all_regions'),
    ('view_system_logs', 'Ver logs del sistema', 'system', 'view', 'all_regions'),
    ('backup_system', 'Realizar backups', 'system', 'backup', 'all_regions')
) AS v(name, description, category, action, resource)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = v.name);

-- Asignar permisos a roles (solo si no existen)

-- ADMIN: Todos los permisos
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 1, p.id, true 
FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = 1 AND rp.permission_id = p.id
);

-- DIRECTOR: Permisos de su región  
INSERT INTO role_permissions (role_id, permission_id, granted) 
SELECT 2, p.id, true
FROM permissions p
WHERE p.name IN (
    'view_own_users', 'create_users', 'edit_users',
    'view_own_alerts', 'configure_alerts',
    'view_own_reports', 'export_reports', 'create_reports',
    'view_own_gps', 'configure_gps'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = 2 AND rp.permission_id = p.id
);

-- SUPERVISOR: Permisos básicos de visualización
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 3, p.id, true
FROM permissions p
WHERE p.name IN (
    'view_own_users', 'view_own_alerts', 
    'view_own_reports', 'view_own_gps'
)
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = 3 AND rp.permission_id = p.id
);

-- OPERADOR: Solo su propio GPS
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 5, p.id, true
FROM permissions p
WHERE p.name = 'view_own_gps'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = 5 AND rp.permission_id = p.id
);

-- =====================================================
-- GRUPOS OPERATIVOS POR DEFECTO
-- =====================================================

INSERT INTO operational_groups (name, description, region, active) 
SELECT * FROM (VALUES
    ('Zona Norte', 'Sucursales zona norte de la ciudad', 'Norte', true),
    ('Zona Sur', 'Sucursales zona sur de la ciudad', 'Sur', true),
    ('Zona Centro', 'Sucursales del centro de la ciudad', 'Centro', true),
    ('Zona Oriente', 'Sucursales zona oriente', 'Oriente', true),
    ('Zona Poniente', 'Sucursales zona poniente', 'Poniente', true),
    ('Auditoría Central', 'Equipo de auditoría corporativa', 'Nacional', true)
) AS v(name, description, region, active)
WHERE NOT EXISTS (SELECT 1 FROM operational_groups WHERE name = v.name);

-- =====================================================
-- MIGRAR DATOS EXISTENTES
-- =====================================================

-- Migrar roles existentes en tracking_users
UPDATE tracking_users 
SET role_id = (
    CASE 
        WHEN rol ILIKE '%director%' OR rol ILIKE '%gerente%' THEN 2
        WHEN rol ILIKE '%supervisor%' OR rol ILIKE '%sup%' THEN 3
        WHEN rol ILIKE '%auditor%' THEN 4
        ELSE 5  -- operador por defecto
    END
)
WHERE role_id IS NULL;

-- Migrar group_name desde tracking_users.grupo
UPDATE tracking_users 
SET group_name = grupo
WHERE group_name IS NULL AND grupo IS NOT NULL;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE  
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_directors_region ON directors(region);
CREATE INDEX IF NOT EXISTS idx_directors_active ON directors(active);
CREATE INDEX IF NOT EXISTS idx_operational_groups_director ON operational_groups(director_id);
CREATE INDEX IF NOT EXISTS idx_operational_groups_region ON operational_groups(region);
CREATE INDEX IF NOT EXISTS idx_tracking_users_director ON tracking_users(director_id);
CREATE INDEX IF NOT EXISTS idx_tracking_users_group ON tracking_users(operational_group_id);
CREATE INDEX IF NOT EXISTS idx_tracking_users_role ON tracking_users(role_id);

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista completa de usuarios con sus relaciones
CREATE OR REPLACE VIEW v_users_complete AS
SELECT 
    tu.id,
    tu.tracker_id,
    tu.display_name,
    tu.zenput_email,
    tu.phone,
    tu.role as role_legacy,
    tu.rol as rol_legacy,
    r.name as role_name,
    r.level as role_level,
    tu.group_name as group_legacy,
    tu.grupo as grupo_legacy,
    og.name as operational_group_name,
    og.region as operational_group_region,
    d.name as director_name,
    d.full_name as director_full_name,
    d.email as director_email,
    d.region as director_region,
    tu.active,
    tu.last_location_time,
    tu.created_at,
    tu.updated_at
FROM tracking_users tu
LEFT JOIN roles r ON tu.role_id = r.id
LEFT JOIN operational_groups og ON tu.operational_group_id = og.id
LEFT JOIN directors d ON tu.director_id = d.id
ORDER BY tu.created_at DESC;

-- Vista de directores con estadísticas
CREATE OR REPLACE VIEW v_directors_stats AS
SELECT 
    d.*,
    COUNT(DISTINCT og.id) as groups_count,
    COUNT(DISTINCT tu.id) as users_count,
    COUNT(DISTINCT tu.id) FILTER (WHERE tu.active = true) as active_users_count
FROM directors d
LEFT JOIN operational_groups og ON d.id = og.director_id
LEFT JOIN tracking_users tu ON d.id = tu.director_id
WHERE d.active = true
GROUP BY d.id
ORDER BY d.created_at DESC;

-- =====================================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE operational_groups IS 'Grupos operativos formales del sistema';
COMMENT ON TABLE permissions IS 'Permisos granulares del sistema';
COMMENT ON TABLE roles IS 'Roles del sistema con niveles de acceso';
COMMENT ON TABLE role_permissions IS 'Asignación de permisos a roles';

COMMENT ON COLUMN roles.level IS '1=Admin, 2=Director, 3=Supervisor/Auditor, 4=Operador';
COMMENT ON COLUMN permissions.resource IS 'Scope del permiso: own_region, all_regions, own_users, all_users';