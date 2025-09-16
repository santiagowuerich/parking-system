import { NextResponse, type NextRequest } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import type { VehicleType } from "@/lib/types";

export async function GET(request: NextRequest) {
  // userId ya no es obligatorio; capacidad ahora se deriva de 'estacionamientos' (est_id=1) y plazas

  const { supabase, response } = createClient(request)

  try {
    // Opción simple: devolver capacidad total del estacionamiento 1 y derivar por tipo desde plazas
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1
    const [{ data: est, error: e1 }, { data: plazas, error: e2 }] = await Promise.all([
      supabase.from('estacionamientos').select('est_capacidad').eq('est_id', estId).single(),
      supabase.from('plazas').select('catv_segmento').eq('est_id', estId)
    ]);

    if (e1 || e2) {
      const err = e1 || e2;
      console.error('Error obteniendo capacidad:', err);
      return NextResponse.json({ error: err!.message }, { status: 500 });
    }

    // Contar plazas por segmento
    const counts = (plazas || []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.catv_segmento] = (acc[p.catv_segmento] || 0) + 1;
      return acc;
    }, {});

    // Si no hay datos, devolver valores por defecto
    if (!plazas) {
      const jsonResponse = NextResponse.json({ capacity: { Auto: 0, Moto: 0, Camioneta: 0 } });
      return copyResponseCookies(response, jsonResponse);
    }

    // Convertir el array a un objeto
    const mapSegToType = (seg?: string) => seg === 'MOT' ? 'Moto' : seg === 'CAM' ? 'Camioneta' : 'Auto';
    const capacity = Object.entries(counts).reduce((acc: Record<string, number>, [seg, n]) => {
      acc[mapSegToType(seg)] = n as number;
      return acc;
    }, { Auto: 0, Moto: 0, Camioneta: 0 });

    const jsonResponse = NextResponse.json({
      capacity: {
        Auto: capacity.Auto || 0,
        Moto: capacity.Moto || 0,
        Camioneta: capacity.Camioneta || 0,
      }
    });

    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error fetching capacity:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { capacity } = await request.json();
    if (!capacity) {
      return NextResponse.json({ error: 'Se requiere capacidad' }, { status: 400 });
    }

    const { supabase, response } = createClient(request)

    // Ajustar capacidad total del estacionamiento 1
    const total = Number(capacity.Auto || 0) + Number(capacity.Moto || 0) + Number(capacity.Camioneta || 0);

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1
    const { error: updError } = await supabase
      .from('estacionamientos')
      .update({ est_capacidad: total })
      .eq('est_id', estId);

    if (updError) {
      console.error('Error actualizando capacidad total:', updError);
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    // Nota: Para capacidad por tipo idealmente se gestionan filas en 'plazas'.
    const jsonResponse = NextResponse.json({ success: true, capacity });

    return copyResponseCookies(response, jsonResponse);
  } catch (err) {
    console.error("Unexpected error updating capacity:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
} 