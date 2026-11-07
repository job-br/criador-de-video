import { gpu, json } from "../lib/lib.js";
export default async (req) => {
  const { ids = [] } = await req.json();
  const r = await gpu("/merge", { method: "POST", body: JSON.stringify({ ids: ids.filter((x) => /^\w{6,32}$/.test(x)).slice(0, 100) }) });
  if (!r.ok) return json({ error: "Falha ao juntar cenas" }, 502);
  return json(await r.json());
};
