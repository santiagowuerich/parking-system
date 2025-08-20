import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando reset completo de plazas...');
    
    const { estId, target } = await request.json();
    
    if (!estId || !target) {
      return NextResponse.json({ error: 'Missing estId or target' }, { status: 400 });
    }

    console.log('📋 Reset para estacionamiento:', estId, 'con capacidades:', target);

    // 1. Liberar todas las ocupaciones de plazas específicas (ponerlas en null)
    console.log('🔓 Liberando todas las ocupaciones...');
    const { error: freeOccupationsErr } = await supabase
      .from('ocupacion')
      .update({ pla_numero: null })
      .eq('est_id', estId)
      .not('pla_numero', 'is', null);

    if (freeOccupationsErr) {
      console.error('❌ Error liberando ocupaciones:', freeOccupationsErr);
      return NextResponse.json({ error: 'Error liberando ocupaciones' }, { status: 500 });
    }

    // 2. Eliminar todas las plazas existentes
    console.log('🗑️ Eliminando todas las plazas existentes...');
    const { error: deleteErr } = await supabase
      .from('plazas')
      .delete()
      .eq('est_id', estId);

    if (deleteErr) {
      console.error('❌ Error eliminando plazas:', deleteErr);
      return NextResponse.json({ error: 'Error eliminando plazas' }, { status: 500 });
    }

    // 3. Crear nuevas plazas con numeración consecutiva
    console.log('🏗️ Creando nuevas plazas con numeración consecutiva...');
    
    const segments = [
      { key: 'AUT', count: target.AUT || 0 },
      { key: 'MOT', count: target.MOT || 0 },
      { key: 'CAM', count: target.CAM || 0 }
    ];

    let currentNumber = 1;
    
    for (const segment of segments) {
      if (segment.count > 0) {
        console.log(`🔢 Creando ${segment.count} plazas ${segment.key} desde el número ${currentNumber}`);
        
        const plazasToCreate = [];
        for (let i = 0; i < segment.count; i++) {
          plazasToCreate.push({
            est_id: estId,
            pla_numero: currentNumber + i,
            catv_segmento: segment.key
          });
        }

        const { error: createErr } = await supabase
          .from('plazas')
          .insert(plazasToCreate);

        if (createErr) {
          console.error(`❌ Error creando plazas ${segment.key}:`, createErr);
          return NextResponse.json({ error: `Error creando plazas ${segment.key}` }, { status: 500 });
        }

        console.log(`✅ Creadas ${segment.count} plazas ${segment.key} (${currentNumber}-${currentNumber + segment.count - 1})`);
        currentNumber += segment.count;
      }
    }

    // 4. Verificar resultado
    const { data: verification } = await supabase
      .from('plazas')
      .select('pla_numero, catv_segmento')
      .eq('est_id', estId)
      .order('pla_numero');

    console.log('🔍 Verificación final - plazas creadas:', verification);
    console.log('✅ Reset de plazas completado exitosamente');

    return NextResponse.json({ 
      success: true, 
      message: 'Plazas regeneradas exitosamente',
      plazas: verification 
    });

  } catch (err: any) {
    console.error('❌ Error en reset de plazas:', err);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: err.message 
    }, { status: 500 });
  }
}
