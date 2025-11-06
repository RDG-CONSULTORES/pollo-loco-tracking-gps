const db = require('../config/database');

/**
 * Generador de reportes diarios
 */
class ReportGenerator {
  
  /**
   * Generar reporte diario completo
   */
  async generateDailyReport(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // 1. Obtener estadísticas generales
      const stats = await this.getDailyStats(dateStr);
      
      // 2. Obtener actividad por usuario
      const userActivity = await this.getUserActivity(dateStr);
      
      // 3. Obtener sucursales visitadas
      const visitedLocations = await this.getVisitedLocations(dateStr);
      
      // 4. Obtener sucursales no visitadas
      const unvisitedLocations = await this.getUnvisitedLocations(dateStr);
      
      // 5. Construir reporte
      return this.buildReport(dateStr, stats, userActivity, visitedLocations, unvisitedLocations);
      
    } catch (error) {
      console.error('Error generando reporte:', error);
      return null;
    }
  }
  
  /**
   * Obtener estadísticas generales del día
   */
  async getDailyStats(dateStr) {
    const result = await db.query(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT location_id) as visited_locations,
        COUNT(*) as total_visits,
        AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/60)::int as avg_duration_minutes,
        SUM(EXTRACT(EPOCH FROM (exit_time - entry_time))/3600)::int as total_hours
      FROM tracking_visits
      WHERE DATE(entry_time) = $1::date
        AND exit_time IS NOT NULL
    `, [dateStr]);
    
    const totalLocationsResult = await db.query(`
      SELECT COUNT(*) as total 
      FROM tracking_locations 
      WHERE is_active = true
    `);
    
    return {
      ...result.rows[0],
      total_locations: parseInt(totalLocationsResult.rows[0].total),
      coverage_percent: Math.round((result.rows[0].visited_locations / totalLocationsResult.rows[0].total) * 100) || 0
    };
  }
  
  /**
   * Obtener actividad por usuario
   */
  async getUserActivity(dateStr) {
    const result = await db.query(`
      SELECT 
        tu.display_name,
        tu.tracker_id,
        COUNT(DISTINCT tv.location_id) as locations_visited,
        COUNT(*) as total_visits,
        MIN(tv.entry_time) as first_visit,
        MAX(tv.exit_time) as last_visit,
        SUM(EXTRACT(EPOCH FROM (tv.exit_time - tv.entry_time))/3600)::decimal(10,1) as total_hours
      FROM tracking_visits tv
      JOIN tracking_users tu ON tv.user_id = tu.id
      WHERE DATE(tv.entry_time) = $1::date
        AND tv.exit_time IS NOT NULL
      GROUP BY tu.id, tu.display_name, tu.tracker_id
      ORDER BY locations_visited DESC, total_hours DESC
    `, [dateStr]);
    
    return result.rows;
  }
  
  /**
   * Obtener sucursales visitadas
   */
  async getVisitedLocations(dateStr) {
    const result = await db.query(`
      SELECT 
        tl.location_code,
        tl.name,
        tlc.group_name,
        COUNT(DISTINCT tv.user_id) as visitor_count,
        COUNT(*) as visit_count,
        AVG(EXTRACT(EPOCH FROM (tv.exit_time - tv.entry_time))/60)::int as avg_duration_minutes
      FROM tracking_visits tv
      JOIN tracking_locations tl ON tv.location_id = tl.id
      LEFT JOIN tracking_locations_cache tlc ON tl.location_code = tlc.location_code
      WHERE DATE(tv.entry_time) = $1::date
        AND tv.exit_time IS NOT NULL
      GROUP BY tl.id, tl.location_code, tl.name, tlc.group_name
      ORDER BY visit_count DESC
      LIMIT 20
    `, [dateStr]);
    
    return result.rows;
  }
  
  /**
   * Obtener sucursales no visitadas
   */
  async getUnvisitedLocations(dateStr) {
    const result = await db.query(`
      SELECT 
        tl.location_code,
        tl.name,
        tlc.group_name,
        tlc.director_name
      FROM tracking_locations tl
      LEFT JOIN tracking_locations_cache tlc ON tl.location_code = tlc.location_code
      WHERE tl.is_active = true
        AND tl.id NOT IN (
          SELECT DISTINCT location_id 
          FROM tracking_visits 
          WHERE DATE(entry_time) = $1::date
        )
      ORDER BY tlc.group_name, tl.name
      LIMIT 10
    `, [dateStr]);
    
    return result.rows;
  }
  
  /**
   * Construir mensaje de reporte
   */
  buildReport(dateStr, stats, userActivity, visitedLocations, unvisitedLocations) {
    const fecha = new Date(dateStr + 'T12:00:00');
    const fechaStr = fecha.toLocaleDateString('es-MX', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let report = `📊 *REPORTE DIARIO DE SUPERVISIÓN*\n`;
    report += `📅 ${fechaStr}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Resumen general
    report += `📈 *RESUMEN GENERAL*\n`;
    report += `• Supervisores activos: ${stats.active_users || 0}\n`;
    report += `• Sucursales visitadas: ${stats.visited_locations || 0}/${stats.total_locations || 0}\n`;
    report += `• Cobertura: ${stats.coverage_percent || 0}%\n`;
    report += `• Total de visitas: ${stats.total_visits || 0}\n`;
    report += `• Duración promedio: ${stats.avg_duration_minutes || 0} min\n`;
    report += `• Horas totales: ${stats.total_hours || 0}h\n\n`;
    
    // Top supervisores
    if (userActivity.length > 0) {
      report += `👥 *TOP SUPERVISORES*\n`;
      userActivity.slice(0, 5).forEach((user, index) => {
        report += `${index + 1}. *${user.display_name}*\n`;
        report += `   📍 ${user.locations_visited} sucursales\n`;
        report += `   ⏱️ ${user.total_hours}h trabajadas\n`;
      });
      report += '\n';
    }
    
    // Sucursales más visitadas
    if (visitedLocations.length > 0) {
      report += `🏢 *SUCURSALES MÁS VISITADAS*\n`;
      visitedLocations.slice(0, 5).forEach(loc => {
        report += `• ${loc.name}\n`;
        report += `  ${loc.visit_count} visitas, ${loc.avg_duration_minutes} min promedio\n`;
      });
      report += '\n';
    }
    
    // Sucursales no visitadas
    if (unvisitedLocations.length > 0) {
      report += `⚠️ *SUCURSALES NO VISITADAS*\n`;
      unvisitedLocations.forEach(loc => {
        report += `• ${loc.name}`;
        if (loc.group_name) report += ` (${loc.group_name})`;
        report += '\n';
      });
      
      if (unvisitedLocations.length === 10) {
        report += '_...y más sucursales_\n';
      }
    } else {
      report += `✅ *¡Todas las sucursales fueron visitadas!*\n`;
    }
    
    report += `\n⏰ _Reporte generado: ${new Date().toLocaleTimeString('es-MX')}_`;
    
    return report;
  }
  
  /**
   * Generar resumen ejecutivo (versión corta)
   */
  async generateExecutiveSummary(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    const stats = await this.getDailyStats(dateStr);
    
    let summary = `📊 *RESUMEN EJECUTIVO*\n`;
    summary += `${date.toLocaleDateString('es-MX')}\n\n`;
    summary += `👥 Supervisores: ${stats.active_users || 0}\n`;
    summary += `📍 Cobertura: ${stats.coverage_percent || 0}%\n`;
    summary += `🏢 Sucursales: ${stats.visited_locations || 0}/${stats.total_locations || 0}\n`;
    
    // Indicador visual de cobertura
    if (stats.coverage_percent >= 90) {
      summary += '\n✅ Excelente cobertura';
    } else if (stats.coverage_percent >= 70) {
      summary += '\n⚠️ Cobertura aceptable';
    } else {
      summary += '\n❌ Cobertura baja';
    }
    
    return summary;
  }
}

module.exports = new ReportGenerator();