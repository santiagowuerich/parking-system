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
        set(name, value, options) {
          response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options })
        },
        remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
      }
    }
  )

  try {
    const body = await request.json()
    const target = {
      AUT: Number(body?.Auto || 0),
      MOT: Number(body?.Moto || 0),
      CAM: Number(body?.Camioneta || 0)
    }

    // Traer plazas actuales por segmento
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1

    const { data: plazas, error } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento')
      .eq('est_id', estId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const currentCounts: Record<string, number> = { AUT: 0, MOT: 0, CAM: 0 }
    for (const p of plazas || []) currentCounts[p.catv_segmento] = (currentCounts[p.catv_segmento] || 0) + 1

    // Determinar diferencias y aplicar
    // Calcular un contador global de pla_numero para evitar colisiones entre segmentos
    let nextNumber = ((plazas || []).length ? Math.max(...(plazas || []).map(p => p.pla_numero as number)) : 0) + 1

    // Procesar segmentos en orden fijo para mantener determinismo
    const segments: Array<'AUT'|'MOT'|'CAM'> = ['AUT', 'MOT', 'CAM']

    for (const seg of segments) {
      const diff = target[seg] - (currentCounts[seg] || 0)
      if (diff > 0) {
        const rows = Array.from({ length: diff }).map(() => ({ est_id: estId, pla_numero: nextNumber++, pla_estado: 'Libre', catv_segmento: seg, pla_zona: null }))
        const { error: insErr } = await supabase.from('plazas').insert(rows)
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
      } else if (diff < 0) {
        const toDelete = Math.abs(diff)
        const ids = (plazas || []).filter(p => p.catv_segmento === seg).slice(0, toDelete).map(p => p.pla_numero)
        if (ids.length > 0) {
          const { error: delErr } = await supabase.from('plazas').delete().eq('est_id', estId).in('pla_numero', ids)
          if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
        }
      }
    }

    const json = NextResponse.json({ success: true, target })
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; json.cookies.set({name,value,...opt}) })
    return json
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}


