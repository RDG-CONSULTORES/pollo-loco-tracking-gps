# 🐔 Pollo Loco Tracking GPS

Sistema completo de tracking GPS para supervisores de restaurantes El Pollo Loco en Monterrey.

## ✨ Características

- 📍 **Tracking GPS en tiempo real** con OwnTracks
- 🏢 **Geofencing automático** para 81 sucursales
- 📊 **Reportes diarios automáticos**
- 🤖 **Bot de Telegram** para administración
- 💻 **Panel web** integrado con Telegram Web App
- 🔄 **Sincronización** con base de datos Zenput existente
- ⚡ **Deploy en Railway** con PostgreSQL + PostGIS

## 🚀 Quick Start

### Guía de Setup Completa

👉 **[Ver SETUP_GUIDE.md](./SETUP_GUIDE.md)** para instrucciones paso a paso

### Instalación Rápida

```bash
# 1. Clonar repositorio
git clone [REPO_URL]
cd pollo-loco-tracking-gps

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Configurar base de datos
npm run setup

# 5. Probar conexión Zenput
npm run test:zenput

# 6. Iniciar aplicación
npm start
```

## 📋 Requerimientos

### Credenciales Necesarias

Antes de empezar, necesitas:

- **Railway Account** (base de datos PostgreSQL)
- **Zenput Database URL** (conexión read-only existente)
- **Telegram Bot Token** (crear con @BotFather)
- **Admin Telegram IDs** (obtener con @userinfobot)

### Tecnologías

- **Backend**: Node.js 18+, Express.js
- **Base de Datos**: PostgreSQL + PostGIS
- **Integraciones**: Telegram Bot API, OwnTracks
- **Deploy**: Railway
- **Frontend**: Telegram Web App (vanilla JS)

## 🏗️ Arquitectura

### Bases de Datos

1. **PostgreSQL Nueva (Railway)** - Datos de tracking
   - Usuarios, ubicaciones GPS, visitas detectadas
   - Configuración del sistema, logs de auditoría
   - Permisos: Read/Write

2. **PostgreSQL Existente (Neon)** - Datos de Zenput
   - Sucursales, información de usuarios
   - Permisos: **READ ONLY** (solo SELECT)

### Componentes Principales

```
📦 Sistema de Tracking
├── 📡 API Server (Express.js)
│   ├── /api/owntracks/location (recibe GPS)
│   ├── /api/tracking/* (consultas)
│   ├── /api/admin/* (administración)
│   └── /webapp (Telegram Web App)
│
├── 🤖 Telegram Bot
│   ├── Comandos administrativos
│   ├── Reportes automáticos
│   └── Panel web integrado
│
├── 🛢️ Servicios Core
│   ├── Location Processor (procesa GPS)
│   ├── Geofence Manager (detecta visitas)
│   ├── Visit Detector (maneja entrada/salida)
│   └── Report Generator (genera reportes)
│
└── ⏰ Jobs Programados
    ├── Reporte diario (9 PM)
    ├── Sincronización Zenput (6h)
    └── Limpieza datos (2 AM)
```

## 📱 Uso

### Para Supervisores

1. **Instalar OwnTracks** en celular
2. **Configurar con URL** del servidor
3. **Dar permisos** de ubicación
4. **¡Listo!** El sistema detecta visitas automáticamente

### Para Administradores

**Telegram Bot:**
```
/usuarios          - Ver lista supervisores
/nuevo_usuario     - Crear supervisor
/estado            - Estado del sistema
/reporte           - Reporte del día
/ubicaciones       - Ubicaciones actuales
/webapp            - Abrir panel web
```

**Panel Web:**
- Dashboard con métricas en tiempo real
- Gestión de usuarios con toggle activo/pausado
- Configuración del sistema
- Reportes y analytics

## 🗄️ Base de Datos

### Tablas Principales

- `tracking_users` - Usuarios autorizados para tracking
- `tracking_locations_cache` - Cache de sucursales (desde Zenput)
- `tracking_locations` - Ubicaciones GPS raw (OwnTracks)
- `tracking_visits` - Visitas detectadas automáticamente
- `tracking_config` - Configuración dinámica del sistema

### Datos de Ejemplo

```sql
-- Usuario de tracking
INSERT INTO tracking_users (tracker_id, zenput_email, display_name) 
VALUES ('JP', 'juan.perez@zenput.com', 'Juan Pérez');

-- Configuración
UPDATE tracking_config SET value = 'true' WHERE key = 'system_active';
UPDATE tracking_config SET value = '07:00' WHERE key = 'work_hours_start';
```

## 🔧 Scripts Disponibles

```bash
npm start          # Iniciar aplicación
npm run dev        # Desarrollo con nodemon
npm run setup      # Configurar base de datos
npm run test:zenput # Probar conexión Zenput
```

## 📊 Monitoreo

### Endpoints de Salud

- `GET /health` - Estado general del sistema
- `GET /health/ready` - Readiness para Railway
- `GET /health/live` - Liveness check

### Logs

El sistema genera logs estructurados:
```
✅ Connected to Railway PostgreSQL
📍 Location received: {tid: 'JP', lat: 25.xxxx, lon: -100.xxxx}
🟢 ENTRADA registrada: JP → Sucursal Centro
📊 Reporte diario enviado
```

## 🔒 Seguridad

- **Variables de entorno** para todas las credenciales
- **Conexión READ ONLY** a base de datos Zenput
- **Autenticación Telegram** solo admins autorizados
- **Validación GPS** con filtros de precisión y horario
- **Rate limiting** en endpoints públicos

## 🌐 Deployment

### Railway

1. **Crear proyecto** con PostgreSQL
2. **Conectar GitHub** repo
3. **Configurar variables** de entorno
4. **Deploy automático**

Variables requeridas en Railway:
```
DATABASE_URL=postgresql://... (auto-generada)
ZENPUT_DATABASE_URL=postgresql://... (tu Zenput DB)
TELEGRAM_BOT_TOKEN=1234567890:ABC...
TELEGRAM_ADMIN_IDS=123456789,987654321
WEB_APP_URL=https://tu-proyecto.up.railway.app
```

### URL Endpoints

```
https://tu-proyecto.up.railway.app/
├── /api/owntracks/location   ← Configurar en OwnTracks
├── /webapp                   ← Telegram Web App
├── /health                   ← Health checks
└── /api/admin/*              ← API administrativa
```

## 📈 Analytics

### Métricas Diarias

- **Supervisores activos**: Usuarios que reportaron GPS
- **Sucursales visitadas**: Cobertura del día
- **Total visitas**: Entradas detectadas por geofencing
- **Duración promedio**: Tiempo por visita
- **Cobertura**: % de sucursales visitadas

### Reportes Automáticos

El sistema envía reportes diarios a las 9 PM con:
- Resumen de cobertura
- Top supervisores del día
- Sucursales no visitadas
- Estadísticas de calidad

## 🛠️ Desarrollo

### Estructura del Proyecto

```
src/
├── api/           # Servidor Express y rutas
├── config/        # Configuración de BD y Telegram
├── services/      # Lógica de negocio core
├── integrations/  # Clientes para Zenput
├── telegram/      # Bot y comandos
├── webapp/        # Frontend (Telegram Web App)
├── database/      # Schema SQL
├── jobs/          # Trabajos programados
└── utils/         # Utilidades (geo, tiempo)
```

### Agregar Funcionalidades

1. **Nuevos comandos Telegram**: Agregar en `src/telegram/commands/`
2. **Nuevos endpoints**: Agregar en `src/api/routes/`
3. **Nuevos jobs**: Agregar en `src/jobs/` y registrar en scheduler
4. **Validaciones GPS**: Modificar `src/services/location-processor.js`

## 📞 Soporte

### Logs Importantes

```bash
# Railway Dashboard → Tu Servicio → Deployments → View Logs
# Buscar:
✅ Sistema iniciado exitosamente
📍 Location received
❌ Error messages
```

### Troubleshooting

- **GPS no llega**: Verificar URL de OwnTracks
- **Bot no responde**: Verificar TELEGRAM_BOT_TOKEN
- **BD no conecta**: Verificar DATABASE_URL
- **Zenput error**: Ejecutar `npm run test:zenput`

### Contacto

Para soporte técnico:
- **Logs**: Railway Dashboard
- **Issues**: GitHub Issues
- **Telegram**: Admin del sistema

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para detalles.

---

🐔 **Pollo Loco Tracking GPS** - Sistema desarrollado para optimizar supervisión operativa en restaurantes.