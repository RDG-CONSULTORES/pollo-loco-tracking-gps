# 🗺️ Google Maps API Setup para El Pollo Loco

## Configuración Rápida

### 1. Obtener API Key de Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita las APIs necesarias:
   - **Geocoding API** (esencial)
   - **Places API** (opcional, para mayor precisión)
   - **Maps JavaScript API** (opcional, para visualización)

### 2. Crear API Key

1. Ve a "Credenciales" → "Crear credenciales" → "API Key"
2. Copia la API key
3. **IMPORTANTE**: Configura restricciones de API para seguridad:
   - Restringe a IPs específicas (tu IP actual)
   - Limita a las APIs que necesitas

### 3. Configurar en el Proyecto

Agrega la API key a tu archivo `.env`:

```bash
# Google Maps API
GOOGLE_MAPS_API_KEY=tu_api_key_aqui
```

### 4. Ejecutar el Mapeo

```bash
# Ejecutar el script de mapeo completo
node google-maps-complete-mapping.js
```

## Costos Aproximados

- **Geocoding API**: $5 por cada 1000 consultas
- **Estimado para 80 sucursales**: ~$0.40 USD
- **Rate limits**: 50 requests/segundo

## Resultados Esperados

El script procesará las 80+ sucursales en lotes de 5, con pausas de 2 segundos entre lotes para respetar los rate limits de Google Maps.

### Información que obtendremos:

- ✅ Coordenadas exactas (latitud, longitud)
- ✅ Dirección formateada completa
- ✅ Tipo de precisión de la ubicación
- ✅ Consulta exitosa utilizada

### Backup y Seguridad

- Se crean backups automáticos antes de actualizar
- Validación de coordenadas dentro de México
- Logs detallados de todo el proceso

## Verificación Post-Mapeo

1. **Dashboard en vivo**: https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html
2. **Archivo de resultados**: `coordenadas-google-maps.json`
3. **Verificación visual**: Links automáticos de Google Maps para cada sucursal

## Alternativas sin API Key

Si no tienes acceso inmediato a Google Maps API, también tenemos:

1. **Coordenadas de emergencia**: Ya aplicadas para 8 sucursales principales
2. **Base de datos Neon**: Script para extraer desde supervisión operativa
3. **Mapeo manual**: Para sucursales críticas específicas

---

**Estado Actual**: Las coordenadas están parcialmente incorrectas. Necesitamos Google Maps API para obtener ubicaciones precisas de las 80+ sucursales de El Pollo Loco.