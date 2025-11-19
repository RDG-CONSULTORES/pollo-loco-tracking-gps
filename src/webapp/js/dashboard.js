/**
 * Pollo Loco GPS Dashboard
 * Dashboard en tiempo real con mapa Leaflet y WebSocket
 */

class GPSDashboard {
    constructor() {
        this.ws = null;
        this.map = null;
        this.markers = new Map(); // Map<userId, marker>
        this.geofenceMarkers = new Map(); // Map<geofenceId, circle>
        this.userTrails = new Map(); // Map<userId, polyline>
        this.users = new Map(); // Map<userId, userData>
        this.geofences = new Map(); // Map<geofenceId, geofenceData>
        
        // Estados
        this.selectedUser = null;
        this.showGeofences = true;
        this.showTrails = false;
        this.currentFilter = 'all';
        this.notifications = [];
        
        // Configuración
        this.config = {
            monterrey: { lat: 25.6866, lng: -100.3161 }, // Centro de Monterrey
            defaultZoom: 11,
            maxNotifications: 5,
            notificationTimeout: 10000, // 10 segundos
            reconnectInterval: 5000,
            heartbeatInterval: 30000
        };

        this.init();
    }

    /**
     * Inicializar dashboard
     */
    async init() {
        console.log('🚀 Inicializando GPS Dashboard...');
        
        try {
            // Verificar autenticación
            if (!(await this.checkAuthentication())) {
                window.location.href = '/webapp/login.html';
                return;
            }
            
            this.initializeMap();
            this.initializeUI();
            this.connectWebSocket();
            this.updateUserInfo();
            
            // Cargar datos iniciales del dashboard
            await this.loadDashboardData();
            
            this.hideLoading();
            
            console.log('✅ Dashboard inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando dashboard:', error);
            this.showError('Error inicializando dashboard');
        }
    }

    /**
     * Verificar autenticación del usuario
     */
    async checkAuthentication() {
        const authToken = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');
        
        if (!authToken || !userData) {
            return false;
        }
        
        try {
            // Verificar token con el servidor
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Token inválido, limpiar datos
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                return false;
            }
            
            const result = await response.json();
            if (!result.success) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                return false;
            }
            
            // Usar datos actualizados del servidor
            this.currentUserSession = result.user;
            localStorage.setItem('user_data', JSON.stringify(result.user));
            return true;
            
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            // En caso de error de red, usar datos locales temporalmente
            try {
                this.currentUserSession = JSON.parse(userData);
                return true;
            } catch {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                return false;
            }
        }
    }

    /**
     * Actualizar información del usuario en el header
     */
    updateUserInfo() {
        if (this.currentUserSession) {
            const userElement = document.getElementById('currentUser');
            const roleText = this.getRoleDisplayName(this.currentUserSession.userType || this.currentUserSession.rol);
            const displayName = this.currentUserSession.fullName || this.currentUserSession.display_name || this.currentUserSession.email;
            userElement.textContent = `${displayName} (${roleText})`;
        }
    }

    /**
     * Obtener nombre de visualización del rol
     */
    getRoleDisplayName(role) {
        const roles = {
            'admin': 'Administrador',
            'auditor': 'Auditor',
            'director': 'Director',
            'gerente': 'Gerente', 
            'supervisor': 'Supervisor',
            'usuario': 'Usuario'
        };
        return roles[role] || role;
    }

    /**
     * Inicializar mapa Leaflet
     */
    initializeMap() {
        console.log('🗺️ Inicializando mapa...');
        
        // Crear mapa centrado en Monterrey
        this.map = L.map('map').setView([this.config.monterrey.lat, this.config.monterrey.lng], this.config.defaultZoom);

        // Agregar tile layer de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Configurar eventos del mapa
        this.map.on('click', () => {
            this.clearUserSelection();
        });

        console.log('✅ Mapa inicializado');
    }

    /**
     * Inicializar interfaz de usuario
     */
    initializeUI() {
        console.log('🎨 Inicializando UI...');
        
        // Event listeners para filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Event listener para búsqueda
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.filterUsers(e.target.value);
        });

        // Event listeners para controles del mapa
        document.getElementById('showGeofences').addEventListener('click', () => {
            this.toggleGeofences();
        });

        document.getElementById('centerMap').addEventListener('click', () => {
            this.centerMap();
        });

        document.getElementById('showTrails').addEventListener('click', () => {
            this.toggleTrails();
        });

        document.getElementById('toggleFullscreen').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Event listener para logout
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        console.log('✅ UI inicializada');
    }

    /**
     * Conectar WebSocket
     */
    connectWebSocket() {
        console.log('🔌 Conectando WebSocket...');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let token = this.getAuthToken();
        
        // Limpiar token si viene con formato Bearer
        if (token && token.startsWith('Bearer ')) {
            token = token.substring(7);
        }
        
        if (!token) {
            console.error('❌ No hay token de autenticación para WebSocket');
            return;
        }
        
        const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
        console.log('🔌 Conectando a:', wsUrl.replace(/token=[^&]+/, 'token=***'));
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket conectado');
            this.updateConnectionStatus(true);
            this.subscribeToEvents();
            this.startHeartbeat();
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('❌ Error procesando mensaje WebSocket:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('🔌 WebSocket desconectado');
            this.updateConnectionStatus(false);
            setTimeout(() => this.connectWebSocket(), this.config.reconnectInterval);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ Error WebSocket:', error);
            this.updateConnectionStatus(false);
        };
    }

    /**
     * Suscribirse a eventos WebSocket
     */
    subscribeToEvents() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                events: ['location_updates', 'geofence_events', 'system_alerts'],
                filters: {}
            }));
            
            // Solicitar datos iniciales
            this.ws.send(JSON.stringify({ type: 'request_current_locations' }));
            this.ws.send(JSON.stringify({ type: 'request_geofences' }));
        }
    }

    /**
     * Manejar mensajes WebSocket
     */
    handleWebSocketMessage(message) {
        console.log(`📨 WebSocket mensaje: ${message.type}`);
        
        switch (message.type) {
            case 'connection_established':
                console.log('✅ Conexión WebSocket establecida');
                break;
                
            case 'current_locations':
                this.updateCurrentLocations(message.data);
                break;
                
            case 'geofences':
                this.updateGeofences(message.data);
                break;
                
            case 'location_update':
                this.handleLocationUpdate(message.data);
                break;
                
            case 'geofence_event':
                this.handleGeofenceEvent(message.data);
                break;
                
            case 'system_stats':
                this.updateSystemStats(message.data);
                break;
                
            case 'subscription_confirmed':
                console.log('📡 Suscripciones confirmadas:', message.events);
                break;
                
            case 'error':
                console.error('❌ Error del servidor:', message.error);
                this.showNotification('Error: ' + message.error, 'error');
                break;
                
            default:
                console.log(`⚠️ Tipo de mensaje no manejado: ${message.type}`);
        }
    }

    /**
     * Actualizar ubicaciones actuales
     */
    updateCurrentLocations(locations) {
        console.log(`📍 Actualizando ${locations.length} ubicaciones`);
        
        locations.forEach(location => {
            this.updateUserLocation(location);
        });
        
        this.updateUsersList();
        this.updateStats();
    }

    /**
     * Actualizar geofences (sucursales)
     */
    updateGeofences(geofences) {
        console.log(`🎯 Actualizando ${geofences.length} geofences`);
        
        // Limpiar geofences existentes
        this.geofenceMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.geofenceMarkers.clear();
        
        // Agregar nuevos geofences
        geofences.forEach(geofence => {
            this.geofences.set(geofence.id, geofence);
            
            if (this.showGeofences) {
                this.addGeofenceToMap(geofence);
            }
        });
        
        // Actualizar botón de geofences
        this.updateGeofencesButton();
        
        // Si es la primera carga y tenemos geofences, ajustar mapa
        if (geofences.length > 0 && this.geofences.size === geofences.length) {
            this.fitMapToGeofences();
        }
    }

    /**
     * Manejar actualización de ubicación en tiempo real
     */
    handleLocationUpdate(data) {
        console.log(`🔄 Ubicación actualizada: ${data.user.display_name}`);
        
        this.updateUserLocation({
            user_id: data.user.id,
            tracker_id: data.user.tracker_id,
            display_name: data.user.display_name,
            grupo: data.user.grupo,
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            accuracy: data.location.accuracy,
            battery: data.location.battery,
            velocity: data.location.velocity,
            gps_timestamp: data.location.timestamp,
            minutes_ago: 0
        });
        
        this.updateUsersList();
        this.updateStats();
        
        // Actualizar trail si está activo
        if (this.showTrails) {
            this.updateUserTrail(data.user.id, data.location);
        }
    }

    /**
     * Manejar evento de geofencing
     */
    handleGeofenceEvent(event) {
        console.log(`🎯 Evento geofence: ${event.event_type} - ${event.location_name}`);
        
        const isEntry = event.event_type === 'enter';
        const icon = isEntry ? '🟢' : '🔴';
        const action = isEntry ? 'ENTRADA' : 'SALIDA';
        
        const notification = {
            type: `geofence-${event.event_type}`,
            title: `${icon} ${action} DETECTADA`,
            message: `${event.user_name} - ${event.location_name}`,
            timestamp: new Date(),
            data: event
        };
        
        this.showNotification(notification);
        
        // Destacar usuario en el mapa
        this.highlightUserOnMap(event.user_id, isEntry);
    }

    /**
     * Actualizar ubicación de usuario
     */
    updateUserLocation(location) {
        const userId = location.user_id;
        const user = {
            id: userId,
            tracker_id: location.tracker_id,
            display_name: location.display_name,
            grupo: location.grupo,
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            accuracy: location.accuracy,
            battery: location.battery,
            velocity: location.velocity,
            timestamp: new Date(location.gps_timestamp),
            minutesAgo: location.minutes_ago || 0
        };
        
        this.users.set(userId, user);
        
        // Actualizar marker en el mapa
        this.updateUserMarker(user);
    }

    /**
     * Actualizar marker de usuario en el mapa
     */
    updateUserMarker(user) {
        const existingMarker = this.markers.get(user.id);
        
        if (existingMarker) {
            // Actualizar posición del marker existente
            existingMarker.setLatLng([user.latitude, user.longitude]);
            existingMarker.setPopupContent(this.createUserPopupContent(user));
        } else {
            // Crear nuevo marker
            const icon = this.createUserIcon(user);
            const marker = L.marker([user.latitude, user.longitude], { icon })
                .bindPopup(this.createUserPopupContent(user))
                .addTo(this.map);
            
            // Event listener para selección
            marker.on('click', () => {
                this.selectUser(user.id);
            });
            
            this.markers.set(user.id, marker);
        }
    }

    /**
     * Crear icono personalizado para usuario
     */
    createUserIcon(user) {
        const batteryLevel = user.battery || 0;
        const isOnline = user.minutesAgo < 5;
        
        let color = '#10b981'; // Verde por defecto
        if (!isOnline) {
            color = '#6b7280'; // Gris para offline
        } else if (batteryLevel < 10) {
            color = '#ef4444'; // Rojo para batería crítica
        } else if (batteryLevel < 20) {
            color = '#f59e0b'; // Amarillo para batería baja
        }
        
        const initials = user.display_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        
        return L.divIcon({
            className: 'user-marker',
            html: `
                <div style="
                    background: ${color};
                    color: white;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 11px;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                ">
                    ${initials}
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    }

    /**
     * Crear contenido del popup de usuario
     */
    createUserPopupContent(user) {
        const batteryLevel = user.battery || 0;
        const accuracy = user.accuracy || 0;
        const velocity = user.velocity || 0;
        
        const batteryColor = batteryLevel < 20 ? '#ef4444' : batteryLevel < 50 ? '#f59e0b' : '#10b981';
        
        return `
            <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #1f2937;">${user.display_name}</h3>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
                    <div><strong>ID:</strong> ${user.tracker_id}</div>
                    <div><strong>Grupo:</strong> ${user.grupo || 'N/A'}</div>
                    <div><strong>Batería:</strong> <span style="color: ${batteryColor}">${batteryLevel}%</span></div>
                    <div><strong>Precisión:</strong> ${accuracy}m</div>
                    <div><strong>Velocidad:</strong> ${Math.round(velocity)} km/h</div>
                    <div><strong>Última actualización:</strong> ${user.minutesAgo < 1 ? 'Ahora' : user.minutesAgo + ' min'}</div>
                    <div><strong>Coordenadas:</strong> ${user.latitude.toFixed(6)}, ${user.longitude.toFixed(6)}</div>
                </div>
            </div>
        `;
    }

    /**
     * Agregar geofence al mapa
     */
    addGeofenceToMap(geofence) {
        // Crear marcador de sucursal (ícono de tienda)
        const storeIcon = L.divIcon({
            html: `
                <div style="
                    background: #dc2626;
                    color: white;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    border: 2px solid white;
                ">🏪</div>
            `,
            className: 'custom-geofence-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Crear marcador principal
        const marker = L.marker([geofence.latitude, geofence.longitude], {
            icon: storeIcon
        }).addTo(this.map);

        // Crear círculo de geofence
        const circle = L.circle([geofence.latitude, geofence.longitude], {
            color: '#dc2626',
            fillColor: '#dc2626',
            fillOpacity: 0.1,
            radius: geofence.radius_meters || 150,
            weight: 2,
            dashArray: '5, 5'
        }).addTo(this.map);

        // Popup con información detallada
        const popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #dc2626; display: flex; align-items: center; gap: 5px;">
                    🏪 ${geofence.location_name}
                </h4>
                <div style="font-size: 13px; line-height: 1.4;">
                    <div style="margin-bottom: 4px;"><strong>Código:</strong> ${geofence.location_code}</div>
                    <div style="margin-bottom: 4px;"><strong>Grupo:</strong> ${geofence.grupo || 'N/A'}</div>
                    <div style="margin-bottom: 8px;"><strong>Radio:</strong> ${geofence.radius_meters}m</div>
                    <div style="padding: 6px; background: #f8fafc; border-radius: 4px; font-size: 11px;">
                        📍 ${geofence.latitude.toFixed(6)}, ${geofence.longitude.toFixed(6)}
                    </div>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        circle.bindPopup(popupContent);

        // Guardar ambos elementos (marker y circle) en un grupo
        const layerGroup = L.layerGroup([marker, circle]);
        this.geofenceMarkers.set(geofence.id, layerGroup);
    }

    /**
     * Calcular distancia entre dos puntos (Haversine formula)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radio de la Tierra en metros
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distancia en metros
    }

    /**
     * Encontrar la sucursal más cercana a un usuario
     */
    findClosestBranch(userLat, userLng) {
        let closestBranch = null;
        let minDistance = Infinity;

        this.geofences.forEach(geofence => {
            const distance = this.calculateDistance(userLat, userLng, geofence.latitude, geofence.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                closestBranch = {
                    ...geofence,
                    distance: Math.round(distance)
                };
            }
        });

        return closestBranch;
    }

    /**
     * Verificar si usuario está dentro de alguna sucursal
     */
    getUserGeofenceStatus(userLat, userLng) {
        for (const geofence of this.geofences.values()) {
            const distance = this.calculateDistance(userLat, userLng, geofence.latitude, geofence.longitude);
            const radius = geofence.radius_meters || 150;
            
            if (distance <= radius) {
                return {
                    inGeofence: true,
                    geofence: geofence,
                    distance: Math.round(distance)
                };
            }
        }
        
        return { inGeofence: false };
    }

    /**
     * Actualizar lista de usuarios en sidebar
     */
    updateUsersList() {
        const usersList = document.getElementById('usersList');
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();
        
        // Filtrar y ordenar usuarios
        let filteredUsers = Array.from(this.users.values()).filter(user => {
            // Filtro de búsqueda
            if (searchTerm && !user.display_name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Filtro por estado
            switch (this.currentFilter) {
                case 'online':
                    return user.minutesAgo < 5;
                case 'geofence':
                    return this.isUserInGeofence(user);
                case 'battery':
                    return (user.battery || 0) < 20;
                default:
                    return true;
            }
        }).sort((a, b) => a.minutesAgo - b.minutesAgo);
        
        // Renderizar lista
        usersList.innerHTML = filteredUsers.map(user => this.renderUserItem(user)).join('');
        
        // Agregar event listeners
        usersList.querySelectorAll('.user-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = parseInt(item.dataset.userId);
                this.selectUser(userId);
            });
        });
    }

    /**
     * Renderizar item de usuario
     */
    renderUserItem(user) {
        const batteryLevel = user.battery || 0;
        const isOnline = user.minutesAgo < 5;
        const isSelected = user.id === this.selectedUser;
        
        let statusClass = 'offline';
        if (isOnline) {
            if (batteryLevel < 10) statusClass = 'battery-critical';
            else if (batteryLevel < 20) statusClass = 'battery-low';
            else statusClass = 'online';
        }
        
        const initials = user.display_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        
        // Información de proximidad a sucursales
        let locationInfo = '';
        if (user.latitude && user.longitude && this.geofences.size > 0) {
            const geofenceStatus = this.getUserGeofenceStatus(user.latitude, user.longitude);
            
            if (geofenceStatus.inGeofence) {
                locationInfo = `
                    <div class="location-info in-geofence">
                        🏪 En ${geofenceStatus.geofence.location_name} (${geofenceStatus.distance}m)
                    </div>
                `;
            } else {
                const closestBranch = this.findClosestBranch(user.latitude, user.longitude);
                if (closestBranch) {
                    const distanceKm = closestBranch.distance > 1000 
                        ? `${(closestBranch.distance/1000).toFixed(1)}km` 
                        : `${closestBranch.distance}m`;
                    locationInfo = `
                        <div class="location-info near-geofence">
                            📍 ${distanceKm} de ${closestBranch.location_name}
                        </div>
                    `;
                }
            }
        }
        
        return `
            <div class="user-item ${isSelected ? 'selected' : ''}" data-user-id="${user.id}">
                <div class="user-avatar">${initials}</div>
                <div class="user-info-item">
                    <div class="user-name">${user.display_name}</div>
                    <div class="user-details">${user.grupo || 'Sin grupo'} • ${user.tracker_id}</div>
                    <div class="user-status">
                        <div class="status-indicator ${statusClass}"></div>
                        <span>Batería: ${batteryLevel}% • ${user.minutesAgo < 1 ? 'Ahora' : user.minutesAgo + ' min'}</span>
                    </div>
                    ${locationInfo}
                </div>
            </div>
        `;
    }

    /**
     * Verificar si usuario está en algún geofence
     */
    isUserInGeofence(user) {
        for (const geofence of this.geofences.values()) {
            const distance = this.calculateDistance(
                user.latitude, user.longitude,
                geofence.latitude, geofence.longitude
            );
            if (distance <= (geofence.radius_meters || 150)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Calcular distancia entre dos puntos (metros)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI/180);
    }

    /**
     * Actualizar estadísticas
     */
    updateStats() {
        const users = Array.from(this.users.values());
        
        const totalUsers = users.length;
        const onlineUsers = users.filter(u => u.minutesAgo < 5).length;
        
        // Usar nuevas funciones de geofence para cálculo preciso
        let inGeofenceCount = 0;
        users.forEach(user => {
            if (user.latitude && user.longitude && this.geofences.size > 0) {
                const status = this.getUserGeofenceStatus(user.latitude, user.longitude);
                if (status.inGeofence) {
                    inGeofenceCount++;
                }
            }
        });
        
        const batteryLow = users.filter(u => (u.battery || 0) < 20).length;
        
        // Actualizar contadores con animación suave
        this.updateCounterWithAnimation('totalUsers', totalUsers);
        this.updateCounterWithAnimation('onlineUsers', onlineUsers);
        this.updateCounterWithAnimation('inGeofence', inGeofenceCount);
        this.updateCounterWithAnimation('batteryLow', batteryLow);
        
        console.log(`📊 Stats actualizadas: ${totalUsers} total, ${onlineUsers} online, ${inGeofenceCount} en sucursal, ${batteryLow} batería baja`);
    }

    /**
     * Actualizar contador con animación
     */
    updateCounterWithAnimation(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = parseInt(element.textContent) || 0;
        if (currentValue === newValue) return;
        
        // Animación simple de incremento/decremento
        const isIncrement = newValue > currentValue;
        const steps = Math.abs(newValue - currentValue);
        const stepTime = Math.min(50, 200 / steps); // Max 200ms total
        
        let current = currentValue;
        const interval = setInterval(() => {
            current += isIncrement ? 1 : -1;
            element.textContent = current;
            
            if (current === newValue) {
                clearInterval(interval);
                // Pequeña animación visual
                element.style.transform = 'scale(1.1)';
                element.style.color = isIncrement ? '#10b981' : '#ef4444';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = '';
                }, 200);
            }
        }, stepTime);
    }

    /**
     * Seleccionar usuario
     */
    selectUser(userId) {
        this.selectedUser = userId;
        const user = this.users.get(userId);
        
        if (user) {
            // Centrar mapa en usuario
            this.map.setView([user.latitude, user.longitude], 15);
            
            // Abrir popup
            const marker = this.markers.get(userId);
            if (marker) {
                marker.openPopup();
            }
        }
        
        this.updateUsersList();
    }

    /**
     * Limpiar selección de usuario
     */
    clearUserSelection() {
        this.selectedUser = null;
        this.updateUsersList();
    }

    /**
     * Establecer filtro
     */
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Actualizar UI de filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.updateUsersList();
    }

    /**
     * Filtrar usuarios por texto
     */
    filterUsers(searchTerm) {
        this.updateUsersList();
    }

    /**
     * Toggle geofences
     */
    toggleGeofences() {
        this.showGeofences = !this.showGeofences;
        const btn = document.getElementById('showGeofences');
        
        if (this.showGeofences) {
            this.geofences.forEach(geofence => {
                this.addGeofenceToMap(geofence);
            });
            btn.classList.add('active');
            console.log(`🎯 Mostrando ${this.geofences.size} sucursales en el mapa`);
        } else {
            this.geofenceMarkers.forEach(layerGroup => {
                this.map.removeLayer(layerGroup);
            });
            this.geofenceMarkers.clear();
            btn.classList.remove('active');
            console.log(`🎯 Ocultando sucursales del mapa`);
        }
    }

    /**
     * Centrar mapa
     */
    centerMap() {
        if (this.users.size > 0) {
            const bounds = L.latLngBounds();
            this.users.forEach(user => {
                bounds.extend([user.latitude, user.longitude]);
            });
            this.map.fitBounds(bounds, { padding: [20, 20] });
        } else {
            this.map.setView([this.config.monterrey.lat, this.config.monterrey.lng], this.config.defaultZoom);
        }
    }

    /**
     * Toggle trails
     */
    toggleTrails() {
        this.showTrails = !this.showTrails;
        const btn = document.getElementById('showTrails');
        
        if (this.showTrails) {
            btn.classList.add('active');
            // Cargar trails para usuarios visibles
            this.loadUserTrails();
        } else {
            btn.classList.remove('active');
            // Limpiar trails
            this.userTrails.forEach(trail => {
                this.map.removeLayer(trail);
            });
            this.userTrails.clear();
        }
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * Mostrar notificación
     */
    showNotification(notification, type = 'info') {
        const panel = document.getElementById('notificationsPanel');
        
        if (typeof notification === 'string') {
            notification = {
                type: type,
                title: type === 'error' ? 'Error' : 'Notificación',
                message: notification,
                timestamp: new Date()
            };
        }
        
        this.notifications.unshift(notification);
        
        // Limitar número de notificaciones
        if (this.notifications.length > this.config.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.config.maxNotifications);
        }
        
        this.renderNotifications();
        
        // Auto-remove después del timeout
        setTimeout(() => {
            this.removeNotification(notification);
        }, this.config.notificationTimeout);
    }

    /**
     * Renderizar notificaciones
     */
    renderNotifications() {
        const panel = document.getElementById('notificationsPanel');
        
        panel.innerHTML = this.notifications.map(notification => `
            <div class="notification ${notification.type}">
                <div style="font-weight: 600; margin-bottom: 4px;">${notification.title}</div>
                <div style="font-size: 0.875rem; color: #64748b;">${notification.message}</div>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 4px;">
                    ${notification.timestamp.toLocaleTimeString()}
                </div>
            </div>
        `).join('');
    }

    /**
     * Remover notificación
     */
    removeNotification(notification) {
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
            this.notifications.splice(index, 1);
            this.renderNotifications();
        }
    }

    /**
     * Destacar usuario en el mapa
     */
    highlightUserOnMap(userId, isEntry) {
        const marker = this.markers.get(userId);
        if (marker) {
            // Crear efecto de highlight temporal
            const originalIcon = marker.getIcon();
            const highlightColor = isEntry ? '#10b981' : '#f59e0b';
            
            // Cambiar temporalmente el icono
            setTimeout(() => {
                marker.setIcon(originalIcon);
            }, 3000);
            
            // Abrir popup
            marker.openPopup();
        }
    }

    /**
     * Cargar trails de usuarios
     */
    async loadUserTrails() {
        // TODO: Implementar carga de trails desde API
        console.log('🛤️ Cargando trails de usuarios...');
    }

    /**
     * Actualizar estado de conexión
     */
    updateConnectionStatus(connected) {
        const dot = document.getElementById('connectionDot');
        const status = document.getElementById('connectionStatus');
        
        if (connected) {
            dot.classList.remove('disconnected');
            status.textContent = 'Conectado';
        } else {
            dot.classList.add('disconnected');
            status.textContent = 'Desconectado';
        }
    }

    /**
     * Logout del usuario
     */
    async logout() {
        try {
            // Llamar al endpoint de logout
            const authToken = localStorage.getItem('auth_token');
            if (authToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.log('Error en logout:', error);
        } finally {
            // Limpiar datos locales independientemente del resultado
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            // Redirigir al login
            window.location.href = '/webapp/login.html';
        }
    }

    /**
     * Obtener token de autenticación
     */
    getAuthToken() {
        return localStorage.getItem('auth_token') || null;
    }

    /**
     * Actualizar botón de geofences
     */
    updateGeofencesButton() {
        const btn = document.getElementById('showGeofences');
        if (btn && this.showGeofences) {
            btn.classList.add('active');
        }
    }

    /**
     * Ajustar mapa para mostrar todas las geofences
     */
    fitMapToGeofences() {
        if (this.geofences.size === 0) return;
        
        const bounds = L.latLngBounds();
        this.geofences.forEach(geofence => {
            bounds.extend([geofence.latitude, geofence.longitude]);
        });
        
        // Ajustar el mapa con padding
        this.map.fitBounds(bounds, { 
            padding: [20, 20],
            maxZoom: 13
        });
        
        console.log(`🗺️ Mapa ajustado para mostrar ${this.geofences.size} sucursales`);
    }

    /**
     * Iniciar heartbeat
     */
    startHeartbeat() {
        setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Actualizar estadísticas del sistema desde WebSocket
     */
    updateSystemStats(stats) {
        console.log('📊 Actualizando estadísticas del sistema:', stats);
        
        try {
            // Actualizar contadores en la UI
            const activeUsers = document.getElementById('active-users-count');
            const locationsToday = document.getElementById('locations-today-count');
            const activeLastHour = document.getElementById('active-last-hour-count');
            
            if (activeUsers && stats.active_users !== undefined) {
                activeUsers.textContent = stats.active_users;
            }
            
            if (locationsToday && stats.locations_today !== undefined) {
                locationsToday.textContent = stats.locations_today;
            }
            
            if (activeLastHour && stats.users_active_last_hour !== undefined) {
                activeLastHour.textContent = stats.users_active_last_hour;
            }
            
        } catch (error) {
            console.error('❌ Error actualizando estadísticas:', error);
        }
    }

    /**
     * Cargar datos iniciales del dashboard
     */
    async loadDashboardData() {
        try {
            console.log('📊 Cargando datos del dashboard...');
            
            // Cargar usuarios GPS
            await this.loadGPSUsers();
            
            // Cargar estadísticas del sistema
            await this.loadSystemStats();
            
            console.log('✅ Datos del dashboard cargados');
        } catch (error) {
            console.error('❌ Error cargando datos del dashboard:', error);
        }
    }
    
    /**
     * Cargar usuarios GPS
     */
    async loadGPSUsers() {
        try {
            const response = await fetch('/api/admin/dashboard/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.updateUsersDisplay(result.data.users);
                this.updateStatsDisplay(result.data.stats);
                console.log(`📱 ${result.data.users.length} usuarios GPS cargados`);
            }
        } catch (error) {
            console.error('❌ Error cargando usuarios GPS:', error);
        }
    }
    
    /**
     * Actualizar display de usuarios
     */
    updateUsersDisplay(users) {
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        // Limpiar lista actual
        usersList.innerHTML = '';
        
        // Agregar cada usuario
        users.forEach(user => {
            const userElement = this.createUserElement(user);
            usersList.appendChild(userElement);
            
            // Agregar marcador al mapa si tiene ubicación
            if (user.latitude && user.longitude) {
                this.addUserMarker(user);
            }
        });
    }
    
    /**
     * Crear elemento HTML para un usuario
     */
    createUserElement(user) {
        const div = document.createElement('div');
        div.className = `user-item ${user.status}`;
        div.innerHTML = `
            <div class="user-info">
                <div class="user-name">${user.display_name}</div>
                <div class="user-details">
                    ${user.grupo} | ${user.rol}
                </div>
            </div>
            <div class="user-status">
                <div class="status-indicator ${user.status}"></div>
                ${user.last_battery_level ? `<span class="battery">${user.last_battery_level}%</span>` : ''}
            </div>
        `;
        
        return div;
    }
    
    /**
     * Agregar marcador de usuario al mapa
     */
    addUserMarker(user) {
        if (!this.map || !user.latitude || !user.longitude) return;
        
        const marker = L.marker([user.latitude, user.longitude], {
            title: user.display_name
        }).addTo(this.map);
        
        const popupContent = `
            <b>${user.display_name}</b><br>
            Grupo: ${user.grupo}<br>
            Estado: ${user.status}<br>
            ${user.last_battery_level ? `Batería: ${user.last_battery_level}%<br>` : ''}
            Última ubicación: ${user.last_location_time ? new Date(user.last_location_time).toLocaleString() : 'N/A'}
        `;
        
        marker.bindPopup(popupContent);
        
        // Guardar referencia del marcador
        this.markers.set(user.id, marker);
    }
    
    /**
     * Actualizar estadísticas del dashboard
     */
    updateStatsDisplay(stats) {
        // Actualizar contadores
        this.updateElement('totalUsers', stats.total || 0);
        this.updateElement('onlineUsers', stats.online || 0);
        this.updateElement('inGeofence', 0); // Por implementar
        this.updateElement('batteryLow', stats.battery_low || 0);
    }
    
    /**
     * Actualizar elemento del DOM
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    /**
     * Cargar estadísticas del sistema
     */
    async loadSystemStats() {
        try {
            const response = await fetch('/api/admin/system/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.updateSystemStatus(result);
            }
        } catch (error) {
            console.error('❌ Error cargando estadísticas del sistema:', error);
        }
    }
    
    /**
     * Actualizar estado del sistema
     */
    updateSystemStatus(systemData) {
        // Actualizar indicador de estado del sistema
        const statusElement = document.querySelector('.system-status');
        if (statusElement) {
            statusElement.textContent = systemData.health?.api === 'Healthy' ? 'Sistema Online' : 'Sistema Offline';
            statusElement.className = `system-status ${systemData.health?.api === 'Healthy' ? 'online' : 'offline'}`;
        }
    }

    /**
     * Ocultar loading
     */
    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    /**
     * Mostrar error
     */
    showError(message) {
        console.error('❌', message);
        this.showNotification(message, 'error');
    }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.gpsDashboard = new GPSDashboard();
});

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('❌ Error global:', event.error);
    if (window.gpsDashboard) {
        window.gpsDashboard.showError('Error en la aplicación');
    }
});