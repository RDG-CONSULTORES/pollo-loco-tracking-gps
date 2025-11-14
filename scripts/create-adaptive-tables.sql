-- =============================================================================
-- ADAPTIVE TRACKING SYSTEM - Database Schema
-- Pollo Loco GPS Tracking System - Support Tables
-- =============================================================================

-- Tabla para log de configuraciones generadas
CREATE TABLE IF NOT EXISTS tracking_config_log (
    id BIGSERIAL PRIMARY KEY,
    tracker_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'config_requested', 'config_adapted', 'config_delivered'
    context VARCHAR(50),         -- 'work', 'travel', 'battery_low', 'automatic'
    ip_address INET,
    metadata JSONB,             -- Datos adicionales del contexto
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Índice para consultas frecuentes
    INDEX idx_config_log_tracker (tracker_id, timestamp DESC),
    INDEX idx_config_log_action (action, timestamp DESC)
);

-- Tabla para log de adaptaciones automáticas
CREATE TABLE IF NOT EXISTS tracking_adaptation_log (
    id BIGSERIAL PRIMARY KEY,
    tracker_id VARCHAR(50) NOT NULL,
    old_profile VARCHAR(50),     -- 'active', 'normal', 'conservative', 'battery_saver'
    new_profile VARCHAR(50) NOT NULL,
    reasons JSONB NOT NULL,      -- Array de razones para la adaptación
    priority INTEGER,            -- Prioridad de la adaptación (1-10)
    conditions JSONB,            -- Condiciones que dispararon la adaptación
    effectiveness_score DECIMAL(3,2), -- Score de efectividad (se llena después)
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key reference
    CONSTRAINT fk_adaptation_tracker 
        FOREIGN KEY (tracker_id) 
        REFERENCES tracking_users(tracker_id)
        ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_adaptation_log_tracker (tracker_id, timestamp DESC),
    INDEX idx_adaptation_log_profile (new_profile, timestamp DESC),
    INDEX idx_adaptation_log_priority (priority DESC, timestamp DESC)
);

-- Tabla para estadísticas de perfiles de tracking
CREATE TABLE IF NOT EXISTS tracking_profile_stats (
    id BIGSERIAL PRIMARY KEY,
    tracker_id VARCHAR(50) NOT NULL,
    profile VARCHAR(50) NOT NULL,
    
    -- Métricas de uso
    usage_duration_minutes INTEGER DEFAULT 0,
    locations_received INTEGER DEFAULT 0,
    average_accuracy DECIMAL(6,2),
    average_battery_drain DECIMAL(5,2),
    geofence_events INTEGER DEFAULT 0,
    
    -- Métricas de efectividad
    battery_efficiency_score DECIMAL(3,2), -- Batería consumida vs ubicaciones útiles
    accuracy_score DECIMAL(3,2),           -- Precisión promedio
    coverage_score DECIMAL(3,2),           -- Cobertura de sucursales
    
    -- Timestamps
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    last_updated TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_profile_stats_tracker 
        FOREIGN KEY (tracker_id) 
        REFERENCES tracking_users(tracker_id)
        ON DELETE CASCADE,
        
    -- Índices
    INDEX idx_profile_stats_tracker (tracker_id, started_at DESC),
    INDEX idx_profile_stats_profile (profile, started_at DESC),
    INDEX idx_profile_stats_effectiveness (battery_efficiency_score DESC, accuracy_score DESC)
);

-- Vista para análisis de adaptaciones recientes
CREATE OR REPLACE VIEW recent_adaptations AS
SELECT 
    tal.tracker_id,
    tu.display_name,
    tal.old_profile,
    tal.new_profile,
    tal.reasons,
    tal.priority,
    tal.conditions,
    tal.timestamp,
    
    -- Calcular si la adaptación fue efectiva
    CASE 
        WHEN tal.timestamp >= NOW() - INTERVAL '1 hour' THEN 'too_recent'
        WHEN EXISTS (
            SELECT 1 FROM gps_locations gl 
            WHERE gl.user_id = tu.id 
              AND gl.gps_timestamp > tal.timestamp 
              AND gl.battery < (tal.conditions->>'battery')::integer
        ) THEN 'ineffective'
        ELSE 'effective'
    END as effectiveness,
    
    -- Tiempo desde la adaptación
    EXTRACT(EPOCH FROM (NOW() - tal.timestamp))/3600 as hours_since_adaptation
    
FROM tracking_adaptation_log tal
INNER JOIN tracking_users tu ON tal.tracker_id = tu.tracker_id
WHERE tal.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY tal.timestamp DESC;

-- Vista para estadísticas de perfiles por usuario
CREATE OR REPLACE VIEW user_profile_summary AS
SELECT 
    tps.tracker_id,
    tu.display_name,
    tps.profile,
    
    -- Métricas agregadas
    SUM(tps.usage_duration_minutes) as total_usage_minutes,
    SUM(tps.locations_received) as total_locations,
    AVG(tps.average_accuracy) as overall_accuracy,
    AVG(tps.average_battery_drain) as overall_battery_drain,
    SUM(tps.geofence_events) as total_geofence_events,
    
    -- Scores promedio
    AVG(tps.battery_efficiency_score) as avg_battery_efficiency,
    AVG(tps.accuracy_score) as avg_accuracy_score,
    AVG(tps.coverage_score) as avg_coverage_score,
    
    -- Información temporal
    MIN(tps.started_at) as first_use,
    MAX(tps.ended_at) as last_use,
    COUNT(*) as usage_periods
    
FROM tracking_profile_stats tps
INNER JOIN tracking_users tu ON tps.tracker_id = tu.tracker_id
WHERE tps.started_at >= NOW() - INTERVAL '30 days'
GROUP BY tps.tracker_id, tu.display_name, tps.profile
ORDER BY tps.tracker_id, total_usage_minutes DESC;

-- Función para calcular efectividad de adaptación
CREATE OR REPLACE FUNCTION calculate_adaptation_effectiveness(
    adaptation_id BIGINT
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    adaptation_record RECORD;
    pre_adaptation_metrics RECORD;
    post_adaptation_metrics RECORD;
    effectiveness_score DECIMAL(3,2) := 0.0;
BEGIN
    -- Obtener datos de la adaptación
    SELECT * INTO adaptation_record
    FROM tracking_adaptation_log
    WHERE id = adaptation_id;
    
    IF NOT FOUND THEN
        RETURN 0.0;
    END IF;
    
    -- Obtener métricas pre-adaptación (1 hora antes)
    SELECT 
        AVG(accuracy) as avg_accuracy,
        AVG(battery) as avg_battery,
        COUNT(*) as location_count
    INTO pre_adaptation_metrics
    FROM gps_locations gl
    INNER JOIN tracking_users tu ON gl.user_id = tu.id
    WHERE tu.tracker_id = adaptation_record.tracker_id
      AND gl.gps_timestamp BETWEEN 
          adaptation_record.timestamp - INTERVAL '1 hour' AND 
          adaptation_record.timestamp;
    
    -- Obtener métricas post-adaptación (1 hora después)
    SELECT 
        AVG(accuracy) as avg_accuracy,
        AVG(battery) as avg_battery,
        COUNT(*) as location_count
    INTO post_adaptation_metrics
    FROM gps_locations gl
    INNER JOIN tracking_users tu ON gl.user_id = tu.id
    WHERE tu.tracker_id = adaptation_record.tracker_id
      AND gl.gps_timestamp BETWEEN 
          adaptation_record.timestamp AND 
          adaptation_record.timestamp + INTERVAL '1 hour';
    
    -- Calcular score de efectividad
    IF pre_adaptation_metrics.location_count > 0 AND post_adaptation_metrics.location_count > 0 THEN
        -- Mejora en precisión (peso 30%)
        IF post_adaptation_metrics.avg_accuracy < pre_adaptation_metrics.avg_accuracy THEN
            effectiveness_score := effectiveness_score + 0.3;
        END IF;
        
        -- Mejora/estabilidad en batería (peso 40%)
        IF post_adaptation_metrics.avg_battery >= pre_adaptation_metrics.avg_battery THEN
            effectiveness_score := effectiveness_score + 0.4;
        END IF;
        
        -- Consistencia de ubicaciones (peso 30%)
        IF post_adaptation_metrics.location_count >= pre_adaptation_metrics.location_count * 0.8 THEN
            effectiveness_score := effectiveness_score + 0.3;
        END IF;
    END IF;
    
    RETURN GREATEST(0.0, LEAST(1.0, effectiveness_score));
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar datos antiguos de tracking adaptativo
CREATE OR REPLACE FUNCTION cleanup_adaptive_tracking_data(
    days_to_keep INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Limpiar logs de configuración antiguos
    DELETE FROM tracking_config_log
    WHERE timestamp < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Limpiar logs de adaptación antiguos (mantener más tiempo para análisis)
    DELETE FROM tracking_adaptation_log
    WHERE timestamp < NOW() - INTERVAL '1 day' * (days_to_keep * 2);
    
    -- Limpiar estadísticas de perfiles completadas muy antiguas
    DELETE FROM tracking_profile_stats
    WHERE ended_at IS NOT NULL 
      AND ended_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insertar configuraciones para el sistema adaptativo
INSERT INTO tracking_config (key, value, data_type, description) VALUES 
('adaptive_tracking_enabled', 'true', 'boolean', 'Activar/desactivar tracking adaptativo automático'),
('adaptation_cooldown_minutes', '5', 'integer', 'Minutos entre adaptaciones automáticas para el mismo usuario'),
('battery_critical_threshold', '10', 'integer', 'Porcentaje de batería considerado crítico'),
('battery_low_threshold', '20', 'integer', 'Porcentaje de batería considerado bajo'),
('accuracy_poor_threshold', '100', 'integer', 'Precisión GPS considerada pobre (metros)'),
('movement_stationary_threshold', '5', 'integer', 'Velocidad considerada estacionaria (km/h)'),
('adaptation_min_priority', '5', 'integer', 'Prioridad mínima para aplicar adaptación automática'),
('profile_effectiveness_weight', '0.7', 'decimal', 'Peso del score de efectividad en decisiones de perfil')
ON CONFLICT (key) DO NOTHING;

-- Crear índices adicionales para optimización
CREATE INDEX IF NOT EXISTS idx_gps_locations_user_battery 
    ON gps_locations(user_id, battery) 
    WHERE battery IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_locations_user_accuracy 
    ON gps_locations(user_id, accuracy, gps_timestamp DESC) 
    WHERE accuracy IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gps_locations_velocity 
    ON gps_locations(velocity, gps_timestamp DESC) 
    WHERE velocity IS NOT NULL;

-- Comentarios para documentación
COMMENT ON TABLE tracking_config_log IS 'Log de solicitudes y entregas de configuraciones OwnTracks';
COMMENT ON TABLE tracking_adaptation_log IS 'Log de adaptaciones automáticas aplicadas a usuarios';
COMMENT ON TABLE tracking_profile_stats IS 'Estadísticas de rendimiento por perfil de tracking';
COMMENT ON FUNCTION calculate_adaptation_effectiveness IS 'Calcula efectividad de adaptación comparando métricas antes/después';
COMMENT ON FUNCTION cleanup_adaptive_tracking_data IS 'Limpia datos antiguos del sistema de tracking adaptativo';

-- Trigger para actualizar automáticamente timestamp en tracking_profile_stats
CREATE OR REPLACE FUNCTION update_profile_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_stats_timestamp
    BEFORE UPDATE ON tracking_profile_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_stats_timestamp();