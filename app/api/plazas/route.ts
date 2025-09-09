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

            console.log(`🔍 Consultando plazas de zona ${zonaId} con plantillas...`);

            // Obtener plazas primero
            const { data: plazasBasicas, error: plazasBasicasError } = await supabase
                .from('plazas')
                .select('pla_numero, pla_estado, catv_segmento, pla_zona, zona_id, plantilla_id')
                .eq('est_id', estId)
                .eq('zona_id', zonaId)
                .order('pla_numero');

            console.log(`📊 Plazas básicas obtenidas: ${plazasBasicas?.length || 0}`);

            // Si hay plazas con plantillas, obtener la información de las plantillas
            let plazas = plazasBasicas;
            if (plazasBasicas && plazasBasicas.length > 0) {
                const plantillaIds = plazasBasicas
                    .filter((p: any) => p.plantilla_id)
                    .map(p => p.plantilla_id);

                if (plantillaIds.length > 0) {
                    console.log(`🔗 Obteniendo información de ${plantillaIds.length} plantillas...`);

                    const { data: plantillas, error: plantillasError } = await supabase
                        .from('plantillas')
                        .select('plantilla_id, nombre_plantilla, catv_segmento')
                        .in('plantilla_id', plantillaIds);

                    if (!plantillasError && plantillas) {
                        console.log(`✅ Plantillas obtenidas: ${plantillas.length}`);

                        // Crear un mapa de plantillas para lookup rápido
                        const plantillasMap = new Map();
                        plantillas.forEach(plantilla => {
                            plantillasMap.set(plantilla.plantilla_id, plantilla);
                        });

                        // Combinar plazas con información de plantillas
                        plazas = plazasBasicas.map(plaza => ({
                            ...plaza,
                            plantillas: plaza.plantilla_id ? [plantillasMap.get(plaza.plantilla_id)] : []
                        }));

                        console.log(`🔄 Plazas combinadas con plantillas completadas`);
                    } else {
                        console.error('❌ Error obteniendo plantillas:', plantillasError);
                    }
                } else {
                    console.log(`ℹ️ No hay plazas con plantillas asignadas`);
                }
            }

            const plazasError = plazasBasicasError;

            // Agregar información de números locales si las plazas existen
            if (plazas && plazas.length > 0) {
                console.log(`🔢 Agregando números locales para ${plazas.length} plazas...`);

                // Obtener números locales para todas las plazas de esta zona
                const { data: localNumbers, error: localError } = await supabase
                    .from('plazas')
                    .select('pla_numero, pla_local_numero')
                    .eq('zona_id', zonaId)
                    .eq('est_id', estId);

                if (!localError && localNumbers) {
                    // Crear mapa de números locales
                    const localMap = new Map();
                    localNumbers.forEach((p: any) => {
                        localMap.set(p.pla_numero, p.pla_local_numero);
                    });

                    // Agregar pla_local_numero a las plazas
                    plazas = plazas.map(plaza => ({
                        ...plaza,
                        pla_local_numero: localMap.get(plaza.pla_numero) || plaza.pla_numero
                    }));

                    console.log(`✅ Números locales agregados`);
                } else {
                    console.log(`⚠️ No se pudieron obtener números locales, usando números globales`);
                }
            }

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

            console.log(`📊 Zona encontrada:`, zona ? { id: zona.zona_id, nombre: zona.zona_nombre, grid: `${zona.grid_rows}x${zona.grid_cols}` } : 'null');

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
            } else {
                console.log(`✅ Zona ${zona.zona_nombre} encontrada con configuración ${zona.grid_rows}x${zona.grid_cols}`);
            }

            // Transformar datos para el frontend de configuración
            console.log(`🔄 Transformando ${plazas?.length || 0} plazas crudas para zona ${zonaId}`);

            const plazasConfiguracion = (plazas || [])
                .filter((plaza: any) => plaza && plaza.pla_numero) // Filtrar plazas válidas
                .map((plaza: any) => {
                    const plantillaInfo = plaza.plantillas && Array.isArray(plaza.plantillas) && plaza.plantillas.length > 0 ? {
                        plantilla_id: plaza.plantillas[0].plantilla_id || null,
                        nombre_plantilla: plaza.plantillas[0].nombre_plantilla || 'Sin nombre',
                        catv_segmento: plaza.plantillas[0].catv_segmento || 'AUT'
                    } : null;

                    return {
                        numero: plaza.pla_local_numero || plaza.pla_numero || 0, // Usar número local para UI
                        numero_global: plaza.pla_numero, // Mantener referencia al número global
                        estado: plaza.pla_estado || 'Libre',
                        tipo_vehiculo: plaza.catv_segmento || 'AUT',
                        plantilla_actual: plantillaInfo,
                        zona_id: plaza.zona_id || null,
                        zona_nombre: plaza.pla_zona || 'Sin zona'
                    };
                });

            console.log(`✅ Plazas transformadas: ${plazasConfiguracion.length} plazas en zona ${zonaId}`);

            // Mostrar algunas plazas de ejemplo con sus plantillas
            if (plazasConfiguracion.length > 0) {
                console.log(`📋 Ejemplos de plazas:`, plazasConfiguracion.slice(0, 3).map(p => ({
                    numero: p.numero,
                    plantilla: p.plantilla_actual ? `${p.plantilla_actual.nombre_plantilla} (${p.plantilla_actual.plantilla_id})` : 'Sin plantilla'
                })));
            }

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
