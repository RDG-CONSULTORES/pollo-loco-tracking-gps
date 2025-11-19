-- =====================================================
-- SISTEMA DE PERMISOS JERÁRQUICO
-- Admin → Director → Operador
-- =====================================================

-- 1. Tabla de directores
CREATE TABLE directors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    telegram_chat_id VARCHAR(100),
    region VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_by INTEGER DEFAULT 1, -- ID del admin que lo creó
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Grupos operativos formales
CREATE TABLE operational_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    director_id INTEGER REFERENCES directors(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Permisos granulares del sistema
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'users', 'alerts', 'reports', 'system', 'gps'
    action VARCHAR(50) NOT NULL,   -- 'view', 'create', 'edit', 'delete', 'manage'
    resource VARCHAR(100),         -- 'own_region', 'all_regions', 'own_users', 'all_users'
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Roles del sistema
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    level INTEGER NOT NULL, -- 1=Admin, 2=Director, 3=Operador
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Permisos asignados a roles
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- 6. Asignación directores a grupos
CREATE TABLE director_groups (
    director_id INTEGER REFERENCES directors(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES operational_groups(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT NOW(),
    assigned_by INTEGER DEFAULT 1,
    PRIMARY KEY (director_id, group_id)
);

-- 7. Actualizar tabla usuarios existente
ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS operational_group_id INTEGER REFERENCES operational_groups(id),
ADD COLUMN IF NOT EXISTS director_id INTEGER REFERENCES directors(id),
ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id),
ADD COLUMN IF NOT EXISTS created_by INTEGER DEFAULT 1;

-- =====================================================
-- DATOS INICIALES DEL SISTEMA
-- =====================================================

-- Insertar roles básicos
INSERT INTO roles (name, description, level) VALUES
('admin', 'Administrador del sistema completo', 1),
('director', 'Director de región con gestión de su equipo', 2),
('supervisor', 'Supervisor de campo con acceso limitado', 3),
('auditor', 'Auditor con acceso de solo lectura', 3),
('operador', 'Operador básico con GPS únicamente', 4);

-- Insertar permisos básicos
INSERT INTO permissions (name, description, category, action, resource) VALUES
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
('backup_system', 'Realizar backups', 'system', 'backup', 'all_regions');

-- Asignar permisos a roles

-- ADMIN: Todos los permisos
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 1, id, true FROM permissions;

-- DIRECTOR: Permisos de su región
INSERT INTO role_permissions (role_id, permission_id, granted) VALUES
-- Usuarios de su región
(2, (SELECT id FROM permissions WHERE name = 'view_own_users'), true),
(2, (SELECT id FROM permissions WHERE name = 'create_users'), true),
(2, (SELECT id FROM permissions WHERE name = 'edit_users'), true),
-- Alertas y reportes de su región
(2, (SELECT id FROM permissions WHERE name = 'view_own_alerts'), true),
(2, (SELECT id FROM permissions WHERE name = 'configure_alerts'), true),
(2, (SELECT id FROM permissions WHERE name = 'view_own_reports'), true),
(2, (SELECT id FROM permissions WHERE name = 'export_reports'), true),
(2, (SELECT id FROM permissions WHERE name = 'create_reports'), true),
-- GPS de su equipo
(2, (SELECT id FROM permissions WHERE name = 'view_own_gps'), true),
(2, (SELECT id FROM permissions WHERE name = 'configure_gps'), true);

-- SUPERVISOR: Permisos básicos de visualización
INSERT INTO role_permissions (role_id, permission_id, granted) VALUES
(3, (SELECT id FROM permissions WHERE name = 'view_own_users'), true),
(3, (SELECT id FROM permissions WHERE name = 'view_own_alerts'), true),
(3, (SELECT id FROM permissions WHERE name = 'view_own_reports'), true),
(3, (SELECT id FROM permissions WHERE name = 'view_own_gps'), true);

-- AUDITOR: Solo lectura
INSERT INTO role_permissions (role_id, permission_id, granted) VALUES
(4, (SELECT id FROM permissions WHERE name = 'view_own_users'), true),
(4, (SELECT id FROM permissions WHERE name = 'view_own_alerts'), true),
(4, (SELECT id FROM permissions WHERE name = 'view_own_reports'), true),
(4, (SELECT id FROM permissions WHERE name = 'view_own_gps'), true);

-- OPERADOR: Solo su propio GPS
INSERT INTO role_permissions (role_id, permission_id, granted) VALUES
(5, (SELECT id FROM permissions WHERE name = 'view_own_gps'), true);

-- =====================================================
-- GRUPOS OPERATIVOS POR DEFECTO
-- =====================================================

INSERT INTO operational_groups (name, description, region, active) VALUES
('Zona Norte', 'Sucursales zona norte de la ciudad', 'Norte', true),
('Zona Sur', 'Sucursales zona sur de la ciudad', 'Sur', true),
('Zona Centro', 'Sucursales del centro de la ciudad', 'Centro', true),
('Zona Oriente', 'Sucursales zona oriente', 'Oriente', true),
('Zona Poniente', 'Sucursales zona poniente', 'Poniente', true),
('Auditoría Central', 'Equipo de auditoría corporativa', 'Nacional', true);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_directors_region ON directors(region);
CREATE INDEX idx_directors_active ON directors(active);
CREATE INDEX idx_operational_groups_director ON operational_groups(director_id);
CREATE INDEX idx_operational_groups_region ON operational_groups(region);
CREATE INDEX idx_tracking_users_director ON tracking_users(director_id);
CREATE INDEX idx_tracking_users_group ON tracking_users(operational_group_id);
CREATE INDEX idx_tracking_users_role ON tracking_users(role_id);

-- =====================================================
-- TRIGGERS PARA AUDITORÍA
-- =====================================================

-- Trigger para actualizar updated_at en directors
CREATE OR REPLACE FUNCTION update_directors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_directors_updated_at
    BEFORE UPDATE ON directors
    FOR EACH ROW
    EXECUTE FUNCTION update_directors_updated_at();

-- Trigger para actualizar updated_at en operational_groups
CREATE OR REPLACE FUNCTION update_operational_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_operational_groups_updated_at
    BEFORE UPDATE ON operational_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_operational_groups_updated_at();

-- =====================================================
-- VISTAS ÚTILES PARA CONSULTAS
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
    r.name as role_name,
    r.level as role_level,
    tu.group_name as group_legacy,
    og.name as operational_group_name,
    og.region as operational_group_region,
    d.name as director_name,
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

-- Vista de directores con sus estadísticas
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
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE directors IS 'Directores del sistema con gestión por región';
COMMENT ON TABLE operational_groups IS 'Grupos operativos formales del sistema';
COMMENT ON TABLE permissions IS 'Permisos granulares del sistema';
COMMENT ON TABLE roles IS 'Roles del sistema con niveles de acceso';
COMMENT ON TABLE role_permissions IS 'Asignación de permisos a roles';
COMMENT ON TABLE director_groups IS 'Asignación de directores a grupos operativos';

COMMENT ON COLUMN roles.level IS '1=Admin, 2=Director, 3=Supervisor/Auditor, 4=Operador';
COMMENT ON COLUMN permissions.resource IS 'Scope del permiso: own_region, all_regions, own_users, all_users';