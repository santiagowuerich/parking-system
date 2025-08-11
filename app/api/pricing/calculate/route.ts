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
    const vehicleType = String(body?.vehicleType || '')
    const entryTimeStr = String(body?.entry_time || '')
    const exitTimeStr = String(body?.exit_time || '')
    const modalidad = String(body?.modalidad || 'Hora')
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1
    const plaRaw = String(body?.pla_tipo || 'Normal')
    const allowedPla = ['Normal','VIP','Reservada']
    const pla = allowedPla.includes(plaRaw) ? plaRaw : 'Normal'

    if (!vehicleType || !entryTimeStr || !exitTimeStr) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const entry = new Date(entryTimeStr)
    const exit = new Date(exitTimeStr)
    const ms = Math.max(0, exit.getTime() - entry.getTime())
    const minutes = ms / (1000 * 60)
    const hours = Math.max(1, Math.ceil(minutes / 60))

    const seg = vehicleType === 'Moto' ? 'MOT' : vehicleType === 'Camioneta' ? 'CAM' : 'AUT'
    const tiptar = /diar/i.test(modalidad) ? 2 : /mens/i.test(modalidad) ? 3 : 1

    const { data, error } = await supabase
      .from('tarifas')
      .select('tar_precio')
      .eq('est_id', estId)
      .eq('tiptar_nro', tiptar)
      .eq('pla_tipo', pla)
      .eq('catv_segmento', seg)
      .order('tar_f_desde', { ascending: false })
      .limit(1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const price = Number(data?.[0]?.tar_precio || 0)
    const fee = price > 0 ? price * hours : 0

    const json = NextResponse.json({ fee, hours, rate: price })
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; json.cookies.set({name,value,...opt}) })
    return json
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}



