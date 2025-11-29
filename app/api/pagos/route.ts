// app/api/pagos/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
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
    const estId = Number(url.searchParams.get('est_id')) || undefined

    // Consultar directamente la tabla pagos
    let query = supabase
      .from("pagos")
      .select(`
        pag_nro,
        pag_monto,
        pag_h_fh,
        pag_tipo,
        abo_nro,
        mepa_metodo,
        veh_patente,
        est_id
      `)
      .order("pag_h_fh", { ascending: false });

    if (estId) {
      query = query.eq('est_id', estId);
    }

    query = query.eq('pag_estado', 'completado');

    logger.debug(`Ejecutando query de pagos para est_id: ${estId}`);
    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching payments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transformar para compatibilidad con el componente
    const paymentsData = Array.isArray(data)
      ? data.map((pago: any) => ({
          entry_time: null,
          exit_time: pago.pag_h_fh,
          fee: pago.pag_monto,
          pag_tipo: pago.pag_tipo,
          abo_nro: pago.abo_nro,
          mepa_metodo: pago.mepa_metodo
        }))
      : [];

    logger.debug(`Pagos cargados: ${paymentsData.length} registros para est_id: ${estId}`);

    const jsonResponse = NextResponse.json({ history: paymentsData });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    logger.error("Unexpected error fetching payments:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
