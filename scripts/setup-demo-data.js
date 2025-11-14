/**
 * SETUP DE DATOS DEMO REALES
 * Configura el sistema con datos tangibles de El Pollo Loco
 */

const db = require('../src/config/database');

async function setupDemoData() {
    console.log('\n🚀 CONFIGURANDO DATOS DEMO REALES - EL POLLO LOCO');
    console.log('=' .repeat(60));

    try {
        // 1. Crear tablas del sistema de rutas
        await setupRouteTables();
        
        // 2. Crear supervisores realistas
        await createSupervisors();
        
        // 3. Crear sucursales de El Pollo Loco
        await createSucursales();
        
        // 4. Generar rutas de prueba
        await generateSampleRoutes();
        
        // 5. Crear datos históricos
        await generateHistoricalData();
        
        console.log('\n✅ CONFIGURACIÓN COMPLETA - SISTEMA LISTO PARA USAR');
        console.log('🌐 URLs para acceso:');
        console.log('   • Dashboard Principal: /webapp/dashboard.html');
        console.log('   • Dashboard Ejecutivo: /webapp/executive-dashboard.html');
        console.log('   • Métricas: /webapp/route-metrics-dashboard.html');
        
    } catch (error) {
        console.error('❌ Error configurando datos:', error);
    } finally {
        await db.end();
    }
}

async function setupRouteTables() {
    console.log('\n📊 1. CONFIGURANDO TABLAS DEL SISTEMA...');
    
    try {
        // Tabla para rutas calculadas
        await db.query(`
            CREATE TABLE IF NOT EXISTS calculated_routes (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER,
                
                -- Datos de la ruta
                waypoints JSONB NOT NULL,
                metrics JSONB NOT NULL,
                directions JSONB,
                
                -- Configuración de cálculo
                algorithm VARCHAR(50) NOT NULL,
                constraints JSONB DEFAULT '{}',
                preferences JSONB DEFAULT '{}',
                
                -- Estado y metadata
                status VARCHAR(20) DEFAULT 'draft',
                total_sucursales INTEGER,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Tabla para optimizaciones
        await db.query(`
            CREATE TABLE IF NOT EXISTS route_optimizations (
                id BIGSERIAL PRIMARY KEY,
                base_route JSONB NOT NULL,
                strategy VARCHAR(50) NOT NULL,
                
                -- Resultados de optimización
                optimized_route JSONB NOT NULL,
                improvements JSONB,
                recommendations JSONB,
                quality_score DECIMAL(4,2),
                
                -- Feedback del usuario
                user_feedback INTEGER,
                user_notes TEXT,
                
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // Tabla para ejecuciones de rutas
        await db.query(`
            CREATE TABLE IF NOT EXISTS route_executions (
                id BIGSERIAL PRIMARY KEY,
                route_id BIGINT REFERENCES calculated_routes(id),
                user_id INTEGER,
                
                -- Estado de ejecución
                status VARCHAR(20) DEFAULT 'pending',
                current_waypoint_index INTEGER DEFAULT 0,
                completed_waypoints INTEGER DEFAULT 0,
                
                -- Tiempos
                planned_start_time TIMESTAMP,
                actual_start_time TIMESTAMP,
                planned_end_time TIMESTAMP,
                actual_end_time TIMESTAMP,
                
                -- Métricas de ejecución
                route_deviations JSONB,
                delays JSONB,
                efficiency_score DECIMAL(4,2),
                
                -- Notas del usuario
                user_notes TEXT,
                
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('   ✅ Tablas del sistema de rutas creadas');
        
    } catch (error) {
        console.log(`   ❌ Error creando tablas: ${error.message}`);
    }
}

async function createSupervisors() {
    console.log('\n👥 2. CREANDO SUPERVISORES REALISTAS...');
    
    const supervisores = [
        {
            tracker_id: 'SUP001',
            display_name: 'María García López',
            zenput_email: 'maria.garcia@polloloco.com.mx',
            phone: '+52 555-0101',
            region: 'Centro Norte'
        },
        {
            tracker_id: 'SUP002', 
            display_name: 'Juan Pérez Hernández',
            zenput_email: 'juan.perez@polloloco.com.mx',
            phone: '+52 555-0102',
            region: 'Sur'
        },
        {
            tracker_id: 'SUP003',
            display_name: 'Ana López Martínez',
            zenput_email: 'ana.lopez@polloloco.com.mx', 
            phone: '+52 555-0103',
            region: 'Este'
        },
        {
            tracker_id: 'SUP004',
            display_name: 'Carlos Ruiz Silva',
            zenput_email: 'carlos.ruiz@polloloco.com.mx',
            phone: '+52 555-0104', 
            region: 'Oeste'
        },
        {
            tracker_id: 'SUP005',
            display_name: 'Luis Hernández Torres',
            zenput_email: 'luis.hernandez@polloloco.com.mx',
            phone: '+52 555-0105',
            region: 'Norte'
        },
        {
            tracker_id: 'SUP006',
            display_name: 'Carmen Torres Jiménez',
            zenput_email: 'carmen.torres@polloloco.com.mx',
            phone: '+52 555-0106',
            region: 'Sur Oeste'
        },
        {
            tracker_id: 'SUP007',
            display_name: 'Roberto Méndez Castro',
            zenput_email: 'roberto.mendez@polloloco.com.mx',
            phone: '+52 555-0107',
            region: 'Noreste'
        },
        {
            tracker_id: 'SUP008', 
            display_name: 'Patricia González Ramos',
            zenput_email: 'patricia.gonzalez@polloloco.com.mx',
            phone: '+52 555-0108',
            region: 'Sureste'
        }
    ];

    for (const supervisor of supervisores) {
        try {
            await db.query(`
                INSERT INTO tracking_users (tracker_id, display_name, zenput_email, phone, active, region)
                VALUES ($1, $2, $3, $4, true, $5)
                ON CONFLICT (tracker_id) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    zenput_email = EXCLUDED.zenput_email,
                    phone = EXCLUDED.phone,
                    region = EXCLUDED.region,
                    active = true
            `, [supervisor.tracker_id, supervisor.display_name, supervisor.zenput_email, supervisor.phone, supervisor.region]);
            
            console.log(`   ✅ ${supervisor.display_name} (${supervisor.region})`);
        } catch (error) {
            console.log(`   ❌ Error creando ${supervisor.display_name}: ${error.message}`);
        }
    }
}

async function createSucursales() {
    console.log('\n🏪 3. CREANDO SUCURSALES EL POLLO LOCO...');
    
    const sucursales = [
        // Ciudad de México - Centro
        { code: 'PL001', name: 'El Pollo Loco Centro Histórico', lat: 19.4326, lng: -99.1332, priority: 'high' },
        { code: 'PL002', name: 'El Pollo Loco Polanco', lat: 19.4270, lng: -99.1936, priority: 'high' },
        { code: 'PL003', name: 'El Pollo Loco Roma Norte', lat: 19.4144, lng: -99.1652, priority: 'medium' },
        { code: 'PL004', name: 'El Pollo Loco Condesa', lat: 19.4063, lng: -99.1715, priority: 'medium' },
        { code: 'PL005', name: 'El Pollo Loco Del Valle', lat: 19.3838, lng: -99.1663, priority: 'high' },
        
        // Norte
        { code: 'PL006', name: 'El Pollo Loco Satélite', lat: 19.5066, lng: -99.2381, priority: 'high' },
        { code: 'PL007', name: 'El Pollo Loco Lomas Verdes', lat: 19.5297, lng: -99.2578, priority: 'medium' },
        { code: 'PL008', name: 'El Pollo Loco Interlomas', lat: 19.5015, lng: -99.2757, priority: 'high' },
        { code: 'PL009', name: 'El Pollo Loco Echegaray', lat: 19.5180, lng: -99.2444, priority: 'medium' },
        
        // Sur  
        { code: 'PL010', name: 'El Pollo Loco Insurgentes Sur', lat: 19.3020, lng: -99.1870, priority: 'high' },
        { code: 'PL011', name: 'El Pollo Loco Coapa', lat: 19.2988, lng: -99.1572, priority: 'high' },
        { code: 'PL012', name: 'El Pollo Loco Coyoacán', lat: 19.3467, lng: -99.1618, priority: 'medium' },
        { code: 'PL013', name: 'El Pollo Loco San Ángel', lat: 19.3427, lng: -99.1871, priority: 'medium' },
        { code: 'PL014', name: 'El Pollo Loco Perisur', lat: 19.3021, lng: -99.1901, priority: 'high' },
        
        // Este
        { code: 'PL015', name: 'El Pollo Loco Aeropuerto', lat: 19.4363, lng: -99.0721, priority: 'high' },
        { code: 'PL016', name: 'El Pollo Loco Iztapalapa', lat: 19.3573, lng: -99.0554, priority: 'high' },
        { code: 'PL017', name: 'El Pollo Loco Nezahualcóyotl', lat: 19.4006, lng: -99.0145, priority: 'medium' },
        { code: 'PL018', name: 'El Pollo Loco Pantitlán', lat: 19.4157, lng: -99.0723, priority: 'medium' },
        
        // Oeste
        { code: 'PL019', name: 'El Pollo Loco Santa Fe', lat: 19.3598, lng: -99.2598, priority: 'high' },
        { code: 'PL020', name: 'El Pollo Loco Tacubaya', lat: 19.4026, lng: -99.1916, priority: 'medium' },
        { code: 'PL021', name: 'El Pollo Loco Las Águilas', lat: 19.3671, lng: -99.2464, priority: 'medium' },
        { code: 'PL022', name: 'El Pollo Loco Mixcoac', lat: 19.3754, lng: -99.1874, priority: 'high' },
        
        // Estado de México
        { code: 'PL023', name: 'El Pollo Loco Naucalpan', lat: 19.4791, lng: -99.2386, priority: 'high' },
        { code: 'PL024', name: 'El Pollo Loco Tlalnepantla', lat: 19.5407, lng: -99.1956, priority: 'high' },
        { code: 'PL025', name: 'El Pollo Loco Ecatepec', lat: 19.6014, lng: -99.0506, priority: 'medium' }
    ];

    for (const sucursal of sucursales) {
        try {
            await db.query(`
                INSERT INTO geofences (
                    location_code, location_name, latitude, longitude, 
                    radius_meters, active, priority, created_at
                )
                VALUES ($1, $2, $3, $4, 150, true, $5, NOW())
                ON CONFLICT (location_code) DO UPDATE SET
                    location_name = EXCLUDED.location_name,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    priority = EXCLUDED.priority,
                    active = true
            `, [sucursal.code, sucursal.name, sucursal.lat, sucursal.lng, sucursal.priority]);
            
            console.log(`   ✅ ${sucursal.name}`);
        } catch (error) {
            console.log(`   ❌ Error creando ${sucursal.name}: ${error.message}`);
        }
    }
}

async function generateSampleRoutes() {
    console.log('\n🛣️ 4. GENERANDO RUTAS DE EJEMPLO...');
    
    // Obtener supervisores
    const supervisoresResult = await db.query('SELECT id, display_name FROM tracking_users WHERE active = true LIMIT 5');
    const supervisores = supervisoresResult.rows;
    
    // Obtener sucursales 
    const sucursalesResult = await db.query('SELECT location_code, location_name, latitude, longitude FROM geofences WHERE active = true LIMIT 20');
    const sucursales = sucursalesResult.rows;
    
    for (const supervisor of supervisores) {
        // Crear ruta de ejemplo para cada supervisor
        const routeSucursales = sucursales.slice(0, 6).map(s => ({
            id: s.location_code,
            name: s.location_name,
            lat: parseFloat(s.latitude),
            lng: parseFloat(s.longitude)
        }));
        
        const sampleRoute = {
            waypoints: routeSucursales,
            start_location: { lat: 19.4326, lng: -99.1332 },
            total_distance: 45.8,
            estimated_duration: 285,
            efficiency_score: Math.floor(Math.random() * 20) + 80
        };
        
        const sampleMetrics = {
            totalDistance: sampleRoute.total_distance,
            estimatedDuration: sampleRoute.estimated_duration,
            fuelEstimate: sampleRoute.total_distance * 0.12,
            efficiencyScore: sampleRoute.efficiency_score,
            costSaving: Math.floor(Math.random() * 200) + 100
        };
        
        try {
            await db.query(`
                INSERT INTO calculated_routes (
                    user_id, waypoints, metrics, algorithm, 
                    status, total_sucursales, created_at
                )
                VALUES ($1, $2, $3, 'nearestNeighbor', 'completed', $4, NOW())
            `, [supervisor.id, JSON.stringify(sampleRoute), JSON.stringify(sampleMetrics), routeSucursales.length]);
            
            console.log(`   ✅ Ruta creada para ${supervisor.display_name}: ${routeSucursales.length} sucursales, ${sampleRoute.efficiency_score}% eficiencia`);
        } catch (error) {
            console.log(`   ❌ Error creando ruta para ${supervisor.display_name}: ${error.message}`);
        }
    }
}

async function generateHistoricalData() {
    console.log('\n📈 5. GENERANDO DATOS HISTÓRICOS...');
    
    // Generar ubicaciones GPS para supervisores
    const supervisores = await db.query('SELECT id, display_name FROM tracking_users WHERE active = true');
    
    for (const supervisor of supervisores.rows) {
        // Generar ubicaciones de los últimos 7 días
        for (let day = 0; day < 7; day++) {
            const date = new Date();
            date.setDate(date.getDate() - day);
            
            // Generar 3-5 ubicaciones por día
            const locations = 3 + Math.floor(Math.random() * 3);
            
            for (let loc = 0; loc < locations; loc++) {
                const lat = 19.4326 + (Math.random() - 0.5) * 0.2; // Variación alrededor de CDMX
                const lng = -99.1332 + (Math.random() - 0.5) * 0.2;
                const accuracy = 5 + Math.floor(Math.random() * 15);
                const battery = 70 + Math.floor(Math.random() * 30);
                
                const timestamp = new Date(date);
                timestamp.setHours(8 + loc * 2, Math.floor(Math.random() * 60));
                
                try {
                    await db.query(`
                        INSERT INTO gps_locations (
                            user_id, latitude, longitude, accuracy, 
                            battery, gps_timestamp, created_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $6)
                    `, [supervisor.id, lat, lng, accuracy, battery, timestamp]);
                } catch (error) {
                    // Silenciar errores de duplicados
                }
            }
        }
        
        console.log(`   ✅ Datos históricos generados para ${supervisor.display_name}`);
    }
    
    // Generar eventos de geofence
    const geofences = await db.query('SELECT location_code FROM geofences WHERE active = true LIMIT 10');
    
    for (const supervisor of supervisores.rows.slice(0, 3)) {
        for (const geofence of geofences.rows.slice(0, 5)) {
            const enterTime = new Date();
            enterTime.setHours(enterTime.getHours() - Math.floor(Math.random() * 48));
            
            const exitTime = new Date(enterTime);
            exitTime.setMinutes(exitTime.getMinutes() + 30 + Math.floor(Math.random() * 60));
            
            try {
                // Evento de entrada
                await db.query(`
                    INSERT INTO geofence_events (
                        user_id, location_code, event_type, 
                        latitude, longitude, event_timestamp
                    )
                    VALUES ($1, $2, 'enter', 19.4326, -99.1332, $3)
                `, [supervisor.id, geofence.location_code, enterTime]);
                
                // Evento de salida
                await db.query(`
                    INSERT INTO geofence_events (
                        user_id, location_code, event_type,
                        latitude, longitude, event_timestamp  
                    )
                    VALUES ($1, $2, 'exit', 19.4326, -99.1332, $3)
                `, [supervisor.id, geofence.location_code, exitTime]);
            } catch (error) {
                // Silenciar errores
            }
        }
    }
    
    console.log('   ✅ Eventos de geofence históricos generados');
}

// Ejecutar setup
if (require.main === module) {
    setupDemoData();
}

module.exports = { setupDemoData };