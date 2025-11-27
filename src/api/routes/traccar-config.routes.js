/**
 * TRACCAR CONFIGURATION ROUTES
 * Generación automática de configuraciones para Traccar Client
 * Compatible con Android/iOS Traccar Client apps
 */

const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /config/:userId
 * Generar configuración automática para Traccar Client
 */
router.get('/config/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Buscar usuario
    const userQuery = await db.query(`
      SELECT id, tracker_id, display_name, role, active
      FROM tracking_users 
      WHERE id = $1 OR tracker_id = $1
    `, [userId]);
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }
    
    const user = userQuery.rows[0];
    const host = req.get('host');
    const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    
    // Configuración Traccar Client (formato JSON)
    const traccarConfig = {
      id: user.tracker_id,
      name: user.display_name,
      category: "work",
      
      // Servidor
      server: `${host}`,
      port: 443,
      ssl: true,
      path: "/api/traccar",
      
      // Configuración de tracking
      interval: 30, // segundos
      distance: 10, // metros
      angle: 30, // grados
      
      // Configuración de batería
      offline: 300, // 5 minutos
      
      // Configuración adicional
      accuracy: 0,
      buffer: false,
      wakelock: false
    };
    
    res.json(traccarConfig);
    
  } catch (error) {
    console.error('❌ Error generando config Traccar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /setup/:userId
 * Generar página HTML para configuración fácil de Traccar
 */
router.get('/setup/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Buscar usuario
    const userQuery = await db.query(`
      SELECT id, tracker_id, display_name, role, active
      FROM tracking_users 
      WHERE id = $1 OR tracker_id = $1
    `, [userId]);
    
    if (userQuery.rows.length === 0) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Usuario no encontrado</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5;">
            <h1>❌ Usuario no encontrado</h1>
            <p>El usuario <strong>${userId}</strong> no existe en el sistema.</p>
          </body>
        </html>
      `);
    }
    
    const user = userQuery.rows[0];
    const host = req.get('host');
    const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    
    const configUrl = `${protocol}://${host}/api/traccar-config/config/${user.id}`;
    const traccarScheme = `traccar://configure?url=${encodeURIComponent(configUrl)}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración Traccar - ${user.display_name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px;
            background: linear-gradient(135deg, #2196F3 0%, #21CBF3 100%);
            color: white;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            max-width: 400px;
            margin: 30px auto;
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        .logo { 
            font-size: 28px; 
            margin-bottom: 20px; 
            color: #2196F3;
            font-weight: bold;
        }
        .user-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #2196F3;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 18px;
            margin: 15px 0;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);
            transition: all 0.3s ease;
        }
        .btn:hover { 
            background: #1976D2;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
        }
        .btn.orange {
            background: #FF9800;
            box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
        }
        .btn.orange:hover {
            background: #F57C00;
        }
        .btn.green {
            background: #4CAF50;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
        }
        .btn.green:hover {
            background: #388E3C;
        }
        .info { 
            background: #e3f2fd; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
            font-size: 14px;
            text-align: left;
        }
        .comparison {
            background: #fff3e0;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 13px;
            text-align: left;
        }
        .status {
            margin: 20px 0;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
        }
        .status.success { background: #d4edda; color: #155724; }
        .status.warning { background: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🐔 POLLO LOCO GPS</div>
        <h2>Configuración Automática Traccar</h2>
        
        <div class="user-info">
            <strong>👤 Usuario:</strong> ${user.tracker_id}<br>
            <strong>📝 Nombre:</strong> ${user.display_name}<br>
            <strong>🎭 Rol:</strong> ${user.role}<br>
            <strong>📱 Protocolo:</strong> Traccar Client
        </div>
        
        <div id="status" class="status warning">
            📱 Selecciona tu opción preferida para configurar GPS
        </div>
        
        <!-- Opción 1: Traccar Client (Recomendado) -->
        <a href="${traccarScheme}" 
           class="btn" onclick="trackClick('traccar_scheme')">
            🎯 Configurar Traccar Client (Recomendado)
        </a>
        
        <!-- Opción 2: OwnTracks (Alternativo) -->
        <a href="/api/owntracks-remote/setup/${user.id}" 
           class="btn orange" onclick="trackClick('owntracks_alt')">
            📍 Configurar OwnTracks (Alternativo)
        </a>
        
        <!-- Opción 3: Configuración Manual -->
        <a href="${configUrl}" 
           class="btn green" onclick="trackClick('view_config')">
            🔧 Ver Configuración Manual
        </a>
        
        <div class="comparison">
            <strong>📊 Comparación de Apps:</strong><br>
            <strong>Traccar Client:</strong> ⭐ Más preciso, menos batería, mejor para empresas<br>
            <strong>OwnTracks:</strong> ⭐ Más simple, fácil configuración, bueno para pruebas
        </div>
        
        <div class="info">
            <strong>📋 Instrucciones Traccar Client:</strong><br>
            1. Instala "Traccar Client" desde Play Store/App Store<br>
            2. Presiona "Configurar Traccar Client" arriba<br>
            3. Si no funciona automáticamente, usa "Ver Configuración Manual"<br>
            4. ¡Tu ubicación GPS será enviada cada 30 segundos!
        </div>
        
        <div class="info">
            <strong>⚙️ Configuración Manual Traccar (si es necesario):</strong><br>
            <strong>Servidor:</strong> ${host}<br>
            <strong>Puerto:</strong> 443 | <strong>SSL:</strong> Sí<br>
            <strong>Identificador:</strong> ${user.tracker_id}<br>
            <strong>Intervalo:</strong> 30 segundos<br>
            <strong>Distancia:</strong> 10 metros
        </div>

        <div class="info" style="background: #d4edda; color: #155724;">
            <strong>✅ Sistema Dual Operativo</strong><br>
            Compatible con Traccar Client y OwnTracks.<br>
            Ambos protocolos funcionan simultáneamente.
        </div>
    </div>

    <script>
        function trackClick(action) {
            console.log('🎯 Acción:', action);
            
            if (action === 'traccar_scheme') {
                document.getElementById('status').innerHTML = '⚡ Abriendo Traccar Client...';
                document.getElementById('status').className = 'status success';
                
                setTimeout(() => {
                    const isAndroid = /Android/i.test(navigator.userAgent);
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    
                    setTimeout(() => {
                        if (isAndroid && confirm('¿No se abrió Traccar Client? ¿Quieres ir a Google Play?')) {
                            window.location.href = "https://play.google.com/store/apps/details?id=org.traccar.client";
                        } else if (isIOS && confirm('¿No se abrió Traccar Client? ¿Quieres ir al App Store?')) {
                            window.location.href = "https://apps.apple.com/app/traccar-client/id843156974";
                        }
                    }, 4000);
                }, 1000);
            }
            
            if (action === 'owntracks_alt') {
                document.getElementById('status').innerHTML = '📍 Abriendo configuración OwnTracks...';
                document.getElementById('status').className = 'status warning';
            }
            
            if (action === 'view_config') {
                document.getElementById('status').innerHTML = '📋 Abriendo configuración manual...';
                document.getElementById('status').className = 'status warning';
            }
        }
        
        window.onload = function() {
            const isAndroid = /Android/i.test(navigator.userAgent);
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            
            if (isAndroid) {
                document.getElementById('status').innerHTML = '🤖 Android detectado - Traccar Client recomendado';
            } else if (isIOS) {
                document.getElementById('status').innerHTML = '📱 iOS detectado - Traccar Client disponible';
            } else {
                document.getElementById('status').innerHTML = '💻 Desktop detectado - Ver configuración manual';
            }
        };
    </script>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ Error generando página setup Traccar:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5;">
          <h1>❌ Error del servidor</h1>
          <p>No se pudo generar la página de configuración.</p>
        </body>
      </html>
    `);
  }
});

/**
 * GET /instructions
 * Página informativa sobre Traccar vs OwnTracks
 */
router.get('/instructions', (req, res) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guía GPS - Traccar vs OwnTracks</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .logo { 
            text-align: center;
            font-size: 28px; 
            margin-bottom: 30px; 
            color: #ff6b35;
            font-weight: bold;
        }
        .comparison {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .app-card {
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .traccar { background: #e3f2fd; border-left: 5px solid #2196F3; }
        .owntracks { background: #fff3e0; border-left: 5px solid #FF9800; }
        .feature { margin: 10px 0; }
        .pro { color: #4CAF50; }
        .con { color: #F44336; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🐔 POLLO LOCO GPS - Guía de Apps</div>
        
        <h2>🎯 ¿Cuál app GPS usar?</h2>
        
        <div class="comparison">
            <div class="app-card traccar">
                <h3>📱 Traccar Client</h3>
                <div class="feature pro">✅ Más preciso para empresas</div>
                <div class="feature pro">✅ Consume menos batería</div>
                <div class="feature pro">✅ Mejor para flotas comerciales</div>
                <div class="feature pro">✅ Configuración automática</div>
                <div class="feature con">⚠️ Menos conocido</div>
            </div>
            
            <div class="app-card owntracks">
                <h3>📍 OwnTracks</h3>
                <div class="feature pro">✅ Muy fácil de usar</div>
                <div class="feature pro">✅ Más conocido</div>
                <div class="feature pro">✅ Bueno para pruebas</div>
                <div class="feature con">⚠️ Consume más batería</div>
                <div class="feature con">⚠️ Menos empresarial</div>
            </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🚀 Recomendación Pollo Loco</h3>
            <p><strong>Para uso empresarial:</strong> <span style="color: #2196F3;">Traccar Client</span> es la mejor opción.</p>
            <p><strong>Para pruebas rápidas:</strong> <span style="color: #FF9800;">OwnTracks</span> es más simple.</p>
            <p><strong>Sistema dual:</strong> Ambas apps funcionan simultáneamente.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="/webapp/unified-user-panel.html" style="
                display: inline-block;
                padding: 15px 30px;
                background: #ff6b35;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
            ">🔙 Volver al Panel de Usuarios</a>
        </div>
    </div>
</body>
</html>
  `;
  
  res.send(html);
});

module.exports = router;