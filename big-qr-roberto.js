const QRCode = require('qrcode');

async function generateBigQR() {
  const url = 'https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/ROBERTO01';
  
  console.log('📱 GENERANDO QR GRANDE PARA ROBERTO01\n');
  console.log(`🔗 URL: ${url}\n`);
  
  const qrOptions = {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 500,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };
  
  // Generar QR grande
  await QRCode.toFile('qr-roberto-grande.png', url, qrOptions);
  console.log('✅ QR grande generado: qr-roberto-grande.png');
  
  // Generar ASCII QR para terminal
  console.log('\n📱 QR EN TERMINAL:');
  console.log('=' .repeat(50));
  const qrTerminal = await QRCode.toString(url, { type: 'terminal', small: true });
  console.log(qrTerminal);
  console.log('=' .repeat(50));
  
  console.log('\n📋 INSTRUCCIONES:');
  console.log('1. Escanea el QR con tu iPhone');
  console.log('2. O abre el archivo: qr-roberto-grande.png');
  console.log('3. O usa la URL directamente en Safari');
  
  return url;
}

generateBigQR().catch(console.error);