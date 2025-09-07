# 🔍 Scripts de Diagnóstico y Depuración

Esta carpeta contiene herramientas de diagnóstico y debugging para el sistema.

## Herramientas de Diagnóstico

### Frontend
- `debug-empleado-frontend.js` - Diagnóstico completo del frontend
- `debug-simple.js` - Diagnóstico rápido desde consola del navegador
- `diagnosticar-frontend.js` - Análisis detallado del frontend

### Backend
- `debug-endpoint-get.js` - Diagnóstico del endpoint GET
- `diagnosticar-service-role.js` - Verificación del service role key

### Base de Datos
- `verificar-asignaciones-empleados.sql` - Verificación de asignaciones
- `verificar-empleados-bd.sql` - Verificación de empleados en BD

### API
- `analisis-post-empleados.js` - Análisis de requests POST
- `consultar-empleados-api.js` - Consultas de API
- `verificar-config.js` - Verificación de configuración
- `verificar-endpoints.bat` - Verificación de endpoints
- `verificar-final.js` - Verificación final
- `verificar-modal.js` - Verificación de modales

## Cómo Usar

### Desde el Navegador
```javascript
// Copiar y pegar el contenido de debug-simple.js
// en la consola del navegador en /dashboard/empleados
```

### Desde Node.js
```bash
# Ejecutar diagnóstico de service role
node debug/diagnosticar-service-role.js

# Verificar endpoints
node debug/verificar-final.js
```

### Desde la Base de Datos
```sql
-- Ejecutar consultas SQL en Supabase
-- Copiar contenido de verificar-empleados-bd.sql
```

## Propósito

Estas herramientas ayudan a:
- Diagnosticar problemas rápidamente
- Verificar el estado del sistema
- Depurar issues en producción
- Validar configuraciones
- Monitorear el rendimiento

## Uso Recomendado

1. **Desarrollo**: Usar para verificar cambios locales
2. **Producción**: Ejecutar diagnósticos regulares
3. **Debugging**: Usar para identificar problemas específicos
4. **Monitoreo**: Scripts automatizados para health checks
