// app/api/presets/apply/route.ts
// Endpoint para aplicar un preset existente a una zona
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
        const { est_id, zona_id, preset_id } = await request.json()

        if (!est_id || !zona_id || !preset_id) {
            return NextResponse.json({
                error: 'Faltan campos requeridos: est_id, zona_id, preset_id'
            }, { status: 400 })
        }

        // Obtener el preset y sus reglas
        const { data: preset, error: presetError } = await supabase
            .from('plaza_presets')
            .select('*')
            .eq('preset_id', preset_id)
            .eq('est_id', est_id)
            .single()

        if (presetError) {
            if (presetError.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'Preset no encontrado o no pertenece al estacionamiento'
                }, { status: 404 })
            }
            console.error('Error obteniendo preset:', presetError)
            return NextResponse.json({
                error: presetError.message
            }, { status: 500 })
        }

        // Parsear las reglas del preset
        let reglas
        try {
            reglas = JSON.parse(preset.reglas)
        } catch (parseError) {
            console.error('Error parseando reglas del preset:', parseError)
            return NextResponse.json({
                error: 'Las reglas del preset están corruptas'
            }, { status: 500 })
        }

        if (!Array.isArray(reglas)) {
            return NextResponse.json({
                error: 'Las reglas del preset deben ser un array'
            }, { status: 500 })
        }

        // Convertir las reglas del preset a acciones para la API de plazas
        const acciones = []

        for (const regla of reglas) {
            try {
                if (!regla.selector || !regla.plantilla_id) {
                    console.warn('Regla inválida en preset:', regla)
                    continue
                }

                // Determinar las plazas basadas en el selector
                let plazasSeleccionadas: number[] = []

                if (regla.selector.tipo === 'individual' && regla.selector.plazas) {
                    // Selector individual: plazas específicas
                    plazasSeleccionadas = regla.selector.plazas

                } else if (regla.selector.tipo === 'rango' && regla.selector.desde && regla.selector.hasta) {
                    // Selector por rango: desde-hasta
                    plazasSeleccionadas = []
                    for (let i = regla.selector.desde; i <= regla.selector.hasta; i++) {
                        plazasSeleccionadas.push(i)
                    }

                } else if (regla.selector.tipo === 'fila' && regla.selector.filas) {
                    // Selector por filas: obtener plazas de las filas especificadas
                    // Esto requiere conocer el layout de la zona (grid_rows, grid_cols)
                    const { data: zona, error: zonaError } = await supabase
                        .from('zonas')
                        .select('grid_rows, grid_cols, grid_numbering')
                        .eq('zona_id', zona_id)
                        .single()

                    if (zonaError) {
                        console.error('Error obteniendo configuración de zona:', zonaError)
                        continue
                    }

                    if (zona.grid_rows && zona.grid_cols) {
                        plazasSeleccionadas = calcularPlazasPorFilas(
                            regla.selector.filas,
                            zona.grid_rows,
                            zona.grid_cols,
                            zona.grid_numbering
                        )
                    }

                } else if (regla.selector.tipo === 'columna' && regla.selector.columnas) {
                    // Selector por columnas: obtener plazas de las columnas especificadas
                    const { data: zona, error: zonaError } = await supabase
                        .from('zonas')
                        .select('grid_rows, grid_cols, grid_numbering')
                        .eq('zona_id', zona_id)
                        .single()

                    if (zonaError) {
                        console.error('Error obteniendo configuración de zona:', zonaError)
                        continue
                    }

                    if (zona.grid_rows && zona.grid_cols) {
                        plazasSeleccionadas = calcularPlazasPorColumnas(
                            regla.selector.columnas,
                            zona.grid_rows,
                            zona.grid_cols,
                            zona.grid_numbering
                        )
                    }
                }

                // Crear acción para aplicar plantilla
                if (plazasSeleccionadas.length > 0) {
                    acciones.push({
                        tipo: 'APLICAR_PLANTILLA',
                        plantilla_id: regla.plantilla_id,
                        plazas: plazasSeleccionadas
                    })
                }

            } catch (reglaError: any) {
                console.error('Error procesando regla del preset:', reglaError)
                // Continuar con la siguiente regla
            }
        }

        if (acciones.length === 0) {
            return NextResponse.json({
                error: 'El preset no contiene reglas válidas o aplicables'
            }, { status: 400 })
        }

        // Aplicar las acciones usando la función de base de datos
        let updated = 0
        const warnings: string[] = []

        for (const accion of acciones) {
            try {
                if (accion.tipo === 'APLICAR_PLANTILLA') {
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
                        warnings.push(`Error aplicando plantilla ${accion.plantilla_id}: ${applyError.message}`)
                        continue
                    }

                    updated += (result || 0)
                }

            } catch (actionError: any) {
                warnings.push(`Error procesando acción: ${actionError.message}`)
            }
        }

        const jsonResponse = NextResponse.json({
            updated,
            warnings,
            preset_aplicado: preset.preset_nombre,
            success: warnings.length === 0
        })

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado en POST /api/presets/apply:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}

// Función auxiliar para calcular plazas por filas
function calcularPlazasPorFilas(
    filasSeleccionadas: number[],
    totalFilas: number,
    totalColumnas: number,
    numbering: string
): number[] {
    const plazas: number[] = []

    for (const fila of filasSeleccionadas) {
        if (fila < 1 || fila > totalFilas) continue

        for (let col = 1; col <= totalColumnas; col++) {
            let numeroPlaza: number

            if (numbering === 'ROW_MAJOR') {
                // Numeración por filas: fila 1: 1,2,3... / fila 2: 4,5,6...
                numeroPlaza = (fila - 1) * totalColumnas + col
            } else {
                // Numeración por columnas: columna 1: 1,2,3... / columna 2: 4,5,6...
                numeroPlaza = (col - 1) * totalFilas + fila
            }

            plazas.push(numeroPlaza)
        }
    }

    return plazas
}

// Función auxiliar para calcular plazas por columnas
function calcularPlazasPorColumnas(
    columnasSeleccionadas: number[],
    totalFilas: number,
    totalColumnas: number,
    numbering: string
): number[] {
    const plazas: number[] = []

    for (const col of columnasSeleccionadas) {
        if (col < 1 || col > totalColumnas) continue

        for (let fila = 1; fila <= totalFilas; fila++) {
            let numeroPlaza: number

            if (numbering === 'ROW_MAJOR') {
                numeroPlaza = (fila - 1) * totalColumnas + col
            } else {
                numeroPlaza = (col - 1) * totalFilas + fila
            }

            plazas.push(numeroPlaza)
        }
    }

    return plazas
}
