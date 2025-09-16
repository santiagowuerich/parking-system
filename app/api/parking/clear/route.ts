import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { license_plate } = await request.json();
    const supabase = supabaseAdmin;
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || undefined

    // Eliminar ocupación activa por matrícula
    let q = supabase
      .from('ocupacion')
      .delete()
      .eq('veh_patente', license_plate)
      .is('ocu_fh_salida', null)
    if (estId) q = q.eq('est_id', estId)
    const { error: deleteError } = await q

    if (deleteError) {
      console.error('Error al eliminar vehículos:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar vehículos' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en clear route:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 