#!/usr/bin/env node
/**
 * ALTA RÁPIDA TRACCAR - TODO EN UNO
 * Crea usuario + genera QR + URLs listas
 */

require('dotenv').config();
const { Pool } = require('pg');
const QRCode = require('qrcode');
const fs = require('fs');

async function altaRapidaTraccar(empleadoId, empleadoNombre) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log('🚀 ALTA RÁPIDA TRACCAR - TODO EN UNO');
    console.log('=' .repeat(50));
    
    if (!empleadoId || !empleadoNombre) {
      console.log('❌ Uso: node alta-rapida-traccar.js EMPLEADO_ID "Nombre Empleado"');
      console.log('📝 Ejemplo: node alta-rapida-traccar.js EMP001 "Juan Pérez"');
      return;
    }
    
    console.log(`📝 Creando empleado: ${empleadoId} - ${empleadoNombre}`);
    
    // PASO 1: Verificar/crear usuario
    let user;
    const existing = await pool.query(`
      SELECT id, tracker_id, display_name 
      FROM tracking_users 
      WHERE tracker_id = $1
    `, [empleadoId]);
    
    if (existing.rows.length > 0) {
      user = existing.rows[0];
      console.log(`⚠️ Usuario ya existe: ID ${user.id}`);
    } else {
      const result = await pool.query(`
        INSERT INTO tracking_users (
          tracker_id, display_name, role, active, created_at
        )
        VALUES ($1, $2, 'employee', true, NOW())
        RETURNING *
      `, [empleadoId, empleadoNombre]);
      
      user = result.rows[0];
      console.log(`✅ Usuario creado: ID ${user.id}`);
    }
    
    // PASO 2: Generar URLs
    const setupUrl = `https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/setup/${empleadoId}`;
    const configUrl = `https://pollo-loco-tracking-gps-production.up.railway.app/api/traccar-config/config/${empleadoId}`;
    
    console.log(`🔗 Setup URL: ${setupUrl}`);
    
    // PASO 3: Generar QR
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 1
    };
    
    const qrFileName = `qr-${empleadoId}.png`;
    await QRCode.toFile(qrFileName, setupUrl, qrOptions);
    console.log(`📱 QR generado: ${qrFileName}`);
    
    // PASO 4: Crear mensaje WhatsApp/Telegram listo
    const mensaje = `🐔 *Pollo Loco GPS - Configuración*

👤 *Empleado:* ${empleadoNombre}
📱 *ID:* ${empleadoId}

*OPCIÓN 1 - Automática:*
Abre este enlace en tu teléfono:
${setupUrl}

*OPCIÓN 2 - Manual:*
1. Instala "Traccar Client" desde:
   📱 Android: Play Store
   🍎 iPhone: App Store

2. Configura manualmente:
   • Servidor: pollo-loco-tracking-gps-production.up.railway.app
   • Puerto: 443 (SSL activado)
   • Identificador: ${empleadoId}
   • Intervalo: 30 segundos

¡Tu ubicación será enviada automáticamente cada 30 segundos!`;
    
    const mensajeFileName = `mensaje-${empleadoId}.txt`;
    fs.writeFileSync(mensajeFileName, mensaje);
    console.log(`💬 Mensaje listo: ${mensajeFileName}`);
    
    // PASO 5: Resultados finales
    console.log('\n🎯 ALTA COMPLETADA - ARCHIVOS GENERADOS:');
    console.log('=' .repeat(50));
    console.log(`📱 QR Code: ${qrFileName}`);
    console.log(`💬 Mensaje WhatsApp: ${mensajeFileName}`);
    console.log(`🔗 URL directa: ${setupUrl}`);
    
    console.log('\n📲 ENVÍO RÁPIDO:');
    console.log('1. Envía la URL por WhatsApp/Telegram/SMS');
    console.log('2. O muestra el QR para escanear');
    console.log('3. O copia el mensaje del archivo .txt');
    
    console.log('\n⚡ PRUEBA INMEDIATA:');
    console.log(`curl "${setupUrl}"`);
    
    return {
      success: true,
      user,
      setupUrl,
      configUrl,
      qrFileName,
      mensajeFileName
    };
    
  } catch (error) {
    console.error('❌ Error en alta rápida:', error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Ejecutar con argumentos de línea de comandos
const empleadoId = process.argv[2];
const empleadoNombre = process.argv[3];

altaRapidaTraccar(empleadoId, empleadoNombre).then(result => {
  if (result.success) {
    console.log('\n🚀 ¡EMPLEADO LISTO PARA TRACCAR GPS!');
  } else {
    console.log('\n❌ Error:', result.error);
  }
});