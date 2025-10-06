# sql/

**Rol / propósito:** Migraciones SQL adicionales para extender la funcionalidad de la base de datos, incluyendo logging de movimientos de vehículos, cambios de estado de plazas y configuración de realtime.

## Contenido clave
- `migrations/002_vehicle_movements_and_status_changes.sql` - Sistema de logging para movimientos de vehículos entre plazas
- `migrations/003_enable_realtime_for_new_tables.sql` - Configuración de realtime para nuevas tablas

## Estructura

```
sql/
└── migrations/
    ├── 002_vehicle_movements_and_status_changes.sql
    └── 003_enable_realtime_for_new_tables.sql
```

## Entradas/Salidas

- **Entradas**: Scripts SQL con DDL y DML para modificar esquema de BD
- **Salidas**: Nuevas tablas, índices, políticas y configuración de realtime

## Cómo se usa desde afuera

```bash
# Aplicar migración específica
psql -d parking_db -f sql/migrations/002_vehicle_movements_and_status_changes.sql

# Ejecutar todas las migraciones
for file in sql/migrations/*.sql; do
    echo "Ejecutando $file..."
    psql -d parking_db -f "$file"
done
```

## Dependencias y contratos

- **Depende de**: Base de datos PostgreSQL/Supabase existente, esquema base aplicado
- **Expone**: Nuevas tablas para logging avanzado, índices optimizados, realtime habilitado

## Puntos de extensión / modificar con seguridad

- Añadir nueva migración: crear `004_descriptive_name.sql` siguiendo numeración
- Modificar esquema: crear nueva migración en lugar de alterar existentes
- Añadir índices: incluir en migraciones nuevas para optimización

## Convenciones / notas

- Numeración secuencial: `001_`, `002_`, etc.
- Nombres descriptivos en inglés con guiones bajos
- Comentarios detallados explicando propósito
- Índices optimizados para consultas frecuentes
- Constraints para integridad de datos
- Realtime habilitado para sincronización en tiempo real

