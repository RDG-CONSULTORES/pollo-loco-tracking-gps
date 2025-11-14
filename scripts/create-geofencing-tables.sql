-- =============================================================================
-- GEOFENCING SYSTEM - Database Schema
-- Pollo Loco GPS Tracking System
-- =============================================================================

-- Tabla para definir geofences de sucursales
CREATE TABLE IF NOT EXISTS sucursal_geofences (
    id BIGSERIAL PRIMARY KEY,
    location_code VARCHAR(50) NOT NULL, -- FK a tracking_locations_cache
    store_name VARCHAR(200),
    group_name VARCHAR(100),
    
    -- Coordenadas del centro del geofence
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    
    -- Radio en metros (default 150m)
    radius_meters INTEGER DEFAULT 150,
    
    -- Control
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Índices para optimización
    CONSTRAINT fk_geofence_location 
        FOREIGN KEY (location_code) 
        REFERENCES tracking_locations_cache(location_code)
        ON DELETE CASCADE
);

-- Tabla para registrar eventos de geofencing
CREATE TABLE IF NOT EXISTS geofence_events (
    id BIGSERIAL PRIMARY KEY,
    
    -- Referencias
    user_id INTEGER NOT NULL,
    location_code VARCHAR(50) NOT NULL,
    raw_location_id BIGINT, -- FK a gps_locations
    
    -- Tipo de evento
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('enter', 'exit')),
    
    -- Ubicación del evento
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    distance_from_center DECIMAL(8, 2), -- Distancia al centro en metros
    
    -- Timestamp del evento
    event_timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Estado de notificaciones
    telegram_sent BOOLEAN DEFAULT false,
    telegram_sent_at TIMESTAMP,
    telegram_error TEXT,
    
    -- Metadatos
    accuracy_meters INTEGER,
    battery_percentage INTEGER,
    
    -- Constraints
    CONSTRAINT fk_geofence_event_user 
        FOREIGN KEY (user_id) 
        REFERENCES tracking_users(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_geofence_event_location 
        FOREIGN KEY (location_code) 
        REFERENCES sucursal_geofences(location_code)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_geofence_event_raw_location 
        FOREIGN KEY (raw_location_id) 
        REFERENCES gps_locations(id)
        ON DELETE SET NULL
);

-- Tabla para tracking de estado de usuarios en sucursales
CREATE TABLE IF NOT EXISTS user_sucursal_state (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    location_code VARCHAR(50) NOT NULL,
    
    -- Estado actual
    is_inside BOOLEAN DEFAULT false,
    last_enter_event_id BIGINT,
    last_exit_event_id BIGINT,
    
    -- Timestamps
    last_enter_time TIMESTAMP,
    last_exit_time TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint para evitar duplicados
    CONSTRAINT unique_user_location 
        UNIQUE (user_id, location_code),
    
    -- Foreign keys
    CONSTRAINT fk_user_state_user 
        FOREIGN KEY (user_id) 
        REFERENCES tracking_users(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_user_state_location 
        FOREIGN KEY (location_code) 
        REFERENCES sucursal_geofences(location_code)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_user_state_enter_event 
        FOREIGN KEY (last_enter_event_id) 
        REFERENCES geofence_events(id)
        ON DELETE SET NULL,
        
    CONSTRAINT fk_user_state_exit_event 
        FOREIGN KEY (last_exit_event_id) 
        REFERENCES geofence_events(id)
        ON DELETE SET NULL
);

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- =============================================================================

-- Índices para sucursal_geofences
CREATE INDEX IF NOT EXISTS idx_geofences_location_code 
    ON sucursal_geofences(location_code);
    
CREATE INDEX IF NOT EXISTS idx_geofences_coordinates 
    ON sucursal_geofences(latitude, longitude);
    
CREATE INDEX IF NOT EXISTS idx_geofences_active 
    ON sucursal_geofences(active) WHERE active = true;

-- Índices para geofence_events
CREATE INDEX IF NOT EXISTS idx_geofence_events_user_timestamp 
    ON geofence_events(user_id, event_timestamp DESC);
    
CREATE INDEX IF NOT EXISTS idx_geofence_events_location_timestamp 
    ON geofence_events(location_code, event_timestamp DESC);
    
CREATE INDEX IF NOT EXISTS idx_geofence_events_type_timestamp 
    ON geofence_events(event_type, event_timestamp DESC);
    
CREATE INDEX IF NOT EXISTS idx_geofence_events_telegram_pending 
    ON geofence_events(telegram_sent) WHERE telegram_sent = false;

-- Índices para user_sucursal_state
CREATE INDEX IF NOT EXISTS idx_user_state_user 
    ON user_sucursal_state(user_id);
    
CREATE INDEX IF NOT EXISTS idx_user_state_location 
    ON user_sucursal_state(location_code);
    
CREATE INDEX IF NOT EXISTS idx_user_state_inside 
    ON user_sucursal_state(is_inside) WHERE is_inside = true;

-- =============================================================================
-- FUNCIONES AUXILIARES
-- =============================================================================

-- Función para calcular distancia entre dos puntos (Haversine)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
    lat1 DECIMAL(10,8), 
    lon1 DECIMAL(11,8), 
    lat2 DECIMAL(10,8), 
    lon2 DECIMAL(11,8)
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    R CONSTANT DECIMAL := 6371000; -- Radio de la Tierra en metros
    lat1_rad DECIMAL;
    lat2_rad DECIMAL;
    delta_lat DECIMAL;
    delta_lon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    -- Convertir a radianes
    lat1_rad := radians(lat1);
    lat2_rad := radians(lat2);
    delta_lat := radians(lat2 - lat1);
    delta_lon := radians(lon2 - lon1);
    
    -- Fórmula Haversine
    a := sin(delta_lat/2) * sin(delta_lat/2) + 
         cos(lat1_rad) * cos(lat2_rad) * 
         sin(delta_lon/2) * sin(delta_lon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    
    RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para encontrar sucursales cercanas a una ubicación
CREATE OR REPLACE FUNCTION get_nearby_geofences(
    user_lat DECIMAL(10,8), 
    user_lon DECIMAL(11,8), 
    max_distance_meters INTEGER DEFAULT 200
) RETURNS TABLE (
    geofence_id BIGINT,
    location_code VARCHAR(50),
    store_name VARCHAR(200),
    distance_meters DECIMAL(10,2),
    is_inside BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sg.id,
        sg.location_code,
        sg.store_name,
        calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) as distance,
        (calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) <= sg.radius_meters) as inside
    FROM sucursal_geofences sg
    WHERE sg.active = true
      AND calculate_distance_meters(user_lat, user_lon, sg.latitude, sg.longitude) <= max_distance_meters
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS PARA AUDITORÍA
-- =============================================================================

-- Trigger para actualizar updated_at en sucursal_geofences
CREATE OR REPLACE FUNCTION update_geofence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geofence_timestamp
    BEFORE UPDATE ON sucursal_geofences
    FOR EACH ROW
    EXECUTE FUNCTION update_geofence_timestamp();

-- Trigger para actualizar updated_at en user_sucursal_state
CREATE OR REPLACE FUNCTION update_user_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_state_timestamp
    BEFORE UPDATE ON user_sucursal_state
    FOR EACH ROW
    EXECUTE FUNCTION update_user_state_timestamp();

-- =============================================================================
-- ESTADÍSTICAS Y VISTAS ÚTILES
-- =============================================================================

-- Vista para estadísticas de geofencing por día
CREATE OR REPLACE VIEW geofence_daily_stats AS
SELECT 
    DATE(event_timestamp) as event_date,
    location_code,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users
FROM geofence_events
WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(event_timestamp), location_code, event_type
ORDER BY event_date DESC, event_count DESC;

-- Vista para usuarios actualmente dentro de sucursales
CREATE OR REPLACE VIEW users_currently_inside AS
SELECT 
    us.user_id,
    tu.tracker_id,
    tu.display_name,
    us.location_code,
    sg.store_name,
    sg.group_name,
    us.last_enter_time,
    EXTRACT(EPOCH FROM (NOW() - us.last_enter_time))/60 as minutes_inside
FROM user_sucursal_state us
INNER JOIN tracking_users tu ON us.user_id = tu.id
INNER JOIN sucursal_geofences sg ON us.location_code = sg.location_code
WHERE us.is_inside = true
  AND tu.active = true
ORDER BY us.last_enter_time DESC;

COMMENT ON TABLE sucursal_geofences IS 'Definición de geofences circulares para cada sucursal';
COMMENT ON TABLE geofence_events IS 'Registro histórico de eventos de entrada/salida de geofences';
COMMENT ON TABLE user_sucursal_state IS 'Estado actual de cada usuario respecto a cada sucursal';
COMMENT ON FUNCTION calculate_distance_meters IS 'Calcula distancia entre dos coordenadas usando fórmula Haversine';
COMMENT ON FUNCTION get_nearby_geofences IS 'Encuentra geofences cercanos a una ubicación dada';

-- =============================================================================
-- CONFIGURACIÓN INICIAL
-- =============================================================================

-- Insertar configuración para geofencing
INSERT INTO tracking_config (key, value, data_type, description) VALUES 
('geofencing_enabled', 'true', 'boolean', 'Activar/desactivar sistema de geofencing'),
('geofence_default_radius', '150', 'integer', 'Radio por defecto para geofences en metros'),
('geofence_max_search_radius', '200', 'integer', 'Radio máximo para buscar geofences cercanos'),
('geofence_telegram_alerts', 'true', 'boolean', 'Enviar alertas de geofencing por Telegram'),
('geofence_alert_channels', '[]', 'json', 'Configuración de canales para alertas de geofencing')
ON CONFLICT (key) DO NOTHING;

-- Mostrar resumen de creación
SELECT 
    'Tablas creadas' as status,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_name IN ('sucursal_geofences', 'geofence_events', 'user_sucursal_state')
  AND table_schema = current_schema();