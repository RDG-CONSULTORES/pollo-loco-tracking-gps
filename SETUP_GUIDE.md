# 📋 Guía de Setup - Paso a Paso

Guía completa para configurar el sistema de tracking GPS de El Pollo Loco desde cero.

## 📋 Pre-requisitos

Antes de empezar, necesitas:

- [ ] **Node.js 18+** instalado
- [ ] **Git** instalado  
- [ ] **Cuenta de Railway** (https://railway.app)
- [ ] **Cuenta de Telegram**
- [ ] **Acceso a base de datos Zenput** existente

## 🎯 Paso 1: Obtener Credenciales

### 1.1 Base de Datos Zenput (Existente)

**Necesitas la connection string completa:**

```
ZENPUT_DATABASE_URL=postgresql://usuario:contraseña@host:puerto/database
```

**¿Dónde obtenerla?**
- Neon Console → Tu proyecto → Connection Details
- Zenput Administrator
- Documentación interna

**Verificar conexión:**
```bash
psql "postgresql://usuario:contraseña@host:puerto/database"
```

### 1.2 Crear Bot de Telegram

1. **Abrir Telegram** → Buscar `@BotFather`
2. **Enviar:** `/newbot`
3. **Seguir instrucciones:**
   ```
   Nombre del bot: Pollo Loco Admin Bot
   Username: pollolocotracking_bot
   ```
4. **Copiar el token:**
   ```
   TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF...
   ```

### 1.3 Obtener tu Telegram ID

1. **Buscar `@userinfobot`**
2. **Enviar cualquier mensaje**
3. **Copiar tu ID:**
   ```
   TELEGRAM_ADMIN_IDS=123456789
   ```

**Para múltiples admins:**
```
TELEGRAM_ADMIN_IDS=123456789,987654321,555666777
```

### 1.4 Explorar Base de Datos Zenput

**Identificar nombres de tablas:**
```sql
-- Ver todas las tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Buscar tablas de sucursales
SELECT table_name FROM information_schema.tables 
WHERE table_name ILIKE '%location%' 
   OR table_name ILIKE '%store%'
   OR table_name ILIKE '%branch%';
```

**📝 Anotar nombres exactos:**
```
Tabla de sucursales: ________________
Tabla de usuarios: __________________
```

## 🚀 Paso 2: Crear Proyecto en Railway

### 2.1 Crear Cuenta

1. **Ir a:** https://railway.app
2. **Sign up** con GitHub
3. **Autorizar Railway**

### 2.2 Crear Proyecto

1. **"New Project"**
2. **"Deploy PostgreSQL"**
3. **Esperar 1-2 minutos**

### 2.3 Obtener Database URL

1. **Click en "Postgres"**
2. **Tab "Connect"**
3. **Copiar "Postgres Connection URL"**

```
DATABASE_URL=postgresql://postgres:password@server:5432/railway
```

## 💻 Paso 3: Setup Local

### 3.1 Clonar Proyecto

```bash
cd ~/Desktop
git clone https://github.com/tu-usuario/pollo-loco-tracking-gps.git
cd pollo-loco-tracking-gps
```

### 3.2 Instalar Dependencias

```bash
npm install
```

### 3.3 Configurar Variables de Entorno

```bash
cp .env.example .env
```

**Editar `.env` con tus credenciales:**

```bash
# Railway PostgreSQL (nueva - tracking data)
DATABASE_URL=postgresql://postgres:password@server:5432/railway

# Zenput Database (existente - READ ONLY)
ZENPUT_DATABASE_URL=postgresql://user:pass@neon.tech/zenput_db

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABC...
TELEGRAM_ADMIN_IDS=123456789,987654321

# Config
PORT=3000
NODE_ENV=development
WEB_APP_URL=http://localhost:3000
```

## 🔧 Paso 4: Configurar Base de Datos

### 4.1 Setup Schema

```bash
npm run setup
```

**Debe mostrar:**
```
✅ Conectado a Railway PostgreSQL
📄 Ejecutando schema SQL...
✅ Schema ejecutado exitosamente

📋 Tablas creadas:
   ✓ tracking_users
   ✓ tracking_locations_cache
   ✓ tracking_locations
   ✓ tracking_visits
   ✓ tracking_config
```

### 4.2 Test Conexión Zenput

```bash
npm run test:zenput
```

**Debe explorar y mostrar:**
```
✅ Conectado a Zenput Database (READ ONLY)
📋 Explorando estructura de BD...
📍 Tablas candidatas para sucursales:
   - zenput_locations (o similar)
👥 Tablas candidatas para usuarios:
   - zenput_users (o similar)
```

### 4.3 Ajustar Nombres de Tablas

**Editar `src/integrations/zenput-client.js`:**

Buscar y reemplazar con los nombres reales de tu BD:

```javascript
// ANTES (ejemplo):
FROM zenput_locations

// DESPUÉS (tu tabla real):
FROM locations
```

**Campos comunes a verificar:**
- `code` → tu campo de código de sucursal
- `name` → tu campo de nombre
- `latitude` / `longitude` → tus campos de coordenadas

## 🧪 Paso 5: Test Local

### 5.1 Iniciar Aplicación

```bash
npm run dev
```

**Debe mostrar:**
```
✅ Variables de entorno validadas
✅ Connected to Railway PostgreSQL
✅ Connected to Zenput Database (READ ONLY)
✅ Telegram Bot started
🚀 API Server running on port 3000
✅ Sistema iniciado exitosamente
```

### 5.2 Test Bot de Telegram

1. **Buscar tu bot** en Telegram
2. **Enviar:** `/start`

**Debe responder:**
```
👋 ¡Hola [Tu Nombre]!

🐔 POLLO LOCO TRACKING GPS
¡Bienvenido al sistema de supervisión!

Comandos disponibles:
...
```

### 5.3 Test Panel Web

**En tu navegador:**
```
http://localhost:3000/webapp
```

**Debe cargar** el panel de administración.

## 📦 Paso 6: Deploy a Railway

### 6.1 Commit Changes

```bash
git add .
git commit -m "Initial setup with real credentials"
```

### 6.2 Crear Repo en GitHub

1. **https://github.com/new**
2. **Repository name:** `pollo-loco-tracking-gps`
3. **Private** ✅
4. **Create repository**

```bash
git remote add origin https://github.com/tu-usuario/pollo-loco-tracking-gps.git
git push -u origin main
```

### 6.3 Deploy en Railway

**En Railway Dashboard:**

1. **"New Service"**
2. **"GitHub Repo"**
3. **Seleccionar** `pollo-loco-tracking-gps`
4. **Deploy automáticamente**

### 6.4 Configurar Variables de Entorno

**En Railway → Tu Servicio → Variables:**

```
DATABASE_URL=[Auto-generada por Railway]
ZENPUT_DATABASE_URL=postgresql://user:pass@neon.tech/zenput_db
TELEGRAM_BOT_TOKEN=1234567890:ABC...
TELEGRAM_ADMIN_IDS=123456789,987654321
NODE_ENV=production
```

**NO agregues WEB_APP_URL todavía**

### 6.5 Obtener URL Pública

**En Railway → Deployments:**

1. **Esperar deploy exitoso** ✅
2. **Click en URL** (ej: `https://pollotracking-production.up.railway.app`)
3. **Verificar que responde** el health check

### 6.6 Actualizar WEB_APP_URL

**En Railway Variables, agregar:**
```
WEB_APP_URL=https://tu-proyecto-production.up.railway.app
```

**Redeploy automático**

## 👤 Paso 7: Crear Primer Usuario

### 7.1 En Telegram

**Enviar a tu bot:**
```
/nuevo_usuario
```

**Seguir formato:**
```
JP|juan.perez@zenput.com|Juan Pérez
```

### 7.2 Verificar Creación

```
/usuarios
```

**Debe mostrar:**
```
👥 USUARIOS REGISTRADOS

🟢 Juan Pérez
   ID: JP
   Email: juan.perez@zenput.com
   Creado: 06/11/2024
```

## 📱 Paso 8: Configurar OwnTracks

### 8.1 Instalar App

- **iOS:** App Store → "OwnTracks"
- **Android:** Google Play → "OwnTracks"

### 8.2 Configurar Conexión

**En OwnTracks → Preferences → Connection:**

```
Mode: HTTP
Host: tu-proyecto-production.up.railway.app
Port: 443 (HTTPS)
URL: /api/owntracks/location
Device ID: JP
Tracker ID: JP
Username: [dejar vacío]
Password: [dejar vacío]
TLS: ON ✅
```

### 8.3 Permisos

**En el celular:**

1. **Ubicación:** "Siempre" o "Permitir todo el tiempo"
2. **Batería:** Desactivar optimización para OwnTracks
3. **Segundo plano:** Permitir ejecución en segundo plano

### 8.4 Test GPS

1. **Salir a caminar** con OwnTracks activo
2. **En Railway Logs** debe aparecer:
   ```
   📍 Location received: {tid: 'JP', lat: 25.xxxx, lon: -100.xxxx}
   ✅ Ubicación guardada: JP @ 25.xxxx, -100.xxxx
   ```

3. **En Telegram:**
   ```
   /ubicaciones
   ```
   
   Debe mostrar:
   ```
   📍 UBICACIONES ACTUALES
   
   🟢 Juan Pérez
      Última: hace 2 min
      Batería: 87%
   ```

## ✅ Verificación Final

### ✅ Checklist de Funcionamiento

- [ ] **Railway deploy** exitoso
- [ ] **Telegram bot** responde a `/start`
- [ ] **Panel web** abre desde `/webapp`
- [ ] **Usuario creado** con `/nuevo_usuario`
- [ ] **OwnTracks configurado** y enviando GPS
- [ ] **Ubicaciones llegando** visibles en `/ubicaciones`
- [ ] **Logs de Railway** muestran sistema activo

### 🔧 Comandos Útiles

```bash
# Ver logs en Railway
railway logs

# Test local después de cambios
npm run dev

# Verificar BD
npm run setup check

# Re-explorar Zenput
npm run test:zenput
```

## 🆘 Solución de Problemas

### ❌ "Error conectando a Railway PostgreSQL"

**Solución:**
1. Verificar `DATABASE_URL` en Railway Variables
2. Re-deployar si es necesario
3. Verificar que PostgreSQL service esté running

### ❌ "Telegram Bot no responde"

**Solución:**
1. Verificar `TELEGRAM_BOT_TOKEN`
2. Verificar `TELEGRAM_ADMIN_IDS` (tu ID correcto)
3. Bot debe estar activo en Railway

### ❌ "GPS no llega al servidor"

**Solución:**
1. Verificar URL en OwnTracks: `https://tu-proyecto.up.railway.app`
2. Verificar endpoint: `/api/owntracks/location`
3. Verificar permisos de ubicación en celular
4. Check Railway logs para errores

### ❌ "Error de tabla Zenput no existe"

**Solución:**
1. Ejecutar `npm run test:zenput` para explorar
2. Actualizar nombres en `src/integrations/zenput-client.js`
3. Re-deploy a Railway

## 🎯 Próximos Pasos

Una vez funcionando:

1. **Agregar más usuarios** con `/nuevo_usuario`
2. **Configurar horarios** con `/horarios 07:00 21:00`
3. **Ver reportes diarios** automáticos (9 PM)
4. **Monitorear cobertura** en panel web
5. **Ajustar geofencing** si es necesario

## 🔗 Referencias

- **Railway Docs:** https://docs.railway.app
- **Telegram Bot API:** https://core.telegram.org/bots
- **OwnTracks:** https://owntracks.org/booklet/
- **PostgreSQL:** https://www.postgresql.org/docs/

---

🐔 **¡Sistema configurado exitosamente!** 

El tracking GPS ya está monitoreando a tus supervisores automáticamente.