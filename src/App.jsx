import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Users, ShoppingCart, MoreHorizontal, Phone, MessageCircle, Plus, Search,
  ChevronUp, ChevronDown, Check, X, AlertTriangle, Clock, TrendingUp, DollarSign,
  Target, Calendar, MapPin, Edit3, Trash2, Copy, Printer, Download, Upload,
  RefreshCw, Settings, BarChart3, Briefcase, Package, ClipboardList, MessageSquare,
  ArrowLeft, Route, CheckCircle2, Filter, Map as MapIcon, Store, FileText, LogOut, Tag
} from "lucide-react";
import Auth from "./Auth";
import {
  supabase, supabaseConfigurado,
  lerDocUsuario, gravarDocUsuario, lerCatalogo, gravarCatalogo,
} from "./supabaseClient";

/* =====================================================================
   GiroFood — assistente diário do representante comercial de alimentos
   v2: login e dados na nuvem via Supabase.
   ===================================================================== */

/* ---------------- Helpers ---------------- */
const fmtBRL = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeISO = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const dOff = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
const fmtData = (iso) => { if (!iso) return "—"; const p = iso.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const diasEntreISO = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 864e5);
const diasDesde = (iso) => (iso ? Math.max(0, diasEntreISO(iso, hojeISO())) : null);
const uid = () => "id" + Math.random().toString(36).slice(2, 9);
const mesAtual = (iso) => !!iso && iso.slice(0, 7) === hojeISO().slice(0, 7);
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; };
const dataExtensa = () => new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

/* ---------------- Copiar texto (para WhatsApp) ---------------- */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta); return true;
    } catch (e2) { return false; }
  }
}

/* ---------------- Preço: custo + margem => venda ---------------- */
const calcVenda = (custo, margem) => Math.round(((Number(custo) || 0) * (1 + (Number(margem) || 0) / 100)) * 100) / 100;
const precoVenda = (p) => (p && p.custo != null && p.margem != null) ? calcVenda(p.custo, p.margem) : ((p && p.preco) || 0);
const normalizaProduto = (p) => {
  const margem = (typeof p.margem === "number") ? p.margem : 15;
  const custo = (typeof p.custo === "number") ? p.custo : (Number(p.preco) || 0);
  return { ...p, custo, margem, preco: calcVenda(custo, margem) };
};

/* ---------------- Constantes ---------------- */
const REGIOES = ["Asa Norte", "Asa Sul", "Guará", "Águas Claras", "Taguatinga", "Ceilândia", "Samambaia", "Gama", "Santa Maria", "Sobradinho", "Planaltina", "Vicente Pires"];
const TIPOS_ESTAB = ["Supermercado", "Mercadinho", "Restaurante", "Padaria", "Lanchonete", "Hotel", "Cozinha industrial", "Pizzaria", "Empório", "Outro"];
const CATEGORIAS = ["Bovino", "Suíno", "Ave", "Peixe", "Outros"];
const FORMAS_PGTO = ["Boleto 28 dias", "Boleto 14 dias", "Pix à vista", "Pix 7 dias", "Cartão", "Dinheiro"];
const STATUS_PEDIDO = ["Rascunho", "Enviado", "Confirmado", "Faturado", "Entregue", "Cancelado"];
const STATUS_VISITA = ["Não iniciada", "A caminho", "Em atendimento", "Visita concluída", "Cliente ausente", "Reagendada"];
const RESULTADOS_VISITA = ["Pedido realizado", "Proposta enviada", "Cliente sem estoque", "Cliente ainda possui mercadoria", "Comprador ausente", "Sem interesse", "Retorno agendado"];
const ETAPAS_FUNIL = ["Novo contato", "Primeiro contato realizado", "Visita marcada", "Proposta enviada", "Negociação", "Cliente conquistado", "Perdido"];
const STATUS_COMISSAO = ["Prevista", "Aguardando pagamento do cliente", "Liberada", "Recebida", "Contestada"];

/* ---------------- Dados de demonstração (fictícios — Brasília/DF) ---------------- */
const seedEmpresas = [
  { id: "e1", nome: "Frigorífico Boi Forte", comissaoPadrao: 5 },
  { id: "e2", nome: "Aves & Suínos Planalto", comissaoPadrao: 5 },
  { id: "e3", nome: "Pescados do Cerrado", comissaoPadrao: 6 },
];

const seedProdutos = [
  { id: "p1", nome: "Coxão mole kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-01", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 28.90, margem: 12, preco: 32.37, precoPromo: null, comissaoPct: 5, estoque: 120, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Corte magro, ótimo para bifes e escalopes.", relacionados: [] },
  { id: "p2", nome: "Patinho kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-02", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 27.50, margem: 12, preco: 30.80, precoPromo: null, comissaoPct: 5, estoque: 110, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Versátil, indicado para moer e para cozidos.", relacionados: [] },
  { id: "p3", nome: "Acém kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-03", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 22.90, margem: 15, preco: 26.34, precoPromo: null, comissaoPct: 5, estoque: 130, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Corte econômico para ensopados e picadinho.", relacionados: [] },
  { id: "p4", nome: "Costela bovina kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-04", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 24.90, margem: 15, preco: 28.64, precoPromo: null, comissaoPct: 5, estoque: 90, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Ideal para assados e churrasco.", relacionados: [] },
  { id: "p5", nome: "Picanha kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-05", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 74.90, margem: 10, preco: 82.39, precoPromo: null, comissaoPct: 5, estoque: 40, pedidoMin: 2, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Corte nobre, alta saída no fim de semana.", relacionados: [] },
  { id: "p6", nome: "Músculo kg", marca: "Boi Forte", categoria: "Bovino", codigo: "BV-06", foto: "🥩", unidade: "kg", qtdCaixa: 1, custo: 26.90, margem: 14, preco: 30.67, precoPromo: null, comissaoPct: 5, estoque: 100, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e1", descricao: "Rico em colágeno, para sopas e cozidos.", relacionados: [] },
  { id: "p7", nome: "Pernil suíno kg", marca: "Planalto", categoria: "Suíno", codigo: "SU-01", foto: "🐖", unidade: "kg", qtdCaixa: 1, custo: 16.90, margem: 18, preco: 19.94, precoPromo: null, comissaoPct: 5, estoque: 100, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e2", descricao: "Peça para assar, boa margem.", relacionados: [] },
  { id: "p8", nome: "Costela suína kg", marca: "Planalto", categoria: "Suíno", codigo: "SU-02", foto: "🐖", unidade: "kg", qtdCaixa: 1, custo: 21.90, margem: 15, preco: 25.19, precoPromo: null, comissaoPct: 5, estoque: 80, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e2", descricao: "Costela para churrasco e forno.", relacionados: [] },
  { id: "p9", nome: "Lombo suíno kg", marca: "Planalto", categoria: "Suíno", codigo: "SU-03", foto: "🐖", unidade: "kg", qtdCaixa: 1, custo: 19.90, margem: 16, preco: 23.08, precoPromo: null, comissaoPct: 5, estoque: 70, pedidoMin: 5, validade: "5 dias", status: "Ativo", empresaId: "e2", descricao: "Corte magro, versátil.", relacionados: [] },
  { id: "p10", nome: "Linguiça toscana kg", marca: "Planalto", categoria: "Suíno", codigo: "SU-04", foto: "🌭", unidade: "kg", qtdCaixa: 1, custo: 15.90, margem: 20, preco: 19.08, precoPromo: null, comissaoPct: 5, estoque: 120, pedidoMin: 5, validade: "10 dias", status: "Ativo", empresaId: "e2", descricao: "Alta saída em lanchonetes e churrasco.", relacionados: [] },
  { id: "p11", nome: "Bacon kg", marca: "Planalto", categoria: "Suíno", codigo: "SU-05", foto: "🥓", unidade: "kg", qtdCaixa: 1, custo: 23.90, margem: 18, preco: 28.20, precoPromo: null, comissaoPct: 5, estoque: 90, pedidoMin: 3, validade: "20 dias", status: "Ativo", empresaId: "e2", descricao: "Defumado, para lanches e pratos.", relacionados: [] },
  { id: "p12", nome: "Peito de frango kg", marca: "Planalto", categoria: "Ave", codigo: "AV-01", foto: "🍗", unidade: "kg", qtdCaixa: 1, custo: 13.90, margem: 18, preco: 16.40, precoPromo: null, comissaoPct: 5, estoque: 200, pedidoMin: 5, validade: "4 dias", status: "Ativo", empresaId: "e2", descricao: "Filé sem osso, grande giro.", relacionados: [] },
  { id: "p13", nome: "Coxa e sobrecoxa kg", marca: "Planalto", categoria: "Ave", codigo: "AV-02", foto: "🍗", unidade: "kg", qtdCaixa: 1, custo: 11.90, margem: 20, preco: 14.28, precoPromo: null, comissaoPct: 5, estoque: 220, pedidoMin: 5, validade: "4 dias", status: "Ativo", empresaId: "e2", descricao: "Corte econômico, muito procurado.", relacionados: [] },
  { id: "p14", nome: "Frango inteiro kg", marca: "Planalto", categoria: "Ave", codigo: "AV-03", foto: "🍗", unidade: "kg", qtdCaixa: 1, custo: 10.90, margem: 18, preco: 12.86, precoPromo: null, comissaoPct: 5, estoque: 180, pedidoMin: 5, validade: "4 dias", status: "Ativo", empresaId: "e2", descricao: "Resfriado, para assar e cozinhar.", relacionados: [] },
  { id: "p15", nome: "Asa de frango kg", marca: "Planalto", categoria: "Ave", codigo: "AV-04", foto: "🍗", unidade: "kg", qtdCaixa: 1, custo: 15.90, margem: 16, preco: 18.44, precoPromo: null, comissaoPct: 5, estoque: 140, pedidoMin: 5, validade: "4 dias", status: "Ativo", empresaId: "e2", descricao: "Alta saída em bares e petiscarias.", relacionados: [] },
  { id: "p16", nome: "Filé de tilápia kg", marca: "Pescados", categoria: "Peixe", codigo: "PX-01", foto: "🐟", unidade: "kg", qtdCaixa: 1, custo: 32.90, margem: 15, preco: 37.84, precoPromo: null, comissaoPct: 6, estoque: 90, pedidoMin: 3, validade: "3 dias", status: "Ativo", empresaId: "e3", descricao: "Filé limpo, sem espinhas.", relacionados: [] },
  { id: "p17", nome: "Salmão fresco kg", marca: "Pescados", categoria: "Peixe", codigo: "PX-02", foto: "🐟", unidade: "kg", qtdCaixa: 1, custo: 79.90, margem: 12, preco: 89.49, precoPromo: null, comissaoPct: 6, estoque: 40, pedidoMin: 2, validade: "3 dias", status: "Ativo", empresaId: "e3", descricao: "Posta/filé, produto premium.", relacionados: [] },
  { id: "p18", nome: "Filé de merluza kg", marca: "Pescados", categoria: "Peixe", codigo: "PX-03", foto: "🐟", unidade: "kg", qtdCaixa: 1, custo: 27.90, margem: 15, preco: 32.09, precoPromo: null, comissaoPct: 6, estoque: 90, pedidoMin: 3, validade: "3 dias", status: "Ativo", empresaId: "e3", descricao: "Filé congelado, prático.", relacionados: [] },
  { id: "p19", nome: "Sardinha kg", marca: "Pescados", categoria: "Peixe", codigo: "PX-04", foto: "🐟", unidade: "kg", qtdCaixa: 1, custo: 18.90, margem: 18, preco: 22.30, precoPromo: null, comissaoPct: 6, estoque: 100, pedidoMin: 5, validade: "3 dias", status: "Ativo", empresaId: "e3", descricao: "Fresca, para fritura e assados.", relacionados: [] },
  { id: "p20", nome: "Camarão limpo kg", marca: "Pescados", categoria: "Peixe", codigo: "PX-05", foto: "🦐", unidade: "kg", qtdCaixa: 1, custo: 54.90, margem: 14, preco: 62.59, precoPromo: null, comissaoPct: 6, estoque: 50, pedidoMin: 2, validade: "3 dias", status: "Ativo", empresaId: "e3", descricao: "Limpo e descascado, alta margem.", relacionados: [] },
];

const seedClientes = [
  { id: "c1", fantasia: "Mercadinho Bom Preço", razao: "Bom Preço Comércio de Alimentos Ltda", cnpj: "00.111.222/0001-01", comprador: "Seu Antônio", telefone: "(61) 3344-1001", whatsapp: "(61) 98111-1001", email: "compras@bompreco.fic.br", endereco: "QNM 10, Conjunto B, Loja 4", regiao: "Ceilândia", tipo: "Mercadinho", horario: "08h às 12h", diaPreferencial: "Terça-feira", limiteCredito: 6000, pagamentoPreferido: "Boleto 28 dias", cicloMedio: 21, ticketMedio: 1800, produtosFavoritos: ["Guaraná 2L", "Arroz tipo 1", "Mussarela"], obs: "Prefere receber antes das 10h. Negociar fardo fechado.", status: "Ativo", altoPotencial: false },
  { id: "c2", fantasia: "Padaria Pão do Cerrado", razao: "Pão do Cerrado Panificadora Ltda", cnpj: "00.222.333/0001-02", comprador: "Dona Marta", telefone: "(61) 3344-1002", whatsapp: "(61) 98111-1002", email: "marta@paodocerrado.fic.br", endereco: "CLN 208, Bloco A, Loja 15", regiao: "Asa Norte", tipo: "Padaria", horario: "14h às 17h", diaPreferencial: "Quarta-feira", limiteCredito: 9000, pagamentoPreferido: "Boleto 14 dias", cicloMedio: 30, ticketMedio: 2300, produtosFavoritos: ["Farinha de trigo", "Manteiga extra", "Requeijão"], obs: "Sempre pergunta por promoções de laticínios.", status: "Ativo", altoPotencial: true },
  { id: "c3", fantasia: "Restaurante Sabor do Planalto", razao: "Sabor do Planalto Refeições Ltda", cnpj: "00.333.444/0001-03", comprador: "Chef Ricardo", telefone: "(61) 3344-1003", whatsapp: "(61) 98111-1003", email: "ricardo@sabordoplanalto.fic.br", endereco: "SCS Quadra 2, Bloco C", regiao: "Asa Sul", tipo: "Restaurante", horario: "09h às 11h", diaPreferencial: "Segunda-feira", limiteCredito: 12000, pagamentoPreferido: "Pix 7 dias", cicloMedio: 30, ticketMedio: 3200, produtosFavoritos: ["Azeite", "Arroz tipo 1", "Água mineral"], obs: "Self-service com fluxo alto no almoço. Decide rápido.", status: "Ativo", altoPotencial: true },
  { id: "c4", fantasia: "Lanchonete do Marquinhos", razao: "M. Silva Lanches ME", cnpj: "", comprador: "Marquinhos", telefone: "(61) 3344-1004", whatsapp: "(61) 98111-1004", email: "", endereco: "QE 40, Comércio Local, Loja 2", regiao: "Guará", tipo: "Lanchonete", horario: "10h às 12h", diaPreferencial: "Quinta-feira", limiteCredito: 3000, pagamentoPreferido: "Pix à vista", cicloMedio: 22, ticketMedio: 950, produtosFavoritos: ["Hambúrguer", "Batata pré-frita", "Ketchup"], obs: "Pagamento sempre em dia. Sensível a preço.", status: "Ativo", altoPotencial: false },
  { id: "c5", fantasia: "Hotel Vista do Lago", razao: "Vista do Lago Hotelaria S.A.", cnpj: "00.555.666/0001-05", comprador: "Fernanda (A&B)", telefone: "(61) 3344-1005", whatsapp: "(61) 98111-1005", email: "compras@vistadolago.fic.br", endereco: "SHN Quadra 4, Bloco F", regiao: "Asa Norte", tipo: "Hotel", horario: "15h às 17h", diaPreferencial: "Sexta-feira", limiteCredito: 20000, pagamentoPreferido: "Boleto 28 dias", cicloMedio: 15, ticketMedio: 4100, produtosFavoritos: ["Manteiga", "Suco integral", "Pão de queijo"], obs: "Café da manhã para 180 hóspedes. Exige nota na entrega.", status: "Ativo", altoPotencial: true },
  { id: "c6", fantasia: "Supermercado Economia Certa", razao: "Economia Certa Supermercados Ltda", cnpj: "00.666.777/0001-06", comprador: "Sr. Paulo", telefone: "(61) 3344-1006", whatsapp: "(61) 98111-1006", email: "paulo@economiacerta.fic.br", endereco: "Av. Comercial, Lote 12", regiao: "Taguatinga", tipo: "Supermercado", horario: "08h às 11h", diaPreferencial: "Terça-feira", limiteCredito: 25000, pagamentoPreferido: "Boleto 28 dias", cicloMedio: 20, ticketMedio: 5200, produtosFavoritos: ["Guaraná 2L", "Água mineral", "Arroz tipo 1"], obs: "Compra por gôndola. Gosta de ação de ponta de gôndola.", status: "Ativo", altoPotencial: true },
  { id: "c7", fantasia: "Pizzaria Forno da Vila", razao: "Forno da Vila Pizzaria Ltda", cnpj: "00.777.888/0001-07", comprador: "Giulia", telefone: "(61) 3344-1007", whatsapp: "(61) 98111-1007", email: "giulia@fornodavila.fic.br", endereco: "Rua 4A, Lote 780", regiao: "Vicente Pires", tipo: "Pizzaria", horario: "16h às 18h", diaPreferencial: "Quarta-feira", limiteCredito: 7000, pagamentoPreferido: "Pix 7 dias", cicloMedio: 27, ticketMedio: 2100, produtosFavoritos: ["Mussarela", "Calabresa", "Requeijão"], obs: "Consumo alto de mussarela no fim de semana.", status: "Ativo", altoPotencial: false },
  { id: "c8", fantasia: "Cozinha Industrial NutriDF", razao: "NutriDF Refeições Coletivas Ltda", cnpj: "00.888.999/0001-08", comprador: "Vanessa", telefone: "(61) 3344-1008", whatsapp: "(61) 98111-1008", email: "vanessa@nutridf.fic.br", endereco: "ADE Conjunto 8, Lote 3", regiao: "Águas Claras", tipo: "Cozinha industrial", horario: "07h às 09h", diaPreferencial: "Segunda-feira", limiteCredito: 30000, pagamentoPreferido: "Boleto 28 dias", cicloMedio: 25, ticketMedio: 6800, produtosFavoritos: ["Arroz tipo 1", "Frango empanado", "Azeite"], obs: "Fornece 2.500 refeições/dia. Cotação sempre com 2 concorrentes.", status: "Ativo", altoPotencial: true },
  { id: "c9", fantasia: "Empório Quadra Viva", razao: "Quadra Viva Empório Ltda", cnpj: "00.999.000/0001-09", comprador: "Beto", telefone: "(61) 3344-1009", whatsapp: "(61) 98111-1009", email: "beto@quadraviva.fic.br", endereco: "CLS 405, Bloco B, Loja 8", regiao: "Asa Sul", tipo: "Empório", horario: "10h às 13h", diaPreferencial: "Quinta-feira", limiteCredito: 5000, pagamentoPreferido: "Cartão", cicloMedio: 30, ticketMedio: 1400, produtosFavoritos: ["Azeite", "Goiabada", "Chocolate"], obs: "Público premium, aceita bem lançamentos.", status: "Ativo", altoPotencial: false },
  { id: "c10", fantasia: "Mercadinho Estrela do Gama", razao: "Estrela do Gama Comércio ME", cnpj: "", comprador: "Dona Cida", telefone: "(61) 3344-1010", whatsapp: "(61) 98111-1010", email: "", endereco: "Setor Central, Quadra 5, Loja 11", regiao: "Gama", tipo: "Mercadinho", horario: "08h às 12h", diaPreferencial: "Sexta-feira", limiteCredito: 4000, pagamentoPreferido: "Boleto 14 dias", cicloMedio: 30, ticketMedio: 1100, produtosFavoritos: ["Guaraná 2L", "Goiabada"], obs: "Parou de comprar após troca de gerente. Tentar reativar.", status: "Inativo", altoPotencial: false },
  { id: "c11", fantasia: "Padaria Trigo Dourado", razao: "Trigo Dourado Panificação Ltda", cnpj: "01.111.222/0001-11", comprador: "Sr. Edson", telefone: "(61) 3344-1011", whatsapp: "(61) 98111-1011", email: "edson@trigodourado.fic.br", endereco: "QNL 5, Bloco D, Loja 1", regiao: "Taguatinga", tipo: "Padaria", horario: "13h às 16h", diaPreferencial: "Terça-feira", limiteCredito: 6000, pagamentoPreferido: "Boleto 14 dias", cicloMedio: 25, ticketMedio: 1600, produtosFavoritos: ["Farinha de trigo", "Manteiga"], obs: "Cliente novo, primeira compra em negociação.", status: "Ativo", altoPotencial: false },
  { id: "c12", fantasia: "Restaurante Tempero da Chapada", razao: "Tempero da Chapada Ltda", cnpj: "01.222.333/0001-12", comprador: "Luciana", telefone: "(61) 3344-1012", whatsapp: "(61) 98111-1012", email: "luciana@temperodachapada.fic.br", endereco: "Quadra 12, Comércio, Loja 6", regiao: "Sobradinho", tipo: "Restaurante", horario: "09h às 11h", diaPreferencial: "Quarta-feira", limiteCredito: 8000, pagamentoPreferido: "Pix 7 dias", cicloMedio: 28, ticketMedio: 1900, produtosFavoritos: ["Arroz tipo 1", "Azeite"], obs: "Cadastro recente vindo da prospecção.", status: "Ativo", altoPotencial: false },
  { id: "c13", fantasia: "Lanchonete Ponto Quente", razao: "Ponto Quente Lanches ME", cnpj: "", comprador: "Jefferson", telefone: "(61) 3344-1013", whatsapp: "(61) 98111-1013", email: "", endereco: "QR 315, Conjunto 7, Loja 3", regiao: "Samambaia", tipo: "Lanchonete", horario: "10h às 12h", diaPreferencial: "Quinta-feira", limiteCredito: 2500, pagamentoPreferido: "Pix à vista", cicloMedio: 20, ticketMedio: 700, produtosFavoritos: ["Batata pré-frita", "Ketchup"], obs: "Aguardando primeira visita com tabela de preços.", status: "Ativo", altoPotencial: false },
  { id: "c14", fantasia: "Supermercado Planaltina Center", razao: "Planaltina Center Ltda", cnpj: "01.444.555/0001-14", comprador: "Sr. Genival", telefone: "(61) 3344-1014", whatsapp: "(61) 98111-1014", email: "compras@planaltinacenter.fic.br", endereco: "Setor Tradicional, Av. Independência, 220", regiao: "Planaltina", tipo: "Supermercado", horario: "08h às 10h", diaPreferencial: "Segunda-feira", limiteCredito: 18000, pagamentoPreferido: "Boleto 28 dias", cicloMedio: 21, ticketMedio: 3800, produtosFavoritos: ["Guaraná 2L", "Arroz tipo 1", "Batata pré-frita"], obs: "Distância maior — agrupar com visitas em Sobradinho.", status: "Ativo", altoPotencial: true },
  { id: "c15", fantasia: "Café & Prosa Santa Maria", razao: "Café e Prosa Alimentos ME", cnpj: "", comprador: "Renata", telefone: "(61) 3344-1015", whatsapp: "(61) 98111-1015", email: "renata@cafeeprosa.fic.br", endereco: "QR 211, Conjunto A, Loja 9", regiao: "Santa Maria", tipo: "Lanchonete", horario: "14h às 16h", diaPreferencial: "Sexta-feira", limiteCredito: 3000, pagamentoPreferido: "Cartão", cicloMedio: 25, ticketMedio: 850, produtosFavoritos: ["Pão de queijo", "Chá gelado"], obs: "Cadastro novo, ainda sem pedidos.", status: "Ativo", altoPotencial: false },
];

const P = (produtoId, qtd, preco) => ({ produtoId, qtd, preco });
const seedPedidos = [
  { id: "o1", clienteId: "c1", data: dOff(-42), itens: [P("p10", 12, 32.9), P("p14", 4, 138), P("p1", 4, 89.9)], descontoPct: 0, formaPagamento: "Boleto 28 dias", previsaoEntrega: dOff(-40), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-10) },
  { id: "o2", clienteId: "c1", data: dOff(-21), itens: [P("p10", 15, 29.9), P("p11", 8, 22.9), P("p16", 12, 12.9)], descontoPct: 3, formaPagamento: "Boleto 28 dias", previsaoEntrega: dOff(-19), obs: "Entregar antes das 10h", status: "Entregue", statusPagamento: "Pendente", comissaoStatus: "Aguardando pagamento do cliente", comissaoPrevisao: dOff(9) },
  { id: "o3", clienteId: "c2", data: dOff(-55), itens: [P("p15", 10, 41.9), P("p3", 24, 21.9), P("p2", 12, 38.9)], descontoPct: 0, formaPagamento: "Boleto 14 dias", previsaoEntrega: dOff(-53), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-25) },
  { id: "o4", clienteId: "c2", data: dOff(-25), itens: [P("p15", 12, 41.9), P("p3", 36, 21.9), P("p6", 20, 24.5)], descontoPct: 5, formaPagamento: "Boleto 14 dias", previsaoEntrega: dOff(-23), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Liberada", comissaoPrevisao: dOff(5) },
  { id: "o5", clienteId: "c3", data: dOff(-70), itens: [P("p14", 6, 138), P("p13", 12, 34.9), P("p11", 10, 22.9)], descontoPct: 0, formaPagamento: "Pix 7 dias", previsaoEntrega: dOff(-68), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-40) },
  { id: "o6", clienteId: "c3", data: dOff(-40), itens: [P("p14", 8, 138), P("p13", 12, 34.9)], descontoPct: 0, formaPagamento: "Pix 7 dias", previsaoEntrega: dOff(-38), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-12) },
  { id: "o7", clienteId: "c3", data: dOff(-10), itens: [P("p14", 8, 138), P("p13", 15, 34.9), P("p11", 12, 22.9), P("p9", 12, 18.9)], descontoPct: 2, formaPagamento: "Pix 7 dias", previsaoEntrega: dOff(-8), obs: "", status: "Faturado", statusPagamento: "Pendente", comissaoStatus: "Aguardando pagamento do cliente", comissaoPrevisao: dOff(20) },
  { id: "o8", clienteId: "c4", data: dOff(-50), itens: [P("p7", 6, 74.9), P("p5", 12, 25.9), P("p20", 2, 96)], descontoPct: 0, formaPagamento: "Pix à vista", previsaoEntrega: dOff(-49), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-20) },
  { id: "o9", clienteId: "c4", data: dOff(-28), itens: [P("p7", 5, 74.9), P("p5", 10, 25.9)], descontoPct: 0, formaPagamento: "Pix à vista", previsaoEntrega: dOff(-27), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Liberada", comissaoPrevisao: dOff(2) },
  { id: "o10", clienteId: "c5", data: dOff(-14), itens: [P("p3", 48, 21.9), P("p9", 24, 18.9), P("p6", 24, 24.5), P("p2", 12, 38.9)], descontoPct: 4, formaPagamento: "Boleto 28 dias", previsaoEntrega: dOff(-12), obs: "Entrega no doca dos fundos", status: "Entregue", statusPagamento: "Pendente", comissaoStatus: "Aguardando pagamento do cliente", comissaoPrevisao: dOff(16) },
  { id: "o11", clienteId: "c6", data: dOff(-3), itens: [P("p10", 40, 29.9), P("p11", 20, 22.9), P("p14", 10, 138), P("p5", 20, 25.9)], descontoPct: 5, formaPagamento: "Boleto 28 dias", previsaoEntrega: dOff(2), obs: "Ação de ponta de gôndola do guaraná", status: "Confirmado", statusPagamento: "Pendente", comissaoStatus: "Prevista", comissaoPrevisao: dOff(30) },
  { id: "o12", clienteId: "c7", data: dOff(-60), itens: [P("p1", 10, 89.9), P("p19", 6, 57.9)], descontoPct: 0, formaPagamento: "Pix 7 dias", previsaoEntrega: dOff(-58), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Recebida", comissaoPrevisao: dOff(-30) },
  { id: "o13", clienteId: "c7", data: dOff(-33), itens: [P("p1", 12, 89.9), P("p19", 6, 57.9), P("p2", 6, 38.9)], descontoPct: 0, formaPagamento: "Pix 7 dias", previsaoEntrega: dOff(-31), obs: "", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Contestada", comissaoPrevisao: dOff(-3) },
  { id: "o14", clienteId: "c8", data: dOff(-26), itens: [P("p14", 20, 138), P("p8", 30, 36.5), P("p13", 24, 34.9)], descontoPct: 6, formaPagamento: "Boleto 28 dias", previsaoEntrega: dOff(-24), obs: "Cotação vencida contra 2 concorrentes", status: "Entregue", statusPagamento: "Pago", comissaoStatus: "Liberada", comissaoPrevisao: dOff(4) },
  { id: "o15", clienteId: "c9", data: dOff(-8), itens: [P("p13", 12, 34.9), P("p16", 24, 12.9), P("p17", 10, 42.9)], descontoPct: 0, formaPagamento: "Cartão", previsaoEntrega: dOff(-6), obs: "", status: "Enviado", statusPagamento: "Pendente", comissaoStatus: "Prevista", comissaoPrevisao: dOff(25) },
];

const seedVisitas = [
  { id: "v1", clienteId: "c1", data: dOff(-21), hora: "09:10", atendidoPor: "Seu Antônio", resultado: "Pedido realizado", obs: "Fechou fardo de guaraná na promoção.", produtosApresentados: ["p10", "p11", "p16"], objecoes: "", proximaAcao: "Acompanhar entrega", dataRetorno: dOff(0) },
  { id: "v2", clienteId: "c2", data: dOff(-25), hora: "14:30", atendidoPor: "Dona Marta", resultado: "Pedido realizado", obs: "Aceitou promoção da farinha.", produtosApresentados: ["p15", "p3", "p6"], objecoes: "", proximaAcao: "Oferecer requeijão na próxima", dataRetorno: dOff(3) },
  { id: "v3", clienteId: "c4", data: dOff(-12), hora: "10:40", atendidoPor: "Marquinhos", resultado: "Cliente ainda possui mercadoria", obs: "Estoque de hambúrguer para mais 2 semanas.", produtosApresentados: ["p7", "p20"], objecoes: "Achou o ketchup caro", proximaAcao: "Retornar com condição do ketchup", dataRetorno: dOff(-2) },
  { id: "v4", clienteId: "c5", data: dOff(-14), hora: "15:20", atendidoPor: "Fernanda", resultado: "Pedido realizado", obs: "Café da manhã reforçado para alta temporada.", produtosApresentados: ["p3", "p9", "p6"], objecoes: "", proximaAcao: "Levar amostra de chá gelado", dataRetorno: dOff(1) },
  { id: "v5", clienteId: "c6", data: dOff(-3), hora: "08:50", atendidoPor: "Sr. Paulo", resultado: "Pedido realizado", obs: "Montamos ação de ponta de gôndola.", produtosApresentados: ["p10", "p5", "p14"], objecoes: "", proximaAcao: "Verificar sell-out da ação", dataRetorno: dOff(7) },
  { id: "v6", clienteId: "c7", data: dOff(-33), hora: "16:30", atendidoPor: "Giulia", resultado: "Pedido realizado", obs: "", produtosApresentados: ["p1", "p19"], objecoes: "", proximaAcao: "", dataRetorno: null },
  { id: "v7", clienteId: "c9", data: dOff(-8), hora: "11:00", atendidoPor: "Beto", resultado: "Pedido realizado", obs: "Interessado em cesta de fim de ano.", produtosApresentados: ["p13", "p16", "p17"], objecoes: "", proximaAcao: "Levar proposta de cesta", dataRetorno: dOff(10) },
  { id: "v8", clienteId: "c10", data: dOff(-18), hora: "09:30", atendidoPor: "Gerente novo (Carlos)", resultado: "Sem interesse", obs: "Novo gerente trouxe fornecedor próprio.", produtosApresentados: ["p10", "p16"], objecoes: "Já tem contrato com outro distribuidor", proximaAcao: "Reabordar com tabela especial", dataRetorno: dOff(-4) },
  { id: "v9", clienteId: "c11", data: dOff(-6), hora: "13:40", atendidoPor: "Sr. Edson", resultado: "Proposta enviada", obs: "Enviada tabela de panificação.", produtosApresentados: ["p15", "p3"], objecoes: "Quer prazo de 21 dias", proximaAcao: "Retornar proposta ajustada", dataRetorno: dOff(1) },
  { id: "v10", clienteId: "c8", data: dOff(-26), hora: "07:40", atendidoPor: "Vanessa", resultado: "Pedido realizado", obs: "Ganhamos a cotação do mês.", produtosApresentados: ["p14", "p8", "p13"], objecoes: "", proximaAcao: "Preparar cotação do próximo mês", dataRetorno: dOff(2) },
];

const seedOportunidades = [
  { id: "op1", nome: "Mercearia Central Sobradinho", tipo: "Mercadinho", responsavel: "Sr. Jorge", telefone: "(61) 3355-2001", whatsapp: "(61) 98222-2001", regiao: "Sobradinho", origem: "Indicação", produtosInteresse: "Bebidas e mercearia", potencialMensal: 2500, proximaAcao: "Ligar para apresentar tabela", dataProximaAcao: dOff(-2), obs: "Indicado pelo Sabor do Planalto.", etapa: "Novo contato" },
  { id: "op2", nome: "Burguer da Praça", tipo: "Lanchonete", responsavel: "Thiago", telefone: "(61) 3355-2002", whatsapp: "(61) 98222-2002", regiao: "Águas Claras", origem: "Visita fria", produtosInteresse: "Hambúrguer, batata e molhos", potencialMensal: 1800, proximaAcao: "Enviar tabela por WhatsApp", dataProximaAcao: dOff(0), obs: "", etapa: "Primeiro contato realizado" },
  { id: "op3", nome: "Restaurante Rota do Gama", tipo: "Restaurante", responsavel: "Dona Neide", telefone: "(61) 3355-2003", whatsapp: "(61) 98222-2003", regiao: "Gama", origem: "Instagram", produtosInteresse: "Arroz, azeite e bebidas", potencialMensal: 3200, proximaAcao: "Visita de apresentação", dataProximaAcao: dOff(1), obs: "Prefere visitas pela manhã.", etapa: "Visita marcada" },
  { id: "op4", nome: "Padaria Estrela de Samambaia", tipo: "Padaria", responsavel: "Sr. Osmar", telefone: "(61) 3355-2004", whatsapp: "(61) 98222-2004", regiao: "Samambaia", origem: "Indicação", produtosInteresse: "Farinha, manteiga e requeijão", potencialMensal: 2200, proximaAcao: "Cobrar retorno da proposta", dataProximaAcao: dOff(-3), obs: "Proposta enviada há uma semana.", etapa: "Proposta enviada" },
  { id: "op5", nome: "Hotel Executivo Taguatinga", tipo: "Hotel", responsavel: "Camila (A&B)", telefone: "(61) 3355-2005", whatsapp: "(61) 98222-2005", regiao: "Taguatinga", origem: "LinkedIn", produtosInteresse: "Café da manhã completo", potencialMensal: 5500, proximaAcao: "Negociar prazo de pagamento", dataProximaAcao: dOff(2), obs: "Comparando com fornecedor atual.", etapa: "Negociação" },
  { id: "op6", nome: "Pastelaria do Careca", tipo: "Lanchonete", responsavel: "Careca", telefone: "(61) 3355-2006", whatsapp: "(61) 98222-2006", regiao: "Ceilândia", origem: "Visita fria", produtosInteresse: "Óleo, molhos e bebidas", potencialMensal: 1200, proximaAcao: "Cadastrar como cliente", dataProximaAcao: dOff(0), obs: "Fechou primeiro pedido na visita.", etapa: "Cliente conquistado" },
  { id: "op7", nome: "Restaurante Vila Planaltina", tipo: "Restaurante", responsavel: "Sr. Almir", telefone: "(61) 3355-2007", whatsapp: "(61) 98222-2007", regiao: "Planaltina", origem: "Visita fria", produtosInteresse: "Mercearia", potencialMensal: 1500, proximaAcao: "", dataProximaAcao: null, obs: "Fechou com concorrente por preço.", etapa: "Perdido" },
  { id: "op8", nome: "Emporio Sabores do DF", tipo: "Empório", responsavel: "Larissa", telefone: "(61) 3355-2008", whatsapp: "(61) 98222-2008", regiao: "Asa Sul", origem: "Feira de negócios", produtosInteresse: "Doces e azeite premium", potencialMensal: 2000, proximaAcao: "Enviar catálogo de doces", dataProximaAcao: dOff(-1), obs: "", etapa: "Primeiro contato realizado" },
];

const seedRota = [
  { id: "r1", clienteId: "c8", horario: "07h30", prioridade: "Alta", valorPotencial: 6800, obs: "Levar cotação do mês", status: "Não iniciada" },
  { id: "r2", clienteId: "c6", horario: "09h00", prioridade: "Alta", valorPotencial: 5200, obs: "Verificar ponta de gôndola", status: "Não iniciada" },
  { id: "r3", clienteId: "c1", horario: "10h30", prioridade: "Alta", valorPotencial: 1800, obs: "", status: "Não iniciada" },
  { id: "r4", clienteId: "c4", horario: "11h30", prioridade: "Média", valorPotencial: 950, obs: "Condição especial do ketchup", status: "Não iniciada" },
  { id: "r5", clienteId: "c2", horario: "14h30", prioridade: "Média", valorPotencial: 2300, obs: "Oferecer requeijão em promoção", status: "Não iniciada" },
];

function dadosDemo() {
  return {
    config: { nomeRep: "Representante", nomeApp: "GiroFood", metaMensal: 60000 },
    empresas: JSON.parse(JSON.stringify(seedEmpresas)),
    produtos: JSON.parse(JSON.stringify(seedProdutos)),
    clientes: JSON.parse(JSON.stringify(seedClientes)),
    pedidos: JSON.parse(JSON.stringify(seedPedidos)),
    visitas: JSON.parse(JSON.stringify(seedVisitas)),
    oportunidades: JSON.parse(JSON.stringify(seedOportunidades)),
    rotas: { [hojeISO()]: JSON.parse(JSON.stringify(seedRota)) },
  };
}

/* ---------------- Cálculos de negócio ---------------- */
const totalPedido = (p) => {
  const sub = (p.itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.preco) || 0), 0);
  const desc = sub * ((Number(p.descontoPct) || 0) / 100);
  return { sub, desc, total: sub - desc };
};

const comissaoPedido = (p, produtos) => {
  const { sub, total } = totalPedido(p);
  if (!sub) return 0;
  const fator = total / sub;
  return (p.itens || []).reduce((s, i) => {
    const pr = produtos.find((x) => x.id === i.produtoId);
    return s + (Number(i.qtd) || 0) * (Number(i.preco) || 0) * fator * ((pr ? pr.comissaoPct : 5) / 100);
  }, 0);
};

const empresasDoPedido = (p, produtos, empresas) => {
  const map = {};
  const { sub, total } = totalPedido(p);
  const fator = sub ? total / sub : 1;
  (p.itens || []).forEach((i) => {
    const pr = produtos.find((x) => x.id === i.produtoId);
    if (!pr) return;
    const em = empresas.find((e) => e.id === pr.empresaId);
    const nome = em ? em.nome : "—";
    map[nome] = (map[nome] || 0) + i.qtd * i.preco * fator * (pr.comissaoPct / 100);
  });
  return map;
};

const pedidosValidos = (pedidos, clienteId) =>
  pedidos
    .filter((p) => p.clienteId === clienteId && p.status !== "Cancelado" && p.status !== "Rascunho")
    .sort((a, b) => a.data.localeCompare(b.data));

function infoReposicao(cliente, pedidos) {
  const ps = pedidosValidos(pedidos, cliente.id);
  const ultimo = ps.length ? ps[ps.length - 1].data : null;
  let ciclo = Number(cliente.cicloMedio) || null;
  let cicloCalculado = false;
  if (ps.length >= 2) {
    let soma = 0;
    for (let i = 1; i < ps.length; i++) soma += diasEntreISO(ps[i - 1].data, ps[i].data);
    ciclo = Math.max(1, Math.round(soma / (ps.length - 1)));
    cicloCalculado = true;
  }
  const dias = diasDesde(ultimo);
  let estado = "Sem dados suficientes";
  if (ultimo && ciclo) {
    const r = dias / ciclo;
    estado = r < 0.7 ? "Reposição futura" : r < 0.95 ? "Reposição próxima" : r <= 1.15 ? "Comprar hoje" : "Reposição atrasada";
  }
  const ticket = ps.length ? ps.reduce((s, p) => s + totalPedido(p).total, 0) / ps.length : Number(cliente.ticketMedio) || 0;
  const totalComprado = ps.reduce((s, p) => s + totalPedido(p).total, 0);
  let proxima = null;
  if (ultimo && ciclo) {
    const d = new Date(ultimo + "T12:00"); d.setDate(d.getDate() + ciclo);
    proxima = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return { ultimo, ciclo, cicloCalculado, dias, estado, ticket, totalComprado, numPedidos: ps.length, proxima };
}

const ultimaVisitaData = (clienteId, visitas) => {
  const vs = visitas.filter((v) => v.clienteId === clienteId).sort((a, b) => b.data.localeCompare(a.data));
  return vs.length ? vs[0].data : null;
};

const retornoAtrasado = (clienteId, visitas) =>
  visitas.some((v) => v.clienteId === clienteId && v.dataRetorno && v.dataRetorno < hojeISO());

function prioridadeCliente(cliente, pedidos, visitas) {
  const rep = infoReposicao(cliente, pedidos);
  let score = 0;
  const motivos = [];
  if (rep.ultimo && rep.ciclo) {
    const r = rep.dias / rep.ciclo;
    if (r > 1.15) { score += 40; motivos.push(`está ${rep.dias - rep.ciclo} dia(s) acima do ciclo médio de ${rep.ciclo} dias`); }
    else if (r >= 0.95) { score += 32; motivos.push(`chegou ao ponto de recompra (ciclo médio de ${rep.ciclo} dias)`); }
    else if (r >= 0.7) { score += 18; motivos.push("reposição se aproximando"); }
    else { score += 5; }
  } else { score += 12; motivos.push("ainda sem histórico de pedidos — oportunidade de primeira venda"); }
  if (rep.ticket >= 3000) { score += 20; motivos.push(`costuma gerar pedidos de aproximadamente ${fmtBRL(rep.ticket)}`); }
  else if (rep.ticket >= 1200) { score += 12; motivos.push(`pedidos médios de ${fmtBRL(rep.ticket)}`); }
  else { score += 5; }
  if (retornoAtrasado(cliente.id, visitas)) { score += 15; motivos.push("há um retorno combinado em atraso"); }
  if (cliente.altoPotencial) { score += 10; motivos.push("classificado como alto potencial"); }
  const uv = ultimaVisitaData(cliente.id, visitas);
  const dv = uv ? diasDesde(uv) : null;
  if (dv === null) { score += 12; motivos.push("nunca recebeu visita registrada"); }
  else if (dv > 21) { score += 15; motivos.push(`última visita foi há ${dv} dias`); }
  else if (dv > 10) { score += 8; }
  score = Math.min(100, Math.round(score));
  return { ...rep, score, motivos, diasSemVisita: dv };
}

const nivelPrioridade = (score) => (score >= 65 ? "Alta" : score >= 40 ? "Média" : "Baixa");

function otimizarParadas(paradas, clientes) {
  const pw = { Alta: 3, "Média": 2, Baixa: 1 };
  const regiaoDe = (s) => { const c = clientes.find((x) => x.id === s.clienteId); return c ? c.regiao : "—"; };
  const rank = {};
  paradas.forEach((s) => { const r = regiaoDe(s); rank[r] = Math.max(rank[r] || 0, pw[s.prioridade] || 1); });
  return [...paradas].sort((a, b) => {
    const ra = regiaoDe(a), rb = regiaoDe(b);
    if (rank[rb] !== rank[ra]) return rank[rb] - rank[ra];
    if (ra !== rb) return ra.localeCompare(rb);
    if ((a.horario || "") !== (b.horario || "")) return (a.horario || "zz").localeCompare(b.horario || "zz");
    return (pw[b.prioridade] || 1) - (pw[a.prioridade] || 1);
  });
}

/* ---------------- Mensagens (regras locais, sem API) ---------------- */
function msgPedidoWhats(pedido, cliente, produtos, config) {
  const { sub, desc, total } = totalPedido(pedido);
  const linhas = pedido.itens.map((i) => {
    const pr = produtos.find((x) => x.id === i.produtoId);
    return `• ${i.qtd}x ${pr ? pr.nome : "Produto"} — ${fmtBRL(i.preco)} un. = ${fmtBRL(i.qtd * i.preco)}`;
  }).join("\n");
  return (
`*Pedido — ${config.nomeApp}*
Cliente: ${cliente ? cliente.fantasia : "—"}
Data: ${fmtData(pedido.data)}

*Itens:*
${linhas}

Subtotal: ${fmtBRL(sub)}${desc > 0 ? `\nDesconto (${pedido.descontoPct}%): -${fmtBRL(desc)}` : ""}
*Total: ${fmtBRL(total)}*

Pagamento: ${pedido.formaPagamento || "—"}
Previsão de entrega: ${fmtData(pedido.previsaoEntrega)}${pedido.obs ? `\nObs.: ${pedido.obs}` : ""}

Qualquer ajuste, é só me avisar. Obrigado pela parceria! 🤝
${config.nomeRep}`);
}

const MODELOS_MSG = [
  { id: "apresentacao", nome: "Apresentação inicial", gerar: (c, cli) => `Olá${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Tudo bem? Aqui é ${c.nomeRep}, representante comercial de alimentos aqui no DF. Trabalho com laticínios, congelados, bebidas, mercearia e frios de ótimas marcas, com entrega rápida na sua região. Posso passar aí essa semana para apresentar a tabela e algumas condições especiais de primeira compra?` },
  { id: "promo", nome: "Oferta de promoção", gerar: (c, cli) => `Oi${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! ${c.nomeRep} aqui. Entraram promoções ótimas essa semana: requeijão cremoso, batata pré-frita e guaraná 2L com preço especial. Quer que eu monte um pedido aproveitando os valores promocionais antes de acabar o lote?` },
  { id: "reposicao", nome: "Aviso de reposição", gerar: (c, cli) => `Olá${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Pelo seu histórico, seu estoque deve estar chegando na hora de repor. Quer que eu já monte um pedido igual ao último, ou prefere ajustar algum item? Consigo agilizar a entrega para essa semana.` },
  { id: "orcamento", nome: "Retorno de orçamento", gerar: (c, cli) => `Oi${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Passando para saber se conseguiu analisar o orçamento que enviei. Se algum valor ou condição precisar de ajuste, me fala que eu vejo o que consigo melhorar para fecharmos.` },
  { id: "inativo", nome: "Recuperação de cliente inativo", gerar: (c, cli) => `Olá${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Sentimos sua falta por aqui. 😊 Tenho novidades no mix e condições especiais para retomar nossa parceria, incluindo preço diferenciado no primeiro pedido de retorno. Posso passar aí para conversarmos?` },
  { id: "confirmacao", nome: "Confirmação de pedido", gerar: (c, cli) => `Olá${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Seu pedido foi confirmado com sucesso. ✅ Em breve envio o número da nota e a previsão de entrega. Qualquer ajuste de última hora, me avisa por aqui. Obrigado pela confiança!` },
  { id: "posvenda", nome: "Pós-venda", gerar: (c, cli) => `Oi${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! A entrega chegou tudo certo? Queria confirmar se os produtos chegaram conforme o combinado e se ficou satisfeito com a qualidade. Seu retorno me ajuda a cuidar melhor do seu atendimento. 🙌` },
  { id: "cobranca", nome: "Cobrança educada", gerar: (c, cli) => `Olá${cli ? `, ${cli.comprador || cli.fantasia}` : ""}, tudo bem? Passando só para lembrar do boleto do último pedido, que consta em aberto por aqui. Se já foi pago, pode desconsiderar e me enviar o comprovante quando puder. Se precisar de segunda via ou de um novo prazo, me avisa que resolvo rapidinho. Obrigado!` },
  { id: "agendamento", nome: "Agendamento de visita", gerar: (c, cli) => `Oi${cli ? `, ${cli.comprador || cli.fantasia}` : ""}! Vou estar na sua região ${cli ? `(${cli.regiao}) ` : ""}nesta semana. Posso passar aí ${cli && cli.diaPreferencial ? `na ${cli.diaPreferencial.toLowerCase()} ` : ""}${cli && cli.horario ? `entre ${cli.horario} ` : ""}para te mostrar as novidades e já deixar a reposição encaminhada?` },
];

/* ---------------- Componentes de UI ---------------- */
const TONS = {
  verde: "bg-emerald-100 text-emerald-800",
  verdeEscuro: "bg-emerald-800 text-white",
  laranja: "bg-orange-100 text-orange-700",
  vermelho: "bg-red-100 text-red-700",
  cinza: "bg-gray-100 text-gray-600",
  azul: "bg-sky-100 text-sky-700",
};
const tomEstadoRep = (e) => e === "Reposição atrasada" ? "vermelho" : e === "Comprar hoje" ? "laranja" : e === "Reposição próxima" ? "laranja" : e === "Reposição futura" ? "verde" : "cinza";
const tomStatusPedido = (s) => s === "Entregue" ? "verde" : s === "Cancelado" ? "vermelho" : s === "Rascunho" ? "cinza" : s === "Faturado" ? "azul" : "laranja";
const tomStatusComissao = (s) => s === "Recebida" ? "verde" : s === "Contestada" ? "vermelho" : s === "Liberada" ? "azul" : "laranja";
const tomStatusVisita = (s) => s === "Visita concluída" ? "verde" : s === "Cliente ausente" ? "vermelho" : s === "Não iniciada" ? "cinza" : "laranja";

const Badge = ({ tom = "cinza", children, className = "" }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONS[tom]} ${className}`}>{children}</span>
);

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${onClick ? "cursor-pointer active:scale-[0.99] transition" : ""} ${className}`}>{children}</div>
);

const Btn = ({ children, variant = "primario", className = "", ...p }) => {
  const v = {
    primario: "bg-emerald-800 text-white hover:bg-emerald-900 active:bg-emerald-950",
    claro: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    laranja: "bg-orange-500 text-white hover:bg-orange-600",
    contorno: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
    perigo: "bg-red-600 text-white hover:bg-red-700",
    fantasma: "text-gray-600 hover:bg-gray-100",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none ${v} ${className}`}>{children}</button>;
};

const Inp = ({ label, className = "", ...p }) => (
  <label className="block">
    {label && <span className="text-xs font-semibold text-gray-500">{label}</span>}
    <input {...p} className={`mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 ${className}`} />
  </label>
);
const Sel = ({ label, children, className = "", ...p }) => (
  <label className="block">
    {label && <span className="text-xs font-semibold text-gray-500">{label}</span>}
    <select {...p} className={`mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 ${className}`}>{children}</select>
  </label>
);
const Txa = ({ label, className = "", ...p }) => (
  <label className="block">
    {label && <span className="text-xs font-semibold text-gray-500">{label}</span>}
    <textarea {...p} className={`mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 ${className}`} />
  </label>
);

const Chip = ({ ativo, children, onClick }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${ativo ? "bg-emerald-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{children}</button>
);

const Vazio = ({ icone: Ic = ClipboardList, titulo, texto, acao }) => (
  <div className="text-center py-12 px-6">
    <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3"><Ic className="w-7 h-7 text-emerald-700" /></div>
    <p className="font-bold text-gray-800">{titulo}</p>
    <p className="text-sm text-gray-500 mt-1">{texto}</p>
    {acao && <div className="mt-4">{acao}</div>}
  </div>
);

const Modal = ({ titulo, onClose, children, largo }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className={`relative bg-white w-full ${largo ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-xl`}>
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-3xl">
        <h3 className="font-bold text-gray-800">{titulo}</h3>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const Barras = ({ dados, fmt = fmtBRL, cor = "bg-emerald-700" }) => {
  const max = Math.max(...dados.map((d) => d.v), 1);
  if (!dados.length) return <p className="text-sm text-gray-400 py-2">Sem dados no período.</p>;
  return (
    <div className="space-y-2.5">
      {dados.map((d) => (
        <div key={d.k}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 truncate pr-2">{d.k}</span>
            <span className="font-semibold text-gray-800">{fmt(d.v)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${cor}`} style={{ width: `${(d.v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
};

const Anel = ({ pct, tamanho = 52 }) => {
  const r = 20, c = 2 * Math.PI * r, off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const cor = pct >= 65 ? "#ea580c" : pct >= 40 ? "#f59e0b" : "#059669";
  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={cor} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 24 24)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">{pct}</span>
    </div>
  );
};

const Cabecalho = ({ titulo, voltar, nav, acao }) => (
  <div className="sticky top-0 z-30 bg-emerald-900 text-white px-4 py-3.5 flex items-center gap-2 shadow-md">
    {voltar && <button onClick={voltar} className="p-1 -ml-1 rounded-full hover:bg-emerald-800"><ArrowLeft className="w-5 h-5" /></button>}
    <h1 className="font-bold text-base flex-1 truncate">{titulo}</h1>
    {acao}
  </div>
);

/* ---------------- Tela 1 — Painel inicial ---------------- */
function TelaInicio({ db, nav }) {
  const { config, clientes, pedidos, visitas, oportunidades, rotas } = db;
  const pedidosMes = pedidos.filter((p) => mesAtual(p.data) && p.status !== "Cancelado" && p.status !== "Rascunho");
  const totalVendidoMes = pedidosMes.reduce((s, p) => s + totalPedido(p).total, 0);
  const pctMeta = config.metaMensal ? Math.round((totalVendidoMes / config.metaMensal) * 100) : 0;
  const comPrev = pedidosMes.filter((p) => p.comissaoStatus !== "Recebida" && p.comissaoStatus !== "Contestada").reduce((s, p) => s + comissaoPedido(p, db.produtos), 0);
  const comReceb = pedidos.filter((p) => mesAtual(p.data) && p.comissaoStatus === "Recebida").reduce((s, p) => s + comissaoPedido(p, db.produtos), 0);
  const rotaHoje = rotas[hojeISO()] || [];
  const analises = clientes.map((c) => ({ c, a: prioridadeCliente(c, pedidos, visitas) }));
  const precisamRepor = analises.filter((x) => x.a.estado === "Comprar hoje" || x.a.estado === "Reposição atrasada").length;
  const propostas = oportunidades.filter((o) => o.etapa === "Proposta enviada").length;
  const prioridades = [...analises].sort((a, b) => b.a.score - a.a.score).slice(0, 4);

  const seteDias = dOff(-7);
  const vendasSemana = pedidos.filter((p) => p.data >= seteDias && p.status !== "Cancelado" && p.status !== "Rascunho").reduce((s, p) => s + totalPedido(p).total, 0);
  const positivados = new Set(pedidosMes.map((p) => p.clienteId)).size;
  const ticketMedioMes = pedidosMes.length ? totalVendidoMes / pedidosMes.length : 0;
  const recuperados = pedidosMes.filter((p) => {
    const ant = pedidosValidos(pedidos, p.clienteId).filter((x) => x.data < p.data);
    return ant.length && diasEntreISO(ant[ant.length - 1].data, p.data) > 45;
  }).length;

  return (
    <div className="pb-28">
      <div className="bg-emerald-900 text-white px-4 pt-5 pb-16 rounded-b-[2rem]">
        <p className="text-emerald-200 text-sm capitalize">{dataExtensa()}</p>
        <h1 className="text-xl font-extrabold mt-0.5">{saudacao()}, {config.nomeRep}! 👋</h1>
        <div className="mt-4 bg-emerald-800/70 rounded-2xl p-4">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Meta do mês</span>
            <span className="text-xs font-bold text-emerald-100">{pctMeta}%</span>
          </div>
          <div className="mt-2 h-2.5 bg-emerald-950/60 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pctMeta >= 100 ? "bg-emerald-300" : "bg-orange-400"}`} style={{ width: `${Math.min(100, pctMeta)}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="font-bold">{fmtBRL(totalVendidoMes)}</span>
            <span className="text-emerald-200">de {fmtBRL(config.metaMensal)}</span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-10 grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-emerald-700" /> Comissão prevista</p>
          <p className="text-lg font-extrabold text-gray-900 mt-0.5">{fmtBRL(comPrev)}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Comissão recebida</p>
          <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmtBRL(comReceb)}</p>
        </Card>
      </div>

      <div className="px-4 mt-3 grid grid-cols-3 gap-3">
        <Card className="p-3 text-center" onClick={() => nav("rota")}>
          <p className="text-xl font-extrabold text-emerald-800">{rotaHoje.length}</p>
          <p className="text-[11px] font-semibold text-gray-500 leading-tight">visitas hoje</p>
        </Card>
        <Card className="p-3 text-center" onClick={() => nav("clientes", { filtroInicial: "Reposição próxima" })}>
          <p className="text-xl font-extrabold text-orange-500">{precisamRepor}</p>
          <p className="text-[11px] font-semibold text-gray-500 leading-tight">precisam repor</p>
        </Card>
        <Card className="p-3 text-center" onClick={() => nav("prospeccao")}>
          <p className="text-xl font-extrabold text-sky-600">{propostas}</p>
          <p className="text-[11px] font-semibold text-gray-500 leading-tight">propostas abertas</p>
        </Card>
      </div>

      <div className="px-4 mt-3">
        <Card className="p-4 flex items-center gap-3" onClick={() => nav("precos")}>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Tag className="w-5 h-5 text-emerald-700" /></div>
          <div className="flex-1"><p className="font-bold text-gray-900">Atualizar preços do dia</p><p className="text-xs text-gray-500">Custo, margem e valor de venda por categoria</p></div>
          <Plus className="w-4 h-4 text-emerald-700" />
        </Card>
      </div>

      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-gray-900">Prioridades de hoje</h2>
          <button onClick={() => nav("clientes")} className="text-xs font-bold text-emerald-800">Ver clientes</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {prioridades.map(({ c, a }) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start gap-3">
                <Anel pct={a.score} />
                <div className="flex-1 min-w-0">
                  <button onClick={() => nav("cliente", { id: c.id })} className="font-bold text-gray-900 truncate block text-left">{c.fantasia}</button>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.regiao}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <Badge tom={tomEstadoRep(a.estado)}>{a.estado}</Badge>
                    {a.dias !== null && <Badge tom="cinza">{a.dias}d sem pedido</Badge>}
                    {a.ciclo && <Badge tom="cinza">ciclo {a.ciclo}d</Badge>}
                    <Badge tom="verde">~{fmtBRL(a.ticket)}</Badge>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2.5 bg-gray-50 rounded-xl px-3 py-2">
                Prioridade {nivelPrioridade(a.score).toLowerCase()} porque {a.motivos.slice(0, 2).join(" e ")}.
              </p>
              <div className="flex gap-2 mt-3">
                <a href={`tel:${(c.telefone || "").replace(/\D/g, "")}`} className="flex-1"><Btn variant="contorno" className="w-full"><Phone className="w-4 h-4" /> Ligar</Btn></a>
                <Btn variant="claro" className="flex-1" onClick={() => nav("visitaForm", { clienteId: c.id })}><ClipboardList className="w-4 h-4" /> Visita</Btn>
                <Btn className="flex-1" onClick={() => nav("pedidoForm", { clienteId: c.id })}><Plus className="w-4 h-4" /> Pedido</Btn>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="font-extrabold text-gray-900 mb-2">Resumo do período</h2>
        <Card className="divide-y divide-gray-50">
          {[
            ["Vendas da semana", fmtBRL(vendasSemana)],
            ["Clientes positivados no mês", positivados],
            ["Ticket médio do mês", fmtBRL(ticketMedioMes)],
            ["Pedidos realizados no mês", pedidosMes.length],
            ["Clientes inativos recuperados", recuperados],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-3 text-sm">
              <span className="text-gray-500">{k}</span><span className="font-bold text-gray-900">{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Tela 2 — Rota do dia ---------------- */
function TelaRota({ db, up, nav, notify }) {
  const [data, setData] = useState(hojeISO());
  const [addAberto, setAddAberto] = useState(false);
  const [novo, setNovo] = useState({ clienteId: "", horario: "", obs: "" });
  const paradas = db.rotas[data] || [];
  const setParadas = (arr) => up((d) => ({ rotas: { ...d.rotas, [data]: arr } }));
  const clienteDe = (id) => db.clientes.find((c) => c.id === id);

  const mover = (i, dir) => {
    const arr = [...paradas];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setParadas(arr);
  };
  const mudarStatus = (i, status) => { const arr = [...paradas]; arr[i] = { ...arr[i], status }; setParadas(arr); };
  const remover = (i) => setParadas(paradas.filter((_, x) => x !== i));

  const otimizar = () => {
    if (paradas.length < 2) return notify("Adicione pelo menos duas visitas para otimizar.", "erro");
    setParadas(otimizarParadas(paradas, db.clientes));
    notify("Rota reorganizada por região, prioridade e horário. ✅");
  };
  const gerarSugestao = () => {
    const top = db.clientes
      .map((c) => ({ c, a: prioridadeCliente(c, db.pedidos, db.visitas) }))
      .sort((a, b) => b.a.score - a.a.score).slice(0, 5);
    setParadas(top.map(({ c, a }) => ({ id: uid(), clienteId: c.id, horario: (c.horario || "").split(" ")[0] || "", prioridade: nivelPrioridade(a.score), valorPotencial: Math.round(a.ticket), obs: "", status: "Não iniciada" })));
    notify("Sugestão de rota criada com base nas prioridades.");
  };
  const adicionar = () => {
    if (!novo.clienteId) return notify("Selecione um cliente.", "erro");
    const a = prioridadeCliente(clienteDe(novo.clienteId), db.pedidos, db.visitas);
    setParadas([...paradas, { id: uid(), clienteId: novo.clienteId, horario: novo.horario, prioridade: nivelPrioridade(a.score), valorPotencial: Math.round(a.ticket), obs: novo.obs, status: "Não iniciada" }]);
    setAddAberto(false); setNovo({ clienteId: "", horario: "", obs: "" });
    notify("Visita adicionada à rota.");
  };
  const concluidas = paradas.filter((p) => p.status === "Visita concluída").length;

  return (
    <div className="pb-28">
      <Cabecalho titulo="Rota do dia" acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={otimizar}><Route className="w-4 h-4" /> Otimizar</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Inp label="Data da rota" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <Btn variant="claro" onClick={() => setAddAberto(true)}><Plus className="w-4 h-4" /> Visita</Btn>
        </div>
        {paradas.length > 0 && (
          <Card className="p-3.5 flex items-center justify-between">
            <p className="text-sm text-gray-600"><span className="font-bold text-gray-900">{concluidas}</span> de {paradas.length} visitas concluídas</p>
            <p className="text-sm font-bold text-emerald-800">{fmtBRL(paradas.reduce((s, p) => s + (p.valorPotencial || 0), 0))} potencial</p>
          </Card>
        )}
        {paradas.length === 0 ? (
          <Vazio icone={MapIcon} titulo="Nenhuma visita nesta data"
            texto="Monte a rota manualmente ou gere uma sugestão automática com base nas prioridades de recompra."
            acao={<Btn onClick={gerarSugestao}><TrendingUp className="w-4 h-4" /> Gerar rota sugerida</Btn>} />
        ) : (
          <div className="space-y-3">
            {paradas.map((p, i) => {
              const c = clienteDe(p.clienteId);
              if (!c) return null;
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className="w-7 h-7 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-0.5 text-gray-400 disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => mover(i, 1)} disabled={i === paradas.length - 1} className="p-0.5 text-gray-400 disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button onClick={() => nav("cliente", { id: c.id })} className="font-bold text-gray-900 truncate">{c.fantasia}</button>
                        <Badge tom={p.prioridade === "Alta" ? "laranja" : p.prioridade === "Média" ? "azul" : "cinza"}>{p.prioridade}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.regiao} · {c.endereco}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {p.horario || c.horario || "Horário livre"} · potencial {fmtBRL(p.valorPotencial || 0)}</p>
                      {p.obs && <p className="text-xs text-gray-600 mt-1.5 bg-orange-50 text-orange-700 rounded-lg px-2 py-1">📌 {p.obs}</p>}
                      <div className="flex gap-2 mt-2.5 items-center">
                        <select value={p.status} onChange={(e) => mudarStatus(i, e.target.value)}
                          className={`flex-1 rounded-xl px-2.5 py-2 text-xs font-semibold border-0 ${TONS[tomStatusVisita(p.status)]}`}>
                          {STATUS_VISITA.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <Btn variant="claro" className="!py-2 !px-2.5" onClick={() => nav("visitaForm", { clienteId: c.id })}><ClipboardList className="w-4 h-4" /></Btn>
                        <Btn className="!py-2 !px-2.5" onClick={() => nav("pedidoForm", { clienteId: c.id })}><ShoppingCart className="w-4 h-4" /></Btn>
                        <button onClick={() => remover(i)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center">
          <MapIcon className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-bold text-emerald-800 mt-2">Mapa da rota</p>
          <p className="text-xs text-emerald-700/70 mt-1">Espaço reservado para a integração com mapas na próxima versão. Hoje a otimização usa região, prioridade e horário.</p>
        </div>
      </div>

      {addAberto && (
        <Modal titulo="Adicionar visita à rota" onClose={() => setAddAberto(false)}>
          <div className="space-y-3">
            <Sel label="Cliente" value={novo.clienteId} onChange={(e) => setNovo({ ...novo, clienteId: e.target.value })}>
              <option value="">Selecione…</option>
              {db.clientes.map((c) => <option key={c.id} value={c.id}>{c.fantasia} — {c.regiao}</option>)}
            </Sel>
            <Inp label="Horário previsto (ex.: 09h30)" value={novo.horario} onChange={(e) => setNovo({ ...novo, horario: e.target.value })} placeholder="Opcional" />
            <Txa label="Observação" rows={2} value={novo.obs} onChange={(e) => setNovo({ ...novo, obs: e.target.value })} placeholder="Ex.: levar amostra, cobrar retorno…" />
            <Btn className="w-full" onClick={adicionar}><Check className="w-4 h-4" /> Adicionar à rota</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Tela 3 — Clientes ---------------- */
function TelaClientes({ db, nav, view }) {
  const [busca, setBusca] = useState("");
  const [regiao, setRegiao] = useState("Todas");
  const [ordem, setOrdem] = useState("prioridade");
  const [filtro, setFiltro] = useState(view.filtroInicial || "Todos");

  const analisados = db.clientes.map((c) => ({ c, a: prioridadeCliente(c, db.pedidos, db.visitas) }));

  let lista = analisados.filter(({ c, a }) => {
    const q = busca.trim().toLowerCase();
    if (q && !(`${c.fantasia} ${c.razao} ${c.comprador} ${c.regiao}`.toLowerCase().includes(q))) return false;
    if (regiao !== "Todas" && c.regiao !== regiao) return false;
    if (filtro === "Ativos" && c.status !== "Ativo") return false;
    if (filtro === "Inativos" && c.status !== "Inativo") return false;
    if (filtro === "Alto potencial" && !c.altoPotencial) return false;
    if (filtro === "Reposição próxima" && !(a.estado === "Comprar hoje" || a.estado === "Reposição atrasada" || a.estado === "Reposição próxima")) return false;
    return true;
  });
  lista.sort((x, y) => {
    if (ordem === "prioridade") return y.a.score - x.a.score;
    if (ordem === "nome") return x.c.fantasia.localeCompare(y.c.fantasia);
    if (ordem === "ticket") return y.a.ticket - x.a.ticket;
    return 0;
  });

  const regioesUsadas = ["Todas", ...Array.from(new Set(db.clientes.map((c) => c.regiao))).sort()];

  return (
    <div className="pb-28">
      <Cabecalho titulo="Clientes" acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={() => nav("clienteForm")}><Plus className="w-4 h-4" /> Novo</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, comprador, região…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {["Todos", "Ativos", "Alto potencial", "Reposição próxima", "Inativos"].map((f) => (
            <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Sel value={regiao} onChange={(e) => setRegiao(e.target.value)} className="flex-1">
            {regioesUsadas.map((r) => <option key={r}>{r}</option>)}
          </Sel>
          <Sel value={ordem} onChange={(e) => setOrdem(e.target.value)} className="flex-1">
            <option value="prioridade">Prioridade</option>
            <option value="nome">Nome (A-Z)</option>
            <option value="ticket">Maior ticket</option>
          </Sel>
        </div>
        <p className="text-xs text-gray-500">{lista.length} cliente(s)</p>

        {lista.length === 0 ? (
          <Vazio icone={Users} titulo="Nenhum cliente encontrado" texto="Ajuste os filtros ou cadastre um novo cliente." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map(({ c, a }) => (
              <Card key={c.id} className="p-4" onClick={() => nav("cliente", { id: c.id })}>
                <div className="flex items-start gap-3">
                  <Anel pct={a.score} tamanho={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 truncate">{c.fantasia}</p>
                      {c.altoPotencial && <Badge tom="verde">★</Badge>}
                      {c.status === "Inativo" && <Badge tom="vermelho">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.regiao} · {c.tipo}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge tom={tomEstadoRep(a.estado)}>{a.estado}</Badge>
                      {a.dias !== null && <Badge tom="cinza">{a.dias}d</Badge>}
                      <Badge tom="verde">~{fmtBRL(a.ticket)}</Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tela 3b — Detalhe do cliente ---------------- */
function ClienteDetalhe({ db, view, nav, up, notify, confirmAsk }) {
  const c = db.clientes.find((x) => x.id === view.id);
  if (!c) return <div className="p-6"><Cabecalho titulo="Cliente" voltar={() => nav("clientes")} /><p className="p-4 text-gray-500">Cliente não encontrado.</p></div>;
  const a = prioridadeCliente(c, db.pedidos, db.visitas);
  const pedidosC = pedidosValidos(db.pedidos, c.id).slice().reverse();
  const visitasC = db.visitas.filter((v) => v.clienteId === c.id).sort((x, y) => y.data.localeCompare(x.data));
  const wpp = (c.whatsapp || c.telefone || "").replace(/\D/g, "");

  const excluir = () => confirmAsk(`Excluir o cliente "${c.fantasia}"? Os pedidos e visitas ligados a ele continuarão no histórico.`, () => {
    up((d) => ({ clientes: d.clientes.filter((x) => x.id !== c.id) }));
    nav("clientes"); notify("Cliente excluído.");
  });

  return (
    <div className="pb-28">
      <Cabecalho titulo={c.fantasia} voltar={() => nav("clientes")}
        acao={<button onClick={() => nav("clienteForm", { id: c.id })} className="p-1.5 rounded-full hover:bg-emerald-800"><Edit3 className="w-5 h-5" /></button>} />
      <div className="px-4 pt-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Anel pct={a.score} />
            <div className="flex-1">
              <p className="font-extrabold text-gray-900">{c.fantasia}</p>
              <p className="text-xs text-gray-500">{c.razao || "—"}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge tom={tomEstadoRep(a.estado)}>{a.estado}</Badge>
                <Badge tom="cinza">Prioridade {nivelPrioridade(a.score).toLowerCase()}</Badge>
                {c.altoPotencial && <Badge tom="verde">Alto potencial</Badge>}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 bg-gray-50 rounded-xl px-3 py-2">
            {a.motivos.length ? `Por quê agora: ${a.motivos.join("; ")}.` : "Sem sinais de urgência no momento."}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <a href={`tel:${(c.telefone || "").replace(/\D/g, "")}`}><Btn variant="contorno" className="w-full"><Phone className="w-4 h-4" /></Btn></a>
            <a href={`https://wa.me/55${wpp}`} target="_blank" rel="noreferrer"><Btn variant="claro" className="w-full"><MessageCircle className="w-4 h-4" /></Btn></a>
            <Btn onClick={() => nav("pedidoForm", { clienteId: c.id })}><Plus className="w-4 h-4" /></Btn>
          </div>
        </Card>

        <Card className="divide-y divide-gray-50">
          {[
            ["Comprador", c.comprador || "—"],
            ["Telefone", c.telefone || "—"],
            ["WhatsApp", c.whatsapp || "—"],
            ["Endereço", `${c.endereco || "—"} · ${c.regiao}`],
            ["Tipo", c.tipo],
            ["Melhor horário", c.horario || "—"],
            ["Dia preferencial", c.diaPreferencial || "—"],
            ["Pagamento", c.pagamentoPreferido || "—"],
            ["Limite de crédito", fmtBRL(c.limiteCredito || 0)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-gray-500 whitespace-nowrap">{k}</span>
              <span className="font-semibold text-gray-800 text-right">{v}</span>
            </div>
          ))}
        </Card>

        {c.obs && <Card className="p-4"><p className="text-xs font-semibold text-gray-500 mb-1">Observações</p><p className="text-sm text-gray-700">{c.obs}</p></Card>}

        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Resumo comercial</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-extrabold text-gray-900">{a.numPedidos}</p><p className="text-[11px] text-gray-500">pedidos</p></div>
            <div><p className="text-lg font-extrabold text-gray-900">{fmtBRL(a.ticket)}</p><p className="text-[11px] text-gray-500">ticket médio</p></div>
            <div><p className="text-lg font-extrabold text-emerald-700">{fmtBRL(a.totalComprado)}</p><p className="text-[11px] text-gray-500">total comprado</p></div>
          </div>
          {a.proxima && <p className="text-xs text-center text-gray-500 mt-3">Próxima recompra estimada: <span className="font-semibold text-gray-800">{fmtData(a.proxima)}</span></p>}
        </Card>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900">Últimos pedidos</h3>
            <button onClick={() => nav("pedidoForm", { clienteId: c.id })} className="text-xs font-bold text-emerald-800">+ Novo pedido</button>
          </div>
          {pedidosC.length === 0 ? <p className="text-sm text-gray-400">Nenhum pedido registrado.</p> : (
            <div className="space-y-2">
              {pedidosC.slice(0, 5).map((p) => (
                <Card key={p.id} className="p-3 flex items-center justify-between" onClick={() => nav("pedido", { id: p.id })}>
                  <div><p className="text-sm font-semibold text-gray-800">{fmtData(p.data)}</p><p className="text-xs text-gray-500">{p.itens.length} itens</p></div>
                  <div className="text-right"><p className="text-sm font-bold text-gray-900">{fmtBRL(totalPedido(p).total)}</p><Badge tom={tomStatusPedido(p.status)}>{p.status}</Badge></div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900">Histórico de visitas</h3>
            <button onClick={() => nav("visitaForm", { clienteId: c.id })} className="text-xs font-bold text-emerald-800">+ Registrar visita</button>
          </div>
          {visitasC.length === 0 ? <p className="text-sm text-gray-400">Nenhuma visita registrada.</p> : (
            <div className="space-y-2">
              {visitasC.slice(0, 5).map((v) => (
                <Card key={v.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">{fmtData(v.data)} {v.hora && `· ${v.hora}`}</p>
                    <Badge tom={v.resultado === "Pedido realizado" ? "verde" : v.resultado === "Sem interesse" ? "vermelho" : "azul"}>{v.resultado}</Badge>
                  </div>
                  {v.obs && <p className="text-xs text-gray-600 mt-1">{v.obs}</p>}
                  {v.proximaAcao && <p className="text-xs text-orange-700 mt-1">➡ {v.proximaAcao}{v.dataRetorno ? ` (${fmtData(v.dataRetorno)})` : ""}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>

        <Btn variant="perigo" className="w-full" onClick={excluir}><Trash2 className="w-4 h-4" /> Excluir cliente</Btn>
      </div>
    </div>
  );
}

/* ---------------- Formulário de cliente ---------------- */
function ClienteForm({ db, view, nav, up, notify }) {
  const existente = db.clientes.find((x) => x.id === view.id);
  const [f, setF] = useState(existente || {
    id: uid(), fantasia: "", razao: "", cnpj: "", comprador: "", telefone: "", whatsapp: "", email: "",
    endereco: "", regiao: REGIOES[0], tipo: TIPOS_ESTAB[0], horario: "", diaPreferencial: "",
    limiteCredito: 0, pagamentoPreferido: FORMAS_PGTO[0], cicloMedio: 30, ticketMedio: 0,
    produtosFavoritos: [], obs: "", status: "Ativo", altoPotencial: false,
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const salvar = () => {
    if (!f.fantasia.trim()) return notify("Informe o nome fantasia do cliente.", "erro");
    if (existente) up((d) => ({ clientes: d.clientes.map((x) => (x.id === f.id ? f : x)) }));
    else up((d) => ({ clientes: [...d.clientes, f] }));
    notify(existente ? "Cliente atualizado. ✅" : "Cliente cadastrado. ✅");
    nav(existente ? "cliente" : "clientes", existente ? { id: f.id } : {});
  };
  return (
    <div className="pb-28">
      <Cabecalho titulo={existente ? "Editar cliente" : "Novo cliente"} voltar={() => nav(existente ? "cliente" : "clientes", existente ? { id: f.id } : {})} />
      <div className="px-4 pt-4 space-y-3">
        <Inp label="Nome fantasia *" value={f.fantasia} onChange={(e) => set("fantasia", e.target.value)} />
        <Inp label="Razão social" value={f.razao} onChange={(e) => set("razao", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="CNPJ" value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
          <Inp label="Comprador" value={f.comprador} onChange={(e) => set("comprador", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Telefone" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} />
          <Inp label="WhatsApp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
        <Inp label="E-mail" value={f.email} onChange={(e) => set("email", e.target.value)} />
        <Inp label="Endereço" value={f.endereco} onChange={(e) => set("endereco", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Região" value={f.regiao} onChange={(e) => set("regiao", e.target.value)}>{REGIOES.map((r) => <option key={r}>{r}</option>)}</Sel>
          <Sel label="Tipo" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS_ESTAB.map((t) => <option key={t}>{t}</option>)}</Sel>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Melhor horário" value={f.horario} onChange={(e) => set("horario", e.target.value)} placeholder="08h às 12h" />
          <Inp label="Dia preferencial" value={f.diaPreferencial} onChange={(e) => set("diaPreferencial", e.target.value)} placeholder="Terça-feira" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Pagamento preferido" value={f.pagamentoPreferido} onChange={(e) => set("pagamentoPreferido", e.target.value)}>{FORMAS_PGTO.map((p) => <option key={p}>{p}</option>)}</Sel>
          <Inp label="Limite de crédito (R$)" type="number" value={f.limiteCredito} onChange={(e) => set("limiteCredito", Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Ciclo médio (dias)" type="number" value={f.cicloMedio} onChange={(e) => set("cicloMedio", Number(e.target.value))} />
          <Inp label="Ticket médio (R$)" type="number" value={f.ticketMedio} onChange={(e) => set("ticketMedio", Number(e.target.value))} />
        </div>
        <Txa label="Observações" rows={3} value={f.obs} onChange={(e) => set("obs", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}><option>Ativo</option><option>Inativo</option></Sel>
          <label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={f.altoPotencial} onChange={(e) => set("altoPotencial", e.target.checked)} className="w-4 h-4 accent-emerald-700" />
            <span className="text-sm font-semibold text-gray-700">Alto potencial</span>
          </label>
        </div>
        <Btn className="w-full" onClick={salvar}><Check className="w-4 h-4" /> {existente ? "Salvar alterações" : "Cadastrar cliente"}</Btn>
      </div>
    </div>
  );
}

/* ---------------- Formulário de visita ---------------- */
function VisitaForm({ db, view, nav, up, notify }) {
  const cliente = db.clientes.find((c) => c.id === view.clienteId);
  const [f, setF] = useState({
    id: uid(), clienteId: view.clienteId || "", data: hojeISO(), hora: "",
    atendidoPor: cliente ? cliente.comprador : "", resultado: RESULTADOS_VISITA[0],
    obs: "", produtosApresentados: [], objecoes: "", proximaAcao: "", dataRetorno: "",
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const salvar = () => {
    if (!f.clienteId) return notify("Selecione o cliente.", "erro");
    up((d) => ({ visitas: [...d.visitas, f] }));
    notify("Visita registrada. ✅");
    nav("cliente", { id: f.clienteId });
  };
  return (
    <div className="pb-28">
      <Cabecalho titulo="Registrar visita" voltar={() => nav(view.clienteId ? "cliente" : "clientes", view.clienteId ? { id: view.clienteId } : {})} />
      <div className="px-4 pt-4 space-y-3">
        {!view.clienteId && (
          <Sel label="Cliente" value={f.clienteId} onChange={(e) => set("clienteId", e.target.value)}>
            <option value="">Selecione…</option>
            {db.clientes.map((c) => <option key={c.id} value={c.id}>{c.fantasia}</option>)}
          </Sel>
        )}
        {cliente && <Card className="p-3 text-sm"><span className="font-bold text-gray-900">{cliente.fantasia}</span> · {cliente.regiao}</Card>}
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Data" type="date" value={f.data} onChange={(e) => set("data", e.target.value)} />
          <Inp label="Hora" type="time" value={f.hora} onChange={(e) => set("hora", e.target.value)} />
        </div>
        <Inp label="Atendido por" value={f.atendidoPor} onChange={(e) => set("atendidoPor", e.target.value)} />
        <Sel label="Resultado" value={f.resultado} onChange={(e) => set("resultado", e.target.value)}>{RESULTADOS_VISITA.map((r) => <option key={r}>{r}</option>)}</Sel>
        <Txa label="O que aconteceu" rows={3} value={f.obs} onChange={(e) => set("obs", e.target.value)} />
        <Txa label="Objeções do cliente" rows={2} value={f.objecoes} onChange={(e) => set("objecoes", e.target.value)} />
        <Inp label="Próxima ação" value={f.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} placeholder="Ex.: retornar com proposta ajustada" />
        <Inp label="Data de retorno" type="date" value={f.dataRetorno} onChange={(e) => set("dataRetorno", e.target.value)} />
        <Btn className="w-full" onClick={salvar}><Check className="w-4 h-4" /> Salvar visita</Btn>
      </div>
    </div>
  );
}

/* ---------------- Tela 4 — Pedidos ---------------- */
function TelaPedidos({ db, nav }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const nomeCliente = (id) => { const c = db.clientes.find((x) => x.id === id); return c ? c.fantasia : "Cliente"; };

  let lista = [...db.pedidos].sort((a, b) => b.data.localeCompare(a.data));
  lista = lista.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (q && !nomeCliente(p.clienteId).toLowerCase().includes(q)) return false;
    if (filtro === "Abertos" && (p.status === "Entregue" || p.status === "Cancelado")) return false;
    if (filtro === "Entregues" && p.status !== "Entregue") return false;
    if (filtro === "A receber" && p.statusPagamento !== "Pendente") return false;
    return true;
  });
  const totalMes = db.pedidos.filter((p) => mesAtual(p.data) && p.status !== "Cancelado").reduce((s, p) => s + totalPedido(p).total, 0);

  return (
    <div className="pb-28">
      <Cabecalho titulo="Pedidos" acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={() => nav("pedidoForm")}><Plus className="w-4 h-4" /> Novo</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <Card className="p-3.5 flex items-center justify-between">
          <span className="text-sm text-gray-500">Vendido no mês</span>
          <span className="font-extrabold text-emerald-800">{fmtBRL(totalMes)}</span>
        </Card>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["Todos", "Abertos", "Entregues", "A receber"].map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
        </div>
        {lista.length === 0 ? <Vazio icone={ShoppingCart} titulo="Nenhum pedido" texto="Crie um novo pedido para começar." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map((p) => (
              <Card key={p.id} className="p-4" onClick={() => nav("pedido", { id: p.id })}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900 truncate">{nomeCliente(p.clienteId)}</p>
                  <Badge tom={tomStatusPedido(p.status)}>{p.status}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{fmtData(p.data)} · {p.itens.length} itens · {p.formaPagamento}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-lg font-extrabold text-gray-900">{fmtBRL(totalPedido(p).total)}</p>
                  <Badge tom={p.statusPagamento === "Pago" ? "verde" : "laranja"}>{p.statusPagamento || "—"}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Detalhe do pedido ---------------- */
function PedidoDetalhe({ db, view, nav, up, notify, confirmAsk }) {
  const p = db.pedidos.find((x) => x.id === view.id);
  if (!p) return <div><Cabecalho titulo="Pedido" voltar={() => nav("pedidos")} /><p className="p-4 text-gray-500">Pedido não encontrado.</p></div>;
  const cliente = db.clientes.find((c) => c.id === p.clienteId);
  const { sub, desc, total } = totalPedido(p);
  const com = comissaoPedido(p, db.produtos);
  const nomeProd = (id) => { const pr = db.produtos.find((x) => x.id === id); return pr ? pr.nome : "Produto"; };

  const mudar = (campo, valor) => up((d) => ({ pedidos: d.pedidos.map((x) => (x.id === p.id ? { ...x, [campo]: valor } : x)) }));
  const excluir = () => confirmAsk("Excluir este pedido?", () => { up((d) => ({ pedidos: d.pedidos.filter((x) => x.id !== p.id) })); nav("pedidos"); notify("Pedido excluído."); });
  const enviarWhats = async () => {
    const txt = msgPedidoWhats(p, cliente, db.produtos, db.config);
    const wpp = (cliente?.whatsapp || cliente?.telefone || "").replace(/\D/g, "");
    await copyText(txt);
    window.open(`https://wa.me/55${wpp}?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <div className="pb-28">
      <Cabecalho titulo="Pedido" voltar={() => nav("pedidos")}
        acao={<button onClick={() => nav("pedidoForm", { pedidoId: p.id })} className="p-1.5 rounded-full hover:bg-emerald-800"><Edit3 className="w-5 h-5" /></button>} />
      <div className="px-4 pt-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <button onClick={() => cliente && nav("cliente", { id: cliente.id })} className="font-extrabold text-gray-900">{cliente ? cliente.fantasia : "—"}</button>
            <Badge tom={tomStatusPedido(p.status)}>{p.status}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{fmtData(p.data)} · entrega {fmtData(p.previsaoEntrega)}</p>
        </Card>

        <Card className="divide-y divide-gray-50">
          {p.itens.map((i, idx) => (
            <div key={idx} className="flex justify-between px-4 py-2.5 text-sm">
              <span className="text-gray-700">{i.qtd}x {nomeProd(i.produtoId)}</span>
              <span className="font-semibold text-gray-900">{fmtBRL(i.qtd * i.preco)}</span>
            </div>
          ))}
          <div className="px-4 py-2.5 text-sm flex justify-between text-gray-500"><span>Subtotal</span><span>{fmtBRL(sub)}</span></div>
          {desc > 0 && <div className="px-4 py-2.5 text-sm flex justify-between text-orange-600"><span>Desconto ({p.descontoPct}%)</span><span>-{fmtBRL(desc)}</span></div>}
          <div className="px-4 py-3 flex justify-between font-extrabold text-gray-900"><span>Total</span><span>{fmtBRL(total)}</span></div>
          <div className="px-4 py-2.5 text-sm flex justify-between text-emerald-700"><span>Sua comissão</span><span className="font-bold">{fmtBRL(com)}</span></div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Sel label="Status do pedido" value={p.status} onChange={(e) => mudar("status", e.target.value)}>{STATUS_PEDIDO.map((s) => <option key={s}>{s}</option>)}</Sel>
          <Sel label="Comissão" value={p.comissaoStatus} onChange={(e) => mudar("comissaoStatus", e.target.value)}>{STATUS_COMISSAO.map((s) => <option key={s}>{s}</option>)}</Sel>
        </div>
        <Sel label="Pagamento do cliente" value={p.statusPagamento || "Pendente"} onChange={(e) => mudar("statusPagamento", e.target.value)}><option>Pendente</option><option>Pago</option></Sel>
        {p.obs && <Card className="p-4"><p className="text-xs font-semibold text-gray-500 mb-1">Observações</p><p className="text-sm text-gray-700">{p.obs}</p></Card>}

        <Btn className="w-full" onClick={enviarWhats}><MessageCircle className="w-4 h-4" /> Enviar pedido por WhatsApp</Btn>
        <Btn variant="perigo" className="w-full" onClick={excluir}><Trash2 className="w-4 h-4" /> Excluir pedido</Btn>
      </div>
    </div>
  );
}

/* ---------------- Formulário de pedido ---------------- */
function PedidoForm({ db, view, nav, up, notify }) {
  const editando = view.pedidoId ? db.pedidos.find((x) => x.id === view.pedidoId) : null;
  const [clienteId, setClienteId] = useState(editando?.clienteId || view.clienteId || "");
  const [itens, setItens] = useState(editando ? editando.itens.map((i) => ({ ...i })) : []);
  const [descontoPct, setDescontoPct] = useState(editando?.descontoPct || 0);
  const [formaPagamento, setFormaPagamento] = useState(editando?.formaPagamento || FORMAS_PGTO[0]);
  const [previsaoEntrega, setPrevisaoEntrega] = useState(editando?.previsaoEntrega || dOff(2));
  const [obs, setObs] = useState(editando?.obs || "");
  const [buscaProd, setBuscaProd] = useState("");

  const cliente = db.clientes.find((c) => c.id === clienteId);
  const addItem = (pr) => {
    setItens((arr) => {
      const ex = arr.find((i) => i.produtoId === pr.id);
      if (ex) return arr.map((i) => (i.produtoId === pr.id ? { ...i, qtd: i.qtd + 1 } : i));
      return [...arr, { produtoId: pr.id, qtd: pr.pedidoMin || 1, preco: precoVenda(pr) }];
    });
  };
  const setQtd = (id, q) => setItens((arr) => arr.map((i) => (i.produtoId === id ? { ...i, qtd: Math.max(0, q) } : i)).filter((i) => i.qtd > 0));
  const setPreco = (id, v) => setItens((arr) => arr.map((i) => (i.produtoId === id ? { ...i, preco: v } : i)));

  const produtosFiltrados = db.produtos.filter((p) => p.status === "Ativo" && (`${p.nome} ${p.marca} ${p.categoria}`.toLowerCase().includes(buscaProd.trim().toLowerCase())));
  const rascunho = { itens, descontoPct };
  const { sub, desc, total } = totalPedido(rascunho);
  const com = comissaoPedido(rascunho, db.produtos);

  const salvar = (status) => {
    if (!clienteId) return notify("Selecione o cliente.", "erro");
    if (!itens.length) return notify("Adicione ao menos um produto.", "erro");
    const base = { clienteId, itens, descontoPct: Number(descontoPct) || 0, formaPagamento, previsaoEntrega, obs, status };
    if (editando) {
      up((d) => ({ pedidos: d.pedidos.map((x) => (x.id === editando.id ? { ...x, ...base } : x)) }));
      notify("Pedido atualizado. ✅"); nav("pedido", { id: editando.id });
    } else {
      const novo = { id: uid(), data: hojeISO(), statusPagamento: "Pendente", comissaoStatus: "Prevista", comissaoPrevisao: dOff(30), ...base };
      up((d) => ({ pedidos: [...d.pedidos, novo] }));
      notify("Pedido criado. ✅"); nav("pedido", { id: novo.id });
    }
  };

  const nomeProd = (id) => { const pr = db.produtos.find((x) => x.id === id); return pr ? pr.nome : ""; };

  return (
    <div className="pb-40">
      <Cabecalho titulo={editando ? "Editar pedido" : "Novo pedido"} voltar={() => nav(view.clienteId ? "cliente" : "pedidos", view.clienteId ? { id: view.clienteId } : {})} />
      <div className="px-4 pt-4 space-y-3">
        {!editando && (
          <Sel label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecione…</option>
            {db.clientes.map((c) => <option key={c.id} value={c.id}>{c.fantasia} — {c.regiao}</option>)}
          </Sel>
        )}
        {cliente && <Card className="p-3 text-sm"><span className="font-bold text-gray-900">{cliente.fantasia}</span> · pagamento {cliente.pagamentoPreferido}</Card>}

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Itens do pedido</p>
          {itens.length === 0 ? <p className="text-sm text-gray-400 mb-2">Nenhum item ainda. Busque produtos abaixo.</p> : (
            <div className="space-y-2 mb-3">
              {itens.map((i) => (
                <Card key={i.produtoId} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 flex-1 truncate">{nomeProd(i.produtoId)}</p>
                    <button onClick={() => setQtd(i.produtoId, 0)} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setQtd(i.produtoId, i.qtd - 1)} className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50">−</button>
                      <input type="number" value={i.qtd} onChange={(e) => setQtd(i.produtoId, Number(e.target.value))} className="w-12 text-center text-sm py-1.5 focus:outline-none" />
                      <button onClick={() => setQtd(i.produtoId, i.qtd + 1)} className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50">+</button>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-400">R$</span>
                      <input type="number" step="0.01" value={i.preco} onChange={(e) => setPreco(i.produtoId, Number(e.target.value))} className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                    </div>
                    <span className="ml-auto text-sm font-bold text-gray-900">{fmtBRL(i.qtd * i.preco)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input value={buscaProd} onChange={(e) => setBuscaProd(e.target.value)} placeholder="Buscar produto para adicionar…"
              className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
          </div>
          {buscaProd && (
            <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
              {produtosFiltrados.slice(0, 8).map((pr) => (
                <button key={pr.id} onClick={() => { addItem(pr); setBuscaProd(""); }} className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:bg-emerald-50 text-left">
                  <span className="text-xl">{pr.foto}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{pr.nome}</p><p className="text-xs text-gray-500">{fmtBRL(precoVenda(pr))} · mín {pr.pedidoMin} kg</p></div>
                  <Plus className="w-4 h-4 text-emerald-700" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Inp label="Desconto (%)" type="number" value={descontoPct} onChange={(e) => setDescontoPct(Number(e.target.value))} />
          <Inp label="Previsão de entrega" type="date" value={previsaoEntrega} onChange={(e) => setPrevisaoEntrega(e.target.value)} />
        </div>
        <Sel label="Forma de pagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>{FORMAS_PGTO.map((f) => <option key={f}>{f}</option>)}</Sel>
        <Txa label="Observações" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Total {desc > 0 && `(−${fmtBRL(desc)})`}</span>
          <span className="font-extrabold text-gray-900">{fmtBRL(total)} <span className="text-xs font-semibold text-emerald-700">· comissão {fmtBRL(com)}</span></span>
        </div>
        <div className="flex gap-2">
          <Btn variant="contorno" className="flex-1" onClick={() => salvar("Rascunho")}>Salvar rascunho</Btn>
          <Btn className="flex-1" onClick={() => salvar(editando ? editando.status : "Enviado")}><Check className="w-4 h-4" /> {editando ? "Salvar" : "Confirmar pedido"}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tela 5 — Produtos (catálogo compartilhado) ---------------- */
function TelaProdutos({ db, nav }) {
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState("Todas");
  const empresaNome = (id) => { const e = db.empresas.find((x) => x.id === id); return e ? e.nome : "—"; };
  let lista = db.produtos.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (q && !(`${p.nome} ${p.marca} ${p.codigo}`.toLowerCase().includes(q))) return false;
    if (cat !== "Todas" && p.categoria !== cat) return false;
    return true;
  });
  return (
    <div className="pb-28">
      <Cabecalho titulo="Catálogo de produtos" acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={() => nav("produtoForm")}><Plus className="w-4 h-4" /> Novo</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-xl bg-sky-50 text-sky-800 text-xs px-3 py-2">Este catálogo é compartilhado por toda a equipe. Alterações aqui aparecem para todos os representantes.</div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, marca ou código…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["Todas", ...CATEGORIAS].map((c) => <Chip key={c} ativo={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
        {lista.length === 0 ? <Vazio icone={Package} titulo="Nenhum produto" texto="Ajuste a busca ou cadastre um novo produto." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map((p) => (
              <Card key={p.id} className="p-3.5" onClick={() => nav("produtoForm", { id: p.id })}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{p.foto}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{p.nome}</p>
                    <p className="text-xs text-gray-500">{p.marca} · {empresaNome(p.empresaId)}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-sm font-extrabold text-emerald-700">{fmtBRL(precoVenda(p))}</span>
                      <span className="text-xs text-gray-400">venda</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge tom="cinza">{p.categoria}</Badge>
                      <Badge tom="cinza">custo {fmtBRL(p.custo ?? p.preco)}</Badge>
                      <Badge tom="verde">+{p.margem ?? 15}%</Badge>
                      {p.estoque === 0 ? <Badge tom="vermelho">Sem estoque</Badge> : <Badge tom="cinza">{p.estoque} kg</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Formulário de produto ---------------- */
function ProdutoForm({ db, view, nav, up, notify, confirmAsk }) {
  const existente = db.produtos.find((x) => x.id === view.id);
  const [f, setF] = useState(existente || {
    id: uid(), nome: "", marca: "", categoria: CATEGORIAS[0], codigo: "", foto: "🥩", unidade: "kg",
    qtdCaixa: 1, custo: 0, margem: 15, preco: 0, precoPromo: null, comissaoPct: 5, estoque: 0, pedidoMin: 1, validade: "",
    status: "Ativo", empresaId: db.empresas[0]?.id || "", descricao: "", relacionados: [],
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const salvar = () => {
    if (!f.nome.trim()) return notify("Informe o nome do produto.", "erro");
    const ff = { ...f, preco: calcVenda(f.custo, f.margem) };
    if (existente) up((d) => ({ produtos: d.produtos.map((x) => (x.id === ff.id ? ff : x)) }));
    else up((d) => ({ produtos: [...d.produtos, ff] }));
    notify(existente ? "Produto atualizado. ✅" : "Produto cadastrado. ✅");
    nav("produtos");
  };
  const excluir = () => confirmAsk("Excluir este produto do catálogo compartilhado?", () => {
    up((d) => ({ produtos: d.produtos.filter((x) => x.id !== f.id) })); nav("produtos"); notify("Produto excluído.");
  });
  return (
    <div className="pb-28">
      <Cabecalho titulo={existente ? "Editar produto" : "Novo produto"} voltar={() => nav("produtos")} />
      <div className="px-4 pt-4 space-y-3">
        <div className="flex gap-3 items-end">
          <Inp label="Emoji" value={f.foto} onChange={(e) => set("foto", e.target.value)} className="w-16 text-center text-xl" />
          <div className="flex-1"><Inp label="Nome *" value={f.nome} onChange={(e) => set("nome", e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Marca" value={f.marca} onChange={(e) => set("marca", e.target.value)} />
          <Inp label="Código" value={f.codigo} onChange={(e) => set("codigo", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Categoria" value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Sel>
          <Sel label="Empresa" value={f.empresaId} onChange={(e) => set("empresaId", e.target.value)}>{db.empresas.map((em) => <option key={em.id} value={em.id}>{em.nome}</option>)}</Sel>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Custo de compra (R$)" type="number" step="0.01" value={f.custo} onChange={(e) => set("custo", Number(e.target.value))} />
          <Inp label="Margem (%)" type="number" min="1" max="30" value={f.margem} onChange={(e) => set("margem", Number(e.target.value))} />
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-800 font-semibold">Valor de venda</span>
          <span className="text-lg font-extrabold text-emerald-700">{fmtBRL(calcVenda(f.custo, f.margem))}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Inp label="Comissão (%)" type="number" value={f.comissaoPct} onChange={(e) => set("comissaoPct", Number(e.target.value))} />
          <Inp label="Estoque" type="number" value={f.estoque} onChange={(e) => set("estoque", Number(e.target.value))} />
          <Inp label="Pedido mín." type="number" value={f.pedidoMin} onChange={(e) => set("pedidoMin", Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Unidade" value={f.unidade} onChange={(e) => set("unidade", e.target.value)} />
          <Inp label="Validade" value={f.validade} onChange={(e) => set("validade", e.target.value)} placeholder="Ex.: 12 meses" />
        </div>
        <Txa label="Descrição" rows={3} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} />
        <Sel label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}><option>Ativo</option><option>Inativo</option></Sel>
        <Btn className="w-full" onClick={salvar}><Check className="w-4 h-4" /> {existente ? "Salvar alterações" : "Cadastrar produto"}</Btn>
        {existente && <Btn variant="perigo" className="w-full" onClick={excluir}><Trash2 className="w-4 h-4" /> Excluir produto</Btn>}
      </div>
    </div>
  );
}

/* ---------------- Tela 6 — Comissões ---------------- */
function TelaComissoes({ db, nav }) {
  const [filtro, setFiltro] = useState("Todas");
  const nomeCliente = (id) => { const c = db.clientes.find((x) => x.id === id); return c ? c.fantasia : "Cliente"; };
  const registros = db.pedidos
    .filter((p) => p.status !== "Cancelado" && p.status !== "Rascunho")
    .map((p) => ({ p, com: comissaoPedido(p, db.produtos) }))
    .sort((a, b) => b.p.data.localeCompare(a.p.data));

  const soma = (fn) => registros.filter(fn).reduce((s, r) => s + r.com, 0);
  const totalPrevista = soma((r) => r.p.comissaoStatus === "Prevista" || r.p.comissaoStatus === "Aguardando pagamento do cliente");
  const totalLiberada = soma((r) => r.p.comissaoStatus === "Liberada");
  const totalRecebida = soma((r) => r.p.comissaoStatus === "Recebida");

  const lista = registros.filter((r) => filtro === "Todas" ? true : r.p.comissaoStatus === filtro);

  return (
    <div className="pb-28">
      <Cabecalho titulo="Comissões" voltar={() => nav("mais")} />
      <div className="px-4 pt-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center"><p className="text-[11px] text-gray-500">A liberar</p><p className="text-sm font-extrabold text-orange-500 mt-0.5">{fmtBRL(totalPrevista)}</p></Card>
          <Card className="p-3 text-center"><p className="text-[11px] text-gray-500">Liberada</p><p className="text-sm font-extrabold text-sky-600 mt-0.5">{fmtBRL(totalLiberada)}</p></Card>
          <Card className="p-3 text-center"><p className="text-[11px] text-gray-500">Recebida</p><p className="text-sm font-extrabold text-emerald-700 mt-0.5">{fmtBRL(totalRecebida)}</p></Card>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["Todas", ...STATUS_COMISSAO].map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
        </div>
        {lista.length === 0 ? <Vazio icone={DollarSign} titulo="Nenhuma comissão" texto="Sem registros para este filtro." /> : (
          <div className="space-y-2">
            {lista.map(({ p, com }) => (
              <Card key={p.id} className="p-3.5" onClick={() => nav("pedido", { id: p.id })}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900 truncate">{nomeCliente(p.clienteId)}</p>
                  <span className="font-extrabold text-emerald-700">{fmtBRL(com)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{fmtData(p.data)} · pedido {fmtBRL(totalPedido(p).total)}</p>
                  <Badge tom={tomStatusComissao(p.comissaoStatus)}>{p.comissaoStatus}</Badge>
                </div>
                {p.comissaoPrevisao && <p className="text-[11px] text-gray-400 mt-1">Previsão: {fmtData(p.comissaoPrevisao)}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Tela 7 — Prospecção (funil) ---------------- */
function TelaProspeccao({ db, nav, up, notify }) {
  const porEtapa = (e) => db.oportunidades.filter((o) => o.etapa === e);
  const totalPotencial = db.oportunidades.filter((o) => o.etapa !== "Perdido" && o.etapa !== "Cliente conquistado").reduce((s, o) => s + (o.potencialMensal || 0), 0);
  const mover = (o, dir) => {
    const idx = ETAPAS_FUNIL.indexOf(o.etapa);
    const nova = ETAPAS_FUNIL[Math.min(ETAPAS_FUNIL.length - 1, Math.max(0, idx + dir))];
    up((d) => ({ oportunidades: d.oportunidades.map((x) => (x.id === o.id ? { ...x, etapa: nova } : x)) }));
  };
  const tomEtapa = (e) => e === "Cliente conquistado" ? "verde" : e === "Perdido" ? "vermelho" : e === "Negociação" ? "laranja" : "azul";

  return (
    <div className="pb-28">
      <Cabecalho titulo="Prospecção" acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={() => nav("oportunidadeForm")}><Plus className="w-4 h-4" /> Novo</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <Card className="p-3.5 flex items-center justify-between">
          <span className="text-sm text-gray-500">Potencial em negociação</span>
          <span className="font-extrabold text-emerald-800">{fmtBRL(totalPotencial)}/mês</span>
        </Card>
        {ETAPAS_FUNIL.map((etapa) => {
          const itens = porEtapa(etapa);
          if (!itens.length) return null;
          return (
            <div key={etapa}>
              <div className="flex items-center gap-2 mb-1.5 mt-3">
                <Badge tom={tomEtapa(etapa)}>{etapa}</Badge>
                <span className="text-xs text-gray-400">{itens.length}</span>
              </div>
              <div className="space-y-2">
                {itens.map((o) => (
                  <Card key={o.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => nav("oportunidadeForm", { id: o.id })} className="text-left flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{o.nome}</p>
                        <p className="text-xs text-gray-500">{o.tipo} · {o.regiao} · {o.origem}</p>
                      </button>
                      <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">{fmtBRL(o.potencialMensal || 0)}</span>
                    </div>
                    {o.proximaAcao && (
                      <p className={`text-xs mt-1.5 rounded-lg px-2 py-1 ${o.dataProximaAcao && o.dataProximaAcao < hojeISO() ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
                        ➡ {o.proximaAcao}{o.dataProximaAcao ? ` (${fmtData(o.dataProximaAcao)})` : ""}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2.5">
                      {o.whatsapp && <a href={`https://wa.me/55${o.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex-1"><Btn variant="claro" className="w-full !py-2"><MessageCircle className="w-4 h-4" /></Btn></a>}
                      <Btn variant="contorno" className="!py-2 !px-2.5" onClick={() => mover(o, -1)}><ChevronDown className="w-4 h-4" /></Btn>
                      <Btn variant="contorno" className="!py-2 !px-2.5" onClick={() => mover(o, 1)}><ChevronUp className="w-4 h-4" /></Btn>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Formulário de oportunidade ---------------- */
function OportunidadeForm({ db, view, nav, up, notify, confirmAsk }) {
  const existente = db.oportunidades.find((x) => x.id === view.id);
  const [f, setF] = useState(existente || {
    id: uid(), nome: "", tipo: TIPOS_ESTAB[0], responsavel: "", telefone: "", whatsapp: "",
    regiao: REGIOES[0], origem: "Visita fria", produtosInteresse: "", potencialMensal: 0,
    proximaAcao: "", dataProximaAcao: "", obs: "", etapa: ETAPAS_FUNIL[0],
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const salvar = () => {
    if (!f.nome.trim()) return notify("Informe o nome do estabelecimento.", "erro");
    if (existente) up((d) => ({ oportunidades: d.oportunidades.map((x) => (x.id === f.id ? f : x)) }));
    else up((d) => ({ oportunidades: [...d.oportunidades, f] }));
    notify(existente ? "Oportunidade atualizada. ✅" : "Oportunidade criada. ✅");
    nav("prospeccao");
  };
  const virarCliente = () => confirmAsk(`Cadastrar "${f.nome}" como cliente ativo?`, () => {
    const novo = {
      id: uid(), fantasia: f.nome, razao: "", cnpj: "", comprador: f.responsavel, telefone: f.telefone,
      whatsapp: f.whatsapp, email: "", endereco: "", regiao: f.regiao, tipo: f.tipo, horario: "", diaPreferencial: "",
      limiteCredito: 0, pagamentoPreferido: FORMAS_PGTO[0], cicloMedio: 30, ticketMedio: f.potencialMensal || 0,
      produtosFavoritos: [], obs: f.obs, status: "Ativo", altoPotencial: (f.potencialMensal || 0) >= 3000,
    };
    up((d) => ({
      clientes: [...d.clientes, novo],
      oportunidades: d.oportunidades.map((x) => (x.id === f.id ? { ...x, etapa: "Cliente conquistado" } : x)),
    }));
    notify("Cliente criado a partir da oportunidade. ✅");
    nav("cliente", { id: novo.id });
  });
  const excluir = () => confirmAsk("Excluir esta oportunidade?", () => { up((d) => ({ oportunidades: d.oportunidades.filter((x) => x.id !== f.id) })); nav("prospeccao"); notify("Oportunidade excluída."); });

  return (
    <div className="pb-28">
      <Cabecalho titulo={existente ? "Editar oportunidade" : "Nova oportunidade"} voltar={() => nav("prospeccao")} />
      <div className="px-4 pt-4 space-y-3">
        <Inp label="Estabelecimento *" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Tipo" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS_ESTAB.map((t) => <option key={t}>{t}</option>)}</Sel>
          <Sel label="Região" value={f.regiao} onChange={(e) => set("regiao", e.target.value)}>{REGIOES.map((r) => <option key={r}>{r}</option>)}</Sel>
        </div>
        <Inp label="Responsável / contato" value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Telefone" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} />
          <Inp label="WhatsApp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Origem" value={f.origem} onChange={(e) => set("origem", e.target.value)} placeholder="Indicação, visita fria…" />
          <Inp label="Potencial mensal (R$)" type="number" value={f.potencialMensal} onChange={(e) => set("potencialMensal", Number(e.target.value))} />
        </div>
        <Inp label="Produtos de interesse" value={f.produtosInteresse} onChange={(e) => set("produtosInteresse", e.target.value)} />
        <Sel label="Etapa do funil" value={f.etapa} onChange={(e) => set("etapa", e.target.value)}>{ETAPAS_FUNIL.map((et) => <option key={et}>{et}</option>)}</Sel>
        <Inp label="Próxima ação" value={f.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} />
        <Inp label="Data da próxima ação" type="date" value={f.dataProximaAcao || ""} onChange={(e) => set("dataProximaAcao", e.target.value)} />
        <Txa label="Observações" rows={2} value={f.obs} onChange={(e) => set("obs", e.target.value)} />
        <Btn className="w-full" onClick={salvar}><Check className="w-4 h-4" /> {existente ? "Salvar" : "Criar oportunidade"}</Btn>
        {existente && <Btn variant="claro" className="w-full" onClick={virarCliente}><Store className="w-4 h-4" /> Transformar em cliente</Btn>}
        {existente && <Btn variant="perigo" className="w-full" onClick={excluir}><Trash2 className="w-4 h-4" /> Excluir</Btn>}
      </div>
    </div>
  );
}

/* ---------------- Tela 8 — Mensagens ---------------- */
function TelaMensagens({ db, nav, notify }) {
  const [clienteId, setClienteId] = useState("");
  const [modeloId, setModeloId] = useState(MODELOS_MSG[0].id);
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const modelo = MODELOS_MSG.find((m) => m.id === modeloId);
  const texto = modelo ? modelo.gerar(db.config, cliente) : "";
  const wpp = (cliente?.whatsapp || cliente?.telefone || "").replace(/\D/g, "");

  const copiar = async () => { const ok = await copyText(texto); notify(ok ? "Mensagem copiada. ✅" : "Não consegui copiar.", ok ? "ok" : "erro"); };
  const abrirWhats = () => window.open(`https://wa.me/${wpp ? "55" + wpp : ""}?text=${encodeURIComponent(texto)}`, "_blank");

  return (
    <div className="pb-28">
      <Cabecalho titulo="Mensagens prontas" voltar={() => nav("mais")} />
      <div className="px-4 pt-4 space-y-3">
        <Sel label="Cliente (opcional)" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">Sem cliente específico</option>
          {db.clientes.map((c) => <option key={c.id} value={c.id}>{c.fantasia}</option>)}
        </Sel>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Modelo</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MODELOS_MSG.map((m) => <Chip key={m.id} ativo={modeloId === m.id} onClick={() => setModeloId(m.id)}>{m.nome}</Chip>)}
          </div>
        </div>
        <Card className="p-4"><p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{texto}</p></Card>
        <div className="flex gap-2">
          <Btn variant="contorno" className="flex-1" onClick={copiar}><Copy className="w-4 h-4" /> Copiar</Btn>
          <Btn className="flex-1" onClick={abrirWhats}><MessageCircle className="w-4 h-4" /> Abrir no WhatsApp</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tela 9 — Relatórios ---------------- */
function TelaRelatorios({ db, nav }) {
  const [periodo, setPeriodo] = useState("30");
  const desde = dOff(-Number(periodo));
  const pedidosP = db.pedidos.filter((p) => p.data >= desde && p.status !== "Cancelado" && p.status !== "Rascunho");
  const totalVendido = pedidosP.reduce((s, p) => s + totalPedido(p).total, 0);
  const totalComissao = pedidosP.reduce((s, p) => s + comissaoPedido(p, db.produtos), 0);
  const nomeCliente = (id) => { const c = db.clientes.find((x) => x.id === id); return c ? c.fantasia : "Cliente"; };

  const porCliente = {};
  pedidosP.forEach((p) => { porCliente[nomeCliente(p.clienteId)] = (porCliente[nomeCliente(p.clienteId)] || 0) + totalPedido(p).total; });
  const topClientes = Object.entries(porCliente).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 6);

  const porCategoria = {};
  pedidosP.forEach((p) => p.itens.forEach((i) => {
    const pr = db.produtos.find((x) => x.id === i.produtoId);
    if (pr) porCategoria[pr.categoria] = (porCategoria[pr.categoria] || 0) + i.qtd * i.preco;
  }));
  const catData = Object.entries(porCategoria).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);

  const porProduto = {};
  pedidosP.forEach((p) => p.itens.forEach((i) => {
    const pr = db.produtos.find((x) => x.id === i.produtoId);
    if (pr) porProduto[pr.nome] = (porProduto[pr.nome] || 0) + i.qtd;
  }));
  const topProdutos = Object.entries(porProduto).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 6);

  return (
    <div className="pb-28">
      <Cabecalho titulo="Relatórios" voltar={() => nav("mais")} />
      <div className="px-4 pt-4 space-y-4">
        <div className="flex gap-2">
          {[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"]].map(([v, l]) => <Chip key={v} ativo={periodo === v} onClick={() => setPeriodo(v)}>{l}</Chip>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><p className="text-xs text-gray-500">Total vendido</p><p className="text-lg font-extrabold text-gray-900 mt-0.5">{fmtBRL(totalVendido)}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500">Comissão gerada</p><p className="text-lg font-extrabold text-emerald-700 mt-0.5">{fmtBRL(totalComissao)}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500">Pedidos</p><p className="text-lg font-extrabold text-gray-900 mt-0.5">{pedidosP.length}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500">Ticket médio</p><p className="text-lg font-extrabold text-gray-900 mt-0.5">{fmtBRL(pedidosP.length ? totalVendido / pedidosP.length : 0)}</p></Card>
        </div>
        <Card className="p-4"><p className="font-bold text-gray-900 mb-3">Top clientes</p><Barras dados={topClientes} /></Card>
        <Card className="p-4"><p className="font-bold text-gray-900 mb-3">Vendas por categoria</p><Barras dados={catData} /></Card>
        <Card className="p-4"><p className="font-bold text-gray-900 mb-3">Produtos mais vendidos (unidades)</p><Barras dados={topProdutos} fmt={(v) => `${v} un.`} cor="bg-sky-500" /></Card>
      </div>
    </div>
  );
}

/* ---------------- Tela 10 — Mais ---------------- */
function TelaMais({ db, nav, onLogout }) {
  const itens = [
    ["comissoes", DollarSign, "Comissões", "Acompanhe o que tem a receber"],
    ["prospeccao", Target, "Prospecção", "Funil de novos clientes"],
    ["mensagens", MessageSquare, "Mensagens prontas", "Modelos para WhatsApp"],
    ["relatorios", BarChart3, "Relatórios", "Vendas, categorias e produtos"],
    ["precos", Tag, "Preços do dia", "Custo, margem e valor de venda"],
    ["produtos", Package, "Catálogo de produtos", "Cadastro, estoque e comissões"],
    ["config", Settings, "Configurações", "Perfil, meta, dados e conta"],
  ];
  return (
    <div className="pb-28">
      <Cabecalho titulo="Mais" />
      <div className="px-4 pt-4 space-y-2.5">
        {itens.map(([rota, Ic, titulo, sub]) => (
          <Card key={rota} className="p-4 flex items-center gap-3" onClick={() => nav(rota)}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Ic className="w-5 h-5 text-emerald-700" /></div>
            <div className="flex-1"><p className="font-bold text-gray-900">{titulo}</p><p className="text-xs text-gray-500">{sub}</p></div>
            <ChevronUp className="w-4 h-4 text-gray-300 rotate-90" />
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Tela 11 — Configurações ---------------- */
function TelaConfig({ db, nav, up, notify, confirmAsk, setDb, onLogout }) {
  const [f, setF] = useState({ ...db.config });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const salvar = () => { up((d) => ({ config: { ...f } })); notify("Configurações salvas. ✅"); };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `girofood-backup-${hojeISO()}.json`; a.click();
    URL.revokeObjectURL(url);
    notify("Backup exportado.");
  };
  const importar = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const dados = JSON.parse(ev.target.result);
        if (!dados.clientes || !dados.produtos) throw new Error("arquivo inválido");
        setDb(dados); notify("Dados importados. ✅");
      } catch (err) { notify("Arquivo inválido.", "erro"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Apaga apenas os SEUS dados; o catálogo compartilhado é mantido.
  const apagar = () => confirmAsk("Apagar todos os SEUS dados (clientes, pedidos, visitas, prospecção e rotas)? O catálogo de produtos compartilhado não é afetado. Essa ação não pode ser desfeita.", () => {
    setDb({ ...db, clientes: [], pedidos: [], visitas: [], oportunidades: [], rotas: {} });
    notify("Seus dados foram apagados.");
  });
  // Restaura a demonstração nos seus dados; mantém o catálogo compartilhado.
  const restaurar = () => confirmAsk("Restaurar os dados de demonstração nos SEUS dados? O catálogo compartilhado é mantido.", () => {
    const demo = dadosDemo();
    setDb({ ...demo, produtos: db.produtos, empresas: db.empresas });
    notify("Dados de demonstração restaurados. ✅");
  });
  const sair = () => confirmAsk("Sair da sua conta neste aparelho?", () => { onLogout && onLogout(); });

  return (
    <div className="pb-28">
      <Cabecalho titulo="Configurações" voltar={() => nav("mais")} />
      <div className="px-4 pt-4 space-y-4">
        <Card className="p-4 space-y-3">
          <p className="font-bold text-gray-900">Perfil</p>
          <Inp label="Seu nome" value={f.nomeRep} onChange={(e) => set("nomeRep", e.target.value)} />
          <Inp label="Nome do aplicativo" value={f.nomeApp} onChange={(e) => set("nomeApp", e.target.value)} />
          <Inp label="Meta mensal (R$)" type="number" value={f.metaMensal} onChange={(e) => set("metaMensal", Number(e.target.value))} />
          <Btn className="w-full" onClick={salvar}><Check className="w-4 h-4" /> Salvar configurações</Btn>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-bold text-gray-900">Backup dos dados</p>
          <p className="text-xs text-gray-500">Seus dados já ficam salvos na nuvem, na sua conta. O backup em arquivo é uma cópia extra que você pode guardar.</p>
          <div className="flex gap-2">
            <Btn variant="contorno" className="flex-1" onClick={exportar}><Download className="w-4 h-4" /> Exportar</Btn>
            <label className="flex-1">
              <input type="file" accept="application/json" onChange={importar} className="hidden" />
              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"><Upload className="w-4 h-4" /> Importar</span>
            </label>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-bold text-gray-900">Dados de demonstração</p>
          <Btn variant="claro" className="w-full" onClick={restaurar}><RefreshCw className="w-4 h-4" /> Restaurar demonstração</Btn>
          <Btn variant="perigo" className="w-full" onClick={apagar}><Trash2 className="w-4 h-4" /> Apagar meus dados</Btn>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-bold text-gray-900">Conta</p>
          <Btn variant="contorno" className="w-full" onClick={sair}><LogOut className="w-4 h-4" /> Sair da conta</Btn>
        </Card>

        <p className="text-center text-xs text-gray-400">GiroFood · versão 1.0</p>
      </div>
    </div>
  );
}

/* ---------------- Telas de estado (carregando / sem configuração) ---------------- */
function TelaCarregando({ texto = "Carregando…" }) {
  return (
    <div className="min-h-screen bg-emerald-900 flex flex-col items-center justify-center gap-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center text-2xl font-extrabold animate-pulse">G</div>
      <p className="text-emerald-100 text-sm">{texto}</p>
    </div>
  );
}

function TelaFaltaConfig() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="max-w-md bg-white rounded-3xl shadow p-6">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3"><AlertTriangle className="w-6 h-6" /></div>
        <h1 className="text-lg font-extrabold text-gray-900">Faltam as chaves do Supabase</h1>
        <p className="text-sm text-gray-600 mt-2">O aplicativo precisa de duas variáveis de ambiente para conectar ao banco de dados e ao login:</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li className="bg-gray-100 rounded-lg px-3 py-2 font-mono text-xs">VITE_SUPABASE_URL</li>
          <li className="bg-gray-100 rounded-lg px-3 py-2 font-mono text-xs">VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm text-gray-600 mt-3">No computador, coloque-as em um arquivo <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</span> na raiz do projeto. No Vercel, adicione em Settings → Environment Variables e faça um novo deploy. O passo a passo completo está no arquivo README.</p>
      </div>
    </div>
  );
}

/* ---------------- Tela — Preços do dia (custo, margem, venda) ---------------- */
function TelaPrecos({ db, nav, up, notify, confirmAsk }) {
  const [cat, setCat] = useState("Todas");
  const [busca, setBusca] = useState("");

  const setCampo = (id, campo, valor) => up((d) => ({
    produtos: d.produtos.map((p) => {
      if (p.id !== id) return p;
      const np = { ...p, [campo]: valor };
      np.preco = calcVenda(campo === "custo" ? valor : np.custo, campo === "margem" ? valor : np.margem);
      return np;
    }),
  }));

  const restaurarCatalogo = () => confirmAsk("Restaurar o catálogo de demonstração (carnes, aves e peixes)? Isso substitui os produtos e empresas do catálogo compartilhado para TODA a equipe.", () => {
    const demo = dadosDemo();
    up(() => ({ produtos: demo.produtos.map(normalizaProduto), empresas: demo.empresas }));
    notify("Catálogo de demonstração restaurado. ✅");
  });

  let lista = db.produtos.filter((p) => {
    const q = busca.trim().toLowerCase();
    if (q && !(`${p.nome} ${p.marca}`.toLowerCase().includes(q))) return false;
    if (cat !== "Todas" && p.categoria !== cat) return false;
    return true;
  });

  return (
    <div className="pb-28">
      <Cabecalho titulo="Preços do dia" voltar={() => nav("mais")}
        acao={<Btn variant="laranja" className="!py-1.5 !px-3 text-xs" onClick={() => nav("produtoForm")}><Plus className="w-4 h-4" /> Produto</Btn>} />
      <div className="px-4 pt-4 space-y-3">
        <div className="rounded-xl bg-sky-50 text-sky-800 text-xs px-3 py-2">
          Mexa só no <b>custo</b> e na <b>margem %</b>. O valor de venda é calculado sozinho. Preços valem para toda a equipe.
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…"
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["Todas", ...CATEGORIAS].map((c) => <Chip key={c} ativo={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>

        {lista.length === 0 ? (
          <Vazio icone={Tag} titulo="Nenhum produto" texto="Ajuste a busca, ou restaure o catálogo de demonstração abaixo." />
        ) : (
          <div className="space-y-2.5">
            {lista.map((p) => {
              const custo = Number(p.custo) || 0;
              const margem = Number(p.margem) || 0;
              const venda = calcVenda(custo, margem);
              const lucro = venda - custo;
              return (
                <Card key={p.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl">{p.foto}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{p.nome}</p>
                        <p className="text-[11px] text-gray-400">{p.categoria}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-emerald-700 leading-none">{fmtBRL(venda)}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">venda / kg</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <label className="text-xs font-semibold text-gray-500 w-14">Custo</label>
                    <span className="text-xs text-gray-400">R$</span>
                    <input type="number" step="0.01" inputMode="decimal" value={custo}
                      onChange={(e) => setCampo(p.id, "custo", Number(e.target.value))}
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-700" />
                    <span className="ml-auto text-xs text-gray-500">lucro <span className="font-semibold text-gray-800">{fmtBRL(lucro)}</span></span>
                  </div>

                  <div className="flex items-center gap-3 mt-2.5">
                    <label className="text-xs font-semibold text-gray-500 w-14">Margem</label>
                    <input type="range" min="1" max="30" step="1" value={margem}
                      onChange={(e) => setCampo(p.id, "margem", Number(e.target.value))}
                      className="flex-1 accent-emerald-700" />
                    <span className="text-sm font-bold text-gray-900 w-10 text-right">{margem}%</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Btn variant="contorno" className="w-full mt-2" onClick={restaurarCatalogo}>
          <RefreshCw className="w-4 h-4" /> Restaurar catálogo de demonstração
        </Btn>
      </div>
    </div>
  );
}

/* ==================== App raiz ==================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [checandoSessao, setChecandoSessao] = useState(true);
  const [db, setDbRaw] = useState(null);
  const [view, setView] = useState({ t: "inicio" });
  const [toast, setToast] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);

  const carregado = useRef(false);
  const toastTimer = useRef(null);
  const refUser = useRef("");
  const refCat = useRef("");
  const salvarTimer = useRef(null);

  /* ---- ações base (definidas antes dos efeitos) ---- */
  const setDb = (d) => setDbRaw(d);
  const up = (fn) => setDbRaw((prev) => ({ ...prev, ...(typeof fn === "function" ? fn(prev) : fn) }));
  const notify = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  const nav = (t, extra = {}) => { setView({ t, ...extra }); window.scrollTo(0, 0); };
  const confirmAsk = (msg, onYes) => setConfirmBox({ msg, onYes });
  const sair = async () => {
    try { if (supabase) await supabase.auth.signOut(); } catch (e) { /* ignora */ }
    carregado.current = false;
    setDbRaw(null);
    setView({ t: "inicio" });
  };

  /* ---- 1) Sessão de login ---- */
  useEffect(() => {
    if (!supabaseConfigurado) { setChecandoSessao(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecandoSessao(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);

  /* ---- 2) Carregar dados da nuvem quando logar ---- */
  useEffect(() => {
    if (!supabaseConfigurado) return;
    if (!session) { setDbRaw(null); carregado.current = false; return; }
    let vivo = true;
    (async () => {
      carregado.current = false;
      try {
        const demo = dadosDemo();
        // catálogo compartilhado (id=1)
        let cat = await lerCatalogo();
        if (!cat || !cat.produtos) {
          cat = { produtos: demo.produtos, empresas: demo.empresas };
          await gravarCatalogo(cat);
        }
        // dados do usuário
        let ud = await lerDocUsuario(session.user.id);
        if (!ud || !ud.clientes) {
          ud = {
            config: demo.config, clientes: demo.clientes, pedidos: demo.pedidos,
            visitas: demo.visitas, oportunidades: demo.oportunidades, rotas: demo.rotas,
          };
          await gravarDocUsuario(session.user.id, ud);
        }
        if (!vivo) return;
        const parteUsuario = {
          config: ud.config, clientes: ud.clientes, pedidos: ud.pedidos,
          visitas: ud.visitas, oportunidades: ud.oportunidades, rotas: ud.rotas,
        };
        refUser.current = JSON.stringify(parteUsuario);
        refCat.current = JSON.stringify({ produtos: cat.produtos, empresas: cat.empresas });
        setDbRaw({ ...parteUsuario, produtos: (cat.produtos || []).map(normalizaProduto), empresas: cat.empresas });
        carregado.current = true;
      } catch (e) {
        console.error(e);
        if (vivo) notify("Não consegui carregar seus dados. Verifique a conexão.", "erro");
      }
    })();
    return () => { vivo = false; };
  }, [session]);

  /* ---- 3) Salvar na nuvem (com atraso), separando usuário x catálogo ---- */
  useEffect(() => {
    if (!supabaseConfigurado || !db || !session || !carregado.current) return;
    clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(async () => {
      const parteUsuario = {
        config: db.config, clientes: db.clientes, pedidos: db.pedidos,
        visitas: db.visitas, oportunidades: db.oportunidades, rotas: db.rotas,
      };
      const parteCat = { produtos: db.produtos, empresas: db.empresas };
      const su = JSON.stringify(parteUsuario);
      const sc = JSON.stringify(parteCat);
      try {
        if (su !== refUser.current) { await gravarDocUsuario(session.user.id, parteUsuario); refUser.current = su; }
        if (sc !== refCat.current) { await gravarCatalogo(parteCat); refCat.current = sc; }
      } catch (e) {
        console.error(e);
        notify("Falha ao salvar na nuvem — vou tentar de novo.", "erro");
      }
    }, 600);
    return () => clearTimeout(salvarTimer.current);
  }, [db, session]);

  /* ---- Barreiras de renderização ---- */
  if (!supabaseConfigurado) return <TelaFaltaConfig />;
  if (checandoSessao) return <TelaCarregando texto="Abrindo…" />;
  if (!session) return <Auth />;
  if (!db) return <TelaCarregando texto="Carregando seus dados…" />;

  const props = { db, up, nav, notify, confirmAsk, setDb, view, onLogout: sair };

  const abas = [
    ["inicio", Home, "Início"],
    ["rota", Route, "Rota"],
    ["clientes", Users, "Clientes"],
    ["pedidos", ShoppingCart, "Pedidos"],
    ["mais", MoreHorizontal, "Mais"],
  ];
  const abaAtiva = ({
    inicio: "inicio", rota: "rota", clientes: "clientes", cliente: "clientes",
    clienteForm: "clientes", visitaForm: "clientes", pedidos: "pedidos", pedido: "pedidos",
    pedidoForm: "pedidos", precos: "mais", produtos: "mais", produtoForm: "mais", comissoes: "mais",
    prospeccao: "mais", oportunidadeForm: "mais", mensagens: "mais", relatorios: "mais",
    config: "mais", mais: "mais",
  })[view.t] || "inicio";

  const renderTela = () => {
    switch (view.t) {
      case "inicio": return <TelaInicio {...props} />;
      case "rota": return <TelaRota {...props} />;
      case "clientes": return <TelaClientes {...props} />;
      case "cliente": return <ClienteDetalhe {...props} />;
      case "clienteForm": return <ClienteForm {...props} />;
      case "visitaForm": return <VisitaForm {...props} />;
      case "pedidos": return <TelaPedidos {...props} />;
      case "pedido": return <PedidoDetalhe {...props} />;
      case "pedidoForm": return <PedidoForm {...props} />;
      case "precos": return <TelaPrecos {...props} />;
      case "produtos": return <TelaProdutos {...props} />;
      case "produtoForm": return <ProdutoForm {...props} />;
      case "comissoes": return <TelaComissoes {...props} />;
      case "prospeccao": return <TelaProspeccao {...props} />;
      case "oportunidadeForm": return <OportunidadeForm {...props} />;
      case "mensagens": return <TelaMensagens {...props} />;
      case "relatorios": return <TelaRelatorios {...props} />;
      case "config": return <TelaConfig {...props} />;
      case "mais": return <TelaMais {...props} />;
      default: return <TelaInicio {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-3xl mx-auto bg-gray-50 min-h-screen relative">
        {renderTela()}

        {/* Navegação inferior */}
        <nav className="fixed bottom-0 inset-x-0 max-w-3xl mx-auto bg-white border-t border-gray-100 flex shadow-[0_-4px_16px_rgba(0,0,0,0.04)] z-40">
          {abas.map(([rota, Ic, label]) => {
            const ativo = abaAtiva === rota;
            return (
              <button key={rota} onClick={() => nav(rota)} className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${ativo ? "text-emerald-800" : "text-gray-400"}`}>
                <Ic className={`w-5 h-5 ${ativo ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-20 inset-x-0 flex justify-center z-50 px-4">
            <div className={`rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg ${toast.tipo === "erro" ? "bg-red-600 text-white" : "bg-gray-900 text-white"}`}>{toast.msg}</div>
          </div>
        )}

        {/* Confirmação */}
        {confirmBox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmBox(null)} />
            <div className="relative bg-white rounded-3xl shadow-xl max-w-sm w-full p-5">
              <p className="text-sm text-gray-800">{confirmBox.msg}</p>
              <div className="flex gap-2 mt-4">
                <Btn variant="contorno" className="flex-1" onClick={() => setConfirmBox(null)}>Cancelar</Btn>
                <Btn variant="perigo" className="flex-1" onClick={() => { confirmBox.onYes(); setConfirmBox(null); }}>Confirmar</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
