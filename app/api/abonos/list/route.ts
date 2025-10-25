import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/abonos/list
 *
 * Obtiene la lista de abonos vigentes de un estacionamiento
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

        // 2. OBTENER PARÁMETROS
        const url = new URL(request.url);
        const estId = url.searchParams.get('est_id');
        const incluirVencidos = url.searchParams.get('incluir_vencidos') === 'true';

        if (!estId) {
            return NextResponse.json(
                { success: false, error: "Falta el parámetro est_id" },
                { status: 400 }
            );
        }

        // 3. OBTENER ABONOS DEL ESTACIONAMIENTO (activos o todos según el parámetro)
        let query = supabase
            .from('abonos')
            .select(`
                abo_nro,
                abo_fecha_inicio,
                abo_fecha_fin,
                abo_tipoabono,
                abo_estado,
                pla_numero,
                abonado (
                    abon_nombre,
                    abon_apellido,
                    abon_dni,
                    conductores (
                        usuario (
                            usu_email
                        )
                    )
                ),
                plazas (
                    pla_zona
                )
            `)
            .eq('est_id', estId);

        // Solo filtrar por activo si NO se solicitan los vencidos
        if (!incluirVencidos) {
            query = query.eq('abo_estado', 'activo');
        }

        const { data: abonosData, error: abonosError } = await query.order('abo_fecha_fin', { ascending: true });

        if (abonosError) {
            console.error('Error obteniendo abonos:', abonosError);
            return NextResponse.json(
                { success: false, error: `Error obteniendo abonos: ${abonosError.message}` },
                { status: 500 }
            );
        }

        // 4. FORMATEAR DATOS Y CALCULAR ESTADO
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const abonosFormateados = abonosData.map((abono: any) => {
            const fechaFin = new Date(abono.abo_fecha_fin);
            fechaFin.setHours(0, 0, 0, 0);

            // Calcular días restantes
            const diffTime = fechaFin.getTime() - hoy.getTime();
            let diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Determinar estado
            let estado: 'Activo' | 'Por vencer' | 'Vencido';
            if (diasRestantes < 0) {
                estado = 'Vencido';
                diasRestantes = 0; // Los vencidos muestran 0 días restantes
            } else if (diasRestantes <= 14) {
                estado = 'Por vencer';
            } else {
                estado = 'Activo';
            }

            // Extraer datos del abonado y conductor
            const abonado = Array.isArray(abono.abonado) ? abono.abonado[0] : abono.abonado;
            const plaza = Array.isArray(abono.plazas) ? abono.plazas[0] : abono.plazas;

            return {
                abo_nro: abono.abo_nro,
                conductor_nombre: abonado?.abon_nombre || 'N/A',
                conductor_apellido: abonado?.abon_apellido || '',
                conductor_dni: abonado?.abon_dni || 'N/A',
                zona: plaza?.pla_zona || 'N/A',
                pla_numero: abono.pla_numero,
                tipo_abono: abono.abo_tipoabono,
                fecha_inicio: abono.abo_fecha_inicio,
                fecha_fin: abono.abo_fecha_fin,
                dias_restantes: diasRestantes,
                estado
            };
        });

        return NextResponse.json({
            success: true,
            abonos: abonosFormateados,
            total: abonosFormateados.length
        }, { status: 200 });

    } catch (error) {
        console.error('Error en /api/abonos/list GET:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
