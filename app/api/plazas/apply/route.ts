// app/api/plazas/apply/route.ts
// Endpoint para aplicar cambios de plantillas a plazas masivamente
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
        const body = await request.json()
        const { est_id, zona_id, acciones } = body

        if (!est_id || !zona_id || !acciones || !Array.isArray(acciones)) {
            return NextResponse.json({
                error: 'Faltan campos requeridos: est_id, zona_id, acciones (array)'
            }, { status: 400 })
        }

        // TODO: Validar que el usuario tenga acceso al estacionamiento
        // const { data: { user } } = await supabase.auth.getUser()
        // if (!user) return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })

        let updated = 0
        const warnings: string[] = []

        // Procesar cada acción
        for (const accion of acciones) {
            try {
                if (accion.tipo === 'APLICAR_PLANTILLA') {
                    if (!accion.plantilla_id || !accion.plazas || !Array.isArray(accion.plazas)) {
                        warnings.push(`Acción APLICAR_PLANTILLA inválida: faltan plantilla_id o plazas`)
                        continue
                    }

                    // Validar que la plantilla existe y pertenece al estacionamiento
                    const { data: plantilla, error: plantillaError } = await supabase
                        .from('plantillas')
                        .select('plantilla_id, nombre_plantilla, catv_segmento')
                        .eq('plantilla_id', accion.plantilla_id)
                        .eq('est_id', est_id)
                        .single()

                    if (plantillaError || !plantilla) {
                        warnings.push(`Plantilla ${accion.plantilla_id} no existe o no pertenece al estacionamiento`)
                        continue
                    }

                    // Aplicar plantilla usando la función de base de datos
                    const { data: result, error: applyError } = await supabase.rpc(
                        'fn_aplicar_plantilla_a_plazas',
                        {
                            p_est_id: est_id,
                            p_zona_id: zona_id,
                            p_plantilla_id: accion.plantilla_id,
                            p_plazas: accion.plazas
                        }
                    )

                    if (applyError) {
                        warnings.push(`Error aplicando plantilla ${plantilla.nombre_plantilla}: ${applyError.message}`)
                        continue
                    }

                    updated += (result || 0)

                } else if (accion.tipo === 'LIMPIAR_PLANTILLA') {
                    if (!accion.plazas || !Array.isArray(accion.plazas)) {
                        warnings.push(`Acción LIMPIAR_PLANTILLA inválida: faltan plazas`)
                        continue
                    }

                    // Limpiar plantillas usando la función de base de datos
                    const { data: result, error: clearError } = await supabase.rpc(
                        'fn_limpiar_plantilla_de_plazas',
                        {
                            p_est_id: est_id,
                            p_zona_id: zona_id,
                            p_plazas: accion.plazas
                        }
                    )

                    if (clearError) {
                        warnings.push(`Error limpiando plantillas: ${clearError.message}`)
                        continue
                    }

                    updated += (result || 0)

                } else {
                    warnings.push(`Tipo de acción desconocido: ${accion.tipo}`)
                }

            } catch (actionError: any) {
                warnings.push(`Error procesando acción ${accion.tipo}: ${actionError.message}`)
            }
        }

        const jsonResponse = NextResponse.json({
            updated,
            warnings,
            success: warnings.length === 0
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en POST /api/plazas/apply:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
