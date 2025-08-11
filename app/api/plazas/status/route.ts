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
        set(name, value, options) { response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options }) },
        remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
      }
    }
  )

  try {
    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

    const [{ data: plazas, error: ePlazas }, { data: ocup, error: eOcup }] = await Promise.all([
      supabase.from('plazas').select('pla_numero, catv_segmento').eq('est_id', estId),
      supabase.from('ocupacion').select('pla_numero').eq('est_id', estId).is('ocu_fh_salida', null)
    ])

    if (ePlazas || eOcup) {
      const err = ePlazas || eOcup
      return NextResponse.json({ error: err!.message }, { status: 500 })
    }

    const occupiedSet = new Set<number>((ocup || []).map(o => o.pla_numero as number))
    const bySeg: Record<'AUT'|'MOT'|'CAM', { total: number, occupied: number, free: number, plazas: { pla_numero: number, occupied: boolean }[] }> = {
      AUT: { total: 0, occupied: 0, free: 0, plazas: [] },
      MOT: { total: 0, occupied: 0, free: 0, plazas: [] },
      CAM: { total: 0, occupied: 0, free: 0, plazas: [] },
    }

    for (const p of plazas || []) {
      const seg = (p.catv_segmento as 'AUT'|'MOT'|'CAM') || 'AUT'
      const occ = occupiedSet.has(p.pla_numero as number)
      bySeg[seg].total += 1
      if (occ) bySeg[seg].occupied += 1
      bySeg[seg].plazas.push({ pla_numero: p.pla_numero as number, occupied: occ })
    }
    (['AUT','MOT','CAM'] as const).forEach(seg => { bySeg[seg].free = Math.max(0, bySeg[seg].total - bySeg[seg].occupied) })

    const json = NextResponse.json({ est_id: estId, byType: bySeg })
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; json.cookies.set({name,value,...opt}) })
    return json
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}



