# 🧪 Scripts de Prueba

Esta carpeta contiene todos los scripts de prueba automatizados del sistema.

## Tipos de Pruebas

### Funcionales
- `test-api-empleados.js` - Pruebas de API de empleados
- `test-api-empleados.ps1` - Pruebas de PowerShell para API
- `test-flujo-empleados.ps1` - Prueba completa del flujo de empleados
- `test-gestion-empleados.js` - Pruebas de gestión de empleados

### Creación y Edición
- `test-creacion-empleado-admin.js` - Pruebas de creación con admin
- `test-creacion-empleado-auth.js` - Pruebas de autenticación
- `test-edicion-eliminacion-empleados.js` - Pruebas CRUD completas
- `test-edicion-especifica.js` - Pruebas específicas de edición
- `test-empleado-final.js` - Prueba final del sistema de empleados

### Eliminación
- `test-eliminacion-simple.js` - Pruebas simples de eliminación

### Otros Componentes
- `test-dashboard-empleados.js` - Pruebas del dashboard
- `test-duplicados-ux.js` - Pruebas de UX para duplicados
- `test-google-maps.js` - Pruebas de Google Maps
- `test-modal.js` - Pruebas de modales
- `test-multiple-parkings.js` - Pruebas multi-estacionamiento
- `test-new-parking-setup.js` - Pruebas de configuración
- `test-parking-switch.js` - Pruebas de cambio de parking
- `test-performance-fixes.js` - Pruebas de rendimiento
- `test-plantillas.js` - Pruebas de plantillas
- `test-post-empleado-completo.js` - Pruebas POST completas
- `test-post-http.js` - Pruebas HTTP
- `test-security-fixes.js` - Pruebas de seguridad
- `test-setup-fixed.js` - Pruebas de setup
- `test-simple-id-fix.js` - Pruebas de IDs
- `test-tarifas-api.js` - Pruebas de API de tarifas
- `test-tarifas-ui.js` - Pruebas de UI de tarifas
- `test-visualizacion-empleados.js` - Pruebas de visualización

## Cómo Ejecutar

```bash
# Ejecutar una prueba específica
node tests/test-empleado-final.js

# Ejecutar con PowerShell
./tests/test-api-empleados.ps1
```

## Propósito

Estas pruebas aseguran que:
- Las funcionalidades críticas funcionen correctamente
- Los cambios no rompan funcionalidad existente
- La calidad del código se mantenga alta
- Los bugs se detecten temprano
