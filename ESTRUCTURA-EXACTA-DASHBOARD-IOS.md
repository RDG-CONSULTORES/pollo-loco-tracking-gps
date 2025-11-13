# ESTRUCTURA EXACTA DASHBOARD IOS - EL POLLO LOCO CAS
**Fecha de Validación:** 2025-11-13
**Fuente:** Base de datos PostgreSQL Neon - supervision_operativa_detalle

## ⚠️ ESTRUCTURA VALIDADA - NO MODIFICAR SIN VERIFICACIÓN

### 🔴 TEPEYAC - 10 SUCURSALES (VERIFICADO)
**IMPORTANTE: La Huasteca SÍ pertenece a TEPEYAC**

```javascript
const TEPEYAC = {
  "1 Pino Suarez": { lat: 25.6722, lng: -100.3089, records: 14175 },
  "2 Madero": { lat: 25.6758, lng: -100.3125, records: 15042 },
  "3 Matamoros": { lat: 25.6800, lng: -100.3150, records: 15093 },
  "4 Santa Catarina": { lat: 25.6733, lng: -100.4581, records: 17412 },
  "5 Felix U. Gomez": { lat: 25.6900, lng: -100.3200, records: 15804 },
  "6 Garcia": { lat: 25.8094, lng: -100.5917, records: 16342 },
  "7 La Huasteca": { lat: 25.6920, lng: -100.2580, records: 15677 },  // ✅ CONFIRMADO EN TEPEYAC
  "Sucursal GC Garcia": { lat: 25.8094, lng: -100.5917, records: 1764 },
  "Sucursal LH La Huasteca": { lat: 25.6920, lng: -100.2580, records: 3528 },
  "Sucursal SC Santa Catarina": { lat: 25.6733, lng: -100.4581, records: 4200 }
};
// Total TEPEYAC: 119,037 registros
```

### 🟢 OGAS - 8 SUCURSALES
```javascript
const OGAS = {
  "8 Gonzalitos": { lat: 25.6694, lng: -100.3394 },
  "9 Anahuac": { lat: 25.6789, lng: -100.3286 },
  "10 Barragan": { lat: 25.6547, lng: -100.2897 },
  "11 Lincoln": { lat: 25.6689, lng: -100.3089 },
  "12 Concordia": { lat: 25.6642, lng: -100.2517 },
  "13 Escobedo": { lat: 25.7997, lng: -100.3211 },
  "14 Aztlan": { lat: 25.7317, lng: -100.2644 },
  "15 Ruiz Cortinez": { lat: 25.6750, lng: -100.2881 }
};
```

### 🔵 TEC - 4 SUCURSALES
```javascript
const TEC = {
  "20 Tecnológico": { lat: 25.6514, lng: -100.2897 },
  "21 Chapultepec": { lat: 25.6678, lng: -100.2850 },
  "22 Satelite": { lat: 25.6439, lng: -100.2744 },
  "23 Guasave": { lat: 25.5678, lng: -108.4697 }  // Foránea - Sinaloa
};
```

### 🟡 EFM - 3 SUCURSALES
```javascript
const EFM = {
  "17 Miguel Aleman": { lat: 25.6581, lng: -100.3814 },
  "18 Sendero": { lat: 25.6522, lng: -100.3975 },
  "19 Conchello": { lat: 25.7281, lng: -100.3117 }
};
```

### 🟣 EPL SO - 1 SUCURSAL
```javascript
const EPL_SO = {
  "16 Solidaridad": { lat: 25.7242, lng: -100.1967 }
};
```

### 🟠 PLOG NUEVO LEON - 6 SUCURSALES
```javascript
const PLOG_NUEVO_LEON = {
  "36 Apodaca Centro": { lat: 25.7817, lng: -100.1875 },
  "37 Stiva": { lat: 25.6858, lng: -100.2419 },
  "38 Gomez Morin": { lat: 25.6544, lng: -100.3597 },
  "39 Lazaro Cardenas": { lat: 25.6983, lng: -100.2744 },
  "40 Plaza 1500": { lat: 25.6908, lng: -100.3333 },
  "41 Vasconcelos": { lat: 25.6511, lng: -100.3364 }
};
```

### 🟤 PLOG QUERETARO - 4 SUCURSALES (FORÁNEAS)
```javascript
const PLOG_QUERETARO = {
  "48 Refugio": { lat: 20.5881, lng: -100.3892 },
  "49 Pueblito": { lat: 20.5344, lng: -100.4406 },
  "50 Patio": { lat: 20.5936, lng: -100.4125 },
  "51 Constituyentes": { lat: 20.6097, lng: -100.3756 }
};
```

### ⚪ PLOG LAGUNA - 6 SUCURSALES (FORÁNEAS)
```javascript
const PLOG_LAGUNA = {
  "42 Independencia": { lat: 25.5397, lng: -103.4472 },
  "43 Revolucion": { lat: 25.5233, lng: -103.4128 },
  "44 Senderos": { lat: 25.5706, lng: -103.5008 },
  "45 Triana": { lat: 25.5475, lng: -103.4036 },
  "46 Campestre": { lat: 25.5619, lng: -103.3747 },
  "47 San Antonio": { lat: 25.5564, lng: -103.3533 }
};
```

### 🔴 EXPO - 11 SUCURSALES (MIXTO)
```javascript
const EXPO = {
  "24 Exposicion": { lat: 25.6833, lng: -100.3097 },
  "25 Juarez": { lat: 25.8722, lng: -100.1878 },
  "26 Cadereyta": { lat: 25.5831, lng: -100.0000 },
  "27 Santiago": { lat: 25.4267, lng: -100.1475 },
  "28 Guerrero": { lat: 26.0797, lng: -98.2869 },  // Foránea - Tamaulipas
  "29 Pablo Livas": { lat: 25.7422, lng: -100.2619 },
  "30 Carrizo": { lat: 26.3617, lng: -98.8425 },   // Foránea - Tamaulipas
  "31 Las Quintas": { lat: 25.6269, lng: -100.3103 },
  "32 Allende": { lat: 25.2803, lng: -100.0231 },
  "33 Eloy Cavazos": { lat: 25.5142, lng: -99.9053 },
  "34 Montemorelos": { lat: 25.1869, lng: -99.8331 }
};
```

### 🔵 OCHTER TAMPICO - 4 SUCURSALES (FORÁNEAS)
```javascript
const OCHTER_TAMPICO = {
  "58 Universidad (Tampico)": { lat: 22.2597, lng: -97.8650 },
  "59 Plaza 3601": { lat: 22.2450, lng: -97.8689 },
  "60 Centro (Tampico)": { lat: 22.2156, lng: -97.8583 },
  "61 Aeropuerto (Tampico)": { lat: 22.2961, lng: -97.8656 }
};
```

### 🟢 GRUPO CANTERA ROSA (MORELIA) - 3 SUCURSALES (FORÁNEAS)
```javascript
const GRUPO_CANTERA_ROSA = {
  "62 Lazaro Cardenas (Morelia)": { lat: 19.7028, lng: -101.1944 },
  "63 Madero (Morelia)": { lat: 19.7039, lng: -101.1956 },
  "64 Huerta": { lat: 19.6994, lng: -101.2069 }
};
```

### 🟡 GRUPO MATAMOROS - 5 SUCURSALES (FORÁNEAS)
```javascript
const GRUPO_MATAMOROS = {
  "65 Pedro Cardenas": { lat: 25.8797, lng: -97.5039 },
  "66 Lauro Villar": { lat: 25.8669, lng: -97.4914 },
  "67 Centro (Matamoros)": { lat: 25.8694, lng: -97.5028 },
  "68 Avenida del Niño": { lat: 25.8531, lng: -97.4889 },
  "69 Puerto Rico": { lat: 25.8528, lng: -97.5092 }
};
```

### GRUPOS CON 1 SUCURSAL
```javascript
const GRUPO_PIEDRAS_NEGRAS = {
  "70 Coahuila Comidas": { lat: 28.7000, lng: -100.5244 }
};

const GRUPO_CENTRITO = {
  "71 Centrito Valle": { lat: 25.6756, lng: -100.3111 }
};

const GRUPO_SABINAS_HIDALGO = {
  "72 Sabinas Hidalgo": { lat: 26.5069, lng: -100.1764 }
};
```

### 🔴 CRR - 3 SUCURSALES (FORÁNEAS)
```javascript
const CRR = {
  "73 Anzalduas": { lat: 26.0733, lng: -98.3261 },
  "74 Hidalgo (Reynosa)": { lat: 26.1006, lng: -98.2631 },
  "75 Libramiento (Reynosa)": { lat: 26.0347, lng: -98.3147 }
};
```

### 🟣 RAP - 3 SUCURSALES (FORÁNEAS)
```javascript
const RAP = {
  "76 Aeropuerto (Reynosa)": { lat: 26.0083, lng: -98.2283 },
  "77 Boulevard Morelos": { lat: 26.0892, lng: -98.2778 },
  "78 Alcala": { lat: 26.0464, lng: -98.2969 }
};
```

### OTROS GRUPOS
```javascript
const GRUPO_RIO_BRAVO = {
  "79 Rio Bravo": { lat: 25.9906, lng: -98.0931 }
};

const GRUPO_NUEVO_LAREDO = {
  "80 Guerrero 2 (Ruelas)": { lat: 27.4772, lng: -99.5072 },
  "81 Reforma (Ruelas)": { lat: 27.4858, lng: -99.5031 }
};

// GRUPO SALTILLO - Solo 3 sucursales activas en la base de datos
const GRUPO_SALTILLO = {
  "52 Venustiano Carranza": { lat: 25.4292, lng: -101.0000 },
  "54 Ramos Arizpe": { lat: 25.5406, lng: -100.9475 },
  "57 Harold R. Pape": { lat: 25.4169, lng: -100.9922 }
};
```

## NOTAS IMPORTANTES

1. **TEPEYAC tiene 10 sucursales**, incluyendo duplicados con prefijo "Sucursal"
2. **La Huasteca (sucursal #7) SÍ pertenece a TEPEYAC** - CONFIRMADO
3. **GRUPO SALTILLO** solo tiene 3 sucursales activas en la base de datos actual
4. Hay grupos en la categoría "NO_ENCONTRADO" que podrían necesitar reasignación
5. Las coordenadas son aproximadas y deben validarse con ubicaciones reales

## VALIDACIÓN DE DATOS
- Total Grupos Operativos: 20
- Total Sucursales Únicas: 82 
- Registros en Base de Datos: 855,993
- Fecha de Validación: 2025-11-13