/**
 * Servicio generador de QR para configuración automática OwnTracks
 */

const QRCode = require('qrcode');
const crypto = require('crypto');
const { Pool } = require('pg');

class QRGeneratorService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.baseUrl = process.env.BASE_URL || 'https://pollo-loco-tracking-gps-production.up.railway.app';
  }
  
  /**
   * Generar configuración OwnTracks optimizada para usuario
   */
  async generateOwnTracksConfig(userId, userRole = 'employee') {
    try {
      // Obtener datos del usuario
      const user = await this.pool.query(
        'SELECT * FROM tracking_users WHERE id = $1',
        [userId]
      );
      
      if (user.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }
      
      const userData = user.rows[0];
      
      // Configuración base optimizada
      const config = {
        "_type": "configuration",
        "_version": "1.0",
        "_company": "Pollo Loco GPS",
        
        // Conexión MQTT optimizada
        "host": "pollo-loco-tracking-gps-production.up.railway.app",
        "port": 443,
        "ws": true,
        "tls": true,
        
        // Credenciales únicas por usuario
        "username": `polloLoco_${userData.tracker_id}`,
        "password": this.generateSecurePassword(userData.id),
        "deviceId": `PL_${userData.tracker_id}`,
        "tid": userData.tracker_id,
        
        // Configuración geofencing optimizada
        "locatorInterval": userRole === 'admin' ? 10 : 15,
        "locatorDisplacement": 5,
        "monitoring": 2,  // Alto rendimiento
        "ranging": true,
        "ignoreInaccurateLocations": 30,
        
        // Configuración empresarial
        "pubRetain": false,
        "cleanSession": true,
        "keepalive": 60,
        "autostartOnBoot": true,
        
        // Topic personalizado
        "pubTopicBase": `owntracks/${userData.tracker_id}`,
        
        // Configuración de reportes
        "pubInterval": 30,  // Reportar cada 30 segundos cuando activo
        "moveModeLocatorInterval": userRole === 'admin' ? 5 : 10,
        
        // Modo ahorro batería inteligente
        "ignoreStaleLocations": 300,
        "locatorPriority": 2,
        
        // Branding empresa
        "clientId": `PolloLoco_${userData.display_name.replace(/\s+/g, '_')}`,
        "_instructions": `${this.baseUrl}/setup-instructions`,
        "_support": "roberto@pollolocogps.com"
      };
      
      return config;
      
    } catch (error) {
      console.error('❌ Error generando config:', error.message);
      throw error;
    }
  }
  
  /**
   * Generar QR code para configuración
   */
  async generateQRCode(userId, format = 'base64') {
    try {
      const config = await this.generateOwnTracksConfig(userId);
      
      // Crear URL de configuración
      const configUrl = `${this.baseUrl}/api/owntracks/config/${userId}`;
      
      // Para OwnTracks, necesitamos una URL especial
      const ownTracksUrl = `owntracks:///config?url=${encodeURIComponent(configUrl)}`;
      
      // Generar QR
      const qrOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 300
      };
      
      let qrCode;
      if (format === 'base64') {
        qrCode = await QRCode.toDataURL(ownTracksUrl, qrOptions);
      } else {
        qrCode = await QRCode.toBuffer(ownTracksUrl, qrOptions);
      }
      
      // Guardar en base de datos
      await this.saveQRRecord(userId, configUrl, ownTracksUrl);
      
      return {
        qrCode,
        configUrl,
        ownTracksUrl,
        config: JSON.stringify(config, null, 2)
      };
      
    } catch (error) {
      console.error('❌ Error generando QR:', error.message);
      throw error;
    }
  }
  
  /**
   * Guardar registro de QR generado
   */
  async saveQRRecord(userId, configUrl, ownTracksUrl) {
    try {
      await this.pool.query(`
        INSERT INTO qr_codes (user_id, config_url, owntracks_url, generated_at, active)
        VALUES ($1, $2, $3, NOW(), true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          config_url = EXCLUDED.config_url,
          owntracks_url = EXCLUDED.owntracks_url,
          generated_at = NOW(),
          active = true
      `, [userId, configUrl, ownTracksUrl]);
      
      console.log(`✅ QR record guardado para usuario ${userId}`);
      
    } catch (error) {
      console.error(`❌ Error guardando QR record usuario ${userId}:`, error.message);
    }
  }
  
  /**
   * Generar password segura para usuario
   */
  generateSecurePassword(userId) {
    const baseStr = `PLGps_${userId}_${Date.now()}`;
    return crypto.createHash('sha256').update(baseStr).digest('hex').substring(0, 16);
  }
  
  /**
   * Verificar si configuración fue aplicada
   */
  async verifyConfigurationApplied(userId) {
    try {
      // Verificar si hay ubicaciones recientes del usuario
      const recent = await this.pool.query(`
        SELECT COUNT(*) as count
        FROM gps_locations 
        WHERE user_id = $1 
          AND gps_timestamp >= NOW() - INTERVAL '1 hour'
      `, [userId]);
      
      return parseInt(recent.rows[0].count) > 0;
      
    } catch (error) {
      console.error(`❌ Error verificando configuración usuario ${userId}:`, error.message);
      return false;
    }
  }
}

module.exports = new QRGeneratorService();