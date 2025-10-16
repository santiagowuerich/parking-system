import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

// Devuelve el precio por período para extender un abono basado en la plantilla de su plaza
export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { searchParams } = new URL(request.url)
        const abo_nro = Number(searchParams.get('abo_nro'))
        const tipo = String(searchParams.get('tipo') || 'mensual') as 'mensual' | 'bimestral' | 'trimestral' | 'anual'

        if (!abo_nro) {
            return NextResponse.json({ error: 'abo_nro requerido' }, { status: 400 })
        }

        // 1) Traer abono -> plaza -> plantilla
        const { data: abonoData, error: abonoError } = await supabase
            .from('abonos')
            .select('est_id, pla_numero, plazas(plantilla_id)')
            .eq('abo_nro', abo_nro)
            .single()

        if (abonoError || !abonoData) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 }))
        }

        const plantillaId = (abonoData as any)?.plazas?.plantilla_id
        if (!plantillaId) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Plaza sin plantilla asignada' }, { status: 400 }))
        }

        // 2) tiptar para MES (3) según esquema existente
        const tiptar = 3

        // 3) Obtener tarifa base por plantilla
        const { data: tarifa, error: tarifaError } = await supabase
            .from('tarifas')
            .select('tar_precio')
            .eq('est_id', abonoData.est_id)
            .eq('tiptar_nro', tiptar)
            .eq('plantilla_id', plantillaId)
            .order('tar_f_desde', { ascending: false })
            .limit(1)
            .single()

        if (tarifaError || !tarifa) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Tarifa no encontrada para plantilla' }, { status: 404 }))
        }

        let precioPorPeriodo = Number(tarifa.tar_precio || 0)
        if (tipo === 'bimestral') precioPorPeriodo *= 2
        if (tipo === 'trimestral') precioPorPeriodo *= 3
        if (tipo === 'anual') precioPorPeriodo *= 12

        return copyResponseCookies(
            response,
            NextResponse.json({ precioPorPeriodo, tarifaBase: Number(tarifa.tar_precio), tipo })
        )
    } catch (err: any) {
        console.error('Error en period-price:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}


