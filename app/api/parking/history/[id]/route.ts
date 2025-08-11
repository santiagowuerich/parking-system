import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // En el nuevo esquema, el historial proviene de 'ocupacion' con salida y su pago en 'pagos'.
    // Para borrar un historial, eliminamos la ocupación y su pago enlazado.
    const { data: ocu, error: fetchOcuError } = await supabase
      .from('ocupacion')
      .select('ocu_id, pag_nro')
      .eq('ocu_id', id)
      .single();

    if (fetchOcuError) {
      console.error('Error obteniendo ocupación para borrar:', fetchOcuError);
      return NextResponse.json({ error: fetchOcuError.message }, { status: 500 });
    }

    const { error: delOcuError } = await supabase
      .from('ocupacion')
      .delete()
      .eq('ocu_id', id);
    if (delOcuError) {
      console.error('Error eliminando ocupación:', delOcuError);
      return NextResponse.json({ error: delOcuError.message }, { status: 500 });
    }

    if (ocu?.pag_nro) {
      const { error: delPagoError } = await supabase
        .from('pagos')
        .delete()
        .eq('pag_nro', ocu.pag_nro);
      if (delPagoError) {
        console.error('Error eliminando pago asociado:', delPagoError);
        return NextResponse.json({ error: delPagoError.message }, { status: 500 });
      }
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: historyId } = await params;
  const cookieStore = await cookies();
  try {
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

    // En el nuevo esquema, solo permitimos actualizar ciertos campos en 'ocupacion' y 'pagos'
    let ocuUpdates: any = {};
    let pagoUpdates: any = {};
    if (updates.entry_time) ocuUpdates.ocu_fh_entrada = updates.entry_time;
    if (updates.exit_time) ocuUpdates.ocu_fh_salida = updates.exit_time;
    if (updates.fee !== undefined) pagoUpdates.pag_monto = updates.fee;
    if (updates.payment_method) pagoUpdates.mepa_metodo = updates.payment_method;

    let updated: any = {};

    if (Object.keys(ocuUpdates).length > 0) {
      const { data: dO, error: eO } = await supabase
        .from('ocupacion')
        .update(ocuUpdates)
        .eq('ocu_id', historyId)
        .select()
        .single();
      if (eO) {
        console.error('Error actualizando ocupación:', eO);
        return NextResponse.json({ error: eO.message }, { status: 500 });
      }
      updated = { ...updated, ...dO };
    }

    if (Object.keys(pagoUpdates).length > 0) {
      // Normalizar método si viene en formato diferente
      if (pagoUpdates.mepa_metodo) {
        const m = String(pagoUpdates.mepa_metodo).toLowerCase();
        if (["efectivo", "cash"].includes(m)) pagoUpdates.mepa_metodo = "Efectivo";
        else if (["transferencia", "transfer", "bank"].includes(m)) pagoUpdates.mepa_metodo = "Transferencia";
        else if (["mercadopago", "mp", "mercadopago qr", "qr"].includes(m)) pagoUpdates.mepa_metodo = "MercadoPago";
      }

      // Buscar el pago asociado a la ocupación
      const { data: ocuRow, error: ocuErr } = await supabase
        .from('ocupacion')
        .select('pag_nro')
        .eq('ocu_id', historyId)
        .single();
      if (ocuErr) {
        console.error('Error obteniendo pag_nro asociado:', ocuErr);
        return NextResponse.json({ error: ocuErr.message }, { status: 500 });
      }

      if (ocuRow?.pag_nro) {
        const { data: dP, error: eP } = await supabase
          .from('pagos')
          .update(pagoUpdates)
          .eq('pag_nro', ocuRow.pag_nro)
          .select()
          .single();
        if (eP) {
          console.error('Error actualizando pago:', eP);
          return NextResponse.json({ error: eP.message }, { status: 500 });
        }
        updated = { ...updated, pago: dP };
      }
    }

    const data = updated;

    if (!data) {
      return NextResponse.json({ error: "Registro no encontrado o no autorizado" }, { status: 404 });
    }

    return NextResponse.json({ updatedEntry: data });
  } catch (error: any) {
    console.error("Error en PATCH /api/parking/history/[id]:", error);
    return NextResponse.json({ error: "Error interno del servidor", details: error.message }, { status: 500 });
  }
} 