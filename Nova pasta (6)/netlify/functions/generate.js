import { gpu, json } from "../lib/lib.js";
const clamp = (v, a, b, d) => Math.min(Math.max(Number(v) || d, a), b);
export default async (req) => {
  const b = await req.json();
  // item = { segments:[prompts de 5s] }  ou  { prompt, seconds } (dividido automaticamente em partes de 5s)
  const items = (b.items || []).slice(0, 40).map((it) => {
    if (Array.isArray(it.segments)) {
      const segs = it.segments.map((s) => String(s).trim().slice(0, 3000)).filter(Boolean).slice(0, 36);
      return segs.length ? { segments: segs, n: segs.length, prompt: segs[0] } : null;
    }
    const prompt = String(it.prompt || "").trim().slice(0, 8000);
    return prompt ? { prompt, n: clamp(Math.ceil((Number(it.seconds) || 5) / 5), 1, 36, 1) } : null;
  }).filter(Boolean);
  if (!items.length) return json({ error: "Adicione ao menos uma cena" }, 400);

  const style = String(b.style || "").slice(0, 600);
  const character = String(b.character || "").slice(0, 1500);
  const size = b.size === "vertical" ? "704*1280" : "1280*704";
  const quality = b.quality === "std" ? "std" : "max";
  const image = typeof b.image === "string" && b.image.length < 7_000_000 ? b.image : null;

  let imageId = null;
  if (image) {
    try { imageId = (await (await gpu("/assets", { method: "POST", body: JSON.stringify({ image }) })).json()).id; } catch {}
    if (!imageId) return json({ error: "Servidor GPU indisponível" }, 502);
  }
  const jobs = [];
  for (const it of items) {
    const out = { prompt: it.prompt.slice(0, 500), seconds: it.n * 5, total: it.n };
    try {
      const body = { seconds: it.n * 5, size, style, quality, image_id: imageId };
      if (it.segments) body.segments = it.segments.map((s) => [character, s].filter(Boolean).join(". "));
      else body.prompt = [character, it.prompt].filter(Boolean).join(". ");
      const r = await gpu("/jobs", { method: "POST", body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Servidor GPU indisponível");
      out.wid = d.id;
    } catch (e) { out.error = e.message; }
    jobs.push(out);
  }
  return json({ jobs });
};
