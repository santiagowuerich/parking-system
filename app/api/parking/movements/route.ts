import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1;
    const limit = Number(url.searchParams.get('limit')) || 20;

    // Query recent movements from ocupacion table with payment info
    const { data: movements, error } = await supabase
      .from('ocupacion')
      .select(`
        ocu_id,
        veh_patente,
        pla_numero,
        ocu_fh_entrada,
        ocu_fh_salida,
        ocu_precio_acordado,
        ocu_duracion_tipo,
        res_codigo,
        plazas!inner(
          pla_zona,
          est_id
        ),
        pagos(
          pag_nro,
          pag_monto,
          mepa_metodo,
          pag_descripcion
        )
      `)
      .eq('plazas.est_id', estId)
      .order('ocu_fh_entrada', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Obtener contador de movimientos para cada ocupación
    const movementCounts = new Map<number, number>();

    // Obtener todos los pagos de reservas para después hacer lookup rápido
    let reservaPayments: Record<string, any[]> = {};
    const reservaCodigos = movements
      ?.filter(m => m.res_codigo && m.ocu_duracion_tipo === 'reserva')
      .map(m => m.res_codigo) || [];

    if (reservaCodigos.length > 0) {
      // Buscar todos los pagos relacionados a estas reservas
      const { data: allReservaPagos } = await supabase
        .from('pagos')
        .select('pag_nro, pag_monto, pag_descripcion')
        .in('pag_descripcion', reservaCodigos.map(cod => `Pago de reserva ${cod}`));

      if (allReservaPagos) {
        allReservaPagos.forEach(pago => {
          // Extraer código de reserva de la descripción (formato: "Pago de reserva RES-XXXX-XXXX")
          const match = pago.pag_descripcion?.match(/RES-[\d\-]+/);
          if (match) {
            const resCode = match[0];
            if (!reservaPayments[resCode]) {
              reservaPayments[resCode] = [];
            }
            reservaPayments[resCode].push(pago);
          }
        });
      }
    }

    if (movements && movements.length > 0) {
      // Obtener todos los movimientos de vehículos para este estacionamiento
      const { data: vehicleMovements, error: vmError } = await supabase
        .from('vehicle_movements')
        .select('veh_patente, mov_fecha_hora')
        .eq('est_id', estId);

      if (!vmError && vehicleMovements) {
        // Contar movimientos por ocupación
        movements.forEach(ocu => {
          const count = vehicleMovements.filter(vm => {
            const isMatchingVehicle = vm.veh_patente === ocu.veh_patente;
            const isAfterEntry = new Date(vm.mov_fecha_hora) >= new Date(ocu.ocu_fh_entrada);
            const isBeforeExit = ocu.ocu_fh_salida
              ? new Date(vm.mov_fecha_hora) <= new Date(ocu.ocu_fh_salida)
              : true;

            return isMatchingVehicle && isAfterEntry && isBeforeExit;
          }).length;

          movementCounts.set(ocu.ocu_id, count);
        });
      }
    }

    // Transform data to match the expected format
    const formattedMovements = movements?.map(movement => {
      const isEntry = !movement.ocu_fh_salida;
      const timestamp = movement.ocu_fh_salida || movement.ocu_fh_entrada;

      // Obtener información de pago si existe
      const payment = movement.pagos && Array.isArray(movement.pagos) && movement.pagos.length > 0
        ? movement.pagos[0]
        : null;

      const duracionTipoLower = movement.ocu_duracion_tipo?.toLowerCase();
      const esAbono = duracionTipoLower === 'abono';

      // Formatear tarifa basada en el tipo de duración y precio acordado
      let tarifaBase = '';
      if (esAbono) {
        tarifaBase = 'Abono';
      } else if (movement.ocu_duracion_tipo && movement.ocu_precio_acordado) {
        const duracionTipo = movement.ocu_duracion_tipo.toLowerCase();
        const precioAcordado = `$${movement.ocu_precio_acordado.toLocaleString('es-AR')}`;

        if (duracionTipo === 'hora') {
          tarifaBase = `${precioAcordado}/h`;
        } else if (duracionTipo === 'dia') {
          tarifaBase = `${precioAcordado}/día`;
        } else if (duracionTipo === 'semana') {
          tarifaBase = `${precioAcordado}/sem`;
        } else if (duracionTipo === 'mes') {
          tarifaBase = `${precioAcordado}/mes`;
        } else {
          tarifaBase = `${precioAcordado}/h`;
        }
      } else if (movement.ocu_duracion_tipo) {
        // Fallback a tarifas genéricas si no hay precio acordado
        const duracionTipo = movement.ocu_duracion_tipo.toLowerCase();
        if (duracionTipo === 'hora') {
          tarifaBase = '$1200/h';
        } else if (duracionTipo === 'dia') {
          tarifaBase = '$1500/día';
        } else if (duracionTipo === 'semana') {
          tarifaBase = '$8000/sem';
        } else if (duracionTipo === 'mes') {
          tarifaBase = '$25000/mes';
        } else {
          tarifaBase = '$1200/h';
        }
      } else {
        tarifaBase = '$1200/h';
      }

      // Determinar método de pago
      let metodoPago = '-';
      if (esAbono && movement.ocu_fh_salida) {
        metodoPago = 'Abono';
      } else if (movement.ocu_fh_salida) {
        if (payment?.mepa_metodo) {
          // Mapear nombres de métodos desde BD a nombres amigables
          metodoPago = payment.mepa_metodo === 'Efectivo' ? 'Efectivo' :
                      payment.mepa_metodo === 'Transferencia' ? 'Transferencia' :
                      payment.mepa_metodo === 'MercadoPago' ? 'QR' :
                      payment.mepa_metodo === 'Link de Pago' ? 'Link de Pago' :
                      payment.mepa_metodo;
        } else {
          metodoPago = 'Efectivo'; // Por defecto para egresos sin pago registrado
        }
      }

      // Determinar total pagado
      let totalPagado = '-';
      if (esAbono && movement.ocu_fh_salida) {
        totalPagado = 'Incluido';
      } else if (movement.ocu_fh_salida) {
        // Para ocupaciones tipo reserva, sumar TODOS los pagos (reserva + adicionales)
        if (movement.ocu_duracion_tipo === 'reserva' && movement.res_codigo && reservaPayments[movement.res_codigo]) {
          const totalMonto = reservaPayments[movement.res_codigo].reduce((sum, pago) => sum + (pago.pag_monto || 0), 0);
          totalPagado = `$${totalMonto.toLocaleString('es-AR')}`;
          console.log(`✅ [MOVIMIENTOS] Reserva ${movement.res_codigo}: Sumados ${reservaPayments[movement.res_codigo].length} pagos = $${totalMonto}`);
        } else if (payment?.pag_monto) {
          totalPagado = `$${payment.pag_monto.toLocaleString('es-AR')}`;
        } else if (movement.ocu_precio_acordado) {
          totalPagado = `$${movement.ocu_precio_acordado.toLocaleString('es-AR')}`;
        } else {
          totalPagado = '$1,200'; // Fallback
        }
      }

      return {
        id: movement.ocu_id,
        ocu_id: movement.ocu_id,
        fecha_ingreso: movement.ocu_fh_entrada,
        fecha_egreso: movement.ocu_fh_salida,
        license_plate: movement.veh_patente,
        action: isEntry ? 'Ingreso' : 'Egreso',
        zona: movement.plazas?.pla_zona || 'N/A',
        plaza: movement.pla_numero ? `P${movement.pla_numero.toString().padStart(3, '0')}` : 'Sin asignar',
        method: metodoPago,
        tarifa: tarifaBase,
        total: totalPagado,
        movement_count: movementCounts.get(movement.ocu_id) || 0
      };
    }) || [];

    const jsonResponse = NextResponse.json({
      success: true,
      data: formattedMovements
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error('❌ Error inesperado:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
