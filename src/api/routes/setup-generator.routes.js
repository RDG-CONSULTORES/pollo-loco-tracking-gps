const express = require('express');
const router = express.Router();
const db = require('../../config/database');

/**
 * GET /api/setup/:trackerId
 * Generar página de configuración automática para cualquier usuario
 */
router.get('/:trackerId', async (req, res) => {
  try {
    const { trackerId } = req.params;
    
    // Buscar usuario en la base de datos
    const user = await db.query(
      'SELECT * FROM tracking_users WHERE tracker_id = $1',
      [trackerId]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Usuario no encontrado</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5;">
            <h1>❌ Usuario no encontrado</h1>
            <p>El usuario <strong>${trackerId}</strong> no existe en el sistema.</p>
            <p>Contacta al administrador para crear tu usuario.</p>
          </body>
        </html>
      `);
    }
    
    const userData = user.rows[0];
    const configUrl = `${req.protocol}://${req.get('host')}/api/owntracks/config/${trackerId}`;
    const ownTracksScheme = `owntracks://config?url=${encodeURIComponent(configUrl)}`;
    
    // Generar página HTML dinámicamente
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuración GPS - ${userData.display_name}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            color: #ff6b35;
            font-weight: bold;
        }
        .user-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border-left: 4px solid #ff6b35;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 18px;
            margin: 15px 0;
            background: #ff6b35;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
            transition: all 0.3s ease;
        }
        .btn:hover { 
            background: #e55a2e;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
        }
        .btn.secondary {
            background: #28a745;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        }
        .btn.secondary:hover {
            background: #218838;
        }
        .info { 
            background: #e3f2fd; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
            font-size: 14px;
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
        <h2>Configuración Automática</h2>
        
        <div class="user-info">
            <strong>👤 Usuario:</strong> ${trackerId}<br>
            <strong>📝 Nombre:</strong> ${userData.display_name}<br>
            <strong>🎭 Rol:</strong> ${userData.role}
        </div>
        
        <div id="status" class="status warning">
            📱 Presiona el botón para configurar OwnTracks automáticamente
        </div>
        
        <!-- Configuración automática -->
        <a href="${ownTracksScheme}" 
           class="btn" onclick="trackClick('owntracks_scheme')">
            📱 Configurar OwnTracks Automáticamente
        </a>
        
        <!-- Configuración manual -->
        <a href="${configUrl}" 
           class="btn secondary" onclick="trackClick('view_config')">
            🔧 Ver Configuración Manual
        </a>
        
        <div class="info">
            <strong>📋 Instrucciones:</strong><br>
            1. Instala OwnTracks desde App Store<br>
            2. Presiona "Configurar OwnTracks Automáticamente"<br>
            3. Si no funciona automáticamente, usa "Ver Configuración Manual"<br>
            4. ¡Listo! Tu ubicación GPS será enviada automáticamente
        </div>
        
        <div class="info">
            <strong>⚙️ Configuración Manual (si es necesario):</strong><br>
            <strong>Servidor:</strong> ${req.get('host')}<br>
            <strong>Puerto:</strong> 443 | <strong>TLS:</strong> Sí<br>
            <strong>Ruta:</strong> /api/owntracks/location<br>
            <strong>Usuario:</strong> ${trackerId}
        </div>

        <div class="info" style="background: #d4edda; color: #155724;">
            <strong>✅ Sistema operativo</strong><br>
            Tu configuración está lista y funcionando correctamente.
        </div>
    </div>

    <script>
        function trackClick(action) {
            console.log('🎯 Acción:', action);
            
            if (action === 'owntracks_scheme') {
                document.getElementById('status').innerHTML = '⚡ Abriendo OwnTracks...';
                document.getElementById('status').className = 'status success';
                
                setTimeout(() => {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    if (isIOS) {
                        setTimeout(() => {
                            if (confirm('¿No se abrió OwnTracks automáticamente? ¿Quieres ir al App Store para instalarlo?')) {
                                window.location.href = "https://apps.apple.com/app/owntracks/id692424691";
                            }
                        }, 4000);
                    }
                }, 1000);
            }
            
            if (action === 'view_config') {
                document.getElementById('status').innerHTML = '📋 Abriendo configuración manual...';
                document.getElementById('status').className = 'status warning';
            }
        }
        
        window.onload = function() {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                document.getElementById('status').innerHTML = '📱 iOS detectado - Listo para configuración automática';
            } else {
                document.getElementById('status').innerHTML = '🤖 Android detectado - Configuración disponible';
            }
        };
    </script>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('❌ Error generando página setup:', error.message);
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

module.exports = router;