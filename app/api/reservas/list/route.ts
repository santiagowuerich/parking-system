import { NextResponse, type NextRequest } from 'next/server';
import { createClient, copyResponseCookies } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { searchParams } = new URL(request.url);
        const est_id = Number(searchParams.get('est_id'));

        if (!est_id) {
            return NextResponse.json({ error: 'est_id es requerido' }, { status: 400 });
        }

        // Obtener todas las reservas del estacionamiento usando la vista
        const { data: reservas, error } = await supabase
            .from('vw_reservas_detalles')
            .select('*')
            .eq('est_id', est_id)
            .order('res_created_at', { ascending: false });

        if (error) {
            console.error('Error obteniendo reservas:', error);
            return copyResponseCookies(
                response,
                NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 })
            );
        }

        return copyResponseCookies(
            response,
            NextResponse.json({ success: true, reservas: reservas || [] })
        );

    } catch (err) {
        console.error('Error inesperado:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
