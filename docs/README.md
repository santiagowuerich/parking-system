# docs/

**Rol / propósito:** Documentación técnica detallada del sistema de estacionamiento, incluyendo análisis de flujos, cambios en base de datos, integraciones específicas y documentación automática del proyecto.

## Contenido clave
- `ANALISIS_FLUJO_EMPLEADOS.md` - Análisis completo del flujo de gestión de empleados
- `cambiosbasededatos.md` - Registro histórico de cambios en la estructura de BD
- `GOOGLE_MAPS_README.md` - Guía detallada de integración con Google Maps
- `README_AUTO_PARKING.md` - Documentación automática generada del sistema

## Estructura

```
docs/
├── ANALISIS_FLUJO_EMPLEADOS.md       # Análisis de empleados
├── cambiosbasededatos.md             # Cambios en BD
├── GOOGLE_MAPS_README.md             # Integración Google Maps
└── README_AUTO_PARKING.md            # Documentación automática
```

## Entradas/Salidas

- **Entradas**: Análisis técnicos, registros de cambios, documentación de integraciones
- **Salidas**: Guías para desarrolladores, historial de cambios, documentación de APIs

## Cómo se usa desde afuera

```bash
# Leer documentación específica
cat docs/ANALISIS_FLUJO_EMPLEADOS.md

# Buscar en documentación
grep -r "empleados" docs/
```

## Dependencias y contratos

- **Depende de**: Conocimiento del sistema, cambios en código base
- **Expone**: Documentación técnica, guías de implementación, historial de cambios

## Puntos de extensión / modificar con seguridad

- Añadir nueva documentación: crear archivos `.md` con nombres descriptivos
- Actualizar análisis: modificar archivos existentes cuando cambie la lógica
- Registrar cambios: actualizar `cambiosbasededatos.md` con nuevas migraciones

## Convenciones / notas

- Archivos en español para consistencia
- Nombres descriptivos en mayúsculas
- Documentación técnica detallada
- Historial de cambios cronológico
- Enlaces a código relevante cuando aplique
