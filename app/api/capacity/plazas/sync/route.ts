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
    const estIdParam = url.searchParams.get('est_id')
    const estId = Number(estIdParam) || 1
    
    console.log('🔧 Sincronizando plazas:', { 
      estIdParam, 
      estId, 
      target, 
      body,
      url: url.toString()
    });

    if (!estId || estId <= 0) {
      console.error('❌ ID de estacionamiento inválido:', { estIdParam, estId });
      return NextResponse.json({ 
        error: 'ID de estacionamiento inválido',
        received: estIdParam 
      }, { status: 400 })
    }

    const { data: plazas, error } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento')
      .eq('est_id', estId)

    if (error) {
      console.error('❌ Error obteniendo plazas existentes:', error);
      return NextResponse.json({ 
        error: `Error obteniendo plazas: ${error.message}`,
        details: error 
      }, { status: 500 })
    }

    console.log(`📊 Plazas existentes encontradas: ${(plazas || []).length}`, plazas);

    // Traer ocupaciones activas para no borrar plazas ocupadas
    // Conjunto de plazas en uso actualmente (ocupaciones abiertas)
    const { data: ocupActivas, error: occErr } = await supabase
      .from('ocupacion')
      .select('pla_numero')
      .eq('est_id', estId)
      .is('ocu_fh_salida', null)

    if (occErr) {
      console.error('❌ Error obteniendo ocupaciones activas:', occErr);
      return NextResponse.json({ 
        error: `Error obteniendo ocupaciones activas: ${occErr.message}`,
        details: occErr
      }, { status: 500 })
    }
    const occupiedSet = new Set((ocupActivas || []).map((o: any) => o.pla_numero).filter((n: any) => n != null));

    const currentCounts: Record<string, number> = { AUT: 0, MOT: 0, CAM: 0 }
    for (const p of plazas || []) {
      currentCounts[p.catv_segmento] = (currentCounts[p.catv_segmento] || 0) + 1
    }

    console.log(`📈 Conteo actual:`, currentCounts);
    console.log(`🎯 Objetivo:`, target);

    // Determinar diferencias y aplicar
    // Calcular un contador global de pla_numero para evitar colisiones entre segmentos
    let nextNumber = 1;
    if (plazas && plazas.length > 0) {
      try {
        const plazaNumbers = plazas.map(p => p.pla_numero as number).filter(n => !isNaN(n));
        if (plazaNumbers.length > 0) {
          nextNumber = Math.max(...plazaNumbers) + 1;
        }
      } catch (err) {
        console.error('❌ Error calculando próximo número de plaza:', err);
        console.log('📋 Plazas data:', plazas);
        // Fallback: usar longitud + 1
        nextNumber = plazas.length + 1;
      }
    }
    console.log(`🔢 Próximo número de plaza: ${nextNumber}`);

    // Procesar segmentos en orden fijo para mantener determinismo
    const segments: Array<'AUT'|'MOT'|'CAM'> = ['AUT', 'MOT', 'CAM']

    for (const seg of segments) {
      const diff = target[seg] - (currentCounts[seg] || 0)
      console.log(`🔄 Procesando ${seg}: actual=${currentCounts[seg] || 0}, objetivo=${target[seg]}, diferencia=${diff}`);
      
      if (diff > 0) {
        const rows = Array.from({ length: diff }).map(() => ({ est_id: estId, pla_numero: nextNumber++, pla_estado: 'Libre', catv_segmento: seg, pla_zona: null }))
        console.log(`➕ Insertando ${diff} plazas ${seg}:`, rows);
        const { error: insErr } = await supabase.from('plazas').insert(rows)
        if (insErr) {
          console.error('❌ Error insertando plazas:', insErr);
          return NextResponse.json({ 
            error: `Error insertando plazas: ${insErr.message}`,
            details: insErr 
          }, { status: 500 })
        }
      } else if (diff < 0) {
        const toDelete = Math.abs(diff)
        // Plazas del segmento actual
        const plazasSeg = (plazas || []).filter(p => p.catv_segmento === seg)
        // Candidatas libres (no ocupadas)
        const freeCandidates = plazasSeg
          .map(p => p.pla_numero)
          .filter(n => !occupiedSet.has(n))

        console.log(`🧮 Candidatas libres para borrar [${seg}]:`, freeCandidates)

        if (freeCandidates.length < toDelete) {
          const msg = `No se pueden reducir las plazas de ${seg}: hay ${plazasSeg.length} creadas y ${plazasSeg.length - freeCandidates.length} ocupadas. Libres: ${freeCandidates.length}, requerido borrar: ${toDelete}`
          console.error('❌ Reducción inválida:', msg)
          return NextResponse.json({ error: msg }, { status: 400 })
        }

        const ids = freeCandidates.slice(0, toDelete)
        if (ids.length > 0) {
          // Desasociar TODOS los registros que referencien estas plazas para no violar FK
          console.log(`🔗 Desasociando TODOS los registros de ocupacion para plazas ${seg}:`, ids)
          const { data: updatedRows, error: updHistErr } = await supabase
            .from('ocupacion')
            .update({ pla_numero: null })
            .eq('est_id', estId)
            .in('pla_numero', ids)
            .select('ocu_id')

          if (updHistErr) {
            console.error('❌ Error desasociando registros de ocupacion:', updHistErr)
            return NextResponse.json({
              error: `Error actualizando registros de ocupacion para liberar plazas: ${updHistErr.message}`,
              details: updHistErr
            }, { status: 500 })
          }

          console.log(`✅ Desasociados ${(updatedRows || []).length} registros de ocupacion`);

          console.log(`➖ Eliminando ${toDelete} plazas ${seg}:`, ids);
          const { error: delErr } = await supabase
            .from('plazas')
            .delete()
            .eq('est_id', estId)
            .in('pla_numero', ids)
          if (delErr) {
            console.error('❌ Error eliminando plazas:', delErr);
            return NextResponse.json({ 
              error: `Error eliminando plazas: ${delErr.message}`,
              details: delErr 
            }, { status: 500 })
          }
        }
      }
    }

    const json = NextResponse.json({ success: true, target })
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; json.cookies.set({name,value,...opt}) })
    return json
  } catch (err: any) {
    console.error('❌ Error general en sincronización de plazas:', err);
    return NextResponse.json({ 
      error: err.message || 'Error interno del servidor',
      details: err.stack || err.toString()
    }, { status: 500 })
  }
}



