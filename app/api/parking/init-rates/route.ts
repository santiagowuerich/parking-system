import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Valores por defecto para las tarifas si no existen
const DEFAULT_RATES = [
  { vehicle_type: 'Car', price_per_hour: 2000 },
  { vehicle_type: 'Motorcycle', price_per_hour: 1000 },
  { vehicle_type: 'Van', price_per_hour: 3000 }
];

export async function GET() {
  try {
    // Crear cliente de Supabase sin depender de cookies
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Verificar si ya existen tarifas
    const { data: existingRates, error: checkError } = await supabase
      .from('tariffs')
      .select('*');

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

    // 2. Inicializar con valores por defecto
    const { data: insertedRates, error: insertError } = await supabase
      .from('tariffs')
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