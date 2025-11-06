const https = require('https');

/**
 * Cliente para Zenput API (si usuarios están en API)
 */
class ZenputAPIClient {
  constructor() {
    this.apiKey = process.env.ZENPUT_API_KEY;
    this.orgId = process.env.ZENPUT_ORG_ID;
    this.baseUrl = 'https://api.zenput.com';
  }
  
  /**
   * Realizar petición HTTP a Zenput API
   */
  async makeRequest(endpoint, options = {}) {
    if (!this.apiKey) {
      throw new Error('ZENPUT_API_KEY no configurado');
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PolloLoco-Tracking/1.0',
        ...options.headers
      }
    };
    
    return new Promise((resolve, reject) => {
      const req = https.request(url, requestOptions, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }
  
  /**
   * Obtener usuarios desde Zenput API
   */
  async getUsers() {
    try {
      if (!this.orgId) {
        console.log('⚠️ ZENPUT_ORG_ID no configurado, saltando API');
        return [];
      }
      
      const response = await this.makeRequest(`/v1/organizations/${this.orgId}/users`);
      
      console.log(`👥 Usuarios obtenidos desde Zenput API: ${response.data?.length || 0}`);
      
      // Mapear formato de API a nuestro formato
      return (response.data || []).map(user => ({
        zenput_user_id: user.id,
        email: user.email,
        display_name: user.name || `${user.first_name} ${user.last_name}`.trim(),
        phone: user.phone_number,
        role: user.role,
        active: user.active !== false
      }));
    } catch (error) {
      console.error('❌ Error obteniendo usuarios desde Zenput API:', error.message);
      
      if (error.message.includes('401')) {
        console.log('💡 AYUDA: Verifica que ZENPUT_API_KEY sea válido');
      } else if (error.message.includes('404')) {
        console.log('💡 AYUDA: Verifica que ZENPUT_ORG_ID sea correcto');
      }
      
      return [];
    }
  }
  
  /**
   * Obtener usuario por email
   */
  async getUserByEmail(email) {
    try {
      const users = await this.getUsers();
      return users.find(user => user.email.toLowerCase() === email.toLowerCase());
    } catch (error) {
      console.error(`❌ Error obteniendo usuario ${email}:`, error.message);
      return null;
    }
  }
  
  /**
   * Obtener sucursales desde Zenput API (si están ahí)
   */
  async getLocations() {
    try {
      if (!this.orgId) {
        console.log('⚠️ ZENPUT_ORG_ID no configurado, saltando API');
        return [];
      }
      
      const response = await this.makeRequest(`/v1/organizations/${this.orgId}/locations`);
      
      console.log(`📍 Sucursales obtenidas desde Zenput API: ${response.data?.length || 0}`);
      
      // Mapear formato de API a nuestro formato
      return (response.data || []).map(location => ({
        location_code: location.code || location.id,
        name: location.name,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        group_name: location.group_name || location.region,
        director_name: location.manager_name,
        active: location.active !== false
      }));
    } catch (error) {
      console.error('❌ Error obteniendo sucursales desde Zenput API:', error.message);
      return [];
    }
  }
  
  /**
   * Test de conexión a Zenput API
   */
  async testConnection() {
    try {
      console.log('\n🔍 Probando conexión a Zenput API...');
      
      if (!this.apiKey) {
        console.log('⚠️ ZENPUT_API_KEY no configurado');
        return false;
      }
      
      if (!this.orgId) {
        console.log('⚠️ ZENPUT_ORG_ID no configurado');
        return false;
      }
      
      // Test básico con endpoint de organización
      const response = await this.makeRequest(`/v1/organizations/${this.orgId}`);
      
      console.log(`✅ Conexión exitosa a Zenput API`);
      console.log(`🏢 Organización: ${response.name || 'N/A'}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error conectando a Zenput API:', error.message);
      return false;
    }
  }
}

module.exports = new ZenputAPIClient();