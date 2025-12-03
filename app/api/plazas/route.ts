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

        // Si no se especifica zona_id, obtener todas las plazas con información de plantillas y características (comportamiento original)
        console.log('📊 Consultando todas las plazas del estacionamiento con información de plantillas, características y abonos');

        const { data: plazas, error: plazasError } = await supabase
            .from('plazas')
            .select(`
                *,
                plantillas (
                    plantilla_id,
                    nombre_plantilla,
                    catv_segmento
                )
            `)
            .eq('est_id', estId)
            .order('pla_numero');

        // Obtener características de las plantillas si hay plazas con plantillas asignadas
        let plazasConCaracteristicas = plazas;
        if (plazas && plazas.length > 0) {
            const plantillaIds = plazas
                .filter((p: any) => p.plantillas?.plantilla_id)
                .map((p: any) => p.plantillas.plantilla_id);

            if (plantillaIds.length > 0) {
                const plantillaIdsUnicos = Array.from(new Set(plantillaIds));

                // Obtener características directamente por plantilla_id usando función RPC optimizada
                // Esto permite obtener características de plantillas que pertenecen a otros estacionamientos
                const { data: plantillasConCaracteristicas, error: plantillasError } = await supabase
                    .rpc('get_caracteristicas_por_plantilla_ids', { 
                        plantilla_ids: plantillaIdsUnicos 
                    });

                if (!plantillasError && plantillasConCaracteristicas) {

                    // Crear mapa de características por plantilla_id (guardar tanto como número como string para evitar problemas de tipos)
                    const caracteristicasMap = new Map();
                    plantillasConCaracteristicas.forEach((plantilla: any) => {
                        const plantillaId = plantilla.plantilla_id;
                        const caracteristicas = plantilla.caracteristicas || {};
                        // Guardar con ambos tipos para evitar problemas de comparación
                        caracteristicasMap.set(plantillaId, caracteristicas);
                        caracteristicasMap.set(Number(plantillaId), caracteristicas);
                        caracteristicasMap.set(String(plantillaId), caracteristicas);
                    });

                    // Agregar características a las plazas
                    plazasConCaracteristicas = plazas.map((plaza: any) => {
                        const plantillaId = plaza.plantillas?.plantilla_id;
                        
                        // Si tiene plantilla, buscar características en el mapa
                        if (plantillaId) {
                            // Buscar en el mapa (ya guardamos con múltiples tipos)
                            const caracteristicas = caracteristicasMap.get(plantillaId) || 
                                                   caracteristicasMap.get(Number(plantillaId)) || 
                                                   caracteristicasMap.get(String(plantillaId));
                            
                            // Asegurar que caracteristicas sea un objeto válido (no string)
                            let caracteristicasFinal = caracteristicas;
                            if (caracteristicas && typeof caracteristicas === 'string') {
                                try {
                                    caracteristicasFinal = JSON.parse(caracteristicas);
                                } catch (e) {
                                    console.error(`❌ Error parseando características para plaza ${plaza.pla_numero}:`, e);
                                    caracteristicasFinal = null;
                                }
                            }
                            
                            const plazaActualizada = {
                                ...plaza,
                                plantillas: {
                                    ...plaza.plantillas,
                                    caracteristicas: caracteristicasFinal || null // Siempre incluir la propiedad, usar null si no hay características
                                }
                            };

                            return plazaActualizada;
                        }
                        
                        // Si no tiene plantilla pero tiene plantillas objeto, asegurar que tenga caracteristicas: null
                        if (plaza.plantillas && typeof plaza.plantillas === 'object') {
                            return {
                                ...plaza,
                                plantillas: {
                                    ...plaza.plantillas,
                                    caracteristicas: null // Asegurar que siempre tenga la propiedad
                                }
                            };
                        }
                        
                        return plaza;
                    });

                    // Características agregadas a plazasConCaracteristicas
                }
            }
        }

        // Verificar abonos activos para todas las plazas y actualizar su estado
        let plazasConAbonos = plazasConCaracteristicas;
        if (plazasConCaracteristicas && plazasConCaracteristicas.length > 0) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const hoyISO = hoy.toISOString().split('T')[0];

            console.log(`🎫 Verificando abonos activos para ${plazasConCaracteristicas.length} plazas...`);

            // Obtener todos los abonos activos (estado activo y fecha fin >= hoy)
            const { data: abonosActivos, error: abonosError } = await supabase
                .from('abonos')
                .select(`
                    abo_nro,
                    pla_numero,
                    est_id,
                    abo_fecha_inicio,
                    abo_fecha_fin,
                    abo_tipoabono,
                    abo_estado,
                    abonado (
                        abon_id,
                        abon_nombre,
                        abon_apellido,
                        abon_dni
                    )
                `)
                .eq('est_id', estId)
                .eq('abo_estado', 'activo')
                .gte('abo_fecha_fin', hoyISO);

            if (!abonosError && abonosActivos && abonosActivos.length > 0) {
                console.log(`✅ Encontrados ${abonosActivos.length} abonos activos`);

                // Crear mapa de abonos activos por pla_numero
                const abonosMap = new Map();
                abonosActivos.forEach((abono: any) => {
                    if (abono.pla_numero) {
                        abonosMap.set(abono.pla_numero, abono);
                    }
                });

                // Actualizar estado de plazas que tienen abonos activos
                plazasConAbonos = plazasConCaracteristicas.map((plaza: any) => {
                    if (abonosMap.has(plaza.pla_numero)) {
                        const abonoInfo = abonosMap.get(plaza.pla_numero);
                        return {
                            ...plaza,
                            pla_estado: 'Abonado', // Marcar como Abonado si tiene abono activo
                            abono: abonoInfo
                        };
                    }
                    return plaza;
                });

                console.log(`🔄 Plazas actualizadas: ${plazasConAbonos.filter((p: any) => p.pla_estado === 'Abonado').length} marcadas como Abonado`);
            } else {
                if (abonosError) {
                    console.error('❌ Error obteniendo abonos:', abonosError);
                } else {
                    console.log(`ℹ️ No hay abonos activos para este estacionamiento`);
                }
            }
        }

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

        // Calcular estadísticas (solo considerando plazas libres con plantilla para abonos)
        const plazasLibresConPlantilla = plazasConAbonos?.filter(p => p.pla_estado === 'Libre' && p.plantillas?.plantilla_id) || [];
        const estadisticas = {
            total_plazas: plazasConAbonos?.length || 0,
            plazas_libres: plazasConAbonos?.filter(p => p.pla_estado === 'Libre').length || 0,
            plazas_libres_con_plantilla: plazasLibresConPlantilla.length,
            plazas_ocupadas: plazasConAbonos?.filter(p => p.pla_estado === 'Ocupada').length || 0,
            plazas_reservadas: plazasConAbonos?.filter(p => p.pla_estado === 'Reservada').length || 0,
            plazas_abonadas: plazasConAbonos?.filter(p => p.pla_estado === 'Abonado').length || 0,
            plazas_mantenimiento: plazasConAbonos?.filter(p => p.pla_estado === 'Mantenimiento').length || 0,
            ocupacion_porcentaje: plazasConAbonos && plazasConAbonos.length > 0
                ? ((plazasConAbonos.filter(p => p.pla_estado === 'Ocupada').length / plazasConAbonos.length) * 100)
                : 0,
            zonas_activas: zonas?.length || 0
        };

        console.log(`✅ Datos obtenidos: ${estadisticas.total_plazas} plazas, ${estadisticas.zonas_activas} zonas`);

        return NextResponse.json({
            success: true,
            plazas: plazasConAbonos || [],
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
