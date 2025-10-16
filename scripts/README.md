# 📜 Scripts de Configuración y Setup

Esta carpeta contiene scripts utilitarios para la configuración y mantenimiento del sistema de estacionamiento.

## 📋 Scripts Disponibles

### `setup-env.js`
**Propósito**: Configuración interactiva de variables de entorno
- Configura Google Maps API Key
- Configura credenciales de Supabase
- Genera archivo `.env.local` con configuraciones necesarias

**Uso**:
```bash
node scripts/setup-env.js
```

### `setup-google-maps.js`
**Propósito**: Configuración específica de Google Maps
- Verifica configuración de API
- Pruebas de conectividad con Google Maps
- Diagnóstico de problemas de configuración

**Uso**:
```bash
node scripts/setup-google-maps.js
```

### `run-integration-tests.js`
**Propósito**: Ejecutar suite completa de tests de integración
- Verifica que el servidor esté corriendo
- Ejecuta todos los tests de integración en orden
- Reporta resultados detallados y métricas
- Manejo automático de timeouts y errores

**Uso**:
```bash
node scripts/run-integration-tests.js
```

**Requisitos**:
- Servidor Next.js corriendo en `localhost:3000`
- Base de datos Supabase configurada
- Variables de entorno configuradas

## 🚀 Inicio Rápido

Para configurar un nuevo entorno de desarrollo:

1. **Configurar variables de entorno**:
   ```bash
   node scripts/setup-env.js
   ```

2. **Verificar configuración de Google Maps**:
   ```bash
   node scripts/setup-google-maps.js
   ```

3. **Reiniciar el servidor**:
   ```bash
   npm run dev
   ```

## 📁 Estructura

```
scripts/
├── README.md              # Esta documentación
├── setup-env.js          # Configuración de entorno
└── setup-google-maps.js  # Configuración Google Maps
```

## 🔧 Mantenimiento

- Los scripts están diseñados para ser ejecutados desde la raíz del proyecto
- Todos los scripts incluyen validación de entrada y manejo de errores
- Los scripts generan archivos de configuración que pueden ser versionados (excepto credenciales sensibles)
