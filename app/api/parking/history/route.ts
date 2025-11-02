// app/api/parking/history/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // userId ya no es requerido en el nuevo esquema (compat: se ignora si se envía)
    new URL(request.url).searchParams.get("userId");

    // Crear la respuesta inicial
    let response = NextResponse.next()

    // Crear el cliente de Supabase
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            response.cookies.set({
              name,
              value,
              path: '/',
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              ...options
            })
          },
          remove(name) {
            response.cookies.set({
              name,
              value: '',
              path: '/',
              expires: new Date(0)
            })
          }
        }
      }
    )

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || undefined

    // Query ocupacion table with joins to get payment info AND plaza vehicle type
    let query = supabase
      .from("ocupacion")
      .select(`
        ocu_fh_entrada,
        ocu_fh_salida,
        pla_numero,
        veh_patente,
        pagos!inner (
          pag_nro,
          pag_monto,
          pag_h_fh,
          pag_tipo,
          abo_nro,
          mepa_metodo,
          est_id
        ),
        plazas!inner (
          catv_segmento,
          plantilla_id
        )
      `)
      .order("ocu_fh_salida", { ascending: false });

    if (estId) {
      // Filter by est_id in pagos table (where it's actually stored)
      query = query.eq('pagos.est_id', estId);
    }

    logger.debug(`Ejecutando query del historial con plaza info para est_id: ${estId}`);
    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching parking history with plaza info:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to match expected format, now including plaza information
    const historyData = Array.isArray(data)
      ? data.map((ocu: any) => ({
          entry_time: ocu.ocu_fh_entrada,
          exit_time: ocu.ocu_fh_salida,
          fee: ocu.pagos?.pag_monto || 0,
          pag_tipo: ocu.pagos?.pag_tipo,
          abo_nro: ocu.pagos?.abo_nro,
          mepa_metodo: ocu.pagos?.mepa_metodo,
          veh_patente: ocu.veh_patente,
          pla_numero: ocu.pla_numero,
          catv_segmento: ocu.plazas?.catv_segmento
        }))
      : [];
    logger.debug(`Historial con plaza info cargado: ${historyData.length} registros para est_id: ${estId}`);
    
    const jsonResponse = NextResponse.json({ history: historyData });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    logger.error("Unexpected error fetching history:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
