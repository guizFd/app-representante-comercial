import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fica true só quando as duas chaves foram preenchidas (no .env local ou no Vercel).
export const supabaseConfigurado = Boolean(url && key);

// Se as chaves não estiverem configuradas, exportamos null e o app mostra uma tela de aviso
// em vez de quebrar com tela branca.
export const supabase = supabaseConfigurado ? createClient(url, key) : null;

/* =========================================================================
   Persistência na nuvem.
   - Dados de cada representante (clientes, pedidos, visitas, oportunidades,
     rotas, config) ficam em UMA linha por usuário na tabela `dados_usuario`,
     protegida por RLS (cada um só enxerga a própria linha).
   - O catálogo (produtos e empresas) é ÚNICO e compartilhado por todos,
     guardado na linha id=1 da tabela `catalogo`.
   ========================================================================= */

export async function lerDocUsuario(userId) {
  const { data, error } = await supabase
    .from("dados_usuario")
    .select("dados")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.dados : null;
}

export async function gravarDocUsuario(userId, dados) {
  const { error } = await supabase
    .from("dados_usuario")
    .upsert({ user_id: userId, dados, atualizado_em: new Date().toISOString() });
  if (error) throw error;
}

export async function lerCatalogo() {
  const { data, error } = await supabase
    .from("catalogo")
    .select("dados")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.dados : null;
}

export async function gravarCatalogo(dados) {
  const { error } = await supabase.from("catalogo").upsert({ id: 1, dados });
  if (error) throw error;
}
