import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { BuscarConductorResponse } from "@/lib/types";

/**
 * GET /api/conductor/search?query=xxx
 *
 * Busca un conductor por email o DNI.
 * Accesible por playeros (operadores).
 *
 * @query string - Email o DNI del conductor
 * @returns BuscarConductorResponse
 */
export async function GET(request: NextRequest) {
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

        // Validar autenticación
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // Obtener query parameter
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json(
                { success: false, error: "Parámetro 'query' requerido" },
                { status: 400 }
            );
        }

        // Buscar conductor por email o DNI
        // Primero intentar buscar por email
        let conductorData = null;
        let error = null;

        // Normalizar la búsqueda
        const searchQuery = query.toLowerCase();

        // Intentar buscar por email primero
        console.log(`🔍 Buscando conductor con email: ${searchQuery}`);
        const { data: emailResults, error: emailError } = await supabase
            .from('conductores')
            .select(`
                con_id,
                usuario!inner (
                    usu_id,
                    usu_nom,
                    usu_ape,
                    usu_email,
                    usu_tel,
                    usu_dni,
                    usu_fechareg,
                    usu_estado
                ),
                vehiculos (
                    veh_patente,
                    catv_segmento,
                    veh_marca,
                    veh_modelo,
                    veh_color
                )
            `)
            .ilike('usuario.usu_email', `%${searchQuery}%`);

        console.log(`📧 Resultados de búsqueda por email:`, { emailResults, emailError });

        if (emailResults && emailResults.length > 0) {
            conductorData = emailResults[0];
        } else {
            // Si no encuentra por email, buscar por DNI
            console.log(`🔍 Buscando conductor con DNI: ${searchQuery}`);
            const { data: dniResults, error: dniError } = await supabase
                .from('conductores')
                .select(`
                    con_id,
                    usuario!inner (
                        usu_id,
                        usu_nom,
                        usu_ape,
                        usu_email,
                        usu_tel,
                        usu_dni,
                        usu_fechareg,
                        usu_estado
                    ),
                    vehiculos (
                        veh_patente,
                        catv_segmento,
                        veh_marca,
                        veh_modelo,
                        veh_color
                    )
                `)
                .eq('usuario.usu_dni', searchQuery);

            console.log(`🆔 Resultados de búsqueda por DNI:`, { dniResults, dniError });

            if (dniResults && dniResults.length > 0) {
                conductorData = dniResults[0];
            } else {
                error = dniError || { message: "No encontrado" };
            }
        }

        if (error || !conductorData) {
            console.error('❌ Conductor no encontrado:', { error, conductorData });
            return NextResponse.json(
                { success: false, error: "Conductor no encontrado" },
                { status: 404 }
            );
        }

        // Formatear respuesta
        const response: BuscarConductorResponse = {
            success: true,
            data: {
                con_id: conductorData.con_id,
                usu_nom: (conductorData.usuario as any).usu_nom,
                usu_ape: (conductorData.usuario as any).usu_ape,
                usu_email: (conductorData.usuario as any).usu_email,
                usu_tel: (conductorData.usuario as any).usu_tel,
                usu_dni: (conductorData.usuario as any).usu_dni,
                usu_fechareg: (conductorData.usuario as any).usu_fechareg,
                usu_estado: (conductorData.usuario as any).usu_estado,
                vehiculos: conductorData.vehiculos || []
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error en /api/conductor/search GET:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
