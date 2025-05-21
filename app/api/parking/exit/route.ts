import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { calculateFee } from "@/lib/utils";
import dayjs from "dayjs";
import utcPlugin from "dayjs/plugin/utc";

dayjs.extend(utcPlugin);

export async function POST(request: NextRequest) {
  try {
    const { licensePlate, userId, paymentMethod, fee, paymentDetails } = await request.json();

    if (!licensePlate || !userId) {
      return NextResponse.json(
        { error: "Se requiere matrícula y ID de usuario" },
        { status: 400 }
      );
    }

    const { supabase, response } = createClient(request);

    // 1. Obtener información del vehículo estacionado
    const { data: vehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .select("*")
      .eq("license_plate", licensePlate)
      .eq("user_id", userId)
      .is("exit_time", null)
      .single();

    if (vehicleError || !vehicle) {
      console.error("Error al obtener vehículo:", vehicleError || "Vehículo no encontrado");
      return NextResponse.json(
        { error: vehicleError?.message || "Vehículo no encontrado" },
        { status: 404 }
      );
    }

    const exitTime = new Date().toISOString();

    // 2. Actualizar el registro del vehículo con la hora de salida
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ exit_time: exitTime })
      .eq("id", vehicle.id);

    if (updateError) {
      console.error("Error al actualizar vehículo:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // 3. Calcular duración y tarifa
    const entryTime = dayjs.utc(vehicle.entry_time);
    const durationMs = dayjs.utc(exitTime).diff(entryTime);
    const durationMinutes = durationMs / (1000 * 60);

    // 4. Crear entrada en el historial
    const historyEntry = {
      license_plate: licensePlate,
      type: vehicle.type,
      user_id: userId,
      entry_time: vehicle.entry_time,
      exit_time: exitTime,
      duration: durationMs,
      fee: fee,
      payment_method: paymentMethod,
      payment_details: paymentDetails || {},
    };

    const { data: history, error: historyError } = await supabase
      .from("parking_history")
      .insert([historyEntry])
      .select()
      .single();

    if (historyError) {
      console.error("Error al crear entrada en historial:", historyError);
      return NextResponse.json(
        { error: historyError.message },
        { status: 500 }
      );
    }

    const jsonResponse = NextResponse.json(history);
    return copyResponseCookies(response, jsonResponse);
  } catch (error) {
    console.error("Error al procesar la salida:", error);
    return NextResponse.json(
      { error: "Error al procesar la salida del vehículo" },
      { status: 500 }
    );
  }
} 