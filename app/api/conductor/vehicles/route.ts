import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        // Obtener usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Obtener usu_id del conductor autenticado
        const { data: userData, error: userError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single();

        if (userError || !userData) {
            console.error('Error obteniendo usu_id:', userError);
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 403 });
        }

        // Obtener con_id del conductor
        const { data: conductorData, error: conductorError } = await supabase
            .from('conductores')
            .select('con_id')
            .eq('con_id', userData.usu_id)
            .single();

        if (conductorError || !conductorData) {
            console.error('Error obteniendo conductor:', conductorError);
            return NextResponse.json({ error: "Conductor no encontrado" }, { status: 403 });
        }

        // Obtener vehículos del conductor
        const { data: vehicles, error } = await supabase
            .from('vehiculos')
            .select(`
                veh_patente,
                catv_segmento,
                cat_vehiculo!inner(catv_descripcion)
            `)
            .eq('con_id', conductorData.con_id);

        if (error) {
            console.error('Error obteniendo vehículos:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transformar datos para el frontend
        const vehiclesFormatted = vehicles.map(v => ({
            id: v.veh_patente, // Usando patente como ID
            patente: v.veh_patente,
            tipo: v.cat_vehiculo.catv_descripcion,
            marca: '', // Aún no disponible en BD
            modelo: '', // Aún no disponible en BD
            color: '' // Aún no disponible en BD
        }));

        return NextResponse.json({ vehicles: vehiclesFormatted });

    } catch (error) {
        console.error('Error en /api/conductor/vehicles GET:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        // Obtener usuario autenticado
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { tipo, patente, marca, modelo, color } = await request.json();

        if (!tipo || !patente || !marca || !modelo || !color) {
            return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
        }

        // Obtener usu_id del conductor autenticado
        const { data: userData, error: userError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single();

        if (userError || !userData) {
            console.error('Error obteniendo usu_id:', userError);
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 403 });
        }

        // Obtener con_id del conductor
        const { data: conductorData, error: conductorError } = await supabase
            .from('conductores')
            .select('con_id')
            .eq('con_id', userData.usu_id)
            .single();

        if (conductorError || !conductorData) {
            console.error('Error obteniendo conductor:', conductorError);
            return NextResponse.json({ error: "Conductor no encontrado" }, { status: 403 });
        }

        // Mapear tipo de vehículo a catv_segmento
        const tipoMapping: Record<string, string> = {
            'Auto': 'A',
            'Moto': 'M',
            'Camioneta': 'C'
        };

        const catv_segmento = tipoMapping[tipo] || 'A';

        // Insertar vehículo en la base de datos
        const { data, error } = await supabase
            .from('vehiculos')
            .insert({
                veh_patente: patente.toUpperCase(),
                con_id: conductorData.con_id,
                catv_segmento: catv_segmento
            })
            .select()
            .single();

        if (error) {
            console.error('Error registrando vehículo:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            message: "Vehículo registrado exitosamente",
            vehicle: {
                id: data.veh_patente,
                patente: data.veh_patente,
                tipo: tipo,
                marca: marca,
                modelo: modelo,
                color: color
            }
        }, { status: 201 });

    } catch (error) {
        console.error('Error en /api/conductor/vehicles POST:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
