// lib/services/ticket-service.ts
// Servicio para la generación y gestión de tickets de estacionamiento

import { supabase } from '@/lib/supabase';
import {
  ParkingTicket,
  GenerateTicketRequest,
  GenerateTicketResponse,
  TicketOptions,
  TicketFormat,
  TicketSearchParams,
  TicketSearchResponse,
  TicketDBRecord,
  formatDuration,
  generateTicketId,
} from '@/lib/types/ticket';
import { VehicleType, PaymentMethod, PaymentStatus } from '@/lib/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Mapeo de tipos de vehículo de BD a frontend
 */
const vehicleTypeMap: Record<string, VehicleType> = {
  AUT: 'Auto',
  MOT: 'Moto',
  CAM: 'Camioneta',
};

/**
 * Mapeo de métodos de pago de BD a frontend
 * En BD se guardan: 'Efectivo', 'Tarjeta', 'MercadoPago', 'Transferencia'
 * En frontend se usan: 'efectivo', 'transferencia', 'link_pago', 'qr'
 */
const paymentMethodMap: Record<string, PaymentMethod> = {
  // Valores en minúsculas (por si acaso)
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  link_pago: 'link_pago',
  qr: 'qr',
  // Valores como se guardan en la BD (con mayúscula)
  Efectivo: 'efectivo',
  Transferencia: 'transferencia',
  MercadoPago: 'qr', // MercadoPago en BD puede ser QR o Link de Pago, lo mapeamos a 'qr'
  Tarjeta: 'efectivo', // Tarjeta no tiene equivalente exacto, lo dejamos como efectivo
};

/**
 * Servicio de tickets de estacionamiento
 */
export class TicketService {
  /**
   * Genera un ticket de estacionamiento consolidando datos de múltiples fuentes
   */
  static async generateTicket(
    request: GenerateTicketRequest
  ): Promise<GenerateTicketResponse> {
    try {
      const { paymentId, occupationId, format = 'reduced', generatedBy, notes, paymentMethod } = request;

      // 1. Obtener datos de la ocupación
      const occupationData = await this.getOccupationData(occupationId);
      if (!occupationData) {
        return {
          success: false,
          error: 'Ocupación no encontrada',
          details: `No se encontró la ocupación con ID ${occupationId}`,
        };
      }

      // 2. Obtener datos del estacionamiento
      const parkingData = await this.getParkingData(occupationData.est_id);
      if (!parkingData) {
        return {
          success: false,
          error: 'Estacionamiento no encontrado',
          details: `No se encontró el estacionamiento con ID ${occupationData.est_id}`,
        };
      }

      // 3. Obtener datos del pago (si existe)
      let paymentData = null;
      if (paymentId || occupationData.pag_nro) {
        const pId = paymentId || occupationData.pag_nro;
        paymentData = await this.getPaymentData(pId);
      }

      // 4. Obtener datos del vehículo
      const vehicleData = await this.getVehicleData(occupationData.veh_patente);

      // 5. Obtener datos del conductor (si existe)
      let conductorData = null;
      if (vehicleData?.con_id) {
        conductorData = await this.getConductorData(vehicleData.con_id);
      }

      // 6. Obtener datos de la plaza (si existe)
      let plazaData = null;
      if (occupationData.pla_numero) {
        plazaData = await this.getPlazaData(
          occupationData.est_id,
          occupationData.pla_numero
        );
      }

      // 7. Calcular duración
      // Las fechas en BD están como strings "YYYY-MM-DD HH:mm:ss" sin zona horaria
      // Se interpretan como hora de Argentina, no como hora local del servidor
      const entryTime = occupationData.ocu_fh_entrada
        ? dayjs.tz(occupationData.ocu_fh_entrada, ARGENTINA_TIMEZONE)
        : dayjs().tz(ARGENTINA_TIMEZONE);
      const exitTime = occupationData.ocu_fh_salida
        ? dayjs.tz(occupationData.ocu_fh_salida, ARGENTINA_TIMEZONE)
        : dayjs().tz(ARGENTINA_TIMEZONE);
      const durationMs = exitTime.diff(entryTime);
      const duration = formatDuration(durationMs);

      // 8. Generar ID de ticket único
      const ticketId = await this.getNextTicketId();

      // 9. Construir el modelo de ticket
      const ticket: ParkingTicket = {
        // Identificadores
        ticketId,
        paymentId: paymentData?.pag_nro || paymentId || '',
        occupationId,

        // Estacionamiento
        parkingId: parkingData.est_id,
        parkingName: parkingData.est_nombre,
        parkingAddress: parkingData.est_direc,
        parkingPhone: parkingData.est_telefono || undefined,
        parkingEmail: parkingData.est_email || undefined,
        plazaNumber: occupationData.pla_numero || undefined,
        zone: plazaData?.pla_zona || undefined,

        // Vehículo
        vehicleLicensePlate: occupationData.veh_patente,
        vehicleType: vehicleTypeMap[vehicleData?.catv_segmento || 'AUT'] || 'Auto',
        vehicleBrand: vehicleData?.veh_marca || undefined,
        vehicleModel: vehicleData?.veh_modelo || undefined,
        vehicleColor: vehicleData?.veh_color || undefined,

        // Tiempos
        // Guardar como ISO string en UTC, pero preservando la hora de Argentina
        entryTime: entryTime.utc().toISOString(),
        exitTime: exitTime.utc().toISOString(),
        duration,

        // Pago
        // Priorizar el método de pago del request, luego el de la BD
        payment: {
          amount: paymentData?.pag_monto || occupationData.ocu_precio_acordado || 0,
          method: paymentMethod || paymentMethodMap[paymentData?.mepa_metodo || 'efectivo'] || 'efectivo',
          status: (paymentData?.pag_estado as PaymentStatus) || 'aprobado',
          date: paymentData?.pag_h_fh
            ? new Date(paymentData.pag_h_fh).toISOString()
            : new Date().toISOString(),
          currency: 'ARS',
          referenceId: paymentData?.pag_nro?.toString() || undefined,
        },

        // Conductor (opcional)
        // Priorizar teléfono de la ocupación si está disponible, sino usar el del conductor
        conductor: conductorData || occupationData.ocu_telefono
          ? {
              name: conductorData ? `${conductorData.usu_nom} ${conductorData.usu_ape}` : 'Cliente',
              email: conductorData?.usu_email,
              phone: occupationData.ocu_telefono || conductorData?.usu_tel || undefined,
            }
          : undefined,

        // Reserva (verificar si existe)
        isReservation: false, // TODO: verificar si viene de una reserva
        reservationCode: undefined,

        // Abono (verificar si existe)
        isSubscription: !!occupationData.ocu_duracion_tipo?.includes('abono'),
        subscriptionNumber: undefined,

        // Metadatos
        generatedAt: new Date().toISOString(),
        generatedBy,
        status: 'generated',
        format,
        notes: notes || undefined,
      };

      // 10. Almacenar ticket en BD
      const stored = await this.storeTicket(ticket);
      if (!stored) {
        console.warn('⚠️ No se pudo almacenar el ticket en BD, pero se generó correctamente');
      }

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error('❌ Error generando ticket:', error);
      return {
        success: false,
        error: 'Error interno al generar el ticket',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Obtiene el siguiente ID de ticket secuencial
   */
  private static async getNextTicketId(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('get_next_ticket_number');

      if (error || !data) {
        // Fallback: generar ID aleatorio
        return generateTicketId();
      }

      return data;
    } catch {
      return generateTicketId();
    }
  }

  /**
   * Obtiene datos de la ocupación
   */
  private static async getOccupationData(occupationId: number) {
    const { data, error } = await supabase
      .from('ocupacion')
      .select('*')
      .eq('ocu_id', occupationId)
      .single();

    if (error) {
      console.error('Error obteniendo ocupación:', error);
      return null;
    }

    return data;
  }

  /**
   * Obtiene datos del estacionamiento
   */
  private static async getParkingData(estId: number) {
    const { data, error } = await supabase
      .from('estacionamientos')
      .select('est_id, est_nombre, est_direc, est_telefono, est_email')
      .eq('est_id', estId)
      .single();

    if (error) {
      console.error('Error obteniendo estacionamiento:', error);
      return null;
    }

    return data;
  }

  /**
   * Obtiene datos del pago
   */
  private static async getPaymentData(paymentId: string | number) {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('pag_nro', paymentId)
      .single();

    if (error) {
      console.error('Error obteniendo pago:', error);
      return null;
    }

    return data;
  }

  /**
   * Obtiene datos del vehículo
   */
  private static async getVehicleData(patente: string) {
    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('veh_patente', patente)
      .single();

    if (error) {
      console.error('Error obteniendo vehículo:', error);
      return null;
    }

    return data;
  }

  /**
   * Obtiene datos del conductor
   */
  private static async getConductorData(conId: number) {
    const { data, error } = await supabase
      .from('usuario')
      .select('usu_nom, usu_ape, usu_email, usu_tel')
      .eq('usu_id', conId)
      .single();

    if (error) {
      console.error('Error obteniendo conductor:', error);
      return null;
    }

    return data;
  }

  /**
   * Obtiene datos de la plaza
   */
  private static async getPlazaData(estId: number, plaNumero: number) {
    const { data, error } = await supabase
      .from('plazas')
      .select('pla_zona, catv_segmento')
      .eq('est_id', estId)
      .eq('pla_numero', plaNumero)
      .single();

    if (error) {
      console.error('Error obteniendo plaza:', error);
      return null;
    }

    return data;
  }

  /**
   * Almacena el ticket en la base de datos
   */
  private static async storeTicket(ticket: ParkingTicket): Promise<boolean> {
    const record: Omit<TicketDBRecord, 'created_at'> = {
      ticket_id: ticket.ticketId,
      payment_id: typeof ticket.paymentId === 'number' ? ticket.paymentId : null,
      occupation_id: ticket.occupationId && ticket.occupationId > 0 ? ticket.occupationId : null, // Permitir null para extensiones de abono
      est_id: ticket.parkingId,
      ticket_data: ticket,
      printed_at: ticket.printedAt || null,
      sent_at: ticket.sentAt || null,
      format: ticket.format,
      status: ticket.status,
      generated_by: ticket.generatedBy,
    };

    const { error } = await supabase.from('tickets').insert(record);

    if (error) {
      console.error('Error almacenando ticket:', error);
      return false;
    }

    return true;
  }

  /**
   * Obtiene un ticket por su ID
   */
  static async getTicketById(ticketId: string): Promise<ParkingTicket | null> {
    const { data, error } = await supabase
      .from('tickets')
      .select('ticket_data')
      .eq('ticket_id', ticketId)
      .single();

    if (error || !data) {
      console.error('Error obteniendo ticket:', error);
      return null;
    }

    return data.ticket_data as ParkingTicket;
  }

  /**
   * Obtiene tickets por ocupación
   */
  static async getTicketsByOccupation(occupationId: number): Promise<ParkingTicket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select('ticket_data')
      .eq('occupation_id', occupationId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error obteniendo tickets:', error);
      return [];
    }

    return data.map((row) => row.ticket_data as ParkingTicket);
  }

  /**
   * Busca tickets con filtros
   */
  static async searchTickets(params: TicketSearchParams): Promise<TicketSearchResponse> {
    try {
      let query = supabase.from('tickets').select('ticket_data', { count: 'exact' });

      if (params.ticketId) {
        query = query.eq('ticket_id', params.ticketId);
      }
      if (params.occupationId) {
        query = query.eq('occupation_id', params.occupationId);
      }
      if (params.paymentId) {
        query = query.eq('payment_id', params.paymentId);
      }
      if (params.estId) {
        query = query.eq('est_id', params.estId);
      }
      if (params.status) {
        query = query.eq('status', params.status);
      }
      if (params.format) {
        query = query.eq('format', params.format);
      }
      if (params.dateFrom) {
        query = query.gte('created_at', params.dateFrom);
      }
      if (params.dateTo) {
        query = query.lte('created_at', params.dateTo);
      }
      if (params.vehiclePlate) {
        query = query.ilike('ticket_data->>vehicleLicensePlate', `%${params.vehiclePlate}%`);
      }

      query = query.order('created_at', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }
      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: 'Error buscando tickets',
        };
      }

      return {
        success: true,
        tickets: data?.map((row) => row.ticket_data as ParkingTicket) || [],
        total: count || 0,
      };
    } catch (error) {
      console.error('Error en búsqueda de tickets:', error);
      return {
        success: false,
        error: 'Error interno en búsqueda',
      };
    }
  }

  /**
   * Marca un ticket como impreso
   */
  static async markAsPrinted(ticketId: string): Promise<boolean> {
    const { error } = await supabase
      .from('tickets')
      .update({
        printed_at: new Date().toISOString(),
        status: 'printed',
      })
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('Error marcando ticket como impreso:', error);
      return false;
    }

    return true;
  }

  /**
   * Marca un ticket como enviado
   */
  static async markAsSent(ticketId: string): Promise<boolean> {
    const { error } = await supabase
      .from('tickets')
      .update({
        sent_at: new Date().toISOString(),
        status: 'sent',
      })
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('Error marcando ticket como enviado:', error);
      return false;
    }

    return true;
  }

  /**
   * Genera un ticket para extensión de abono (sin ocupación)
   */
  static async generateSubscriptionExtensionTicket(
    request: {
      paymentId: string | number;
      abo_nro: number;
      est_id: number;
      veh_patente: string;
      generatedBy: string;
      paymentMethod?: 'efectivo' | 'transferencia' | 'qr' | 'link_pago';
      format?: TicketFormat;
      notes?: string;
    }
  ): Promise<GenerateTicketResponse> {
    try {
      const { paymentId, abo_nro, est_id, veh_patente, generatedBy, format = 'reduced', notes, paymentMethod } = request;

      // 1. Obtener datos del pago
      const paymentData = await this.getPaymentData(paymentId);
      if (!paymentData) {
        return {
          success: false,
          error: 'Pago no encontrado',
          details: `No se encontró el pago con ID ${paymentId}`,
        };
      }

      // 2. Obtener datos del estacionamiento
      const parkingData = await this.getParkingData(est_id);
      if (!parkingData) {
        return {
          success: false,
          error: 'Estacionamiento no encontrado',
          details: `No se encontró el estacionamiento con ID ${est_id}`,
        };
      }

      // 3. Obtener datos del abono (con conductor y plaza)
      const { data: abonoData, error: abonoError } = await supabase
        .from('abonos')
        .select(`
          abo_nro,
          abo_fecha_inicio,
          abo_fecha_fin,
          abo_tipoabono,
          pla_numero,
          abonado!inner(con_id, abon_nombre, abon_apellido, abon_dni),
          plazas(pla_zona)
        `)
        .eq('abo_nro', abo_nro)
        .single();

      if (abonoError || !abonoData) {
        return {
          success: false,
          error: 'Abono no encontrado',
          details: `No se encontró el abono con número ${abo_nro}`,
        };
      }

      // 4. Obtener datos del conductor
      const conductorId = (abonoData as any)?.abonado?.con_id;
      let conductorData = null;
      if (conductorId) {
        conductorData = await this.getConductorData(conductorId);
      }

      // 5. Obtener datos del vehículo
      const vehicleData = await this.getVehicleData(veh_patente);

      // 6. Obtener datos de la plaza
      let plazaData = null;
      const plaNumero = abonoData.pla_numero;
      if (plaNumero) {
        plazaData = await this.getPlazaData(est_id, plaNumero);
      }

      // 7. Generar ID de ticket único
      const ticketId = await this.getNextTicketId();

      // 8. Construir el modelo de ticket
      const ticket: ParkingTicket = {
        // Identificadores
        ticketId,
        paymentId: paymentData.pag_nro,
        occupationId: 0, // No hay ocupación para extensiones de abono

        // Estacionamiento
        parkingId: parkingData.est_id,
        parkingName: parkingData.est_nombre,
        parkingAddress: parkingData.est_direc,
        parkingPhone: parkingData.est_telefono || undefined,
        parkingEmail: parkingData.est_email || undefined,
        plazaNumber: plaNumero || undefined,
        zone: plazaData?.pla_zona || undefined,

        // Vehículo
        vehicleLicensePlate: veh_patente,
        vehicleType: vehicleTypeMap[vehicleData?.catv_segmento || 'AUT'] || 'Auto',
        vehicleBrand: vehicleData?.veh_marca || undefined,
        vehicleModel: vehicleData?.veh_modelo || undefined,
        vehicleColor: vehicleData?.veh_color || undefined,

        // Tiempos (para extensión, usamos fechas del abono)
        entryTime: abonoData.abo_fecha_inicio,
        exitTime: abonoData.abo_fecha_fin,
        duration: {
          hours: 0,
          minutes: 0,
          formatted: 'Extensión de abono',
        },

        // Pago
        payment: {
          amount: paymentData.pag_monto || 0,
          method: paymentMethod || paymentMethodMap[paymentData?.mepa_metodo || 'efectivo'] || 'efectivo',
          status: (paymentData.pag_estado as PaymentStatus) || 'aprobado',
          date: paymentData.pag_h_fh
            ? new Date(paymentData.pag_h_fh).toISOString()
            : new Date().toISOString(),
          currency: 'ARS',
          referenceId: paymentData.pag_nro?.toString() || undefined,
        },

        // Conductor
        conductor: conductorData
          ? {
              name: `${conductorData.usu_nom} ${conductorData.usu_ape}`,
              email: conductorData.usu_email,
              phone: conductorData.usu_tel || undefined,
            }
          : undefined,

        // Reserva (no aplica)
        isReservation: false,
        reservationCode: undefined,

        // Abono (sí aplica)
        isSubscription: true,
        subscriptionNumber: abo_nro,

        // Metadatos
        generatedAt: new Date().toISOString(),
        generatedBy,
        status: 'generated',
        format,
        notes: notes || `Extensión de abono ${abo_nro}`,
      };

      // 9. Almacenar ticket en BD
      const stored = await this.storeTicket(ticket);
      if (!stored) {
        console.warn('⚠️ No se pudo almacenar el ticket en BD, pero se generó correctamente');
      }

      return {
        success: true,
        ticket,
      };
    } catch (error) {
      console.error('❌ Error generando ticket de extensión:', error);
      return {
        success: false,
        error: 'Error interno al generar el ticket',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Cancela un ticket
   */
  static async cancelTicket(ticketId: string): Promise<boolean> {
    const { error } = await supabase
      .from('tickets')
      .update({
        status: 'cancelled',
      })
      .eq('ticket_id', ticketId);

    if (error) {
      console.error('Error cancelando ticket:', error);
      return false;
    }

    return true;
  }
}

export default TicketService;

