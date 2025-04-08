import { createClient } from '@supabase/supabase-js';
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Eliminar todos los vehículos estacionados del usuario
    const { error: deleteError } = await supabase
      .from('parked_vehicles')
      .delete()
      .eq('user_id', user_id);

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