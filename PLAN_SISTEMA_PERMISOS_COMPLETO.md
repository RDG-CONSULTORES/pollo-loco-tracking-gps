# 🏛️ PLAN SISTEMA DE PERMISOS COMPLETO

## 🎉 IMPLEMENTADO ✅

### 📱 Panel Admin Mobile-First
- ✅ **admin-mobile.html**: UI optimizada para Telegram Web App
- ✅ **Auto-detección**: Telegram users → versión móvil automáticamente
- ✅ **Touch-friendly**: Botones 48px+, gestos móviles
- ✅ **APIs backend**: stats, users, grupos, configuración
- ✅ **Wizard usuarios**: Creación fácil con auto-generación IDs
- ✅ **Telegram integration**: MainButton, popups, tema nativo

### 🔧 APIs Funcionando
- ✅ `GET /api/admin/stats` - Dashboard estadísticas
- ✅ `GET /api/admin/quick-status` - Estado sistema tiempo real
- ✅ `GET /api/admin/users` - Lista usuarios GPS completa  
- ✅ `POST /api/admin/users` - Crear usuario + config OwnTracks
- ✅ `GET /api/admin/groups` - Grupos operativos disponibles

## 🚀 PRÓXIMA FASE: SISTEMA DE PERMISOS

### 1. Base de Datos (2-3 días)

```sql
-- Tabla de directores
CREATE TABLE directors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    telegram_chat_id VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Grupos operativos formales
CREATE TABLE operational_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    director_id INTEGER REFERENCES directors(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Permisos granulares
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'users', 'alerts', 'reports', 'system'
    action VARCHAR(50)    -- 'view', 'create', 'edit', 'delete'
);

-- Roles con permisos
CREATE TABLE role_permissions (
    role VARCHAR(50),
    permission_id INTEGER REFERENCES permissions(id),
    granted BOOLEAN DEFAULT true,
    PRIMARY KEY (role, permission_id)
);

-- Asignación directores a grupos
CREATE TABLE director_groups (
    director_id INTEGER REFERENCES directors(id),
    group_id INTEGER REFERENCES operational_groups(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (director_id, group_id)
);

-- Actualizar usuarios existentes
ALTER TABLE tracking_users 
ADD COLUMN operational_group_id INTEGER REFERENCES operational_groups(id),
ADD COLUMN director_id INTEGER REFERENCES directors(id);
```

### 2. Middleware de Permisos

```javascript
// src/middleware/permissions.js
function requireRole(roles) {
  return (req, res, next) => {
    const userRole = req.user.role; // from JWT/session
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        required: roles,
        current: userRole
      });
    }
    
    next();
  };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    const hasPermission = await checkUserPermission(req.user.id, permission);
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Permiso denegado',
        permission: permission
      });
    }
    
    next();
  };
}
```

### 3. Panel Director Específico

```html
<!-- director-panel.html -->
<!-- Solo ve SU región, SUS usuarios, SUS alertas -->
<div class="director-scope">
  <div class="scope-header">
    📍 Región: {{director.region}}
    👥 Usuarios: {{director.usersCount}}
    🏢 Sucursales: {{director.storesCount}}
  </div>
  
  <div class="director-controls">
    <!-- Solo puede gestionar SU equipo -->
    <action-card title="Mis Usuarios GPS" 
                 description="{{director.usersCount}} usuarios bajo tu gestión"
                 onclick="openMyUsers()" />
                 
    <action-card title="Alertas de mi Región" 
                 description="Configurar notificaciones"
                 onclick="openMyAlerts()" />
                 
    <action-card title="Reportes Regionales" 
                 description="Métricas de tu equipo"
                 onclick="openMyReports()" />
  </div>
</div>
```

### 4. Wizard Gestión GPS Completo

```javascript
// Proceso completo crear usuario GPS
const createUserWizard = {
  steps: [
    'basicInfo',      // Nombre, email, rol
    'groupSelection', // Asignar a grupo/director  
    'gpsSetup',       // Auto-generar config OwnTracks
    'qrGeneration',   // QR code para setup fácil
    'testConnection', // Verificar primera ubicación
    'completion'      // Confirmar y notificar
  ],
  
  generateQRConfig(user) {
    const config = {
      _type: "configuration",
      settings: {
        url: `${WEB_APP_URL}/api/owntracks/location`,
        tid: user.tracker_id,
        clientId: user.tracker_id,
        username: `plgps_${user.tracker_id}`,
        password: generateSecurePassword()
      }
    };
    
    return generateQRCode(JSON.stringify(config));
  }
};
```

### 5. Sistema de Alertas por Director

```javascript
// Configuración alertas específicas por director
const directorAlerts = {
  geofenceSettings: {
    enableEntryAlerts: true,
    enableExitAlerts: true,
    workingHoursOnly: true,
    alertChannels: ['telegram', 'email'],
    customMessage: "Usuario {{user}} llegó a {{store}}"
  },
  
  reportSettings: {
    dailyReportTime: "15:00",
    weeklyReport: true,
    monthlyReport: true,
    includeMetrics: ['visits', 'coverage', 'timing']
  }
};
```

## 🎯 CRONOGRAMA IMPLEMENTACIÓN

### **SEMANA 1: Base de Datos + APIs**
- **Día 1-2**: Crear tablas permisos y directores
- **Día 3-4**: APIs gestión directores
- **Día 5**: Middleware permisos

### **SEMANA 2: Panel Director**
- **Día 1-2**: director-panel.html móvil
- **Día 3-4**: APIs filtradas por director
- **Día 5**: Testing permisos

### **SEMANA 3: Wizard GPS + QR**
- **Día 1-2**: Wizard completo creación usuarios
- **Día 3-4**: QR codes y configuración automática
- **Día 5**: Testing end-to-end

### **SEMANA 4: Alertas Configurables**
- **Día 1-2**: Panel alertas por director
- **Día 3-4**: Notificaciones personalizadas
- **Día 5**: Documentación y deployment

## 🎮 RESULTADO FINAL

### **Admin (Roberto)**
- ✅ Ve todo el sistema
- ✅ Crea directores y asigna regiones
- ✅ Configuración global
- ✅ Panel mobile optimizado actual

### **Director (Jefe de Región)**
- 🎯 Solo ve SU región
- 👥 Gestiona SUS usuarios
- 🚨 Configura SUS alertas
- 📊 Ve reportes de SU equipo
- 📱 Panel móvil específico

### **Operador/Supervisor (Campo)**
- 📱 Solo ve su propio GPS
- ✅ Reporta ubicación
- 📍 Recibe notificaciones

### **Sistema de Gestión GPS Fácil**
- ⚡ Wizard paso-a-paso
- 📱 QR codes automáticos
- 🔧 Setup OwnTracks en minutos
- ✅ Testing automático

¿Te gusta este plan? ¿Arrancamos con la **Semana 1** (Base de Datos + APIs de permisos)?