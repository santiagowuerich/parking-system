import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const userEmail = user.email;

        // Buscar el usuario en la tabla tradicional por email
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id, usu_nom, usu_ape, usu_email')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({
                estacionamientos: [],
                message: "Usuario no encontrado en sistema tradicional"
            });
        }

        // Buscar todos los estacionamientos del usuario
        const { data: estacionamientosBasicos, error: estacionamientosError } = await supabase
            .from('estacionamientos')
            .select(`
        est_id,
        est_nombre,
        est_prov,
        est_locali,
        est_direc,
        est_capacidad,
        est_cantidad_espacios_disponibles,
        est_horario_funcionamiento,
        est_tolerancia_min
      `)
            .eq('due_id', usuarioData.usu_id)
            .order('est_id');

        if (estacionamientosError) {
            console.error("❌ Error obteniendo estacionamientos:", estacionamientosError);
            return NextResponse.json({ error: "Error consultando estacionamientos" }, { status: 500 });
        }

        // Calcular estadísticas reales para cada estacionamiento
        const estacionamientosData = await Promise.all(
            (estacionamientosBasicos || []).map(async (est) => {
                // Contar plazas totales reales
                const { data: plazasTotales, error: plazasError } = await supabase
                    .from('plazas')
                    .select('pla_numero, pla_estado')
                    .eq('est_id', est.est_id);

                if (plazasError) {
                    console.error(`❌ Error obteniendo plazas para est_id ${est.est_id}:`, plazasError);
                    return {
                        ...est,
                        plazas_totales_reales: 0,
                        plazas_disponibles_reales: 0,
                        plazas_ocupadas: 0
                    };
                }

                // Calcular plazas reales
                const totalPlazasReales = plazasTotales?.length || 0;
                const plazasOcupadas = plazasTotales?.filter(p => p.pla_estado === 'Ocupado').length || 0;
                const plazasDisponiblesReales = totalPlazasReales - plazasOcupadas;

                return {
                    ...est,
                    plazas_totales_reales: totalPlazasReales,
                    plazas_disponibles_reales: plazasDisponiblesReales,
                    plazas_ocupadas: plazasOcupadas
                };
            })
        );

        console.log(`📋 Usuario ${userEmail} tiene ${estacionamientosData?.length || 0} estacionamiento(s)`);

        return NextResponse.json({
            estacionamientos: estacionamientosData || [],
            usuario: {
                usu_id: usuarioData.usu_id,
                nombre_completo: `${usuarioData.usu_nom} ${usuarioData.usu_ape}`,
                email: usuarioData.usu_email
            }
        });

    } catch (error) {
        console.error("❌ Error listando estacionamientos:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
