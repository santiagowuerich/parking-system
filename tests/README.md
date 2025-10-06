# tests/

**Rol / propósito:** Scripts de testing automatizados para validar la funcionalidad del sistema de estacionamiento, incluyendo pruebas de API, UI, integración y casos específicos de negocio.

## Contenido clave
- `test-api-*.js` - Pruebas de endpoints de API (empleados, plazas, tarifas)
- `test-dashboard-*.js` - Pruebas de integración del panel principal
- `test-empleado-*.js` - Pruebas específicas de gestión de empleados
- `test-plazas-*.js` - Pruebas de configuración y visualización de plazas
- `test-tarifas-*.js` - Pruebas de configuración de tarifas
- `test-google-maps.js` - Pruebas de integración con Google Maps
- `test-*.ps1` - Scripts de testing en PowerShell

## Estructura

```
tests/
├── test-api-empleados.js           # API empleados
├── test-api-plazas.js              # API plazas
├── test-dashboard-integration.js   # Integración dashboard
├── test-empleado-*.js              # Gestión empleados (8+ archivos)
├── test-plazas-*.js                # Configuración plazas (6+ archivos)
├── test-tarifas-*.js               # Sistema tarifas
├── test-google-maps.js             # Integración Google Maps
├── test-*.ps1                      # Scripts PowerShell
└── ...                            # 40+ scripts específicos
```

## Entradas/Salidas

- **Entradas**: URLs de API locales, datos de prueba, configuraciones
- **Salidas**: Resultados de pruebas (✅/❌), logs detallados, datos de respuesta

## Cómo se usa desde afuera

```bash
# Ejecutar prueba específica
node tests/test-api-empleados.js

# Ejecutar pruebas de empleados
node tests/test-dashboard-empleados.js

# Ejecutar desde PowerShell
.\tests\test-flujo-empleados.ps1

# Ejecutar múltiples pruebas
for file in tests/test-*.js; do node "$file"; done
```

## Dependencias y contratos

- **Depende de**: Servidor Next.js corriendo en localhost:3000, base de datos Supabase
- **Expone**: Estado de funcionalidad, errores encontrados, métricas de pruebas

## Puntos de extensión / modificar con seguridad

- Añadir nueva prueba: crear `test-*.js` siguiendo patrón de nomenclatura
- Probar nueva funcionalidad: crear script específico para feature
- Actualizar pruebas existentes: modificar cuando cambie la API o lógica

## Convenciones / notas

- Scripts en español con emojis para claridad
- Nombres descriptivos: `test-{funcionalidad}-{aspecto}.js`
- Tests independientes que pueden ejecutarse por separado
- Logging detallado con códigos de estado HTTP
- Manejo de errores y casos edge
- Scripts .ps1 para automatización en Windows