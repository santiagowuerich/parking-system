import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from "next/server";

// GET: Obtener tarifas del usuario
export async function GET(request: NextRequest) {
  // userId ya no es requerido; las tarifas se leen desde 'tarifas' del esquema español
  new URL(request.url).searchParams.get("userId");

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

  const defaultRates = { Auto: 0, Moto: 0, Camioneta: 0 };
  const url = new URL(request.url)
  const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

  try {
    // Leer últimas tarifas por segmento para Hora (tiptar_nro=1) y pla_tipo='Normal' del est_id=1
    const { data, error } = await supabase
      .from('tarifas')
      .select('catv_segmento, tar_precio, tar_f_desde, tiptar_nro, pla_tipo')
      .eq('tiptar_nro', 1)
      .eq('pla_tipo', 'Normal')
      .eq('est_id', estId)
      .order('tar_f_desde', { ascending: false });

    if (error) {
      console.error('Error obteniendo tarifas:', error);
      // Devolver tarifas por defecto si hay error (ya no hay fallback a tablas en inglés)
      const jsonResponse = NextResponse.json({ rates: defaultRates });
      response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; jsonResponse.cookies.set({name,value,...opt}) });
      return jsonResponse;
    }

    // Elegir la última por segmento
    const latestBySeg: Record<string, number> = {};
    for (const row of (data || [])) {
      if (latestBySeg[row.catv_segmento] == null) {
        latestBySeg[row.catv_segmento] = row.tar_precio as unknown as number;
      }
    }

    const mapSegToType = (seg?: string) => seg === 'MOT' ? 'Moto' : seg === 'CAM' ? 'Camioneta' : 'Auto';
    const result = { Auto: defaultRates.Auto, Moto: defaultRates.Moto, Camioneta: defaultRates.Camioneta } as Record<string, number>;
    Object.entries(latestBySeg).forEach(([seg, price]) => { result[mapSegToType(seg)] = Number(price) });

    const jsonResponse = NextResponse.json({ rates: result });
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; jsonResponse.cookies.set({name,value,...opt}) });
    return jsonResponse;
  } catch (err) {
    console.error('Unexpected error fetching rates:', err);
    return NextResponse.json({ rates: defaultRates });
  }
}

// POST: Actualizar tarifas del usuario
export async function POST(request: NextRequest) {
  try {
    const { rates, modalidad, tipoPlaza } = await request.json();
    if (!rates) {
      return NextResponse.json({ error: 'Se requieren tarifas' }, { status: 400 });
    }

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

    const mapTypeToSeg = (t: string) => t === 'Moto' ? 'MOT' : t === 'Camioneta' ? 'CAM' : 'AUT';
    const mapModalidad = (m?: string) => {
      const mm = (m || '').toLowerCase();
      if (mm.includes('diar')) return 2; // Diaria
      if (mm.includes('mens')) return 3; // Mensual
      return 1; // Hora (default)
    }
    const mapPla = (p?: string) => {
      const pp = (p || '').toLowerCase();
      if (pp.includes('vip')) return 'VIP';
      if (pp.includes('reserv')) return 'Reservada';
      return 'Normal';
    }

    const now = new Date().toISOString();
    const tiptar = mapModalidad(modalidad);
    const pla = mapPla(tipoPlaza);
    if (![1,2,3].includes(tiptar)) {
      return NextResponse.json({ error: 'tiptar_nro inválido' }, { status: 400 })
    }
    if (!['Normal','VIP','Reservada'].includes(pla)) {
      return NextResponse.json({ error: 'pla_tipo inválido' }, { status: 400 })
    }

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || Number(request.headers.get('x-est-id')) || 1

    const inserts = Object.entries(rates).map(([vehType, price]) => ({
      est_id: estId,
      tiptar_nro: tiptar,
      catv_segmento: mapTypeToSeg(vehType),
      tar_f_desde: now,
      tar_precio: Number(price),
      tar_fraccion: 1,
      pla_tipo: pla
    }));

    const { error: insertError } = await supabase.from('tarifas').insert(inserts);
    if (insertError) {
      console.error('Error insertando tarifas:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const jsonResponse = NextResponse.json({ success: true, rates });
    response.cookies.getAll().forEach(c=>{ const {name,value,...opt}=c; jsonResponse.cookies.set({name,value,...opt}) });
    return jsonResponse;
  } catch (err) {
    console.error('Unexpected error updating rates:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}