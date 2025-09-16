import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Valores por defecto para las tarifas si no existen (esquema español)
const DEFAULT_RATES = [
  {
    est_id: 1,
    tiptar_nro: 1, // Tarifa por hora
    catv_segmento: 'AUT',
    tar_f_desde: new Date().toISOString(),
    tar_precio: 2000,
    tar_fraccion: 1,
    // pla_tipo eliminado - columna ya no existe
  },
  {
    est_id: 1,
    tiptar_nro: 1, // Tarifa por hora
    catv_segmento: 'MOT',
    tar_f_desde: new Date().toISOString(),
    tar_precio: 1000,
    tar_fraccion: 1,
    // pla_tipo eliminado - columna ya no existe
  },
  {
    est_id: 1,
    tiptar_nro: 1, // Tarifa por hora
    catv_segmento: 'CAM',
    tar_f_desde: new Date().toISOString(),
    tar_precio: 3000,
    tar_fraccion: 1,
    // pla_tipo eliminado - columna ya no existe
  }
];

export async function GET() {
  try {
    // Crear cliente de Supabase sin depender de cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Verificar si ya existen tarifas en el esquema español
    const { data: existingRates, error: checkError } = await supabase
      .from('tarifas')
      .select('*')
      .eq('est_id', 1)
      .eq('tiptar_nro', 1)
    // .eq('pla_tipo', 'Normal') - columna ya no existe;

    if (checkError) {
      console.error('Error al verificar tarifas existentes:', checkError);
      return NextResponse.json({
        error: 'Error al verificar tarifas existentes: ' + (checkError.message || JSON.stringify(checkError))
      }, { status: 500 });
    }

    // Si ya hay tarifas, no hacer nada
    if (existingRates && existingRates.length > 0) {
      return NextResponse.json({
        message: 'Las tarifas ya están inicializadas.',
        rates: existingRates
      });
    }

    // 2. Inicializar con valores por defecto en el esquema español
    const { data: insertedRates, error: insertError } = await supabase
      .from('tarifas')
      .insert(DEFAULT_RATES)
      .select();

    if (insertError) {
      console.error('Error al inicializar tarifas:', insertError);
      return NextResponse.json({
        error: 'Error al inicializar tarifas: ' + (insertError.message || JSON.stringify(insertError))
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Tarifas inicializadas correctamente.',
      rates: insertedRates
    });

  } catch (error: any) {
    console.error('Error en /api/parking/init-rates:', error);
    const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : 'Error desconocido');
    return NextResponse.json({
      error: 'Error interno del servidor: ' + errorMessage
    }, { status: 500 });
  }
} 