// app/api/presets/[preset_id]/route.ts
// Endpoint para operaciones individuales de presets
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ preset_id: string }> }
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
        const presetId = Number(resolvedParams.preset_id)

        if (!presetId || isNaN(presetId)) {
            return NextResponse.json({
                error: 'ID de preset inválido'
            }, { status: 400 })
        }

        // Obtener el preset específico
        const { data: preset, error } = await supabase
            .from('plaza_presets')
            .select('*')
            .eq('preset_id', presetId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') { // No rows returned
                return NextResponse.json({
                    error: 'Preset no encontrado'
                }, { status: 404 })
            }
            console.error('Error obteniendo preset:', error)
            return NextResponse.json({
                error: error.message
            }, { status: 500 })
        }

        // Parsear las reglas de JSON string a objeto
        const presetWithParsedRules = {
            ...preset,
            reglas: JSON.parse(preset.reglas)
        }

        const jsonResponse = NextResponse.json({
            preset: presetWithParsedRules
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en GET /api/presets/[preset_id]:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ preset_id: string }> }
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
        const presetId = Number(resolvedParams.preset_id)
        const { preset_nombre, reglas } = await request.json()

        if (!presetId || isNaN(presetId)) {
            return NextResponse.json({
                error: 'ID de preset inválido'
            }, { status: 400 })
        }

        if (!preset_nombre && !reglas) {
            return NextResponse.json({
                error: 'Se debe proporcionar al menos preset_nombre o reglas para actualizar'
            }, { status: 400 })
        }

        // Verificar que el preset existe y obtener datos actuales
        const { data: currentPreset, error: getError } = await supabase
            .from('plaza_presets')
            .select('*')
            .eq('preset_id', presetId)
            .single()

        if (getError) {
            if (getError.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'Preset no encontrado'
                }, { status: 404 })
            }
            console.error('Error obteniendo preset actual:', getError)
            return NextResponse.json({
                error: getError.message
            }, { status: 500 })
        }

        // Preparar datos para actualizar
        const updateData: any = {}

        if (preset_nombre) {
            // Verificar que no exista otro preset con el mismo nombre en el mismo estacionamiento
            const { data: existingPreset, error: checkError } = await supabase
                .from('plaza_presets')
                .select('preset_id')
                .eq('est_id', currentPreset.est_id)
                .eq('preset_nombre', preset_nombre.trim())
                .neq('preset_id', presetId)
                .single()

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('Error verificando nombre duplicado:', checkError)
                return NextResponse.json({
                    error: 'Error al verificar duplicados'
                }, { status: 500 })
            }

            if (existingPreset) {
                return NextResponse.json({
                    error: `Ya existe otro preset con el nombre "${preset_nombre.trim()}"`,
                    error_code: 'DUPLICATE_PRESET'
                }, { status: 409 })
            }

            updateData.preset_nombre = preset_nombre.trim()
        }

        if (reglas) {
            if (!Array.isArray(reglas)) {
                return NextResponse.json({
                    error: 'El campo reglas debe ser un array'
                }, { status: 400 })
            }
            updateData.reglas = JSON.stringify(reglas)
        }

        // Actualizar el preset
        const { data: updatedPreset, error: updateError } = await supabase
            .from('plaza_presets')
            .update(updateData)
            .eq('preset_id', presetId)
            .select()
            .single()

        if (updateError) {
            console.error('Error actualizando preset:', updateError)
            return NextResponse.json({
                error: updateError.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            preset: {
                ...updatedPreset,
                reglas: JSON.parse(updatedPreset.reglas)
            }
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en PUT /api/presets/[preset_id]:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ preset_id: string }> }
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
        const presetId = Number(resolvedParams.preset_id)

        if (!presetId || isNaN(presetId)) {
            return NextResponse.json({
                error: 'ID de preset inválido'
            }, { status: 400 })
        }

        // Verificar que el preset existe antes de eliminarlo
        const { data: preset, error: getError } = await supabase
            .from('plaza_presets')
            .select('preset_id, preset_nombre')
            .eq('preset_id', presetId)
            .single()

        if (getError) {
            if (getError.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'Preset no encontrado'
                }, { status: 404 })
            }
            console.error('Error obteniendo preset:', getError)
            return NextResponse.json({
                error: getError.message
            }, { status: 500 })
        }

        // Eliminar el preset
        const { error: deleteError } = await supabase
            .from('plaza_presets')
            .delete()
            .eq('preset_id', presetId)

        if (deleteError) {
            console.error('Error eliminando preset:', deleteError)
            return NextResponse.json({
                error: deleteError.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            success: true,
            message: `Preset "${preset.preset_nombre}" eliminado exitosamente`
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en DELETE /api/presets/[preset_id]:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
