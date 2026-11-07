import { gpu, json } from "../lib/lib.js";
// Diagnóstico: mostra na tela o que está impedindo a produção
export default async () => {
  const msgs = []; let g = false, ai = false;
  if (!process.env.GPU_API_URL || !process.env.GPU_API_KEY) msgs.push("Configure GPU_API_URL e GPU_API_KEY no Netlify e faça um novo deploy.");
  else {
    if (!process.env.GPU_API_URL.startsWith("https://")) msgs.push("GPU_API_URL precisa ser HTTPS (o navegador bloqueia vídeo http em site https).");
    try {
      const r = await gpu("/health", { signal: AbortSignal.timeout(6000) });
      g = r.ok;
      if (r.status === 401) msgs.push("GPU_API_KEY do Netlify é diferente da usada no worker.");
      else if (!r.ok) msgs.push("Worker GPU respondeu com erro " + r.status + ".");
    } catch { msgs.push("Não consegui falar com o worker GPU: confira se está ligado e se GPU_API_URL está correta."); }
  }
  if (!process.env.ANTHROPIC_API_KEY) msgs.push("ANTHROPIC_API_KEY ausente: o planejamento usa o modo básico (a geração de vídeo não é afetada).");
  else {
    try {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(6000) });
      ai = r.ok;
      if (!r.ok) msgs.push("ANTHROPIC_API_KEY inválida (erro " + r.status + "): copie a chave de console.anthropic.com sem espaços/aspas, salve e faça novo deploy. Enquanto isso o planejamento básico é usado.");
    } catch {}
  }
  return json({ gpu: g, ai, msgs });
};
