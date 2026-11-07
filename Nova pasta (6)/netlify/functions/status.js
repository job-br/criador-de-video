import { gpu, json } from "../lib/lib.js";
export default async (req) => {
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").filter((x) => /^\w{6,32}$/.test(x)).slice(0, 100);
  const out = {};
  await Promise.all(ids.map(async (id) => { try { out[id] = await (await gpu(`/jobs/${id}`)).json(); } catch {} }));
  return json(out);
};
