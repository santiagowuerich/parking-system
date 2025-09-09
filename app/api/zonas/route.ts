// app/api/zonas/route.ts - Sistema simplificado usando pla_zona
import { createClient } from "@/lib/supabase/client";
import { NextResponse, type NextRequest } from 'next/server'

// GET: Obtener zonas o información específica de una zona
export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request);

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1
    const zonaNombre = url.searchParams.get('zona')

    try {
        // Si se especifica una zona, obtener información detallada de esa zona
        if (zonaNombre) {
            console.log(`🔍 Consultando información detallada de zona "${zonaNombre}"`);

            // Primero obtener la información de la zona desde la tabla zonas
            const { data: zonaInfo, error: zonaError } = await supabase
                .from('zonas')
                .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
                .eq('est_id', estId)
                .eq('zona_nombre', zonaNombre)
                .single();

            if (zonaError && zonaError.code !== 'PGRST116') {
                console.error('❌ Error obteniendo información de zona:', zonaError);
                return NextResponse.json({
                    error: `Error obteniendo zona: ${zonaError.message}`
                }, { status: 500 });
            }

            // Obtener todas las plazas de la zona
            const { data: plazas, error: plazasError } = await supabase
                .from('plazas')
                .select('*')
                .eq('est_id', estId)
                .eq('pla_zona', zonaNombre)
                .order('pla_numero');

            if (plazasError) {
                console.error('❌ Error obteniendo plazas de zona:', plazasError);
                return NextResponse.json({
                    error: `Error obteniendo plazas: ${plazasError.message}`
                }, { status: 500 });
            }

            if (!plazas || plazas.length === 0) {
                return NextResponse.json({
                    error: `No se encontraron plazas para la zona "${zonaNombre}"`
                }, { status: 404 });
            }

            // Verificar y sincronizar configuración del grid
            let filas, columnas, numbering;

            if (zonaInfo && zonaInfo.grid_rows && zonaInfo.grid_cols) {
                // Verificar si la configuración coincide con el número real de plazas
                const plazasEsperadas = zonaInfo.grid_rows * zonaInfo.grid_cols;
                if (plazasEsperadas !== plazas.length) {
                    console.log(`⚠️ Discrepancia detectada: ${plazasEsperadas} plazas esperadas vs ${plazas.length} plazas reales`);

                    // Intentar sincronizar automáticamente
                    try {
                        const { data: syncResult, error: syncError } = await supabase.rpc(
                            'sync_grid_configuration',
                            { p_zona_id: zonaInfo.zona_id }
                        );

                        if (!syncError && syncResult) {
                            console.log(`✅ Configuración sincronizada: ${syncResult}`);

                            // Recargar la información actualizada
                            const { data: zonaActualizada, error: reloadError } = await supabase
                                .from('zonas')
                                .select('grid_rows, grid_cols, grid_numbering')
                                .eq('zona_id', zonaInfo.zona_id)
                                .single();

                            if (!reloadError && zonaActualizada) {
                                filas = zonaActualizada.grid_rows;
                                columnas = zonaActualizada.grid_cols;
                                numbering = zonaActualizada.grid_numbering || 'ROW_MAJOR';
                            } else {
                                // Fallback si falla la recarga
                                filas = zonaInfo.grid_rows;
                                columnas = zonaInfo.grid_cols;
                                numbering = zonaInfo.grid_numbering || 'ROW_MAJOR';
                            }
                        } else {
                            // Usar configuración original si falla la sincronización
                            filas = zonaInfo.grid_rows;
                            columnas = zonaInfo.grid_cols;
                            numbering = zonaInfo.grid_numbering || 'ROW_MAJOR';
                        }
                    } catch (syncError) {
                        console.error('❌ Error sincronizando grid:', syncError);
                        filas = zonaInfo.grid_rows;
                        columnas = zonaInfo.grid_cols;
                        numbering = zonaInfo.grid_numbering || 'ROW_MAJOR';
                    }
                } else {
                    // Configuración correcta, usar valores guardados
                    filas = zonaInfo.grid_rows;
                    columnas = zonaInfo.grid_cols;
                    numbering = zonaInfo.grid_numbering || 'ROW_MAJOR';
                }

                console.log(`✅ Usando configuración de grid real: ${filas}x${columnas} (${numbering})`);
            } else {
                // No hay configuración guardada, intentar sincronizar
                console.log(`⚠️ No hay configuración de grid guardada para zona ${zonaNombre}`);

                try {
                    const { data: syncResult, error: syncError } = await supabase.rpc(
                        'sync_grid_configuration',
                        { p_zona_id: zonaInfo?.zona_id }
                    );

                    if (!syncError && syncResult) {
                        console.log(`✅ Configuración creada: ${syncResult}`);

                        // Recargar la información actualizada
                        const { data: zonaActualizada, error: reloadError } = await supabase
                            .from('zonas')
                            .select('grid_rows, grid_cols, grid_numbering')
                            .eq('zona_id', zonaInfo?.zona_id)
                            .single();

                        if (!reloadError && zonaActualizada) {
                            filas = zonaActualizada.grid_rows;
                            columnas = zonaActualizada.grid_cols;
                            numbering = zonaActualizada.grid_numbering || 'ROW_MAJOR';
                        } else {
                            // Fallback heurístico
                            filas = 1;
                            columnas = plazas.length;
                            numbering = 'ROW_MAJOR';
                        }
                    } else {
                        // Fallback heurístico si falla la sincronización
                        filas = 1;
                        columnas = plazas.length;
                        numbering = 'ROW_MAJOR';
                    }
                } catch (syncError) {
                    console.error('❌ Error creando configuración de grid:', syncError);
                    filas = 1;
                    columnas = plazas.length;
                    numbering = 'ROW_MAJOR';
                }

                console.log(`⚠️ Usando configuración por defecto: ${filas}x${columnas} (${numbering})`);
            }

            // Calcular estadísticas de la zona
            const estadisticas = {
                total_plazas: plazas.length,
                plazas_libres: plazas.filter(p => p.pla_estado === 'Libre').length,
                plazas_ocupadas: plazas.filter(p => p.pla_estado === 'Ocupada').length,
                plazas_reservadas: plazas.filter(p => p.pla_estado === 'Reservada').length,
                plazas_mantenimiento: plazas.filter(p => p.pla_estado === 'Mantenimiento').length,
                numero_min: Math.min(...plazas.map(p => p.pla_numero)),
                numero_max: Math.max(...plazas.map(p => p.pla_numero))
            };

            const zonaResponse = {
                zona_id: zonaInfo?.zona_id,
                zona_nombre: zonaNombre,
                est_id: estId,
                total_plazas: plazas.length,
                filas_detectadas: filas,
                columnas_detectadas: columnas,
                grid: zonaInfo ? {
                    rows: zonaInfo.grid_rows,
                    cols: zonaInfo.grid_cols,
                    numbering: zonaInfo.grid_numbering
                } : {
                    rows: filas,
                    cols: columnas,
                    numbering: numbering
                },
                estadisticas,
                plazas: plazas.map(p => ({
                    numero: p.pla_numero,
                    estado: p.pla_estado,
                    tipo_vehiculo: p.catv_segmento
                }))
            };

            console.log(`✅ Información de zona obtenida: ${plazas.length} plazas, ${zonaResponse.filas_detectadas}x${zonaResponse.columnas_detectadas} layout`);

            const json = NextResponse.json({
                success: true,
                zona: zonaResponse
            });

            response.cookies.getAll().forEach((c: any) => {
                const { name, value, ...opt } = c;
                json.cookies.set({ name, value, ...opt })
            });
            return json;
        }

        // Si no se especifica zona, obtener todas las zonas únicas
        console.log('📊 Consultando todas las zonas disponibles');

        // Obtener zonas únicas del campo pla_zona (todas las plazas tienen zona obligatoria)
        const { data, error } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', estId);

        if (error) {
            console.error('❌ Error consultando plazas:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Obtener zonas únicas de la tabla zonas (no de plazas)
        const { data: zonasData, error: zonasTableError } = await supabase
            .from('zonas')
            .select('zona_id, zona_nombre')
            .eq('est_id', estId)
            .order('zona_nombre');

        if (zonasTableError) {
            console.error('❌ Error obteniendo zonas de tabla:', zonasTableError);
            return NextResponse.json({
                error: `Error obteniendo zonas: ${zonasTableError.message}`
            }, { status: 500 });
        }

        const zonas = (zonasData || []).map(zona => ({
            zona_id: zona.zona_id,
            zona_nombre: zona.zona_nombre,
            est_id: estId
        }));

        console.log('📊 Zonas encontradas:', { total: zonas.length });

        const json = NextResponse.json({ zonas });
        response.cookies.getAll().forEach((c: any) => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('❌ Error en GET /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}


// PUT: Renombrar una zona
export async function PUT(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { zona_antigua, zona_nueva, est_id } = await request.json();

        if (!zona_antigua || !zona_nueva || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_antigua, zona_nueva y est_id'
            }, { status: 400 });
        }

        // Renombrar todas las plazas que tienen la zona antigua
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: zona_nueva })
            .eq('est_id', est_id)
            .eq('pla_zona', zona_antigua);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `Zona renombrada de "${zona_antigua}" a "${zona_nueva}"`
        });
        response.cookies.getAll().forEach((c: any) => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('Error en PUT /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Crear zona nueva o sincronizar configuración de grid
export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const body = await request.json();

        // Detectar tipo de request basado en los parámetros
        if (body.sync_all !== undefined || body.zona_nombre) {
            // Es un request de sincronización de grid
            return await handleGridSync(supabase, response, body);
        } else {
            // Es un request de creación de zona
            return await handleZoneCreation(supabase, response, body);
        }

    } catch (err: any) {
        console.error('Error en POST /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// Función auxiliar para manejar sincronización de grid
async function handleGridSync(supabase: any, response: any, body: any) {
    const { est_id, sync_all } = body;

    if (!est_id) {
        return NextResponse.json({
            error: 'Se requiere est_id'
        }, { status: 400 });
    }

    let results = [];
    let synced = 0;
    let errors = 0;

    if (sync_all) {
        // Sincronizar todas las zonas del estacionamiento
        const { data: zonas, error: zonasError } = await supabase
            .from('zonas')
            .select('zona_id, zona_nombre')
            .eq('est_id', est_id);

        if (zonasError) {
            return NextResponse.json({
                error: `Error obteniendo zonas: ${zonasError.message}`
            }, { status: 500 });
        }

        for (const zona of zonas || []) {
            try {
                const { data: syncResult, error: syncError } = await supabase.rpc(
                    'sync_grid_configuration',
                    { p_zona_id: zona.zona_id }
                );

                if (!syncError && syncResult) {
                    results.push({
                        zona_id: zona.zona_id,
                        zona_nombre: zona.zona_nombre,
                        status: 'synced',
                        message: syncResult
                    });
                    synced++;
                } else {
                    results.push({
                        zona_id: zona.zona_id,
                        zona_nombre: zona.zona_nombre,
                        status: 'error',
                        message: syncError?.message || 'Error desconocido'
                    });
                    errors++;
                }
            } catch (syncError: any) {
                results.push({
                    zona_id: zona.zona_id,
                    zona_nombre: zona.zona_nombre,
                    status: 'error',
                    message: syncError.message
                });
                errors++;
            }
        }
    } else {
        // Sincronizar zona específica (por nombre)
        const { zona_nombre } = body;

        if (!zona_nombre) {
            return NextResponse.json({
                error: 'Se requiere zona_nombre cuando no se especifica sync_all'
            }, { status: 400 });
        }

        // Obtener zona_id por nombre
        const { data: zona, error: zonaError } = await supabase
            .from('zonas')
            .select('zona_id, zona_nombre')
            .eq('est_id', est_id)
            .eq('zona_nombre', zona_nombre)
            .single();

        if (zonaError) {
            return NextResponse.json({
                error: `Zona no encontrada: ${zonaError.message}`
            }, { status: 404 });
        }

        const { data: syncResult, error: syncError } = await supabase.rpc(
            'sync_grid_configuration',
            { p_zona_id: zona.zona_id }
        );

        if (!syncError && syncResult) {
            results.push({
                zona_id: zona.zona_id,
                zona_nombre: zona.zona_nombre,
                status: 'synced',
                message: syncResult
            });
            synced++;
        } else {
            results.push({
                zona_id: zona.zona_id,
                zona_nombre: zona.zona_nombre,
                status: 'error',
                message: syncError?.message || 'Error desconocido'
            });
            errors++;
        }
    }

    const json = NextResponse.json({
        success: true,
        message: sync_all ?
            `Sincronización completada: ${synced} exitosas, ${errors} errores` :
            `Sincronización completada`,
        results,
        synced,
        errors
    });
    response.cookies.getAll().forEach((c: any) => {
        const { name, value, ...opt } = c;
        json.cookies.set({ name, value, ...opt })
    });
    return json;
}

// Función auxiliar para manejar creación de zona
async function handleZoneCreation(supabase: any, response: any, body: any) {
    // Modo 1: Asignación manual de plazas existentes
    if (body.plaza_numeros && Array.isArray(body.plaza_numeros)) {
        const { zona_nombre, plaza_numeros, est_id } = body;

        if (!zona_nombre || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_nombre y est_id para asignación manual'
            }, { status: 400 });
        }

        // Actualizar las plazas con la nueva zona
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: zona_nombre })
            .eq('est_id', est_id)
            .in('pla_numero', plaza_numeros);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `${plaza_numeros.length} plazas asignadas a la zona "${zona_nombre}"`
        });
        response.cookies.getAll().forEach((c: any) => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;
    }

    // Modo 2: Creación de zona con generación automática de plazas
    const { zona_nombre, est_id, capacidad } = body;

    if (!zona_nombre || !est_id || !capacidad) {
        return NextResponse.json({
            error: 'Se requieren zona_nombre, est_id y capacidad para crear zona con plazas'
        }, { status: 400 });
    }

    // Verificar que la zona no exista ya
    const { data: existingZones } = await supabase
        .from('plazas')
        .select('pla_zona')
        .eq('est_id', est_id)
        .eq('pla_zona', zona_nombre)
        .limit(1);

    if (existingZones && existingZones.length > 0) {
        return NextResponse.json({
            error: `La zona "${zona_nombre}" ya existe`
        }, { status: 400 });
    }

    // Obtener el número más alto de plaza existente
    const { data: existingPlazas } = await supabase
        .from('plazas')
        .select('pla_numero')
        .eq('est_id', est_id)
        .order('pla_numero', { ascending: false })
        .limit(1);

    let nextPlazaNumber = 1;
    if (existingPlazas && existingPlazas.length > 0) {
        nextPlazaNumber = (existingPlazas[0].pla_numero || 0) + 1;
    }

    // Generar plazas para cada tipo de vehículo
    const plazasToCreate = [];
    const tiposVehiculo = [
        { key: 'AUT', count: capacidad.Auto || 0 },
        { key: 'MOT', count: capacidad.Moto || 0 },
        { key: 'CAM', count: capacidad.Camioneta || 0 }
    ];

    let currentNumber = nextPlazaNumber;

    for (const tipo of tiposVehiculo) {
        for (let i = 0; i < tipo.count; i++) {
            plazasToCreate.push({
                est_id: est_id,
                pla_numero: currentNumber,
                pla_estado: 'Libre',
                catv_segmento: tipo.key,
                pla_zona: zona_nombre
            });
            currentNumber++;
        }
    }

    // Insertar todas las plazas
    if (plazasToCreate.length > 0) {
        const { error: plazasError } = await supabase
            .from('plazas')
            .insert(plazasToCreate);

        if (plazasError) {
            console.error('❌ Error creando plazas:', plazasError);
            return NextResponse.json({
                error: `Error creando plazas: ${plazasError.message}`
            }, { status: 500 });
        }

        // Asignar números locales a las plazas recién creadas
        // Primero obtener el zona_id de la zona que acabamos de crear
        const { data: zonaCreada, error: zonaError } = await supabase
            .from('zonas')
            .select('zona_id')
            .eq('zona_nombre', zona_nombre)
            .eq('est_id', est_id)
            .single();

        if (!zonaError && zonaCreada) {
            // Actualizar números locales usando la función
            const { data: updateResult, error: updateError } = await supabase.rpc(
                'update_local_numbers_for_zone',
                { p_zona_id: zonaCreada.zona_id, p_est_id: est_id }
            );

            if (updateError) {
                console.error('⚠️ Error actualizando números locales:', updateError);
            } else {
                console.log('✅ Números locales actualizados:', updateResult);
            }
        } else {
            console.error('⚠️ Error obteniendo zona_id para actualizar números locales:', zonaError);
        }
    }

    const totalPlazas = plazasToCreate.length;
    const plazaRange = totalPlazas > 0 ? `${nextPlazaNumber}-${currentNumber - 1}` : 'ninguna';

    const json = NextResponse.json({
        success: true,
        zona_nombre,
        plazas_creadas: totalPlazas,
        rango_plazas: plazaRange,
        message: `Zona "${zona_nombre}" creada con ${totalPlazas} plazas (${plazaRange})`
    });

    response.cookies.getAll().forEach((c: any) => {
        const { name, value, ...opt } = c;
        json.cookies.set({ name, value, ...opt })
    });
    return json;
}

// DELETE: Eliminar una zona (reasignar plazas a GENERAL)
export async function DELETE(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { zona_nombre, est_id } = await request.json();

        if (!zona_nombre || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_nombre y est_id'
            }, { status: 400 });
        }

        // Verificar si hay más de una zona
        const { data: allZones } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', est_id);

        const uniqueZones = [...new Set(allZones?.map(p => p.pla_zona) || [])];

        if (uniqueZones.length <= 1) {
            return NextResponse.json({
                error: 'No se puede eliminar la última zona. Todos los estacionamientos deben tener al menos una zona.'
            }, { status: 400 });
        }

        // Reasignar las plazas a zona "GENERAL" (zona por defecto)
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: 'GENERAL' })
            .eq('est_id', est_id)
            .eq('pla_zona', zona_nombre);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `Zona "${zona_nombre}" eliminada. Las plazas fueron reasignadas a zona "GENERAL".`
        });
        response.cookies.getAll().forEach((c: any) => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('Error en DELETE /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}