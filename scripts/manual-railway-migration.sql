-- Manual Railway Migration: Complete Unified User Management Schema
-- Execute this directly in Railway PostgreSQL console

-- Add missing columns to tracking_users table
ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS position VARCHAR(100);

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS telegram_required BOOLEAN DEFAULT false;

ALTER TABLE tracking_users 
ADD COLUMN IF NOT EXISTS owntracks_required BOOLEAN DEFAULT true;

-- Create operational_groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS operational_groups (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create branches table if it doesn't exist
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY,
  operational_group_id INT REFERENCES operational_groups(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  municipality VARCHAR(100),
  country VARCHAR(100) DEFAULT 'México',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geofence_radius INTEGER DEFAULT 50,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user_group_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_group_permissions (
  user_id INT REFERENCES tracking_users(id) ON DELETE CASCADE,
  operational_group_id INT REFERENCES operational_groups(id) ON DELETE CASCADE,
  granted_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, operational_group_id)
);

-- Add system_users foreign key
ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS tracking_user_id INT REFERENCES tracking_users(id);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_tracking_users_email 
ON tracking_users(email);

CREATE INDEX IF NOT EXISTS idx_tracking_users_username 
ON tracking_users(username);

CREATE INDEX IF NOT EXISTS idx_tracking_users_role 
ON tracking_users(role);

CREATE INDEX IF NOT EXISTS idx_user_group_permissions_user 
ON user_group_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_group_permissions_group 
ON user_group_permissions(operational_group_id);

CREATE INDEX IF NOT EXISTS idx_branches_group 
ON branches(operational_group_id);

-- Insert default operational groups (if empty)
INSERT INTO operational_groups (id, name, code, description, active) VALUES 
(1, 'Zona Poniente', 'PON', 'Sucursales zona poniente', true),
(2, 'Zona Oriente', 'ORI', 'Sucursales zona oriente', true),
(3, 'Zona Sur', 'SUR', 'Sucursales zona sur de la ciudad', true),
(4, 'Zona Norte', 'NOR', 'Sucursales zona norte de la ciudad', true),
(5, 'Auditoría Central', 'AUD', 'Equipo de auditoría corporativa', true),
(6, 'Zona Centro', 'CTR', 'Sucursales del centro de la ciudad', true)
ON CONFLICT (id) DO NOTHING;

-- Verify migration
SELECT 'tracking_users columns' as check_type, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tracking_users' 
  AND column_name IN ('email', 'phone', 'position', 'username', 'password_hash', 'permissions', 'telegram_required', 'owntracks_required')
ORDER BY column_name;

SELECT 'operational_groups count' as check_type, COUNT(*) as total_groups 
FROM operational_groups;

SELECT 'tables created' as check_type, table_name 
FROM information_schema.tables 
WHERE table_name IN ('operational_groups', 'branches', 'user_group_permissions') 
  AND table_schema = 'public';