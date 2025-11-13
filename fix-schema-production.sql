-- ============================================
-- FIX DEFINITIVO PARA RAILWAY PRODUCTION
-- ============================================

-- 1. Renombrar columnas de español a inglés
-- tracking_visits
ALTER TABLE tracking_visits RENAME COLUMN entrada_at TO entry_time;
ALTER TABLE tracking_visits RENAME COLUMN salida_at TO exit_time;
ALTER TABLE tracking_visits RENAME COLUMN duracion_minutos TO duration_minutes;
ALTER TABLE tracking_visits RENAME COLUMN entrada_lat TO entry_lat;
ALTER TABLE tracking_visits RENAME COLUMN entrada_lon TO entry_lon;
ALTER TABLE tracking_visits RENAME COLUMN salida_lat TO exit_lat;
ALTER TABLE tracking_visits RENAME COLUMN salida_lon TO exit_lon;

-- 2. Agregar columnas faltantes
ALTER TABLE tracking_visits ADD COLUMN IF NOT EXISTS store_id VARCHAR(50);
ALTER TABLE tracking_config ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

-- 3. Crear tabla tracking_admin_log
CREATE TABLE IF NOT EXISTS tracking_admin_log (
  id SERIAL PRIMARY KEY,
  admin_user VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Recrear índices con nombres correctos
DROP INDEX IF EXISTS idx_visits_open;
DROP INDEX IF EXISTS idx_visits_tracker_date;
DROP INDEX IF EXISTS idx_visits_location_date;
DROP INDEX IF EXISTS idx_visits_date;

CREATE INDEX idx_visits_open ON tracking_visits(tracker_id) WHERE exit_time IS NULL;
CREATE INDEX idx_visits_tracker_date ON tracking_visits(tracker_id, DATE(entry_time) DESC);
CREATE INDEX idx_visits_location_date ON tracking_visits(location_code, DATE(entry_time) DESC);
CREATE INDEX idx_visits_date ON tracking_visits(DATE(entry_time) DESC);

-- 5. Actualizar vista con nombres en inglés
DROP VIEW IF EXISTS v_tracking_visits_detail;
CREATE VIEW v_tracking_visits_detail AS
SELECT 
  v.id,
  v.tracker_id,
  tu.display_name as supervisor_name,
  v.zenput_email,
  v.location_code,
  lc.name as location_name,
  lc.group_name,
  lc.director_name,
  v.entry_time,
  v.exit_time,
  v.duration_minutes,
  CASE 
    WHEN v.duration_minutes IS NULL THEN 'En progreso'
    WHEN v.duration_minutes < 30 THEN 'Muy corta'
    WHEN v.duration_minutes < 45 THEN 'Corta'
    WHEN v.duration_minutes <= 90 THEN 'Normal'
    ELSE 'Larga'
  END as duracion_evaluation,
  DATE(v.entry_time) as fecha,
  v.is_valid
FROM tracking_visits v
LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
LEFT JOIN tracking_locations_cache lc ON v.location_code = lc.location_code;

-- 6. Verificar estructura final
SELECT 'Schema actualizado exitosamente a estándares inglés ✅' as status;

-- Mostrar columnas de tracking_visits para confirmar
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracking_visits' 
ORDER BY ordinal_position;