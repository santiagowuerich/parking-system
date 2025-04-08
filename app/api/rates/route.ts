import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";

// GET: Obtener tarifas del usuario
export async function GET(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Se requiere ID de usuario" }, { status: 400 });
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

  try {
    const { data, error } = await supabase
      .from("user_rates")
      .select("vehicle_type, rate")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching rates:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Si no hay tarifas configuradas, usar valores por defecto
    const defaultRates = {
      Auto: 1000,
      Moto: 500,
      Camioneta: 1500,
    };

    // Si no hay datos, devolver valores por defecto
    if (!data || data.length === 0) {
      const jsonResponse = NextResponse.json({ rates: defaultRates });
      response.cookies.getAll().forEach(cookie => {
        const { name, value, ...options } = cookie
        jsonResponse.cookies.set({ name, value, ...options })
      })
      return jsonResponse;
    }

    // Convertir el array a un objeto
    const rates = data.reduce((acc: Record<string, number>, curr: { vehicle_type: string; rate: number }) => {
      acc[curr.vehicle_type] = curr.rate;
      return acc;
    }, {});

    const jsonResponse = NextResponse.json({
      rates: {
        Auto: rates.Auto || defaultRates.Auto,
        Moto: rates.Moto || defaultRates.Moto,
        Camioneta: rates.Camioneta || defaultRates.Camioneta,
      }
    });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error fetching rates:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// POST: Actualizar tarifas del usuario
export async function POST(request: NextRequest) {
  try {
    const { userId, rates } = await request.json();

    if (!userId || !rates) {
      return NextResponse.json({ error: "Se requiere ID de usuario y tarifas" }, { status: 400 });
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

    // Primero eliminar las tarifas existentes
    const { error: deleteError } = await supabase
      .from("user_rates")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing rates:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Preparar los datos para insertar
    const ratesToInsert = Object.entries(rates).map(([vehicle_type, rate]) => ({
      user_id: userId,
      vehicle_type,
      rate: Number(rate)
    }));

    // Insertar las nuevas tarifas
    const { error: insertError } = await supabase
      .from("user_rates")
      .insert(ratesToInsert);

    if (insertError) {
      console.error("Error updating rates:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true, rates });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error updating rates:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 