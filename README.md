# 🍗 EPL CAS - Sistema de Tracking GPS

Sistema completo de tracking GPS para las 85 sucursales de El Pollo Loco CAS.

## 📊 Estado Actual

✅ **85 sucursales** con coordenadas correctas validadas  
✅ **7 estados** de México cubiertos  
✅ **28 ciudades** normalizadas  
✅ **Sistema GPS** completamente funcional  

## 🚀 Características

### 📍 Tracking GPS
- **OwnTracks** integrado para tracking en tiempo real
- **Geofencing** automático por sucursal
- **Notificaciones** vía Telegram
- **Histórico** de ubicaciones

### 🤖 Bot Telegram
- **Comandos** administrativos completos
- **Notificaciones** automáticas
- **Reportes** en tiempo real
- **Gestión** de usuarios

### 🌐 Panel Web
- **Dashboard** en tiempo real
- **Validación** de coordenadas
- **Administración** de sucursales
- **Reportes** detallados

## 🏗️ Arquitectura

### Backend
- **Node.js** + Express
- **PostgreSQL** (Railway)
- **Zenput API** integration
- **Telegram Bot API**

### Frontend
- **HTML5** + JavaScript nativo
- **CSS3** responsive
- **Google Maps** integration
- **Real-time** updates

## 📋 Datos

### Sucursales por Estado
- **Nuevo León**: 43 sucursales
- **Tamaulipas**: 15 sucursales  
- **Coahuila**: 10 sucursales
- **Querétaro**: 4 sucursales
- **Michoacán**: 3 sucursales
- **Sinaloa**: 1 sucursal
- **Durango**: 1 sucursal

### Archivos de Datos
- `sucursales_final_limpio.csv` - Datos normalizados finales
- Base de datos Railway con todas las coordenadas validadas

## 🚀 Deployment

**Plataforma**: Railway  
**URL**: `https://pollo-loco-tracking-gps-production.up.railway.app`

### Endpoints Principales
- `/health` - Health check
- `/api/branch-validation/fresco` - Validador de coordenadas
- `/webapp/dashboard.html` - Panel administrativo

## 📱 Configuración OwnTracks

```
Mode: HTTP
Host: pollo-loco-tracking-gps-production.up.railway.app
Port: 443
URL: /api/owntracks/location
TLS: ON
```

## 🔧 Variables de Entorno

```bash
DATABASE_URL=postgresql://...          # Railway PostgreSQL
ZENPUT_DATABASE_URL=postgresql://...   # Zenput (read-only)
TELEGRAM_BOT_TOKEN=...                 # Bot de Telegram
TELEGRAM_ADMIN_IDS=...                 # IDs de administradores
WEB_APP_URL=https://...               # URL de la aplicación
```

## 📈 Monitoreo

- **Health checks** automáticos
- **Logs** centralizados en Railway
- **Notificaciones** Telegram para errores
- **Dashboard** de métricas en tiempo real

## 👥 Administración

### Comandos Telegram
- `/start` - Inicializar bot
- `/estado` - Estado del sistema
- `/usuarios` - Gestión de usuarios
- `/ubicaciones` - Ver ubicaciones actuales
- `/webapp` - Abrir panel web

### Panel Web
- Validación de coordenadas
- Administración de sucursales  
- Reportes y estadísticas
- Configuración del sistema

## 🔒 Seguridad

- **HTTPS** obligatorio
- **Autenticación** vía Telegram
- **Validación** de coordenadas geográficas
- **Rate limiting** en APIs
- **Logs** de auditoría

---

**Versión**: 2.0 - Datos Limpios  
**Última actualización**: Noviembre 2024  
**Estado**: ✅ Producción
