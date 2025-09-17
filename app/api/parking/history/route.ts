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

    let query = supabase
      .from("vw_historial_estacionamiento")
      .select("*")
      .order("exit_time", { ascending: false })
    if (estId) {
      // si la vista expone est_id, aplicar filtro
      // @ts-ignore
      query = query.eq('est_id', estId)
    }
    logger.debug(`Ejecutando query del historial para est_id: ${estId}`);
    const { data, error } = await query

    if (error) {
      logger.error("Error fetching history:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Asegurarse de que data sea un arreglo
    const historyData = Array.isArray(data) ? data : [];
    logger.debug(`Historial cargado: ${historyData.length} registros para est_id: ${estId}`);
    
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
