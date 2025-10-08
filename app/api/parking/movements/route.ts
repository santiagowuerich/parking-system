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
        plazas!inner(
          pla_zona,
          est_id
        ),
        pagos(
          pag_monto,
          mepa_metodo
        )
      `)
      .eq('plazas.est_id', estId)
      .order('ocu_fh_entrada', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Error fetching movements:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match the expected format
    const formattedMovements = movements?.map(movement => {
      const isEntry = !movement.ocu_fh_salida;
      const timestamp = movement.ocu_fh_salida || movement.ocu_fh_entrada;

      // Obtener información de pago si existe
      const payment = movement.pagos && Array.isArray(movement.pagos) && movement.pagos.length > 0
        ? movement.pagos[0]
        : null;

      // Formatear tarifa basada en el tipo de duración y precio acordado
      let tarifaBase = '';
      if (movement.ocu_duracion_tipo && movement.ocu_precio_acordado) {
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
      if (movement.ocu_fh_salida) {
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
      if (movement.ocu_fh_salida) {
        if (payment?.pag_monto) {
          totalPagado = `$${payment.pag_monto.toLocaleString('es-AR')}`;
        } else if (movement.ocu_precio_acordado) {
          totalPagado = `$${movement.ocu_precio_acordado.toLocaleString('es-AR')}`;
        } else {
          totalPagado = '$1,200'; // Fallback
        }
      }

      return {
        id: movement.ocu_id,
        fecha_ingreso: movement.ocu_fh_entrada,
        fecha_egreso: movement.ocu_fh_salida,
        license_plate: movement.veh_patente,
        action: isEntry ? 'Ingreso' : 'Egreso',
        zona: movement.plazas?.pla_zona || 'N/A',
        plaza: movement.pla_numero ? `P${movement.pla_numero.toString().padStart(3, '0')}` : 'Sin asignar',
        method: metodoPago,
        tarifa: tarifaBase,
        total: totalPagado
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