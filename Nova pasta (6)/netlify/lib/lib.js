export const json = (d, s = 200) => Response.json(d, { status: s });
export const gpu = (path, opts = {}) =>
  fetch(`${process.env.GPU_API_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GPU_API_KEY}` },
  });
