"""Worker GPU Wan 2.2: texto->vídeo, imagem->vídeo, vídeos longos encadeados (último quadro -> próxima parte).
Requisitos: Wan2.2 clonado + pesos, ffmpeg. Padrão: TI2V-5B (24GB). Qualidade máxima opcional: A14B (80GB)."""
import os, time, uuid, json, math, base64, shutil, subprocess, threading
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

KEY = os.environ["GPU_API_KEY"]
WAN_DIR = os.environ.get("WAN_DIR", "./Wan2.2")
CKPT_5B = os.path.abspath(os.environ.get("WAN_CKPT", "./Wan2.2/Wan2.2-TI2V-5B"))
A14_T2V = os.environ.get("WAN_A14B_T2V")   # ex: ./Wan2.2/Wan2.2-T2V-A14B   (opcional)
A14_I2V = os.environ.get("WAN_A14B_I2V")   # ex: ./Wan2.2/Wan2.2-I2V-A14B   (opcional)
PUBLIC = os.environ["PUBLIC_URL"].rstrip("/")
SEG = 5  # segundos por parte
MAX_QUEUE = int(os.environ.get("MAX_QUEUE", "200"))  # só evita estouro de memória/disco
for d in ("outputs", "tmp", "assets"): os.makedirs(d, exist_ok=True)
if not PUBLIC.startswith("https://"): print("AVISO: PUBLIC_URL deve ser HTTPS, senão o navegador bloqueia os vídeos.")
RETENTION = float(os.environ.get("RETENTION_DAYS", "7")) * 86400  # apaga arquivos antigos (disco não enche)
def cleanup():
    while True:
        now = time.time()
        for d in ("outputs", "tmp", "assets"):
            for f in os.listdir(d):
                fp = os.path.join(d, f)
                try:
                    if f != "jobs.json" and os.path.isfile(fp) and now - os.path.getmtime(fp) > RETENTION: os.remove(fp)
                except Exception: pass
        time.sleep(3600)
threading.Thread(target=cleanup, daemon=True).start()

STYLES = {
  "3d": "colorful 3D animated kids cartoon, soft lighting, cute rounded characters, vibrant colors, high quality",
  "2d": "2D hand-drawn children's animation, bright flat colors, friendly characters, smooth motion",
  "massinha": "claymation stop-motion style, soft clay textures, cheerful, children's show",
  "aquarela": "watercolor storybook animation, gentle pastel palette, whimsical, for children",
}
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])  # permite baixar pelo navegador
jobs, lock = {}, threading.Lock()

def persist():
    try: json.dump(jobs, open("tmp/jobs.json", "w"))
    except Exception: pass
if os.path.exists("tmp/jobs.json"):
    jobs.update(json.load(open("tmp/jobs.json")))
    for j in jobs.values():
        if j["status"] in ("queued", "running"): j.update(status="error", error="worker reiniciou")

def auth(a):
    if a != f"Bearer {KEY}": raise HTTPException(401)

def ff(*args):
    subprocess.run(["ffmpeg", "-y", *args], check=True, capture_output=True)

def gen_part(jid, i, prompt, size, hi, image):
    out = os.path.abspath(f"outputs/{jid}_{i}.mp4")
    if hi:
        task, ckpt, fps = ("i2v-A14B", A14_I2V, 16) if image else ("t2v-A14B", A14_T2V, 16)
        w, h = size.split("*"); size = "1280*720" if int(w) > int(h) else "720*1280"
    else:
        task, ckpt, fps = "ti2v-5B", CKPT_5B, 24
    cmd = ["python", "generate.py", "--task", task, "--size", size, "--ckpt_dir", os.path.abspath(ckpt),
           "--offload_model", "True", "--convert_model_dtype", "--frame_num", str(4 * round(SEG * fps / 4) + 1),
           "--prompt", prompt, "--save_file", out]
    if task == "ti2v-5B": cmd += ["--t5_cpu"]
    if image: cmd += ["--image", image]
    subprocess.run(cmd, cwd=WAN_DIR, check=True)
    return out

def concat(paths, out):
    lst = os.path.abspath(f"tmp/{uuid.uuid4().hex}.txt")
    open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in paths))
    try: ff("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", out)
    except Exception: ff("-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", out)
    os.remove(lst)

def run(jid, p):
    with lock:
        job = jobs[jid]; job["status"] = "running"; persist()
        try:
            n = len(p["segments"]) if p.get("segments") else max(1, math.ceil(p["seconds"] / SEG))
            segs = p.get("segments") or [p["prompt"] if i == 0 else p["prompt"] + ", continuing the same shot seamlessly, the action naturally progressing" for i in range(n)]
            style = STYLES.get(p.get("style"), p.get("style") or "")
            image = None
            if p.get("image_id") and str(p["image_id"]).isalnum():
                image = os.path.abspath(f"assets/{p['image_id']}.jpg")
            hi = p.get("quality", "max") == "max" and bool(A14_I2V) and (bool(image) or bool(A14_T2V))
            parts = []
            for i, txt in enumerate(segs):
                job["progress"] = i; persist()
                out = gen_part(jid, i, ", ".join(x for x in (txt, style) if x), p["size"], hi, image)
                parts.append(out)
                if i < n - 1:  # último quadro vira a imagem inicial da próxima parte
                    image = os.path.abspath(f"tmp/{jid}_{i}.jpg")
                    ff("-sseof", "-0.3", "-i", out, "-frames:v", "1", "-update", "1", "-q:v", "1", image)
            final = os.path.abspath(f"outputs/{jid}.mp4")
            if len(parts) == 1: shutil.move(parts[0], final)
            else:
                concat(parts, final)
                for x in parts: os.remove(x)
            job.update(status="done", progress=n, url=f"{PUBLIC}/videos/{jid}.mp4")
        except Exception as e:
            job.update(status="error", error=f"Falha na geração ({type(e).__name__})")
        persist()

@app.get("/health")
def health(authorization: str = Header("")):
    auth(authorization)
    return {"ok": True, "queue": sum(1 for j in jobs.values() if j["status"] in ("queued", "running"))}

@app.post("/assets")
def asset(p: dict, authorization: str = Header("")):
    auth(authorization)
    aid = uuid.uuid4().hex[:16]
    with open(f"assets/{aid}.jpg", "wb") as f: f.write(base64.b64decode(p["image"].split(",")[-1]))
    return {"id": aid}

@app.post("/jobs")
def create(p: dict, authorization: str = Header("")):
    auth(authorization)
    if sum(1 for j in jobs.values() if j["status"] in ("queued", "running")) >= MAX_QUEUE:
        raise HTTPException(429, "Fila cheia, tente novamente em alguns minutos")
    jid = uuid.uuid4().hex[:16]
    jobs[jid] = {"id": jid, "status": "queued", "progress": 0}
    threading.Thread(target=run, args=(jid, p), daemon=True).start()
    return jobs[jid]

@app.get("/jobs/{jid}")
def get(jid: str, authorization: str = Header("")):
    auth(authorization)
    return jobs.get(jid) or {"status": "error", "error": "job não encontrado"}

@app.post("/merge")
def merge(p: dict, authorization: str = Header("")):
    auth(authorization)
    ids = [i for i in p.get("ids", []) if str(i).isalnum()]
    if not ids: raise HTTPException(400)
    mid = uuid.uuid4().hex[:16]
    concat([f"outputs/{i}.mp4" for i in ids], os.path.abspath(f"outputs/{mid}.mp4"))
    return {"url": f"{PUBLIC}/videos/{mid}.mp4"}

app.mount("/videos", StaticFiles(directory="outputs"), name="videos")
# uvicorn server:app --host 0.0.0.0 --port 8000
