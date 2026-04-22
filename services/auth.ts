import { supabase } from './supabase';

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('[auth] Erro ao fazer login anónimo:', error.message);
    return { user: null, error };
  }

  console.log('[auth] Login anónimo bem-sucedido. User ID:', data.user?.id);
  return { user: data.user, error: null };
}

export async function testDatabaseConnection() {
  const { error } = await supabase.from('users').select('id').limit(1);

  if (error) {
    console.error('[auth] Falha na ligação à base de dados:', error.message);
    return false;
  }

  console.log('[auth] Ligação à base de dados OK.');
  return true;
}
