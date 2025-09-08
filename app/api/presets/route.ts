// app/api/presets/route.ts
// Endpoint para gestionar presets de configuración de plazas
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
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
        const url = new URL(request.url)
        const estId = Number(url.searchParams.get('est_id'))

        if (!estId) {
            return NextResponse.json({
                error: 'Se requiere parámetro est_id'
            }, { status: 400 })
        }

        // Obtener todos los presets del estacionamiento
        const { data: presets, error } = await supabase
            .from('plaza_presets')
            .select('*')
            .eq('est_id', estId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error obteniendo presets:', error)
            return NextResponse.json({
                error: error.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            presets: presets || []
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en GET /api/presets:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
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
        const { est_id, preset_nombre, reglas } = await request.json()

        if (!est_id || !preset_nombre || !reglas) {
            return NextResponse.json({
                error: 'Faltan campos requeridos: est_id, preset_nombre, reglas'
            }, { status: 400 })
        }

        // Validar formato de reglas (debe ser array de objetos)
        if (!Array.isArray(reglas)) {
            return NextResponse.json({
                error: 'El campo reglas debe ser un array'
            }, { status: 400 })
        }

        // Verificar que no exista un preset con el mismo nombre
        const { data: existingPreset, error: checkError } = await supabase
            .from('plaza_presets')
            .select('preset_id')
            .eq('est_id', est_id)
            .eq('preset_nombre', preset_nombre.trim())
            .single()

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error verificando preset existente:', checkError)
            return NextResponse.json({
                error: 'Error al verificar duplicados'
            }, { status: 500 })
        }

        if (existingPreset) {
            return NextResponse.json({
                error: `Ya existe un preset con el nombre "${preset_nombre.trim()}"`,
                error_code: 'DUPLICATE_PRESET'
            }, { status: 409 })
        }

        // Crear el preset
        const { data: preset, error: insertError } = await supabase
            .from('plaza_presets')
            .insert({
                est_id,
                preset_nombre: preset_nombre.trim(),
                reglas: JSON.stringify(reglas) // Convertir a JSON para almacenar
            })
            .select()
            .single()

        if (insertError) {
            console.error('Error creando preset:', insertError)
            return NextResponse.json({
                error: insertError.message
            }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            preset: {
                ...preset,
                reglas: JSON.parse(preset.reglas) // Parsear de vuelta para devolver
            }
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en POST /api/presets:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
