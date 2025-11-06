const db = require('../config/database');

/**
 * Job para generar reporte diario automático
 */
class DailyReportJob {
  
  /**
   * Generar y enviar reporte diario
   */
  async generateDailyReport(date = null) {
    try {
      const reportDate = date || new Date().toISOString().split('T')[0];
      
      console.log(`📊 Generando reporte diario para: ${reportDate}`);
      
      // 1. Obtener métricas generales
      const generalMetrics = await this.getGeneralMetrics(reportDate);
      
      // 2. Obtener top supervisores
      const topSupervisors = await this.getTopSupervisors(reportDate);
      
      // 3. Obtener sucursales pendientes
      const pendingLocations = await this.getPendingLocations(reportDate);
      
      // 4. Obtener estadísticas de cobertura
      const coverage = await this.getCoverageStats(reportDate);
      
      // 5. Formatear reporte
      const report = this.formatReport(reportDate, {
        general: generalMetrics,
        supervisors: topSupervisors,
        pending: pendingLocations,
        coverage
      });
      
      // 6. Enviar por Telegram
      await this.sendReport(report);
      
      console.log('✅ Reporte diario enviado exitosamente');
      
      return { success: true, report };
      
    } catch (error) {
      console.error('❌ Error generando reporte diario:', error.message);
      throw error;
    }
  }
  
  /**
   * Obtener métricas generales del día
   */
  async getGeneralMetrics(date) {
    const result = await db.query(`
      SELECT 
        COUNT(DISTINCT v.tracker_id) as supervisores_activos,
        COUNT(DISTINCT v.location_code) as sucursales_visitadas,
        COUNT(*) as total_visitas,
        COUNT(*) FILTER (WHERE v.salida_at IS NOT NULL) as visitas_completadas,
        COUNT(*) FILTER (WHERE v.salida_at IS NULL) as visitas_abiertas,
        ROUND(AVG(v.duracion_minutos)::numeric, 0) as duracion_promedio,
        SUM(v.duracion_minutos) as tiempo_total_min,
        
        -- Calidad de visitas
        COUNT(*) FILTER (WHERE v.duracion_minutos < 30) as visitas_cortas,
        COUNT(*) FILTER (WHERE v.duracion_minutos BETWEEN 30 AND 90) as visitas_normales,
        COUNT(*) FILTER (WHERE v.duracion_minutos > 90) as visitas_largas,
        
        -- Horarios
        MIN(v.entrada_at) as primera_visita,
        MAX(v.entrada_at) as ultima_visita
      FROM tracking_visits v
      WHERE DATE(v.entrada_at) = $1
        AND v.is_valid = true
    `, [date]);
    
    return result.rows[0];
  }
  
  /**
   * Obtener top supervisores del día
   */
  async getTopSupervisors(date, limit = 5) {
    const result = await db.query(`
      SELECT 
        v.tracker_id,
        tu.display_name,
        COUNT(*) as total_visitas,
        COUNT(DISTINCT v.location_code) as sucursales_unicas,
        ROUND(AVG(v.duracion_minutos)::numeric, 0) as duracion_promedio,
        SUM(v.duracion_minutos) as tiempo_total_min,
        MIN(v.entrada_at) as primera_visita,
        MAX(v.entrada_at) as ultima_visita
      FROM tracking_visits v
      LEFT JOIN tracking_users tu ON v.tracker_id = tu.tracker_id
      WHERE DATE(v.entrada_at) = $1
        AND v.is_valid = true
        AND v.salida_at IS NOT NULL
      GROUP BY v.tracker_id, tu.display_name
      ORDER BY total_visitas DESC, sucursales_unicas DESC
      LIMIT $2
    `, [date, limit]);
    
    return result.rows;
  }
  
  /**
   * Obtener sucursales no visitadas
   */
  async getPendingLocations(date, limit = 10) {
    const result = await db.query(`
      SELECT 
        lc.location_code,
        lc.name,
        lc.group_name,
        lc.director_name
      FROM tracking_locations_cache lc
      WHERE lc.active = true
        AND lc.location_code NOT IN (
          SELECT DISTINCT location_code 
          FROM tracking_visits 
          WHERE DATE(entrada_at) = $1
            AND is_valid = true
        )
      ORDER BY lc.group_name, lc.name
      LIMIT $2
    `, [date, limit]);
    
    return result.rows;
  }
  
  /**
   * Obtener estadísticas de cobertura
   */
  async getCoverageStats(date) {
    const result = await db.query(`
      SELECT 
        -- Total de sucursales
        (SELECT COUNT(*) FROM tracking_locations_cache WHERE active = true) as total_sucursales,
        
        -- Sucursales visitadas
        COUNT(DISTINCT v.location_code) as sucursales_visitadas,
        
        -- Por grupo/región
        json_agg(
          json_build_object(
            'group_name', lc.group_name,
            'visitadas', COUNT(DISTINCT v.location_code),
            'total', COUNT(DISTINCT lc.location_code)
          )
        ) as coverage_by_group
      FROM tracking_locations_cache lc
      LEFT JOIN tracking_visits v ON lc.location_code = v.location_code 
        AND DATE(v.entrada_at) = $1
        AND v.is_valid = true
      WHERE lc.active = true
      GROUP BY lc.group_name
    `, [date]);
    
    return result.rows[0];
  }
  
  /**
   * Formatear reporte en texto
   */
  formatReport(date, data) {
    const { general, supervisors, pending, coverage } = data;
    
    // Calcular cobertura
    const coveragePercentage = coverage.total_sucursales > 0 ? 
      Math.round((coverage.sucursales_visitadas / coverage.total_sucursales) * 100) : 0;
    
    // Formatear fecha
    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    let report = `
📊 **REPORTE DIARIO POLLO LOCO**
📅 ${formattedDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 **COBERTURA**
• Sucursales visitadas: ${coverage.sucursales_visitadas}/${coverage.total_sucursales} (${coveragePercentage}%)
• Total visitas: ${general.total_visitas || 0}
• Visitas completadas: ${general.visitas_completadas || 0}
• Duración promedio: ${general.duracion_promedio || 0} min

👥 **SUPERVISORES ACTIVOS: ${general.supervisores_activos || 0}**

`;

    // Top supervisores
    if (supervisors.length > 0) {
      supervisors.forEach((supervisor, index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        const horas = Math.round((supervisor.tiempo_total_min || 0) / 60 * 10) / 10;
        
        report += `${emoji} **${supervisor.display_name || supervisor.tracker_id}**\n`;
        report += `   📍 ${supervisor.total_visitas} visitas • ${supervisor.sucursales_unicas} sucursales\n`;
        report += `   ⏱️ ${horas}h total • ${supervisor.duracion_promedio}m promedio\n\n`;
      });
    }
    
    // Calidad de visitas
    if (general.total_visitas > 0) {
      report += `📊 **CALIDAD DE VISITAS**\n`;
      report += `• Cortas (<30m): ${general.visitas_cortas || 0}\n`;
      report += `• Normales (30-90m): ${general.visitas_normales || 0}\n`;
      report += `• Largas (>90m): ${general.visitas_largas || 0}\n\n`;
    }
    
    // Horarios
    if (general.primera_visita && general.ultima_visita) {
      const primeraHora = new Date(general.primera_visita).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const ultimaHora = new Date(general.ultima_visita).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      report += `⏰ **HORARIOS**\n`;
      report += `• Primera visita: ${primeraHora}\n`;
      report += `• Última visita: ${ultimaHora}\n\n`;
    }
    
    // Sucursales pendientes
    if (pending.length > 0) {
      report += `⚠️ **SUCURSALES PENDIENTES** (${pending.length})\n`;
      pending.forEach(location => {
        report += `• ${location.name}`;
        if (location.group_name) {
          report += ` (${location.group_name})`;
        }
        report += `\n`;
      });
      report += `\n`;
    }
    
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🤖 Reporte generado automáticamente\n`;
    report += `⏰ ${new Date().toLocaleString('es-MX')}`;
    
    return report;
  }
  
  /**
   * Enviar reporte por Telegram
   */
  async sendReport(report) {
    try {
      const { getBot } = require('../telegram/bot');
      const bot = getBot();
      
      if (!bot) {
        console.warn('⚠️ Bot no disponible para enviar reporte');
        return;
      }
      
      // Enviar a todos los administradores
      const result = await bot.broadcastToAdmins(report, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
      console.log(`📡 Reporte enviado: ${result.successful} exitosos, ${result.failed} fallidos`);
      
    } catch (error) {
      console.error('❌ Error enviando reporte:', error.message);
      throw error;
    }
  }
  
  /**
   * Generar reporte para fecha específica (manual)
   */
  async generateCustomReport(date, chatId = null) {
    try {
      const result = await this.generateDailyReport(date);
      
      if (chatId) {
        const { getBot } = require('../telegram/bot');
        const bot = getBot();
        
        if (bot) {
          await bot.sendMessage(chatId, result.report, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          });
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error generando reporte personalizado:', error.message);
      throw error;
    }
  }
}

module.exports = new DailyReportJob();