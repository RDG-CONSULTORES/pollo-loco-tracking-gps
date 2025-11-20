-- Agregar oficina de Roberto para testing alertas
-- Ejecutar cuando Roberto proporcione coordenadas

INSERT INTO sucursal_geofences (
    location_code,
    store_name, 
    group_name,
    latitude,
    longitude,
    radius_meters,
    active,
    created_at,
    updated_at
) VALUES (
    'ROBERTO_OFFICE',
    'Oficina Roberto - Testing',
    'Admin',
    -- COORDENADAS REALES DE ROBERTO:
    25.650648, -- Latitud oficina Roberto
    -100.373529, -- Longitud oficina Roberto
    150, -- Radio 150 metros
    true,
    NOW(),
    NOW()
);

-- Opcional: Agregar casa si Roberto quiere
INSERT INTO sucursal_geofences (
    location_code,
    store_name,
    group_name, 
    latitude,
    longitude,
    radius_meters,
    active,
    created_at,
    updated_at
) VALUES (
    'ROBERTO_HOME',
    'Casa Roberto - Testing',
    'Admin',
    -- COORDENADAS CASA (opcional)
    0.0, -- Roberto debe proporcionar
    0.0, -- Roberto debe proporcionar  
    100, -- Radio 100 metros
    false, -- Inicialmente desactivado
    NOW(),
    NOW()
);

-- Verificar que se agregaron
SELECT 
    location_code,
    store_name,
    latitude,
    longitude,
    radius_meters,
    active
FROM sucursal_geofences 
WHERE location_code LIKE 'ROBERTO_%';