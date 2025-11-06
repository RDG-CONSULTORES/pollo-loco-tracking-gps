-- ============================================
-- SCHEMA COMPLETO - POLLO LOCO TRACKING GPS
-- ============================================

-- Habilitar extensión PostGIS (para cálculos geográficos)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. USUARIOS DE TRACKING
CREATE TABLE IF NOT EXISTS tracking_users (
  id SERIAL PRIMARY KEY,
  tracker_id VARCHAR(10) UNIQUE NOT NULL,  -- TID en OwnTracks (ej: JP, MG)
  zenput_email VARCHAR(100) NOT NULL,      -- Email del usuario en Zenput
  zenput_user_id VARCHAR(50),              -- ID del usuario en Zenput
  display_name VARCHAR(100),
  phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para tracking_users
CREATE INDEX IF NOT EXISTS idx_tracking_users_tid ON tracking_users(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracking_users_email ON tracking_users(zenput_email);
CREATE INDEX IF NOT EXISTS idx_tracking_users_active ON tracking_users(active);

-- 2. CACHE DE SUCURSALES (desde Zenput)
CREATE TABLE IF NOT EXISTS tracking_locations_cache (
  location_code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  group_name VARCHAR(100),
  director_name VARCHAR(100),
  active BOOLEAN DEFAULT true,
  geofence_radius INT DEFAULT 150,  -- Radio en metros
  synced_at TIMESTAMP DEFAULT NOW(),
  
  -- Punto geográfico para búsquedas espaciales
  location_point GEOMETRY(Point, 4326)
);

-- Índice espacial para tracking_locations_cache
CREATE INDEX IF NOT EXISTS idx_locations_cache_point ON tracking_locations_cache 
USING GIST(location_point);

CREATE INDEX IF NOT EXISTS idx_locations_cache_active ON tracking_locations_cache(active);

-- Trigger para actualizar location_point automáticamente
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS $
BEGIN
  NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_location_point ON tracking_locations_cache;
CREATE TRIGGER trg_update_location_point
BEFORE INSERT OR UPDATE ON tracking_locations_cache
FOR EACH ROW
EXECUTE FUNCTION update_location_point();

-- 3. UBICACIONES GPS (raw data)
CREATE TABLE IF NOT EXISTS tracking_locations (
  id BIGSERIAL PRIMARY KEY,
  tracker_id VARCHAR(10) NOT NULL,
  zenput_email VARCHAR(100),
  
  -- Datos GPS
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INT,           -- Precisión en metros
  altitude INT,
  battery INT,            -- Porcentaje batería
  velocity DECIMAL(5, 2), -- Velocidad km/h
  heading INT,            -- Dirección 0-360°
  
  -- Timestamps
  gps_timestamp TIMESTAMP NOT NULL,
  received_at TIMESTAMP DEFAULT NOW(),
  
  -- Metadata
  raw_payload JSONB,
  
  FOREIGN KEY (tracker_id) REFERENCES tracking_users(tracker_id) ON DELETE CASCADE
);

-- Índices para tracking_locations
CREATE INDEX IF NOT EXISTS idx_locations_tracker_time ON tracking_locations(tracker_id, gps_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON tracking_locations(gps_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_locations_date ON tracking_locations(DATE(gps_timestamp));
CREATE INDEX IF NOT EXISTS idx_locations_email ON tracking_locations(zenput_email);

-- 4. VISITAS DETECTADAS
CREATE TABLE IF NOT EXISTS tracking_visits (
  id BIGSERIAL PRIMARY KEY,
  tracker_id VARCHAR(10) NOT NULL,
  zenput_email VARCHAR(100),
  location_code VARCHAR(20) NOT NULL,
  
  -- Timestamps
  entrada_at TIMESTAMP NOT NULL,
  salida_at TIMESTAMP,
  duracion_minutos INT,
  
  -- Ubicaciones
  entrada_lat DECIMAL(10, 8),
  entrada_lon DECIMAL(11, 8),
  salida_lat DECIMAL(10, 8),
  salida_lon DECIMAL(11, 8),
  
  -- Metadata
  is_valid BOOLEAN DEFAULT true,
  visit_type VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tracker_id) REFERENCES tracking_users(tracker_id) ON DELETE CASCADE,
  FOREIGN KEY (location_code) REFERENCES tracking_locations_cache(location_code) ON DELETE CASCADE
);

-- Índices para tracking_visits
CREATE INDEX IF NOT EXISTS idx_visits_tracker_date ON tracking_visits(tracker_id, DATE(entrada_at) DESC);
CREATE INDEX IF NOT EXISTS idx_visits_location_date ON tracking_visits(location_code, DATE(entrada_at) DESC);
CREATE INDEX IF NOT EXISTS idx_visits_date ON tracking_visits(DATE(entrada_at) DESC);
CREATE INDEX IF NOT EXISTS idx_visits_open ON tracking_visits(tracker_id) WHERE salida_at IS NULL;

-- 5. CONFIGURACIÓN DINÁMICA
CREATE TABLE IF NOT EXISTS tracking_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type VARCHAR(20),  -- 'string', 'number', 'boolean', 'time'
  description TEXT,
  updated_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuración inicial
INSERT INTO tracking_config (key, value, data_type, description) VALUES
('system_active', 'true', 'boolean', 'Sistema de tracking activo/pausado'),
('work_hours_start', '07:00', 'time', 'Hora de inicio de tracking'),
('work_hours_end', '21:00', 'time', 'Hora de fin de tracking'),
('work_days', '1,2,3,4,5,6', 'string', 'Días activos (1=Lun, 7=Dom)'),
('geofence_radius_meters', '150', 'number', 'Radio de geofence en metros'),
('gps_interval_minutes', '5', 'number', 'Intervalo de actualización GPS'),
('gps_accuracy_threshold', '100', 'number', 'Precisión mínima GPS en metros'),
('sync_zenput_hours', '24', 'number', 'Frecuencia sync con Zenput (horas)')
ON CONFLICT (key) DO NOTHING;

-- 6. LOG DE AUDITORÍA
CREATE TABLE IF NOT EXISTS tracking_admin_log (
  id SERIAL PRIMARY KEY,
  admin_user VARCHAR(100),
  action VARCHAR(50),  -- 'create_user', 'update_config', etc
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_timestamp ON tracking_admin_log(timestamp DESC);

-- 7. MÉTRICAS DIARIAS (pre-calculadas)
CREATE TABLE IF NOT EXISTS tracking_daily_metrics (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tracker_id VARCHAR(10),
  zenput_email VARCHAR(100),
  
  -- Métricas
  total_visits INT DEFAULT 0,
  unique_locations INT DEFAULT 0,
  total_visit_time_min INT DEFAULT 0,
  total_travel_time_min INT DEFAULT 0,
  total_distance_km DECIMAL(10, 2) DEFAULT 0,
  
  -- Calidad
  short_visits INT DEFAULT 0,   -- < 30 min
  normal_visits INT DEFAULT 0,  -- 30-90 min
  long_visits INT DEFAULT 0,    -- > 90 min
  
  -- Horarios
  first_visit_time TIME,
  last_visit_time TIME,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(fecha, tracker_id),
  FOREIGN KEY (tracker_id) REFERENCES tracking_users(tracker_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_fecha ON tracking_daily_metrics(fecha DESC);

-- 8. CACHE DE USUARIOS (desde Zenput API)
CREATE TABLE IF NOT EXISTS tracking_users_zenput_cache (
  zenput_user_id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50),
  active BOOLEAN DEFAULT true,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VISTAS ÚTILES
-- ============================================

-- Vista: Visitas con detalles completos
CREATE OR REPLACE VIEW v_tracking_visits_detail AS
SELECT 
  v.id,
  v.tracker_id,
  tu.display_name as supervisor_name,
  v.zenput_email,
  v.location_code,
  lc.name as location_name,
  lc.group_name,
  lc.director_name,
  v.entrada_at,
  v.salida_at,
  v.duracion_minutos,
  CASE 
    WHEN v.duracion_minutos IS NULL THEN 'En progreso'
    WHEN v.duracion_minutos < 30 THEN 'Muy corta'
    WHEN v.duracion_minutos < 45 THEN 'Corta'
    WHEN v.duracion_minutos <= 90 THEN 'Normal'
    ELSE 'Larga'
  END as duracion_evaluation,
  DATE(v.entrada_at) as fecha,
  v.is_valid
FROM tracking_visits v
LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code;

-- Vista: Ubicaciones actuales
CREATE OR REPLACE VIEW v_tracking_current_locations AS
SELECT DISTINCT ON (l.tracker_id)
  l.tracker_id,
  tu.display_name,
  l.zenput_email,
  l.latitude,
  l.longitude,
  l.battery,
  l.velocity,
  l.gps_timestamp,
  EXTRACT(EPOCH FROM (NOW() - l.gps_timestamp))/60 as minutes_ago
FROM tracking_locations l
LEFT JOIN tracking_users tu ON l.tracker_id = tu.tracker_id
WHERE l.gps_timestamp >= NOW() - INTERVAL '2 hours'
  AND tu.active = true
ORDER BY l.tracker_id, l.gps_timestamp DESC;

-- Vista: Cobertura diaria
CREATE OR REPLACE VIEW v_tracking_daily_coverage AS
SELECT 
  DATE(v.entrada_at) as fecha,
  COUNT(DISTINCT v.location_code) as sucursales_visitadas,
  COUNT(DISTINCT v.tracker_id) as supervisores_activos,
  COUNT(*) as total_visitas,
  SUM(v.duracion_minutos) as tiempo_total_min,
  ROUND(
    COUNT(DISTINCT v.location_code)::NUMERIC / 
    (SELECT COUNT(*) FROM tracking_locations_cache WHERE active = true) * 100, 
    2
  ) as porcentaje_cobertura
FROM tracking_visits v
WHERE v.is_valid = true
  AND v.salida_at IS NOT NULL
GROUP BY DATE(v.entrada_at)
ORDER BY fecha DESC;

-- ============================================
-- FUNCIONES ÚTILES
-- ============================================

-- Función para calcular distancia Haversine
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $
BEGIN
  RETURN (
    6371 * acos(
      cos(radians(lat1)) * cos(radians(lat2)) * 
      cos(radians(lon2) - radians(lon1)) + 
      sin(radians(lat1)) * sin(radians(lat2))
    )
  ) * 1000; -- Resultado en metros
END;
$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS ADICIONALES
-- ============================================

-- Actualizar timestamp de tracking_users
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tracking_users_updated_at ON tracking_users;
CREATE TRIGGER trg_tracking_users_updated_at
  BEFORE UPDATE ON tracking_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Calcular duración de visitas al cerrar
CREATE OR REPLACE FUNCTION calculate_visit_duration()
RETURNS TRIGGER AS $
BEGIN
  IF NEW.salida_at IS NOT NULL AND OLD.salida_at IS NULL THEN
    NEW.duracion_minutos = EXTRACT(EPOCH FROM (NEW.salida_at - NEW.entrada_at)) / 60;
    
    -- Determinar tipo de visita
    NEW.visit_type = CASE 
      WHEN NEW.duracion_minutos < 5 THEN 'invalid'
      WHEN NEW.duracion_minutos < 30 THEN 'short'
      WHEN NEW.duracion_minutos <= 90 THEN 'normal'
      ELSE 'long'
    END;
    
    -- Marcar como inválida si es muy corta
    IF NEW.duracion_minutos < 5 THEN
      NEW.is_valid = false;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_visit_duration ON tracking_visits;
CREATE TRIGGER trg_calculate_visit_duration
  BEFORE UPDATE ON tracking_visits
  FOR EACH ROW
  EXECUTE FUNCTION calculate_visit_duration();

-- ============================================
-- COMENTARIOS FINALES
-- ============================================
COMMENT ON TABLE tracking_users IS 'Usuarios autorizados para tracking GPS';
COMMENT ON TABLE tracking_locations_cache IS 'Cache de sucursales sincronizadas desde Zenput';
COMMENT ON TABLE tracking_locations IS 'Ubicaciones GPS raw recibidas de OwnTracks';
COMMENT ON TABLE tracking_visits IS 'Visitas detectadas automáticamente por geofencing';
COMMENT ON TABLE tracking_config IS 'Configuración dinámica del sistema';
COMMENT ON TABLE tracking_admin_log IS 'Log de auditoría de cambios administrativos';

-- Mensaje de éxito
SELECT 'Schema creado exitosamente ✅' as status;