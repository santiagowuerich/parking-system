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
        set(name, value, options) {
          response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options })
        },
        remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
      }
    }
  )

  try {
    // Opcionalmente permitir filtros por tiptar_nro y pla_tipo
    const url = new URL(request.url)
    const tiptar = Number(url.searchParams.get('tiptar')) || 1
    const pla = url.searchParams.get('pla') || 'Normal'
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

    const { data, error } = await supabase
      .from('tarifas')
      .select('catv_segmento, tar_precio, tar_f_desde, tiptar_nro, pla_tipo')
      .eq('tiptar_nro', tiptar)
      .eq('pla_tipo', pla)
      .eq('est_id', estId)
      .order('tar_f_desde', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ tarifas: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}


