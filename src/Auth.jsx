import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import { Mail, Lock, LogIn, UserPlus, Loader2 } from "lucide-react";

export default function Auth() {
  const [modo, setModo] = useState("entrar"); // "entrar" | "criar"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const enviar = async () => {
    setErro("");
    setAviso("");
    if (!email.trim() || !senha.trim()) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        // Ao entrar, o app detecta a sessão sozinho e carrega os dados.
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
        if (error) throw error;
        if (data.session) {
          // Confirmação de e-mail desligada: já entra direto.
        } else {
          setAviso("Conta criada! Se pedir confirmação, verifique seu e-mail e depois faça login.");
          setModo("entrar");
        }
      }
    } catch (e) {
      setErro(traduzErro(e.message));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center px-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg">G</div>
          <h1 className="text-white text-2xl font-extrabold mt-3">GiroFood</h1>
          <p className="text-emerald-200 text-sm mt-1">Seu assistente de vendas no bolso</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            <button
              onClick={() => { setModo("entrar"); setErro(""); setAviso(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${modo === "entrar" ? "bg-white text-emerald-800 shadow" : "text-gray-500"}`}
            >Entrar</button>
            <button
              onClick={() => { setModo("criar"); setErro(""); setAviso(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${modo === "criar" ? "bg-white text-emerald-800 shadow" : "text-gray-500"}`}
            >Criar conta</button>
          </div>

          <label className="block mb-3">
            <span className="text-xs font-semibold text-gray-500">E-mail</span>
            <div className="mt-1 relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com" autoComplete="email"
                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </label>

          <label className="block mb-4">
            <span className="text-xs font-semibold text-gray-500">Senha</span>
            <div className="mt-1 relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres" autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </label>

          {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{erro}</p>}
          {aviso && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 mb-3">{aviso}</p>}

          <button
            onClick={enviar} disabled={carregando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 text-white py-3 text-sm font-bold hover:bg-emerald-900 transition disabled:opacity-50"
          >
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : modo === "entrar" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {carregando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar minha conta"}
          </button>
        </div>

        <p className="text-center text-emerald-200/70 text-xs mt-5">
          Seus dados ficam salvos na sua conta e aparecem em qualquer aparelho.
        </p>
      </div>
    </div>
  );
}

function traduzErro(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered")) return "Esse e-mail já tem conta. Tente entrar.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("password")) return "Senha inválida — use pelo menos 6 caracteres.";
  return msg || "Algo deu errado. Tente de novo.";
}
