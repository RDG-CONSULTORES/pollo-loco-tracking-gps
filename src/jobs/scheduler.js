const cron = require('node-cron');
const dailyReportJob = require('./daily-report.job');
const syncZenputJob = require('./sync-zenput.job');

/**
 * Scheduler para trabajos programados
 */
class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }
  
  /**
   * Inicializar y programar todos los trabajos
   */
  start() {
    try {
      console.log('⏰ Iniciando scheduler de trabajos...');
      
      // Reporte diario - 9:00 PM todos los días
      this.scheduleJob('daily-report', '0 21 * * *', async () => {
        console.log('📊 Ejecutando reporte diario...');
        await dailyReportJob.generateDailyReport();
      });
      
      // Sincronización Zenput - cada 6 horas
      this.scheduleJob('sync-zenput', '0 */6 * * *', async () => {
        console.log('🔄 Ejecutando sincronización Zenput...');
        await syncZenputJob.syncZenputData();
      });
      
      // Limpieza de datos antiguos - 2:00 AM todos los días
      this.scheduleJob('cleanup', '0 2 * * *', async () => {
        console.log('🧹 Ejecutando limpieza de datos...');
        await this.runCleanup();
      });
      
      // Health check cada 5 minutos
      this.scheduleJob('health-check', '*/5 * * * *', async () => {
        await this.runHealthCheck();
      });
      
      this.isRunning = true;
      console.log(`✅ Scheduler iniciado con ${this.jobs.size} trabajos`);
      
    } catch (error) {
      console.error('❌ Error iniciando scheduler:', error.message);
    }
  }
  
  /**
   * Programar un trabajo
   */
  scheduleJob(name, cronExpression, taskFunction) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        const startTime = Date.now();
        
        try {
          console.log(`⚡ Iniciando trabajo: ${name}`);
          await taskFunction();
          
          const duration = Date.now() - startTime;
          console.log(`✅ Trabajo completado: ${name} (${duration}ms)`);
          
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ Error en trabajo ${name} (${duration}ms):`, error.message);
          
          // Notificar error crítico
          if (name === 'daily-report' || name === 'sync-zenput') {
            await this.notifyError(name, error);
          }
        }
      }, {
        scheduled: false // No iniciar automáticamente
      });
      
      this.jobs.set(name, {
        task,
        cron: cronExpression,
        lastRun: null,
        errors: 0
      });
      
      // Iniciar el trabajo
      task.start();
      
      console.log(`📅 Trabajo programado: ${name} (${cronExpression})`);
      
    } catch (error) {
      console.error(`❌ Error programando trabajo ${name}:`, error.message);
    }
  }
  
  /**
   * Detener scheduler
   */
  stop() {
    try {
      this.jobs.forEach((job, name) => {
        job.task.stop();
        console.log(`⏹️ Trabajo detenido: ${name}`);
      });
      
      this.jobs.clear();
      this.isRunning = false;
      
      console.log('✅ Scheduler detenido');
      
    } catch (error) {
      console.error('❌ Error deteniendo scheduler:', error.message);
    }
  }
  
  /**
   * Ejecutar trabajo manualmente
   */
  async runJob(name) {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Trabajo no encontrado: ${name}`);
    }
    
    console.log(`🔄 Ejecutando trabajo manual: ${name}`);
    
    // Ejecutar la función del trabajo directamente
    // (sin esperar al cron)
    job.task._task();
  }
  
  /**
   * Obtener estado de trabajos
   */
  getJobStatus() {
    const status = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = {
        cron: job.cron,
        running: job.task.running,
        lastRun: job.lastRun,
        errors: job.errors
      };
    });
    
    return {
      isRunning: this.isRunning,
      totalJobs: this.jobs.size,
      jobs: status
    };
  }
  
  /**
   * Limpieza de datos antiguos
   */
  async runCleanup() {
    try {
      const locationProcessor = require('../services/location-processor');
      const visitDetector = require('../services/visit-detector');
      
      // Limpiar ubicaciones antiguas (30 días)
      const deletedLocations = await locationProcessor.cleanupOldLocations(30);
      
      // Limpiar visitas inválidas
      const cleanupResult = await visitDetector.cleanupInvalidVisits();
      
      console.log(`🧹 Limpieza completada: ${deletedLocations} ubicaciones, ${cleanupResult.short_visits} visitas cortas`);
      
    } catch (error) {
      console.error('❌ Error en limpieza:', error.message);
    }
  }
  
  /**
   * Health check del sistema
   */
  async runHealthCheck() {
    try {
      const db = require('../config/database');
      
      // Test básico de BD
      await db.query('SELECT 1');
      
      // Verificar si hay usuarios activos sin ubicaciones recientes
      const result = await db.query(`
        SELECT COUNT(*) as inactive_users
        FROM tracking_users tu
        WHERE tu.active = true
      `);
      
      const inactiveUsers = parseInt(result.rows[0].inactive_users);
      
      if (inactiveUsers > 2) {
        console.warn(`⚠️ Health check: ${inactiveUsers} usuarios sin GPS reciente`);
      }
      
    } catch (error) {
      console.error('❌ Error en health check:', error.message);
    }
  }
  
  /**
   * Notificar errores críticos
   */
  async notifyError(jobName, error) {
    try {
      const { getBot } = require('../telegram/bot');
      const bot = getBot();
      
      if (!bot) return;
      
      const message = `
🚨 *ERROR EN TRABAJO PROGRAMADO*

📋 *Trabajo:* ${jobName}
❌ *Error:* ${error.message}
⏰ *Hora:* ${new Date().toLocaleString('es-MX')}

Por favor revisar logs del sistema.
`;
      
      await bot.broadcastToAdmins(message);
      
    } catch (notifyError) {
      console.error('❌ Error notificando error:', notifyError.message);
    }
  }
}

// Singleton instance
const scheduler = new JobScheduler();

module.exports = scheduler;