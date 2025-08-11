import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

// Cierra la ocupación abierta y registra un pago en el nuevo esquema (ocupacion/pagos)
export async function POST(request: NextRequest) {
  try {
    const {
      license_plate,
      entry_time,
      exit_time,
      fee,
      payment_method,
    } = await request.json();

    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const reqEstId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || undefined

    // 1) Cerrar ocupación activa del vehículo
    let closeQuery = supabase
      .from("ocupacion")
      .update({
        ocu_fh_salida: exit_time,
      })
      .eq("veh_patente", license_plate)
      .eq("ocu_fh_entrada", entry_time)
      .is("ocu_fh_salida", null)
    if (reqEstId) {
      // @ts-ignore
      closeQuery = closeQuery.eq('est_id', reqEstId)
    }
    const { error: closeError } = await closeQuery

    if (closeError) {
      console.error("Error al cerrar ocupación:", closeError);
      return NextResponse.json({ error: closeError.message }, { status: 500 });
    }

    // 2) Obtener datos de la ocupación para armar el pago (est_id y veh_patente)
    let fetchQuery = supabase
      .from("ocupacion")
      .select("est_id, veh_patente, pla_numero, ocu_fh_entrada")
      .eq("veh_patente", license_plate)
      .eq("ocu_fh_entrada", entry_time)
    if (reqEstId) fetchQuery = fetchQuery.eq('est_id', reqEstId)
    const { data: ocupacionRow, error: fetchOcuError } = await fetchQuery.single();

    if (fetchOcuError || !ocupacionRow) {
      console.error("No se pudo obtener ocupación para pago:", fetchOcuError);
      return NextResponse.json({ error: "Ocupación no encontrada para registrar pago" }, { status: 500 });
    }

    // 3) Normalizar método de pago a catálogo
    const normalizeMethod = (method: string): string => {
      const m = method?.toLowerCase?.() || "";
      if (["efectivo", "cash"].includes(m)) return "Efectivo";
      if (["transferencia", "transfer", "bank"].includes(m)) return "Transferencia";
      if (["mercadopago", "mp"].includes(m)) return "MercadoPago";
      return "Efectivo";
    };

    const metodo = normalizeMethod(payment_method);

    // 4) Registrar pago
    const { data: pago, error: pagoError } = await supabase
      .from("pagos")
      .insert([
        {
          pag_monto: fee,
          pag_h_fh: exit_time,
          est_id: ocupacionRow.est_id,
          mepa_metodo: metodo,
          veh_patente: ocupacionRow.veh_patente,
        },
      ])
      .select()
      .single();

    if (pagoError) {
      console.error("Error al registrar pago:", pagoError);
      return NextResponse.json({ error: pagoError.message }, { status: 500 });
    }

    // 5) Enlazar pago a la ocupación cerrada
    const { error: linkError } = await supabase
      .from("ocupacion")
      .update({ pag_nro: pago.pag_nro })
      .eq("est_id", ocupacionRow.est_id)
      .eq("pla_numero", ocupacionRow.pla_numero)
      .eq("ocu_fh_entrada", ocupacionRow.ocu_fh_entrada);

    if (linkError) {
      console.error("Error al enlazar pago a ocupación:", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true, pago });
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error en la ruta POST /api/parking/log:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}