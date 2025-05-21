import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint específico para cargar solo el historial de operaciones
 * Se carga por separado ya que suele ser la parte más pesada
 */
export async function GET(request: Request) {
  const startTime = performance.now();
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  
  if (!userId) {
    return NextResponse.json({ error: "Se requiere el ID de usuario" }, { status: 400 });
  }

  // Creación directa del cliente de Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  
  console.log(`[API] Inicio carga de historial para usuario: ${userId} (limit: ${limit}, page: ${page})`);
  
  try {
    // Calcular el offset basado en la página
    const offset = (page - 1) * limit;
    
    // Implementar paginación eficiente y seleccionar solo los campos necesarios
    const historyResult = await supabase
      .from("parking_history")
      .select("id, license_plate, type, entry_time, exit_time, duration, fee, payment_method")
      .eq("user_id", userId)
      .order("exit_time", { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Agregar conteo total para paginación si es la primera página
    let totalCount = null;
    if (page === 1) {
      const countResult = await supabase
        .from("parking_history")
        .select("id", { count: 'exact', head: true })
        .eq("user_id", userId);
      
      totalCount = countResult.count;
    }
    
    const executionTime = Math.round(performance.now() - startTime);
    console.log(`[API] Historial cargado en ${executionTime}ms (${historyResult.data?.length || 0} registros)`);

    // Preparar la respuesta con metadatos de paginación
    const response = NextResponse.json({
      history: historyResult.data || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: (historyResult.data?.length || 0) === limit
      },
      _metrics: { executionTime }
    });
    
    // Establecer cabeceras de cache (2 minutos)
    response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=120');
    response.headers.set('X-Execution-Time', `${executionTime}ms`);
    
    return response;
    
  } catch (error: any) {
    console.error("Error al obtener historial:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 