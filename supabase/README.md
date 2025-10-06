# supabase/

**Rol / propósito:** Contiene las migraciones de base de datos PostgreSQL y políticas de seguridad para el proyecto Supabase, incluyendo esquemas de tablas, funciones y configuración de Row Level Security.

## Contenido clave
- `migrations/` - Scripts SQL para crear y modificar la estructura de la base de datos
- `security-policies.sql` - Políticas de seguridad y triggers para proteger datos
- `migrations/basededatos.sql` - Esquema principal de la base de datos
- `migrations/fix_parking_display_fields.sql` - Correcciones para campos de visualización
- `migrations/optimize_create_parking_rpc.sql` - Optimizaciones para creación de estacionamientos

## Estructura

```
supabase/
├── migrations/                 # Scripts de migración SQL
│   ├── basededatos.sql         # Esquema principal de BD
│   ├── fix_parking_display_fields.sql  # Correcciones de campos
│   └── optimize_create_parking_rpc.sql # Optimizaciones RPC
└── security-policies.sql       # Políticas RLS y triggers
```

## Entradas/Salidas

- **Entradas**: Scripts SQL que definen estructura de datos
- **Salidas**: Base de datos PostgreSQL funcional con tablas, índices y políticas de seguridad

## Cómo se usa desde afuera

```bash
# Ejecutar migraciones en Supabase
supabase db reset

# Aplicar migraciones específicas
psql -f supabase/migrations/basededatos.sql

# Verificar políticas de seguridad
supabase db diff --schema public
```

## Dependencias y contratos

- **Depende de**: PostgreSQL, Supabase CLI
- **Expone**: Esquemas de base de datos, funciones SQL, políticas de acceso

## Puntos de extensión / modificar con seguridad

- Nuevas tablas: añadir CREATE TABLE en archivos de migración
- Modificar esquemas: crear nuevos archivos `.sql` en `migrations/`
- Políticas de seguridad: extender `security-policies.sql`
- Funciones SQL: añadir CREATE FUNCTION en archivos de migración

## Convenciones / notas

- Migraciones en orden cronológico
- Nombres descriptivos para archivos SQL
- Comentarios en español para claridad
- Row Level Security (RLS) para aislamiento de datos
- Triggers para validaciones de negocio
- Índices optimizados para consultas frecuentes

