-- =============================================================================
-- ROUTE CALCULATION SYSTEM - Database Schema
-- Pollo Loco GPS Tracking System - Route Tables
-- =============================================================================

-- Tabla para rutas calculadas
CREATE TABLE IF NOT EXISTS calculated_routes (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES tracking_users(id),
    
    -- Datos de la ruta
    waypoints JSONB NOT NULL,           -- Puntos de la ruta ordenados
    metrics JSONB NOT NULL,             -- Métricas: distancia, tiempo, etc.
    directions JSONB,                   -- Instrucciones detalladas de navegación
    
    -- Configuración de cálculo
    algorithm VARCHAR(50) NOT NULL,      -- nearestNeighbor, genetic, etc.
    constraints JSONB DEFAULT '{}',     -- Restricciones aplicadas
    preferences JSONB DEFAULT '{}',     -- Preferencias del usuario
    
    -- Estado y metadata
    status VARCHAR(20) DEFAULT 'calculated', -- calculated, in_progress, completed, cancelled
    start_location JSONB,               -- Ubicación de inicio
    total_sucursales INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Índices
    INDEX idx_calculated_routes_user (user_id, created_at DESC),
    INDEX idx_calculated_routes_status (status),
    INDEX idx_calculated_routes_algorithm (algorithm, created_at DESC)
);

-- Tabla para optimizaciones de rutas
CREATE TABLE IF NOT EXISTS route_optimizations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES tracking_users(id),
    
    -- Rutas comparadas
    base_route JSONB NOT NULL,          -- Ruta original
    optimized_route JSONB NOT NULL,     -- Ruta optimizada
    
    -- Estrategia y análisis
    strategy VARCHAR(50) NOT NULL,       -- distance, time, fuel, balanced, priority
    recommendations JSONB DEFAULT '[]', -- Recomendaciones generadas
    metrics JSONB NOT NULL,             -- Métricas avanzadas
    improvements JSONB,                 -- Mejoras obtenidas
    
    -- APIs utilizadas
    external_apis_used JSONB DEFAULT '[]', -- OpenRoute, Google, etc.
    api_response_times JSONB DEFAULT '{}', -- Tiempos de respuesta
    
    -- Calidad y feedback
    quality_score INTEGER,              -- 0-100
    user_feedback INTEGER,              -- Rating del usuario 1-5
    user_notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_route_optimizations_user (user_id, created_at DESC),
    INDEX idx_route_optimizations_strategy (strategy),
    INDEX idx_route_optimizations_quality (quality_score DESC)
);

-- Tabla para ejecución de rutas en tiempo real
CREATE TABLE IF NOT EXISTS route_executions (
    id BIGSERIAL PRIMARY KEY,
    route_id BIGINT REFERENCES calculated_routes(id),
    user_id INTEGER REFERENCES tracking_users(id),
    
    -- Progreso de ejecución
    current_waypoint_index INTEGER DEFAULT 0,
    completed_waypoints INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, paused, completed, cancelled
    
    -- Métricas de ejecución real
    actual_start_time TIMESTAMP,
    actual_end_time TIMESTAMP,
    actual_distance_km DECIMAL(8,2),
    actual_duration_minutes INTEGER,
    
    -- Desviaciones vs. plan
    route_deviations JSONB DEFAULT '[]', -- Desviaciones del plan original
    unplanned_stops JSONB DEFAULT '[]',  -- Paradas no planificadas
    delays JSONB DEFAULT '[]',           -- Retrasos registrados
    
    -- Eficiencia
    efficiency_score INTEGER,           -- 0-100, comparado con el plan
    fuel_consumption_actual DECIMAL(6,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_route_executions_user (user_id, created_at DESC),
    INDEX idx_route_executions_route (route_id),
    INDEX idx_route_executions_status (status)
);

-- Tabla para análisis de visitas a sucursales en rutas
CREATE TABLE IF NOT EXISTS route_sucursal_visits (
    id BIGSERIAL PRIMARY KEY,
    route_execution_id BIGINT REFERENCES route_executions(id),
    geofence_id INTEGER REFERENCES geofences(id),
    user_id INTEGER REFERENCES tracking_users(id),
    
    -- Timing de la visita
    planned_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    planned_departure TIMESTAMP,
    actual_departure TIMESTAMP,
    duration_minutes INTEGER,
    
    -- Orden en la ruta
    planned_order INTEGER,
    actual_order INTEGER,
    was_skipped BOOLEAN DEFAULT FALSE,
    skip_reason TEXT,
    
    -- Métricas de la visita
    distance_from_previous_km DECIMAL(6,2),
    travel_time_minutes INTEGER,
    visit_efficiency_score INTEGER,
    
    -- Datos GPS de entrada/salida
    entry_gps_location POINT,
    exit_gps_location POINT,
    gps_accuracy_meters INTEGER,
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_route_visits_execution (route_execution_id),
    INDEX idx_route_visits_geofence (geofence_id, created_at DESC),
    INDEX idx_route_visits_user (user_id, created_at DESC)
);

-- Tabla para patrones de rutas y aprendizaje
CREATE TABLE IF NOT EXISTS route_patterns (
    id BIGSERIAL PRIMARY KEY,
    pattern_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Patrón de sucursales
    sucursales_pattern JSONB NOT NULL,  -- Array de IDs de sucursales frecuentes
    geographic_area VARCHAR(50),        -- Norte, Sur, Este, Oeste, Centro
    
    -- Métricas del patrón
    average_distance_km DECIMAL(6,2),
    average_duration_minutes INTEGER,
    success_rate DECIMAL(5,2),          -- % de ejecuciones exitosas
    
    -- Uso del patrón
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    user_ratings JSONB DEFAULT '[]',    -- Ratings de usuarios
    
    -- Aprendizaje automático
    ml_features JSONB DEFAULT '{}',     -- Features para ML
    optimization_suggestions JSONB DEFAULT '[]',
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_route_patterns_area (geographic_area),
    INDEX idx_route_patterns_success (success_rate DESC),
    INDEX idx_route_patterns_usage (times_used DESC)
);

-- Tabla para configuración del sistema de rutas
CREATE TABLE IF NOT EXISTS route_system_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    data_type VARCHAR(20) DEFAULT 'string',
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER REFERENCES tracking_users(id)
);

-- Vista para análisis de eficiencia de rutas
CREATE OR REPLACE VIEW route_efficiency_analysis AS
SELECT 
    re.id,
    re.user_id,
    tu.display_name,
    cr.total_sucursales,
    
    -- Métricas planificadas vs reales
    (cr.metrics->>'totalDistanceKm')::DECIMAL as planned_distance_km,
    re.actual_distance_km,
    (cr.metrics->>'estimatedDurationMinutes')::INTEGER as planned_duration_min,
    re.actual_duration_minutes,
    
    -- Cálculo de eficiencia
    CASE 
        WHEN re.actual_distance_km > 0 AND re.actual_duration_minutes > 0 THEN
            GREATEST(0, 100 - (
                ABS(re.actual_distance_km - (cr.metrics->>'totalDistanceKm')::DECIMAL) / 
                (cr.metrics->>'totalDistanceKm')::DECIMAL * 50 +
                ABS(re.actual_duration_minutes - (cr.metrics->>'estimatedDurationMinutes')::INTEGER) / 
                (cr.metrics->>'estimatedDurationMinutes')::INTEGER * 50
            ))
        ELSE NULL
    END as efficiency_percentage,
    
    -- Estados
    re.status,
    re.completed_waypoints,
    
    -- Timestamps
    re.created_at as route_planned_at,
    re.actual_start_time,
    re.actual_end_time

FROM route_executions re
INNER JOIN calculated_routes cr ON re.route_id = cr.id
INNER JOIN tracking_users tu ON re.user_id = tu.id
ORDER BY re.created_at DESC;

-- Vista para reportes de patrones de rutas
CREATE OR REPLACE VIEW route_pattern_summary AS
SELECT 
    rp.pattern_name,
    rp.geographic_area,
    rp.times_used,
    rp.success_rate,
    rp.average_distance_km,
    rp.average_duration_minutes,
    
    -- Estadísticas de uso reciente
    COUNT(re.id) as executions_last_30_days,
    AVG(re.efficiency_score) as avg_efficiency_last_30_days,
    
    rp.last_used_at,
    rp.created_at

FROM route_patterns rp
LEFT JOIN calculated_routes cr ON cr.preferences ? 'pattern_id' 
    AND (cr.preferences->>'pattern_id')::INTEGER = rp.id
LEFT JOIN route_executions re ON cr.id = re.route_id 
    AND re.created_at >= NOW() - INTERVAL '30 days'
WHERE rp.active = true
GROUP BY rp.id, rp.pattern_name, rp.geographic_area, 
         rp.times_used, rp.success_rate, rp.average_distance_km,
         rp.average_duration_minutes, rp.last_used_at, rp.created_at
ORDER BY rp.times_used DESC, rp.success_rate DESC;

-- Configuraciones iniciales del sistema de rutas
INSERT INTO route_system_config (config_key, config_value, data_type, description, category) VALUES
('max_sucursales_per_route', '10', 'integer', 'Número máximo de sucursales por ruta', 'limits'),
('max_route_duration_hours', '8', 'integer', 'Duración máxima de ruta en horas', 'limits'),
('max_route_distance_km', '150', 'integer', 'Distancia máxima de ruta en kilómetros', 'limits'),
('default_visit_time_minutes', '30', 'integer', 'Tiempo promedio por visita en minutos', 'timing'),
('average_speed_kmh', '40', 'integer', 'Velocidad promedio en ciudad km/h', 'timing'),
('fuel_cost_per_km', '2.50', 'decimal', 'Costo estimado de combustible por km (MXN)', 'costs'),
('openroute_api_enabled', 'false', 'boolean', 'Habilitar API de OpenRouteService', 'apis'),
('google_maps_api_enabled', 'false', 'boolean', 'Habilitar API de Google Maps', 'apis'),
('route_optimization_enabled', 'true', 'boolean', 'Habilitar optimización inteligente de rutas', 'features'),
('pattern_learning_enabled', 'true', 'boolean', 'Habilitar aprendizaje de patrones de rutas', 'features')
ON CONFLICT (config_key) DO NOTHING;

-- Función para actualizar estadísticas de patrones
CREATE OR REPLACE FUNCTION update_route_pattern_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar estadísticas cuando se completa una ejecución de ruta
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Aquí se puede agregar lógica para actualizar patrones
        -- basado en la ruta ejecutada
        NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas automáticamente
CREATE TRIGGER trigger_update_route_pattern_stats
    AFTER UPDATE ON route_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_route_pattern_stats();

-- Función para limpiar datos antiguos de rutas
CREATE OR REPLACE FUNCTION cleanup_old_route_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Limpiar ejecuciones de rutas antiguas
    DELETE FROM route_executions 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep
      AND status IN ('completed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpiar rutas calculadas sin ejecución
    DELETE FROM calculated_routes cr
    WHERE cr.created_at < NOW() - INTERVAL '1 day' * (days_to_keep / 2)
      AND NOT EXISTS (
          SELECT 1 FROM route_executions re 
          WHERE re.route_id = cr.id
      );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentarios para documentación
COMMENT ON TABLE calculated_routes IS 'Rutas calculadas con algoritmos de optimización';
COMMENT ON TABLE route_optimizations IS 'Análisis de optimizaciones aplicadas a rutas';
COMMENT ON TABLE route_executions IS 'Ejecución en tiempo real de rutas planificadas';
COMMENT ON TABLE route_sucursal_visits IS 'Registro detallado de visitas durante ejecución de rutas';
COMMENT ON TABLE route_patterns IS 'Patrones de rutas para aprendizaje automático';
COMMENT ON VIEW route_efficiency_analysis IS 'Análisis de eficiencia planificado vs real';
COMMENT ON FUNCTION cleanup_old_route_data IS 'Limpieza automática de datos antiguos de rutas';