import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint que devuelve solo los datos esenciales para inicializar el dashboard
 * (sin incluir el historial, que es más pesado)
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: "Se requiere el ID de usuario" }, { status: 400 });
  }

  // Creación directa del cliente de Supabase usando claves de entorno
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  console.log(`[API] Inicio solicitud datos esenciales para usuario: ${userId}`);
  
  try {
    // Optimizar consulta para reducir tamaño de respuestas y tiempo de procesamiento
    const [
      userCapacityResult,
      parkedVehiclesResult,
      userRatesResult,
      userSettingsResult
    ] = await Promise.all([
      // Capacidad - leer de user_capacity
      supabase
        .from("user_capacity")
        .select("vehicle_type, capacity")
        .eq("user_id", userId),
      
      // Vehículos estacionados - solo seleccionar los campos esenciales y añadir índice de búsqueda
      supabase
        .from("vehicles")
        .select("id, license_plate, type, entry_time")
        .eq("user_id", userId)
        .is("exit_time", null)
        .order("entry_time", { ascending: true }),
      
      // Tarifas - leer de user_rates
      supabase
        .from("user_rates")
        .select("vehicle_type, rate")
        .eq("user_id", userId),
      
      // Configuración del usuario - solo seleccionar los campos esenciales
      supabase
        .from("user_settings")
        .select("bankAccountHolder, bankAccountCbu, bankAccountAlias, mercadopagoApiKey")
        .eq("user_id", userId)
        .single()
    ]);

    // Formatear datos de capacidad de user_capacity
    const capacityFromUserCapacity = (userCapacityResult.data || []).reduce((acc: any, row: any) => {
      acc[row.vehicle_type] = row.capacity || 0;
      return acc;
    }, {});

    const capacity = {
      Auto: capacityFromUserCapacity.Auto || 0,
      Moto: capacityFromUserCapacity.Moto || 0,
      Camioneta: capacityFromUserCapacity.Camioneta || 0
    };

    // Formatear datos de tarifas de user_rates
    const ratesFromUserRates = (userRatesResult.data || []).reduce((acc: any, row: any) => {
      acc[row.vehicle_type] = row.rate || 0;
      return acc;
    }, {});
    
    const rates = {
      Auto: ratesFromUserRates.Auto || 0,
      Moto: ratesFromUserRates.Moto || 0,
      Camioneta: ratesFromUserRates.Camioneta || 0
    };

    const executionTime = Math.round(performance.now() - startTime);
    console.log(`[API] Datos esenciales completados en ${executionTime}ms`);

    // Añadir headers de caché para mejorar rendimiento
    const response = NextResponse.json({
      capacity,
      vehicles: parkedVehiclesResult.data || [],
      rates,
      userSettings: userSettingsResult.data || null,
      _metrics: { executionTime }
    });

    // Establecer cabeceras de cache para el navegador (2 minutos)
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    response.headers.set('X-Execution-Time', `${executionTime}ms`);

    return response;
    
  } catch (error: any) {
    console.error("Error al obtener datos esenciales:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 