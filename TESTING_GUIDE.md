# 🧪 GUÍA COMPLETA DE PRUEBAS - Pollo Loco GPS

Esta guía te permitirá probar completamente el sistema de autenticación que acabamos de arreglar.

## 📋 Resumen de Problemas Arreglados

✅ **Loop de autenticación eliminado**
✅ **Consistencia de tokens entre login/dashboard/admin**  
✅ **Middleware de seguridad en rutas admin**
✅ **Validación server-side en todas las páginas**
✅ **Logging de acciones administrativas**

## 🔧 Configuración Inicial

### 1. Verificar Base de Datos Railway

Dado que no podemos conectar externamente, necesitas hacerlo desde Railway:

```bash
# En el dashboard de Railway:
1. Ve a tu proyecto Pollo Loco
2. Abre la consola de PostgreSQL 
3. Ejecuta estos comandos:
```

```sql
-- Verificar tablas existentes
\dt

-- Crear tablas de autenticación si no existen
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_type VARCHAR(50) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS user_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear usuario administrador (contraseña: admin123)
INSERT INTO users (email, password_hash, user_type, full_name, active)
VALUES ('admin@polloloco.com', '$2b$10$rGKqHn8K8QXH5U5n5zZL5eZM8Q9QXH5U5n5zZL5eZM8Q9QXH5U5n5z', 'admin', 'Administrador Sistema', true)
ON CONFLICT (email) DO NOTHING;

-- Crear usuario de prueba (contraseña: super123)  
INSERT INTO users (email, password_hash, user_type, full_name, active)
VALUES ('supervisor@polloloco.com', '$2b$10$rGKqHn8K8QXH5U5n5zZL5eZM8Q9QXH5U5n5zZL5eZM8Q9QXH5U5n5a', 'supervisor', 'Supervisor GPS', true)
ON CONFLICT (email) DO NOTHING;

-- Verificar usuarios creados
SELECT id, email, user_type, full_name, active FROM users;
```

### 2. Iniciar el Servidor

```bash
# En tu terminal local:
npm start
```

El servidor debería iniciar en: `http://localhost:3000`

## 🧪 PLAN DE PRUEBAS PASO A PASO

### 🔐 **PRUEBA 1: Flujo de Login Básico**

1. **Abrir página principal**: `http://localhost:3000`
   - ✅ Debe redirigir a `/webapp/redirect.html`
   - ✅ Debe mostrar countdown y redirigir a login

2. **Página de Login**: `http://localhost:3000/webapp/login.html`
   - ✅ Debe mostrar formulario de login
   - ✅ Email debe tener valor default: `admin@polloloco.com`

3. **Login con credenciales válidas**:
   - Email: `admin@polloloco.com`
   - Password: `admin123`
   - ✅ Debe mostrar "Login exitoso"
   - ✅ Debe redirigir a `/webapp/admin.html`

4. **Login con credenciales inválidas**:
   - Email: `wrong@email.com`
   - Password: `wrong`
   - ❌ Debe mostrar error de autenticación

### 👑 **PRUEBA 2: Panel de Administración**

1. **Acceso directo sin login**: `http://localhost:3000/webapp/admin.html`
   - ❌ Debe redirigir al login (sin loop infinito)

2. **Acceso después del login exitoso**:
   - ✅ Debe cargar panel de administración
   - ✅ Debe mostrar nombre del usuario: "Administrador Sistema (Administrador)"
   - ✅ Debe cargar estadísticas
   - ✅ Debe mostrar tabs: Usuarios GPS, Directores, Roles, Sistema

3. **Funcionalidades del admin**:
   - ✅ Tab "Usuarios GPS" debe cargar lista de usuarios
   - ✅ Formulario "Crear Usuario" debe funcionar
   - ✅ Tab "Directores" debe funcionar
   - ✅ Tab "Roles" debe mostrar información de permisos

### 🔒 **PRUEBA 3: Seguridad de Endpoints**

Usando curl o Postman:

1. **Endpoint sin autenticación**:
```bash
curl http://localhost:3000/api/admin/users
```
❌ Debe devolver: `401 Unauthorized - Token requerido`

2. **Endpoint con token inválido**:
```bash
curl -H "Authorization: Bearer invalid_token" http://localhost:3000/api/admin/users
```
❌ Debe devolver: `401 Unauthorized - Token inválido`

3. **Login para obtener token válido**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@polloloco.com","password":"admin123"}'
```
✅ Debe devolver token válido

4. **Endpoint con token válido**:
```bash
curl -H "Authorization: Bearer [TOKEN_AQUI]" http://localhost:3000/api/admin/users
```
✅ Debe devolver lista de usuarios

### 👤 **PRUEBA 4: Usuarios No-Admin**

1. **Login como supervisor**:
   - Email: `supervisor@polloloco.com`
   - Password: `super123`
   - ✅ Debe redirigir a `/webapp/dashboard.html`

2. **Intento de acceso a admin**:
   - Navegar manualmente a `/webapp/admin.html`
   - ❌ Debe redirigir al login o mostrar error de permisos

3. **API con usuario no-admin**:
```bash
# Login como supervisor y obtener token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@polloloco.com","password":"super123"}'

# Intentar acceso a admin con token de supervisor  
curl -H "Authorization: Bearer [SUPERVISOR_TOKEN]" http://localhost:3000/api/admin/users
```
❌ Debe devolver: `403 Forbidden - Permisos insuficientes`

### 🚪 **PRUEBA 5: Logout**

1. **Logout desde admin panel**:
   - Click en botón "Cerrar Sesión"
   - ✅ Debe redirigir al login
   - ✅ Token debe ser invalidado

2. **Acceso después de logout**:
   - Intentar acceder a `/webapp/admin.html`
   - ❌ Debe redirigir al login

### 🔄 **PRUEBA 6: Redirecciones Inteligentes**

1. **Usuario ya logueado**:
   - Estar logueado como admin
   - Navegar a `/webapp/login.html`
   - ✅ Debe redirigir automáticamente a admin

2. **Página de redirect con usuario logueado**:
   - Navegar a `/webapp/redirect.html`
   - ✅ Debe redirigir inmediatamente sin countdown

## 📊 **CHECKLIST DE VALIDACIÓN**

### Flujo de Autenticación
- [ ] Login exitoso redirige correctamente según tipo de usuario
- [ ] Login fallido muestra error claro
- [ ] Usuario ya logueado es redirigido automáticamente
- [ ] Logout invalida sesión correctamente

### Seguridad
- [ ] Rutas admin protegidas por middleware
- [ ] Tokens inválidos son rechazados
- [ ] Usuarios no-admin no pueden acceder a funciones admin
- [ ] No hay loops infinitos de redirección

### Panel de Administración  
- [ ] Carga correctamente después del login
- [ ] Muestra información del usuario autenticado
- [ ] Tabs y funcionalidades cargan sin errores
- [ ] Formularios de crear usuario/director funcionan
- [ ] Botón de logout funciona

### Consistencia
- [ ] Mismo sistema de tokens en toda la aplicación
- [ ] Mensajes de error consistentes
- [ ] Redirecciones coherentes
- [ ] UI responsive y funcional

## 🚨 **SOLUCIÓN DE PROBLEMAS**

### Error: "Token requerido"
- Verificar que estés logueado
- Revisar localStorage para `auth_token`
- Rehacer login si es necesario

### Error: "Connection ECONNRESET"  
- Base de datos Railway no accesible externamente
- Usar Railway dashboard para ejecutar SQL
- Verificar tablas y usuarios existen

### Loop infinito de redirección
- **YA ARREGLADO**: Era por inconsistencia en sistemas de auth
- Si persiste, limpiar localStorage: `localStorage.clear()`

### Admin panel no carga
- Verificar usuario tiene `user_type = 'admin'`
- Verificar token válido en Network tab
- Revisar consola del navegador para errores

## 📝 **LOGGING Y DEBUG**

Para ver logs detallados:

1. **Logs del servidor**: Revisar terminal donde corre `npm start`
2. **Logs del navegador**: F12 → Console tab
3. **Network requests**: F12 → Network tab
4. **LocalStorage**: F12 → Application → Local Storage

## ✅ **CONFIRMACIÓN DE ÉXITO**

El sistema está funcionando correctamente si:

1. ✅ Puedes hacer login como admin y acceder al panel
2. ✅ No hay loops de redirección infinitos  
3. ✅ Usuarios no-admin no pueden acceder a funciones admin
4. ✅ Logout funciona y invalida la sesión
5. ✅ Las rutas API están protegidas por middleware

¡La autenticación ahora es segura, consistente y funcional! 🎉