require('dotenv').config();
const db = require('./src/config/database');
const fs = require('fs').promises;

/**
 * CREAR VALIDADOR SIMPLE PARA 85 SUCURSALES
 * Interface funcional que puedes usar para validar todas las sucursales
 */

async function createSimpleValidator() {
  console.log('🔧 CREANDO VALIDADOR SIMPLE PARA 85 SUCURSALES\n');
  
  try {
    // 1. Obtener TODAS las sucursales con su estado actual
    const allBranches = await db.query(`
      SELECT 
        id, branch_number, name, city, state, municipality, address,
        latitude, longitude, phone, email, zenput_id,
        gps_validated, active, region
      FROM branches 
      WHERE active = true
      ORDER BY id
    `);
    
    console.log(`📊 Total sucursales: ${allBranches.rows.length}`);
    
    // 2. Clasificar sucursales por estado de validación
    const needsValidation = allBranches.rows.filter(branch => 
      !branch.gps_validated || 
      branch.latitude === 0 || 
      branch.longitude === 0 || 
      !branch.latitude || 
      !branch.longitude
    );
    
    const validated = allBranches.rows.filter(branch => 
      branch.gps_validated && 
      branch.latitude !== 0 && 
      branch.longitude !== 0 &&
      branch.latitude && 
      branch.longitude
    );
    
    console.log(`✅ Validadas: ${validated.length}`);
    console.log(`⚠️ Necesitan validación: ${needsValidation.length}`);
    
    // 3. Crear interfaz HTML simple y funcional
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validador EPL CAS - 85 Sucursales</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f5f6fa; 
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 20px; 
            border-radius: 10px; 
            margin-bottom: 20px;
            text-align: center;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin: 20px 0; 
        }
        .stat { 
            background: white; 
            padding: 15px; 
            border-radius: 8px; 
            text-align: center; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat h3 { font-size: 24px; margin-bottom: 5px; }
        .stat.validated h3 { color: #27ae60; }
        .stat.pending h3 { color: #e74c3c; }
        .stat.total h3 { color: #3498db; }
        
        .filters {
            background: white;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .filter-btn.active { background: #3498db; color: white; border-color: #3498db; }
        .search-box {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            flex: 1;
            min-width: 200px;
        }
        
        .branches-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 15px;
        }
        .branch-card {
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #ddd;
            transition: transform 0.2s;
        }
        .branch-card:hover { transform: translateY(-2px); }
        .branch-card.validated { border-left-color: #27ae60; }
        .branch-card.pending { border-left-color: #e74c3c; }
        .branch-card.new { border-left-color: #f39c12; background: #fff8e1; }
        
        .branch-header {
            display: flex;
            justify-content: between;
            align-items: center;
            margin-bottom: 10px;
        }
        .branch-number { 
            background: #3498db; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold;
        }
        .branch-name { font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .branch-location { color: #666; font-size: 14px; margin-bottom: 8px; }
        .branch-coords {
            font-family: monospace;
            font-size: 12px;
            padding: 5px;
            background: #f8f9fa;
            border-radius: 4px;
            margin: 5px 0;
        }
        .coords-missing { background: #ffebee; color: #c62828; }
        .coords-valid { background: #e8f5e8; color: #2e7d32; }
        
        .actions {
            display: flex;
            gap: 5px;
            margin-top: 10px;
        }
        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
            transition: all 0.2s;
        }
        .btn-maps { background: #4285f4; color: white; }
        .btn-edit { background: #27ae60; color: white; }
        .btn-validate { background: #f39c12; color: white; }
        .btn:hover { opacity: 0.8; }
        
        .edit-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        }
        .modal-header { text-align: center; margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; }
        .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
        }
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 20px;
        }
        .btn-save { background: #27ae60; color: white; padding: 10px 20px; }
        .btn-cancel { background: #95a5a6; color: white; padding: 10px 20px; }
        
        .status-message {
            padding: 10px;
            border-radius: 6px;
            margin: 10px 0;
            text-align: center;
        }
        .status-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        
        .hidden { display: none; }
        .new-badge { 
            background: #f39c12; 
            color: white; 
            padding: 2px 6px; 
            border-radius: 3px; 
            font-size: 10px; 
            margin-left: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Validador EPL CAS - Sistema de 85 Sucursales</h1>
            <p>Validación completa de coordenadas GPS</p>
        </div>
        
        <div class="stats">
            <div class="stat total">
                <h3 id="total-count">${allBranches.rows.length}</h3>
                <p>Total Sucursales</p>
            </div>
            <div class="stat validated">
                <h3 id="validated-count">${validated.length}</h3>
                <p>GPS Validadas</p>
            </div>
            <div class="stat pending">
                <h3 id="pending-count">${needsValidation.length}</h3>
                <p>Pendientes</p>
            </div>
        </div>
        
        <div class="filters">
            <button class="filter-btn active" onclick="filterBranches('all')">Todas (${allBranches.rows.length})</button>
            <button class="filter-btn" onclick="filterBranches('pending')">Pendientes (${needsValidation.length})</button>
            <button class="filter-btn" onclick="filterBranches('validated')">Validadas (${validated.length})</button>
            <button class="filter-btn" onclick="filterBranches('new')">Nuevas (3)</button>
            <input type="text" class="search-box" placeholder="Buscar por nombre, ciudad o ID..." id="search-input" onkeyup="searchBranches()">
        </div>
        
        <div class="status-message hidden" id="status-message"></div>
        
        <div class="branches-grid" id="branches-container">
            ${allBranches.rows.map(branch => {
              const isValidated = branch.gps_validated && branch.latitude !== 0 && branch.longitude !== 0;
              const isNew = [83, 84, 85].includes(branch.id);
              const cardClass = isNew ? 'new' : (isValidated ? 'validated' : 'pending');
              
              return `
                <div class="branch-card ${cardClass}" data-filter="${cardClass}" data-search="${branch.name.toLowerCase()} ${branch.city.toLowerCase()} ${branch.id}">
                    <div class="branch-header">
                        <span class="branch-number">#${branch.id}</span>
                        ${isNew ? '<span class="new-badge">NUEVA</span>' : ''}
                    </div>
                    <div class="branch-name">${branch.name}</div>
                    <div class="branch-location">📍 ${branch.city}, ${branch.state}</div>
                    <div class="branch-location">🏠 ${(branch.address || '').substring(0, 40)}${(branch.address || '').length > 40 ? '...' : ''}</div>
                    
                    <div class="branch-coords ${isValidated ? 'coords-valid' : 'coords-missing'}">
                        ${isValidated ? 
                          `📍 ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}` : 
                          '❌ SIN COORDENADAS VÁLIDAS'
                        }
                    </div>
                    
                    <div class="actions">
                        <a href="https://maps.google.com/maps?q=${encodeURIComponent(branch.address + ', ' + branch.city + ', ' + branch.state + ', México')}" 
                           target="_blank" class="btn btn-maps">📍 Maps</a>
                        <button class="btn btn-edit" onclick="editCoordinates(${branch.id}, '${branch.name}', ${branch.latitude || 0}, ${branch.longitude || 0})">✏️ Edit</button>
                        ${!isValidated ? `<button class="btn btn-validate" onclick="markAsValidated(${branch.id})">✅ Validar</button>` : ''}
                    </div>
                </div>
              `;
            }).join('')}
        </div>
    </div>
    
    <!-- Modal para editar coordenadas -->
    <div class="edit-modal" id="edit-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>✏️ Editar Coordenadas</h3>
                <p><strong id="modal-branch-name"></strong></p>
            </div>
            <div class="form-group">
                <label>Latitud:</label>
                <input type="number" id="input-latitude" step="0.000001" placeholder="25.123456">
            </div>
            <div class="form-group">
                <label>Longitud:</label>
                <input type="number" id="input-longitude" step="0.000001" placeholder="-100.123456">
            </div>
            <div class="modal-actions">
                <button class="btn btn-save" onclick="saveCoordinates()">💾 Guardar</button>
                <button class="btn btn-cancel" onclick="closeModal()">❌ Cancelar</button>
            </div>
        </div>
    </div>

    <script>
        let currentBranchId = null;
        
        // Filtrar sucursales
        function filterBranches(filter) {
            const cards = document.querySelectorAll('.branch-card');
            const buttons = document.querySelectorAll('.filter-btn');
            
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            cards.forEach(card => {
                if (filter === 'all' || card.dataset.filter === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
        
        // Buscar sucursales
        function searchBranches() {
            const query = document.getElementById('search-input').value.toLowerCase();
            const cards = document.querySelectorAll('.branch-card');
            
            cards.forEach(card => {
                if (card.dataset.search.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
        
        // Editar coordenadas
        function editCoordinates(branchId, branchName, lat, lng) {
            currentBranchId = branchId;
            document.getElementById('modal-branch-name').textContent = branchName;
            document.getElementById('input-latitude').value = lat !== 0 ? lat : '';
            document.getElementById('input-longitude').value = lng !== 0 ? lng : '';
            document.getElementById('edit-modal').style.display = 'flex';
        }
        
        // Cerrar modal
        function closeModal() {
            document.getElementById('edit-modal').style.display = 'none';
        }
        
        // Guardar coordenadas
        async function saveCoordinates() {
            const lat = parseFloat(document.getElementById('input-latitude').value);
            const lng = parseFloat(document.getElementById('input-longitude').value);
            
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                showMessage('Por favor ingresa coordenadas válidas', 'error');
                return;
            }
            
            // Validar que están en México
            if (lat < 14.5 || lat > 32.7 || lng < -118.5 || lng > -86.7) {
                showMessage('Las coordenadas deben estar dentro de México', 'error');
                return;
            }
            
            try {
                const response = await fetch('/api/branch-validation/update-coordinates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        branchId: currentBranchId, 
                        latitude: lat, 
                        longitude: lng 
                    })
                });
                
                if (response.ok) {
                    showMessage('✅ Coordenadas actualizadas exitosamente', 'success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showMessage('❌ Error actualizando coordenadas', 'error');
                }
            } catch (error) {
                showMessage('❌ Error de conexión', 'error');
            }
            
            closeModal();
        }
        
        // Marcar como validado
        async function markAsValidated(branchId) {
            try {
                const response = await fetch('/api/branch-validation/update-coordinates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        branchId: branchId, 
                        latitude: 0, 
                        longitude: 0,
                        forceValidation: true
                    })
                });
                
                if (response.ok) {
                    showMessage('✅ Sucursal marcada como validada', 'success');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    showMessage('❌ Error validando sucursal', 'error');
                }
            } catch (error) {
                showMessage('❌ Error de conexión', 'error');
            }
        }
        
        // Mostrar mensajes
        function showMessage(text, type) {
            const messageEl = document.getElementById('status-message');
            messageEl.textContent = text;
            messageEl.className = 'status-message status-' + type;
            messageEl.classList.remove('hidden');
            
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 3000);
        }
    </script>
</body>
</html>`;
    
    // 4. Guardar la interfaz
    await fs.writeFile('./validador-completo.html', htmlContent);
    console.log('✅ Interfaz creada: validador-completo.html');
    
    // 5. También actualizar las rutas de API para manejar validación forzada
    const updatedAPIContent = `const express = require('express');
const router = express.Router();
const db = require('../../config/database');

// Actualizar coordenadas de una sucursal
router.post('/update-coordinates', async (req, res) => {
  try {
    const { branchId, latitude, longitude, forceValidation = false } = req.body;
    
    if (forceValidation) {
      // Solo marcar como validado sin cambiar coordenadas
      await db.query(\`
        UPDATE branches 
        SET gps_validated = true, updated_at = NOW()
        WHERE id = $1
      \`, [branchId]);
    } else {
      // Actualizar coordenadas y marcar como validado
      await db.query(\`
        UPDATE branches 
        SET latitude = $1, longitude = $2, gps_validated = true, updated_at = NOW()
        WHERE id = $3
      \`, [latitude, longitude, branchId]);
    }
    
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

// Obtener todas las sucursales con detalles
router.get('/all', async (req, res) => {
  try {
    const branches = await db.query(\`
      SELECT 
        id, branch_number, name, city, state, municipality, address,
        latitude, longitude, phone, email, zenput_id,
        gps_validated, active, region, created_at, updated_at
      FROM branches 
      WHERE active = true
      ORDER BY id
    \`);
    
    res.json({ success: true, branches: branches.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir la interfaz HTML directamente
router.get('/interface', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const htmlPath = path.join(__dirname, '../../../validador-completo.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Interface not available', details: error.message });
  }
});

module.exports = router;`;

    await fs.writeFile('./src/api/routes/branch-validation.routes.js', updatedAPIContent);
    console.log('✅ API actualizada con soporte para validación completa');
    
    // 6. Estadísticas finales
    console.log('\n📊 ESTADÍSTICAS FINALES:');
    console.log('━'.repeat(50));
    console.log(`📊 Total sucursales: ${allBranches.rows.length}`);
    console.log(`✅ Validadas: ${validated.length}`);
    console.log(`⚠️ Pendientes: ${needsValidation.length}`);
    console.log(`🆕 Nuevas agregadas: 3 (IDs: 83, 84, 85)`);
    
    if (needsValidation.length > 0) {
      console.log('\n⚠️ SUCURSALES PENDIENTES DE VALIDAR:');
      needsValidation.forEach((branch, i) => {
        console.log(`  ${i + 1}. ID ${branch.id} - ${branch.name} (${branch.city})`);
      });
    }
    
    console.log('\n🚀 VALIDADOR COMPLETO CREADO:');
    console.log('━'.repeat(50));
    console.log('✅ Archivo local: validador-completo.html');
    console.log('✅ API actualizada con validación completa');
    console.log('✅ Interface funcional para todas las sucursales');
    console.log('✅ Filtros por estado (todas, pendientes, validadas, nuevas)');
    console.log('✅ Búsqueda en tiempo real');
    console.log('✅ Enlaces directos a Google Maps');
    console.log('✅ Edición de coordenadas en tiempo real');
    console.log('✅ Validación de rangos de México');
    
    return {
      success: true,
      total: allBranches.rows.length,
      validated: validated.length,
      pending: needsValidation.length,
      interfaceFile: 'validador-completo.html'
    };
    
  } catch (error) {
    console.error('❌ Error creando validador:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar
async function main() {
  const result = await createSimpleValidator();
  
  if (result.success) {
    console.log('\n🎉 ¡VALIDADOR COMPLETO LISTO!');
    console.log('\n📋 INSTRUCCIONES DE USO:');
    console.log('1. 🌐 Sube el archivo validador-completo.html a tu servidor');
    console.log('2. 📱 Abre en navegador para validar las 85 sucursales');
    console.log('3. 🔍 Usa filtros para organizar tu trabajo');
    console.log('4. 📍 Click en "Maps" para buscar coordenadas');
    console.log('5. ✏️ Click en "Edit" para actualizar coordenadas');
    console.log('6. ✅ Click en "Validar" para marcar como verificadas');
  } else {
    console.log('\n❌ Error:', result.error);
  }
  
  process.exit(0);
}

main();