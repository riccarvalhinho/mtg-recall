import { supabase } from './supabase';

// Inicia sessão anónima se não existir nenhuma activa.
// Com AsyncStorage configurado no client, a sessão persiste entre restarts
// e este código só cria um novo utilizador no primeiro arranque da app.
export async function signInAnonymously() {
  // Verificar se já existe uma sessão guardada
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    console.log('[auth] Sessão existente. User ID:', session.user.id);
    return { user: session.user, error: null };
  }

  // Primeiro arranque — criar utilizador anónimo
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('[auth] Erro ao fazer login anónimo:', error.message);
    return { user: null, error };
  }

  console.log('[auth] Novo utilizador anónimo criado. User ID:', data.user?.id);
  return { user: data.user, error: null };
}
