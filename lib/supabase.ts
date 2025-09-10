// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

// Obtener las variables de entorno con validación
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validar que las variables requeridas estén presentes
if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

console.log('🔧 Configuración de Supabase:', {
    url: supabaseUrl ? '✅ Presente' : '❌ Faltante',
    anonKey: supabaseAnonKey ? '✅ Presente' : '❌ Faltante'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente con permisos administrativos para operaciones como crear usuarios
// Solo crear si tenemos la service key (disponible solo en servidor)
export const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
}) : null;