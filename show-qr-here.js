const QRCode = require('qrcode');

async function showQRHere() {
  const url = 'https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/ROBERTO01';
  
  console.log('🎯 GENERANDO QR PARA ROBERTO - VISIBLE AQUÍ\n');
  console.log(`🔗 URL: ${url}\n`);
  
  // QR en ASCII para que sea visible en texto
  console.log('📱 CÓDIGO QR (escanea con tu iPhone):');
  console.log('=' .repeat(60));
  
  const qrTerminal = await QRCode.toString(url, { 
    type: 'terminal', 
    small: false,
    width: 60
  });
  
  console.log(qrTerminal);
  console.log('=' .repeat(60));
  
  console.log('\n📋 INSTRUCCIONES:');
  console.log('1. 📱 Abre la CÁMARA de tu iPhone');
  console.log('2. 📷 Apunta a los cuadros negros y blancos de arriba');
  console.log('3. 🔗 Te aparecerá un enlace amarillo');
  console.log('4. 👆 Tócalo para configurar Traccar');
  
  console.log('\n🔗 O USA LA URL DIRECTA EN SAFARI:');
  console.log(url);
  
  // También crear QR como SVG en HTML
  const qrSVG = await QRCode.toString(url, { type: 'svg', width: 400 });
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>QR Code para Roberto</title>
    <style>
        body { 
            font-family: Arial; 
            text-align: center; 
            padding: 50px; 
            background: #f0f0f0; 
        }
        .qr-container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            display: inline-block;
        }
        h1 { color: #FF6B35; }
        .url { 
            word-break: break-all; 
            background: #f8f9fa; 
            padding: 10px; 
            border-radius: 5px; 
            margin: 20px 0; 
        }
    </style>
</head>
<body>
    <h1>🐔 QR Code para Roberto - Traccar GPS</h1>
    <div class="qr-container">
        ${qrSVG}
    </div>
    <div class="url">
        <strong>URL:</strong><br>
        ${url}
    </div>
    <p><strong>📱 Escanea con la cámara de tu iPhone</strong></p>
</body>
</html>
  `;
  
  require('fs').writeFileSync('qr-roberto-display.html', htmlContent);
  console.log('\n📄 Archivo HTML creado: qr-roberto-display.html');
  console.log('   (Abre este archivo en tu navegador para ver el QR grande)');
  
  return url;
}

showQRHere().catch(console.error);