require('dotenv').config();
const db = require('./src/config/database');
const fs = require('fs').promises;

/**
 * VALIDADOR FRESCO - IGNORAR COORDENADAS ERRÓNEAS EXISTENTES
 * Todas las sucursales se consideran NO VALIDADAS para empezar desde cero
 */

async function createFreshValidator() {
  console.log('🔄 CREANDO VALIDADOR FRESCO - EMPEZAR DESDE CERO\n');
  
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
    console.log(`⚠️ Asumiendo que TODAS necesitan validación desde cero`);
    
    // Crear interfaz que trate todas como pendientes
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Validador EPL CAS - Validación Completa desde Cero</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f8f9fa; 
            padding: 15px;
        }
        .container { max-width: 1600px; margin: 0 auto; }
        
        .header { 
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white; 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        }
        
        .alert {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            border-left: 4px solid #ffc107;
        }
        .alert h3 { color: #856404; margin-bottom: 10px; }
        
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
            padding: 12px; 
            background: #f8f9fa; 
            border-radius: 6px; 
            border-left: 3px solid #28a745; 
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .step-number {
            background: #007bff;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            flex-shrink: 0;
        }
        
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 15px; 
            margin-bottom: 20px; 
        }
        .stat { 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            text-align: center; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat h3 { font-size: 32px; margin-bottom: 8px; color: #495057; }
        .stat.total h3 { color: #007bff; }
        .stat.validated h3 { color: #28a745; }
        .stat.pending h3 { color: #dc3545; }
        .stat.progress h3 { color: #6f42c1; }
        
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
            padding: 12px 15px;
            border: 1px solid #ced4da;
            border-radius: 8px;
            font-size: 14px;
        }
        .filter-btn {
            padding: 10px 16px;
            border: 1px solid #ced4da;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
        }
        .filter-btn.active { background: #007bff; color: white; border-color: #007bff; }
        
        .progress-section {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .progress-bar {
            background: #e9ecef;
            border-radius: 10px;
            height: 12px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            background: linear-gradient(90deg, #28a745, #20c997);
            height: 100%;
            transition: width 0.5s ease;
            border-radius: 10px;
        }
        .progress-text {
            text-align: center;
            font-weight: bold;
            color: #495057;
        }
        
        .branches-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
            gap: 20px;
        }
        
        .branch-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            border-left: 5px solid #dc3545;
            transition: all 0.3s ease;
            position: relative;
        }
        .branch-card:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(0,0,0,0.15); 
        }
        .branch-card.validated { 
            border-left-color: #28a745; 
            background: linear-gradient(135deg, #f8fff8 0%, #ffffff 100%);
        }
        .branch-card.working { 
            border-left-color: #ffc107; 
            background: linear-gradient(135deg, #fffbf0 0%, #ffffff 100%);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .branch-id { 
            background: #007bff; 
            color: white; 
            padding: 8px 12px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: bold;
        }
        .status-badge {
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-badge.pending { background: #f8d7da; color: #721c24; }
        .status-badge.working { background: #fff3cd; color: #856404; }
        .status-badge.validated { background: #d4edda; color: #155724; }
        
        .branch-name { 
            font-size: 18px; 
            font-weight: bold; 
            color: #212529; 
            margin-bottom: 10px; 
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
            line-height: 1.4;
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
            margin-bottom: 12px;
            padding: 10px;
            background: white;
            border-radius: 6px;
            border: 1px solid #dee2e6;
        }
        .current-coords.invalid {
            color: #dc3545;
            background: #fff5f5;
            border-color: #f5c6cb;
        }
        .current-coords.valid {
            color: #155724;
            background: #f8fff8;
            border-color: #c3e6cb;
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
            transition: all 0.3s;
        }
        .paste-input:focus {
            outline: none;
            border-color: #20c997;
            box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.1);
        }
        .paste-input.valid { 
            border-color: #28a745; 
            background: #f8fff8; 
            box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.1);
        }
        .paste-input.invalid { 
            border-color: #dc3545; 
            background: #fff8f8;
            box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.1);
        }
        
        .help-text {
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 12px;
            background: #e7f3ff;
            padding: 10px;
            border-radius: 6px;
            border-left: 3px solid #007bff;
        }
        
        .parse-feedback {
            font-size: 12px;
            padding: 8px 10px;
            border-radius: 6px;
            margin-bottom: 10px;
            font-family: monospace;
            font-weight: bold;
        }
        .parse-feedback.success { 
            background: #d4edda; 
            color: #155724; 
            border: 1px solid #c3e6cb;
        }
        .parse-feedback.error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 1px solid #f5c6cb;
        }
        
        .actions {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
            gap: 10px;
        }
        .btn {
            padding: 12px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            font-size: 13px;
            text-align: center;
            transition: all 0.2s;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
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
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
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
        
        @media (max-width: 768px) {
            .branches-grid { grid-template-columns: 1fr; }
            .search-controls { flex-direction: column; align-items: stretch; }
            .stats { grid-template-columns: repeat(2, 1fr); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔄 Validador EPL CAS - Validación Completa</h1>
            <p>Sistema de validación desde cero para todas las sucursales</p>
        </div>
        
        <div class="alert">
            <h3>⚠️ Importante: Validación Completa desde Cero</h3>
            <p><strong>Todas las sucursales necesitan validación.</strong> Las coordenadas existentes pueden ser incorrectas, por lo que vamos a validar cada una manualmente para asegurar que sean exactas.</p>
        </div>
        
        <div class="instructions">
            <h3>📋 Proceso de Validación Paso a Paso:</h3>
            <div class="step">
                <div class="step-number">1</div>
                <div>
                    <strong>Verificar ubicación actual:</strong> Haz clic en "🗺️ Ver" para ver dónde apuntan las coordenadas actuales (probablemente estén mal)
                </div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div>
                    <strong>Buscar ubicación real:</strong> Haz clic en "🔍 Buscar" para encontrar la dirección correcta en Google Maps
                </div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div>
                    <strong>Copiar coordenadas correctas:</strong> En Google Maps, haz clic derecho en la ubicación del restaurante → copiar las coordenadas
                </div>
            </div>
            <div class="step">
                <div class="step-number">4</div>
                <div>
                    <strong>Pegar y validar:</strong> Haz clic en "✏️ Editar", pega las coordenadas (formato: 25.123456, -100.123456)
                </div>
            </div>
            <div class="step">
                <div class="step-number">5</div>
                <div>
                    <strong>Guardar:</strong> Cuando veas ✅ en verde, haz clic en "💾 Guardar"
                </div>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat total">
                <h3 id="total-count">${allBranches.rows.length}</h3>
                <p>Total Sucursales</p>
            </div>
            <div class="stat validated">
                <h3 id="validated-count">0</h3>
                <p>Validadas ✅</p>
            </div>
            <div class="stat pending">
                <h3 id="pending-count">${allBranches.rows.length}</h3>
                <p>Pendientes ⚠️</p>
            </div>
            <div class="stat progress">
                <h3 id="progress-percent">0%</h3>
                <p>Progreso</p>
            </div>
        </div>
        
        <div class="progress-section">
            <div class="progress-text">Progreso de Validación: <span id="progress-text">0 de ${allBranches.rows.length}</span></div>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
            </div>
        </div>
        
        <div class="search-controls">
            <input type="text" class="search-box" placeholder="🔍 Buscar por nombre, ciudad o ID..." id="search-input" onkeyup="searchBranches()">
            <button class="filter-btn active" onclick="filterBranches('all')">📊 Todas (${allBranches.rows.length})</button>
            <button class="filter-btn" onclick="filterBranches('pending')">⚠️ Pendientes</button>
            <button class="filter-btn" onclick="filterBranches('working')">🔧 En Proceso</button>
            <button class="filter-btn" onclick="filterBranches('validated')">✅ Validadas</button>
        </div>
        
        <div class="status-message hidden" id="status-message"></div>
        
        <div class="branches-grid" id="branches-container">
            ${allBranches.rows.map(branch => {
              // Consideramos TODAS como pendientes para empezar desde cero
              const cardClass = 'pending';
              const statusText = 'NECESITA VALIDACIÓN';
              const statusClass = 'pending';
              
              // Mostrar las coordenadas existentes pero como "probablemente incorrectas"
              const currentCoordsText = branch.latitude && branch.longitude && branch.latitude !== 0 ? 
                `❌ ${parseFloat(branch.latitude).toFixed(6)}, ${parseFloat(branch.longitude).toFixed(6)} (VERIFICAR)` : 
                '❌ Sin coordenadas';
              
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
                        <div class="current-coords invalid" id="coords-display-${branch.id}">
                            ${currentCoordsText}
                        </div>
                        
                        <div class="coords-input-section" id="coords-input-${branch.id}">
                            <div class="help-text">
                                💡 <strong>Pega las coordenadas correctas de Google Maps:</strong><br>
                                Ejemplo: 25.672254063040413, -100.31993472423136
                            </div>
                            <input type="text" 
                                   class="paste-input" 
                                   id="paste-coords-${branch.id}" 
                                   placeholder="25.672254063040413, -100.31993472423136"
                                   oninput="validateCoordinateInput(${branch.id})"
                                   title="Pega aquí las coordenadas correctas de Google Maps">
                            <div class="parse-feedback hidden" id="feedback-${branch.id}"></div>
                        </div>
                    </div>
                    
                    <div class="actions">
                        <a href="${googleMapsView}" target="_blank" class="btn btn-maps">🗺️ Ver Actual</a>
                        <a href="${googleMapsSearch}" target="_blank" class="btn btn-search">🔍 Buscar Real</a>
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
        let validatedBranches = new Set(); // Rastrear las que ya validamos
        
        // Parser de coordenadas mejorado
        function parseCoordinates(input) {
            if (!input) return null;
            
            // Limpiar pero preservar números, puntos, comas, espacios y signos negativos
            const cleaned = input.replace(/[^\\d.,-\\s]/g, '').trim();
            
            // Patrones robustos
            const patterns = [
                /^(-?\\d+\\.\\d+)\\s*,\\s*(-?\\d+\\.\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s+,\\s+(-?\\d+\\.\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)$/,
                /^(-?\\d+)\\s*,\\s*(-?\\d+)$/,
                /^(-?\\d+\\.\\d+)\\s*,\\s*(-?\\d+)$/,
                /^(-?\\d+)\\s*,\\s*(-?\\d+\\.\\d+)$/
            ];
            
            for (const pattern of patterns) {
                const match = cleaned.match(pattern);
                if (match) {
                    const lat = parseFloat(match[1]);
                    const lng = parseFloat(match[2]);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                            return { lat, lng };
                        }
                    }
                }
            }
            
            return null;
        }
        
        // Validar input de coordenadas en tiempo real
        function validateCoordinateInput(branchId) {
            const input = document.getElementById(\`paste-coords-\${branchId}\`);
            const feedback = document.getElementById(\`feedback-\${branchId}\`);
            
            const coords = parseCoordinates(input.value);
            
            if (input.value.trim() === '') {
                input.className = 'paste-input';
                feedback.classList.add('hidden');
            } else if (coords) {
                input.className = 'paste-input valid';
                feedback.textContent = \`✅ Válido: \${coords.lat.toFixed(6)}, \${coords.lng.toFixed(6)}\`;
                feedback.className = 'parse-feedback success';
                feedback.classList.remove('hidden');
            } else {
                input.className = 'paste-input invalid';
                feedback.textContent = '❌ Formato no válido';
                feedback.className = 'parse-feedback error';
                feedback.classList.remove('hidden');
            }
        }
        
        function updateStats() {
            const validated = validatedBranches.size;
            const total = ${allBranches.rows.length};
            const pending = total - validated;
            const progress = ((validated / total) * 100).toFixed(1);
            
            document.getElementById('validated-count').textContent = validated;
            document.getElementById('pending-count').textContent = pending;
            document.getElementById('progress-percent').textContent = progress + '%';
            document.getElementById('progress-text').textContent = \`\${validated} de \${total}\`;
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
            if (editingBranch && editingBranch !== branchId) {
                exitEditMode(editingBranch);
            }
            
            editingBranch = branchId;
            const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
            card.classList.add('edit-mode');
            card.classList.remove('pending');
            card.classList.add('working');
            card.dataset.filter = 'working';
            
            const badge = card.querySelector('.status-badge');
            badge.textContent = 'EN PROCESO';
            badge.className = 'status-badge working';
            
            document.getElementById('coords-input-' + branchId).classList.add('active');
            document.getElementById('paste-coords-' + branchId).focus();
        }
        
        // Salir del modo edición
        function exitEditMode(branchId) {
            const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
            card.classList.remove('edit-mode');
            
            // Solo volver a pending si no está validado
            if (!validatedBranches.has(branchId)) {
                card.classList.remove('working');
                card.classList.add('pending');
                card.dataset.filter = 'pending';
                
                const badge = card.querySelector('.status-badge');
                badge.textContent = 'NECESITA VALIDACIÓN';
                badge.className = 'status-badge pending';
            }
            
            document.getElementById('coords-input-' + branchId).classList.remove('active');
            document.getElementById('paste-coords-' + branchId).value = '';
            document.getElementById('feedback-' + branchId).classList.add('hidden');
            editingBranch = null;
        }
        
        // Guardar coordenadas
        async function saveCoordinates(branchId) {
            const pastedValue = document.getElementById('paste-coords-' + branchId).value.trim();
            
            if (!pastedValue) {
                showMessage('Por favor pega las coordenadas', 'error');
                return;
            }
            
            const coords = parseCoordinates(pastedValue);
            if (!coords) {
                showMessage('Formato de coordenadas inválido', 'error');
                return;
            }
            
            const { lat, lng } = coords;
            
            // Validar rangos de México (más permisivo para casos especiales)
            if (lat < 10 || lat > 35 || lng < -125 || lng > -80) {
                if (!confirm(\`Las coordenadas parecen estar muy fuera de México: \${lat}, \${lng}. ¿Continuar?\`)) {
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
                    showMessage('✅ Coordenadas validadas exitosamente', 'success');
                    
                    // Marcar como validado
                    validatedBranches.add(branchId);
                    
                    const card = document.querySelector('.branch-card[data-id="' + branchId + '"]');
                    card.classList.remove('working', 'pending');
                    card.classList.add('validated');
                    card.dataset.filter = 'validated';
                    
                    const badge = card.querySelector('.status-badge');
                    badge.textContent = 'VALIDADA ✅';
                    badge.className = 'status-badge validated';
                    
                    // Actualizar display de coordenadas
                    const coordsDisplay = document.getElementById('coords-display-' + branchId);
                    coordsDisplay.textContent = \`✅ \${lat.toFixed(6)}, \${lng.toFixed(6)}\`;
                    coordsDisplay.className = 'current-coords valid';
                    
                    // Actualizar enlace de Maps
                    const mapsLink = card.querySelector('.btn-maps');
                    mapsLink.href = 'https://maps.google.com/?q=' + lat + ',' + lng;
                    mapsLink.textContent = '🗺️ Ver Válida';
                    
                    exitEditMode(branchId);
                    updateStats();
                } else {
                    showMessage('❌ Error actualizando coordenadas', 'error');
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
            }, 4000);
        }
        
        // Inicializar
        document.addEventListener('DOMContentLoaded', function() {
            updateStats();
        });
        
        // Auto-seleccionar texto al hacer click en input
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('paste-input')) {
                e.target.select();
            }
        });
    </script>
</body>
</html>`;

    // Guardar la interfaz
    await fs.writeFile('./validador-fresco.html', htmlContent);
    console.log('✅ Validador fresco creado: validador-fresco.html');
    
    return {
      success: true,
      total: allBranches.rows.length,
      message: 'Validador fresco que considera TODAS las sucursales como pendientes'
    };
    
  } catch (error) {
    console.error('❌ Error creando validador fresco:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await createFreshValidator();
  
  if (result.success) {
    console.log('\n🎉 ¡VALIDADOR FRESCO LISTO!');
    console.log('\n✨ CARACTERÍSTICAS:');
    console.log('✅ Considera TODAS las sucursales como no validadas');
    console.log('✅ Ignora coordenadas existentes erróneas');
    console.log('✅ Proceso claro paso a paso');
    console.log('✅ Progreso visual en tiempo real');
    console.log('✅ Parser robusto para cualquier formato');
    console.log('\n📱 Archivo creado: validador-fresco.html');
    console.log('\n🚀 AHORA PUEDES VALIDAR TODAS DESDE CERO');
  } else {
    console.log('\n❌ Error:', result.error);
  }
  
  process.exit(0);
}

main();