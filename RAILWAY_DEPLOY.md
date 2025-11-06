# 🚀 Railway Deployment Guide

Guía paso a paso para desplegar el sistema en Railway.

## 📋 Pre-requisitos

- [x] Código subido a GitHub
- [ ] Cuenta de Railway creada
- [ ] Credenciales de Zenput listas
- [ ] Bot de Telegram creado

## 🎯 Paso 1: Setup de Railway

### 1.1 Crear Cuenta
1. Ve a: https://railway.app
2. **Sign up** con tu cuenta de GitHub
3. **Autorizar** Railway para acceder a tus repos

### 1.2 Crear Proyecto PostgreSQL
1. **"New Project"**
2. **"Deploy PostgreSQL"**
3. Esperar 1-2 minutos para que se complete
4. **Click en "Postgres"** cuando aparezca

### 1.3 Obtener Database URL
1. En el servicio PostgreSQL → **Tab "Connect"**
2. **Copiar "Postgres Connection URL"**
3. Guardar para más tarde:
   ```
   DATABASE_URL=postgresql://postgres:password@server:5432/railway
   ```

## 🔗 Paso 2: Conectar GitHub Repo

### 2.1 Agregar Servicio Web
1. **"New Service"** en tu proyecto
2. **"GitHub Repo"**
3. Buscar y seleccionar: `pollo-loco-tracking-gps`
4. **Deploy**

### 2.2 Esperar Deploy Inicial
- Railway detectará `package.json`
- Ejecutará `npm install` automáticamente
- **FALLARÁ** por falta de variables de entorno (normal)

## ⚙️ Paso 3: Configurar Variables de Entorno

### 3.1 En Railway Dashboard

**Click en tu servicio web → Tab "Variables":**

```bash
# Base de datos (auto-generada por Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Zenput Database (TU CONNECTION STRING)
ZENPUT_DATABASE_URL=postgresql://usuario:contraseña@host:puerto/database

# Telegram Bot (CREAR BOT PRIMERO)
TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF...
TELEGRAM_ADMIN_IDS=123456789,987654321

# Configuración
NODE_ENV=production
PORT=${{PORT}}
```

**IMPORTANTE:** 
- `DATABASE_URL` usar la sintaxis `${{Postgres.DATABASE_URL}}`
- `PORT` usar `${{PORT}}` (Railway lo asigna automáticamente)
- **NO** agregar `WEB_APP_URL` todavía

### 3.2 Deploy Automático
Al guardar las variables, Railway re-deployará automáticamente.

## 🤖 Paso 4: Crear Bot de Telegram

### 4.1 Crear Bot
1. Buscar **@BotFather** en Telegram
2. Enviar: `/newbot`
3. **Nombre:** `Pollo Loco Admin Bot`
4. **Username:** `pollolocotracking_bot` (o similar)
5. **Copiar el token** que te da

### 4.2 Obtener tu Admin ID
1. Buscar **@userinfobot** en Telegram
2. Enviar cualquier mensaje
3. **Copiar tu ID numérico**

### 4.3 Actualizar Variables
Volver a Railway Variables y agregar:
```bash
TELEGRAM_BOT_TOKEN=el_token_que_copiaste
TELEGRAM_ADMIN_IDS=tu_id_numerico
```

## 🌐 Paso 5: Obtener URL Pública

### 5.1 Verificar Deploy
1. Railway → **Deployments** tab
2. Esperar **status verde** ✅
3. **Click en la URL** (ej: `https://proyecto-production.up.railway.app`)

### 5.2 Test Health Check
La URL debe responder:
```json
{
  "status": "ok",
  "timestamp": "2024-11-06T...",
  "database": "connected",
  "telegram": "connected"
}
```

### 5.3 Agregar WEB_APP_URL
En Railway Variables, agregar:
```bash
WEB_APP_URL=https://tu-proyecto-production.up.railway.app
```

## 🧪 Paso 6: Verificar Funcionamiento

### 6.1 Test Bot
1. Buscar tu bot en Telegram
2. Enviar: `/start`
3. Debe responder con mensaje de bienvenida

### 6.2 Test Panel Web
1. En Telegram, enviar: `/webapp`
2. Debe abrir el panel web

### 6.3 Crear Primer Usuario
```
/nuevo_usuario
```
Formato: `ID|email@zenput.com|Nombre Completo`
Ejemplo: `JP|juan.perez@zenput.com|Juan Pérez`

## 📱 Paso 7: Configurar OwnTracks

### 7.1 Instalar App
- **iOS:** App Store → "OwnTracks"
- **Android:** Google Play → "OwnTracks"

### 7.2 Configuración
**En OwnTracks → Preferences → Connection:**

```
Mode: HTTP
Host: tu-proyecto-production.up.railway.app
Port: 443
URL: /api/owntracks/location
Device ID: JP (el ID del usuario)
Tracker ID: JP (el mismo)
TLS: ON ✅
```

### 7.3 Permisos
- **Ubicación:** "Siempre" o "Todo el tiempo"
- **Batería:** Desactivar optimización
- **Segundo plano:** Permitir

## ✅ Verificación Final

### Checklist de Funcionamiento
- [ ] Railway deploy exitoso (verde)
- [ ] Bot responde a `/start`
- [ ] Panel web abre con `/webapp`
- [ ] Usuario creado exitosamente
- [ ] OwnTracks configurado y enviando GPS
- [ ] Ubicaciones visibles con `/ubicaciones`

### Comandos de Test
```bash
# En Telegram:
/estado          # Ver estado del sistema
/usuarios        # Ver usuarios registrados
/ubicaciones     # Ver ubicaciones actuales
/reporte         # Generar reporte del día
```

## 🔍 Logs y Debugging

### Ver Logs en Railway
1. Railway Dashboard → Tu servicio → **Deployments**
2. Click en el deploy actual → **View Logs**

### Logs Importantes
```bash
✅ Connected to Railway PostgreSQL
✅ Connected to Zenput Database (read-only)
✅ Telegram Bot started
🚀 API Server running on port XXXX
✅ Sistema iniciado exitosamente

# GPS llegando:
📍 Location received: {tid: 'JP', lat: 25.xxxx, lon: -100.xxxx}
✅ Ubicación guardada
```

## 🆘 Troubleshooting

### ❌ Error de Base de Datos
**Síntoma:** "Error conectando a Railway PostgreSQL"
**Solución:**
1. Verificar que PostgreSQL service esté running
2. Verificar `DATABASE_URL` variable
3. Re-deploy si es necesario

### ❌ Bot No Responde
**Síntoma:** Bot no contesta mensajes
**Solución:**
1. Verificar `TELEGRAM_BOT_TOKEN`
2. Verificar `TELEGRAM_ADMIN_IDS` (tu ID correcto)
3. Check Railway logs para errores

### ❌ GPS No Llega
**Síntoma:** OwnTracks no envía ubicaciones
**Solución:**
1. Verificar URL: `https://tu-proyecto.up.railway.app`
2. Verificar endpoint: `/api/owntracks/location`
3. Check permisos de ubicación en celular
4. Ver Railway logs para errores

### ❌ Error Zenput
**Síntoma:** "Error conectando a Zenput Database"
**Solución:**
1. Verificar `ZENPUT_DATABASE_URL`
2. Test conexión local: `npm run test:zenput`
3. Verificar acceso de red desde Railway

## 🎯 Próximos Pasos

Una vez funcionando:
1. **Configurar horarios:** `/horarios 07:00 21:00`
2. **Agregar más usuarios:** `/nuevo_usuario`
3. **Ver reportes diarios** automáticos (9 PM)
4. **Monitorear en panel web**

---

🚀 **¡Sistema desplegado exitosamente en Railway!**