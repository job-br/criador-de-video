// Diretor de IA: lê imagem + texto juntos e cria cenas coesas (em lotes, para respeitar o timeout do Netlify)
import { json } from "../lib/lib.js";
const SYSTEM = `Você é diretor de animação e engenheiro de prompts do modelo de vídeo Wan 2.2.
Leia com atenção TODAS as características da imagem (se houver) e TODO o texto do usuário, em conjunto, e transforme-os em cenas coesas.
Regras:
- Com imagem: descreva fielmente personagens/objetos (espécie, cores exatas, roupas, acessórios, proporções, expressão), estilo de arte (3D, 2D, textura, traço), cenário, iluminação, paleta, composição e enquadramento. Tudo isso deve permanecer idêntico em todas as cenas.
- Use todo o texto: cada instrução, personagem, ação, lugar, emoção e detalhe deve aparecer na cena adequada, na ordem pedida. Nunca contradiga a imagem nem o texto.
- continuous=true: cada cena é um trecho de ~5s do MESMO plano contínuo; começa exatamente onde a anterior terminou (posição, luz, câmera) e avança a ação.
- continuous=false: cenas de uma história, mantendo personagens e estilo iguais entre elas.
- Cada cena: inglês, 45-80 palavras: sujeito + ação visível e específica + movimento de câmera + cenário + iluminação. Descreva movimento, não só aparência.
- Responda SOMENTE JSON válido, sem markdown.`;

export default async (req) => {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY ausente no Netlify" }, 503);
  const b = await req.json();
  const total = Math.min(Math.max(Number(b.total) || 5, 1), 40);
  const from = Math.max(Number(b.from) || 0, 0);
  const count = Math.min(Math.max(Number(b.count) || 6, 1), 8, total - from);
  const first = from === 0;
  const text =
    `Texto do usuário:\n${String(b.idea || "").slice(0, 8000)}\n\n` +
    `continuous=${!!b.continuous}. Total de cenas: ${total}. Escreva as cenas ${from + 1} a ${from + count}. ` +
    (from + count >= total ? "É a parte final: conclua a história/ação de forma coesa. " : "Ainda haverá cenas depois: não conclua. ") +
    (first
      ? 'Formato: {"title":"título curto em pt-BR","analysis":"o que você viu na imagem e como vai usar o texto, pt-BR, até 120 palavras","character":"descrição fixa em inglês dos personagens/elementos principais, até 60 palavras","style":"estilo visual em inglês, até 30 palavras","scenes":["..."]}'
      : `Contexto fixo: ${JSON.stringify(b.ctx || {})}\nFormato: {"scenes":["..."]}`);
  const content = [];
  const m = first && typeof b.image === "string" && b.image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  content.push({ type: "text", text });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1200 + count * 260, system: SYSTEM, messages: [{ role: "user", content }] }),
  });
  const d = await r.json();
  if (!r.ok) return json({ error: r.status === 401 ? "ANTHROPIC_API_KEY inválida" : d.error?.message || "Falha no planejamento" }, 502);
  try {
    return json(JSON.parse(d.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim()));
  } catch { return json({ error: "Plano inválido, tente de novo" }, 502); }
};
