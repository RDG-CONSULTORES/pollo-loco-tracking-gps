const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

/**
 * Gestor de WebSocket para actualizaciones en tiempo real
 * Maneja conexiones de clientes y distribución de eventos
 */
class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map<clientId, {ws, userId, roles}>
    this.subscriptions = new Map(); // Map<clientId, Set<eventTypes>>
  }

  /**
   * Inicializar servidor WebSocket
   */
  initialize(server) {
    console.log('🔌 Inicializando WebSocket server...');
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('✅ WebSocket server inicializado en /ws');
  }

  /**
   * Manejar nueva conexión WebSocket
   */
  async handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    console.log(`🔗 Nueva conexión WebSocket: ${clientId}`);

    try {
      // Verificar autenticación
      let userData = null;
      if (token) {
        userData = await this.verifyToken(token);
      }

      // Registrar cliente
      this.clients.set(clientId, {
        ws,
        userData,
        roles: userData?.roles || ['guest'],
        connectedAt: new Date(),
        lastPing: new Date()
      });

      this.subscriptions.set(clientId, new Set());

      // Configurar manejadores de eventos
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('error', (error) => this.handleError(clientId, error));
      ws.on('pong', () => this.handlePong(clientId));

      // Enviar mensaje de bienvenida
      this.send(clientId, {
        type: 'connection_established',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Conectado al sistema de tracking en tiempo real'
      });

      // Enviar estado inicial
      await this.sendInitialState(clientId);

      console.log(`✅ Cliente WebSocket registrado: ${clientId} (${userData?.display_name || 'guest'})`);

    } catch (error) {
      console.error(`❌ Error en conexión WebSocket ${clientId}:`, error.message);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Manejar mensajes del cliente
   */
  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      console.log(`📨 Mensaje WebSocket de ${clientId}:`, message.type);

      switch (message.type) {
        case 'subscribe':
          await this.handleSubscription(clientId, message);
          break;
          
        case 'unsubscribe':
          await this.handleUnsubscription(clientId, message);
          break;
          
        case 'request_current_locations':
          await this.sendCurrentLocations(clientId);
          break;
          
        case 'request_geofences':
          await this.sendGeofences(clientId);
          break;
          
        case 'ping':
          this.handlePing(clientId);
          break;
          
        default:
          console.log(`⚠️ Tipo de mensaje desconocido: ${message.type}`);
      }

    } catch (error) {
      console.error(`❌ Error procesando mensaje de ${clientId}:`, error.message);
      this.send(clientId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Manejar suscripciones a eventos
   */
  async handleSubscription(clientId, message) {
    const client = this.clients.get(clientId);
    const subscriptions = this.subscriptions.get(clientId);
    
    if (!client || !subscriptions) return;

    const { events, filters } = message;

    // Verificar permisos para cada evento
    for (const eventType of events) {
      if (await this.hasPermissionForEvent(client, eventType, filters)) {
        subscriptions.add(eventType);
        console.log(`📡 Cliente ${clientId} suscrito a: ${eventType}`);
      } else {
        console.log(`🚫 Cliente ${clientId} sin permisos para: ${eventType}`);
      }
    }

    // Confirmar suscripción
    this.send(clientId, {
      type: 'subscription_confirmed',
      events: Array.from(subscriptions),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Verificar permisos para eventos específicos
   */
  async hasPermissionForEvent(client, eventType, filters) {
    const roles = client.roles || ['guest'];

    switch (eventType) {
      case 'location_updates':
        return roles.includes('auditor') || roles.includes('director') || roles.includes('gerente');
        
      case 'geofence_events':
        return roles.includes('auditor') || roles.includes('director') || roles.includes('gerente');
        
      case 'system_alerts':
        return roles.includes('auditor') || roles.includes('admin');
        
      case 'user_status':
        return roles.includes('auditor') || roles.includes('director');
        
      default:
        return false;
    }
  }

  /**
   * Enviar estado inicial al cliente
   */
  async sendInitialState(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Enviar ubicaciones actuales
      await this.sendCurrentLocations(clientId);
      
      // Enviar geofences visibles
      await this.sendGeofences(clientId);
      
      // Enviar estadísticas del sistema
      await this.sendSystemStats(clientId);

    } catch (error) {
      console.error(`❌ Error enviando estado inicial a ${clientId}:`, error);
    }
  }

  /**
   * Enviar ubicaciones actuales
   */
  async sendCurrentLocations(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const locationProcessor = require('./location-processor');
      const locations = await locationProcessor.getCurrentLocations();
      
      // Filtrar ubicaciones según permisos
      const filteredLocations = await this.filterLocationsByPermissions(client, locations);

      this.send(clientId, {
        type: 'current_locations',
        data: filteredLocations,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error enviando ubicaciones actuales:', error);
    }
  }

  /**
   * Enviar geofences (sucursales)
   */
  async sendGeofences(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await db.query(`
        SELECT 
          id,
          location_code,
          location_name,
          grupo,
          latitude,
          longitude,
          radius_meters,
          active
        FROM geofences 
        WHERE active = true
        ORDER BY location_name
      `);

      // Filtrar geofences según permisos de grupo
      const filteredGeofences = await this.filterGeofencesByPermissions(client, result.rows);

      this.send(clientId, {
        type: 'geofences',
        data: filteredGeofences,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error enviando geofences:', error);
    }
  }

  /**
   * Enviar estadísticas del sistema
   */
  async sendSystemStats(clientId) {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT tu.id) as active_users,
          COUNT(gl.id) as locations_today,
          COUNT(DISTINCT CASE WHEN gl.gps_timestamp >= NOW() - INTERVAL '1 hour' THEN tu.id END) as users_active_last_hour
        FROM tracking_users tu
        LEFT JOIN gps_locations gl ON tu.id = gl.user_id 
          AND gl.gps_timestamp >= CURRENT_DATE
        WHERE tu.active = true
      `);

      this.send(clientId, {
        type: 'system_stats',
        data: stats.rows[0],
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error enviando estadísticas:', error);
    }
  }

  /**
   * Filtrar ubicaciones según permisos del usuario
   */
  async filterLocationsByPermissions(client, locations) {
    const roles = client.roles || ['guest'];
    
    // Auditores ven todo
    if (roles.includes('auditor') || roles.includes('admin')) {
      return locations;
    }
    
    // Directores y Gerentes ven solo su grupo
    if (roles.includes('director') || roles.includes('gerente')) {
      const userGroup = client.userData?.grupo;
      if (userGroup) {
        return locations.filter(loc => loc.grupo === userGroup);
      }
    }
    
    // Otros roles no ven ubicaciones
    return [];
  }

  /**
   * Filtrar geofences según permisos del usuario
   */
  async filterGeofencesByPermissions(client, geofences) {
    const roles = client.roles || ['guest'];
    
    // Auditores ven todo
    if (roles.includes('auditor') || roles.includes('admin')) {
      return geofences;
    }
    
    // Directores y Gerentes ven solo su grupo
    if (roles.includes('director') || roles.includes('gerente')) {
      const userGroup = client.userData?.grupo;
      if (userGroup) {
        return geofences.filter(gf => gf.grupo === userGroup);
      }
    }
    
    return geofences; // Las sucursales son públicas
  }

  /**
   * Broadcast de eventos en tiempo real
   */
  broadcastLocationUpdate(locationData, userData) {
    const message = {
      type: 'location_update',
      data: {
        user: {
          id: userData.id,
          tracker_id: userData.tracker_id,
          display_name: userData.display_name,
          grupo: userData.grupo
        },
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          battery: locationData.battery,
          velocity: locationData.velocity,
          timestamp: locationData.gps_timestamp
        }
      },
      timestamp: new Date().toISOString()
    };

    this.broadcastToSubscribers('location_updates', message, (client) => {
      // Solo enviar si el cliente tiene permisos para ver este usuario
      return this.canUserSeeLocation(client, userData);
    });
  }

  /**
   * Broadcast de eventos de geofencing
   */
  broadcastGeofenceEvent(geofenceEvent) {
    const message = {
      type: 'geofence_event',
      data: geofenceEvent,
      timestamp: new Date().toISOString()
    };

    this.broadcastToSubscribers('geofence_events', message);
  }

  /**
   * Broadcast a clientes suscritos
   */
  broadcastToSubscribers(eventType, message, filterFunc = null) {
    let sentCount = 0;

    this.clients.forEach((client, clientId) => {
      const subscriptions = this.subscriptions.get(clientId);
      
      if (subscriptions && subscriptions.has(eventType)) {
        // Aplicar filtro si se proporciona
        if (!filterFunc || filterFunc(client)) {
          this.send(clientId, message);
          sentCount++;
        }
      }
    });

    console.log(`📡 Broadcast ${eventType}: enviado a ${sentCount} clientes`);
  }

  /**
   * Verificar si un cliente puede ver la ubicación de un usuario
   */
  canUserSeeLocation(client, targetUser) {
    const roles = client.roles || ['guest'];
    
    // Auditores ven todo
    if (roles.includes('auditor') || roles.includes('admin')) {
      return true;
    }
    
    // Directores y Gerentes ven solo su grupo
    if (roles.includes('director') || roles.includes('gerente')) {
      return client.userData?.grupo === targetUser.grupo;
    }
    
    return false;
  }

  /**
   * Enviar mensaje a cliente específico
   */
  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // OPEN
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`❌ Error enviando mensaje a ${clientId}:`, error);
        this.handleDisconnection(clientId);
      }
    }
  }

  /**
   * Manejar desconexión de cliente
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`🔌 Cliente WebSocket desconectado: ${clientId} (${client.userData?.display_name || 'guest'})`);
      this.clients.delete(clientId);
      this.subscriptions.delete(clientId);
    }
  }

  /**
   * Manejar errores de WebSocket
   */
  handleError(clientId, error) {
    console.error(`❌ Error WebSocket ${clientId}:`, error);
    this.handleDisconnection(clientId);
  }

  /**
   * Manejar ping/pong
   */
  handlePing(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
  }

  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPong = new Date();
    }
  }

  /**
   * Verificar token de autenticación JWT
   */
  async verifyToken(token) {
    try {
      // Primero intentar verificar como JWT del sistema de autenticación
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Es un JWT válido del sistema de administración
        if (decoded.userType === 'admin') {
          return {
            id: decoded.userId,
            display_name: decoded.email,
            userType: decoded.userType,
            roles: ['admin', 'dashboard']
          };
        }
        
        // Si es otro tipo de usuario JWT
        return {
          id: decoded.userId,
          display_name: decoded.email || 'Usuario',
          userType: decoded.userType || 'user',
          roles: [decoded.userType || 'user']
        };
        
      } catch (jwtError) {
        // Si no es JWT válido, intentar como tracker_id (backward compatibility)
        console.log(`📱 Intentando autenticación legacy con tracker_id: ${token}`);
        
        const result = await db.query(`
          SELECT id, tracker_id, display_name, zenput_email, grupo, rol, active
          FROM tracking_users 
          WHERE tracker_id = $1 AND active = true
        `, [token]);

        if (result.rows.length === 0) {
          throw new Error('Invalid token or tracker_id');
        }

        const user = result.rows[0];
        
        return {
          id: user.id,
          tracker_id: user.tracker_id,
          display_name: user.display_name,
          grupo: user.grupo,
          roles: [user.rol || 'usuario']
        };
      }
      
    } catch (error) {
      console.error('❌ Token verification error:', error.message);
      throw new Error('Token verification failed');
    }
  }

  /**
   * Generar ID único para cliente
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup de conexiones inactivas
   */
  startHeartbeat() {
    setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5 minutos

      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === 1) { // OPEN
          // Enviar ping
          client.ws.ping();
          
          // Verificar timeout
          if (client.lastPong && (now - client.lastPong) > timeout) {
            console.log(`⏰ Cliente WebSocket timeout: ${clientId}`);
            client.ws.close();
          }
        } else {
          this.handleDisconnection(clientId);
        }
      });
    }, 30000); // Cada 30 segundos
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      connections: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        user: client.userData?.display_name || 'guest',
        connectedAt: client.connectedAt,
        subscriptions: Array.from(this.subscriptions.get(id) || [])
      }))
    };
  }
}

module.exports = new WebSocketManager();