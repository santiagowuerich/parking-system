import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MoveVehicleSchema = z.object({
  license_plate: z.string().min(1, "License plate is required"),
  from_plaza: z.number().min(1, "From plaza must be a positive number"),
  to_plaza: z.number().min(1, "To plaza must be a positive number"),
  move_time: z.string().optional(),
  reason: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = MoveVehicleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { license_plate, from_plaza, to_plaza, move_time, reason } = validation.data;

    if (from_plaza === to_plaza) {
      return NextResponse.json(
        { error: "Origin and destination plaza cannot be the same" },
        { status: 400 }
      );
    }

    const { supabase, response } = createClient(request);
    const url = new URL(request.url);
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1;

    // 1. Verificar que el vehículo existe y está en la plaza origen
    const { data: currentOccupation, error: occupationError } = await supabase
      .from('ocupacion')
      .select('ocu_id, pla_numero, veh_patente')
      .eq('est_id', estId)
      .eq('veh_patente', license_plate.trim())
      .eq('pla_numero', from_plaza)
      .is('ocu_fh_salida', null)
      .single();

    if (occupationError || !currentOccupation) {
      return NextResponse.json(
        { error: "Vehicle not found in origin plaza or already checked out" },
        { status: 404 }
      );
    }

    // 2. Verificar que la plaza destino está libre y es compatible
    const { data: destinationPlaza, error: plazaError } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento, pla_zona')
      .eq('est_id', estId)
      .eq('pla_numero', to_plaza)
      .single();

    if (plazaError || !destinationPlaza) {
      return NextResponse.json(
        { error: "Destination plaza not found" },
        { status: 404 }
      );
    }

    // 3. Verificar que la plaza destino no esté ocupada
    const { data: destinationOccupation, error: destOccError } = await supabase
      .from('ocupacion')
      .select('ocu_id')
      .eq('est_id', estId)
      .eq('pla_numero', to_plaza)
      .is('ocu_fh_salida', null)
      .maybeSingle();

    if (destOccError) {
      console.error("Error checking destination plaza:", destOccError);
      return NextResponse.json(
        { error: "Error checking destination plaza" },
        { status: 500 }
      );
    }

    if (destinationOccupation) {
      return NextResponse.json(
        { error: "Destination plaza is already occupied" },
        { status: 400 }
      );
    }

    // 4. Obtener información del usuario para el logging
    const { data: { user } } = await supabase.auth.getUser();
    let userId = null;

    if (user && user.email) {
      const { data: userData } = await supabase
        .from('usuario')
        .select('usu_id')
        .eq('usu_email', user.email)
        .single();

      userId = userData?.usu_id;
    }

    const moveDateTime = move_time || new Date().toISOString();

    // 5. Realizar la transacción: actualizar ocupación y estados de plazas
    const { data: updateResult, error: updateError } = await supabase
      .from('ocupacion')
      .update({
        pla_numero: to_plaza,
        // Mantener el timestamp de entrada original
      })
      .eq('ocu_id', currentOccupation.ocu_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating occupation:", updateError);
      return NextResponse.json(
        { error: "Failed to move vehicle" },
        { status: 500 }
      );
    }

    // 5.1. Actualizar estado de plaza origen (liberarla)
    const { error: fromPlazaError } = await supabase
      .from('plazas')
      .update({ pla_estado: 'Libre' })
      .eq('pla_numero', from_plaza)
      .eq('est_id', estId);

    if (fromPlazaError) {
      console.error("Warning: Failed to update origin plaza status:", fromPlazaError);
    } else {
      // Registrar cambio de estado en plaza_status_changes
      await supabase
        .from('plaza_status_changes')
        .insert({
          est_id: estId,
          pla_numero: from_plaza,
          estado_anterior: 'Ocupada',
          estado_nuevo: 'Libre',
          fecha_cambio: moveDateTime,
          razon: 'Movimiento de vehículo',
          usu_id: userId
        });
    }

    // 5.2. Actualizar estado de plaza destino (ocuparla)
    const { error: toPlazaError } = await supabase
      .from('plazas')
      .update({ pla_estado: 'Ocupada' })
      .eq('pla_numero', to_plaza)
      .eq('est_id', estId);

    if (toPlazaError) {
      console.error("Warning: Failed to update destination plaza status:", toPlazaError);
    } else {
      // Registrar cambio de estado en plaza_status_changes
      await supabase
        .from('plaza_status_changes')
        .insert({
          est_id: estId,
          pla_numero: to_plaza,
          estado_anterior: 'Libre',
          estado_nuevo: 'Ocupada',
          fecha_cambio: moveDateTime,
          razon: 'Movimiento de vehículo',
          usu_id: userId
        });
    }

    // 6. Registrar el movimiento en la tabla de historial
    const { error: logError } = await supabase
      .from('vehicle_movements')
      .insert({
        est_id: estId,
        veh_patente: license_plate.trim(),
        pla_origen: from_plaza,
        pla_destino: to_plaza,
        mov_fecha_hora: moveDateTime,
        mov_razon: reason || 'Movimiento manual',
        usu_id: userId
      });

    // No fallar la operación si el logging falla, pero registrar el error
    if (logError) {
      console.error("Warning: Failed to log vehicle movement:", logError);
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        moved_from: from_plaza,
        moved_to: to_plaza,
        license_plate: license_plate.trim(),
        move_time: moveDateTime,
        reason: reason || 'Movimiento manual'
      }
    });

    return copyResponseCookies(response, jsonResponse);

  } catch (err) {
    console.error("❌ Unexpected error in vehicle movement:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}