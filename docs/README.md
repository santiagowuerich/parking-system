# docs/

**Rol / propósito:** Documentación técnica detallada del sistema de estacionamiento, incluyendo análisis de flujos, cambios en base de datos, integraciones específicas y documentación automática del proyecto.

## Contenido clave

### 📊 Análisis y Diseño
- `ANALISIS_FLUJO_EMPLEADOS.md` - Análisis completo del flujo de gestión de empleados
- `README_AUTO_PARKING.md` - Documentación automática generada del sistema

### 🗄️ Base de Datos
- `DATABASE_CHANGES_README.md` - Cambios y migraciones de base de datos
- `cambiosbasededatos.md` - Registro histórico de cambios en la estructura de BD

### 🗺️ Integraciones
- `GOOGLE_MAPS_README.md` - Guía detallada de integración con Google Maps
- `PAYMENTS_IMPLEMENTATION_README.md` - Implementación del sistema de pagos

### 📋 Planes y Soluciones
- `PLAN_*.md` - Planes de implementación y mejoras del sistema
- `PROBLEMA_*.md` - Documentación de problemas encontrados y diagnosticados
- `SOLUCION_*.md` - Soluciones implementadas para diversos problemas

### 📝 Documentos Técnicos
- `OPTIMIZACIONES_REALIZADAS.md` - Optimizaciones implementadas en el sistema
- `README_QR_IMPLEMENTATION.md` - Implementación del sistema QR
- Archivos varios de análisis técnico y documentación específica

## Estructura

```
docs/
├── 📊 Análisis y Diseño/
│   ├── ANALISIS_FLUJO_EMPLEADOS.md
│   └── README_AUTO_PARKING.md
├── 🗄️ Base de Datos/
│   ├── DATABASE_CHANGES_README.md
│   └── cambiosbasededatos.md
├── 🗺️ Integraciones/
│   ├── GOOGLE_MAPS_README.md
│   └── PAYMENTS_IMPLEMENTATION_README.md
├── 📋 Planes y Soluciones/
│   ├── PLAN_*.md
│   ├── PROBLEMA_*.md
│   └── SOLUCION_*.md
└── 📝 Documentos Técnicos/
    ├── OPTIMIZACIONES_REALIZADAS.md
    ├── README_QR_IMPLEMENTATION.md
    └── [otros archivos técnicos]
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
