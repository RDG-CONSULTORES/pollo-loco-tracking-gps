const cron = require('node-cron');
const dailyReportJob = require('./daily-report.job');

/**
 * Scheduler para trabajos programados
 */
class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.running = false;
  }
  
  /**
   * Programar trabajo
   */
  schedule(name, cronExpression, task) {
    try {
      console.log(`📋 Programando trabajo: ${name}`);
      
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
      console.log('🛑 Deteniendo scheduler...');
      
      for (const [name, job] of this.jobs) {
        job.task.stop();
        console.log(`⏹️ Trabajo detenido: ${name}`);
      }
      
      this.running = false;
      console.log('✅ Scheduler detenido');
      
    } catch (error) {
      console.error('❌ Error deteniendo scheduler:', error.message);
    }
  }
  
  /**
   * Iniciar scheduler con trabajos por defecto
   */
  start() {
    try {
      console.log('🚀 Iniciando scheduler...');
      
      // Reporte diario
      this.schedule('daily-report', '0 8 * * *', dailyReportJob);
      
      this.running = true;
      console.log('✅ Scheduler iniciado');
      
    } catch (error) {
      console.error('❌ Error iniciando scheduler:', error.message);
    }
  }
  
  /**
   * Status del scheduler
   */
  getStatus() {
    return {
      running: this.running,
      jobs: Array.from(this.jobs.keys()),
      count: this.jobs.size
    };
  }
}

// Exportar instancia única
module.exports = new JobScheduler();