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
        // Obtener todas las características con sus tipos
        const { data: caracteristicas, error } = await supabase
            .from('caracteristicas')
            .select(`
        caracteristica_id,
        valor,
        tipo_id,
        caracteristica_tipos!inner(
          nombre_tipo
        )
      `)
            .order('tipo_id')
            .order('valor')

        if (error) {
            console.error('Error obteniendo características:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const jsonResponse = NextResponse.json({ caracteristicas })
        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })
        return jsonResponse

    } catch (err: any) {
        console.error('Error inesperado obteniendo características:', err)
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
    }
}



