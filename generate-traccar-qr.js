require('dotenv').config();
const QRCode = require('qrcode');
const fs = require('fs');

async function generateTraccarQR() {
  try {
    console.log('📱 GENERANDO QR PARA TRACCAR\n');
    
    const userId = 'TRACCAR01'; // Usuario que acabamos de crear
    const setupUrl = `https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/${userId}`;
    
    console.log(`🔗 URL para QR: ${setupUrl}`);
    
    // Generar QR
    console.log('🔄 Generando código QR...');
    
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    };
    
    // Generar QR como archivo
    const qrFileName = `traccar-qr-${userId}.png`;
    await QRCode.toFile(qrFileName, setupUrl, qrOptions);
    
    // Generar QR como data URL para mostrar
    const qrDataURL = await QRCode.toDataURL(setupUrl, qrOptions);
    
    console.log(`✅ QR generado: ${qrFileName}`);
    console.log(`✅ QR data URL generado`);
    
    // Crear HTML con QR para visualizar
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Traccar - ${userId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #2196F3, #21CBF3);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            color: #333;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .qr-code {
            margin: 20px 0;
        }
        .btn {
            display: inline-block;
            padding: 15px 25px;
            margin: 10px;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
        }
        .instructions {
            text-align: left;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐔 Pollo Loco GPS</h1>
        <h2>Configuración Traccar</h2>
        
        <div class="user-info">
            <strong>👤 Usuario:</strong> ${userId}<br>
            <strong>📱 App:</strong> Traccar Client
        </div>
        
        <div class="qr-code">
            <img src="${qrDataURL}" alt="QR Code Traccar" style="max-width: 250px;">
        </div>
        
        <div class="instructions">
            <h3>📋 Instrucciones:</h3>
            <ol>
                <li><strong>Instala Traccar Client</strong>
                    <ul>
                        <li>Android: <a href="https://play.google.com/store/apps/details?id=org.traccar.client">Google Play</a></li>
                        <li>iOS: <a href="https://apps.apple.com/app/traccar-client/id843156974">App Store</a></li>
                    </ul>
                </li>
                <li><strong>Escanea este QR</strong> con el teléfono</li>
                <li><strong>Se abrirá automáticamente</strong> la configuración</li>
                <li><strong>Presiona "Configurar Traccar Client"</strong></li>
                <li><strong>¡Listo!</strong> Ya estás enviando GPS</li>
            </ol>
        </div>
        
        <a href="${setupUrl}" class="btn">
            🔧 Abrir Configuración Manual
        </a>
    </div>
</body>
</html>
    `;
    
    const htmlFileName = `traccar-setup-${userId}.html`;
    fs.writeFileSync(htmlFileName, htmlContent);
    
    console.log(`✅ Página HTML creada: ${htmlFileName}`);
    
    console.log('\n🎯 RESUMEN COMPLETO:');
    console.log('=' .repeat(60));
    console.log(`📱 Usuario: ${userId}`);
    console.log(`🔗 URL directa: ${setupUrl}`);
    console.log(`📱 QR archivo: ${qrFileName}`);
    console.log(`🌐 HTML demo: ${htmlFileName}`);
    
    console.log('\n📲 PASOS FINALES:');
    console.log('1. Envía la URL al empleado por WhatsApp/Telegram');
    console.log('2. O muestra el QR en pantalla para escanear');
    console.log('3. O abre el archivo HTML para ver todo junto');
    
    console.log('\n⚡ PRUEBA INMEDIATA:');
    console.log(`curl "${setupUrl}"`);
    
    return {
      success: true,
      userId,
      setupUrl,
      qrFileName,
      htmlFileName
    };
    
  } catch (error) {
    console.error('❌ Error generando QR:', error.message);
    return { success: false, error: error.message };
  }
}

// Ejecutar
generateTraccarQR().then(result => {
  if (result.success) {
    console.log('\n🚀 ¡QR TRACCAR LISTO PARA USAR!');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});