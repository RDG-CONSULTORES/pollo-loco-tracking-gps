const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize database pool
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_DlSRAHuyaY83@ep-orange-grass-a402u4o5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// Coordenadas de ejemplo para las sucursales (deberán actualizarse con coordenadas reales)
const coordenadas = {
    // TEPEYAC
    "1 Pino Suarez": { lat: 25.6722, lng: -100.3089 },
    "2 Madero": { lat: 25.6758, lng: -100.3125 },
    "3 Matamoros": { lat: 25.6800, lng: -100.3150 },
    "4 Santa Catarina": { lat: 25.6733, lng: -100.4581 },
    "5 Felix U. Gomez": { lat: 25.6900, lng: -100.3200 },
    "6 Garcia": { lat: 25.8094, lng: -100.5917 },
    "7 La Huasteca": { lat: 25.6920, lng: -100.2580 },
    
    // OGAS
    "8 Gonzalitos": { lat: 25.6694, lng: -100.3394 },
    "9 Anahuac": { lat: 25.6789, lng: -100.3286 },
    "10 Barragan": { lat: 25.6547, lng: -100.2897 },
    "11 Lincoln": { lat: 25.6689, lng: -100.3089 },
    "12 Concordia": { lat: 25.6642, lng: -100.2517 },
    "13 Escobedo": { lat: 25.7997, lng: -100.3211 },
    "14 Aztlan": { lat: 25.7317, lng: -100.2644 },
    "15 Ruiz Cortinez": { lat: 25.6750, lng: -100.2881 },
    
    // EPL SO
    "16 Solidaridad": { lat: 25.7242, lng: -100.1967 },
    
    // EFM
    "17 Miguel Aleman": { lat: 25.6581, lng: -100.3814 },
    "18 Sendero": { lat: 25.6522, lng: -100.3975 },
    "19 Conchello": { lat: 25.7281, lng: -100.3117 },
    
    // TEC
    "20 Tecnológico": { lat: 25.6514, lng: -100.2897 },
    "21 Chapultepec": { lat: 25.6678, lng: -100.2850 },
    "22 Satelite": { lat: 25.6439, lng: -100.2744 },
    "23 Guasave": { lat: 25.5678, lng: -108.4697 },
    
    // EXPO
    "24 Exposicion": { lat: 25.6833, lng: -100.3097 },
    "25 Juarez": { lat: 25.8722, lng: -100.1878 },
    "26 Cadereyta": { lat: 25.5831, lng: -100.0000 },
    "27 Santiago": { lat: 25.4267, lng: -100.1475 },
    "28 Guerrero": { lat: 26.0797, lng: -98.2869 },
    "29 Pablo Livas": { lat: 25.7422, lng: -100.2619 },
    "30 Carrizo": { lat: 26.3617, lng: -98.8425 },
    "31 Las Quintas": { lat: 25.6269, lng: -100.3103 },
    "32 Allende": { lat: 25.2803, lng: -100.0231 },
    "33 Eloy Cavazos": { lat: 25.5142, lng: -99.9053 },
    "34 Montemorelos": { lat: 25.1869, lng: -99.8331 }
};

async function generateGruposStructure() {
    try {
        // Query para obtener TODOS los grupos y sus sucursales
        const query = `
            SELECT 
                grupo_operativo,
                ARRAY_AGG(DISTINCT sucursal_clean ORDER BY sucursal_clean) as sucursales,
                COUNT(DISTINCT sucursal_clean) as total_sucursales,
                COUNT(*) as total_records
            FROM supervision_operativa_detalle 
            WHERE grupo_operativo IS NOT NULL
            GROUP BY grupo_operativo
            ORDER BY grupo_operativo;
        `;
        
        console.log('Generando estructura de grupos para dashboard iOS...\n');
        
        const result = await pool.query(query);
        
        console.log('// ESTRUCTURA DE GRUPOS OPERATIVOS - EL POLLO LOCO CAS');
        console.log('// Generado automáticamente desde la base de datos');
        console.log(`// Fecha: ${new Date().toISOString()}\n`);
        console.log('const GRUPOS_OPERATIVOS = {');
        
        for (const row of result.rows) {
            const grupo = row.grupo_operativo;
            const sucursales = row.sucursales;
            
            console.log(`    "${grupo}": {`);
            console.log(`        sucursales: [`);
            
            for (const sucursal of sucursales) {
                const coords = coordenadas[sucursal] || { lat: 25.6866, lng: -100.3161 };
                console.log(`            {`);
                console.log(`                name: "${sucursal}",`);
                console.log(`                lat: ${coords.lat},`);
                console.log(`                lng: ${coords.lng}`);
                console.log(`            },`);
            }
            
            console.log(`        ],`);
            console.log(`        total_sucursales: ${row.total_sucursales},`);
            console.log(`        total_records: ${row.total_records}`);
            console.log(`    },`);
        }
        
        console.log('};');
        
        // Verificación específica de TEPEYAC
        console.log('\n\n// VERIFICACIÓN TEPEYAC');
        const tepeyacQuery = `
            SELECT DISTINCT sucursal_clean 
            FROM supervision_operativa_detalle 
            WHERE grupo_operativo = 'TEPEYAC'
            ORDER BY sucursal_clean;
        `;
        
        const tepeyacResult = await pool.query(tepeyacQuery);
        
        console.log('// TEPEYAC tiene las siguientes sucursales:');
        tepeyacResult.rows.forEach((row, index) => {
            console.log(`// ${index + 1}. ${row.sucursal_clean}`);
        });
        
        // Verificación de La Huasteca
        const huastecaQuery = `
            SELECT grupo_operativo, COUNT(*) as records
            FROM supervision_operativa_detalle 
            WHERE sucursal_clean = '7 La Huasteca'
            GROUP BY grupo_operativo;
        `;
        
        const huastecaResult = await pool.query(huastecaQuery);
        
        console.log('\n// VERIFICACIÓN: La Huasteca pertenece a:');
        huastecaResult.rows.forEach(row => {
            console.log(`// - ${row.grupo_operativo}: ${row.records} registros`);
        });
        
    } catch (error) {
        console.error('Error generando estructura:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the generation
generateGruposStructure();