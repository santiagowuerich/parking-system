import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { license_plate } = await request.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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