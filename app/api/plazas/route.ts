// app/api/plazas/route.ts
// Endpoint para obtener todas las plazas del estacionamiento
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        // Crear cliente de Supabase con configuración de cookies
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            // En caso de error, no hacer nada
                        }
                    },
                    remove(name: string) {
                        try {
                            cookieStore.set({ name, value: '', expires: new Date(0) });
                        } catch (error) {
                            // En caso de error, no hacer nada
                        }
                    }
                }
            }
        );

        // Obtener todas las plazas
        const { data: plazas, error: plazasError } = await supabase
            .from('plazas')
            .select('*')
            .eq('est_id', 1) // Estacionamiento principal
            .order('pla_numero');

        if (plazasError) {
            console.error('❌ Error obteniendo plazas:', plazasError);
            return NextResponse.json({
                error: `Error obteniendo plazas: ${plazasError.message}`
            }, { status: 500 });
        }

        // Obtener todas las zonas
        const { data: zonas, error: zonasError } = await supabase
            .from('zonas')
            .select('*')
            .eq('est_id', 1) // Estacionamiento principal
            .order('zona_nombre');

        if (zonasError) {
            console.error('❌ Error obteniendo zonas:', zonasError);
            return NextResponse.json({
                error: `Error obteniendo zonas: ${zonasError.message}`
            }, { status: 500 });
        }

        // Calcular estadísticas
        const estadisticas = {
            total_plazas: plazas?.length || 0,
            plazas_libres: plazas?.filter(p => p.pla_estado === 'Libre').length || 0,
            plazas_ocupadas: plazas?.filter(p => p.pla_estado === 'Ocupada').length || 0,
            plazas_reservadas: plazas?.filter(p => p.pla_estado === 'Reservada').length || 0,
            plazas_mantenimiento: plazas?.filter(p => p.pla_estado === 'Mantenimiento').length || 0,
            ocupacion_porcentaje: plazas && plazas.length > 0
                ? ((plazas.filter(p => p.pla_estado === 'Ocupada').length / plazas.length) * 100)
                : 0,
            zonas_activas: zonas?.length || 0
        };

        console.log(`✅ Datos obtenidos: ${estadisticas.total_plazas} plazas, ${estadisticas.zonas_activas} zonas`);

        return NextResponse.json({
            success: true,
            plazas: plazas || [],
            zonas: zonas || [],
            estadisticas
        });

    } catch (error) {
        console.error('❌ Error en API /api/plazas:', error);
        return NextResponse.json({
            error: 'Error interno del servidor'
        }, { status: 500 });
    }
}
