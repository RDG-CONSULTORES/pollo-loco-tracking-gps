/**
 * PANEL DE ADMINISTRACIÓN COMPLETO - POLLO LOCO GPS
 * Sistema integral de gestión con todas las funcionalidades
 */

class AdminPanel {
    constructor() {
        this.authToken = localStorage.getItem('auth_token');
        this.userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        this.currentTab = 'users';
        this.currentPage = 1;
        this.currentFilters = {};
        this.operationalGroups = [];
        
        this.init();
    }

    async init() {
        // Verificar autenticación
        if (!this.authToken) {
            this.redirectToLogin();
            return;
        }

        try {
            const userCheck = await this.apiRequest('/api/auth/me');
            if (!userCheck.success || userCheck.user.userType !== 'admin') {
                alert('No tienes permisos de administrador');
                this.redirectToLogin();
                return;
            }
            
            this.updateUserInfo(userCheck.user);
        } catch (error) {
            console.error('Error verificando usuario:', error);
            this.redirectToLogin();
            return;
        }

        // Cargar datos iniciales
        await this.loadStats();
        await this.loadOperationalGroups();
        await this.loadUsers();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        console.log('✅ Panel de administración inicializado');
    }

    // ===============================
    // GESTIÓN DE AUTENTICACIÓN
    // ===============================

    setupEventListeners() {
        // Formularios
        this.setupForm('createUserForm', (e) => this.handleCreateUser(e));
        this.setupForm('createDirectorForm', (e) => this.handleCreateDirector(e));
        
        // Búsqueda en tiempo real
        this.setupSearch('userSearch', () => this.loadUsers());
        
        // Filtros
        this.setupFilterListener('userGroupFilter', 'grupo');
        this.setupFilterListener('userRoleFilter', 'rol');
        this.setupFilterListener('userStatusFilter', 'active');
        
        // Tab switching
        document.addEventListener('click', (e) => {
            if (e.target.matches('.tab-btn')) {
                const tab = e.target.getAttribute('onclick')?.match(/switchTab\('([^']+)'\)/)?.[1];
                if (tab) this.switchTab(tab);
            }
        });
    }

    setupForm(formId, handler) {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', handler);
        }
    }

    setupSearch(inputId, handler) {
        const input = document.getElementById(inputId);
        if (input) {
            let debounceTimer;
            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(handler, 300);
            });
        }
    }

    setupFilterListener(selectId, filterKey) {
        const select = document.getElementById(selectId);
        if (select) {
            select.addEventListener('change', () => {
                this.currentFilters[filterKey] = select.value;
                this.currentPage = 1;
                this.loadUsers();
            });
        }
    }

    updateUserInfo(user) {
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = `${user.fullName} (${user.userType})`;
        }
    }

    redirectToLogin() {
        window.location.href = '/webapp/login.html';
    }

    async logout() {
        try {
            await this.apiRequest('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.log('Error en logout:', error);
        } finally {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            this.redirectToLogin();
        }
    }

    // ===============================
    // UTILIDADES DE API
    // ===============================

    async apiRequest(endpoint, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`,
                ...options.headers
            },
            ...options
        };

        const response = await fetch(endpoint, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status}`);
        }

        return data;
    }

    // ===============================
    // GESTIÓN DE STATS GENERALES
    // ===============================

    async loadStats() {
        try {
            const stats = await this.apiRequest('/api/admin/system/status');
            this.updateStatsCards(stats);
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
            this.showError('Error cargando estadísticas del sistema');
        }
    }

    updateStatsCards(stats) {
        const cards = [
            { id: 'totalUsers', value: stats.database?.total_gps_users || 0, label: 'Usuarios GPS' },
            { id: 'totalBranches', value: stats.database?.total_branches || 0, label: 'Sucursales' },
            { id: 'totalGroups', value: stats.database?.total_groups || 0, label: 'Grupos Operativos' },
            { id: 'activeSessions', value: stats.database?.active_sessions || 0, label: 'Sesiones Activas' }
        ];

        cards.forEach(card => {
            const element = document.getElementById(card.id);
            if (element) {
                element.textContent = card.value;
            }
        });
    }

    // ===============================
    // GESTIÓN DE GRUPOS OPERATIVOS
    // ===============================

    async loadOperationalGroups() {
        try {
            const response = await this.apiRequest('/api/admin/groups');
            this.operationalGroups = response.data || [];
            this.populateGroupSelects();
        } catch (error) {
            console.error('Error cargando grupos operativos:', error);
            this.showError('Error cargando grupos operativos');
        }
    }

    populateGroupSelects() {
        const selects = ['userGroup', 'userGroupFilter', 'groupSelect', 'directorGroups'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // Limpiar opciones existentes (excepto la primera)
                while (select.children.length > 1) {
                    select.removeChild(select.lastChild);
                }

                // Agregar grupos
                this.operationalGroups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.group_name;
                    option.textContent = `${group.group_name} (${group.total_sucursales} sucursales)`;
                    select.appendChild(option);
                });
            }
        });
    }

    // ===============================
    // TAB 1: GESTIÓN DE USUARIOS GPS
    // ===============================

    async loadUsers() {
        try {
            this.showLoading('usersTable');

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 25,
                search: document.getElementById('userSearch')?.value || '',
                ...this.currentFilters
            });

            const response = await this.apiRequest(`/api/admin/users?${params}`);
            this.displayUsers(response.data);
            this.updatePagination(response.pagination, 'users');
            
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            this.showError('Error cargando usuarios GPS');
            document.getElementById('usersTable').innerHTML = `
                <tr><td colspan="7" class="error">Error cargando usuarios: ${error.message}</td></tr>
            `;
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTable');
        
        if (users.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="no-data">No se encontraron usuarios</td></tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.tracker_id}</strong></td>
                <td>${user.display_name}</td>
                <td><a href="mailto:${user.zenput_email}">${user.zenput_email}</a></td>
                <td><span class="role-badge ${user.rol}">${user.rol}</span></td>
                <td>${user.grupo}</td>
                <td>
                    <span class="status-badge ${user.active ? 'active' : 'inactive'}">
                        ${user.active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="actions">
                    <button onclick="adminPanel.editUser(${user.id})" class="btn-icon edit" title="Editar">
                        <span class="material-icons">edit</span>
                    </button>
                    <button onclick="adminPanel.toggleUserStatus(${user.id}, ${!user.active})" 
                            class="btn-icon ${user.active ? 'deactivate' : 'activate'}" 
                            title="${user.active ? 'Desactivar' : 'Activar'}">
                        <span class="material-icons">${user.active ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button onclick="adminPanel.deleteUser(${user.id})" class="btn-icon delete" title="Eliminar">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async handleCreateUser(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            tracker_id: formData.get('trackerId'),
            display_name: formData.get('displayName'),
            zenput_email: formData.get('zenputEmail'),
            phone: formData.get('phone'),
            rol: formData.get('userRole'),
            grupo: formData.get('userGroup')
        };

        try {
            this.showLoading('createUserSubmit');
            await this.apiRequest('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });

            this.showSuccess('Usuario GPS creado exitosamente');
            e.target.reset();
            await this.loadUsers();
            await this.loadStats();
            
        } catch (error) {
            this.showError(`Error creando usuario: ${error.message}`);
        } finally {
            this.hideLoading('createUserSubmit');
        }
    }

    async editUser(userId) {
        try {
            // Obtener datos del usuario
            const response = await this.apiRequest(`/api/admin/users?search=&limit=1000`);
            const user = response.data.find(u => u.id === userId);
            
            if (!user) {
                this.showError('Usuario no encontrado');
                return;
            }

            // Crear y mostrar modal de edición
            this.showEditUserModal(user);
            
        } catch (error) {
            this.showError(`Error obteniendo datos del usuario: ${error.message}`);
        }
    }

    showEditUserModal(user) {
        const modal = this.createModal('editUserModal', 'Editar Usuario GPS', `
            <form id="editUserForm">
                <div class="form-grid">
                    <div class="form-group">
                        <label class="form-label">Tracker ID</label>
                        <input type="text" value="${user.tracker_id}" disabled class="form-input disabled">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nombre Completo</label>
                        <input type="text" name="display_name" value="${user.display_name}" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email Zenput</label>
                        <input type="email" name="zenput_email" value="${user.zenput_email}" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Teléfono</label>
                        <input type="tel" name="phone" value="${user.phone || ''}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rol</label>
                        <select name="rol" class="form-select" required>
                            <option value="auditor" ${user.rol === 'auditor' ? 'selected' : ''}>Auditor</option>
                            <option value="director" ${user.rol === 'director' ? 'selected' : ''}>Director</option>
                            <option value="gerente" ${user.rol === 'gerente' ? 'selected' : ''}>Gerente</option>
                            <option value="supervisor" ${user.rol === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                            <option value="usuario" ${user.rol === 'usuario' ? 'selected' : ''}>Usuario</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Grupo Operativo</label>
                        <select name="grupo" class="form-select" required>
                            ${this.operationalGroups.map(group => `
                                <option value="${group.group_name}" ${user.grupo === group.group_name ? 'selected' : ''}>
                                    ${group.group_name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" onclick="adminPanel.closeModal()" class="btn btn-secondary">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </div>
            </form>
        `);

        // Event listener para el formulario
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            await this.handleUpdateUser(e, user.id);
        });
    }

    async handleUpdateUser(e, userId) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            display_name: formData.get('display_name'),
            zenput_email: formData.get('zenput_email'),
            phone: formData.get('phone'),
            rol: formData.get('rol'),
            grupo: formData.get('grupo')
        };

        try {
            await this.apiRequest(`/api/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });

            this.showSuccess('Usuario actualizado exitosamente');
            this.closeModal();
            await this.loadUsers();
            
        } catch (error) {
            this.showError(`Error actualizando usuario: ${error.message}`);
        }
    }

    async toggleUserStatus(userId, newStatus) {
        const action = newStatus ? 'activar' : 'desactivar';
        
        if (!confirm(`¿Estás seguro de ${action} este usuario?`)) {
            return;
        }

        try {
            await this.apiRequest(`/api/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ active: newStatus })
            });

            this.showSuccess(`Usuario ${newStatus ? 'activado' : 'desactivado'} exitosamente`);
            await this.loadUsers();
            await this.loadStats();
            
        } catch (error) {
            this.showError(`Error al ${action} usuario: ${error.message}`);
        }
    }

    async deleteUser(userId) {
        if (!confirm('¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await this.apiRequest(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            this.showSuccess('Usuario eliminado exitosamente');
            await this.loadUsers();
            await this.loadStats();
            
        } catch (error) {
            this.showError(`Error eliminando usuario: ${error.message}`);
        }
    }

    // ===============================
    // TAB 2: GESTIÓN DE DIRECTORES
    // ===============================

    async switchTab(tabName) {
        // Actualizar botones de tab
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[onclick="switchTab('${tabName}')"]`)?.classList.add('active');
        
        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
        
        this.currentTab = tabName;

        // Cargar datos específicos del tab
        switch (tabName) {
            case 'directors':
                await this.loadDirectors();
                break;
            case 'roles':
                this.loadRolesInfo();
                break;
            case 'geofences':
                await this.loadGeofences();
                break;
            case 'system':
                await this.loadSystemInfo();
                break;
        }
    }

    async loadDirectors() {
        try {
            this.showLoading('directorsTable');
            const response = await this.apiRequest('/api/admin/directors');
            this.displayDirectors(response.data);
        } catch (error) {
            console.error('Error cargando directores:', error);
            this.showError('Error cargando directores');
        }
    }

    displayDirectors(directors) {
        const tbody = document.getElementById('directorsTable');
        
        if (directors.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="7" class="no-data">No hay directores asignados</td></tr>
            `;
            return;
        }

        tbody.innerHTML = directors.map(director => `
            <tr>
                <td><strong>${director.name}</strong></td>
                <td>-</td>
                <td>-</td>
                <td>
                    <div class="groups-list">
                        ${director.grupos_asignados.split(', ').map(group => 
                            `<span class="group-badge">${group}</span>`
                        ).join('')}
                    </div>
                </td>
                <td>${director.total_sucursales}</td>
                <td>-</td>
                <td class="actions">
                    <button onclick="adminPanel.editDirectorGroups('${director.name}')" class="btn-icon edit" title="Editar Grupos">
                        <span class="material-icons">edit</span>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async handleCreateDirector(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const selectedGroups = Array.from(document.getElementById('directorGroups').selectedOptions)
            .map(option => option.value);

        if (selectedGroups.length === 0) {
            this.showError('Debe seleccionar al menos un grupo operativo');
            return;
        }

        const directorData = {
            nombre: formData.get('directorName'),
            email: formData.get('directorEmail'),
            telefono: formData.get('directorPhone'),
            telegram_id: formData.get('telegramChat'),
            grupos_asignados: selectedGroups
        };

        try {
            await this.apiRequest('/api/admin/directors', {
                method: 'POST',
                body: JSON.stringify(directorData)
            });

            this.showSuccess('Director creado y asignado exitosamente');
            e.target.reset();
            await this.loadDirectors();
            
        } catch (error) {
            this.showError(`Error creando director: ${error.message}`);
        }
    }

    editDirectorGroups(directorName) {
        // Implementar modal para editar grupos del director
        this.showDirectorGroupsModal(directorName);
    }

    showDirectorGroupsModal(directorName) {
        const modal = this.createModal('editDirectorModal', `Reasignar Grupos - ${directorName}`, `
            <form id="editDirectorGroupsForm">
                <div class="form-group">
                    <label class="form-label">Grupos Operativos</label>
                    <select name="grupos_asignados" id="editDirectorGroups" class="form-select" multiple size="10" required>
                        ${this.operationalGroups.map(group => `
                            <option value="${group.group_name}">
                                ${group.group_name} (${group.total_sucursales} sucursales)
                            </option>
                        `).join('')}
                    </select>
                    <div class="help-text">Mantén presionado Ctrl/Cmd para seleccionar múltiples grupos</div>
                </div>
                <div class="modal-actions">
                    <button type="button" onclick="adminPanel.closeModal()" class="btn btn-secondary">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Reasignar Grupos</button>
                </div>
            </form>
        `);

        // Event listener para el formulario
        document.getElementById('editDirectorGroupsForm').addEventListener('submit', async (e) => {
            await this.handleUpdateDirectorGroups(e, directorName);
        });
    }

    async handleUpdateDirectorGroups(e, directorName) {
        e.preventDefault();
        
        const selectedGroups = Array.from(document.getElementById('editDirectorGroups').selectedOptions)
            .map(option => option.value);

        if (selectedGroups.length === 0) {
            this.showError('Debe seleccionar al menos un grupo operativo');
            return;
        }

        try {
            await this.apiRequest(`/api/admin/directors/${encodeURIComponent(directorName)}/assign-groups`, {
                method: 'PUT',
                body: JSON.stringify({ grupos_asignados: selectedGroups })
            });

            this.showSuccess('Grupos reasignados exitosamente');
            this.closeModal();
            await this.loadDirectors();
            
        } catch (error) {
            this.showError(`Error reasignando grupos: ${error.message}`);
        }
    }

    // ===============================
    // TAB 3: ROLES Y PERMISOS
    // ===============================

    loadRolesInfo() {
        const rolesContent = document.getElementById('rolesContent');
        
        const rolesData = [
            {
                role: 'admin',
                title: 'Administrador',
                description: 'Acceso total al sistema',
                permissions: ['Gestión completa', 'Panel de administración', 'Configuración sistema'],
                color: 'red'
            },
            {
                role: 'director',
                title: 'Director',
                description: 'Gestión de grupos operativos asignados',
                permissions: ['Dashboard grupos', 'Reportes', 'Gestión supervisores'],
                color: 'blue'
            },
            {
                role: 'gerente',
                title: 'Gerente',
                description: 'Gestión operativa de sucursales',
                permissions: ['Dashboard sucursales', 'Programar visitas', 'Ver reportes'],
                color: 'green'
            },
            {
                role: 'supervisor',
                title: 'Supervisor',
                description: 'Supervisión de sucursales específicas',
                permissions: ['Ejecutar visitas', 'Ver histórico', 'Reportes básicos'],
                color: 'orange'
            },
            {
                role: 'auditor',
                title: 'Auditor',
                description: 'Auditoria y control de calidad',
                permissions: ['Realizar auditorías', 'Generar reportes', 'Control de calidad'],
                color: 'purple'
            },
            {
                role: 'usuario',
                title: 'Usuario',
                description: 'Usuario básico de tracking',
                permissions: ['Ver ubicación', 'Histórico personal'],
                color: 'gray'
            }
        ];

        rolesContent.innerHTML = `
            <div class="roles-grid">
                ${rolesData.map(role => `
                    <div class="role-card ${role.color}">
                        <div class="role-header">
                            <span class="role-icon ${role.color}">
                                <span class="material-icons">
                                    ${role.role === 'admin' ? 'admin_panel_settings' : 
                                      role.role === 'director' ? 'supervisor_account' : 
                                      role.role === 'gerente' ? 'business' : 
                                      role.role === 'supervisor' ? 'visibility' : 
                                      role.role === 'auditor' ? 'verified' : 'person'}
                                </span>
                            </span>
                            <div>
                                <h3>${role.title}</h3>
                                <p>${role.description}</p>
                            </div>
                        </div>
                        <div class="role-permissions">
                            <h4>Permisos:</h4>
                            <ul>
                                ${role.permissions.map(permission => `
                                    <li><span class="material-icons">check</span>${permission}</li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="roles-hierarchy">
                <h3><span class="material-icons">account_tree</span>Jerarquía de Roles</h3>
                <div class="hierarchy-flow">
                    <div class="hierarchy-item admin">
                        <span class="material-icons">admin_panel_settings</span>
                        Admin
                    </div>
                    <div class="hierarchy-arrow">↓</div>
                    <div class="hierarchy-item director">
                        <span class="material-icons">supervisor_account</span>
                        Director
                    </div>
                    <div class="hierarchy-arrow">↓</div>
                    <div class="hierarchy-item manager">
                        <span class="material-icons">business</span>
                        Gerente
                    </div>
                    <div class="hierarchy-arrow">↓</div>
                    <div class="hierarchy-item supervisor">
                        <span class="material-icons">visibility</span>
                        Supervisor
                    </div>
                    <div class="hierarchy-arrow">↓</div>
                    <div class="hierarchy-item user">
                        <span class="material-icons">person</span>
                        Usuario
                    </div>
                </div>
            </div>
        `;
    }

    // ===============================
    // TAB 4: GEOFENCES
    // ===============================

    async loadGeofences() {
        try {
            this.showLoading('geofencesTable');
            await this.loadGeofencesByGroup();
            this.initializeMap();
        } catch (error) {
            console.error('Error cargando geofences:', error);
            this.showError('Error cargando geofences');
        }
    }

    async loadGeofencesByGroup() {
        try {
            const selectedGroup = document.getElementById('groupSelect')?.value || 'ALL';
            let endpoint = '/api/admin/groups';
            
            if (selectedGroup !== 'ALL') {
                endpoint = `/api/admin/groups/${selectedGroup}/locations`;
            }

            const response = await this.apiRequest(endpoint);
            const locations = selectedGroup === 'ALL' ? 
                await this.getAllLocations() : 
                response;

            this.displayGeofences(locations);
        } catch (error) {
            console.error('Error cargando geofences por grupo:', error);
        }
    }

    async getAllLocations() {
        const allLocations = [];
        for (const group of this.operationalGroups) {
            try {
                const locations = await this.apiRequest(`/api/admin/groups/${group.group_name}/locations`);
                allLocations.push(...locations);
            } catch (error) {
                console.error(`Error cargando ubicaciones de ${group.group_name}:`, error);
            }
        }
        return allLocations;
    }

    displayGeofences(locations) {
        const container = document.getElementById('geofencesTable');
        
        if (!locations || locations.length === 0) {
            container.innerHTML = '<div class="no-data">No hay geofences para mostrar</div>';
            return;
        }

        container.innerHTML = `
            <div class="geofences-controls">
                <div class="bulk-actions">
                    <button onclick="adminPanel.toggleAllGeofences(true)" class="btn btn-success">
                        <span class="material-icons">check_circle</span>
                        Activar Todas
                    </button>
                    <button onclick="adminPanel.toggleAllGeofences(false)" class="btn btn-danger">
                        <span class="material-icons">cancel</span>
                        Desactivar Todas
                    </button>
                </div>
                <div class="geofences-stats">
                    <span class="stat active">
                        ${locations.filter(l => l.geofence_enabled).length} Activas
                    </span>
                    <span class="stat inactive">
                        ${locations.filter(l => !l.geofence_enabled).length} Inactivas
                    </span>
                </div>
            </div>
            
            <div class="geofences-grid">
                ${locations.map(location => `
                    <div class="geofence-card ${location.geofence_enabled ? 'active' : 'inactive'}">
                        <div class="geofence-header">
                            <h4>${location.location_name || location.name}</h4>
                            <span class="group-badge">${location.group_name}</span>
                        </div>
                        <div class="geofence-details">
                            <p><span class="material-icons">location_on</span>${location.address}</p>
                            <p><span class="material-icons">radio_button_unchecked</span>Radio: ${location.geofence_radius}m</p>
                        </div>
                        <div class="geofence-controls">
                            <label class="switch">
                                <input type="checkbox" 
                                       ${location.geofence_enabled ? 'checked' : ''} 
                                       onchange="adminPanel.toggleGeofence(${location.id}, this.checked)">
                                <span class="slider"></span>
                            </label>
                            <button onclick="adminPanel.editGeofenceRadius(${location.id}, ${location.geofence_radius})" 
                                    class="btn-icon" title="Editar Radio">
                                <span class="material-icons">tune</span>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async toggleGeofence(locationId, enabled) {
        try {
            await this.apiRequest(`/api/admin/locations/${locationId}/geofence`, {
                method: 'PUT',
                body: JSON.stringify({ geofence_enabled: enabled })
            });

            this.showSuccess(`Geofence ${enabled ? 'activado' : 'desactivado'} exitosamente`);
            // No recargar todo, solo actualizar el estado visualmente
            
        } catch (error) {
            this.showError(`Error actualizando geofence: ${error.message}`);
            // Revertir el switch
            event.target.checked = !enabled;
        }
    }

    async toggleAllGeofences(enabled) {
        const selectedGroup = document.getElementById('groupSelect')?.value;
        
        if (!selectedGroup || selectedGroup === 'ALL') {
            this.showError('Selecciona un grupo específico para operaciones masivas');
            return;
        }

        if (!confirm(`¿Estás seguro de ${enabled ? 'activar' : 'desactivar'} todos los geofences del grupo ${selectedGroup}?`)) {
            return;
        }

        try {
            await this.apiRequest(`/api/admin/groups/${selectedGroup}/geofences`, {
                method: 'PUT',
                body: JSON.stringify({ geofence_enabled: enabled })
            });

            this.showSuccess(`Geofences del grupo ${selectedGroup} ${enabled ? 'activados' : 'desactivados'} exitosamente`);
            await this.loadGeofencesByGroup();
            
        } catch (error) {
            this.showError(`Error en operación masiva: ${error.message}`);
        }
    }

    initializeMap() {
        // Placeholder para la implementación del mapa
        // Se implementará con Leaflet.js en una versión futura
        console.log('🗺️ Mapa de geofences - Próximamente');
    }

    // ===============================
    // TAB 5: SISTEMA
    // ===============================

    async loadSystemInfo() {
        try {
            const [status, metrics] = await Promise.all([
                this.apiRequest('/api/admin/system/status'),
                this.apiRequest('/api/admin/system/metrics')
            ]);

            this.displaySystemInfo(status, metrics);
        } catch (error) {
            console.error('Error cargando información del sistema:', error);
            this.showError('Error cargando información del sistema');
        }
    }

    displaySystemInfo(status, metrics) {
        const container = document.getElementById('systemContent');
        
        container.innerHTML = `
            <div class="system-overview">
                <div class="system-cards">
                    <div class="system-card health">
                        <h3><span class="material-icons">health_and_safety</span>Estado del Sistema</h3>
                        <div class="health-indicators">
                            <div class="health-item ${status.health?.api === 'Healthy' ? 'healthy' : 'error'}">
                                <span class="material-icons">api</span>
                                <span>API: ${status.health?.api || 'Unknown'}</span>
                            </div>
                            <div class="health-item ${status.health?.database === 'Connected' ? 'healthy' : 'error'}">
                                <span class="material-icons">storage</span>
                                <span>Base de Datos: ${status.health?.database || 'Unknown'}</span>
                            </div>
                            <div class="health-item ${status.health?.auth === 'Active' ? 'healthy' : 'error'}">
                                <span class="material-icons">security</span>
                                <span>Autenticación: ${status.health?.auth || 'Unknown'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="system-card uptime">
                        <h3><span class="material-icons">schedule</span>Tiempo de Actividad</h3>
                        <div class="uptime-display">
                            <div class="uptime-value">
                                ${status.system?.uptime?.days || 0}d 
                                ${status.system?.uptime?.hours || 0}h 
                                ${status.system?.uptime?.minutes || 0}m
                            </div>
                            <div class="uptime-label">Días activo</div>
                        </div>
                    </div>

                    <div class="system-card memory">
                        <h3><span class="material-icons">memory</span>Memoria del Sistema</h3>
                        <div class="memory-stats">
                            <div class="memory-item">
                                <span>Usado:</span>
                                <span>${this.formatBytes(status.system?.memory?.heapUsed || 0)}</span>
                            </div>
                            <div class="memory-item">
                                <span>Total:</span>
                                <span>${this.formatBytes(status.system?.memory?.heapTotal || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="system-actions">
                    <h3><span class="material-icons">build</span>Acciones del Sistema</h3>
                    <div class="actions-grid">
                        <button onclick="adminPanel.syncSystemData()" class="action-btn sync">
                            <span class="material-icons">sync</span>
                            <span>Sincronizar Datos</span>
                        </button>
                        <button onclick="adminPanel.exportSystemData()" class="action-btn export">
                            <span class="material-icons">download</span>
                            <span>Exportar Datos</span>
                        </button>
                        <button onclick="adminPanel.viewSystemLogs()" class="action-btn logs">
                            <span class="material-icons">article</span>
                            <span>Ver Logs</span>
                        </button>
                        <button onclick="adminPanel.systemMaintenance()" class="action-btn maintenance">
                            <span class="material-icons">build_circle</span>
                            <span>Mantenimiento</span>
                        </button>
                    </div>
                </div>

                <div class="database-stats">
                    <h3><span class="material-icons">analytics</span>Estadísticas de Base de Datos</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-value">${status.database?.total_gps_users || 0}</span>
                            <span class="stat-label">Usuarios GPS</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${status.database?.total_branches || 0}</span>
                            <span class="stat-label">Sucursales</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${status.database?.total_groups || 0}</span>
                            <span class="stat-label">Grupos</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${status.database?.active_sessions || 0}</span>
                            <span class="stat-label">Sesiones Activas</span>
                        </div>
                    </div>
                </div>

                ${metrics.metrics?.top_actions?.length > 0 ? `
                    <div class="activity-metrics">
                        <h3><span class="material-icons">trending_up</span>Actividad Reciente</h3>
                        <div class="metrics-grid">
                            ${metrics.metrics.top_actions.slice(0, 5).map(action => `
                                <div class="metric-item">
                                    <span class="metric-name">${action.action}</span>
                                    <span class="metric-value">${action.count}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async syncSystemData() {
        if (!confirm('¿Estás seguro de sincronizar los datos del sistema? Esto puede tomar varios minutos.')) {
            return;
        }

        try {
            this.showLoading('syncButton');
            await this.apiRequest('/api/admin/system/sync-data', {
                method: 'POST'
            });

            this.showSuccess('Sincronización iniciada. Los datos se actualizarán en segundo plano.');
            
        } catch (error) {
            this.showError(`Error iniciando sincronización: ${error.message}`);
        } finally {
            this.hideLoading('syncButton');
        }
    }

    exportSystemData() {
        this.showInfo('Función de exportación próximamente disponible');
    }

    viewSystemLogs() {
        this.showInfo('Visor de logs próximamente disponible');
    }

    systemMaintenance() {
        this.showInfo('Herramientas de mantenimiento próximamente disponibles');
    }

    // ===============================
    // UTILIDADES DE UI
    // ===============================

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            if (element.tagName === 'TBODY') {
                element.innerHTML = `
                    <tr><td colspan="7" class="loading">
                        <div class="spinner"></div>Cargando...
                    </td></tr>
                `;
            } else {
                element.innerHTML = '<div class="spinner"></div>Cargando...';
            }
        }
    }

    hideLoading(elementId) {
        // La carga se oculta cuando se actualiza el contenido
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type) {
        // Crear toast container si no existe
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Crear toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-icons">
                ${type === 'success' ? 'check_circle' : 
                  type === 'error' ? 'error' : 
                  type === 'info' ? 'info' : 'warning'}
            </span>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="toast-close">
                <span class="material-icons">close</span>
            </button>
        `;

        container.appendChild(toast);

        // Auto-remove después de 5 segundos
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    createModal(id, title, content) {
        // Remover modal existente si existe
        const existingModal = document.getElementById(id);
        if (existingModal) {
            existingModal.remove();
        }

        // Crear modal
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button onclick="adminPanel.closeModal()" class="modal-close">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // Cerrar con escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return modal;
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.remove());
    }

    updatePagination(pagination, context) {
        // Implementar paginación si es necesario
        console.log('Paginación:', pagination);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// ===============================
// FUNCIONES GLOBALES
// ===============================

function switchTab(tabName) {
    window.adminPanel.switchTab(tabName);
}

function showRoleInfo() {
    // Función llamada desde el HTML original
    const role = document.getElementById('userRole').value;
    const roleCards = document.getElementById('roleCards');
    
    if (role && roleCards) {
        const roleInfo = {
            'auditor': 'Realizar auditorías y control de calidad',
            'director': 'Gestionar grupos operativos asignados',
            'gerente': 'Gestión operativa de sucursales',
            'supervisor': 'Supervisión de sucursales específicas',
            'usuario': 'Usuario básico de tracking GPS'
        };
        
        roleCards.innerHTML = `
            <div class="role-info">
                <span class="material-icons">info</span>
                ${roleInfo[role] || 'Información no disponible'}
            </div>
        `;
        roleCards.style.display = 'block';
    } else if (roleCards) {
        roleCards.style.display = 'none';
    }
}

function loadGeofencesByGroup() {
    if (window.adminPanel) {
        window.adminPanel.loadGeofencesByGroup();
    }
}

// ===============================
// INICIALIZACIÓN
// ===============================

document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});