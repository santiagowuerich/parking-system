import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { res_codigo: string } }
) {
  try {
    const supabase = await createAuthenticatedSupabaseClient();
    const res_codigo = params.res_codigo;

    console.log(`📋 [RESERVA-DETALLE] Obteniendo reserva: ${res_codigo}`);

    // Obtener datos de la reserva
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select(`
        res_codigo,
        res_monto,
        res_estado,
        res_fh_ingreso,
        res_fh_fin,
        veh_patente,
        con_id,
        est_id,
        pla_numero
      `)
      .eq('res_codigo', res_codigo)
      .single();

    if (reservaError || !reserva) {
      console.error(`❌ [RESERVA-DETALLE] Reserva no encontrada: ${res_codigo}`);
      return NextResponse.json({
        success: false,
        error: 'Reserva no encontrada'
      }, { status: 404 });
    }

    console.log(`✅ [RESERVA-DETALLE] Reserva encontrada: ${res_codigo}`);

    // Obtener datos del conductor
    const { data: conductor, error: conductorError } = await supabase
      .from('usuario')
      .select('usu_id, usu_nom, usu_ape, usu_tel, usu_email')
      .eq('usu_id', reserva.con_id)
      .single();

    if (conductorError || !conductor) {
      console.error(`❌ [RESERVA-DETALLE] Conductor no encontrado: ${reserva.con_id}`);
    }

    // Obtener vehículos asociados a la patente de la reserva
    const { data: vehiculos, error: vehiculosError } = await supabase
      .from('vehiculos')
      .select('veh_patente, veh_marca, veh_modelo, veh_color, catv_segmento')
      .eq('veh_patente', reserva.veh_patente);

    if (vehiculosError) {
      console.error(`⚠️ [RESERVA-DETALLE] Error obteniendo vehículos:`, vehiculosError);
    }

    // Construir respuesta
    const response = {
      success: true,
      data: {
        res_codigo: reserva.res_codigo,
        res_monto: reserva.res_monto,
        res_estado: reserva.res_estado,
        res_fh_ingreso: reserva.res_fh_ingreso,
        res_fh_fin: reserva.res_fh_fin,
        veh_patente: reserva.veh_patente,
        con_id: reserva.con_id,
        est_id: reserva.est_id,
        pla_numero: reserva.pla_numero,
        conductor: conductor ? {
          usu_id: conductor.usu_id,
          usu_nom: conductor.usu_nom,
          usu_ape: conductor.usu_ape,
          usu_tel: conductor.usu_tel,
          usu_email: conductor.usu_email
        } : null,
        vehiculos: vehiculos || []
      }
    };

    console.log(`✅ [RESERVA-DETALLE] Datos completos obtenidos para: ${res_codigo}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [RESERVA-DETALLE] Error inesperado:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}
