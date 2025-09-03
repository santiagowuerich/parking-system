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
    
    // 🕵️ LOGGING ESTRATÉGICO: Estado inicial de la plaza 10
    const plaza10 = (plazas || []).find(p => p.pla_numero === 10);
    if (plaza10) {
      console.log('🎯 ESTADO INICIAL DE PLAZA 10:', {
        existe: true,
        numero: plaza10.pla_numero,
        segmento: plaza10.catv_segmento,
        mensaje: 'Plaza 10 encontrada en la base de datos ANTES de la sincronización'
      });
    } else {
      console.log('🎯 ESTADO INICIAL DE PLAZA 10:', {
        existe: false,
        mensaje: 'Plaza 10 NO encontrada en la base de datos'
      });
    }

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
    
    // 🕵️ LOGGING ESTRATÉGICO: Estado de ocupación de la plaza 10
    const plaza10Ocupada = occupiedSet.has(10);
    console.log('🎯 ESTADO DE OCUPACIÓN PLAZA 10:', {
      ocupada: plaza10Ocupada,
      plazasOcupadas: Array.from(occupiedSet),
      mensaje: plaza10Ocupada ? 'Plaza 10 ESTÁ OCUPADA - NO debe ser eliminada' : 'Plaza 10 está libre'
    });

    const currentCounts: Record<string, number> = { AUT: 0, MOT: 0, CAM: 0 }
    for (const p of plazas || []) {
      currentCounts[p.catv_segmento] = (currentCounts[p.catv_segmento] || 0) + 1
    }

    console.log(`📈 Conteo actual:`, currentCounts);
    console.log(`🎯 Objetivo:`, target);

    // VALIDACIÓN: Verificar que no se esté reduciendo capacidad si hay vehículos en plazas con números altos
    for (const [seg, targetCount] of Object.entries(target)) {
      const currentCount = currentCounts[seg] || 0;
      
      if (targetCount < currentCount) {
        // Se está reduciendo la capacidad, verificar plazas ocupadas
        const segmentPlazas = (plazas || [])
          .filter(p => p.catv_segmento === seg)
          .map(p => p.pla_numero as number)
          .sort((a, b) => b - a); // Ordenar de mayor a menor
        
        // Verificar si hay vehículos en plazas que quedarían fuera del nuevo límite
        const plazasToRemove = segmentPlazas.slice(0, currentCount - targetCount);
        const occupiedPlazasToRemove = plazasToRemove.filter(pla => occupiedSet.has(pla));
        
        if (occupiedPlazasToRemove.length > 0) {
          const vehicleTypeSpanish = seg === 'AUT' ? 'Autos' : seg === 'MOT' ? 'Motos' : 'Camionetas';
          console.error(`❌ No se puede reducir capacidad de ${vehicleTypeSpanish}: hay vehículos en plazas ${occupiedPlazasToRemove.join(', ')}`);
          return NextResponse.json({ 
            error: `No se puede reducir la capacidad de ${vehicleTypeSpanish} a ${targetCount}. Hay vehículos estacionados en las plazas: ${occupiedPlazasToRemove.join(', ')}. Debe retirar estos vehículos antes de reducir la capacidad.`,
            occupiedPlazas: occupiedPlazasToRemove
          }, { status: 400 });
        }
      }
    }

    // Aplicar cambios de manera inteligente y no destructiva

    // Procesar segmentos en orden fijo para mantener determinismo
    const segments: Array<'AUT'|'MOT'|'CAM'> = ['AUT', 'MOT', 'CAM']

    for (const seg of segments) {
      const currentCount = currentCounts[seg] || 0;
      const targetCount = target[seg];
      const diff = targetCount - currentCount;
      
      console.log(`🔄 Procesando ${seg}: actual=${currentCount}, objetivo=${targetCount}, diferencia=${diff}`);
      
      if (diff > 0) {
        // INCREMENTO: Agregar solo las plazas faltantes
        console.log(`📈 Incrementando ${seg}: agregando ${diff} plazas`);
        
        // Encontrar el número más alto existente GLOBALMENTE (todos los segmentos)
        // para evitar conflictos de numeración entre tipos de vehículos
        const allPlazaNumbers = (plazas || [])
          .map(p => p.pla_numero as number)
          .filter(n => !isNaN(n));
        
        let startNumber = 1;
        let maxExisting = 0;
        if (allPlazaNumbers.length > 0) {
          maxExisting = Math.max(...allPlazaNumbers);
          startNumber = maxExisting + 1;
        }
        
        console.log(`🔢 Numeración global: máximo actual ${maxExisting}, empezando desde ${startNumber}`);
        
        // Crear solo las plazas nuevas necesarias
        const newPlazas = Array.from({ length: diff }).map((_, i) => ({
          est_id: estId,
          pla_numero: startNumber + i,
          pla_estado: 'Libre',
          catv_segmento: seg,
          pla_zona: null
        }));
        
        console.log(`➕ Creando plazas ${seg} desde #${startNumber} hasta #${startNumber + diff - 1}:`, newPlazas.map(p => p.pla_numero));
        
        const { error: insErr } = await supabase.from('plazas').insert(newPlazas);
        if (insErr) {
          console.error('❌ Error insertando plazas:', insErr);
          return NextResponse.json({ 
            error: `Error insertando plazas ${seg}: ${insErr.message}`,
            details: insErr 
          }, { status: 500 })
        }
        
        console.log(`✅ Agregadas ${diff} plazas ${seg} exitosamente`);
        
      } else if (diff < 0) {
        // REDUCCIÓN: Eliminar solo plazas fuera del nuevo rango
        const toDelete = Math.abs(diff);
        console.log(`📉 Reduciendo ${seg}: eliminando ${toDelete} plazas`);
        
        // Obtener plazas del segmento actual ordenadas por número
        const segmentPlazas = (plazas || [])
          .filter(p => p.catv_segmento === seg)
          .map(p => p.pla_numero as number)
          .filter(n => !isNaN(n))
          .sort((a, b) => b - a); // Ordenar de mayor a menor
        
        // Identificar plazas que deben eliminarse (números > targetCount)
        const plazasToRemove = segmentPlazas.filter(num => num > targetCount);
        
        // De esas, identificar cuáles están libres (no ocupadas)
        const freePlazasToRemove = plazasToRemove.filter(num => !occupiedSet.has(num));
        
        console.log(`🎯 Plazas ${seg} candidatas a eliminar (> ${targetCount}):`, plazasToRemove);
        console.log(`🟢 Plazas ${seg} libres que pueden eliminarse:`, freePlazasToRemove);
        console.log(`🔴 Plazas ${seg} ocupadas que NO pueden eliminarse:`, plazasToRemove.filter(num => occupiedSet.has(num)));
        
        // 🕵️ LOGGING ESTRATÉGICO: Verificar específicamente la plaza 10
        if (seg === 'AUT') { // Asumiendo que la plaza 10 es de autos
          const plaza10EnCandidatas = plazasToRemove.includes(10);
          const plaza10EnLibres = freePlazasToRemove.includes(10);
          console.log('🎯 ANÁLISIS ESPECÍFICO PLAZA 10:', {
            esCandidataParaEliminar: plaza10EnCandidatas,
            puedeSerEliminada: plaza10EnLibres,
            targetCount,
            razonamiento: plaza10EnCandidatas ? 
              `Plaza 10 > ${targetCount}, por eso es candidata` : 
              `Plaza 10 <= ${targetCount}, NO debe ser tocada`,
            decision: plaza10EnLibres ? 
              '⚠️ PLAZA 10 SERÁ ELIMINADA' : 
              '✅ PLAZA 10 SERÁ PRESERVADA'
          });
        }
        
        // Verificar que tengamos suficientes plazas libres para eliminar
        if (freePlazasToRemove.length < toDelete) {
          const occupiedBlockingPlazas = plazasToRemove.filter(num => occupiedSet.has(num));
          const vehicleTypeSpanish = seg === 'AUT' ? 'Autos' : seg === 'MOT' ? 'Motos' : 'Camionetas';
          
          const msg = `No se puede reducir la capacidad de ${vehicleTypeSpanish} a ${targetCount}. ` +
                     `Se necesita eliminar ${toDelete} plazas, pero solo ${freePlazasToRemove.length} están libres. ` +
                     `Plazas ocupadas que bloquean la reducción: ${occupiedBlockingPlazas.join(', ')}`;
          
          console.error('❌ Reducción bloqueada por plazas ocupadas:', msg);
          return NextResponse.json({ 
            error: msg,
            occupiedPlazas: occupiedBlockingPlazas
          }, { status: 400 });
        }
        
        // Eliminar solo las plazas necesarias (de mayor a menor número)
        const plazasToDelete = freePlazasToRemove.slice(0, toDelete);
        
        if (plazasToDelete.length > 0) {
          console.log(`🗑️ Eliminando plazas ${seg}:`, plazasToDelete);
          
          // Primero, desasociar cualquier referencia histórica a estas plazas
          const { data: updatedRows, error: updHistErr } = await supabase
            .from('ocupacion')
            .update({ pla_numero: null })
            .eq('est_id', estId)
            .in('pla_numero', plazasToDelete)
            .select('ocu_id');

          if (updHistErr) {
            console.error('❌ Error desasociando registros históricos:', updHistErr);
            return NextResponse.json({
              error: `Error actualizando registros históricos: ${updHistErr.message}`,
              details: updHistErr
            }, { status: 500 });
          }

          console.log(`🔗 Desasociados ${(updatedRows || []).length} registros históricos`);

          // Ahora eliminar las plazas físicamente
          const { error: delErr } = await supabase
            .from('plazas')
            .delete()
            .eq('est_id', estId)
            .in('pla_numero', plazasToDelete);
            
          if (delErr) {
            console.error('❌ Error eliminando plazas:', delErr);
            return NextResponse.json({ 
              error: `Error eliminando plazas ${seg}: ${delErr.message}`,
              details: delErr 
            }, { status: 500 });
          }
          
          console.log(`✅ Eliminadas ${plazasToDelete.length} plazas ${seg} exitosamente`);
        }
      } else {
        // Sin cambios para este segmento
        console.log(`➡️ Sin cambios para ${seg} (ya tiene ${currentCount} plazas)`);
      }
    }

    // 🕵️ LOGGING ESTRATÉGICO: Estado final de la plaza 10
    const { data: plazasFinales } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento')
      .eq('est_id', estId)
      .eq('pla_numero', 10);
    
    const plaza10Final = plazasFinales?.[0];
    console.log('🎯 ESTADO FINAL DE PLAZA 10:', {
      existe: !!plaza10Final,
      numero: plaza10Final?.pla_numero,
      segmento: plaza10Final?.catv_segmento,
      mensaje: plaza10Final ? 
        'Plaza 10 SOBREVIVIÓ la sincronización ✅' : 
        'Plaza 10 fue ELIMINADA durante la sincronización ❌'
    });

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



