require('dotenv').config();
const db = require('./src/config/database');
const fs = require('fs').promises;

/**
 * VALIDADOR DE COORDENADAS EXISTENTES
 * Verifica todas las 82 sucursales ya validadas para asegurar que sus coordenadas sean correctas
 */

async function validateAllExistingCoordinates() {
  console.log('🔍 VALIDANDO COORDENADAS EXISTENTES DE 82 SUCURSALES\n');
  
  try {
    // 1. Obtener todas las sucursales con coordenadas existentes
    const allBranches = await db.query(`
      SELECT 
        id, branch_number, name, city, state, municipality, address,
        latitude, longitude, phone, email, zenput_id,
        gps_validated, active, region, created_at
      FROM branches 
      WHERE active = true 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != 0 
        AND longitude != 0
      ORDER BY id
    `);
    
    console.log(`📊 Total sucursales con coordenadas: ${allBranches.rows.length}`);
    
    // 2. Analizar las coordenadas
    const issues = [];
    const validCoords = [];
    const suspiciousCoords = [];
    
    allBranches.rows.forEach(branch => {
      const lat = parseFloat(branch.latitude);
      const lng = parseFloat(branch.longitude);
      
      // Verificar si están en México
      const inMexico = lat >= 14.5 && lat <= 32.7 && lng >= -118.5 && lng <= -86.7;
      
      // Verificar coordenadas sospechosas (demasiado genéricas)
      const suspicious = (
        lat === 25.0 || lng === -100.0 || // Coordenadas muy redondas
        Math.abs(lat % 1) < 0.001 || Math.abs(lng % 1) < 0.001 || // Muy pocas decimales
        (lat > 0 && lng > 0) // Coordenadas positivas (no están en América)
      );
      
      const branchData = {
        ...branch,
        lat,
        lng,
        inMexico,
        suspicious,
        googleMapsLink: `https://maps.google.com/?q=${lat},${lng}`,
        reverseGoogleLink: `https://maps.google.com/maps?q=${encodeURIComponent(branch.address + ', ' + branch.city + ', ' + branch.state + ', México')}`
      };
      
      if (!inMexico || suspicious) {
        issues.push(branchData);
      } else if (suspicious) {
        suspiciousCoords.push(branchData);
      } else {
        validCoords.push(branchData);
      }
    });
    
    // 3. Crear reporte detallado
    console.log('📋 ANÁLISIS DE COORDENADAS:');
    console.log('━'.repeat(70));
    console.log(`✅ Coordenadas válidas: ${validCoords.length}`);
    console.log(`⚠️ Coordenadas sospechosas: ${suspiciousCoords.length}`);
    console.log(`❌ Coordenadas con problemas: ${issues.length}`);
    
    // 4. Mostrar problemas encontrados
    if (issues.length > 0) {
      console.log('\n❌ COORDENADAS CON PROBLEMAS:');
      console.log('━'.repeat(70));
      issues.forEach((branch, i) => {
        console.log(`${i + 1}. ID ${branch.id} - ${branch.name}`);
        console.log(`   📍 Coordenadas: ${branch.lat}, ${branch.lng}`);
        console.log(`   🏠 Dirección: ${branch.address}`);
        console.log(`   🏙️ ${branch.city}, ${branch.state}`);
        console.log(`   🗺️ Ver en Maps: ${branch.googleMapsLink}`);
        console.log(`   🔍 Buscar dirección: ${branch.reverseGoogleLink}`);
        
        if (!branch.inMexico) {
          console.log(`   ⚠️ FUERA DE MÉXICO`);
        }
        if (branch.suspicious) {
          console.log(`   ⚠️ COORDENADAS SOSPECHOSAS (muy redondas o genéricas)`);
        }
        console.log('');
      });
    }
    
    // 5. Crear interfaz de verificación masiva
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificador de Coordenadas EPL CAS - 85 Sucursales</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f5f6fa; 
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header { 
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
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
        .stat.valid h3 { color: #27ae60; }
        .stat.suspicious h3 { color: #f39c12; }
        .stat.issues h3 { color: #e74c3c; }
        
        .instructions {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
        
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
        
        .verification-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
            gap: 15px;
        }
        
        .branch-card {
            background: white;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #ddd;
            position: relative;
        }
        .branch-card.valid { border-left-color: #27ae60; }
        .branch-card.suspicious { border-left-color: #f39c12; background: #fffbf0; }
        .branch-card.issues { border-left-color: #e74c3c; background: #fff5f5; }
        
        .branch-header {
            display: flex;
            justify-content: space-between;
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
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        }
        .status-badge.valid { background: #d4edda; color: #155724; }
        .status-badge.suspicious { background: #fff3cd; color: #856404; }
        .status-badge.issues { background: #f8d7da; color: #721c24; }
        
        .branch-name { font-weight: bold; color: #2c3e50; margin-bottom: 8px; font-size: 16px; }
        .branch-location { color: #666; font-size: 14px; margin-bottom: 8px; }
        .branch-address { 
            color: #666; 
            font-size: 13px; 
            margin-bottom: 10px;
            background: #f8f9fa;
            padding: 8px;
            border-radius: 4px;
            line-height: 1.4;
        }
        
        .coordinates-section {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin: 10px 0;
        }
        .coordinates-display {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            color: #2c3e50;
            margin-bottom: 8px;
            font-weight: bold;
        }
        .coordinates-input {
            display: none;
            margin-top: 8px;
        }
        .coordinates-input.editing { display: block; }
        .coord-input {
            width: 100%;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
            margin-bottom: 5px;
        }
        
        .validation-issues {
            background: #ffebee;
            color: #c62828;
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
            font-size: 12px;
            border-left: 3px solid #e74c3c;
        }
        
        .actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            margin-top: 12px;
        }
        .btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
            text-align: center;
            transition: all 0.2s;
        }
        .btn-view { background: #4285f4; color: white; }
        .btn-search { background: #17a2b8; color: white; }
        .btn-edit { background: #28a745; color: white; }
        .btn-save { background: #dc3545; color: white; }
        .btn-cancel { background: #6c757d; color: white; }
        .btn:hover { opacity: 0.8; transform: translateY(-1px); }
        
        .status-message {
            padding: 12px;
            border-radius: 6px;
            margin: 10px 0;
            text-align: center;
            font-weight: bold;
        }
        .status-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .hidden { display: none; }
        
        .bulk-actions {
            background: white;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
        }
        .bulk-actions h3 { margin-bottom: 15px; color: #2c3e50; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Verificador de Coordenadas EPL CAS</h1>
            <p>Validación completa de coordenadas GPS para todas las sucursales</p>
        </div>
        
        <div class="stats">
            <div class="stat valid">
                <h3 id="valid-count">${validCoords.length}</h3>
                <p>Coordenadas Válidas</p>
            </div>
            <div class="stat suspicious">
                <h3 id="suspicious-count">${suspiciousCoords.length}</h3>
                <p>Coordenadas Sospechosas</p>
            </div>
            <div class="stat issues">
                <h3 id="issues-count">${issues.length}</h3>
                <p>Requieren Atención</p>
            </div>
        </div>
        
        <div class="instructions">
            <h3>📋 Instrucciones para Verificar Coordenadas:</h3>
            <ol style="margin-left: 20px; margin-top: 10px; line-height: 1.6;">
                <li><strong>Ver en Maps:</strong> Haz clic para ver si las coordenadas apuntan al lugar correcto</li>
                <li><strong>Buscar Dirección:</strong> Haz clic para buscar la dirección real en Google Maps</li>
                <li><strong>Comparar:</strong> Verifica si las coordenadas coinciden con la dirección real</li>
                <li><strong>Editar:</strong> Si no coinciden, usa "Editar" para corregir las coordenadas</li>
                <li><strong>Prioridad:</strong> Comienza con las marcadas en <span style="color: #e74c3c;">rojo</span> (requieren atención inmediata)</li>
            </ol>
        </div>
        
        <div class="filters">
            <button class="filter-btn active" onclick="filterBranches('all')">Todas (${allBranches.rows.length})</button>
            <button class="filter-btn" onclick="filterBranches('issues')">Requieren Atención (${issues.length})</button>
            <button class="filter-btn" onclick="filterBranches('suspicious')">Sospechosas (${suspiciousCoords.length})</button>
            <button class="filter-btn" onclick="filterBranches('valid')">Válidas (${validCoords.length})</button>
            <input type="text" class="search-box" placeholder="Buscar por nombre, ciudad o ID..." id="search-input" onkeyup="searchBranches()">
        </div>
        
        <div class="status-message hidden" id="status-message"></div>
        
        <div class="verification-grid" id="branches-container">
            ${allBranches.rows.map(branch => {
              const lat = parseFloat(branch.latitude);
              const lng = parseFloat(branch.longitude);
              const inMexico = lat >= 14.5 && lat <= 32.7 && lng >= -118.5 && lng <= -86.7;
              const suspicious = (lat === 25.0 || lng === -100.0 || Math.abs(lat % 1) < 0.001 || Math.abs(lng % 1) < 0.001 || (lat > 0 && lng > 0));
              
              let cardClass = 'valid';
              let statusText = 'VÁLIDA';
              let statusClass = 'valid';
              const issuesList = [];
              
              if (!inMexico) {
                cardClass = 'issues';
                statusText = 'FUERA DE MÉXICO';
                statusClass = 'issues';
                issuesList.push('Coordenadas fuera del territorio mexicano');
              }
              if (suspicious) {
                cardClass = cardClass === 'issues' ? 'issues' : 'suspicious';
                statusText = cardClass === 'issues' ? 'MÚLTIPLES PROBLEMAS' : 'SOSPECHOSA';
                statusClass = cardClass;
                issuesList.push('Coordenadas muy redondas o genéricas');
              }
              if (lat > 0 && lng > 0) {
                issuesList.push('Coordenadas positivas (no están en América)');
              }
              
              const googleMapsView = `https://maps.google.com/?q=${lat},${lng}`;
              const googleMapsSearch = `https://maps.google.com/maps?q=${encodeURIComponent(branch.address + ', ' + branch.city + ', ' + branch.state + ', México')}`;
              
              return `
                <div class="branch-card ${cardClass}" data-filter="${cardClass}" data-search="${branch.name.toLowerCase()} ${branch.city.toLowerCase()} ${branch.id}">
                    <div class="branch-header">
                        <span class="branch-number">#${branch.id}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="branch-name">${branch.name}</div>
                    <div class="branch-location">📍 ${branch.city}, ${branch.state}</div>
                    <div class="branch-address">🏠 ${branch.address || 'Sin dirección'}</div>
                    
                    <div class="coordinates-section">
                        <div class="coordinates-display" id="coords-display-${branch.id}">
                            📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}
                        </div>
                        <div class="coordinates-input" id="coords-input-${branch.id}">
                            <input type="number" class="coord-input" id="lat-${branch.id}" step="0.000001" placeholder="Latitud" value="${lat}">
                            <input type="number" class="coord-input" id="lng-${branch.id}" step="0.000001" placeholder="Longitud" value="${lng}">
                        </div>
                    </div>
                    
                    ${issuesList.length > 0 ? `
                        <div class="validation-issues">
                            <strong>⚠️ Problemas detectados:</strong>
                            <ul style="margin-left: 15px; margin-top: 5px;">
                                ${issuesList.map(issue => `<li>${issue}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="actions">
                        <a href="${googleMapsView}" target="_blank" class="btn btn-view">🗺️ Ver en Maps</a>
                        <a href="${googleMapsSearch}" target="_blank" class="btn btn-search">🔍 Buscar Dirección</a>
                        <button class="btn btn-edit" onclick="toggleEdit(${branch.id})">✏️ Editar</button>
                        <button class="btn btn-save hidden" id="save-${branch.id}" onclick="saveCoordinates(${branch.id})">💾 Guardar</button>
                        <button class="btn btn-cancel hidden" id="cancel-${branch.id}" onclick="cancelEdit(${branch.id})">❌ Cancelar</button>
                    </div>
                </div>
              `;
            }).join('')}
        </div>
        
        <div class="bulk-actions">
            <h3>🚀 Acciones Masivas</h3>
            <button class="btn btn-search" onclick="openAllProblematic()" style="margin: 5px; padding: 10px 20px;">
                🗺️ Abrir todas las problemáticas en Google Maps
            </button>
            <button class="btn btn-view" onclick="exportProblematicList()" style="margin: 5px; padding: 10px 20px;">
                📋 Exportar lista de coordenadas problemáticas
            </button>
        </div>
    </div>

    <script>
        let editingBranch = null;
        
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
        
        // Toggle edit mode
        function toggleEdit(branchId) {
            if (editingBranch && editingBranch !== branchId) {
                cancelEdit(editingBranch);
            }
            
            editingBranch = branchId;
            
            document.getElementById('coords-display-' + branchId).style.display = 'none';
            document.getElementById('coords-input-' + branchId).classList.add('editing');
            document.getElementById('save-' + branchId).classList.remove('hidden');
            document.getElementById('cancel-' + branchId).classList.remove('hidden');
        }
        
        // Cancel edit
        function cancelEdit(branchId) {
            document.getElementById('coords-display-' + branchId).style.display = 'block';
            document.getElementById('coords-input-' + branchId).classList.remove('editing');
            document.getElementById('save-' + branchId).classList.add('hidden');
            document.getElementById('cancel-' + branchId).classList.add('hidden');
            editingBranch = null;
        }
        
        // Save coordinates
        async function saveCoordinates(branchId) {
            const lat = parseFloat(document.getElementById('lat-' + branchId).value);
            const lng = parseFloat(document.getElementById('lng-' + branchId).value);
            
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                showMessage('Por favor ingresa coordenadas válidas', 'error');
                return;
            }
            
            // Validar que están en México
            if (lat < 14.5 || lat > 32.7 || lng < -118.5 || lng > -86.7) {
                if (!confirm('Las coordenadas parecen estar fuera de México. ¿Continuar?')) {
                    return;
                }
            }
            
            try {
                const response = await fetch('/api/branch-validation/update-coordinates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        branchId: branchId, 
                        latitude: lat, 
                        longitude: lng 
                    })
                });
                
                if (response.ok) {
                    showMessage('✅ Coordenadas actualizadas exitosamente', 'success');
                    // Actualizar la vista
                    document.getElementById('coords-display-' + branchId).textContent = 
                        '📍 ' + lat.toFixed(6) + ', ' + lng.toFixed(6);
                    cancelEdit(branchId);
                } else {
                    showMessage('❌ Error actualizando coordenadas', 'error');
                }
            } catch (error) {
                showMessage('❌ Error de conexión', 'error');
            }
        }
        
        // Show message
        function showMessage(text, type) {
            const messageEl = document.getElementById('status-message');
            messageEl.textContent = text;
            messageEl.className = 'status-message status-' + type;
            messageEl.classList.remove('hidden');
            
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 3000);
        }
        
        // Open all problematic coordinates in Google Maps
        function openAllProblematic() {
            const problematicCards = document.querySelectorAll('.branch-card.issues, .branch-card.suspicious');
            
            if (problematicCards.length === 0) {
                alert('¡No hay coordenadas problemáticas!');
                return;
            }
            
            if (problematicCards.length > 10) {
                if (!confirm(\`Esto abrirá \${problematicCards.length} pestañas. ¿Continuar?\`)) {
                    return;
                }
            }
            
            problematicCards.forEach((card, index) => {
                setTimeout(() => {
                    const viewLink = card.querySelector('.btn-view');
                    if (viewLink) {
                        window.open(viewLink.href, '_blank');
                    }
                }, index * 1000); // Abrir cada segundo para no saturar el navegador
            });
        }
        
        // Export problematic list
        function exportProblematicList() {
            const problematicCards = document.querySelectorAll('.branch-card.issues, .branch-card.suspicious');
            
            if (problematicCards.length === 0) {
                alert('¡No hay coordenadas problemáticas!');
                return;
            }
            
            let report = 'REPORTE DE COORDENADAS PROBLEMÁTICAS EPL CAS\\n';
            report += '='.repeat(60) + '\\n\\n';
            
            problematicCards.forEach((card, index) => {
                const name = card.querySelector('.branch-name').textContent;
                const location = card.querySelector('.branch-location').textContent;
                const coords = card.querySelector('.coordinates-display').textContent;
                const status = card.querySelector('.status-badge').textContent;
                
                report += \`\${index + 1}. \${name}\\n\`;
                report += \`   \${location}\\n\`;
                report += \`   \${coords}\\n\`;
                report += \`   Estado: \${status}\\n\\n\`;
            });
            
            // Crear y descargar archivo
            const blob = new Blob([report], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coordenadas-problematicas-epl-cas.txt';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    </script>
</body>
</html>`;

    // 6. Guardar el verificador
    await fs.writeFile('./verificador-coordenadas.html', htmlContent);
    console.log('✅ Verificador de coordenadas creado: verificador-coordenadas.html');
    
    return {
      success: true,
      total: allBranches.rows.length,
      valid: validCoords.length,
      suspicious: suspiciousCoords.length,
      issues: issues.length,
      problematicBranches: issues,
      suspiciousCoords: suspiciousCoords
    };
    
  } catch (error) {
    console.error('❌ Error validando coordenadas:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await validateAllExistingCoordinates();
  
  if (result.success) {
    console.log('\n🎉 ANÁLISIS DE COORDENADAS COMPLETADO');
    console.log('━'.repeat(70));
    console.log(`📊 Total analizado: ${result.total} sucursales`);
    console.log(`✅ Válidas: ${result.valid}`);
    console.log(`⚠️ Sospechosas: ${result.suspicious}`);
    console.log(`❌ Con problemas: ${result.issues}`);
    console.log('\n📱 Archivo creado: verificador-coordenadas.html');
    console.log('\n🔍 PRÓXIMOS PASOS:');
    console.log('1. Abrir verificador-coordenadas.html en tu navegador');
    console.log('2. Revisar las coordenadas marcadas en ROJO primero');
    console.log('3. Usar "Ver en Maps" para verificar ubicación actual');
    console.log('4. Usar "Buscar Dirección" para encontrar coordenadas correctas');
    console.log('5. Usar "Editar" para corregir coordenadas incorrectas');
    
    if (result.issues > 0) {
      console.log('\n⚠️ ATENCIÓN: Hay coordenadas que requieren corrección inmediata');
    }
    
  } else {
    console.log('\n❌ Error:', result.error);
  }
  
  process.exit(0);
}

main();