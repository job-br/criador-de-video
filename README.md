# ToonStudio – SaaS de vídeos infantis com Wan 2.2

```
Navegador ──> Netlify (site + Functions) ──> Worker GPU (Wan 2.2) ──> MP4
```
O Netlify NÃO roda o Wan 2.2 (precisa de GPU). Ele hospeda o painel e faz a ponte segura.

## 1. Worker GPU (RunPod, Modal, Vast.ai ou máquina própria)
```bash
git clone https://github.com/Wan-Video/Wan2.2 && cd Wan2.2
pip install -r requirements.txt
pip install "huggingface_hub[cli]"
huggingface-cli download Wan-AI/Wan2.2-TI2V-5B --local-dir ./Wan2.2-TI2V-5B
cd .. && cp -r <este-projeto>/worker/server.py . && pip install -r <este-projeto>/worker/requirements.txt
export GPU_API_KEY=chave-secreta PUBLIC_URL=https://seu-worker
uvicorn server:app --host 0.0.0.0 --port 8000
```
Use HTTPS (proxy do próprio provedor). O TI2V-5B roda em GPU de 24GB (ex.: RTX 4090).

## 2. GitHub
```bash
git init && git add . && git commit -m "ToonStudio" 
git remote add origin https://github.com/SEU_USUARIO/toonstudio.git && git push -u origin main
```

## 3. Netlify
Add new site > Import from GitHub > escolha o repo (o netlify.toml já configura tudo).
Em Environment variables: `APP_PASSWORD`, `GPU_API_URL`, `GPU_API_KEY`.
Cada push no GitHub publica automaticamente.
