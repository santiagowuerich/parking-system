# Sistema de Gestión de Estacionamiento

Documentación de exploración rápida - Índice jerárquico de carpetas y componentes.

## 📁 Estructura del Proyecto

### 🏠 Raíz del Proyecto
- **[README.md](README.md)** - Documentación principal del sistema de estacionamiento

### 🎯 Aplicación Principal
- **[app/](app/README.md)** - Next.js App Router con páginas y API routes
  - `api/` - 60+ endpoints serverless para operaciones backend
  - `dashboard/` - Panel principal con múltiples módulos operativos
  - `auth/` - Páginas de autenticación y registro
  - `conductor/` - Funcionalidades específicas para conductores
  - `payment/` - Estados de pago (success, pending, failure)

### 🧩 Componentes de Interfaz
- **[components/](components/README.md)** - Componentes React reutilizables
  - `ui/` - 52 componentes base (botones, formularios, tablas)
  - `operator-panel.tsx` - Panel principal del operador
  - `admin-panel.tsx` - Panel administrativo
  - `dashboard-layout.tsx` - Layout principal del dashboard
  - `payment-*.tsx` - Componentes para manejo de pagos

### 🔧 Utilidades y Librerías
- **[lib/](lib/README.md)** - Utilidades centrales del sistema
  - `auth-context.tsx` - Contexto de autenticación principal
  - `supabase.ts` - Configuración de clientes Supabase
  - `types.ts` - Definiciones TypeScript globales
  - `utils.ts` - Funciones utilitarias generales
  - `hooks/` - Custom hooks para lógica reutilizable
- **[hooks/](hooks/README.md)** - Custom hooks reutilizables
  - `use-mobile.tsx` - Detección de dispositivos móviles
  - `use-toast.ts` - Sistema de notificaciones toast

### 🗄️ Base de Datos
- **[supabase/](supabase/README.md)** - Migraciones y políticas de seguridad
  - `migrations/` - Scripts SQL para crear/modificar BD
  - `security-policies.sql` - Políticas RLS y triggers
- **[sql/](sql/README.md)** - Migraciones SQL adicionales
  - `migrations/` - Extensiones para logging y realtime

### 🧪 Testing y Debugging
- **[debug/](debug/README.md)** - Scripts de diagnóstico y debugging
- **[tests/](tests/README.md)** - Scripts de testing automatizados
  - `test-api-*.js` - Pruebas de endpoints API
  - `test-dashboard-*.js` - Pruebas de integración
  - `test-empleado-*.js` - Pruebas de gestión de empleados

### 📁 Assets y Configuración
- **[public/](public/README.md)** - Archivos estáticos públicos
  - `placeholder-logo.*` - Logos de la aplicación
  - `placeholder-user.jpg` - Avatar placeholder
  - `placeholder.*` - Imágenes genéricas

### 📚 Documentación
- **[docs/](docs/README.md)** - Documentación técnica detallada
  - `ANALISIS_FLUJO_EMPLEADOS.md` - Análisis de gestión de empleados
  - `cambiosbasededatos.md` - Historial de cambios en BD
  - `GOOGLE_MAPS_README.md` - Integración Google Maps
  - `README_AUTO_PARKING.md` - Documentación automática

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Ejecutar migraciones de BD
supabase db reset

# Iniciar servidor de desarrollo
npm run dev
```

## 📖 Navegación por Documentación

1. **[README.md](README.md)** - Visión general completa del sistema
2. **[app/README.md](app/README.md)** - Arquitectura de la aplicación Next.js
3. **[components/README.md](components/README.md)** - Componentes de interfaz
4. **[lib/README.md](lib/README.md)** - Utilidades y configuraciones
5. **[hooks/README.md](hooks/README.md)** - Custom hooks reutilizables
6. **[supabase/README.md](supabase/README.md)** - Base de datos y seguridad
7. **[docs/README.md](docs/README.md)** - Documentación técnica detallada
8. **[debug/README.md](debug/README.md)** - Herramientas de diagnóstico
9. **[tests/README.md](tests/README.md)** - Scripts de testing
10. **[public/README.md](public/README.md)** - Assets estáticos

## 🔍 Búsqueda Rápida

| ¿Qué buscas? | Archivo recomendado |
|-------------|-------------------|
| APIs y endpoints | [app/README.md](app/README.md) |
| Componentes UI | [components/README.md](components/README.md) |
| Custom hooks | [hooks/README.md](hooks/README.md) |
| Configuración BD | [supabase/README.md](supabase/README.md) |
| Utilidades | [lib/README.md](lib/README.md) |
| Assets estáticos | [public/README.md](public/README.md) |
| Testing | [tests/README.md](tests/README.md) |
| Debugging | [debug/README.md](debug/README.md) |
| Documentación técnica | [docs/README.md](docs/README.md) |

## 🏗️ Arquitectura General

```
parking-system/
├── app/           # Next.js App Router (páginas + APIs)
├── components/    # Componentes React reutilizables
├── hooks/         # Custom hooks reutilizables
├── lib/           # Utilidades y contextos
├── public/        # Assets estáticos
├── supabase/      # Migraciones y políticas BD
├── sql/           # Migraciones adicionales
├── debug/         # Scripts de diagnóstico
├── tests/         # Scripts de testing
└── docs/          # Documentación técnica
```
