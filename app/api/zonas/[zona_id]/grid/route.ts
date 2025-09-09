// app/api/zonas/[zona_id]/grid/route.ts
// Endpoint para configurar el grid/layout de una zona específica
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ zona_id: string }> }
) {
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name) { return request.cookies.get(name)?.value },
                set(name, value, options) { response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options }) },
                remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
            }
        }
    )

    try {
        const resolvedParams = await params;
        const zonaId = Number(resolvedParams.zona_id)

        if (!zonaId || isNaN(zonaId)) {
            return NextResponse.json({
                error: 'ID de zona inválido'
            }, { status: 400 })
        }

        // Obtener configuración de grid de la zona
        const { data: zona, error } = await supabase
            .from('zonas')
            .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
            .eq('zona_id', zonaId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'Zona no encontrada'
                }, { status: 404 })
            }
            console.error('Error obteniendo configuración de zona:', error)
            return NextResponse.json({
                error: error.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            zona: {
                zona_id: zona.zona_id,
                zona_nombre: zona.zona_nombre,
                grid: {
                    rows: zona.grid_rows || 1,
                    cols: zona.grid_cols || 1,
                    numbering: zona.grid_numbering || 'ROW_MAJOR'
                }
            }
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en GET /api/zonas/[zona_id]/grid:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ zona_id: string }> }
) {
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name) { return request.cookies.get(name)?.value },
                set(name, value, options) { response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options }) },
                remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
            }
        }
    )

    try {
        const resolvedParams = await params;
        const zonaId = Number(resolvedParams.zona_id)
        const { grid_rows, grid_cols, grid_numbering } = await request.json()

        if (!zonaId || isNaN(zonaId)) {
            return NextResponse.json({
                error: 'ID de zona inválido'
            }, { status: 400 })
        }

        // Validar parámetros
        if (grid_rows !== undefined && (grid_rows < 1 || grid_rows > 100)) {
            return NextResponse.json({
                error: 'grid_rows debe estar entre 1 y 100'
            }, { status: 400 })
        }

        if (grid_cols !== undefined && (grid_cols < 1 || grid_cols > 100)) {
            return NextResponse.json({
                error: 'grid_cols debe estar entre 1 y 100'
            }, { status: 400 })
        }

        if (grid_numbering !== undefined && !['ROW_MAJOR', 'COL_MAJOR'].includes(grid_numbering)) {
            return NextResponse.json({
                error: 'grid_numbering debe ser "ROW_MAJOR" o "COL_MAJOR"'
            }, { status: 400 })
        }

        // Verificar que la zona existe
        const { data: zonaExistente, error: zonaError } = await supabase
            .from('zonas')
            .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
            .eq('zona_id', zonaId)
            .single()

        if (zonaError) {
            if (zonaError.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'Zona no encontrada'
                }, { status: 404 })
            }
            console.error('Error obteniendo zona:', zonaError)
            return NextResponse.json({
                error: zonaError.message
            }, { status: 500 })
        }

        // Preparar datos para actualizar
        const updateData: any = {}

        if (grid_rows !== undefined) updateData.grid_rows = grid_rows
        if (grid_cols !== undefined) updateData.grid_cols = grid_cols
        if (grid_numbering !== undefined) updateData.grid_numbering = grid_numbering

        // Si no hay cambios, devolver la configuración actual
        if (Object.keys(updateData).length === 0) {
            const jsonResponse = NextResponse.json({
                zona: {
                    zona_id: zonaExistente.zona_id,
                    zona_nombre: zonaExistente.zona_nombre,
                    grid: {
                        rows: zonaExistente.grid_rows || 1,
                        cols: zonaExistente.grid_cols || 1,
                        numbering: zonaExistente.grid_numbering || 'ROW_MAJOR'
                    }
                },
                message: 'No se realizaron cambios'
            })

            response.cookies.getAll().forEach(c => {
                const { name, value, ...opt } = c
                jsonResponse.cookies.set({ name, value, ...opt })
            })

            return jsonResponse
        }

        // Actualizar configuración de grid
        const { data: zonaActualizada, error: updateError } = await supabase
            .from('zonas')
            .update(updateData)
            .eq('zona_id', zonaId)
            .select('zona_id, zona_nombre, grid_rows, grid_cols, grid_numbering')
            .single()

        if (updateError) {
            console.error('Error actualizando configuración de grid:', updateError)
            return NextResponse.json({
                error: updateError.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            zona: {
                zona_id: zonaActualizada.zona_id,
                zona_nombre: zonaActualizada.zona_nombre,
                grid: {
                    rows: zonaActualizada.grid_rows || 1,
                    cols: zonaActualizada.grid_cols || 1,
                    numbering: zonaActualizada.grid_numbering || 'ROW_MAJOR'
                }
            },
            message: 'Configuración de grid actualizada exitosamente'
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en PUT /api/zonas/[zona_id]/grid:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
