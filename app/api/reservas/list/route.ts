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

        // Obtener reservas base del estacionamiento
        const { data: reservasBase, error: baseError } = await supabase
            .from('reservas')
            .select('*')
            .eq('est_id', est_id)
            .order('res_fh_ingreso', { ascending: false });

        if (baseError) {
            console.error('Error obteniendo reservas:', baseError);
            return copyResponseCookies(
                response,
                NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 })
            );
        }

        // Enriquecer con datos relacionados
        const reservasEnriquecidas = await Promise.all((reservasBase || []).map(async (r: any) => {
            // Obtener datos del conductor
            const { data: conductor } = await supabase
                .from('usuario')
                .select('usu_nom, usu_ape, usu_tel, usu_email')
                .eq('usu_id', r.con_id)
                .single();

            // Obtener datos del vehículo
            const { data: vehiculo } = await supabase
                .from('vehiculos')
                .select('veh_patente, veh_marca, veh_modelo, veh_color')
                .eq('veh_patente', r.veh_patente)
                .single();

            // Obtener datos de la plaza
            const { data: plaza } = await supabase
                .from('plazas')
                .select('pla_zona, catv_segmento')
                .eq('est_id', r.est_id)
                .eq('pla_numero', r.pla_numero)
                .single();

            // Obtener datos del estacionamiento
            const { data: estacionamiento } = await supabase
                .from('estacionamientos')
                .select('est_nombre, est_direc, est_telefono, est_email')
                .eq('est_id', r.est_id)
                .single();

            return {
                ...r,
                conductor: conductor || { usu_nom: 'N/A', usu_ape: 'N/A', usu_tel: 'N/A', usu_email: 'N/A' },
                vehiculo: vehiculo || { veh_patente: r.veh_patente || 'N/A', veh_marca: 'N/A', veh_modelo: 'N/A', veh_color: 'N/A' },
                plaza: plaza || { pla_zona: 'N/A', catv_segmento: 'N/A' },
                estacionamiento: estacionamiento || { est_nombre: 'N/A', est_direc: 'N/A', est_telefono: 'N/A', est_email: 'N/A' }
            };
        }));

        return copyResponseCookies(
            response,
            NextResponse.json({ success: true, reservas: reservasEnriquecidas || [] })
        );

    } catch (err) {
        console.error('Error inesperado:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
