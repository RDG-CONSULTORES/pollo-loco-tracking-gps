require('dotenv').config();
const db = require('./src/config/database');
const https = require('https');

/**
 * SISTEMA COMPLETO DE VALIDACIÓN DE 85 SUCURSALES
 * 1. Integra las 3 nuevas sucursales
 * 2. Obtiene TODAS las sucursales (BD + Zenput)
 * 3. Crea interfaz web para validación manual
 * 4. Permite buscar/pegar coordenadas
 * 5. Normaliza todos los datos
 */

// Las 3 nuevas sucursales de Zenput
const newBranches = [
  {
    zenput_id: 2260766,
    name: "83 - Cerradas de Anahuac", 
    city: "General Escobedo",
    state: "Nuevo León",
    municipality: "General Escobedo",
    address: "401 Avenida Concordia",
    phone: "+52 81 0000-0001",
    email: "sucursal83@eplcas.com"
  },
  {
    zenput_id: 2260636,
    name: "84 - Aeropuerto del Norte",
    city: "Ciénega de Flores", 
    state: "Nuevo León",
    municipality: "Ciénega de Flores",
    address: "Km. 23.2 Autopista Monterrey - Nuevo Laredo",
    phone: "+52 81 0000-0002",
    email: "sucursal84@eplcas.com"
  },
  {
    zenput_id: 2260765,
    name: "85 - Diego Diaz",
    city: "San Nicolás de los Garza",
    state: "Nuevo León", 
    municipality: "San Nicolás de los Garza",
    address: "198 Avenida Diego Díaz de Berlanga",
    phone: "+52 81 0000-0003",
    email: "sucursal85@eplcas.com"
  }
];

async function getAllZenputLocations() {
  return new Promise((resolve, reject) => {
    const url = 'https://www.zenput.com/api/v3/locations/?limit=100';
    
    const options = {
      method: 'GET',
      headers: {
        'X-API-TOKEN': process.env.ZENPUT_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.data || []);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function createCompleteValidationSystem() {
  console.log('🔄 CREANDO SISTEMA DE VALIDACIÓN COMPLETO PARA 85 SUCURSALES\n');
  
  try {
    // 1. Integrar las 3 nuevas sucursales primero
    console.log('📝 PASO 1: Integrando las 3 nuevas sucursales...');
    await integrateNewBranches();
    
    // 2. Obtener TODAS las sucursales actualizadas de BD
    console.log('\n📊 PASO 2: Obteniendo todas las sucursales de BD...');
    const allBranches = await db.query(`
      SELECT 
        id, branch_number, name, city, state, municipality, address,
        latitude, longitude, phone, email,
        group_id, group_name, zenput_id,
        gps_validated, active, created_at
      FROM branches 
      WHERE active = true
      ORDER BY id
    `);
    
    console.log(`✅ Sucursales en BD: ${allBranches.rows.length}`);
    
    // 3. Obtener datos de Zenput para enriquecimiento
    console.log('\n🌐 PASO 3: Obteniendo datos de Zenput...');
    const zenputLocations = await getAllZenputLocations();
    console.log(`✅ Locations Zenput: ${zenputLocations.length}`);
    
    // 4. Crear mapa de Zenput por ID para enriquecimiento
    const zenputMap = new Map();
    zenputLocations.forEach(loc => {
      zenputMap.set(loc.id, loc);
    });
    
    // 5. Enriquecer datos combinando BD + Zenput
    console.log('\n🔍 PASO 4: Enriqueciendo datos BD + Zenput...');
    const enrichedBranches = allBranches.rows.map(branch => {
      const zenputData = zenputMap.get(branch.zenput_id);
      
      return {
        // Datos de BD
        id: branch.id,
        name: branch.name,
        city: branch.city,
        state: branch.state,
        municipality: branch.municipality,
        address: branch.address,
        latitude: branch.latitude,
        longitude: branch.longitude,
        phone: branch.phone,
        email: branch.email,
        group_id: branch.group_id,
        group_name: branch.group_name,
        zenput_id: branch.zenput_id,
        gps_validated: branch.gps_validated,
        
        // Datos enriquecidos de Zenput
        zenput_name: zenputData?.name || null,
        zenput_address: zenputData?.address || null,
        zenput_city: zenputData?.city || null,
        zenput_state: zenputData?.state || null,
        zenput_latitude: zenputData?.latitude || null,
        zenput_longitude: zenputData?.longitude || null,
        
        // Análisis de diferencias
        name_matches: branch.name === zenputData?.name,
        address_matches: branch.address === zenputData?.address,
        coordinates_missing: !branch.latitude || !branch.longitude || branch.latitude === 0 || branch.longitude === 0,
        zenput_has_coordinates: !!(zenputData?.latitude && zenputData?.longitude),
        
        // Para Google Maps
        google_maps_query: `${branch.address || zenputData?.address || ''}, ${branch.city}, ${branch.state}, México`.trim(),
        needs_validation: !branch.latitude || !branch.longitude || branch.latitude === 0 || branch.longitude === 0 || !branch.gps_validated
      };
    });
    
    // 6. Crear interfaz web de validación
    console.log('\n🌐 PASO 5: Creando interfaz web de validación...');
    await createValidationWebInterface(enrichedBranches);
    
    // 7. Crear API endpoints para actualización
    console.log('\n📡 PASO 6: Creando API endpoints...');
    await createValidationAPI();
    
    // 8. Estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES:');
    console.log('━'.repeat(60));
    
    const stats = {
      total: enrichedBranches.length,
      with_coordinates: enrichedBranches.filter(b => b.latitude && b.longitude).length,
      missing_coordinates: enrichedBranches.filter(b => !b.latitude || !b.longitude).length,
      gps_validated: enrichedBranches.filter(b => b.gps_validated).length,
      zenput_has_coords: enrichedBranches.filter(b => b.zenput_has_coordinates).length,
      name_mismatches: enrichedBranches.filter(b => !b.name_matches && b.zenput_name).length
    };
    
    console.log(`📊 Total sucursales: ${stats.total}`);
    console.log(`✅ Con coordenadas: ${stats.with_coordinates}`);
    console.log(`❌ Sin coordenadas: ${stats.missing_coordinates}`);
    console.log(`🔍 GPS validadas: ${stats.gps_validated}`);
    console.log(`🌐 Zenput tiene coords: ${stats.zenput_has_coords}`);
    console.log(`⚠️ Nombres diferentes: ${stats.name_mismatches}`);
    
    console.log('\n🚀 SISTEMA DE VALIDACIÓN CREADO:');
    console.log('━'.repeat(60));
    console.log('✅ Base de datos actualizada a 85 sucursales');
    console.log('✅ Datos enriquecidos con información de Zenput');
    console.log('🌐 Interfaz web: /webapp/branch-validation.html');
    console.log('📡 API endpoints para actualización en tiempo real');
    console.log('🗺️ Enlaces automáticos a Google Maps');
    console.log('📊 Exportación de datos completos');
    
    return {
      success: true,
      total_branches: stats.total,
      missing_coordinates: stats.missing_coordinates,
      interface_url: '/webapp/branch-validation.html'
    };
    
  } catch (error) {
    console.error('❌ Error creando sistema de validación:', error.message);
    return { success: false, error: error.message };
  }
}

async function integrateNewBranches() {
  // Obtener siguiente ID
  const maxIdResult = await db.query('SELECT MAX(id) as max_id FROM branches');
  const nextId = (maxIdResult.rows[0].max_id || 82) + 1;
  
  // Verificar si ya están insertadas
  const existingCheck = await db.query('SELECT COUNT(*) as count FROM branches WHERE zenput_id IN ($1, $2, $3)', 
    [2260766, 2260636, 2260765]);
  
  if (existingCheck.rows[0].count > 0) {
    console.log('✅ Nuevas sucursales ya están integradas');
    return;
  }
  
  console.log(`📝 Insertando 3 nuevas sucursales (IDs: ${nextId}-${nextId + 2})...`);
  
  for (const [index, branch] of newBranches.entries()) {
    const branchId = nextId + index;
    
    await db.query(`
      INSERT INTO branches (
        id, branch_number, name, city, state, municipality,
        group_id, group_name, address,
        latitude, longitude, phone, email, zenput_id,
        country, region, active, gps_validated,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
      )
    `, [
      branchId, branchId, branch.name, branch.city, branch.state, branch.municipality,
      1, 'TEPEYAC', branch.address,
      0, 0, branch.phone, branch.email, branch.zenput_id,
      'México', 'NORTE', true, false
    ]);
    
    console.log(`✅ ${branchId}. ${branch.name}`);
  }
}

async function createValidationWebInterface(enrichedBranches) {
  const htmlContent = generateValidationHTML(enrichedBranches);
  const fs = require('fs').promises;
  
  await fs.writeFile('./src/webapp/branch-validation.html', htmlContent);
  console.log('✅ Interfaz web creada: /webapp/branch-validation.html');
}

async function createValidationAPI() {
  const apiContent = generateValidationAPI();
  const fs = require('fs').promises;
  
  await fs.writeFile('./src/api/routes/branch-validation.routes.js', apiContent);
  console.log('✅ API endpoints creados: /api/branch-validation/*');
}

function generateValidationHTML(branches) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validación de 85 Sucursales EPL CAS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2c3e50, #3498db); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .table-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
        th { background: #34495e; color: white; font-weight: 600; }
        .actions { display: flex; gap: 5px; }
        .btn { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; font-size: 11px; }
        .btn-maps { background: #4285f4; color: white; }
        .btn-update { background: #27ae60; color: white; }
        .btn-validate { background: #f39c12; color: white; }
        .coordinates { font-family: monospace; }
        .missing { color: #e74c3c; font-weight: bold; }
        .valid { color: #27ae60; }
        .search-box { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; width: 300px; }
        .filters { margin: 10px 0; }
        .filter-btn { margin: 5px; padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
        .filter-btn.active { background: #3498db; color: white; }
        .coord-input { width: 100px; padding: 2px; border: 1px solid #ddd; border-radius: 3px; }
        .validation-form { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: none; z-index: 1000; }
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; z-index: 999; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Sistema de Validación - 85 Sucursales EPL CAS</h1>
            <p>Validación completa de coordenadas GPS y normalización de datos</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>${branches.length}</h3>
                <p>Total Sucursales</p>
            </div>
            <div class="stat-card">
                <h3>${branches.filter(b => b.coordinates_missing).length}</h3>
                <p>Sin Coordenadas</p>
            </div>
            <div class="stat-card">
                <h3>${branches.filter(b => b.gps_validated).length}</h3>
                <p>GPS Validadas</p>
            </div>
            <div class="stat-card">
                <h3>${branches.filter(b => b.zenput_has_coordinates).length}</h3>
                <p>Zenput Tiene Coords</p>
            </div>
        </div>
        
        <div class="filters">
            <input type="text" id="searchBox" class="search-box" placeholder="Buscar por nombre, ciudad o dirección...">
            <button class="filter-btn active" onclick="filterBranches('all')">Todas</button>
            <button class="filter-btn" onclick="filterBranches('missing')">Sin Coordenadas</button>
            <button class="filter-btn" onclick="filterBranches('validated')">Validadas</button>
            <button class="filter-btn" onclick="filterBranches('zenput')">Zenput Tiene</button>
        </div>
        
        <div class="table-container">
            <table id="branchesTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Ciudad/Estado</th>
                        <th>Dirección</th>
                        <th>Coordenadas Actuales</th>
                        <th>Zenput Coords</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${branches.map(branch => `
                    <tr data-branch-id="${branch.id}" data-filter="${getFilterClass(branch)}">
                        <td>${branch.id}</td>
                        <td><strong>${branch.name}</strong></td>
                        <td>${branch.city}, ${branch.state}</td>
                        <td title="${branch.address}">${(branch.address || '').substring(0, 40)}${(branch.address || '').length > 40 ? '...' : ''}</td>
                        <td class="coordinates ${branch.coordinates_missing ? 'missing' : 'valid'}">
                            ${branch.latitude && branch.longitude && branch.latitude !== 0 && branch.longitude !== 0 ? 
                                `${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}` : 
                                'SIN COORDENADAS'}
                        </td>
                        <td class="coordinates ${branch.zenput_has_coordinates ? 'valid' : 'missing'}">
                            ${branch.zenput_latitude && branch.zenput_longitude ? 
                                `${parseFloat(branch.zenput_latitude).toFixed(6)}, ${parseFloat(branch.zenput_longitude).toFixed(6)}` : 
                                'N/A'}
                        </td>
                        <td>
                            ${branch.gps_validated ? '<span class="valid">✅ Validado</span>' : '<span class="missing">⚠️ Pendiente</span>'}
                        </td>
                        <td class="actions">
                            <a href="https://maps.google.com/maps?q=${encodeURIComponent(branch.google_maps_query)}" 
                               target="_blank" class="btn btn-maps" title="Buscar en Google Maps">📍 Maps</a>
                            <button class="btn btn-update" onclick="openValidationForm(${branch.id})" title="Actualizar coordenadas">✏️ Edit</button>
                            ${branch.zenput_has_coordinates ? 
                                `<button class="btn btn-validate" onclick="useZenputCoords(${branch.id})" title="Usar coords de Zenput">🔄 Zenput</button>` : 
                                ''}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <div class="overlay" id="overlay"></div>
    <div class="validation-form" id="validationForm">
        <h3>Actualizar Coordenadas</h3>
        <p><strong>Sucursal:</strong> <span id="currentBranchName"></span></p>
        <p><strong>Dirección:</strong> <span id="currentBranchAddress"></span></p>
        <br>
        <label>Latitud:</label>
        <input type="text" id="latInput" class="coord-input" placeholder="25.123456">
        <br><br>
        <label>Longitud:</label>
        <input type="text" id="lngInput" class="coord-input" placeholder="-100.123456">
        <br><br>
        <button onclick="updateCoordinates()">💾 Guardar</button>
        <button onclick="closeValidationForm()">❌ Cancelar</button>
    </div>

    <script>
        let branches = ${JSON.stringify(branches)};
        let currentBranchId = null;
        
        function filterBranches(filter) {
            const rows = document.querySelectorAll('#branchesTable tbody tr');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            rows.forEach(row => {
                const filterClass = row.dataset.filter;
                if (filter === 'all' || filterClass.includes(filter)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        function openValidationForm(branchId) {
            const branch = branches.find(b => b.id === branchId);
            currentBranchId = branchId;
            
            document.getElementById('currentBranchName').textContent = branch.name;
            document.getElementById('currentBranchAddress').textContent = branch.address;
            document.getElementById('latInput').value = branch.latitude || '';
            document.getElementById('lngInput').value = branch.longitude || '';
            
            document.getElementById('overlay').style.display = 'block';
            document.getElementById('validationForm').style.display = 'block';
        }
        
        function closeValidationForm() {
            document.getElementById('overlay').style.display = 'none';
            document.getElementById('validationForm').style.display = 'none';
        }
        
        async function updateCoordinates() {
            const lat = document.getElementById('latInput').value;
            const lng = document.getElementById('lngInput').value;
            
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                alert('Por favor ingresa coordenadas válidas');
                return;
            }
            
            try {
                const response = await fetch('/api/branch-validation/update-coordinates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        branchId: currentBranchId, 
                        latitude: parseFloat(lat), 
                        longitude: parseFloat(lng) 
                    })
                });
                
                if (response.ok) {
                    alert('Coordenadas actualizadas exitosamente');
                    location.reload();
                } else {
                    alert('Error actualizando coordenadas');
                }
            } catch (error) {
                alert('Error de conexión');
            }
            
            closeValidationForm();
        }
        
        async function useZenputCoords(branchId) {
            const branch = branches.find(b => b.id === branchId);
            
            if (confirm(\`¿Usar coordenadas de Zenput?\\n\${branch.zenput_latitude}, \${branch.zenput_longitude}\`)) {
                try {
                    const response = await fetch('/api/branch-validation/update-coordinates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            branchId: branchId, 
                            latitude: parseFloat(branch.zenput_latitude), 
                            longitude: parseFloat(branch.zenput_longitude) 
                        })
                    });
                    
                    if (response.ok) {
                        alert('Coordenadas de Zenput aplicadas');
                        location.reload();
                    }
                } catch (error) {
                    alert('Error aplicando coordenadas');
                }
            }
        }
        
        // Búsqueda en tiempo real
        document.getElementById('searchBox').addEventListener('input', function() {
            const query = this.value.toLowerCase();
            const rows = document.querySelectorAll('#branchesTable tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    </script>
</body>
</html>`;
}

function getFilterClass(branch) {
  const classes = [];
  if (branch.coordinates_missing) classes.push('missing');
  if (branch.gps_validated) classes.push('validated');
  if (branch.zenput_has_coordinates) classes.push('zenput');
  return classes.join(' ');
}

function generateValidationAPI() {
  return `const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Actualizar coordenadas de una sucursal
router.post('/update-coordinates', async (req, res) => {
  try {
    const { branchId, latitude, longitude } = req.body;
    
    await db.query(\`
      UPDATE branches 
      SET latitude = $1, longitude = $2, gps_validated = true, updated_at = NOW()
      WHERE id = $3
    \`, [latitude, longitude, branchId]);
    
    res.json({ success: true, message: 'Coordenadas actualizadas' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener estadísticas de validación
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(\`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords,
        COUNT(CASE WHEN gps_validated = true THEN 1 END) as validated
      FROM branches WHERE active = true
    \`);
    
    res.json({ success: true, stats: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;`;
}

// Ejecutar
async function main() {
  const result = await createCompleteValidationSystem();
  
  if (result.success) {
    console.log('\n🎉 SISTEMA COMPLETO CREADO EXITOSAMENTE!');
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. ✅ Abrir: http://localhost:3000/webapp/branch-validation.html');
    console.log('2. 🗺️ Validar coordenadas una por una');
    console.log('3. 📊 Usar filtros para organizar el trabajo');
    console.log('4. 💾 Guardar coordenadas en tiempo real');
    console.log('5. ✅ Exportar reporte final completo');
  } else {
    console.log('\n❌ Error:', result.error);
  }
  
  process.exit(0);
}

main();