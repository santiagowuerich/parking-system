import { NextResponse, type NextRequest } from 'next/server'
import { createClient, copyResponseCookies } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request)

    try {
        const body = await request.json()
        const {
            abo_nro,
            tipoExtension,
            cantidad,
            nuevoVencimiento,
            metodoPago,
            monto,
            nota,
            tarjeta
        } = body || {}

        if (!abo_nro || !tipoExtension || !cantidad || !nuevoVencimiento || !metodoPago || !monto) {
            return NextResponse.json({ error: 'Datos requeridos faltantes' }, { status: 400 })
        }

        // 1) Obtener abono actual con vehículo principal
        const { data: abonoActual, error: abonoError } = await supabase
            .from('abonos')
            .select(`
        abo_fecha_fin, 
        est_id,
        vehiculos_abonados!inner(veh_patente)
      `)
            .eq('abo_nro', abo_nro)
            .limit(1)
            .single()

        if (abonoError || !abonoActual) {
            return copyResponseCookies(response, NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 }))
        }

        if (new Date(nuevoVencimiento) <= new Date(abonoActual.abo_fecha_fin)) {
            return copyResponseCookies(response, NextResponse.json({ error: 'El nuevo vencimiento debe ser posterior al actual' }, { status: 400 }))
        }

        // 2) Actualizar fecha de fin del abono
        const { error: updateError } = await supabase
            .from('abonos')
            .update({ abo_fecha_fin: nuevoVencimiento })
            .eq('abo_nro', abo_nro)

        if (updateError) {
            return copyResponseCookies(response, NextResponse.json({ error: `Error actualizando abono: ${updateError.message}` }, { status: 500 }))
        }

        // 3) Mapear método de pago a valores de BD
        const metodoMap: Record<string, string> = {
            'efectivo': 'Efectivo',
            'tarjeta': 'MercadoPago', // Tarjeta se mapea a MercadoPago
            'transferencia': 'Transferencia'
        }
        const mepaMetodo = metodoMap[metodoPago] || 'Efectivo'

        const vehPatente = (abonoActual as any)?.vehiculos_abonados?.[0]?.veh_patente || ''

        // 4) Registrar pago
        const insertPayload: any = {
            pag_monto: Number(monto),
            pag_h_fh: new Date().toISOString(),
            est_id: abonoActual.est_id,
            mepa_metodo: mepaMetodo,
            veh_patente: vehPatente,
            pag_tipo: 'extension',
            pag_descripcion: `Extensión ${tipoExtension} x${cantidad}${nota ? ` - ${nota}` : ''}`,
            pag_estado: 'completado',
            abo_nro: abo_nro
        }

        if (metodoPago === 'tarjeta' && tarjeta) {
            insertPayload.pag_datos_tarjeta = {
                numero: String(tarjeta.numero || '').slice(-4),
                vencimiento: tarjeta.vencimiento
            }
        }

        const { data: pago, error: pagoError } = await supabase
            .from('pagos')
            .insert([insertPayload])
            .select()
            .single()

        if (pagoError || !pago) {
            // rollback manual de fecha
            await supabase.from('abonos').update({ abo_fecha_fin: abonoActual.abo_fecha_fin }).eq('abo_nro', abo_nro)
            return copyResponseCookies(response, NextResponse.json({ error: `Error registrando pago: ${pagoError?.message}` }, { status: 500 }))
        }

        return copyResponseCookies(
            response,
            NextResponse.json({ success: true, data: { abo_nro, nuevoVencimiento, monto: Number(monto), metodoPago, pago_id: pago.pag_nro } })
        )
    } catch (err: any) {
        console.error('Error en extender:', err)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}


