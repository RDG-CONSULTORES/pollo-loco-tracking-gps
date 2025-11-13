// Telegram Web App integration
const tg = window.Telegram?.WebApp;

// Initialize Telegram Web App
if (tg) {
  tg.ready();
  tg.expand();
  tg.MainButton.hide();
}

// API Configuration
const API_URL = window.location.origin + '/api';

// Global state
let currentData = {
  users: [],
  config: {},
  stats: {},
  systemActive: false
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
});

async function initializeApp() {
  try {
    // Show loading screen
    document.getElementById('loadingScreen').style.display = 'flex';
    
    // Update time display
    updateTimeDisplay();
    setInterval(updateTimeDisplay, 1000);
    
    // Load initial data
    await loadDashboardData();
    
    // Hide loading screen
    setTimeout(() => {
      document.getElementById('loadingScreen').style.display = 'none';
    }, 500);
    
    console.log('✅ App initialized');
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    showToast('Error inicializando aplicación', 'error');
    document.getElementById('loadingScreen').style.display = 'none';
  }
}

// Section navigation
function showSection(sectionName) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Show selected section
  document.getElementById(sectionName).classList.add('active');
  document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
  
  // Load section data
  switch(sectionName) {
    case 'dashboard':
      loadDashboardData();
      break;
    case 'usuarios':
      loadUsers();
      break;
    case 'config':
      loadConfig();
      break;
    case 'reportes':
      loadReports();
      break;
  }
}

// Dashboard functions
async function loadDashboardData() {
  try {
    // Load stats
    const statsResponse = await fetch(`${API_URL}/admin/stats/dashboard`);
    const stats = await statsResponse.json();
    
    // Update UI
    updateDashboardStats(stats);
    
    // Load recent visits
    await loadRecentVisits();
    
    // Update system status
    updateSystemStatus();
    
    currentData.stats = stats;
    
  } catch (error) {
    console.error('❌ Error loading dashboard:', error);
    showToast('Error cargando dashboard', 'error');
  }
}

function updateDashboardStats(stats) {
  document.getElementById('statsActiveUsers').textContent = stats.users?.active || 0;
  document.getElementById('statsLocations').textContent = stats.locations?.active || 0;
  document.getElementById('statsVisitsToday').textContent = stats.visits_today?.total || 0;
  
  // Calculate coverage percentage
  const coverage = stats.locations?.active > 0 ? 
    Math.round((stats.visits_today?.total || 0) / stats.locations.active * 100) : 0;
  document.getElementById('statsCoverage').textContent = `${coverage}%`;
}

async function loadRecentVisits() {
  try {
    const response = await fetch(`${API_URL}/admin/visits/today`);
    const visits = await response.json();
    
    const container = document.getElementById('recentVisits');
    
    if (visits.length === 0) {
      container.innerHTML = '<div class="activity-item">No hay visitas registradas hoy</div>';
      return;
    }
    
    container.innerHTML = visits.slice(0, 5).map(visit => {
      const time = new Date(visit.entry_time).toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const status = visit.exit_time ? '✅ Completada' : '🔄 En progreso';
      const duration = visit.duration_minutes ? ` (${visit.duration_minutes}m)` : '';
      
      return `
        <div class="activity-item">
          <div class="activity-info">
            <h4>${visit.supervisor_name} → ${visit.location_name}</h4>
            <p>${status}${duration}</p>
          </div>
          <div class="activity-time">${time}</div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('❌ Error loading recent visits:', error);
    document.getElementById('recentVisits').innerHTML = 
      '<div class="activity-item">Error cargando actividad</div>';
  }
}

async function refreshDashboard() {
  showToast('Actualizando...', 'info');
  await loadDashboardData();
  showToast('Dashboard actualizado', 'success');
}

// Users functions
async function loadUsers() {
  try {
    const response = await fetch(`${API_URL}/admin/users`);
    const users = await response.json();
    
    const container = document.getElementById('usersList');
    
    if (users.length === 0) {
      container.innerHTML = `
        <div class="card">
          <p>No hay usuarios registrados.</p>
          <button class="btn btn-primary" onclick="showCreateUserModal()">
            ➕ Crear primer usuario
          </button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = users.map(user => `
      <div class="user-card">
        <div class="user-info">
          <h4>${user.display_name}</h4>
          <p>${user.tracker_id} • ${user.zenput_email}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" ${user.active ? 'checked' : ''} 
                 onchange="toggleUser('${user.tracker_id}', this.checked)">
          <span class="slider"></span>
        </label>
      </div>
    `).join('');
    
    currentData.users = users;
    
  } catch (error) {
    console.error('❌ Error loading users:', error);
    document.getElementById('usersList').innerHTML = 
      '<div class="card">Error cargando usuarios</div>';
  }
}

async function toggleUser(trackerId, active) {
  try {
    const response = await fetch(`${API_URL}/admin/users/${trackerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    
    if (response.ok) {
      showToast(`Usuario ${active ? 'activado' : 'pausado'}`, 'success');
      // Update local data
      const user = currentData.users.find(u => u.tracker_id === trackerId);
      if (user) user.active = active;
    } else {
      throw new Error('Error en la respuesta del servidor');
    }
    
  } catch (error) {
    console.error('❌ Error toggling user:', error);
    showToast('Error actualizando usuario', 'error');
    // Revert toggle
    setTimeout(() => loadUsers(), 100);
  }
}

// Create User Modal
function showCreateUserModal() {
  document.getElementById('createUserModal').style.display = 'block';
  document.getElementById('trackerId').focus();
}

function closeCreateUserModal() {
  document.getElementById('createUserModal').style.display = 'none';
  document.getElementById('createUserForm').reset();
}

async function createUser(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const userData = {
    tracker_id: formData.get('trackerId').toUpperCase(),
    display_name: formData.get('displayName'),
    zenput_email: formData.get('zenputEmail'),
    phone: formData.get('phone') || null
  };
  
  try {
    const response = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    if (response.ok) {
      showToast('Usuario creado exitosamente', 'success');
      closeCreateUserModal();
      loadUsers(); // Refresh users list
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Error creando usuario');
    }
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
    showToast(error.message, 'error');
  }
}

// Config functions
async function loadConfig() {
  try {
    const response = await fetch(`${API_URL}/admin/config`);
    const config = await response.json();
    
    const container = document.getElementById('configList');
    
    container.innerHTML = Object.entries(config).map(([key, data]) => `
      <div class="config-item">
        <div class="config-info">
          <h4>${data.description}</h4>
          <p>${key}</p>
        </div>
        <div class="config-value">${data.value}</div>
      </div>
    `).join('');
    
    currentData.config = config;
    
  } catch (error) {
    console.error('❌ Error loading config:', error);
    document.getElementById('configList').innerHTML = 
      '<div class="card">Error cargando configuración</div>';
  }
}

// Reports functions
async function loadReports() {
  try {
    const date = document.getElementById('reportDate').value;
    let dateParam = '';
    
    const today = new Date();
    switch(date) {
      case 'today':
        dateParam = today.toISOString().split('T')[0];
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        dateParam = yesterday.toISOString().split('T')[0];
        break;
      case 'week':
        // For now, just show today
        dateParam = today.toISOString().split('T')[0];
        break;
    }
    
    const response = await fetch(`${API_URL}/tracking/stats/daily?date=${dateParam}`);
    const stats = await response.json();
    
    const container = document.getElementById('reportsList');
    
    container.innerHTML = `
      <div class="card">
        <h4>📊 Estadísticas del ${new Date(dateParam).toLocaleDateString('es-MX')}</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <div class="stat-label">Supervisores Activos</div>
              <div class="stat-value">${stats.stats?.supervisores_activos || 0}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏢</div>
            <div class="stat-content">
              <div class="stat-label">Sucursales Visitadas</div>
              <div class="stat-value">${stats.stats?.sucursales_visitadas || 0}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📍</div>
            <div class="stat-content">
              <div class="stat-label">Total Visitas</div>
              <div class="stat-value">${stats.stats?.total_visitas || 0}</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-content">
              <div class="stat-label">Duración Promedio</div>
              <div class="stat-value">${stats.stats?.duracion_promedio || 0}m</div>
            </div>
          </div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Error loading reports:', error);
    document.getElementById('reportsList').innerHTML = 
      '<div class="card">Error cargando reportes</div>';
  }
}

// System control
async function toggleSystem() {
  try {
    const isActive = currentData.stats.system_status === 'active';
    const newStatus = isActive ? 'false' : 'true';
    
    const response = await fetch(`${API_URL}/admin/config/system_active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newStatus })
    });
    
    if (response.ok) {
      currentData.stats.system_status = isActive ? 'paused' : 'active';
      updateSystemStatus();
      showToast(`Sistema ${isActive ? 'pausado' : 'activado'}`, 'success');
    } else {
      throw new Error('Error actualizando sistema');
    }
    
  } catch (error) {
    console.error('❌ Error toggling system:', error);
    showToast('Error controlando sistema', 'error');
  }
}

function updateSystemStatus() {
  const statusBadge = document.getElementById('systemStatus');
  const toggleBtn = document.getElementById('toggleSystemBtn');
  
  const isActive = currentData.stats.system_status === 'active';
  
  statusBadge.textContent = isActive ? '🟢 Activo' : '🔴 Pausado';
  statusBadge.className = `status-badge ${isActive ? 'active' : 'paused'}`;
  
  toggleBtn.textContent = isActive ? '⏸️ Pausar Sistema' : '▶️ Activar Sistema';
  toggleBtn.className = `btn ${isActive ? 'btn-warning' : 'btn-success'}`;
}

// Utility functions
function updateTimeDisplay() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const timeDisplay = document.getElementById('timeDisplay');
  if (timeDisplay) {
    timeDisplay.textContent = timeString;
  }
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3000);
}

// Event listeners
document.addEventListener('click', function(event) {
  // Close modal when clicking outside
  if (event.target.classList.contains('modal')) {
    event.target.style.display = 'none';
  }
});

// Handle form submissions
document.getElementById('createUserForm').addEventListener('submit', createUser);

// Telegram Web App specific handlers
if (tg) {
  // Handle back button
  tg.BackButton.onClick(() => {
    // Close any open modals first
    const openModal = document.querySelector('.modal[style*="block"]');
    if (openModal) {
      openModal.style.display = 'none';
      return;
    }
    
    // Otherwise, close the web app
    tg.close();
  });
  
  // Show back button when modal is open
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        const modal = mutation.target;
        if (modal.style.display === 'block') {
          tg.BackButton.show();
        } else if (modal.style.display === 'none') {
          tg.BackButton.hide();
        }
      }
    });
  });
  
  document.querySelectorAll('.modal').forEach((modal) => {
    observer.observe(modal, { attributes: true });
  });
}

console.log('📱 Pollo Loco Admin Web App loaded');