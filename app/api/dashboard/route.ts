import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint consolidado que devuelve todos los datos necesarios para inicializar el dashboard
 * en una sola solicitud, reduciendo múltiples viajes al servidor.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "Se requiere el ID de usuario" }, { status: 400 });
  }

  // Creación directa del cliente de Supabase usando claves de entorno
  // Esto evita los problemas con cookies()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  // Agregar medición de tiempo para depuración de rendimiento
  const startTime = Date.now();
  console.log(`[API] Inicio solicitud dashboard para usuario: ${userId}`);
  
  try {
    // Realizar todas las consultas en paralelo
    const [
      capacityResult,
      parkedVehiclesResult,
      historyResult,
      ratesResult,
      userSettingsResult
    ] = await Promise.all([
      // Capacidad
      supabase
        .from("parking_settings")
        .select("car_capacity, motorcycle_capacity, van_capacity")
        .eq("user_id", userId)
        .single(),
      
      // Vehículos estacionados - seleccionar solo campos necesarios
      supabase
        .from("vehicles")
        .select("id, license_plate, type, entry_time, user_id")
        .eq("user_id", userId)
        .is("exit_time", null),
      
      // Historial - Limitamos a 50 registros y seleccionamos solo campos necesarios
      supabase
        .from("parking_history")
        .select("id, license_plate, type, entry_time, exit_time, duration, fee, payment_method")
        .eq("user_id", userId)
        .order("exit_time", { ascending: false })
        .limit(50),
      
      // Tarifas
      supabase
        .from("tariffs")
        .select("car_rate, motorcycle_rate, van_rate")
        .eq("user_id", userId)
        .single(),
      
      // Configuración del usuario - seleccionar solo campos necesarios
      supabase
        .from("user_settings")
        .select("bankAccountHolder, bankAccountCbu, bankAccountAlias, mercadopagoApiKey")
        .eq("user_id", userId)
        .single()
    ]);

    // Formatear datos de capacidad
    const capacity = {
      Auto: capacityResult.data?.car_capacity || 0,
      Moto: capacityResult.data?.motorcycle_capacity || 0,
      Camioneta: capacityResult.data?.van_capacity || 0
    };

    // Formatear datos de tarifas
    const rates = {
      Auto: ratesResult.data?.car_rate || 0,
      Moto: ratesResult.data?.motorcycle_rate || 0,
      Camioneta: ratesResult.data?.van_rate || 0
    };

    // Calcular tiempo de ejecución
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    console.log(`[API] Dashboard completado en ${executionTime}ms`);

    // Respuesta consolidada
    return NextResponse.json({
      capacity,
      vehicles: parkedVehiclesResult.data || [],
      history: historyResult.data || [],
      rates,
      userSettings: userSettingsResult.data || null
    });
    
  } catch (error: any) {
    console.error("Error al obtener datos del dashboard:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 