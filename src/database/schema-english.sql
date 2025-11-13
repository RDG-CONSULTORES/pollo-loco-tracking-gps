-- Schema actualizado con nombres en inglés
-- Este archivo muestra cómo debería ser el schema correcto

-- 4. VISITAS DETECTADAS (ACTUALIZADO)
CREATE TABLE IF NOT EXISTS tracking_visits (
  id BIGSERIAL PRIMARY KEY,
  tracker_id VARCHAR(10) NOT NULL,
  zenput_email VARCHAR(100),
  store_id VARCHAR(50),  -- ID de Zenput
  location_code VARCHAR(20) NOT NULL,
  
  -- Timestamps (en inglés)
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP,
  duration_minutes INT,
  
  -- Ubicaciones
  entry_lat DECIMAL(10, 8),
  entry_lon DECIMAL(11, 8),
  exit_lat DECIMAL(10, 8),
  exit_lon DECIMAL(11, 8),
  
  -- Metadata
  is_valid BOOLEAN DEFAULT true,
  visit_type VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (tracker_id) REFERENCES tracking_users(tracker_id) ON DELETE CASCADE,
  FOREIGN KEY (location_code) REFERENCES tracking_locations_cache(location_code) ON DELETE CASCADE
);

-- 5. CONFIGURACIÓN (ACTUALIZADO)
CREATE TABLE IF NOT EXISTS tracking_config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  data_type VARCHAR(20),
  description TEXT,
  updated_by VARCHAR(100),  -- Nueva columna
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. LOG DE ADMINISTRACIÓN (NUEVA)
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