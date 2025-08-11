// app/api/parking/parked/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // userId ya no es requerido en el nuevo esquema (se ignora si llega)
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

    let query = supabase.from("vw_ocupacion_actual").select("*")
    if (estId) {
      // si la vista expone est_id, aplicar filtro
      // @ts-ignore
      query = query.eq('est_id', estId)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching parked vehicles:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ parkedVehicles: data || [] });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error fetching parked vehicles:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
