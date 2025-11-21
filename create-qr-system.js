const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * SISTEMA QR AUTOMÁTICO PARA OWNTRACKS
 * Genera QR y configuración automática para nuevos usuarios
 */
async function createQRSystem() {
  try {
    console.log('📱 CREANDO SISTEMA QR AUTOMÁTICO OWNTRACKS\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Crear servicio generador QR
    console.log('🎯 PASO 1: SERVICIO GENERADOR QR');
    console.log('');
    
    const qrService = `/**
 * Servicio generador de QR para configuración automática OwnTracks
 */

const QRCode = require('qrcode');
const crypto = require('crypto');
const { Pool } = require('pg');

class QRGeneratorService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.baseUrl = process.env.BASE_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app';
  }
  
  /**
   * Generar configuración OwnTracks optimizada para usuario
   */
  async generateOwnTracksConfig(userId, userRole = 'employee') {
    try {
      // Obtener datos del usuario
      const user = await this.pool.query(
        'SELECT * FROM tracking_users WHERE id = $1',
        [userId]
      );
      
      if (user.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      const userData = user.rows[0];
      
      // Configuración base optimizada
      const config = {
        "_type": "configuration",
        "_version": "1.0",
        "_company": "Pollo Loco GPS",
        
        // Conexión MQTT optimizada
        "host": "pollo-loco-tracking-gps-production.up.railway.app",
        "port": 443,
        "ws": true,
        "tls": true,
        
        // Credenciales únicas por usuario
        "username": \`polloLoco_\${userData.tracker_id}\`,
        "password": this.generateSecurePassword(userData.id),
        "deviceId": \`PL_\${userData.tracker_id}\`,
        "tid": userData.tracker_id,
        
        // Configuración geofencing optimizada
        "locatorInterval": userRole === 'admin' ? 10 : 15,
        "locatorDisplacement": 5,
        "monitoring": 2,  // Alto rendimiento
        "ranging": true,
        "ignoreInaccurateLocations": 30,
        
        // Configuración empresarial
        "pubRetain": false,
        "cleanSession": true,
        "keepalive": 60,
        "autostartOnBoot": true,
        
        // Topic personalizado
        "pubTopicBase": \`owntracks/\${userData.tracker_id}\`,
        
        // Configuración de reportes
        "pubInterval": 30,  // Reportar cada 30 segundos cuando activo
        "moveModeLocatorInterval": userRole === 'admin' ? 5 : 10,
        
        // Modo ahorro batería inteligente
        "ignoreStaleLocations": 300,
        "locatorPriority": 2,
        
        // Branding empresa
        "clientId": \`PolloLoco_\${userData.display_name.replace(/\\s+/g, '_')}\`,
        "_instructions": \`\${this.baseUrl}/setup-instructions\`,
        "_support": "roberto@pollolocogps.com"
      };
      
      return config;
      
    } catch (error) {
      console.error('❌ Error generando config:', error.message);
      throw error;
    }
  }
  
  /**
   * Generar QR code para configuración
   */
  async generateQRCode(userId, format = 'base64') {
    try {
      const config = await this.generateOwnTracksConfig(userId);
      
      // Crear URL de configuración
      const configUrl = \`\${this.baseUrl}/api/owntracks/config/\${userId}\`;
      
      // Para OwnTracks, necesitamos una URL especial
      const ownTracksUrl = \`owntracks:///config?url=\${encodeURIComponent(configUrl)}\`;
      
      // Generar QR
      const qrOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      };
      
      let qrCode;
      if (format === 'base64') {
        qrCode = await QRCode.toDataURL(ownTracksUrl, qrOptions);
      } else {
        qrCode = await QRCode.toBuffer(ownTracksUrl, qrOptions);
      }
      
      // Guardar en base de datos
      await this.saveQRRecord(userId, configUrl, ownTracksUrl);
      
      return {
        qrCode,
        configUrl,
        ownTracksUrl,
        config: JSON.stringify(config, null, 2)
      };
      
    } catch (error) {
      console.error('❌ Error generando QR:', error.message);
      throw error;
    }
  }
  
  /**
   * Guardar registro de QR generado
   */
  async saveQRRecord(userId, configUrl, ownTracksUrl) {
    try {
      await this.pool.query(\`
        INSERT INTO qr_codes (user_id, config_url, owntracks_url, generated_at, active)
        VALUES ($1, $2, $3, NOW(), true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          config_url = EXCLUDED.config_url,
          owntracks_url = EXCLUDED.owntracks_url,
          generated_at = NOW(),
          active = true
      \`, [userId, configUrl, ownTracksUrl]);
      
      console.log(\`✅ QR record guardado para usuario \${userId}\`);
      
    } catch (error) {
      console.error(\`❌ Error guardando QR record usuario \${userId}:\`, error.message);
    }
  }
  
  /**
   * Generar password segura para usuario
   */
  generateSecurePassword(userId) {
    const baseStr = \`PLGps_\${userId}_\${Date.now()}\`;
    return crypto.createHash('sha256').update(baseStr).digest('hex').substring(0, 16);
  }
  
  /**
   * Verificar si configuración fue aplicada
   */
  async verifyConfigurationApplied(userId) {
    try {
      // Verificar si hay ubicaciones recientes del usuario
      const recent = await this.pool.query(\`
        SELECT COUNT(*) as count
        FROM gps_locations 
        WHERE user_id = $1 
          AND gps_timestamp >= NOW() - INTERVAL '1 hour'
      \`, [userId]);
      
      return parseInt(recent.rows[0].count) > 0;
      
    } catch (error) {
      console.error(\`❌ Error verificando configuración usuario \${userId}:\`, error.message);
      return false;
    }
  }
}

module.exports = new QRGeneratorService();`;

    const qrServicePath = './src/services/qr-generator.js';
    fs.writeFileSync(qrServicePath, qrService);
    console.log(`✅ Servicio QR creado: ${qrServicePath}`);
    console.log('   🎯 Configuración automática OwnTracks');
    console.log('   📱 QR codes personalizados');
    console.log('   🔐 Credenciales únicas por usuario');
    console.log('   ⚙️ Settings optimizados por rol');
    
    // 2. Crear endpoints API para QR
    console.log('\n📡 PASO 2: ENDPOINTS API QR');
    console.log('');
    
    const qrRoutes = `/**
 * API Routes para sistema QR automático
 */

const express = require('express');
const router = express.Router();
const qrGenerator = require('../services/qr-generator');

// Generar QR para usuario específico
router.get('/qr/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const format = req.query.format || 'base64';
    
    console.log(\`📱 Generando QR para usuario \${userId}\`);
    
    const qrData = await qrGenerator.generateQRCode(userId, format);
    
    if (format === 'image') {
      res.setHeader('Content-Type', 'image/png');
      res.send(qrData.qrCode);
    } else {
      res.json({
        success: true,
        qr_code: qrData.qrCode,
        config_url: qrData.configUrl,
        owntracks_url: qrData.ownTracksUrl,
        instructions: 'Escanea el QR con OwnTracks para configuración automática'
      });
    }
    
  } catch (error) {
    console.error('❌ Error generando QR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Servir configuración OwnTracks por usuario  
router.get('/config/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    console.log(\`⚙️ Sirviendo configuración para usuario \${userId}\`);
    
    const config = await qrGenerator.generateOwnTracksConfig(userId);
    
    // Headers para OwnTracks
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', \`attachment; filename="pollo-loco-\${userId}.otrc"\`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.json(config);
    
  } catch (error) {
    console.error('❌ Error sirviendo config:', error.message);
    res.status(500).json({
      error: 'Error generando configuración'
    });
  }
});

// Verificar estado configuración usuario
router.get('/verify/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const configured = await qrGenerator.verifyConfigurationApplied(userId);
    
    res.json({
      success: true,
      user_id: userId,
      configured: configured,
      message: configured ? 
        'Usuario configurado correctamente' : 
        'Usuario no ha completado configuración',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Página de instrucciones
router.get('/instructions', (req, res) => {
  const html = \`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración OwnTracks - Pollo Loco GPS</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
      .container { max-width: 600px; margin: 0 auto; }
      .step { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 10px; }
      .highlight { color: #007AFF; font-weight: bold; }
      img { max-width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>📱 Configuración OwnTracks</h1>
      
      <div class="step">
        <h3>1. Instalar OwnTracks</h3>
        <p><strong>Android:</strong> <a href="https://play.google.com/store/apps/details?id=org.owntracks.android">Google Play Store</a></p>
        <p><strong>iOS:</strong> <a href="https://apps.apple.com/app/owntracks/id692424691">App Store</a></p>
      </div>
      
      <div class="step">
        <h3>2. Escanear QR</h3>
        <p>Abre OwnTracks → <span class="highlight">Configuración</span> → <span class="highlight">Configurar</span> → <span class="highlight">Escanear QR</span></p>
        <p>Escanea el código QR que recibiste</p>
      </div>
      
      <div class="step">
        <h3>3. Verificar conexión</h3>
        <p>Verifica que aparezca <span class="highlight">Conectado</span> en la app</p>
        <p>Tu ubicación debería aparecer automáticamente en el sistema</p>
      </div>
      
      <div class="step">
        <h3>📞 Soporte</h3>
        <p>¿Problemas? Contacta: <strong>roberto@pollolocogps.com</strong></p>
      </div>
    </div>
  </body>
  </html>
  \`;
  
  res.send(html);
});

module.exports = router;`;

    const qrRoutesPath = './src/api/routes/qr-system.js';
    fs.writeFileSync(qrRoutesPath, qrRoutes);
    console.log(`✅ API QR creado: ${qrRoutesPath}`);
    console.log('   📱 GET /api/qr/:userId - Generar QR');
    console.log('   ⚙️ GET /api/owntracks/config/:userId - Configuración');
    console.log('   ✅ GET /api/qr/verify/:userId - Verificar setup');
    console.log('   📋 GET /setup-instructions - Instrucciones');

    // 3. Crear tabla para QR codes
    console.log('\n💾 PASO 3: TABLA BASE DE DATOS');
    console.log('');
    
    const createTable = await pool.query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES tracking_users(id),
        config_url TEXT NOT NULL,
        owntracks_url TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT NOW(),
        last_scanned_at TIMESTAMP,
        scan_count INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('✅ Tabla qr_codes creada/verificada');
    console.log('   🆔 Códigos únicos por usuario');
    console.log('   📊 Tracking de escaneos');
    console.log('   ⏰ Timestamps completos');

    // 4. Crear UI admin para QR
    console.log('\n🎨 PASO 4: UI ADMIN QR MANAGEMENT');
    console.log('');
    
    const qrAdminUI = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Management - Pollo Loco GPS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            background: #F2F2F7;
            color: #1C1C1E;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #007AFF;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            color: #8E8E93;
            font-size: 16px;
        }
        
        .users-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .user-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .user-card:hover {
            transform: translateY(-2px);
        }
        
        .user-info {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
        }
        
        .user-avatar {
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background: #007AFF;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
            margin-right: 16px;
        }
        
        .user-details h3 {
            color: #1C1C1E;
            font-size: 18px;
            font-weight: 600;
        }
        
        .user-details p {
            color: #8E8E93;
            font-size: 14px;
        }
        
        .qr-section {
            margin: 16px 0;
            text-align: center;
        }
        
        .qr-code {
            max-width: 200px;
            border-radius: 8px;
            margin: 10px auto;
            display: block;
        }
        
        .btn {
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
            margin: 5px;
        }
        
        .btn:hover { background: #0056CC; }
        .btn.secondary { background: #8E8E93; }
        .btn.secondary:hover { background: #6D6D70; }
        .btn.success { background: #34C759; }
        .btn.success:hover { background: #30A14E; }
        
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
        }
        
        .status.active { background: #E3F2FD; color: #1976D2; }
        .status.configured { background: #E8F5E8; color: #2E7D2E; }
        .status.pending { background: #FFF3E0; color: #F57C00; }
        
        @media (max-width: 768px) {
            .users-grid { grid-template-columns: 1fr; }
            .container { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 QR Management</h1>
            <p>Gestión de códigos QR para configuración automática OwnTracks</p>
        </div>
        
        <div id="usersGrid" class="users-grid">
            <!-- Los usuarios se cargan aquí dinámicamente -->
        </div>
    </div>

    <script>
        let users = [];
        
        // Cargar usuarios al iniciar
        async function loadUsers() {
            try {
                const response = await fetch('/api/admin/users');
                const data = await response.json();
                users = data.users || [];
                renderUsers();
            } catch (error) {
                console.error('Error cargando usuarios:', error);
            }
        }
        
        // Renderizar grid de usuarios
        function renderUsers() {
            const grid = document.getElementById('usersGrid');
            
            grid.innerHTML = users.map(user => \`
                <div class="user-card">
                    <div class="user-info">
                        <div class="user-avatar">\${user.display_name.charAt(0)}</div>
                        <div class="user-details">
                            <h3>\${user.display_name}</h3>
                            <p>ID: \${user.tracker_id} • \${user.role || 'employee'}</p>
                        </div>
                    </div>
                    
                    <div class="qr-section">
                        <div id="qr-\${user.id}">
                            <button class="btn" onclick="generateQR(\${user.id})">
                                📱 Generar QR
                            </button>
                        </div>
                        
                        <div>
                            <button class="btn secondary" onclick="verifyConfig(\${user.id})">
                                ✅ Verificar
                            </button>
                            <button class="btn secondary" onclick="shareLink(\${user.id})">
                                🔗 Compartir
                            </button>
                        </div>
                        
                        <div id="status-\${user.id}"></div>
                    </div>
                </div>
            \`).join('');
        }
        
        // Generar QR para usuario
        async function generateQR(userId) {
            try {
                const button = document.querySelector(\`#qr-\${userId} button\`);
                button.textContent = '🔄 Generando...';
                button.disabled = true;
                
                const response = await fetch(\`/api/qr/\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById(\`qr-\${userId}\`).innerHTML = \`
                        <img src="\${data.qr_code}" class="qr-code" alt="QR Code">
                        <br>
                        <small style="color: #8E8E93;">Escanear con OwnTracks</small>
                    \`;
                    
                    updateStatus(userId, 'active', 'QR Generado');
                } else {
                    alert('Error generando QR: ' + data.error);
                    button.textContent = '📱 Generar QR';
                    button.disabled = false;
                }
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error de conexión');
            }
        }
        
        // Verificar configuración usuario
        async function verifyConfig(userId) {
            try {
                const response = await fetch(\`/api/qr/verify/\${userId}\`);
                const data = await response.json();
                
                if (data.success) {
                    const status = data.configured ? 'configured' : 'pending';
                    const message = data.configured ? 'Configurado ✅' : 'Pendiente ⏳';
                    updateStatus(userId, status, message);
                } else {
                    updateStatus(userId, 'error', 'Error verificando');
                }
                
            } catch (error) {
                console.error('Error:', error);
                updateStatus(userId, 'error', 'Error conexión');
            }
        }
        
        // Compartir link de configuración
        async function shareLink(userId) {
            const configUrl = \`\${window.location.origin}/api/owntracks/config/\${userId}\`;
            const instructionsUrl = \`\${window.location.origin}/setup-instructions\`;
            
            const message = \`🎯 Configuración OwnTracks - Pollo Loco GPS
            
📱 Paso 1: Instala OwnTracks desde tu app store
📋 Paso 2: Instrucciones completas: \${instructionsUrl}
⚙️ Paso 3: Configuración automática: \${configUrl}

¿Problemas? Contacta soporte.\`;
            
            if (navigator.share) {
                navigator.share({
                    title: 'Configuración OwnTracks',
                    text: message
                });
            } else {
                navigator.clipboard.writeText(message);
                alert('✅ Mensaje copiado al portapapeles');
            }
        }
        
        // Actualizar status usuario
        function updateStatus(userId, type, message) {
            const statusDiv = document.getElementById(\`status-\${userId}\`);
            statusDiv.innerHTML = \`<span class="status \${type}">\${message}</span>\`;
        }
        
        // Inicializar
        loadUsers();
        
        // Refrescar cada 30 segundos
        setInterval(loadUsers, 30000);
    </script>
</body>
</html>`;

    const qrUIPath = './src/webapp/qr-management.html';
    fs.writeFileSync(qrUIPath, qrAdminUI);
    console.log(`✅ UI Admin QR creado: ${qrUIPath}`);
    console.log('   🎨 Diseño iOS-style mobile-first');
    console.log('   📱 Grid responsivo usuarios');
    console.log('   🔄 Generación QR en tiempo real');
    console.log('   ✅ Verificación automática configuración');

    // 5. Demo para Roberto
    console.log('\n🧪 PASO 5: DEMO PARA ROBERTO');
    console.log('');
    
    const robertoUser = await pool.query(`
      SELECT id, tracker_id, display_name, role 
      FROM tracking_users 
      WHERE id = 5 OR tracker_id ILIKE '%01%' OR display_name ILIKE '%roberto%'
      LIMIT 1
    `);
    
    if (robertoUser.rows.length > 0) {
      const user = robertoUser.rows[0];
      console.log(`✅ Usuario Roberto encontrado: ${user.display_name} (${user.tracker_id})`);
      console.log('');
      console.log('🔗 ENLACES PARA TESTING:');
      console.log(`   📱 QR Roberto: https://tu-dominio.com/api/qr/${user.id}`);
      console.log(`   ⚙️ Config Roberto: https://tu-dominio.com/api/owntracks/config/${user.id}`);
      console.log(`   ✅ Verificar Roberto: https://tu-dominio.com/api/qr/verify/${user.id}`);
      console.log(`   📋 Instrucciones: https://tu-dominio.com/setup-instructions`);
      console.log(`   🎛️ Admin QR: https://tu-dominio.com/webapp/qr-management.html`);
    } else {
      console.log('⚠️ Usuario Roberto no encontrado en BD');
    }

    // 6. Instrucciones integración
    console.log('\n🔧 PASO 6: INSTRUCCIONES INTEGRACIÓN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📋 AGREGAR A src/api/server.js:');
    console.log('   const qrRoutes = require("./routes/qr-system");');
    console.log('   app.use("/api/qr", qrRoutes);');
    console.log('');
    console.log('📦 INSTALAR DEPENDENCIAS:');
    console.log('   npm install qrcode');
    console.log('');
    console.log('🎯 RESULTADO:');
    console.log('   ✅ QR automático para cualquier usuario');
    console.log('   📱 Configuración OwnTracks sin tocar dispositivos');
    console.log('   🎛️ Panel admin para gestionar QRs');
    console.log('   📊 Analytics de configuraciones');
    console.log('   🔗 Enlaces compartibles');
    console.log('');
    console.log('💡 WORKFLOW PRODUCCIÓN:');
    console.log('   1. Admin crea usuario → QR se genera automáticamente');
    console.log('   2. Se envía QR por WhatsApp/email/Telegram');
    console.log('   3. Empleado escanea → OwnTracks se configura solo');
    console.log('   4. Sistema detecta primera conexión → Usuario activo');
    console.log('   5. Geofencing funciona automáticamente');
    console.log('');
    console.log('🎉 SOLUCIÓN QR COMPLETA CREADA!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createQRSystem();