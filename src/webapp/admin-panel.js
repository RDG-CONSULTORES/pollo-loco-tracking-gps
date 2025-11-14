/**
 * PANEL DE ADMINISTRACIÓN - POLLO LOCO GPS
 * Sistema de gestión de usuarios, directores y roles
 */

class AdminPanel {
    constructor() {
        this.authToken = localStorage.getItem('auth_token');
        this.userData = JSON.parse(localStorage.getItem('user_data') || '{}');
        
        this.init();
    }

    async init() {
        // Verificar autenticación
        if (!this.authToken) {
            this.redirectToLogin();
            return;
        }

        // Verificar que el usuario tenga permisos de admin
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
        await this.loadUsers();
        
        // Configurar event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Formulario de crear usuario
        const createUserForm = document.getElementById('createUserForm');
        createUserForm.addEventListener('submit', (e) => this.handleCreateUser(e));

        // Formulario de crear director
        const createDirectorForm = document.getElementById('createDirectorForm');
        createDirectorForm.addEventListener('submit', (e) => this.handleCreateDirector(e));
    }

    updateUserInfo(user) {
        const userName = document.getElementById('userName');
        userName.textContent = `${user.fullName} (${user.userType})`;
    }

    redirectToLogin() {
        window.location.href = '/webapp/login.html';
    }

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

    async loadStats() {
        try {
            const stats = await this.apiRequest('/api/admin/stats/dashboard');
            this.renderStats(stats);
        } catch (error) {
            console.error('Error cargando estadísticas:', error);
        }
    }

    renderStats(stats) {
        const statsGrid = document.getElementById('statsGrid');
        
        const statsData = [
            {
                icon: 'people',
                title: 'Usuarios GPS',
                number: `${stats.users?.active || 0}/${stats.users?.total || 0}`,
                description: 'Usuarios activos/total',
                iconClass: 'users'
            },
            {
                icon: 'location_on',
                title: 'Sucursales',
                number: `${stats.locations?.active || 0}`,
                description: 'Ubicaciones monitoreadas',
                iconClass: 'locations'
            },
            {
                icon: 'today',
                title: 'Visitas Hoy',
                number: `${stats.visits_today?.completed || 0}`,
                description: `${stats.visits_today?.open || 0} en progreso`,
                iconClass: 'visits'
            },
            {
                icon: 'settings',
                title: 'Sistema',
                number: stats.system_status === 'active' ? 'Activo' : 'Pausado',
                description: 'Estado del seguimiento',
                iconClass: 'system'
            }
        ];

        statsGrid.innerHTML = statsData.map(stat => `
            <div class="stat-card">
                <div class="stat-header">
                    <div class="stat-icon ${stat.iconClass}">
                        <span class="material-icons">${stat.icon}</span>
                    </div>
                    <div class="stat-title">${stat.title}</div>
                </div>
                <div class="stat-number">${stat.number}</div>
                <div class="stat-description">${stat.description}</div>
            </div>
        `).join('');
    }

    async loadUsers() {
        try {
            const users = await this.apiRequest('/api/admin/users');
            this.renderUsers(users);
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            document.getElementById('usersTable').innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #ef4444;">
                        Error cargando usuarios: ${error.message}
                    </td>
                </tr>
            `;
        }
    }

    renderUsers(users) {
        const usersTable = document.getElementById('usersTable');
        
        if (!users || users.length === 0) {
            usersTable.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #64748b;">
                        No hay usuarios registrados
                    </td>
                </tr>
            `;
            return;
        }

        usersTable.innerHTML = users.map(user => `
            <tr>
                <td><strong>${user.tracker_id}</strong></td>
                <td>${user.display_name}</td>
                <td>${user.zenput_email}</td>
                <td>
                    <span class="badge ${this.getRoleBadgeClass(user.rol || 'usuario')}">
                        ${this.getRoleDisplayName(user.rol || 'usuario')}
                    </span>
                </td>
                <td>${user.grupo || '<span style="color: #64748b;">Sin grupo</span>'}</td>
                <td>
                    <span class="badge ${user.active ? 'success' : 'warning'}">
                        ${user.active ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="action-btn secondary" onclick="adminPanel.editUser('${user.tracker_id}')">
                        <span class="material-icons">edit</span>
                        Editar
                    </button>
                    <button class="action-btn secondary" onclick="adminPanel.viewUserRoutes('${user.tracker_id}')">
                        <span class="material-icons">map</span>
                        Rutas
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getRoleBadgeClass(role) {
        const classes = {
            'auditor': 'danger',
            'director': 'warning',
            'gerente': 'info',
            'supervisor': 'success',
            'usuario': 'info'
        };
        return classes[role] || 'info';
    }

    getRoleDisplayName(role) {
        const names = {
            'auditor': 'Auditor',
            'director': 'Director',
            'gerente': 'Gerente',
            'supervisor': 'Supervisor',
            'usuario': 'Usuario'
        };
        return names[role] || 'Usuario';
    }

    async handleCreateUser(e) {
        e.preventDefault();
        
        const formData = {
            tracker_id: document.getElementById('trackerId').value,
            display_name: document.getElementById('displayName').value,
            zenput_email: document.getElementById('zenputEmail').value,
            phone: document.getElementById('phone').value || null,
            // Estos campos los agregamos a tracking_users también
            grupo: document.getElementById('userGroup').value,
            rol: document.getElementById('userRole').value
        };

        try {
            // Deshabilitar botón
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Creando...';

            // Crear usuario GPS
            await this.apiRequest('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            // Actualizar rol y grupo (paso adicional)
            try {
                await this.updateUserRoleAndGroup(formData.tracker_id, formData.rol, formData.grupo);
            } catch (roleError) {
                console.warn('Error actualizando rol:', roleError);
            }

            // Limpiar formulario
            document.getElementById('createUserForm').reset();
            document.getElementById('roleCards').style.display = 'none';
            
            // Recargar usuarios
            await this.loadUsers();
            
            alert('Usuario creado exitosamente');

        } catch (error) {
            console.error('Error creando usuario:', error);
            alert(`Error creando usuario: ${error.message}`);
        } finally {
            // Rehabilitar botón
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-icons">add</span> Crear Usuario';
        }
    }

    async updateUserRoleAndGroup(trackerId, role, group) {
        // Actualizar con el endpoint de roles
        try {
            await this.apiRequest(`/api/admin/users/${trackerId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    rol: role,
                    grupo: group
                })
            });
        } catch (error) {
            console.warn('No se pudo actualizar rol/grupo:', error);
        }
    }

    async handleCreateDirector(e) {
        e.preventDefault();
        
        const formData = {
            director_code: document.getElementById('directorCode').value,
            full_name: document.getElementById('directorName').value,
            email: document.getElementById('directorEmail').value,
            telegram_chat_id: document.getElementById('telegramChat').value || null
        };

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner"></div> Creando...';

            // Crear director
            await this.apiRequest('/api/admin/directors', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            document.getElementById('createDirectorForm').reset();
            await this.loadDirectors();
            
            alert('Director creado exitosamente');

        } catch (error) {
            console.error('Error creando director:', error);
            alert(`Error creando director: ${error.message}`);
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-icons">add</span> Crear Director';
        }
    }

    async editUser(trackerId) {
        alert(`Funcionalidad de editar usuario ${trackerId} próximamente`);
    }

    async viewUserRoutes(trackerId) {
        window.open(`/webapp/dashboard.html?user=${trackerId}`, '_blank');
    }

    async loadDirectors() {
        // Implementar cuando tengamos el endpoint de directores
        console.log('Cargando directores...');
    }
}

// Función global para cambiar tabs
function switchTab(tabName) {
    // Remover active de todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Activar el botón y contenido seleccionado
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
    
    // Cargar contenido específico del tab
    switch(tabName) {
        case 'directors':
            adminPanel.loadDirectors();
            break;
        case 'roles':
            adminPanel.loadRoles();
            break;
        case 'system':
            adminPanel.loadSystemConfig();
            break;
    }
}

// Función para mostrar información del rol seleccionado
function showRoleInfo() {
    const roleSelect = document.getElementById('userRole');
    const roleCards = document.getElementById('roleCards');
    
    if (!roleSelect.value) {
        roleCards.style.display = 'none';
        return;
    }

    const roleInfo = {
        'auditor': {
            title: '🔴 AUDITOR',
            description: 'Acceso completo al sistema',
            permissions: ['Ve TODOS los usuarios', 'Ve TODAS las sucursales', 'Modifica configuraciones', 'Estadísticas globales'],
            ideal: 'Administradores del sistema'
        },
        'director': {
            title: '🟠 DIRECTOR', 
            description: 'Supervisa grupos operativos específicos',
            permissions: ['Ve usuarios de SUS grupos', 'Ve sucursales de SUS grupos', 'Reportes de SU área', 'No ve otros grupos'],
            ideal: 'Directores regionales/zonales'
        },
        'gerente': {
            title: '🟡 GERENTE',
            description: 'Gestión operativa de equipos',
            permissions: ['Ve usuarios de SU grupo', 'Reportes de SU equipo', 'No configura sistema', 'Acceso limitado'],
            ideal: 'Gerentes de área'
        },
        'supervisor': {
            title: '🟢 SUPERVISOR',
            description: 'Acceso de solo lectura a sus propios datos',
            permissions: ['Ve SUS propios reportes', 'Descarga SUS estadísticas', 'No ve otros usuarios', 'Solo consulta'],
            ideal: 'Supervisores de campo'
        },
        'usuario': {
            title: '🔵 USUARIO',
            description: 'Tracking básico únicamente',
            permissions: ['Su dispositivo envía ubicación', 'Aparece en el mapa', 'Sin acceso al dashboard', 'Solo GPS'],
            ideal: 'Personal operativo básico'
        }
    };

    const role = roleInfo[roleSelect.value];
    if (!role) return;

    roleCards.innerHTML = `
        <div class="role-card selected">
            <div class="role-title">${role.title}</div>
            <div class="role-description">${role.description}</div>
            <div class="role-permissions">
                ${role.permissions.map(perm => 
                    `<span class="permission-tag ${perm.startsWith('No') || perm.startsWith('Sin') ? 'denied' : 'allowed'}">${perm}</span>`
                ).join('')}
            </div>
            <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #059669;">
                💡 <strong>Ideal para:</strong> ${role.ideal}
            </div>
        </div>
    `;
    
    roleCards.style.display = 'grid';
}

// Inicializar el panel cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});