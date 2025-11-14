-- ============================================
-- USER MANAGEMENT SYSTEM - SCHEMA ADICIONAL
-- NO MODIFICA TABLAS EXISTENTES
-- ============================================

-- USUARIOS DEL SISTEMA (login/monitoreo)
CREATE TABLE IF NOT EXISTS system_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  user_type VARCHAR(20) CHECK (user_type IN ('admin', 'director', 'manager', 'supervisor')) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DIRECTORES (pueden tener múltiples grupos)
CREATE TABLE IF NOT EXISTS directors (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  director_code VARCHAR(10) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  telegram_chat_id VARCHAR(50),
  telegram_username VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ASIGNACIÓN DE GRUPOS A DIRECTORES (many-to-many)
CREATE TABLE IF NOT EXISTS director_groups (
  id SERIAL PRIMARY KEY,
  director_id INT REFERENCES directors(id) ON DELETE CASCADE,
  group_name VARCHAR(100) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(director_id, group_name)
);

-- SUPERVISORES MEJORADO (mantiene compatibilidad)
CREATE TABLE IF NOT EXISTS supervisors (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  tracker_id VARCHAR(10) UNIQUE NOT NULL, -- TID OwnTracks (compatibilidad)
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  primary_group VARCHAR(100) NOT NULL,
  active_tracking BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ASIGNACIÓN DE SUPERVISORES A DIRECTORES (many-to-many)
CREATE TABLE IF NOT EXISTS supervisor_assignments (
  id SERIAL PRIMARY KEY,
  supervisor_id INT REFERENCES supervisors(id) ON DELETE CASCADE,
  director_id INT REFERENCES directors(id) ON DELETE CASCADE,
  assignment_type VARCHAR(20) CHECK (assignment_type IN ('primary', 'secondary', 'alerts_only')) DEFAULT 'primary',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(supervisor_id, director_id)
);

-- GERENTES/OPERATIVOS (futuro)
CREATE TABLE IF NOT EXISTS managers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  manager_code VARCHAR(10) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  telegram_chat_id VARCHAR(50),
  telegram_username VARCHAR(50),
  email VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ASIGNACIÓN DE SUPERVISORES A MANAGERS
CREATE TABLE IF NOT EXISTS manager_supervisor_assignments (
  id SERIAL PRIMARY KEY,
  manager_id INT REFERENCES managers(id) ON DELETE CASCADE,
  supervisor_id INT REFERENCES supervisors(id) ON DELETE CASCADE,
  assignment_type VARCHAR(20) CHECK (assignment_type IN ('alerts_only', 'monitoring')) DEFAULT 'alerts_only',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(manager_id, supervisor_id)
);

-- CONFIGURACIÓN DE ALERTAS
CREATE TABLE IF NOT EXISTS alert_configurations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'geofence_entry', 'geofence_exit', etc.
  group_name VARCHAR(100),         -- null = todos los grupos del usuario
  enabled BOOLEAN DEFAULT true,
  telegram_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',     -- configuraciones específicas
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CONFIGURACIÓN DE REPORTES
CREATE TABLE IF NOT EXISTS report_configurations (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL,
  report_type VARCHAR(20) CHECK (report_type IN ('daily', 'weekly', 'monthly')) NOT NULL,
  
  -- Canales de entrega
  telegram_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  
  -- Configuración de horarios
  delivery_time TIME DEFAULT '18:00:00',
  delivery_day INT DEFAULT 1,           -- Para semanales (1=lunes)
  delivery_date INT DEFAULT 1,          -- Para mensuales (día del mes)
  
  -- Configuraciones específicas
  include_routes BOOLEAN DEFAULT true,
  include_visits BOOLEAN DEFAULT true,
  include_alerts BOOLEAN DEFAULT false,
  include_efficiency BOOLEAN DEFAULT true,
  
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, report_type)
);

-- SESIONES DE USUARIO
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

-- AUDITORIA DE ACCIONES
CREATE TABLE IF NOT EXISTS user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES system_users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(50),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_type_active ON system_users(user_type, active);
CREATE INDEX IF NOT EXISTS idx_directors_code ON directors(director_code);
CREATE INDEX IF NOT EXISTS idx_directors_telegram ON directors(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_tracker ON supervisors(tracker_id);
CREATE INDEX IF NOT EXISTS idx_supervisors_group ON supervisors(primary_group);
CREATE INDEX IF NOT EXISTS idx_director_groups_name ON director_groups(group_name);
CREATE INDEX IF NOT EXISTS idx_alert_configs_user ON alert_configurations(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_report_configs_user ON report_configurations(user_id, active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON user_audit_log(user_id, created_at);

-- FUNCIÓN PARA UPDATE TIMESTAMPS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TRIGGERS PARA UPDATED_AT
CREATE TRIGGER update_system_users_updated_at 
  BEFORE UPDATE ON system_users 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_directors_updated_at 
  BEFORE UPDATE ON directors 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_supervisors_updated_at 
  BEFORE UPDATE ON supervisors 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_managers_updated_at 
  BEFORE UPDATE ON managers 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_alert_configurations_updated_at 
  BEFORE UPDATE ON alert_configurations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_report_configurations_updated_at 
  BEFORE UPDATE ON report_configurations 
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- VISTAS PARA FACILITAR CONSULTAS
-- ============================================

-- Vista de directores con sus grupos
CREATE OR REPLACE VIEW directors_with_groups AS
SELECT 
  d.id,
  d.director_code,
  d.full_name,
  d.telegram_chat_id,
  d.active,
  array_agg(dg.group_name ORDER BY dg.is_primary DESC, dg.group_name) as groups,
  COUNT(dg.group_name) as total_groups
FROM directors d
LEFT JOIN director_groups dg ON d.id = dg.director_id
WHERE d.active = true
GROUP BY d.id, d.director_code, d.full_name, d.telegram_chat_id, d.active;

-- Vista de supervisores con asignaciones
CREATE OR REPLACE VIEW supervisors_with_assignments AS
SELECT 
  s.id,
  s.tracker_id,
  s.full_name,
  s.primary_group,
  s.active_tracking,
  array_agg(
    json_build_object(
      'director_id', d.id,
      'director_name', d.full_name,
      'assignment_type', sa.assignment_type
    )
  ) as assignments
FROM supervisors s
LEFT JOIN supervisor_assignments sa ON s.id = sa.supervisor_id
LEFT JOIN directors d ON sa.director_id = d.id
WHERE s.active_tracking = true
GROUP BY s.id, s.tracker_id, s.full_name, s.primary_group, s.active_tracking;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario administrador inicial
INSERT INTO system_users (email, password_hash, full_name, user_type) 
VALUES ('admin@polloloco.com', '$2b$10$placeholder_hash', 'Administrador', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE system_users IS 'Usuarios del sistema con autenticación y roles';
COMMENT ON TABLE directors IS 'Directores que supervisan grupos operativos';
COMMENT ON TABLE director_groups IS 'Asignación many-to-many de directores a grupos';
COMMENT ON TABLE supervisors IS 'Personal de campo con tracking GPS activo';
COMMENT ON TABLE supervisor_assignments IS 'Asignación many-to-many de supervisores a directores';
COMMENT ON TABLE alert_configurations IS 'Configuración de alertas por usuario';
COMMENT ON TABLE report_configurations IS 'Configuración de reportes automáticos';
COMMENT ON TABLE user_sessions IS 'Sesiones activas de usuarios';
COMMENT ON TABLE user_audit_log IS 'Log de auditoria de acciones de usuarios';

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que todas las tablas fueron creadas
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN (
  'system_users', 'directors', 'director_groups', 'supervisors', 
  'supervisor_assignments', 'managers', 'manager_supervisor_assignments',
  'alert_configurations', 'report_configurations', 'user_sessions', 'user_audit_log'
)
ORDER BY tablename;