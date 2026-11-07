# ToonStudio v3 – SaaS de animações infantis com Wan 2.2

Navegador → Netlify (site + Functions) → Supabase (login/créditos/projetos) · Stripe (pagamento) · Claude API (diretor de IA) · Worker GPU (Wan 2.2)

## Novidades da v3
- **Imagem → vídeo**: a IA (visão) analisa a imagem e lê seu texto (até 8.000 caracteres) em conjunto, planeja partes de 5s coesas e você pode editar tudo antes de gerar.
- **Vídeos longos (até 3 min por vídeo)**: o último quadro de cada parte vira a imagem inicial da próxima; o worker junta tudo em um MP4.
- **Qualidade máxima** (opcional): modelos A14B (custa 2× créditos).
- **Botão de download** em cada vídeo e no vídeo final.
- Limites ampliados: até 40 cenas, 60 s por cena, estilo livre, imagens até 1280 px, jobs persistem se o worker reiniciar.
- `ADMIN_EMAILS`: contas do dono sem cobrança de créditos.

## Atualizando de uma versão anterior
Rode `supabase/migration_v3.sql` no SQL Editor do Supabase, atualize o worker e faça `git push`.

## 1. Supabase
SQL Editor → rode `supabase/schema.sql` (instalação nova). Copie URL, `anon` e `service_role`.

## 2. Stripe
Webhook `https://SEU-SITE/api/stripe-webhook` (evento `checkout.session.completed`). Preços em `netlify/lib/lib.js`.

## 3. Worker GPU
```bash
git clone https://github.com/Wan-Video/Wan2.2 && cd Wan2.2
pip install -r requirements.txt "huggingface_hub[cli]"
huggingface-cli download Wan-AI/Wan2.2-TI2V-5B --local-dir ./Wan2.2-TI2V-5B   # padrão (24GB)
# qualidade máxima (opcional, GPU 80GB):
huggingface-cli download Wan-AI/Wan2.2-I2V-A14B --local-dir ./Wan2.2-I2V-A14B
huggingface-cli download Wan-AI/Wan2.2-T2V-A14B --local-dir ./Wan2.2-T2V-A14B
cd .. && apt-get install -y ffmpeg && pip install -r worker/requirements.txt
export GPU_API_KEY=segredo PUBLIC_URL=https://URL-HTTPS-DO-WORKER
export WAN_CKPT=./Wan2.2/Wan2.2-TI2V-5B
export WAN_A14B_I2V=./Wan2.2/Wan2.2-I2V-A14B WAN_A14B_T2V=./Wan2.2/Wan2.2-T2V-A14B   # opcional
cd worker && uvicorn server:app --host 0.0.0.0 --port 8000
```
Sem os pesos A14B, "Qualidade máxima" usa automaticamente o modelo padrão.

## 4. GitHub + Netlify
`git push` → Netlify (Import from GitHub) → variáveis do `.env.example`.

## Realidade de tempo e qualidade
- Uma GPU 4090 leva ~9 min por parte de 5 s (720p). Um vídeo de 60 s ≈ 12 partes ≈ 1h45. Use mais workers para paralelizar.
- No encadeamento, pequenas diferenças se acumulam (cor, rosto, detalhes). Até ~30–40 s costuma ficar bom; acima disso prefira dividir em cenas (modo História) e juntar.
- O planejamento roda em lotes de 6 cenas para caber no timeout das funções do Netlify.
