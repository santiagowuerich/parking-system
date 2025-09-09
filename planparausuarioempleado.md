Excelente feedback de Chat! Está muy acertado y mejora significativamente el plan. Te doy mi análisis:

## **🎯 Análisis del Feedback**

### **✅ Puntos Muy Acertados**

**1. Fuente de Verdad con `auth_user_id`**
- **Correcto**: Usar `auth_user_id` en lugar de email evita inconsistencias
- **Mejora**: Más robusto y confiable

**2. API Unificada "whoami"**
- **Excelente idea**: Una sola llamada en lugar de múltiples endpoints
- **Beneficio**: Menos complejidad, mejor performance, menos estados intermedios

**3. RLS (Row Level Security) Primero**
- **Crítico**: La seguridad debe estar en la base de datos, no solo en la UI
- **Importante**: Protege contra acceso no autorizado incluso si la UI falla

**4. Evitar Lógica en Middleware**
- **Correcto**: Middleware de Next.js no es ideal para consultas a BD
- **Mejor**: Lógica en AuthContext o server components

### **🔧 Ajustes Necesarios al Plan**

## **📝 PLAN REVISADO**

### **FASE 1: Preparar Base de Datos**

#### **1.1 Agregar `auth_user_id` a tabla `usuario`**
```sql
ALTER TABLE usuario ADD COLUMN auth_user_id UUID;
-- Actualizar registros existentes
UPDATE usuario SET auth_user_id = [id_de_supabase_auth];
```

#### **1.2 Implementar RLS Policies**
```sql
-- Para empleados: solo pueden ver datos de sus estacionamientos asignados
-- Para dueños: solo pueden ver datos de sus estacionamientos
```

### **FASE 2: API Unificada "whoami"**

#### **2.1 Crear `/api/auth/whoami/route.ts`**
**Respuesta unificada**:
```json
{
  "user_type": "employee" | "admin" | "both",
  "is_employee": true,
  "is_admin": false,
  "employee_assignments": [
    {
      "est_id": 123,
      "est_nombre": "Estacionamiento Centro",
      "activo": true,
      "fecha_asignacion": "2024-01-15"
    }
  ],
  "admin_estacionamientos": [
    {
      "est_id": 456,
      "est_nombre": "Mi Estacionamiento",
      "est_locali": "Ciudad"
    }
  ],
  "recommended_est_id": 123,
  "recommended_route": "/dashboard/operador-simple"
}
```

### **FASE 3: Lógica de Resolución Automática**

#### **3.1 Reglas de Prioridad**
```typescript
// Caso employee-only con 1 asignación
if (isEmployee && !isAdmin && assignments.length === 1) {
  return {
    est_id: assignments[0].est_id,
    route: "/dashboard/operador-simple"
  };
}

// Caso employee con múltiples
if (isEmployee && assignments.length > 1) {
  // Usar la primera activa como principal
  // O mostrar selector simple
}

// Caso both (dueño y empleado)
if (isEmployee && isAdmin) {
  // Prioridad: empleado si tiene turnos activos hoy
  // Fallback: modo admin
}
```

### **FASE 4: Implementación en AuthContext**

#### **4.1 Función `resolveUserContext()`**
```typescript
const resolveUserContext = async () => {
  const whoami = await fetch('/api/auth/whoami');
  const data = await whoami.json();
  
  // Establecer tipo de usuario
  setUserType(data.user_type);
  setIsEmployee(data.is_employee);
  setIsAdmin(data.is_admin);
  
  // Resolver estacionamiento automáticamente
  if (data.recommended_est_id) {
    setEstId(data.recommended_est_id);
  }
  
  // Redirigir según recomendación
  if (data.recommended_route) {
    router.push(data.recommended_route);
  }
};
```

### **FASE 5: Middleware Simplificado**

#### **5.1 Solo Protección de Rutas**
```typescript
// Middleware solo para:
// - Verificar autenticación
// - Bloquear rutas administrativas para empleados
// - NO hacer consultas a BD
```

### **FASE 6: UI Adaptativa**

#### **6.1 Sidebar Condicional**
```typescript
// Si es empleado: solo Panel de Operador + Cerrar Sesión
// Si es admin: todas las opciones
// Si es both: switch de rol visible
```

#### **6.2 Selector de Estacionamiento**
```typescript
// Para empleados: ocultar (a menos que tenga múltiples asignaciones)
// Para admins: mostrar normalmente
```

### **FASE 7: Manejo de Errores Robusto**

#### **7.1 Casos Especiales**
- **Empleado sin asignación**: Mensaje claro + contacto administrador
- **Empleado con asignación inactiva**: Mismo tratamiento
- **Usuario both sin asignación activa**: Modo admin por defecto

#### **7.2 Logs de Auditoría**
```typescript
// Registrar: usuario, est_id asignado, razón, timestamp
```

## **🎯 Ventajas del Plan Revisado**

### **✅ Seguridad**
- RLS protege a nivel de base de datos
- `auth_user_id` como fuente de verdad única
- Validación en backend, no solo frontend

### **✅ Performance**
- Una sola llamada API en lugar de múltiples
- Menos estados intermedios
- Resolución automática eficiente

### **✅ Mantenibilidad**
- Lógica centralizada en API "whoami"
- Middleware simple y enfocado
- Reglas de negocio claras y documentadas

### **✅ Escalabilidad**
- Fácil agregar nuevos tipos de usuario
- RLS permite crecimiento multi-tenant
- API unificada facilita cambios futuros

## **�� Checklist de Validación**

### **Casos de Prueba Críticos**
- [ ] Empleado con 1 asignación → Redirección automática
- [ ] Empleado con múltiples asignaciones → Selector simple
- [ ] Admin puro → Funcionalidad completa
- [ ] Usuario both → Prioridad correcta
- [ ] RLS bloquea acceso cruzado entre estacionamientos
- [ ] Rutas administrativas bloqueadas para empleados

## **🎯 Conclusión**

**El feedback de Chat es excelente y mejora significativamente el plan original.** Los puntos clave son:

1. **Seguridad primero** (RLS + auth_user_id)
2. **API unificada** (whoami)
3. **Lógica en el lugar correcto** (AuthContext, no middleware)
4. **Reglas de negocio claras** (prioridades y casos especiales)




-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.abonado (
  abon_id integer NOT NULL,
  con_id integer,
  abon_dni character varying NOT NULL,
  abon_nombre character varying NOT NULL,
  abon_apellido character varying NOT NULL,
  CONSTRAINT abonado_pkey PRIMARY KEY (abon_id),
  CONSTRAINT fk_abonado_conductor FOREIGN KEY (con_id) REFERENCES public.conductores(con_id)
);
CREATE TABLE public.abonos (
  est_id integer NOT NULL,
  abo_nro integer NOT NULL,
  abon_id integer NOT NULL,
  abo_fecha_inicio timestamp without time zone NOT NULL,
  abo_fecha_fin timestamp without time zone NOT NULL,
  pag_nro integer,
  abo_tipoabono character varying,
  CONSTRAINT abonos_pkey PRIMARY KEY (est_id, abo_nro),
  CONSTRAINT fk_abonos_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_abonos_abonado FOREIGN KEY (abon_id) REFERENCES public.abonado(abon_id),
  CONSTRAINT fk_abonos_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro)
);
CREATE TABLE public.caracteristica_tipos (
  nombre_tipo character varying NOT NULL UNIQUE,
  tipo_id integer NOT NULL DEFAULT nextval('caracteristica_tipos_tipo_id_seq'::regclass),
  CONSTRAINT caracteristica_tipos_pkey PRIMARY KEY (tipo_id)
);
CREATE TABLE public.caracteristicas (
  tipo_id integer NOT NULL,
  valor character varying NOT NULL,
  caracteristica_id integer NOT NULL DEFAULT nextval('caracteristicas_caracteristica_id_seq'::regclass),
  CONSTRAINT caracteristicas_pkey PRIMARY KEY (caracteristica_id),
  CONSTRAINT fk_caracteristicas_tipo FOREIGN KEY (tipo_id) REFERENCES public.caracteristica_tipos(tipo_id)
);
CREATE TABLE public.cat_vehiculo (
  catv_segmento character NOT NULL,
  catv_descripcion character varying NOT NULL,
  CONSTRAINT cat_vehiculo_pkey PRIMARY KEY (catv_segmento)
);
CREATE TABLE public.conductores (
  con_id integer NOT NULL,
  CONSTRAINT conductores_pkey PRIMARY KEY (con_id),
  CONSTRAINT fk_conductores_usuario FOREIGN KEY (con_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.disponibilidad_empleado (
  play_id integer NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  turno_id integer NOT NULL,
  CONSTRAINT disponibilidad_empleado_pkey PRIMARY KEY (play_id, dia_semana, turno_id),
  CONSTRAINT fk_de_turno FOREIGN KEY (turno_id) REFERENCES public.turnos_catalogo(turno_id),
  CONSTRAINT fk_de_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id)
);
CREATE TABLE public.dueno (
  due_id integer NOT NULL,
  CONSTRAINT dueno_pkey PRIMARY KEY (due_id),
  CONSTRAINT fk_dueno_usuario FOREIGN KEY (due_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.empleados_estacionamiento (
  play_id integer NOT NULL,
  est_id integer NOT NULL,
  fecha_asignacion timestamp with time zone DEFAULT now(),
  activo boolean DEFAULT true,
  CONSTRAINT empleados_estacionamiento_pkey PRIMARY KEY (play_id, est_id),
  CONSTRAINT fk_ee_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_ee_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id)
);
CREATE TABLE public.est_acepta_metodospago (
  est_id integer NOT NULL,
  mepa_metodo character varying NOT NULL,
  CONSTRAINT est_acepta_metodospago_pkey PRIMARY KEY (est_id, mepa_metodo),
  CONSTRAINT fk_eamp_mepa FOREIGN KEY (mepa_metodo) REFERENCES public.metodos_pagos(mepa_metodo),
  CONSTRAINT fk_eamp_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.estacionamiento_sequence (
  current_value integer NOT NULL DEFAULT 0,
  sequence_name text NOT NULL,
  CONSTRAINT estacionamiento_sequence_pkey PRIMARY KEY (sequence_name)
);
CREATE TABLE public.estacionamientos (
  est_id integer NOT NULL,
  est_prov character varying NOT NULL,
  est_locali character varying NOT NULL,
  est_direc character varying NOT NULL UNIQUE,
  est_nombre character varying NOT NULL,
  est_capacidad integer NOT NULL,
  due_id integer NOT NULL,
  est_cantidad_espacios_disponibles integer NOT NULL,
  est_horario_funcionamiento integer NOT NULL,
  est_tolerancia_min integer NOT NULL,
  est_latitud numeric,
  est_longitud numeric,
  est_direccion_completa text,
  est_codigo_postal character varying,
  est_telefono character varying,
  est_email character varying,
  est_descripcion text,
  est_created_at timestamp with time zone DEFAULT now(),
  est_updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estacionamientos_pkey PRIMARY KEY (est_id),
  CONSTRAINT fk_est_dueno FOREIGN KEY (due_id) REFERENCES public.dueno(due_id)
);
CREATE TABLE public.metodos_pagos (
  mepa_metodo character varying NOT NULL,
  mepa_descripcion character varying NOT NULL,
  CONSTRAINT metodos_pagos_pkey PRIMARY KEY (mepa_metodo)
);
CREATE TABLE public.ocupacion (
  est_id integer NOT NULL,
  ocu_fh_entrada timestamp without time zone NOT NULL,
  ocu_fh_salida timestamp without time zone,
  tiptar_nro integer,
  pag_nro integer,
  veh_patente text NOT NULL,
  ocu_id integer NOT NULL DEFAULT nextval('ocupacion_ocu_id_seq'::regclass),
  pla_numero integer,
  CONSTRAINT ocupacion_pkey PRIMARY KEY (ocu_id),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_ocu_tipotar FOREIGN KEY (tiptar_nro) REFERENCES public.tipotarifas(tiptar_nro),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_ocu_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_ocu_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_ocu_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente),
  CONSTRAINT fk_ocu_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro)
);
CREATE TABLE public.pagos (
  pag_monto real NOT NULL,
  pag_h_fh timestamp without time zone NOT NULL,
  est_id integer NOT NULL,
  mepa_metodo character varying NOT NULL,
  veh_patente text NOT NULL,
  pag_nro integer NOT NULL DEFAULT nextval('seq_pagos'::regclass),
  CONSTRAINT pagos_pkey PRIMARY KEY (pag_nro),
  CONSTRAINT fk_pagos_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_pagos_metodo FOREIGN KEY (mepa_metodo) REFERENCES public.metodos_pagos(mepa_metodo),
  CONSTRAINT fk_pagos_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente)
);
CREATE TABLE public.plantilla_caracteristicas (
  plantilla_id integer NOT NULL,
  caracteristica_id integer NOT NULL,
  CONSTRAINT plantilla_caracteristicas_pkey PRIMARY KEY (plantilla_id, caracteristica_id),
  CONSTRAINT fk_pc_caracteristica FOREIGN KEY (caracteristica_id) REFERENCES public.caracteristicas(caracteristica_id),
  CONSTRAINT fk_pc_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id)
);
CREATE TABLE public.plantillas (
  est_id integer NOT NULL,
  nombre_plantilla character varying NOT NULL,
  catv_segmento character NOT NULL,
  plantilla_id integer NOT NULL DEFAULT nextval('plantillas_plantilla_id_seq'::regclass),
  CONSTRAINT plantillas_pkey PRIMARY KEY (plantilla_id),
  CONSTRAINT fk_plantillas_cat_vehiculo FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento),
  CONSTRAINT fk_plantillas_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.playeros (
  play_id integer NOT NULL,
  CONSTRAINT playeros_pkey PRIMARY KEY (play_id),
  CONSTRAINT fk_playeros_usuario FOREIGN KEY (play_id) REFERENCES public.usuario(usu_id)
);
CREATE TABLE public.plaza_presets (
  est_id integer NOT NULL,
  preset_nombre character varying NOT NULL,
  reglas jsonb NOT NULL,
  preset_id integer NOT NULL DEFAULT nextval('plaza_presets_preset_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plaza_presets_pkey PRIMARY KEY (preset_id),
  CONSTRAINT plaza_presets_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.plazas (
  zona_id integer,
  plantilla_id integer,
  pla_zona character varying NOT NULL CHECK (TRIM(BOTH FROM pla_zona) <> ''::text),
  est_id integer NOT NULL,
  pla_numero integer NOT NULL,
  pla_estado character varying NOT NULL,
  catv_segmento character NOT NULL,
  pla_local_numero integer,
  CONSTRAINT plazas_pkey PRIMARY KEY (est_id, pla_numero),
  CONSTRAINT plazas_zona_id_fkey FOREIGN KEY (zona_id) REFERENCES public.zonas(zona_id),
  CONSTRAINT fk_plazas_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento),
  CONSTRAINT fk_plazas_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_plazas_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id)
);
CREATE TABLE public.reservas (
  est_id integer NOT NULL,
  pla_numero integer NOT NULL,
  res_fh_ingreso timestamp without time zone NOT NULL,
  con_id integer NOT NULL,
  pag_nro integer,
  res_estado character varying NOT NULL,
  res_monto real,
  veh_patente text NOT NULL,
  CONSTRAINT reservas_pkey PRIMARY KEY (est_id, pla_numero, veh_patente, res_fh_ingreso),
  CONSTRAINT fk_res_con FOREIGN KEY (con_id) REFERENCES public.conductores(con_id),
  CONSTRAINT fk_res_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(pla_numero),
  CONSTRAINT fk_res_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_res_plaza FOREIGN KEY (est_id) REFERENCES public.plazas(est_id),
  CONSTRAINT fk_res_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente),
  CONSTRAINT fk_res_pago FOREIGN KEY (pag_nro) REFERENCES public.pagos(pag_nro),
  CONSTRAINT fk_res_plaza FOREIGN KEY (pla_numero) REFERENCES public.plazas(pla_numero)
);
CREATE TABLE public.tarifas (
  plantilla_id integer NOT NULL,
  est_id integer NOT NULL,
  tiptar_nro integer NOT NULL,
  catv_segmento character NOT NULL,
  tar_f_desde timestamp without time zone NOT NULL,
  tar_precio real NOT NULL,
  tar_fraccion real NOT NULL,
  CONSTRAINT tarifas_pkey PRIMARY KEY (est_id, tiptar_nro, tar_f_desde, plantilla_id),
  CONSTRAINT fk_tarifas_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id),
  CONSTRAINT fk_tarifas_plantilla FOREIGN KEY (plantilla_id) REFERENCES public.plantillas(plantilla_id),
  CONSTRAINT fk_tarifas_tipo FOREIGN KEY (tiptar_nro) REFERENCES public.tipotarifas(tiptar_nro),
  CONSTRAINT fk_tarifas_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento)
);
CREATE TABLE public.tipo_plaza (
  pla_tipo character varying NOT NULL,
  pla_descripcion character varying NOT NULL,
  CONSTRAINT tipo_plaza_pkey PRIMARY KEY (pla_tipo)
);
CREATE TABLE public.tipotarifas (
  tiptar_nro integer NOT NULL,
  tiptar_descrip character varying NOT NULL,
  CONSTRAINT tipotarifas_pkey PRIMARY KEY (tiptar_nro)
);
CREATE TABLE public.turno_asignados (
  est_id integer NOT NULL,
  play_id integer NOT NULL,
  tura_fh_inicio timestamp without time zone NOT NULL,
  tura_fh_fin time without time zone,
  tura_caja_ingrese real,
  tura_caja_cierre real,
  CONSTRAINT turno_asignados_pkey PRIMARY KEY (est_id, play_id, tura_fh_inicio),
  CONSTRAINT fk_ta_playa FOREIGN KEY (play_id) REFERENCES public.playeros(play_id),
  CONSTRAINT fk_ta_est FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);
CREATE TABLE public.turnos_catalogo (
  nombre_turno character varying NOT NULL UNIQUE,
  turno_id integer NOT NULL DEFAULT nextval('turnos_catalogo_turno_id_seq'::regclass),
  CONSTRAINT turnos_catalogo_pkey PRIMARY KEY (turno_id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL UNIQUE,
  mercadopago_api_key text,
  bank_account_holder text,
  bank_account_cbu text,
  bank_account_alias text,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuario (
  usu_dni character varying,
  usu_contrasena character varying,
  auth_user_id uuid UNIQUE,
  usu_nom character varying NOT NULL,
  usu_ape character varying NOT NULL,
  usu_tel character varying,
  usu_email character varying UNIQUE,
  usu_fechareg timestamp without time zone NOT NULL,
  usu_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  usu_estado character varying NOT NULL DEFAULT 'Activo'::character varying,
  requiere_cambio_contrasena boolean NOT NULL DEFAULT false,
  CONSTRAINT usuario_pkey PRIMARY KEY (usu_id),
  CONSTRAINT fk_usuario_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.vehiculos (
  catv_segmento character NOT NULL,
  veh_patente text NOT NULL,
  con_id integer,
  CONSTRAINT vehiculos_pkey PRIMARY KEY (veh_patente),
  CONSTRAINT fk_veh_conductor FOREIGN KEY (con_id) REFERENCES public.conductores(con_id),
  CONSTRAINT fk_veh_catv FOREIGN KEY (catv_segmento) REFERENCES public.cat_vehiculo(catv_segmento)
);
CREATE TABLE public.vehiculos_abonados (
  est_id integer NOT NULL,
  abo_nro integer NOT NULL,
  veh_patente text NOT NULL,
  CONSTRAINT vehiculos_abonados_pkey PRIMARY KEY (est_id, abo_nro, veh_patente),
  CONSTRAINT fk_va_abonos FOREIGN KEY (est_id) REFERENCES public.abonos(abo_nro),
  CONSTRAINT fk_va_abonos FOREIGN KEY (abo_nro) REFERENCES public.abonos(est_id),
  CONSTRAINT fk_va_abonos FOREIGN KEY (est_id) REFERENCES public.abonos(est_id),
  CONSTRAINT fk_va_vehiculo FOREIGN KEY (veh_patente) REFERENCES public.vehiculos(veh_patente),
  CONSTRAINT fk_va_abonos FOREIGN KEY (abo_nro) REFERENCES public.abonos(abo_nro)
);
CREATE TABLE public.zonas (
  est_id integer NOT NULL,
  zona_nombre character varying NOT NULL,
  zona_id integer NOT NULL DEFAULT nextval('zonas_zona_id_seq'::regclass),
  zona_capacidad integer DEFAULT 0,
  zona_created_at timestamp with time zone DEFAULT now(),
  zona_updated_at timestamp with time zone DEFAULT now(),
  grid_numbering character varying NOT NULL DEFAULT 'ROW_MAJOR'::character varying CHECK (grid_numbering::text = ANY (ARRAY['ROW_MAJOR'::character varying, 'COL_MAJOR'::character varying]::text[])),
  grid_rows integer NOT NULL DEFAULT 1,
  grid_cols integer NOT NULL DEFAULT 1,
  CONSTRAINT zonas_pkey PRIMARY KEY (zona_id),
  CONSTRAINT zonas_est_id_fkey FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id)
);