# ToonStudio v4 – grátis, sem login, uso ilimitado

Navegador → Netlify (site + Functions) → Worker GPU (Wan 2.2)
Sem cadastro, sem créditos, sem banco de dados. O histórico fica salvo no navegador de cada pessoa.

## Variáveis no Netlify
`GPU_API_URL`, `GPU_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (veja `.env.example`).
Depois de salvar: Deploys → Trigger deploy. Supabase e Stripe não são mais necessários.

## Worker GPU
```bash
git clone https://github.com/Wan-Video/Wan2.2 && cd Wan2.2
pip install -r requirements.txt "huggingface_hub[cli]"
huggingface-cli download Wan-AI/Wan2.2-TI2V-5B --local-dir ./Wan2.2-TI2V-5B
# máxima qualidade (GPU 80GB):
huggingface-cli download Wan-AI/Wan2.2-I2V-A14B --local-dir ./Wan2.2-I2V-A14B
huggingface-cli download Wan-AI/Wan2.2-T2V-A14B --local-dir ./Wan2.2-T2V-A14B
cd .. && apt-get install -y ffmpeg && pip install -r worker/requirements.txt
export GPU_API_KEY=segredo PUBLIC_URL=https://URL-HTTPS-DO-WORKER
export WAN_CKPT=./Wan2.2/Wan2.2-TI2V-5B
export WAN_A14B_I2V=./Wan2.2/Wan2.2-I2V-A14B WAN_A14B_T2V=./Wan2.2/Wan2.2-T2V-A14B
cd worker && uvicorn server:app --host 0.0.0.0 --port 8000
```
Sem os pesos A14B, "Máxima" usa o TI2V-5B automaticamente.

## Atenção: quem paga a GPU é você
- Cada vídeo de 5 s consome ~9 min de uma RTX 4090. Com uso aberto, a fila cresce rápido.
- `MAX_QUEUE` (padrão 200) no worker impede estouro; ajuste conforme sua GPU.
- O diretor de IA usa a API do Claude, cobrada na sua conta Anthropic.
- Se o link se espalhar, considere limitar por IP no Cloudflare/Netlify ou voltar a usar créditos.

## Diagnóstico rápido
No topo do painel há um indicador **GPU online/offline** e **IA**. Se algo estiver errado, o motivo aparece escrito logo abaixo.
- `invalid x-api-key` → a `ANTHROPIC_API_KEY` do Netlify está errada/ausente. Cole a chave (sem aspas/espaços), salve e faça **Trigger deploy** (variáveis só valem após novo deploy). Mesmo com esse erro o programa usa um planejamento básico e o vídeo é gerado.
- `GPU offline` → worker desligado, `GPU_API_URL` errada ou sem HTTPS, ou `GPU_API_KEY` diferente da do worker.
- Arquivos no worker são apagados após `RETENTION_DAYS` (padrão 7) para não encher o disco: baixe seus vídeos antes.
