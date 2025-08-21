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

    // 1) Localizar UNA sola ocupación abierta y cerrarla de forma segura
    // Primero buscamos la ocupación abierta más reciente que coincida con matrícula y hora de entrada
    let targetOcuId: number | null = null;
    {
      let findOpen = supabase
        .from('ocupacion')
        .select('ocu_id')
        .eq('veh_patente', license_plate)
        .eq('ocu_fh_entrada', entry_time)
        .is('ocu_fh_salida', null)
        .order('ocu_id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reqEstId) {
        // @ts-ignore
        findOpen = findOpen.eq('est_id', reqEstId)
      }
      const { data: openByExact, error: openExactErr } = await findOpen;

      if (openExactErr && openExactErr.code !== 'PGRST116') {
        console.warn('No se pudo encontrar ocupación exacta por entrada; intentando por última abierta de esa patente', openExactErr);
      }

      if (openByExact?.ocu_id) {
        targetOcuId = openByExact.ocu_id as unknown as number;
      } else {
        // fallback: última ocupación abierta por esa patente
        let findAny = supabase
          .from('ocupacion')
          .select('ocu_id')
          .eq('veh_patente', license_plate)
          .is('ocu_fh_salida', null)
          .order('ocu_id', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (reqEstId) {
          // @ts-ignore
          findAny = findAny.eq('est_id', reqEstId)
        }
        const { data: anyOpen } = await findAny;
        if (anyOpen?.ocu_id) targetOcuId = anyOpen.ocu_id as unknown as number;
      }
    }

    if (!targetOcuId) {
      console.error('No se encontró ocupación abierta para cerrar', { license_plate, entry_time, est_id: reqEstId });
      return NextResponse.json({ error: 'Ocupación no encontrada para registrar pago' }, { status: 500 });
    }

    const { error: closeError } = await supabase
      .from('ocupacion')
      .update({ ocu_fh_salida: exit_time })
      .eq('ocu_id', targetOcuId);

    if (closeError) {
      console.error("Error al cerrar ocupación:", closeError);
      return NextResponse.json({ error: closeError.message }, { status: 500 });
    }

    // 2) Obtener datos de ESA ocupación ya cerrada (usamos ocu_id)
    const { data: ocupacionRow, error: fetchOcuError } = await supabase
      .from('ocupacion')
      .select('est_id, veh_patente, pla_numero, ocu_fh_entrada, ocu_id')
      .eq('ocu_id', targetOcuId)
      .maybeSingle();

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

    // 5) Enlazar pago a la ocupación cerrada usando ocu_id (más confiable que pla_numero)
    const { error: linkError } = await supabase
      .from('ocupacion')
      .update({ pag_nro: pago.pag_nro })
      .eq('ocu_id', ocupacionRow.ocu_id);

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