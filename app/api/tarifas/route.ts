import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        // Obtener est_id de los parámetros de la URL
        const { searchParams } = new URL(request.url)
        const est_id = searchParams.get('est_id')

        if (!est_id) {
            return NextResponse.json({ error: 'est_id es requerido' }, { status: 400 })
        }

        // Consultar tarifas con información de plantillas
        const { data: tarifas, error } = await supabase
            .from('tarifas')
            .select(`
                plantilla_id,
                tiptar_nro,
                tar_precio,
                plantillas!inner(
                    nombre_plantilla,
                    catv_segmento
                )
            `)
            .eq('est_id', est_id)
            .order('plantilla_id')
            .order('tiptar_nro')

        if (error) {
            console.error('Error obteniendo tarifas:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Agrupar tarifas por plantilla_id para facilitar el consumo en el frontend
        const tarifasPorPlantilla: Record<number, any> = {}

        tarifas?.forEach((tarifa: any) => {
            const plantillaId = tarifa.plantilla_id

            if (!tarifasPorPlantilla[plantillaId]) {
                tarifasPorPlantilla[plantillaId] = {
                    plantilla_id: plantillaId,
                    nombre_plantilla: tarifa.plantillas.nombre_plantilla,
                    catv_segmento: tarifa.plantillas.catv_segmento,
                    tarifas: {}
                }
            }

            // Agregar el tipo de tarifa con su precio
            tarifasPorPlantilla[plantillaId].tarifas[tarifa.tiptar_nro] = {
                precio: tarifa.tar_precio,
                tipo: tarifa.tiptar_nro
            }
        })

        // Convertir el objeto a array para respuesta
        const resultado = Object.values(tarifasPorPlantilla)

        const jsonResponse = NextResponse.json({
            success: true,
            tarifas: resultado
        })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado obteniendo tarifas:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        // Obtener est_id de los parámetros de la URL
        const { searchParams } = new URL(request.url)
        const est_id = searchParams.get('est_id')

        if (!est_id) {
            return NextResponse.json({ error: 'est_id es requerido' }, { status: 400 })
        }

        // Leer el cuerpo de la solicitud
        const body = await request.json()
        const { tarifas } = body

        if (!tarifas || !Array.isArray(tarifas)) {
            return NextResponse.json({ error: 'Se requiere un array de tarifas' }, { status: 400 })
        }

        // Obtener información de las plantillas para completar los campos requeridos
        const plantillaIds = [...new Set(tarifas.map(t => t.plantilla_id))]
        const { data: plantillasData, error: plantillasError } = await supabase
            .from('plantillas')
            .select('plantilla_id, catv_segmento')
            .in('plantilla_id', plantillaIds)
            .eq('est_id', est_id)

        if (plantillasError) {
            console.error('Error obteniendo plantillas:', plantillasError)
            return NextResponse.json({ error: 'Error obteniendo información de plantillas' }, { status: 500 })
        }

        // Crear mapa de plantillas para acceso rápido
        const plantillasMap = plantillasData?.reduce((acc, plantilla) => {
            acc[plantilla.plantilla_id] = plantilla
            return acc
        }, {} as Record<number, any>) || {}

        // Preparar los datos para el upsert
        const tarifasParaUpsert = []

        for (const tarifa of tarifas) {
            const { plantilla_id, tiptar_nro, tar_precio } = tarifa

            if (!plantilla_id || !tiptar_nro || tar_precio === undefined) {
                return NextResponse.json({
                    error: 'Cada tarifa debe tener plantilla_id, tiptar_nro y tar_precio'
                }, { status: 400 })
            }

            const plantillaInfo = plantillasMap[plantilla_id]
            if (!plantillaInfo) {
                return NextResponse.json({
                    error: `Plantilla con ID ${plantilla_id} no encontrada`
                }, { status: 400 })
            }

            tarifasParaUpsert.push({
                est_id: parseInt(est_id),
                plantilla_id: parseInt(plantilla_id),
                tiptar_nro: parseInt(tiptar_nro),
                tar_precio: parseFloat(tar_precio),
                catv_segmento: plantillaInfo.catv_segmento,
                tar_fraccion: 1, // Valor por defecto
                tar_f_desde: new Date().toISOString().split('T')[0] // Fecha actual
            })
        }

        // Realizar el upsert
        const { data, error } = await supabase
            .from('tarifas')
            .upsert(tarifasParaUpsert, {
                onConflict: 'est_id,plantilla_id,tiptar_nro',
                ignoreDuplicates: false
            })

        if (error) {
            console.error('Error guardando tarifas:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({
            success: true,
            message: 'Tarifas guardadas correctamente',
            tarifas_actualizadas: tarifasParaUpsert.length
        })
        return copyResponseCookies(response, jsonResponse)

    } catch (err: any) {
        console.error('Error inesperado guardando tarifas:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}

