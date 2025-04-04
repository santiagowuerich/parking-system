import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  try {
    const { data: user, error } = await supabase
      .from('admins')
      .select('id, email, password_hash')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Administrador no encontrado' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Acá podrías generar un token o sesión
    return res.status(200).json({ message: 'Login exitoso', adminId: user.id });
  } catch (err) {
    return res.status(500).json({ error: 'Error al procesar login' });
  }
}
