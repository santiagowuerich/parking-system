import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  const cookieStore = await cookies();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Ignorar errores si se llama desde Server Component (no aplica aquí, pero es el patrón estándar)
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignorar errores si se llama desde Server Component
            }
          },
        },
      }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { error } = await supabase
      .from("parking_history")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error al eliminar registro:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al eliminar registro:", error);
    return NextResponse.json(
      { error: "Error al eliminar el registro" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const resolvedParams = await Promise.resolve(params);
  const cookieStore = await cookies();
  try {
    const historyId = resolvedParams.id;
    const requestBody = await request.json();
    const updates = requestBody.updates || {};
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // Ignorar
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // Ignorar
            }
          },
        },
      }
    );

    if (!historyId) {
      return NextResponse.json({ error: "Se requiere ID del registro" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("Actualizando registro con datos:", updates);

    const { data, error } = await supabase
      .from('parking_history')
      .update(updates)
      .eq('id', historyId)
      .eq('user_id', user.id) 
      .select()
      .single(); 

    if (error) {
      console.error("Error actualizando historial:", error);
      return NextResponse.json({ error: error.message || "Error al actualizar el registro" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Registro no encontrado o no autorizado" }, { status: 404 });
    }

    return NextResponse.json({ updatedEntry: data });
  } catch (error: any) {
    console.error("Error en PATCH /api/parking/history/[id]:", error);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
} 