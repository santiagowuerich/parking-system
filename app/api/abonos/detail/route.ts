import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const { searchParams } = new URL(request.url)
        const abo_nro = Number(searchParams.get('abo_nro'))

        if (!abo_nro) {
            return NextResponse.json({ error: 'abo_nro requerido' }, { status: 400 })
        }

        // 1) Obtener abono con detalles
        const { data: abono, error: abonoError } = await supabase
            .from('abonos')
            .select(`
        abo_nro,
        abo_fecha_inicio,
        abo_fecha_fin,
        abo_tipoabono,
        pla_numero,
        est_id,
        abon_id,
        abonado(abon_id, abon_nombre, abon_apellido, abon_dni),
        plazas(pla_zona)
      `)
            .eq('abo_nro', abo_nro)
            .single()

        if (abonoError || !abono) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 }))
        }

        // 2) Obtener vehículos asociados
        const { data: vehiculos, error: vehError } = await supabase
            .from('vehiculos_abonados')
            .select('veh_patente, vehiculos(veh_marca, veh_modelo, veh_color, catv_segmento)')
            .eq('abo_nro', abo_nro)

        if (vehError) {
            console.error('Error obteniendo vehículos:', vehError)
        }

        // 3) Obtener datos del conductor (usuario)
        const { data: conductor, error: condError } = await supabase
            .from('usuario')
            .select('usu_nom, usu_ape, usu_dni, usu_email, usu_tel')
            .eq('usu_id', (abono as any)?.abonado?.abon_id)
            .single()

        if (condError) {
            console.error('Error obteniendo conductor:', condError)
        }

        // 4) Obtener historial de pagos
        const { data: pagos, error: pagosError } = await supabase
            .from('pagos')
            .select('pag_nro, pag_monto, pag_h_fh, mepa_metodo, pag_tipo, pag_descripcion, pag_estado')
            .eq('abo_nro', abo_nro)
            .order('pag_h_fh', { ascending: false })

        if (pagosError) {
            console.error('Error obteniendo pagos:', pagosError)
        }

        return copyResponseCookies(
            response,
            NextResponse.json({
                abono,
                conductor,
                vehiculos: vehiculos || [],
                pagos: pagos || []
            })
        )
    } catch (err: any) {
        console.error('Error en detail:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
