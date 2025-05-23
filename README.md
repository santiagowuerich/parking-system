# Sistema de Gestión de Estacionamiento

Sistema completo para la gestión de estacionamientos con capacidades online y offline, sincronización automática, y múltiples métodos de pago.

## Índice
- [Visión General](#visión-general)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Componentes Principales](#componentes-principales)
- [Sistema de Caché y Funcionamiento Offline](#sistema-de-caché-y-funcionamiento-offline)
- [Flujos de Trabajo](#flujos-de-trabajo)
- [API Endpoints](#api-endpoints)
- [Base de Datos](#base-de-datos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Guía de Uso](#guía-de-uso)
- [Seguridad y Protección de Datos](#seguridad-y-protección-de-datos)
- [Extensibilidad](#extensibilidad)
- [Solución de Problemas](#solución-de-problemas)
- [Contribuciones](#contribuciones)

## Visión General

Este sistema de estacionamiento permite gestionar completamente operaciones de entrada y salida de vehículos, control de tarifas, registro de pagos y administración del historial. El sistema está diseñado para funcionar tanto online como offline, permitiendo una operación ininterrumpida incluso sin conexión a internet, con sincronización automática cuando la conexión se restablece.

### Características Clave

- **Gestión de vehículos**: Control de entrada/salida, capacidad por tipo de vehículo
- **Cálculo de tarifas**: Configuración flexible por tipo de vehículo y tiempo
- **Múltiples métodos de pago**: Efectivo, transferencia, QR de MercadoPago
- **Modo offline completo**: Funcionamiento sin conexión a internet
- **Historial detallado**: Registro completo de todas las operaciones
- **Panel administrativo**: Configuración de tarifas, capacidad, y opciones de pago
- **Roles de usuario**: Configuración para administradores y operadores
- **Sincronización automática**: Procesamiento automático de operaciones pendientes
- **Diseño responsive**: Uso en diferentes dispositivos

## Tecnologías Utilizadas

### Frontend
- **React 18** - Biblioteca para construir interfaces de usuario con componentes reutilizables
- **Next.js 14** - Framework de React con soporte para renderizado híbrido (SSR/SSG/CSR)
- **TypeScript 5** - Superset tipado de JavaScript para desarrollo escalable
- **TailwindCSS** - Framework CSS utilitario para diseño rápido y consistente
- **shadcn/ui** - Sistema de componentes construido sobre Radix UI y Tailwind
- **Lucide Icons** - Biblioteca de iconos modernos y limpios
- **Day.js** - Biblioteca ligera para manipulación y formato de fechas
- **React Hook Form** - Biblioteca para manejo de formularios eficiente
- **React Context API** - Para la gestión global del estado de la aplicación
- **useSWR** - Hook para gestión de peticiones y caché de datos

### Backend
- **Next.js API Routes** - API serverless integrada en Next.js
- **Supabase** - Plataforma con PostgreSQL, autenticación y APIs RESTful
- **JWT** - Tokens para autenticación segura entre cliente y servidor
- **Service Workers** - Para funcionalidad offline y caché de recursos
- **Web Storage API** - Almacenamiento local en el navegador

### Sistema de Caché Multinivel
- **Memoria RAM** - Primera capa de caché para respuestas rápidas
- **IndexedDB** - Almacenamiento persistente en navegador para datos offline
- **Supabase** - Persistencia en la nube como fuente de verdad final

### Procesamiento de Pagos
- **MercadoPago SDK** - Integración con API de MercadoPago para pagos con QR
- **Generación de QR** - Generación dinámica de códigos QR para pagos
- **WebHooks** - Para recepción de notificaciones sobre pagos procesados
- **Sistema de conciliación** - Verificación de pagos entrantes vs registros internos

### Herramientas de Desarrollo
- **ESLint** - Linting de código para mantener consistencia
- **Prettier** - Formateador de código
- **Jest** - Framework de pruebas unitarias
- **React Testing Library** - Pruebas de componentes React
- **Next.js Middleware** - Para interceptación de rutas y autenticación
- **dotenv** - Gestión de variables de entorno

## Estructura del Proyecto

La estructura del proyecto está organizada de la siguiente manera:

```
parking-system/
├── app/                    # Rutas y estructura de Next.js App Router
│   ├── api/                # Endpoints de API serverless
│   │   ├── auth/           # Endpoints de autenticación
│   │   ├── capacity/       # Gestión de capacidad de estacionamiento
│   │   ├── dashboard/      # Endpoints para el panel principal
│   │   ├── parking/        # Operaciones de entrada/salida
│   │   └── payment/        # Procesamiento de pagos
│   ├── dashboard/          # Páginas del panel principal
│   └── login/              # Páginas de autenticación
├── components/             # Componentes React reutilizables
│   ├── admin-panel.tsx     # Panel de administración
│   ├── history-table.tsx   # Tabla de historial de operaciones
│   ├── operator-panel.tsx  # Panel del operador
│   ├── parking-app.tsx     # Componente principal de la aplicación
│   ├── qr-dialog.tsx       # Diálogo para pagos con QR
│   ├── rates-panel.tsx     # Panel de configuración de tarifas
│   └── ui/                 # Componentes de interfaz reutilizables
├── lib/                    # Bibliotecas y utilidades
│   ├── api-cache.ts        # Sistema de caché multinivel para APIs
│   ├── auth-context.tsx    # Contexto de autenticación
│   ├── connection-context.tsx  # Gestión del estado de conectividad
│   ├── indexed-db-cache.ts # Almacenamiento persistente en IndexedDB
│   ├── supabase/           # Configuración e integración con Supabase
│   ├── sync-service.ts     # Servicio de sincronización para modo offline
│   ├── types.ts            # Definiciones de tipos TypeScript
│   └── utils.ts            # Funciones utilitarias
├── public/                 # Archivos estáticos
└── styles/                 # Estilos globales
```

## Componentes Principales

### components/parking-app.tsx
Este es el componente principal que orquesta toda la aplicación. Gestiona:
- Carga inicial de datos
- Estado global del estacionamiento
- Operaciones de entrada y salida
- Procesamiento de pagos
- Sincronización online/offline
- Gestión del historial

Líneas clave:
- 35-53: Declaración de estados principales
- 97-198: Implementación de `fetchHistoryWithPagination`
- 201-359: Función `fetchInitialData` para carga inicial
- 425-493: Registro de entrada de vehículos
- 586-621: Inicio del proceso de salida
- 726-899: Finalización de la salida con procesamiento de pago

### components/operator-panel.tsx
Panel para operadores que permite:
- Registrar entrada de vehículos
- Procesar salida y pagos
- Visualizar vehículos actualmente estacionados
- Ver espacios disponibles por tipo de vehículo

### components/admin-panel.tsx
Panel exclusivo para administradores con:
- Visualización del historial completo
- Filtros avanzados para el historial
- Configuración de capacidad por tipo de vehículo
- Eliminación o edición de registros históricos

### components/rates-panel.tsx
Gestiona la configuración del sistema:
- Tarifas por tipo de vehículo
- Configuración de MercadoPago
- Datos de transferencia bancaria
- Personalización de mensajes

### lib/api-cache.ts
Implementa un sistema de caché multinivel con:
- Caché en memoria para acceso rápido
- Persistencia en IndexedDB
- Invalidación inteligente de entradas
- Expiración temporal configurable

Funciones clave:
- `fetchWithCache`: Obtiene datos priorizando la caché
- `updateCache`: Actualiza datos en todos los niveles de caché
- `invalidateCache`: Elimina entradas específicas de la caché

### lib/indexed-db-cache.ts
Gestiona el almacenamiento persistente en el navegador:
- Inicialización de bases de datos IndexedDB
- Almacenamiento de vehículos estacionados
- Registro del historial para funcionamiento offline
- Recuperación de datos cuando no hay conexión

### lib/sync-service.ts
Maneja la sincronización cuando se recupera la conexión:
- Cola de operaciones pendientes
- Reintentos con backoff exponencial
- Priorización de operaciones críticas
- Notificación de estado de sincronización

## Sistema de Caché y Funcionamiento Offline

El sistema implementa una estrategia de caché sofisticada para funcionamiento offline:

### Niveles de Caché

1. **Caché en Memoria (RAM)**
   - Implementada en `lib/api-cache.ts`
   - Acceso inmediato sin latencia de red o disco
   - Volátil, se pierde al cerrar la aplicación
   - Primera capa consultada en cada petición

2. **IndexedDB**
   - Implementada en `lib/indexed-db-cache.ts`
   - Persistente en el navegador entre sesiones
   - Almacena vehículos estacionados, historial y configuraciones
   - Segunda capa cuando la memoria no tiene los datos solicitados

3. **Supabase (Backend)**
   - Fuente de verdad final cuando hay conexión
   - Almacenamiento definitivo de todas las operaciones
   - Consultado solo cuando las capas anteriores no tienen datos o están desactualizadas

### Proceso de Sincronización

Cuando se detecta que la conexión se ha restaurado:
1. Se procesa la cola de operaciones pendientes en `lib/sync-service.ts`
2. Las entradas temporales se marcan como sincronizadas
3. Se actualizan las capas de caché con los datos confirmados
4. Se notifica al usuario sobre el estado de la sincronización

## Flujos de Trabajo

### Entrada de Vehículo

1. El operador ingresa información del vehículo (matrícula, tipo)
2. Sistema verifica disponibilidad según capacidad configurada
3. Si hay espacio disponible, se registra entrada en `api/parking/entry`
4. Se actualiza la interfaz y cachés correspondientes
5. En modo offline, se almacena localmente y se encola para sincronización

**Archivos involucrados:**
- `components/operator-panel.tsx` (interfaz de usuario)
- `components/parking-app.tsx` (método `registerEntry`)
- `app/api/parking/entry/route.ts` (endpoint de API)
- `lib/sync-service.ts` (para operaciones offline)

### Salida de Vehículo

1. Operador selecciona vehículo a retirar
2. Sistema calcula tarifa según tiempo estacionado y configuración
3. Se selecciona método de pago (efectivo, QR, transferencia)
4. Se procesa el pago según método seleccionado
5. Se registra la salida en `api/parking/exit`
6. Se actualiza historial y se libera el espacio

**Archivos involucrados:**
- `components/operator-panel.tsx` (interfaz)
- `components/parking-app.tsx` (métodos `handleExit` y `finalizeExit`)
- `app/api/parking/exit/route.ts` (endpoint de API)
- `components/qr-dialog.tsx` (para pagos con QR)

### Generación de QR para MercadoPago

1. Se calcula el monto a pagar
2. Se solicita creación de QR a `api/payment/mercadopago`
3. API conecta con MercadoPago para generar código/enlace
4. Se muestra QR al cliente para escaneo
5. Sistema verifica estado del pago y confirma salida

**Archivos involucrados:**
- `components/qr-dialog.tsx` (visualización del QR)
- `app/api/payment/mercadopago/route.ts` (generación del QR)
- `components/parking-app.tsx` (método `handlePaymentMethod`)

## API Endpoints

### Autenticación
- `app/api/auth/login/route.ts`: Autenticación de usuarios
- `app/api/auth/register/route.ts`: Registro de nuevos usuarios
- `app/api/auth/logout/route.ts`: Cierre de sesión

### Dashboard
- `app/api/dashboard/essential/route.ts`: Datos esenciales para funcionamiento
- `app/api/dashboard/history/route.ts`: Historial con paginación

### Parking
- `app/api/parking/entry/route.ts`: Registro de entrada
- `app/api/parking/exit/route.ts`: Registro de salida
- `app/api/parking/parked/route.ts`: Listar vehículos estacionados
- `app/api/parking/history/route.ts`: Gestión de historial
- `app/api/parking/history/[id]/route.ts`: Operaciones sobre registros específicos

### Configuración
- `app/api/capacity/route.ts`: Gestión de capacidad del estacionamiento
- `app/api/rates/route.ts`: Administración de tarifas
- `app/api/user/settings/route.ts`: Configuración de usuario

### Pagos
- `app/api/payment/mercadopago/route.ts`: Integración con MercadoPago

## Base de Datos

El proyecto utiliza Supabase con PostgreSQL como base de datos. Las tablas principales son:

### Tabla: vehicles
Almacena los vehículos actualmente estacionados
- `id`: UUID, clave primaria
- `license_plate`: Texto, matrícula del vehículo
- `type`: Enum (Auto, Moto, Camioneta)
- `entry_time`: Timestamp, momento de entrada
- `exit_time`: Timestamp, momento de salida (NULL si aún está estacionado)
- `user_id`: UUID, referencia al propietario del estacionamiento
- `notes`: Texto opcional con notas adicionales

### Tabla: parking_history
Historial completo de todas las operaciones
- `id`: UUID, clave primaria
- `license_plate`: Texto, matrícula del vehículo
- `type`: Enum (Auto, Moto, Camioneta)
- `entry_time`: Timestamp, momento de entrada
- `exit_time`: Timestamp, momento de salida
- `duration`: Integer, duración en milisegundos
- `fee`: Decimal, tarifa cobrada
- `payment_method`: Texto (efectivo, transferencia, qr, mercadopago)
- `payment_details`: JSON con detalles específicos del pago
- `user_id`: UUID, referencia al propietario

### Tabla: user_capacity
Configuración de capacidad por usuario
- `user_id`: UUID, clave primaria parcial
- `vehicle_type`: Enum (Auto, Moto, Camioneta), clave primaria parcial
- `capacity`: Integer, espacios disponibles

### Tabla: user_rates
Configuración de tarifas por usuario
- `user_id`: UUID, clave primaria parcial
- `vehicle_type`: Enum (Auto, Moto, Camioneta), clave primaria parcial
- `rate`: Decimal, tarifa por hora

### Tabla: user_settings
Configuración general por usuario
- `user_id`: UUID, clave primaria
- `mercadopagoApiKey`: Texto, clave de integración con MercadoPago
- `transferData`: JSON, datos para transferencias bancarias
- `companyName`: Texto, nombre de la empresa

## Instalación y Configuración

### Requisitos Previos
- Node.js 18 o superior
- NPM 8+ o Yarn 1.22+
- Cuenta en Supabase

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tuuser/parking-system.git
cd parking-system
```

2. **Instalar dependencias**
```bash
npm install
# o
yarn install
```

3. **Configurar variables de entorno**
Crear un archivo `.env.local` con:
```
NEXT_PUBLIC_SUPABASE_URL=tuURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=tuClaveAnonima
SUPABASE_SERVICE_ROLE_KEY=tuClaveDeServicio
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Configurar Base de Datos en Supabase**
   - Crear un nuevo proyecto en Supabase
   - Ejecutar los scripts SQL en la carpeta `/db` para crear las tablas necesarias

5. **Iniciar el servidor de desarrollo**
```bash
npm run dev
# o
yarn dev
```

6. **Construir para producción**
```bash
npm run build
# o
yarn build
```

## Guía de Uso

### Panel de Operador
Accesible desde la pestaña "Panel de Operador", permite:

1. **Registrar Entrada**
   - Ingresa matrícula y selecciona tipo de vehículo
   - Verifica espacios disponibles automáticamente
   - Confirma entrada para registrar timestamp

2. **Procesar Salida**
   - Selecciona vehículo de la lista de estacionados
   - Sistema calcula tarifa automáticamente
   - Selecciona método de pago:
     - Efectivo: Registro directo
     - QR/MercadoPago: Genera código para escanear
     - Transferencia: Muestra datos bancarios

### Panel de Administrador
Accesible desde la pestaña "Panel de Administrador", permite:

1. **Gestión del Historial**
   - Visualización completa con paginación
   - Filtros por fecha, tipo de vehículo, método de pago
   - Exportación de datos (CSV, pendiente implementación)

2. **Configuración de Capacidad**
   - Ajuste de espacios disponibles por tipo de vehículo
   - Cambios reflejados inmediatamente en el sistema

3. **Operaciones Avanzadas**
   - Edición de registros históricos
   - Reingreso rápido de vehículos previos
   - Eliminación de registros (con restricciones)

### Panel de Configuración
Accesible desde la pestaña "Gestión de Configuración", permite:

1. **Tarifas**
   - Configuración por tipo de vehículo
   - Montos por hora o fracción

2. **Integración de Pagos**
   - Configuración de MercadoPago (API Key)
   - Datos para transferencias bancarias
   - Información de la empresa para recibos

## Seguridad y Protección de Datos

### Autenticación
- JWT para sesiones seguras
- Roles de usuario para control de acceso
- Protección contra CSRF en todas las peticiones

### Privacidad de Datos
- Aislamiento de datos por usuario (Row-Level Security)
- No se almacenan datos sensibles de pago
- Encriptación en tránsito mediante HTTPS

### Seguridad Offline
- Datos encriptados en almacenamiento local
- Validación de integridad en sincronizaciones
- Límites de operaciones offline por seguridad

## Extensibilidad

El sistema está diseñado para ser fácilmente extensible:

### Nuevos Métodos de Pago
Añadir un nuevo método en:
1. `components/payment-method-dialog.tsx` (UI)
2. `components/parking-app.tsx` (método `handlePaymentMethod`)
3. Implementar lógica específica del proveedor

### Integración con Hardware
Posibles extensiones para hardware específico:
- Lectores de matrículas (ALPR)
- Barreras automáticas
- Impresoras de tickets
- Lectores de tarjetas RFID

### Personalización Visual
- Temas personalizados mediante Tailwind
- Marca blanca modificando componentes en `/ui`
- Mensajes y textos configurables

## Solución de Problemas

### Problemas de Sincronización
Si hay problemas con la sincronización tras recuperar la conexión:
1. Verificar estado en `localStorage` bajo la clave `syncPendingOperations`
2. Reiniciar la aplicación para forzar proceso de sincronización
3. Verificar logs en consola para mensajes específicos

### Errores de Caché
Si los datos mostrados no parecen actualizados:
1. Usar botón "Actualizar" en la interfaz
2. Ejecutar `localStorage.clear()` en consola del navegador
3. Revisar estado de caché con herramientas de desarrollo

### Problemas con MercadoPago
Si los QR no se generan correctamente:
1. Verificar API Key en configuración
2. Confirmar que el sandbox está habilitado para pruebas
3. Revisar cuentas de prueba para pagador y receptor

## Contribuciones

El proyecto está abierto a contribuciones. Proceso recomendado:

1. Crear fork del repositorio
2. Crear rama para nueva característica
3. Implementar cambios siguiendo estilo de código
4. Enviar pull request con descripción detallada

### Estándares de Código
- Usar TypeScript con tipado estricto
- Seguir principios de componentes funcionales y hooks
- Mantener compatibilidad con modo offline
- Documentar nuevas funciones y componentes