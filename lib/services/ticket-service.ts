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
 */
const paymentMethodMap: Record<string, PaymentMethod> = {
  efectivo: 'efectivo',
  transferencia: 'transferencia',
  link_pago: 'link_pago',
  qr: 'qr',
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
      const { paymentId, occupationId, format = 'reduced', generatedBy, notes } = request;

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
      const entryTime = new Date(occupationData.ocu_fh_entrada);
      const exitTime = occupationData.ocu_fh_salida
        ? new Date(occupationData.ocu_fh_salida)
        : new Date();
      const durationMs = exitTime.getTime() - entryTime.getTime();
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
        entryTime: entryTime.toISOString(),
        exitTime: exitTime.toISOString(),
        duration,

        // Pago
        payment: {
          amount: paymentData?.pag_monto || occupationData.ocu_precio_acordado || 0,
          method: paymentMethodMap[paymentData?.mepa_metodo || 'efectivo'] || 'efectivo',
          status: (paymentData?.pag_estado as PaymentStatus) || 'aprobado',
          date: paymentData?.pag_h_fh
            ? new Date(paymentData.pag_h_fh).toISOString()
            : new Date().toISOString(),
          currency: 'ARS',
          referenceId: paymentData?.pag_nro?.toString() || undefined,
        },

        // Conductor (opcional)
        conductor: conductorData
          ? {
              name: `${conductorData.usu_nom} ${conductorData.usu_ape}`,
              email: conductorData.usu_email,
              phone: conductorData.usu_tel || undefined,
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
      occupation_id: ticket.occupationId,
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

