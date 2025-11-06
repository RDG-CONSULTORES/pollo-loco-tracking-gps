/**
 * Comandos de reportes
 */

const db = require('../../config/database');
const reportGenerator = require('../../services/report-generator');

/**
 * Comando /reporte - Generar reporte del día
 */
async function generarReporte(bot, msg, args) {
  const chatId = msg.chat.id;
  
  try {
    await bot.sendMessage(chatId, '📊 Generando reporte...');
    
    // Fecha por defecto: hoy
    let fecha = new Date();
    
    // Si especificaron fecha
    if (args.length > 0) {
      const fechaStr = args[0];
      // Formato esperado: DD/MM/YYYY
      const partes = fechaStr.split('/');
      if (partes.length === 3) {
        fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        
        if (isNaN(fecha.getTime())) {
          throw new Error('Fecha inválida. Use formato DD/MM/YYYY');
        }
      } else {
        throw new Error('Formato de fecha inválido. Use DD/MM/YYYY');
      }
    }
    
    // Generar reporte
    const reporte = await reportGenerator.generateDailyReport(fecha);
    
    if (!reporte) {
      throw new Error('No se pudo generar el reporte');
    }
    
    await bot.sendMessage(chatId, reporte, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error generando reporte:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al generar reporte: ' + error.message
    );
  }
}

/**
 * Comando /resumen - Resumen rápido del día
 */
async function generarResumen(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    // Obtener estadísticas del día
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT user_id) as usuarios_activos,
        COUNT(DISTINCT tv.location_id) as sucursales_visitadas,
        COUNT(*) as total_visitas
      FROM tracking_visits tv
      WHERE DATE(tv.entry_time) = CURRENT_DATE
        AND tv.exit_time IS NOT NULL
    `);
    
    const { usuarios_activos, sucursales_visitadas, total_visitas } = stats.rows[0];
    
    // Obtener total de sucursales
    const totalSucursalesResult = await db.query(`
      SELECT COUNT(*) as total 
      FROM tracking_locations 
      WHERE is_active = true
    `);
    const totalSucursales = totalSucursalesResult.rows[0].total;
    
    // Calcular cobertura
    const cobertura = totalSucursales > 0 
      ? Math.round((sucursales_visitadas / totalSucursales) * 100)
      : 0;
    
    const resumen = `📊 *RESUMEN DEL DÍA*\n` +
      `${new Date().toLocaleDateString('es-MX')}\n\n` +
      `👥 Supervisores activos: ${usuarios_activos}\n` +
      `🏢 Sucursales visitadas: ${sucursales_visitadas}/${totalSucursales}\n` +
      `📍 Total visitas: ${total_visitas}\n` +
      `📈 Cobertura: ${cobertura}%`;
    
    await bot.sendMessage(chatId, resumen, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error generando resumen:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al generar resumen: ' + error.message
    );
  }
}

/**
 * Comando /cobertura - Ver cobertura de sucursales
 */
async function verCobertura(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    // Obtener sucursales no visitadas hoy
    const noVisitadas = await db.query(`
      SELECT 
        tl.location_code,
        tl.name,
        tlc.group_name
      FROM tracking_locations tl
      LEFT JOIN tracking_locations_cache tlc 
        ON tl.location_code = tlc.location_code
      WHERE tl.is_active = true
        AND tl.id NOT IN (
          SELECT DISTINCT location_id 
          FROM tracking_visits 
          WHERE DATE(entry_time) = CURRENT_DATE
        )
      ORDER BY tlc.group_name, tl.name
      LIMIT 20
    `);
    
    if (noVisitadas.rows.length === 0) {
      await bot.sendMessage(chatId, 
        '✅ *¡Excelente!* Todas las sucursales han sido visitadas hoy',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    let mensaje = '🔴 *SUCURSALES NO VISITADAS HOY*\n\n';
    
    noVisitadas.rows.forEach(suc => {
      mensaje += `📍 ${suc.name}\n`;
      mensaje += `   Código: ${suc.location_code}\n`;
      if (suc.group_name) {
        mensaje += `   Grupo: ${suc.group_name}\n`;
      }
      mensaje += '\n';
    });
    
    if (noVisitadas.rows.length === 20) {
      mensaje += '_...y más sucursales_';
    }
    
    await bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error viendo cobertura:', error);
    await bot.sendMessage(chatId, 
      '❌ Error al ver cobertura: ' + error.message
    );
  }
}

module.exports = {
  generarReporte,
  generarResumen,
  verCobertura
};