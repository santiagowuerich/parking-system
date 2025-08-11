import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { license_plate, entry_time, method, amount } = data;

    const { supabase, response } = createClient(request);
    const url = new URL(request.url)
    const reqEstId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || undefined

    // Obtener ocupación correspondiente por patente y hora de entrada
    let q = supabase
      .from("ocupacion")
      .select("ocu_id, est_id, veh_patente")
      .eq("veh_patente", license_plate)
      .eq("ocu_fh_entrada", entry_time)
    if (reqEstId) q = q.eq('est_id', reqEstId)
    const { data: ocupacionRow, error: ocuError } = await q.single();

    if (ocuError || !ocupacionRow) {
      console.error("Ocupación no encontrada para pago:", ocuError);
      return NextResponse.json({ error: "Ocupación no encontrada" }, { status: 400 });
    }

    // Normalizar método
    const normalizeMethod = (m: string): string => {
      const mm = m?.toLowerCase?.() || "";
      if (["efectivo", "cash"].includes(mm)) return "Efectivo";
      if (["transferencia", "transfer", "bank"].includes(mm)) return "Transferencia";
      if (["mercadopago", "mp"].includes(mm)) return "MercadoPago";
      return "Efectivo";
    };
    const metodo = normalizeMethod(method);

    // Registrar pago en nueva tabla
    const { data: payment, error } = await supabase
      .from("pagos")
      .insert([
        {
          pag_monto: amount,
          pag_h_fh: new Date().toISOString(),
          est_id: ocupacionRow.est_id,
          mepa_metodo: metodo,
          veh_patente: ocupacionRow.veh_patente,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error al registrar pago:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enlazar pago a ocupación
    const { error: linkError } = await supabase
      .from("ocupacion")
      .update({ pag_nro: payment.pag_nro })
      .eq("ocu_id", ocupacionRow.ocu_id);

    if (linkError) {
      console.error("Error al enlazar pago a ocupación:", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json(payment);
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al procesar pago:", error);
    return NextResponse.json(
      { error: "Error al procesar el pago" },
      { status: 500 }
    );
  }
} 