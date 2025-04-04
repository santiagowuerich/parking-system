// pages/api/auth/register.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    // Verificar si el admin ya existe
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return res.status(409).json({ error: 'Ya existe un administrador con ese email' });
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    const { error } = await supabase.from('admins').insert({
      email,
      password_hash: passwordHash,
    });

    if (error) {
      return res.status(500).json({ error: 'Error al registrar el administrador' });
    }

    return res.status(201).json({ message: 'Administrador registrado con éxito' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
