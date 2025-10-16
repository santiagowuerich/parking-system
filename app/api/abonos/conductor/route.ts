import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/abonos/conductor
 *
 * Obtiene la lista de abonos del conductor autenticado
 * Calcula días restantes y estado (Activo, Por vencer, Vencido)
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

        // 1. VALIDAR AUTENTICACIÓN
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // 2. OBTENER usu_id DEL CONDUCTOR AUTENTICADO
        const { data: userData, error: userError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single();

        if (userError || !userData) {
            console.error('Error obteniendo usu_id:', userError);
            return NextResponse.json(
                { success: false, error: "Usuario no encontrado" },
                { status: 403 }
            );
        }

        // 3. OBTENER con_id DEL CONDUCTOR
        const { data: conductorData, error: conductorError } = await supabase
            .from('conductores')
            .select('con_id')
            .eq('con_id', userData.usu_id)
            .single();

        if (conductorError || !conductorData) {
            console.error('Error obteniendo conductor:', conductorError);
            return NextResponse.json(
                { success: false, error: "Conductor no encontrado" },
                { status: 403 }
            );
        }

        // 4. OBTENER ABONOS DEL CONDUCTOR
        const { data: abonosData, error: abonosError } = await supabase
            .from('abonos')
            .select(`
                abo_nro,
                abo_fecha_inicio,
                abo_fecha_fin,
                abo_tipoabono,
                pla_numero,
                abon_id,
                abonado!inner(
                    con_id
                ),
                plazas(
                    pla_zona
                ),
                estacionamientos(
                    est_nombre,
                    est_direc
                )
            `)
            .eq('abonado.con_id', conductorData.con_id)
            .order('abo_fecha_fin', { ascending: true });

        if (abonosError) {
            console.error('Error obteniendo abonos:', abonosError);
            return NextResponse.json(
                { success: false, error: `Error obteniendo abonos: ${abonosError.message}` },
                { status: 500 }
            );
        }

        // 5. FORMATEAR DATOS Y CALCULAR ESTADO
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const abonosFormateados = abonosData.map(abono => {
            const fechaFin = new Date(abono.abo_fecha_fin);
            fechaFin.setHours(0, 0, 0, 0);

            const diasRestantes = Math.ceil((fechaFin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

            let estado: 'Activo' | 'Por vencer' | 'Vencido';
            if (diasRestantes < 0) {
                estado = 'Vencido';
            } else if (diasRestantes <= 7) {
                estado = 'Por vencer';
            } else {
                estado = 'Activo';
            }

            return {
                abo_nro: abono.abo_nro,
                estacionamiento_nombre: abono.estacionamientos?.est_nombre || 'N/A',
                estacionamiento_direccion: abono.estacionamientos?.est_direc || 'N/A',
                pla_zona: abono.plazas?.pla_zona || 'N/A',
                pla_numero: abono.pla_numero || 0,
                abo_tipoabono: abono.abo_tipoabono || 'N/A',
                abo_fecha_inicio: abono.abo_fecha_inicio,
                abo_fecha_fin: abono.abo_fecha_fin,
                dias_restantes: Math.max(0, diasRestantes),
                estado: estado
            };
        });

        console.log(`✅ Abonos obtenidos para conductor ${user.email}: ${abonosFormateados.length} abonos`);

        return NextResponse.json({
            success: true,
            abonos: abonosFormateados
        });

    } catch (error) {
        console.error("❌ Error en /api/abonos/conductor:", error);
        return NextResponse.json(
            { success: false, error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
