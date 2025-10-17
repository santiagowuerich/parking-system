import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

const TIPTAR_MAP: Record<'mensual' | 'semanal', number> = {
    mensual: 3,
    semanal: 4,
}

// Devuelve el precio por período (semana/mes) para una plaza basado en su plantilla de tarifa
export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { searchParams } = new URL(request.url)
        const est_id = Number(searchParams.get('est_id'))
        const pla_numero = Number(searchParams.get('pla_numero'))
        const tipo = (String(searchParams.get('tipo') || 'mensual') as 'mensual' | 'semanal')

        if (!est_id || !pla_numero) {
            return NextResponse.json({ error: 'est_id y pla_numero son requeridos' }, { status: 400 })
        }

        // 1) Traer plaza -> plantilla
        const { data: plazaData, error: plazaError } = await supabase
            .from('plazas')
            .select('est_id, pla_numero, plantilla_id')
            .eq('est_id', est_id)
            .eq('pla_numero', pla_numero)
            .single()

        if (plazaError || !plazaData) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Plaza no encontrada' }, { status: 404 }))
        }

        const plantillaId = plazaData.plantilla_id
        if (!plantillaId) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Plaza sin plantilla asignada' }, { status: 400 }))
        }

        const tiptar = TIPTAR_MAP[tipo] ?? TIPTAR_MAP.mensual

        // 2) Obtener tarifa base por plantilla y periodo
        const { data: tarifa, error: tarifaError } = await supabase
            .from('tarifas')
            .select('tar_precio')
            .eq('est_id', est_id)
            .eq('tiptar_nro', tiptar)
            .eq('plantilla_id', plantillaId)
            .order('tar_f_desde', { ascending: false })
            .limit(1)
            .single()

        if (tarifaError || !tarifa) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Tarifa no encontrada para plantilla' }, { status: 404 }))
        }

        const precioPorPeriodo = Number(tarifa.tar_precio ?? 0)

        return copyResponseCookies(
            response,
            NextResponse.json({ precioPorPeriodo, tarifaBase: precioPorPeriodo, tipo })
        )
    } catch (err: any) {
        console.error('Error en plaza-period-price:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
