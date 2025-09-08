// app/api/plazas/route.ts
// Endpoint para obtener todas las plazas del estacionamiento
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
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

        // Parsear parámetros de consulta
        const url = new URL(request.url);
        const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1;
        const zonaId = url.searchParams.get('zona_id') ? Number(url.searchParams.get('zona_id')) : null;

        // Si se especifica zona_id, obtener plazas de esa zona con información de plantillas
        if (zonaId) {
            console.log(`🔍 Consultando plazas de zona ${zonaId} para configuración de plantillas`);

            const { data: plazas, error: plazasError } = await supabase
                .from('plazas')
                .select(`
                    pla_numero,
                    plantilla_id,
                    catv_segmento,
                    pla_estado,
                    pla_zona,
                    zona_id,
                    plantillas!left(
                        plantilla_id,
                        nombre_plantilla,
                        catv_segmento
                    )
                `)
                .eq('est_id', estId)
                .eq('zona_id', zonaId)
                .order('pla_numero');

            if (plazasError) {
                console.error('❌ Error obteniendo plazas de zona:', plazasError);
                return NextResponse.json({
                    error: `Error obteniendo plazas: ${plazasError.message}`
                }, { status: 500 });
            }

            // Obtener información de la zona (para configuración de grid)
            let zona: any = null;
            const { data: zonaData, error: zonaError } = await supabase
                .from('zonas')
                .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
                .eq('zona_id', zonaId)
                .single();

            zona = zonaData;

            if (zonaError && zonaError.code !== 'PGRST116') {
                console.error('❌ Error obteniendo información de zona:', zonaError);
                return NextResponse.json({
                    error: `Error obteniendo zona: ${zonaError.message}`
                }, { status: 500 });
            }

            // Si no hay configuración de grid guardada, intentar sincronizar
            if (!zona) {
                console.log(`⚠️ Zona ${zonaId} no encontrada en tabla zonas`);

                // Intentar encontrar la zona por zona_id en plazas
                const { data: plazaSample, error: plazaError } = await supabase
                    .from('plazas')
                    .select('zona_id, pla_zona')
                    .eq('zona_id', zonaId)
                    .limit(1)
                    .single();

                if (!plazaError && plazaSample) {
                    console.log(`🔍 Intentando sincronizar zona ${plazaSample.pla_zona} (ID: ${zonaId})`);

                    try {
                        const { data: syncResult, error: syncError } = await supabase.rpc(
                            'sync_grid_configuration',
                            { p_zona_id: zonaId }
                        );

                        if (!syncError && syncResult) {
                            console.log(`✅ Configuración creada: ${syncResult}`);

                            // Recargar la información actualizada
                            const { data: zonaActualizada, error: reloadError } = await supabase
                                .from('zonas')
                                .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
                                .eq('zona_id', zonaId)
                                .single();

                            if (!reloadError && zonaActualizada) {
                                zona = zonaActualizada as any;
                                console.log(`✅ Zona sincronizada: ${zona.zona_nombre}`);
                            }
                        }
                    } catch (syncError) {
                        console.error('❌ Error sincronizando zona:', syncError);
                    }
                } else {
                    console.log(`❌ No se pudo encontrar información de zona ${zonaId}`);
                }
            } else if (zona.grid_rows && zona.grid_cols) {
                // La verificación se hará después de declarar plazasConfiguracion
            }

            // Transformar datos para el frontend de configuración
            const plazasConfiguracion = (plazas || [])
                .filter(plaza => plaza && plaza.pla_numero) // Filtrar plazas válidas
                .map(plaza => ({
                    numero: plaza.pla_numero || 0,
                    estado: plaza.pla_estado || 'Libre',
                    tipo_vehiculo: plaza.catv_segmento || 'AUT',
                    plantilla_actual: plaza.plantillas && Array.isArray(plaza.plantillas) && plaza.plantillas.length > 0 ? {
                        plantilla_id: plaza.plantillas[0].plantilla_id || null,
                        nombre_plantilla: plaza.plantillas[0].nombre_plantilla || 'Sin nombre',
                        catv_segmento: plaza.plantillas[0].catv_segmento || 'AUT'
                    } : null,
                    zona_id: plaza.zona_id || null,
                    zona_nombre: plaza.pla_zona || 'Sin zona'
                }));

            console.log(`✅ Plazas obtenidas: ${plazasConfiguracion.length} plazas en zona ${zonaId}`);

            // Verificar si la configuración del grid coincide con el número real de plazas
            if (zona && zona.grid_rows && zona.grid_cols) {
                const plazasEsperadas = zona.grid_rows * zona.grid_cols;
                if (plazasEsperadas !== plazasConfiguracion.length) {
                    console.log(`⚠️ Discrepancia detectada: ${plazasEsperadas} plazas esperadas vs ${plazasConfiguracion.length} plazas reales`);

                    // Intentar sincronizar automáticamente
                    try {
                        const { data: syncResult, error: syncError } = await supabase.rpc(
                            'sync_grid_configuration',
                            { p_zona_id: zonaId }
                        );

                        if (!syncError && syncResult) {
                            console.log(`✅ Configuración sincronizada: ${syncResult}`);

                            // Recargar la información actualizada
                            const { data: zonaActualizada, error: reloadError } = await supabase
                                .from('zonas')
                                .select('grid_rows, grid_cols, grid_numbering')
                                .eq('zona_id', zonaId)
                                .single();

                            if (!reloadError && zonaActualizada) {
                                if (!zona) zona = {} as any;
                                zona.grid_rows = zonaActualizada.grid_rows;
                                zona.grid_cols = zonaActualizada.grid_cols;
                                zona.grid_numbering = zonaActualizada.grid_numbering;
                            }
                        }
                    } catch (syncError) {
                        console.error('❌ Error sincronizando grid:', syncError);
                    }
                }
            }

            return NextResponse.json({
                success: true,
                zona: zona ? {
                    zona_id: zona.zona_id,
                    zona_nombre: zona.zona_nombre,
                    grid: {
                        rows: zona.grid_rows || 1,
                        cols: zona.grid_cols || 1,
                        numbering: zona.grid_numbering || 'ROW_MAJOR'
                    }
                } : {
                    zona_id: zonaId,
                    zona_nombre: 'Zona sin configurar',
                    grid: {
                        rows: 1,
                        cols: plazasConfiguracion.length,
                        numbering: 'ROW_MAJOR'
                    }
                },
                plazas: plazasConfiguracion,
                total_plazas: plazasConfiguracion.length
            });
        }

        // Si no se especifica zona_id, obtener todas las plazas (comportamiento original)
        console.log('📊 Consultando todas las plazas del estacionamiento');

        const { data: plazas, error: plazasError } = await supabase
            .from('plazas')
            .select('*')
            .eq('est_id', estId)
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
            .eq('est_id', estId)
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
