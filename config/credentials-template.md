# 📋 Credenciales Necesarias

Complete esta información antes de continuar con el setup:

## 1. Base de Datos Zenput (Neon) - EXISTENTE

### Connection String
```
ZENPUT_DATABASE_URL=postgresql://usuario:contraseña@host:puerto/database
```

**¿Dónde obtenerla?**
- Console de Neon: https://console.neon.tech
- Tu proyecto → Connection Details
- Copiar "Connection string"

### Nombres de Tablas y Columnas

**IMPORTANTE:** Estos nombres deben ajustarse según tu base de datos real.

#### Tabla de Sucursales:
- **Nombre tabla:** ___________
- **Columna código:** ___________ (ej: code, location_id, store_id)
- **Columna nombre:** ___________ (ej: name, location_name, store_name)
- **Columna latitud:** ___________ (ej: latitude, lat, coord_lat)
- **Columna longitud:** ___________ (ej: longitude, lon, coord_lon)
- **Columna grupo:** ___________ (ej: group_name, region, district)
- **Columna director:** ___________ (ej: director_name, manager)

#### Tabla de Usuarios (si existe en BD):
- **Nombre tabla:** ___________
- **Columna email:** ___________ (ej: email, user_email, login)
- **Columna nombre:** ___________ (ej: name, display_name, full_name)
- **Columna teléfono:** ___________ (ej: phone, phone_number, mobile)

**Para explorar tu BD, usar:** `npm run test:zenput`

## 2. Zenput API (si usuarios en API)

### Credenciales API (opcional)
```
ZENPUT_API_KEY=sk_live_...
ZENPUT_ORG_ID=12345
```

**¿Cómo obtenerlas?**
- Panel de Zenput → API Settings
- Generar nueva API Key
- Copiar Organization ID

### Verificar endpoint
¿Los usuarios están en la API de Zenput?
- [ ] Sí, están en API
- [ ] No, están en base de datos
- [ ] No sé

## 3. Telegram Bot

### Crear Bot
1. Buscar **@BotFather** en Telegram
2. Enviar: `/newbot`
3. Nombre: `Pollo Loco Admin Bot`
4. Username: `pollolocotracking_bot`
5. **Copiar token:**

```
TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF...
```

### Obtener Admin IDs
1. Buscar **@userinfobot** en Telegram
2. Enviar cualquier mensaje
3. **Copiar tu ID:**

```
TELEGRAM_ADMIN_IDS=123456789
```

**Para múltiples admins (separar con comas):**
```
TELEGRAM_ADMIN_IDS=123456789,987654321,555666777
```

## 4. Railway

### Crear Proyecto PostgreSQL
1. Ir a: https://railway.app
2. Login con GitHub
3. **"New Project"** → **"Deploy PostgreSQL"**
4. Esperar 1-2 minutos
5. Click en **"Postgres"** → **"Connect"** tab
6. **Copiar "Postgres Connection URL":**

```
DATABASE_URL=postgresql://postgres:pass@...
```

### Configurar Servicio Web
1. **"New Service"** → **"GitHub Repo"**
2. Seleccionar tu repositorio
3. Deploy automáticamente
4. **Copiar URL del servicio:**

```
WEB_APP_URL=https://tu-proyecto.up.railway.app
```

## ✅ Checklist de Credenciales

- [ ] `ZENPUT_DATABASE_URL` - Connection string de Neon
- [ ] `DATABASE_URL` - PostgreSQL de Railway (auto-generada)
- [ ] `TELEGRAM_BOT_TOKEN` - Token del bot de @BotFather
- [ ] `TELEGRAM_ADMIN_IDS` - Tu ID de @userinfobot
- [ ] `WEB_APP_URL` - URL de Railway (después de deploy)
- [ ] Nombres de tablas Zenput identificados y actualizados

## 📝 Notas Importantes

### Seguridad
- **NUNCA** compartir estas credenciales públicamente
- Usar variables de entorno en Railway
- Base de datos Zenput en modo **READ ONLY**

### Testing
- Usar `npm run test:zenput` para explorar BD Zenput
- Verificar conexiones antes del deploy
- Probar bot localmente primero

### Soporte
- Railway logs: Dashboard → Deployments → View Logs
- Telegram: Verificar que el bot responda a `/start`
- GPS: Verificar URL en OwnTracks

---

🔗 **Siguiente paso:** [SETUP_GUIDE.md](../SETUP_GUIDE.md)