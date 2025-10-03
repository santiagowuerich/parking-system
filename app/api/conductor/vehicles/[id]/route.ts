import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    async get(name: string) {
                        const cookie = await cookieStore.get(name);
                        return cookie?.value;
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

        // Actualizar vehículo solo si pertenece al conductor
        const { data, error } = await supabase
            .from('vehiculos')
            .update({
                veh_patente: patente.toUpperCase(),
                catv_segmento: catv_segmento
            })
            .eq('veh_patente', params.id)
            .eq('con_id', conductorData.con_id)
            .select()
            .single();

        if (error) {
            console.error('Error actualizando vehículo:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            message: "Vehículo actualizado exitosamente",
            vehicle: {
                id: data.veh_patente,
                patente: data.veh_patente,
                tipo: tipo,
                marca: marca,
                modelo: modelo,
                color: color
            }
        });

    } catch (error) {
        console.error('Error en /api/conductor/vehicles/[id] PUT:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    async get(name: string) {
                        const cookie = await cookieStore.get(name);
                        return cookie?.value;
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

        // Eliminar vehículo solo si pertenece al conductor
        const { error } = await supabase
            .from('vehiculos')
            .delete()
            .eq('veh_patente', params.id)
            .eq('con_id', conductorData.con_id);

        if (error) {
            console.error('Error eliminando vehículo:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: "Vehículo eliminado exitosamente" });

    } catch (error) {
        console.error('Error en /api/conductor/vehicles/[id] DELETE:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
