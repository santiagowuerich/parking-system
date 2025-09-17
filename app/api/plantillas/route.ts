import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

// GET: Obtener todas las plantillas con sus características
export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const url = new URL(request.url)
        const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

        // Usar función RPC optimizada que devuelve plantillas con características agrupadas
        const { data: plantillas, error } = await supabase
            .rpc('get_plantillas_agrupadas', { p_est_id: estId })

        if (error) {
            console.error('Error obteniendo plantillas con RPC:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Convertir el JSONB de características a objeto JavaScript para compatibilidad con el frontend
        const plantillasFormateadas = (plantillas || []).map((plantilla: any) => ({
            plantilla_id: plantilla.plantilla_id,
            nombre_plantilla: plantilla.nombre_plantilla,
            catv_segmento: plantilla.catv_segmento,
            est_id: plantilla.est_id,
            caracteristicas: plantilla.caracteristicas || {}
        }))

        const jsonResponse = NextResponse.json({ plantillas: plantillasFormateadas })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado obteniendo plantillas:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

// POST: Crear nueva plantilla
export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { est_id, nombre_plantilla, catv_segmento, caracteristica_ids } = await request.json()

        if (!est_id || !nombre_plantilla || !catv_segmento) {
            return NextResponse.json({ error: 'Faltan campos requeridos: est_id, nombre_plantilla, catv_segmento' }, { status: 400 })
        }

        // Verificar si ya existe una plantilla con el mismo nombre (case insensitive)
        const { data: existingByName, error: nameCheckError } = await supabase
            .from('plantillas')
            .select('plantilla_id, nombre_plantilla')
            .eq('est_id', est_id)
            .ilike('nombre_plantilla', nombre_plantilla.trim())

        if (nameCheckError) {
            console.error('Error verificando nombre duplicado:', nameCheckError)
            return NextResponse.json({ error: 'Error al verificar duplicados' }, { status: 500 })
        }

        if (existingByName && existingByName.length > 0) {
            return NextResponse.json({
                error: `Ya existe una plantilla con el nombre "${nombre_plantilla.trim()}" en este estacionamiento`,
                error_code: 'DUPLICATE_NAME',
                existing_template: {
                    plantilla_id: existingByName[0].plantilla_id,
                    nombre_plantilla: existingByName[0].nombre_plantilla
                }
            }, { status: 409 })
        }

        // Verificar si ya existe una plantilla con la misma configuración completa
        if (caracteristica_ids && caracteristica_ids.length > 0) {
            // Ordenar los IDs para comparación consistente
            const sortedCaracteristicaIds = caracteristica_ids.sort((a: number, b: number) => a - b)

            // Obtener todas las plantillas del mismo tipo de vehículo en este estacionamiento
            const { data: plantillasMismoTipo, error: tipoCheckError } = await supabase
                .from('plantillas')
                .select('plantilla_id')
                .eq('est_id', est_id)
                .eq('catv_segmento', catv_segmento)

            if (tipoCheckError) {
                console.error('Error verificando plantillas del mismo tipo:', tipoCheckError)
                return NextResponse.json({ error: 'Error al verificar configuraciones existentes' }, { status: 500 })
            }

            if (plantillasMismoTipo && plantillasMismoTipo.length > 0) {
                // Para cada plantilla del mismo tipo, verificar si tiene exactamente las mismas características
                for (const plantilla of plantillasMismoTipo) {
                    const { data: existingCaracteristicas, error: caracteristicaCheckError } = await supabase
                        .from('plantilla_caracteristicas')
                        .select('caracteristica_id')
                        .eq('plantilla_id', plantilla.plantilla_id)
                        .order('caracteristica_id')

                    if (caracteristicaCheckError) {
                        console.error('Error verificando características existentes:', caracteristicaCheckError)
                        continue
                    }

                    const existingIds = (existingCaracteristicas || []).map(pc => pc.caracteristica_id).sort((a: number, b: number) => a - b)

                    // Si tienen exactamente las mismas características, es una duplicada
                    if (existingIds.length === sortedCaracteristicaIds.length &&
                        existingIds.every((id: number, index: number) => id === sortedCaracteristicaIds[index])) {

                        // Obtener el nombre de la plantilla duplicada
                        const { data: plantillaInfo, error: plantillaInfoError } = await supabase
                            .from('plantillas')
                            .select('nombre_plantilla')
                            .eq('plantilla_id', plantilla.plantilla_id)
                            .single()

                        const nombrePlantilla = plantillaInfoError ? 'Plantilla existente' : plantillaInfo?.nombre_plantilla || 'Plantilla existente'

                        return NextResponse.json({
                            error: `Ya existe una plantilla con la misma configuración (tipo de vehículo y características) en este estacionamiento`,
                            error_code: 'DUPLICATE_CONFIG',
                            existing_template: {
                                plantilla_id: plantilla.plantilla_id,
                                nombre_plantilla: nombrePlantilla
                            }
                        }, { status: 409 })
                    }
                }
            }
        }

        // Insertar la plantilla principal
        const { data: plantilla, error: plantillaError } = await supabase
            .from('plantillas')
            .insert({
                est_id,
                nombre_plantilla,
                catv_segmento
            })
            .select()
            .single()

        if (plantillaError) {
            console.error('Error creando plantilla:', plantillaError)
            return NextResponse.json({ error: plantillaError.message }, { status: 500 })
        }

        // Si hay características para asociar
        if (caracteristica_ids && caracteristica_ids.length > 0) {
            try {
                const caracteristicaInserts = caracteristica_ids.map((caracteristica_id: number) => ({
                    plantilla_id: plantilla.plantilla_id,
                    caracteristica_id
                }))

                const { error: caracteristicaError } = await supabase
                    .from('plantilla_caracteristicas')
                    .insert(caracteristicaInserts)

                if (caracteristicaError) {
                    // Si falla la inserción de características, eliminar la plantilla creada
                    await supabase.from('plantillas').delete().eq('plantilla_id', plantilla.plantilla_id)
                    console.error('Error asociando características:', caracteristicaError)
                    return NextResponse.json({ error: caracteristicaError.message }, { status: 500 })
                }
            } catch (caracteristicaError: any) {
                // Si falla la inserción de características, eliminar la plantilla creada
                await supabase.from('plantillas').delete().eq('plantilla_id', plantilla.plantilla_id)
                console.error('Error asociando características:', caracteristicaError)
                return NextResponse.json({ error: caracteristicaError.message }, { status: 500 })
            }
        }

        const jsonResponse = NextResponse.json({ plantilla })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado creando plantilla:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

// PUT: Actualizar plantilla existente
export async function PUT(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { plantilla_id, nombre_plantilla, catv_segmento, caracteristica_ids } = await request.json()

        if (!plantilla_id || !nombre_plantilla || !catv_segmento) {
            return NextResponse.json({ error: 'Faltan campos requeridos: plantilla_id, nombre_plantilla, catv_segmento' }, { status: 400 })
        }

        // Obtener la plantilla actual para comparar
        const { data: plantillaActual, error: getError } = await supabase
            .from('plantillas')
            .select('est_id, nombre_plantilla, catv_segmento')
            .eq('plantilla_id', plantilla_id)
            .single()

        if (getError) {
            console.error('Error obteniendo plantilla actual:', getError)
            return NextResponse.json({ error: 'Error al obtener la plantilla actual' }, { status: 500 })
        }

        const est_id = plantillaActual.est_id

        // Verificar si ya existe otra plantilla con el mismo nombre (excluyendo la actual)
        const { data: existingByName, error: nameCheckError } = await supabase
            .from('plantillas')
            .select('plantilla_id, nombre_plantilla')
            .eq('est_id', est_id)
            .ilike('nombre_plantilla', nombre_plantilla.trim())
            .neq('plantilla_id', plantilla_id)

        if (nameCheckError) {
            console.error('Error verificando nombre duplicado:', nameCheckError)
            return NextResponse.json({ error: 'Error al verificar duplicados' }, { status: 500 })
        }

        if (existingByName && existingByName.length > 0) {
            return NextResponse.json({
                error: `Ya existe otra plantilla con el nombre "${nombre_plantilla.trim()}" en este estacionamiento`,
                error_code: 'DUPLICATE_NAME',
                existing_template: {
                    plantilla_id: existingByName[0].plantilla_id,
                    nombre_plantilla: existingByName[0].nombre_plantilla
                }
            }, { status: 409 })
        }

        // Verificar si ya existe otra plantilla con la misma configuración completa
        if (caracteristica_ids && caracteristica_ids.length > 0) {
            // Ordenar los IDs para comparación consistente
            const sortedCaracteristicaIds = caracteristica_ids.sort((a: number, b: number) => a - b)

            // Obtener todas las plantillas del mismo tipo de vehículo en este estacionamiento (excluyendo la actual)
            const { data: plantillasMismoTipo, error: tipoCheckError } = await supabase
                .from('plantillas')
                .select('plantilla_id')
                .eq('est_id', est_id)
                .eq('catv_segmento', catv_segmento)
                .neq('plantilla_id', plantilla_id)

            if (tipoCheckError) {
                console.error('Error verificando plantillas del mismo tipo:', tipoCheckError)
                return NextResponse.json({ error: 'Error al verificar configuraciones existentes' }, { status: 500 })
            }

            if (plantillasMismoTipo && plantillasMismoTipo.length > 0) {
                // Para cada plantilla del mismo tipo, verificar si tiene exactamente las mismas características
                for (const plantilla of plantillasMismoTipo) {
                    const { data: existingCaracteristicas, error: caracteristicaCheckError } = await supabase
                        .from('plantilla_caracteristicas')
                        .select('caracteristica_id')
                        .eq('plantilla_id', plantilla.plantilla_id)
                        .order('caracteristica_id')

                    if (caracteristicaCheckError) {
                        console.error('Error verificando características existentes:', caracteristicaCheckError)
                        continue
                    }

                    const existingIds = (existingCaracteristicas || []).map(pc => pc.caracteristica_id).sort((a: number, b: number) => a - b)

                    // Si tienen exactamente las mismas características, es una duplicada
                    if (existingIds.length === sortedCaracteristicaIds.length &&
                        existingIds.every((id: number, index: number) => id === sortedCaracteristicaIds[index])) {

                        // Obtener el nombre de la plantilla duplicada
                        const { data: plantillaInfo, error: plantillaInfoError } = await supabase
                            .from('plantillas')
                            .select('nombre_plantilla')
                            .eq('plantilla_id', plantilla.plantilla_id)
                            .single()

                        const nombrePlantilla = plantillaInfoError ? 'Plantilla existente' : plantillaInfo?.nombre_plantilla || 'Plantilla existente'

                        return NextResponse.json({
                            error: `Ya existe otra plantilla con la misma configuración (tipo de vehículo y características) en este estacionamiento`,
                            error_code: 'DUPLICATE_CONFIG',
                            existing_template: {
                                plantilla_id: plantilla.plantilla_id,
                                nombre_plantilla: nombrePlantilla
                            }
                        }, { status: 409 })
                    }
                }
            }
        }

        // Actualizar la plantilla principal
        const { data: plantilla, error: plantillaError } = await supabase
            .from('plantillas')
            .update({
                nombre_plantilla,
                catv_segmento
            })
            .eq('plantilla_id', plantilla_id)
            .select()
            .single()

        if (plantillaError) {
            console.error('Error actualizando plantilla:', plantillaError)
            return NextResponse.json({ error: plantillaError.message }, { status: 500 })
        }

        // Sincronizar características
        try {
            // Primero eliminar todas las asociaciones existentes
            const { error: deleteError } = await supabase
                .from('plantilla_caracteristicas')
                .delete()
                .eq('plantilla_id', plantilla_id)

            if (deleteError) {
                console.error('Error eliminando asociaciones anteriores:', deleteError)
                return NextResponse.json({ error: deleteError.message }, { status: 500 })
            }

            // Si hay nuevas características para asociar
            if (caracteristica_ids && caracteristica_ids.length > 0) {
                const caracteristicaInserts = caracteristica_ids.map((caracteristica_id: number) => ({
                    plantilla_id,
                    caracteristica_id
                }))

                const { error: caracteristicaError } = await supabase
                    .from('plantilla_caracteristicas')
                    .insert(caracteristicaInserts)

                if (caracteristicaError) {
                    console.error('Error asociando nuevas características:', caracteristicaError)
                    return NextResponse.json({ error: caracteristicaError.message }, { status: 500 })
                }
            }
        } catch (caracteristicaError: any) {
            console.error('Error sincronizando características:', caracteristicaError)
            return NextResponse.json({ error: caracteristicaError.message }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({ plantilla })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado actualizando plantilla:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

// DELETE: Eliminar plantilla
export async function DELETE(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { plantilla_id } = await request.json()

        if (!plantilla_id) {
            return NextResponse.json({ error: 'Falta el campo requerido: plantilla_id' }, { status: 400 })
        }

        // Eliminar la plantilla (las asociaciones se eliminan automáticamente por CASCADE)
        const { error } = await supabase
            .from('plantillas')
            .delete()
            .eq('plantilla_id', plantilla_id)

        if (error) {
            console.error('Error eliminando plantilla:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({ success: true, message: 'Plantilla eliminada exitosamente' })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado eliminando plantilla:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}
