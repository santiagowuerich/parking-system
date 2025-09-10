import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export function createClient(request: NextRequest) {
  // Crear la respuesta inicial
  let response = NextResponse.next()

  // Crear el cliente de Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            ...options
          })
        },
        remove(name) {
          response.cookies.set({
            name,
            value: '',
            path: '/',
            expires: new Date(0)
          })
        }
      }
    }
  )

  return { supabase, response }
}

export function copyResponseCookies(response: NextResponse, jsonResponse: NextResponse) {
  response.cookies.getAll().forEach(cookie => {
    const { name, value, ...options } = cookie
    jsonResponse.cookies.set({ name, value, ...options })
  })
  return jsonResponse
} 