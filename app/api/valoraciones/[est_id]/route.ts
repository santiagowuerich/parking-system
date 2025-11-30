import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'
import { 
    ValoracionesResponse, 
    CreateValoracionRequest, 
    UpdateValoracionRequest,
    ValoracionMutationResponse,
    DeleteValoracionResponse 
} from '@/lib/types/valoraciones'

/**
 * GET /api/valoraciones/[est_id]
 * Obtener valoraciones de un estacionamiento con paginación
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ est_id: string }> }
) {
    const { supabase, response } = createClient(request)
    const { est_id } = await params

    try {
        const estId = parseInt(est_id)
        if (isNaN(estId)) {
            return NextResponse.json({ success: false, error: 'est_id inválido' }, { status: 400 })
        }

        // Obtener parámetros de paginación
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        // Obtener usuario actual (si está autenticado)
        const { data: { user } } = await supabase.auth.getUser()
        let miValoracion = null

        if (user) {
            // Obtener usu_id del usuario actual
            const { data: usuarioData } = await supabase
                .from('usuario')
                .select('usu_id')
                .eq('auth_user_id', user.id)
                .single()

            if (usuarioData) {
                // Obtener mi valoración si existe
                const { data: miVal } = await supabase
                    .from('estacionamiento_valoraciones')
                    .select('*')
                    .eq('est_id', estId)
                    .eq('usu_id', usuarioData.usu_id)
                    .single()

                miValoracion = miVal || null
            }
        }

        // Obtener total de valoraciones
        const { count: totalCount, error: countError } = await supabase
            .from('estacionamiento_valoraciones')
            .select('*', { count: 'exact', head: true })
            .eq('est_id', estId)

        if (countError) {
            console.error('Error obteniendo count:', countError)
            return NextResponse.json({ success: false, error: countError.message }, { status: 500 })
        }

        // Obtener valoraciones paginadas con información del usuario
        const { data: valoraciones, error: valoracionesError } = await supabase
            .from('estacionamiento_valoraciones')
            .select(`
                val_id,
                est_id,
                usu_id,
                val_rating,
                val_comentario,
                val_created_at,
                val_updated_at,
                usuario!inner (
                    usu_nom,
                    usu_ape
                )
            `)
            .eq('est_id', estId)
            .order('val_created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (valoracionesError) {
            console.error('Error obteniendo valoraciones:', valoracionesError)
            return NextResponse.json({ success: false, error: valoracionesError.message }, { status: 500 })
        }

        // Calcular estadísticas
        const { data: statsData, error: statsError } = await supabase
            .from('estacionamiento_valoraciones')
            .select('val_rating')
            .eq('est_id', estId)

        if (statsError) {
            console.error('Error obteniendo estadísticas:', statsError)
            return NextResponse.json({ success: false, error: statsError.message }, { status: 500 })
        }

        // Calcular distribución y promedio
        const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        let sumaRatings = 0

        statsData?.forEach((v: { val_rating: number }) => {
            distribucion[v.val_rating as keyof typeof distribucion]++
            sumaRatings += v.val_rating
        })

        const totalValoraciones = statsData?.length || 0
        const promedioRating = totalValoraciones > 0 ? sumaRatings / totalValoraciones : 0

        // Mapear valoraciones al formato esperado
        const valoracionesMapeadas = (valoraciones || []).map((v: any) => ({
            val_id: v.val_id,
            est_id: v.est_id,
            usu_id: v.usu_id,
            val_rating: v.val_rating,
            val_comentario: v.val_comentario,
            val_created_at: v.val_created_at,
            val_updated_at: v.val_updated_at,
            usuario: {
                usu_nom: v.usuario?.usu_nom || '',
                usu_ape: v.usuario?.usu_ape || ''
            }
        }))

        const responseData: ValoracionesResponse = {
            success: true,
            valoraciones: valoracionesMapeadas,
            estadisticas: {
                total_valoraciones: totalValoraciones,
                promedio_rating: Math.round(promedioRating * 10) / 10, // Redondear a 1 decimal
                distribucion
            },
            paginacion: {
                pagina_actual: page,
                total_paginas: Math.ceil((totalCount || 0) / limit),
                total_elementos: totalCount || 0,
                elementos_por_pagina: limit
            },
            mi_valoracion: miValoracion
        }

        const jsonResponse = NextResponse.json(responseData)
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado en GET valoraciones:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

/**
 * POST /api/valoraciones/[est_id]
 * Crear una nueva valoración
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ est_id: string }> }
) {
    const { supabase, response } = createClient(request)
    const { est_id } = await params

    try {
        const estId = parseInt(est_id)
        if (isNaN(estId)) {
            return NextResponse.json({ success: false, error: 'est_id inválido' }, { status: 400 })
        }

        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
        }

        // Obtener usu_id del usuario
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single()

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
        }

        // Parsear body
        const body: CreateValoracionRequest = await request.json()
        
        // Validar rating
        if (!body.rating || body.rating < 1 || body.rating > 5) {
            return NextResponse.json({ success: false, error: 'El rating debe estar entre 1 y 5' }, { status: 400 })
        }

        // Validar comentario (opcional, max 500 caracteres)
        if (body.comentario && body.comentario.length > 500) {
            return NextResponse.json({ success: false, error: 'El comentario no puede exceder 500 caracteres' }, { status: 400 })
        }

        // Verificar que el estacionamiento existe
        const { data: estData, error: estError } = await supabase
            .from('estacionamientos')
            .select('est_id')
            .eq('est_id', estId)
            .single()

        if (estError || !estData) {
            return NextResponse.json({ success: false, error: 'Estacionamiento no encontrado' }, { status: 404 })
        }

        // Insertar valoración (el constraint UNIQUE evitará duplicados)
        const { data: nuevaValoracion, error: insertError } = await supabase
            .from('estacionamiento_valoraciones')
            .insert({
                est_id: estId,
                usu_id: usuarioData.usu_id,
                val_rating: body.rating,
                val_comentario: body.comentario || null
            })
            .select()
            .single()

        if (insertError) {
            // Verificar si es error de duplicado
            if (insertError.code === '23505') {
                return NextResponse.json({ success: false, error: 'Ya has valorado este estacionamiento' }, { status: 409 })
            }
            console.error('Error insertando valoración:', insertError)
            return NextResponse.json({ success: false, error: insertError.message }, { status: 500 })
        }

        const responseData: ValoracionMutationResponse = {
            success: true,
            valoracion: nuevaValoracion
        }

        const jsonResponse = NextResponse.json(responseData, { status: 201 })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado en POST valoración:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

/**
 * PUT /api/valoraciones/[est_id]
 * Actualizar valoración propia
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ est_id: string }> }
) {
    const { supabase, response } = createClient(request)
    const { est_id } = await params

    try {
        const estId = parseInt(est_id)
        if (isNaN(estId)) {
            return NextResponse.json({ success: false, error: 'est_id inválido' }, { status: 400 })
        }

        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
        }

        // Obtener usu_id del usuario
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single()

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
        }

        // Parsear body
        const body: UpdateValoracionRequest = await request.json()
        
        // Validar rating
        if (!body.rating || body.rating < 1 || body.rating > 5) {
            return NextResponse.json({ success: false, error: 'El rating debe estar entre 1 y 5' }, { status: 400 })
        }

        // Validar comentario (opcional, max 500 caracteres)
        if (body.comentario && body.comentario.length > 500) {
            return NextResponse.json({ success: false, error: 'El comentario no puede exceder 500 caracteres' }, { status: 400 })
        }

        // Actualizar valoración (RLS garantiza que solo el dueño puede actualizar)
        const { data: valoracionActualizada, error: updateError } = await supabase
            .from('estacionamiento_valoraciones')
            .update({
                val_rating: body.rating,
                val_comentario: body.comentario || null,
                val_updated_at: new Date().toISOString()
            })
            .eq('est_id', estId)
            .eq('usu_id', usuarioData.usu_id)
            .select()
            .single()

        if (updateError) {
            console.error('Error actualizando valoración:', updateError)
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        if (!valoracionActualizada) {
            return NextResponse.json({ success: false, error: 'Valoración no encontrada' }, { status: 404 })
        }

        const responseData: ValoracionMutationResponse = {
            success: true,
            valoracion: valoracionActualizada
        }

        const jsonResponse = NextResponse.json(responseData)
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado en PUT valoración:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

/**
 * DELETE /api/valoraciones/[est_id]
 * Eliminar valoración propia
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ est_id: string }> }
) {
    const { supabase, response } = createClient(request)
    const { est_id } = await params

    try {
        const estId = parseInt(est_id)
        if (isNaN(estId)) {
            return NextResponse.json({ success: false, error: 'est_id inválido' }, { status: 400 })
        }

        // Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
        }

        // Obtener usu_id del usuario
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single()

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
        }

        // Eliminar valoración (RLS garantiza que solo el dueño puede eliminar)
        const { error: deleteError } = await supabase
            .from('estacionamiento_valoraciones')
            .delete()
            .eq('est_id', estId)
            .eq('usu_id', usuarioData.usu_id)

        if (deleteError) {
            console.error('Error eliminando valoración:', deleteError)
            return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
        }

        const responseData: DeleteValoracionResponse = {
            success: true,
            message: 'Valoración eliminada correctamente'
        }

        const jsonResponse = NextResponse.json(responseData)
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado en DELETE valoración:', err)
        return NextResponse.json({ success: false, error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

