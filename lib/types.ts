export type VehicleType = "Auto" | "Moto" | "Camioneta"

export interface Vehicle {
  license_plate: string
  type: VehicleType
  entry_time: string
  plaza_number?: number
  duracion_tipo?: string
  precio_acordado?: number
}

export interface VehicleEntryData extends Omit<Vehicle, 'entry_time'> {
  pla_numero?: number | null
  isAbono?: boolean
  abono_nro?: number
}

export interface ParkingHistory extends Omit<Vehicle, 'entry_time'> {
  id: string
  entry_time: string
  exit_time: string
  duration: number // en milisegundos
  fee: number
  payment_method: 'efectivo' | 'transferencia' | 'link_pago' | 'qr'
  payment_id?: string
  payment_status?: 'pendiente' | 'aprobado' | 'rechazado' | 'expirado' | 'cancelado'
}

export interface Parking {
  capacity: Record<VehicleType, number>
  rates: Record<VehicleType, number>
  parkedVehicles: Vehicle[]
  history: ParkingHistory[]
}

// Tipos para el sistema de plantillas
export interface Caracteristica {
  caracteristica_id: number
  valor: string
  tipo_id: number
  caracteristica_tipos: {
    nombre_tipo: string
  }
}

export interface Plantilla {
  plantilla_id?: number
  nombre_plantilla: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  est_id: number
  caracteristicas: Record<string, string[]> // Agrupadas por tipo
}

export interface PlantillaForm {
  plantilla_id?: number
  nombre_plantilla: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  caracteristica_ids: number[]
}

// Re-exportar tipos de pago
export * from './types/payment';

// ============================================
// TIPOS PARA ABONOS
// ============================================

export type TipoAbono = 'semanal' | 'mensual';
export type UnidadDuracion = 'semanas' | 'meses';

export interface Conductor {
  con_id: number;
  usu_nom: string;
  usu_ape: string;
  usu_email: string;
  usu_tel?: string;
  usu_dni: string;
  usu_fechareg: string;
  usu_estado: string;
}

export interface ConductorConVehiculos extends Conductor {
  vehiculos: VehiculoDB[];
}

export interface VehiculoDB {
  veh_patente: string;
  con_id: number;
  catv_segmento: 'AUT' | 'MOT' | 'CAM';
  veh_marca: string;
  veh_modelo: string;
  veh_color: string;
}

export interface VehiculoAbonado {
  veh_patente: string;
  catv_segmento?: 'AUT' | 'MOT' | 'CAM';
  veh_marca?: string | null;
  veh_modelo?: string | null;
  veh_color?: string | null;
}

export interface VehiculoFormData {
  patente: string;
  tipo: 'Auto' | 'Moto' | 'Camioneta';
  marca: string;
  modelo: string;
  color: string;
}

export interface Abonado {
  abon_id: number;
  con_id: number;
  abon_dni: string;
  abon_nombre: string;
  abon_apellido: string;
}

export interface Abono {
  abo_nro: number;
  est_id: number;
  abon_id: number;
  abo_fecha_inicio: string;
  abo_fecha_fin: string;
  pag_nro?: number;
  abo_tipoabono: TipoAbono;
  abo_estado?: 'activo' | 'inactivo';
  vehiculos?: VehiculoAbonado[];
}

export interface AbonoConDetalles extends Abono {
  abonado: Abonado;
  estacionamiento: {
    est_nombre: string;
    est_direc: string;
  };
}

export interface CrearConductorFormData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  vehiculos: VehiculoFormData[];
}

export interface CrearAbonoFormData {
  tipoAbono: TipoAbono;
  duracion: number;
  unidad: UnidadDuracion;
  fechaInicio?: string;
}

export interface AbonoConductor {
  abo_nro: number;
  estacionamiento_nombre: string;
  estacionamiento_direccion: string;
  pla_zona: string;
  pla_numero: number;
  abo_tipoabono: string;
  abo_fecha_inicio: string;
  abo_fecha_fin: string;
  dias_restantes: number;
  estado: 'Activo' | 'Por vencer' | 'Vencido';
}

export interface CrearConductorConAbonoRequest {
  conductor: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    dni: string;
  };
  vehiculos: VehiculoFormData[];
  abono: {
    est_id: number;
    tipoAbono: TipoAbono;
    fechaInicio: string;
    fechaFin: string;
    plaza: {
      pla_numero: number;
      est_id: number;
    };
  };
}

export interface CrearAbonoExistenteRequest {
  con_id: number;
  est_id: number;
  tipoAbono: TipoAbono;
  fechaInicio: string;
  fechaFin: string;
}

export interface CrearConductorConAbonoResponse {
  success: boolean;
  data?: {
    usuario_id: number;
    conductor_id: number;
    vehiculo_ids: string[];
    abonado_id: number;
    abono_nro: number;
    abono: AbonoConDetalles;
  };
  error?: string;
}

export interface BuscarConductorResponse {
  success: boolean;
  data?: ConductorConVehiculos;
  error?: string;
}

export interface ConfiguracionAbono {
  tipo: TipoAbono;
  precioUnitario: number; // Precio por semana o por mes
  unidad: UnidadDuracion;
  descripcion: string;
}

export const CONFIGURACIONES_ABONOS: Record<TipoAbono, ConfiguracionAbono> = {
  semanal: {
    tipo: 'semanal',
    precioUnitario: 1500, // Precio por semana
    unidad: 'semanas',
    descripcion: 'Abono Semanal'
  },
  mensual: {
    tipo: 'mensual',
    precioUnitario: 5000, // Precio por mes
    unidad: 'meses',
    descripcion: 'Abono Mensual'
  }
};

// ========================================
// INTERFACES PARA SELECCIÓN DE PLAZAS
// ========================================

export interface PlazaInfo {
  pla_numero: number;
  est_id: number;
  pla_estado: 'Libre' | 'Ocupada' | 'Abonado';
  catv_segmento: string; // AUT, MOT, CAM
  zona?: string; // A, B, C, etc
  plantilla_id?: number; // ID de la plantilla de tarifa asignada
}

export interface ZonaPlazasResponse {
  success: boolean;
  data?: {
    plazas: PlazaInfo[];
    totalLibres: number;
  };
  error?: string;
}

// ========================================
// ACTUALIZACIONES A INTERFACES EXISTENTES
// ========================================

// Actualizar CrearConductorConAbonoRequest para incluir plaza
export interface CrearConductorConAbonoRequestActualizado extends Omit<CrearConductorConAbonoRequest, 'abono'> {
  abono: {
    est_id: number;
    tipoAbono: TipoAbono;
    fechaInicio: string;
    fechaFin: string;
    plaza: {
      pla_numero: number;
      est_id: number;
    };
  };
}

// ===============================
// TIPOS PARA EXTENSIÓN DE ABONOS
// ===============================

export type TipoExtension = TipoAbono

export interface AbonoData {
  abo_nro: number
  titular: string
  tipoActual: string
  fechaFinActual: string
  zona: string
  codigo: string
  est_id: number
  pla_numero: number
  plantilla_id: number
}

export interface ExtensionState {
  tipoExtension: TipoExtension
  cantidad: number
  desde: string
  nuevoVencimiento: string
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia'
  monto: number
  nota: string
  tarjeta: { numero: string; vencimiento: string; cvv: string }
  loading: boolean
  calculating: boolean
}

// Actualizar CrearConductorConAbonoResponse para incluir plaza asignada
export interface CrearConductorConAbonoResponseActualizado extends Omit<CrearConductorConAbonoResponse, 'data'> {
  data: {
    usuario_id: number;
    conductor_id: number;
    vehiculo_ids: string[];
    abonado_id: number;
    abono_nro: number;
    plaza_asignada: {
      pla_numero: number;
      est_id: number;
    };
    abono: any;
  };
}

// ========================================
// TIPOS PARA SISTEMA DE RESERVAS
// ========================================

export type EstadoReserva =
  | 'pendiente_pago'
  | 'pendiente_confirmacion_operador'
  | 'confirmada'
  | 'activa'
  | 'completada'
  | 'cancelada'
  | 'expirada'
  | 'no_show';

export interface Reserva {
  est_id: number;
  pla_numero: number;
  veh_patente: string;
  res_fh_ingreso: string;
  res_fh_fin: string;
  con_id: number;
  pag_nro: number | null;
  res_estado: EstadoReserva;
  res_monto: number;
  res_tiempo_gracia_min: number;
  res_created_at: string;
  res_codigo: string;
  metodo_pago?: 'link_pago' | 'qr';
  payment_info?: {
    // Para MercadoPago
    preference_id?: string;
    init_point?: string;
    sandbox_init_point?: string;

    // Para QR
    qr_code?: string;
    qr_code_image?: string;

    // Para transferencia
    transfer_data?: {
      cbu: string;
      alias: string;
      account_holder: string;
      bank?: string;
      reference: string;
    };
  } | null;
}

export interface CrearReservaRequest {
  est_id: number;
  pla_numero: number;
  veh_patente: string;
  fecha_inicio: string; // ISO string
  duracion_horas: number;
  metodo_pago: 'link_pago' | 'qr';
}

export interface ReservaConDetalles extends Reserva {
  estacionamiento: {
    est_nombre: string;
    est_direc: string;
    est_telefono?: string;
    est_email?: string;
  };
  plaza: {
    pla_zona: string;
    catv_segmento: string;
  };
  vehiculo: {
    veh_marca: string;
    veh_modelo: string;
    veh_color: string;
  };
  conductor: {
    usu_nom: string;
    usu_ape: string;
    usu_tel: string;
    usu_email: string;
  };
  ocupacion?: {
    ocu_id: number;
    ocu_fh_entrada: string;
    ocu_fh_salida: string | null;
  } | null;
  vehiculos?: VehiculoDB[]; // Todos los vehículos del conductor
}

export interface PlazaDisponible {
  pla_numero: number;
  pla_zona: string;
  catv_segmento: string;
  precio_por_hora: number;
  plantilla_id: number;
}

export interface DisponibilidadResponse {
  success: boolean;
  data?: {
    plazas: PlazaDisponible[];
    fecha_inicio: string;
    fecha_fin: string;
    duracion_horas: number;
  };
  error?: string;
}

export interface CrearReservaResponse {
  success: boolean;
  data?: {
    reserva?: Reserva; // Opcional: solo si la reserva ya fue creada en BD
    reserva_temporal?: {
      est_id: number;
      pla_numero: number;
      veh_patente: string;
      res_codigo: string;
      res_fh_ingreso: string;
      res_fh_fin: string;
      con_id: number;
      res_monto: number;
      res_tiempo_gracia_min: number;
      metodo_pago: string;
    };
    payment_info?: {
      // Para MercadoPago
      preference_id?: string;
      init_point?: string;
      sandbox_init_point?: string;

      // Para QR
      qr_code?: string;
      qr_code_image?: string;

      // Para transferencia
      transfer_data?: {
        cbu: string;
        alias: string;
        account_holder: string;
        bank?: string;
        reference: string;
      };
    };
  };
  error?: string;
}

// Interfaz extendida para respuestas de pago más detalladas
export interface CrearReservaConPagoResponse extends CrearReservaResponse {
  data?: {
    reserva: Reserva;
    pago: {
      preference_id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      qr_code?: string;
      qr_code_image?: string;
      datos_bancarios?: {
        cbu: string;
        alias: string;
        titular: string;
        banco: string;
        referencia: string;
      };
    };
  };
}

// Interfaz para el webhook de MercadoPago
export interface MercadoPagoWebhookData {
  id: string;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: string;
  user_id: string;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// Interfaz para respuestas del webhook de procesamiento de pago
export interface ProcesarPagoResponse {
  success: boolean;
  message?: string;
  reserva_codigo?: string;
  nuevo_estado?: EstadoReserva;
  error?: string;
  details?: string;
}

// Interfaz para respuestas de expiración automática
export interface ExpirarReservasResponse {
  success: boolean;
  message?: string;
  reservas_expiradas?: number;
  total_no_show?: number;
  timestamp?: string;
  error?: string;
  details?: string;
}

export interface BuscarReservaResponse {
  success: boolean;
  data?: ReservaConDetalles;
  error?: string;
}

export interface ConfirmarLlegadaRequest {
  res_codigo: string;
  est_id: number;
}

export interface ConfirmarLlegadaResponse {
  success: boolean;
  data?: {
    reserva: Reserva;
    ocupacion_id: number;
    mensaje: string;
  };
  error?: string;
}

export interface ReservasOperadorResponse {
  success: boolean;
  data?: {
    reservas: ReservaConDetalles[];
    total: number;
    filtros: {
      fecha: string;
      estado?: EstadoReserva;
    };
  };
  error?: string;
}

export interface MisReservasResponse {
  success: boolean;
  data?: {
    activas: ReservaConDetalles[];
    futuras: ReservaConDetalles[];
    historial: ReservaConDetalles[];
  };
  error?: string;
}

