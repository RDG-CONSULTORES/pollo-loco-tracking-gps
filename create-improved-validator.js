require('dotenv').config();
const db = require('./src/config/database');
const fs = require('fs').promises;

/**
 * VALIDADOR MEJORADO CON GOOGLE PLACES Y PEGADO DIRECTO
 * Acepta coordenadas en formato "25.682125013659245, -100.29952346140905"
 * Sistema más eficiente para validar todas las sucursales
 */

async function createImprovedValidator() {
  console.log('🚀 CREANDO VALIDADOR MEJORADO CON PEGADO DIRECTO\n');
  
  try {
    // Obtener todas las sucursales
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
    
    // Crear interfaz mejorada
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validador EPL CAS - Pegado Directo de Coordenadas</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f8f9fa; 
            padding: 15px;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        
        .header { 
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white; 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
        }
        
        .instructions {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid #007bff;
        }
        .instructions h3 { color: #007bff; margin-bottom: 15px; }
        .step { 
            margin: 10px 0; 
            padding: 8px 12px; 
            background: #f8f9fa; 
            border-radius: 6px; 
            border-left: 3px solid #28a745; 
        }
        
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
            gap: 15px; 
            margin-bottom: 20px; 
        }
        .stat { 
            background: white; 
            padding: 15px; 
            border-radius: 10px; 
            text-align: center; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat h3 { font-size: 28px; margin-bottom: 5px; color: #495057; }
        .stat.validated h3 { color: #28a745; }
        .stat.pending h3 { color: #dc3545; }
        .stat.total h3 { color: #007bff; }
        
        .search-controls {
            background: white;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .search-box {
            flex: 1;
            min-width: 250px;
            padding: 10px 15px;
            border: 1px solid #ced4da;
            border-radius: 8px;
            font-size: 14px;
        }
        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #ced4da;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
        }
        .filter-btn.active { background: #007bff; color: white; border-color: #007bff; }
        
        .branches-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
            gap: 20px;
        }
        
        .branch-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border-left: 5px solid #28a745;
            transition: all 0.3s ease;
            position: relative;
        }
        .branch-card:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(0,0,0,0.15); 
        }
        .branch-card.pending { border-left-color: #dc3545; }
        .branch-card.new { border-left-color: #ffc107; background: linear-gradient(135deg, #fff9e6 0%, #ffffff 100%); }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .branch-id { 
            background: #007bff; 
            color: white; 
            padding: 6px 12px; 
            border-radius: 20px; 
            font-size: 13px; 
            font-weight: bold;
        }
        .status-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        .status-badge.validated { background: #d4edda; color: #155724; }
        .status-badge.pending { background: #f8d7da; color: #721c24; }
        .status-badge.new { background: #fff3cd; color: #856404; }
        
        .branch-name { 
            font-size: 18px; 
            font-weight: bold; 
            color: #212529; 
            margin-bottom: 8px; 
            line-height: 1.3;
        }
        .branch-location { 
            color: #6c757d; 
            font-size: 14px; 
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .branch-address { 
            background: #f8f9fa; 
            padding: 12px; 
            border-radius: 8px; 
            font-size: 13px; 
            color: #495057;
            margin-bottom: 15px;
            border-left: 3px solid #dee2e6;
        }
        
        .coordinates-section {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
        }
        .current-coords {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 13px;
            color: #495057;
            margin-bottom: 10px;
            padding: 8px;
            background: white;
            border-radius: 6px;
            border: 1px solid #dee2e6;
        }
        .coords-input-section {
            display: none;
        }
        .coords-input-section.active { display: block; }
        
        .paste-input {
            width: 100%;
            padding: 12px;
            border: 2px solid #28a745;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            margin-bottom: 10px;
            transition: border-color 0.3s;
        }
        .paste-input:focus {
            outline: none;
            border-color: #20c997;
            box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
        }
        .paste-input::placeholder {
            color: #6c757d;
        }
        
        .help-text {
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 10px;
            background: #e7f3ff;
            padding: 8px;
            border-radius: 6px;
        }
        
        .actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 8px;
        }
        .btn {
            padding: 10px 12px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
            text-align: center;
            transition: all 0.2s;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }
        .btn-maps { background: #4285f4; color: white; }
        .btn-search { background: #34a853; color: white; }
        .btn-edit { background: #fbbc04; color: #333; }
        .btn-save { background: #ea4335; color: white; }
        .btn-cancel { background: #9aa0a6; color: white; }
        .btn:hover { 
            opacity: 0.9; 
            transform: translateY(-1px); 
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .edit-mode .actions .btn-edit,
        .edit-mode .actions .btn-maps,
        .edit-mode .actions .btn-search { display: none; }
        .actions .btn-save,
        .actions .btn-cancel { display: none; }
        .edit-mode .actions .btn-save,
        .edit-mode .actions .btn-cancel { display: flex; }
        
        .status-message {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .status-success { 
            background: #d4edda; 
            color: #155724; 
            border: 1px solid #c3e6cb; 
        }
        .status-error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 1px solid #f5c6cb; 
        }
        .hidden { display: none; }
        
        .progress-bar {
            background: #e9ecef;
            border-radius: 10px;
            height: 8px;
            margin: 15px 0;
            overflow: hidden;
        }
        .progress-fill {
            background: linear-gradient(90deg, #28a745, #20c997);
            height: 100%;
            transition: width 0.3s ease;
            border-radius: 10px;
        }
        
        @media (max-width: 768px) {
            .branches-grid { grid-template-columns: 1fr; }
            .search-controls { flex-direction: column; align-items: stretch; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Validador EPL CAS - Pegado Directo</h1>
            <p>Sistema optimizado para validación rápida de coordenadas</p>
        </div>
        
        <div class="instructions">
            <h3>📋 Instrucciones Super Rápidas:</h3>
            <div class="step"><strong>1.</strong> Haz clic en "🗺️ Ver" para verificar si la ubicación es correcta</div>
            <div class="step"><strong>2.</strong> Si está mal, haz clic en "🔍 Buscar" para encontrar la dirección real</div>
            <div class="step"><strong>3.</strong> Copia las coordenadas de Google Maps (formato: 25.123456, -100.123456)</div>
            <div class="step"><strong>4.</strong> Haz clic en "✏️ Editar" y pega las coordenadas completas</div>
            <div class="step"><strong>5.</strong> Haz clic en "💾 Guardar" ¡y listo!</div>
        </div>
        
        <div class="stats">
            <div class="stat total">
                <h3 id="total-count">${allBranches.rows.length}</h3>
                <p>Total Sucursales</p>
            </div>
            <div class="stat validated">
                <h3 id="validated-count">0</h3>
                <p>Validadas</p>
            </div>
            <div class="stat pending">
                <h3 id="pending-count">0</h3>
                <p>Pendientes</p>
            </div>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
        </div>
        
        <div class="search-controls">
            <input type="text" class="search-box" placeholder="🔍 Buscar por nombre, ciudad o ID..." id="search-input" onkeyup="searchBranches()">
            <button class="filter-btn active" onclick="filterBranches('all')">📊 Todas</button>
            <button class="filter-btn" onclick="filterBranches('pending')">⚠️ Pendientes</button>
            <button class="filter-btn" onclick="filterBranches('validated')">✅ Validadas</button>
        </div>
        
        <div class="status-message hidden" id="status-message"></div>
        
        <div class="branches-grid" id="branches-container">
            ${allBranches.rows.map(branch => {
              const isValidated = branch.gps_validated && branch.latitude && branch.longitude && branch.latitude !== 0 && branch.longitude !== 0;
              const cardClass = isValidated ? 'validated' : 'pending';
              const statusText = isValidated ? 'VALIDADA' : 'PENDIENTE';
              const statusClass = isValidated ? 'validated' : 'pending';
              
              const googleMapsView = branch.latitude && branch.longitude ? 
                `https://maps.google.com/?q=${branch.latitude},${branch.longitude}` : '#';
              const googleMapsSearch = `https://maps.google.com/maps?q=${encodeURIComponent(branch.address + ', ' + branch.city + ', ' + branch.state + ', México')}`;
              
              return `
                <div class="branch-card ${cardClass}" data-filter="${cardClass}" data-search="${branch.name.toLowerCase()} ${branch.city.toLowerCase()} ${branch.id}" data-id="${branch.id}">
                    <div class="card-header">
                        <span class="branch-id">#${branch.id}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    
                    <div class="branch-name">${branch.name}</div>
                    <div class="branch-location">📍 ${branch.city}, ${branch.state}</div>
                    <div class="branch-address">🏠 ${branch.address || 'Sin dirección'}</div>
                    
                    <div class="coordinates-section">
                        <div class="current-coords" id="coords-display-${branch.id}">
                            ${branch.latitude && branch.longitude && branch.latitude !== 0 ? 
                              `📍 ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)}` : 
                              '❌ Sin coordenadas válidas'
                            }
                        </div>
                        
                        <div class="coords-input-section" id="coords-input-${branch.id}">
                            <div class="help-text">
                                💡 <strong>Pega las coordenadas completas de Google Maps:</strong><br>
                                Ejemplo: 25.682125013659245, -100.29952346140905
                            </div>
                            <input type="text" 
                                   class="paste-input" 
                                   id="paste-coords-${branch.id}" 
                                   placeholder="25.682125013659245, -100.29952346140905"
                                   title="Pega aquí las coordenadas completas de Google Maps">
                        </div>
                    </div>
                    
                    <div class="actions">
                        <a href="${googleMapsView}" target="_blank" class="btn btn-maps">🗺️ Ver</a>
                        <a href="${googleMapsSearch}" target="_blank" class="btn btn-search">🔍 Buscar</a>
                        <button class="btn btn-edit" onclick="enterEditMode(${branch.id})">✏️ Editar</button>
                        <button class="btn btn-save" onclick="saveCoordinates(${branch.id})">💾 Guardar</button>
                        <button class="btn btn-cancel" onclick="exitEditMode(${branch.id})">❌ Cancelar</button>
                    </div>
                </div>
              `;
            }).join('')}
        </div>
    </div>

    <script>
        let editingBranch = null;
        
        // Inicializar estadísticas
        updateStats();
        
        function updateStats() {
            const cards = document.querySelectorAll('.branch-card');
            const validated = document.querySelectorAll('.branch-card.validated').length;
            const pending = cards.length - validated;
            const progress = (validated / cards.length) * 100;
            
            document.getElementById('validated-count').textContent = validated;
            document.getElementById('pending-count').textContent = pending;
            document.getElementById('progress-fill').style.width = progress + '%';
        }
        
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
        
        // Entrar en modo edición
        function enterEditMode(branchId) {
            // Salir del modo edición anterior si existe
            if (editingBranch && editingBranch !== branchId) {
                exitEditMode(editingBranch);
            }
            
            editingBranch = branchId;
            const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
            card.classList.add('edit-mode');
            
            document.getElementById('coords-input-' + branchId).classList.add('active');
            document.getElementById('paste-coords-' + branchId).focus();
        }
        
        // Salir del modo edición
        function exitEditMode(branchId) {
            const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
            card.classList.remove('edit-mode');
            
            document.getElementById('coords-input-' + branchId).classList.remove('active');
            document.getElementById('paste-coords-' + branchId).value = '';
            editingBranch = null;
        }
        
        // Guardar coordenadas
        async function saveCoordinates(branchId) {
            const pastedValue = document.getElementById('paste-coords-' + branchId).value.trim();
            
            if (!pastedValue) {
                showMessage('Por favor pega las coordenadas', 'error');
                return;
            }
            
            // Parsear coordenadas del formato pegado
            const coords = parseCoordinates(pastedValue);
            if (!coords) {
                showMessage('Formato de coordenadas inválido', 'error');
                return;
            }
            
            const { lat, lng } = coords;
            
            // Validar rangos de México
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
                    
                    // Cambiar estado a validado
                    const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
                    card.classList.remove('pending');
                    card.classList.add('validated');
                    card.dataset.filter = 'validated';
                    
                    const badge = card.querySelector('.status-badge');
                    badge.textContent = 'VALIDADA';
                    badge.className = 'status-badge validated';
                    
                    // Actualizar enlace de Maps
                    const mapsLink = card.querySelector('.btn-maps');
                    mapsLink.href = 'https://maps.google.com/?q=' + lat + ',' + lng;
                    
                    exitEditMode(branchId);
                    updateStats();
                } else {
                    showMessage('❌ Error actualizando coordenadas', 'error');
                }
            } catch (error) {
                showMessage('❌ Error de conexión', 'error');
            }
        }
        
        // Parsear coordenadas de diferentes formatos
        function parseCoordinates(input) {
            // Limpiar la entrada
            const cleaned = input.replace(/[°'"°]/g, '').trim();
            
            // Intentar diferentes patrones
            const patterns = [
                // Formato directo: "25.682125013659245, -100.29952346140905"
                /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/,
                // Con espacios: "25.682125013659245 , -100.29952346140905"
                /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/,
                // Con punto y coma: "25.682125013659245; -100.29952346140905"
                /^(-?\d+\.?\d*)\s*;\s*(-?\d+\.?\d*)$/
            ];
            
            for (const pattern of patterns) {
                const match = cleaned.match(pattern);
                if (match) {
                    const lat = parseFloat(match[1]);
                    const lng = parseFloat(match[2]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        return { lat, lng };
                    }
                }
            }
            
            return null;
        }
        
        // Mostrar mensajes
        function showMessage(text, type) {
            const messageEl = document.getElementById('status-message');
            messageEl.textContent = text;
            messageEl.className = 'status-message status-' + type;
            messageEl.classList.remove('hidden');
            
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 4000);
        }
        
        // Auto-focus en el campo de pegado cuando se hace clic
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('paste-input')) {
                e.target.select();
            }
        });
        
        // Detectar pegado y validar automáticamente
        document.addEventListener('paste', function(e) {
            if (e.target.classList.contains('paste-input')) {
                setTimeout(() => {
                    const coords = parseCoordinates(e.target.value);
                    if (coords) {
                        e.target.style.borderColor = '#28a745';
                        e.target.title = 'Coordenadas válidas: ' + coords.lat + ', ' + coords.lng;
                    } else {
                        e.target.style.borderColor = '#dc3545';
                        e.target.title = 'Formato no reconocido';
                    }
                }, 100);
            }
        });
    </script>
</body>
</html>`;

    // Guardar la interfaz mejorada
    await fs.writeFile('./validador-mejorado.html', htmlContent);
    console.log('✅ Validador mejorado creado: validador-mejorado.html');
    
    return {
      success: true,
      total: allBranches.rows.length,
      interfaceFile: 'validador-mejorado.html'
    };
    
  } catch (error) {
    console.error('❌ Error creando validador mejorado:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await createImprovedValidator();
  
  if (result.success) {
    console.log('\n🎉 ¡VALIDADOR MEJORADO LISTO!');
    console.log('\n🚀 NUEVAS CARACTERÍSTICAS:');
    console.log('✅ Pegado directo de coordenadas (25.123456, -100.123456)');
    console.log('✅ Detección automática de formato');
    console.log('✅ Validación en tiempo real');
    console.log('✅ Interfaz más rápida y eficiente');
    console.log('✅ Barra de progreso');
    console.log('✅ Actualización automática de estado');
    console.log('\n📱 Archivo creado: validador-mejorado.html');
  } else {
    console.log('\n❌ Error:', result.error);
  }
  
  process.exit(0);
}

main();