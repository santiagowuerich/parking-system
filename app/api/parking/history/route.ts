// app/api/parking/history/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const userId = new URL(request.url).searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

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

    const { data, error } = await supabase
      .from("parking_history")
      .select("*")
      .eq("user_id", userId)
      .order("exit_time", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Asegurarse de que data sea un arreglo
    const historyData = Array.isArray(data) ? data : [];
    
    const jsonResponse = NextResponse.json({ history: historyData });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error fetching history:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
