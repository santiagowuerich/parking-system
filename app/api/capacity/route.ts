import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";
import type { VehicleType } from "@/lib/types";

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
      .from("user_capacity")
      .select("vehicle_type, capacity")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching capacity:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Si no hay datos, devolver valores por defecto
    if (!data || data.length === 0) {
      const jsonResponse = NextResponse.json({
        capacity: {
          Auto: 0,
          Moto: 0,
          Camioneta: 0
        }
      });

      // Copiar las cookies de la respuesta temporal a la respuesta final
      response.cookies.getAll().forEach(cookie => {
        const { name, value, ...options } = cookie
        jsonResponse.cookies.set({ name, value, ...options })
      })

      return jsonResponse;
    }

    // Convertir el array a un objeto
    const capacity = data.reduce((acc: Record<string, number>, curr) => {
      acc[curr.vehicle_type] = curr.capacity;
      return acc;
    }, {});

    const jsonResponse = NextResponse.json({
      capacity: {
        Auto: capacity.Auto || 0,
        Moto: capacity.Moto || 0,
        Camioneta: capacity.Camioneta || 0,
      }
    });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error fetching capacity:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, capacity } = await request.json();

    if (!userId || !capacity) {
      return NextResponse.json({ error: "Se requiere ID de usuario y capacidad" }, { status: 400 });
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

    // Primero eliminamos los registros existentes para este usuario
    const { error: deleteError } = await supabase
      .from("user_capacity")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting existing capacity:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Preparar los datos para insertar
    const capacityToInsert = Object.entries(capacity).map(([vehicle_type, value]) => ({
      user_id: userId,
      vehicle_type,
      capacity: Number(value)
    }));

    // Insertar los nuevos registros
    const { error: insertError } = await supabase
      .from("user_capacity")
      .insert(capacityToInsert);

    if (insertError) {
      console.error("Error inserting capacity:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true, capacity });

    // Copiar las cookies de la respuesta temporal a la respuesta final
    response.cookies.getAll().forEach(cookie => {
      const { name, value, ...options } = cookie
      jsonResponse.cookies.set({ name, value, ...options })
    })

    return jsonResponse;
  } catch (err) {
    console.error("Unexpected error updating capacity:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 