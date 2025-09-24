import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PlazaStatusSchema = z.object({
  pla_estado: z.enum(['Libre', 'Ocupada', 'Reservada', 'Mantenimiento']),
  razon: z.string().optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const plazaId = parseInt(resolvedParams.id);

    if (isNaN(plazaId) || plazaId <= 0) {
      return NextResponse.json(
        { error: "Invalid plaza ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = PlazaStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { pla_estado, razon } = validation.data;

    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1;

    // 1. Verificar que la plaza existe y pertenece al estacionamiento
    const { data: currentPlaza, error: plazaError } = await supabase
      .from('plazas')
      .select('pla_numero, pla_estado, catv_segmento, pla_zona')
      .eq('est_id', estId)
      .eq('pla_numero', plazaId)
      .single();

    if (plazaError || !currentPlaza) {
      return NextResponse.json(
        { error: "Plaza not found" },
        { status: 404 }
      );
    }

    // 2. Verificar permisos del usuario (asumiendo que ya está autenticado)
    const { data: { user } } = await supabase.auth.getUser();
    let userId = null;

    if (user) {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('usu_id')
        .eq('usu_id', user.id)
        .single();
      userId = userData?.usu_id;
    }

    // 3. Verificar si hay vehículo ocupando la plaza
    const { data: currentOccupation, error: occupationError } = await supabase
      .from('ocupacion')
      .select('ocu_id, veh_patente')
      .eq('est_id', estId)
      .eq('pla_numero', plazaId)
      .is('ocu_fh_salida', null)
      .maybeSingle();

    if (occupationError) {
      console.error("Error checking occupation:", occupationError);
      return NextResponse.json(
        { error: "Error checking plaza occupation" },
        { status: 500 }
      );
    }

    // 4. Validar transiciones de estado
    const isCurrentlyOccupied = !!currentOccupation;
    const estadoAnterior = currentPlaza.pla_estado;

    // Si está ocupada y se intenta bloquear, manejar conflicto
    if (isCurrentlyOccupied && pla_estado === 'Mantenimiento') {
      return NextResponse.json(
        {
          error: "Cannot block occupied plaza",
          details: `Plaza ${plazaId} is currently occupied by vehicle ${currentOccupation.veh_patente}`
        },
        { status: 409 }
      );
    }

    // Si se intenta marcar como ocupada pero no hay vehículo
    if (pla_estado === 'Ocupada' && !isCurrentlyOccupied) {
      return NextResponse.json(
        {
          error: "Cannot mark plaza as occupied without a vehicle",
          details: "No vehicle found in this plaza"
        },
        { status: 400 }
      );
    }

    // 5. Actualizar estado en tabla plazas
    const { data: updatedPlaza, error: updateError } = await supabase
      .from('plazas')
      .update({
        pla_estado: pla_estado
      })
      .eq('est_id', estId)
      .eq('pla_numero', plazaId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating plaza status:", updateError);
      return NextResponse.json(
        { error: "Failed to update plaza status" },
        { status: 500 }
      );
    }

    // 6. Si se libera una plaza ocupada (por ejemplo, desalojar vehículo)
    if (estadoAnterior === 'Ocupada' && pla_estado !== 'Ocupada' && isCurrentlyOccupied) {
      // Marcar como salida forzada
      const { error: exitError } = await supabase
        .from('ocupacion')
        .update({
          ocu_fh_salida: new Date().toISOString(),
          // Agregar una nota de que fue desalojado
        })
        .eq('ocu_id', currentOccupation.ocu_id);

      if (exitError) {
        console.error("Warning: Failed to register forced exit:", exitError);
      }
    }

    // 7. Registrar cambio en tabla de historial de cambios de estado
    // Nota: Esta tabla se creará en las migraciones de BD
    const { error: logError } = await supabase
      .from('plaza_status_changes')
      .insert({
        est_id: estId,
        pla_numero: plazaId,
        psc_estado_anterior: estadoAnterior,
        psc_estado_nuevo: pla_estado,
        psc_fecha_hora: new Date().toISOString(),
        psc_razon: razon || 'Cambio manual',
        usu_id: userId
      });

    // No fallar la operación si el logging falla, pero registrar el error
    if (logError) {
      console.error("Warning: Failed to log status change:", logError);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        plaza_numero: plazaId,
        estado_anterior: estadoAnterior,
        estado_nuevo: pla_estado,
        razon: razon || 'Cambio manual',
        timestamp: new Date().toISOString(),
        vehiculo_afectado: currentOccupation?.veh_patente || null
      }
    });

    return copyResponseCookies(response, jsonResponse);

  } catch (err) {
    console.error("❌ Unexpected error in plaza status update:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}