# BioLink & Music Card

Página de bio pessoal (estilo guns.lol) com fundo em vídeo, cartão em glassmorphism, presença do Discord via Lanyard, player de música e painel administrativo. Implementação de `SPEC.md` / `PLAN.md`.

**Stack:** Next.js 16 (App Router) · Tailwind CSS 4 · Framer Motion · Prisma 6 + PostgreSQL · Zod 4 · JWT (jose) + bcryptjs · Cloudflare R2.

## Rodando localmente

```bash
npm install
cp .env.example .env          # preencha JWT_SECRET e ADMIN_INIT_PASSWORD
npx prisma dev --detach       # Postgres local (copie a URL TCP para DATABASE_URL, com &connection_limit=1&pgbouncer=true)
npx prisma db push
npx prisma db seed            # cria o admin e o perfil padrão
npm run dev                   # http://localhost:3000  ·  painel em /admin
```

Sem as variáveis `R2_*`, em desenvolvimento os uploads vão para `public/uploads/` (driver local). Em produção, sem R2 os uploads ficam desabilitados.

| Script | O que faz |
| --- | --- |
| `npm test` | Testes de sessão JWT, bcrypt, validadores Zod, magic bytes e presign do R2 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Build de produção |

### Problema comum: "Can't reach database server at localhost:51218"

O banco local do `prisma dev` aceita **uma conexão por vez**. Se um servidor que estava conectado for encerrado de forma abrupta, ou se dois servidores (`npm run dev` + outro) tentarem usar o banco ao mesmo tempo, ele pode travar. Para resolver:

1. Pare os servidores do site (Ctrl+C).
2. Rode `npm run db:restart` (ou `npm run db:start`, se o banco estiver parado, por exemplo depois de reiniciar o PC).
3. Rode `npm run dev` de novo, com **um** servidor por vez.

Os dados ficam salvos em disco; reiniciar o banco não apaga nada.

## Segurança (defesa em 5 camadas)

1. **Proxy** (`src/proxy.ts`): `/admin` sem JWT válido → redirect para `/login` antes de renderizar.
2. **Layout guard** (`src/app/(admin)/admin/layout.tsx`): valida token **e** existência do usuário no banco.
3. **Server Actions** (`src/actions/admin.ts`): toda mutação chama `requireAuth()` e só altera o perfil do próprio usuário.
4. **Zod** (`src/lib/validators.ts`): remove HTML, aceita apenas `https://`, rejeita campos extras (`.strict()`).
5. **Upload** (`src/app/api/upload/route.ts`): tipo e tamanho assinados na URL pré-assinada, chave UUID, e validação de magic bytes após o envio (arquivo inválido é apagado).

Extras: cookie `HttpOnly; Secure; SameSite=Strict` (7 dias), rate limit de 5 logins/min por IP, comparação bcrypt com tempo constante para usuários inexistentes, checagem de `Origin` nas rotas, headers `X-Frame-Options: DENY`/`nosniff`, e contador de views com cookie de 24h e filtro de bots.

## Deploy (Vercel + Neon + Cloudflare R2)

1. **Neon:** crie o banco. Use a URL *pooled* em `DATABASE_URL`. Aplique o schema uma vez com a URL *direta*:
   `DATABASE_URL="<url-direta>" npx prisma db push && DATABASE_URL="<url-direta>" npx prisma db seed`
2. **R2:** crie o bucket, habilite acesso público (domínio próprio ou `r2.dev`) e um token de API com escrita no bucket. Configure o CORS do bucket para permitir o upload direto do navegador:
   ```json
   [{ "AllowedOrigins": ["https://SEU-DOMINIO"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
3. **Vercel:** importe o repositório e defina `DATABASE_URL`, `JWT_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_DOMAIN` e (opcional) `SITE_URL`. `ADMIN_INIT_*` só são usados pelo seed.

## Diferenças em relação à SPEC

- **`src/proxy.ts`** em vez de `src/middleware.ts`: o Next 16 renomeou a convenção (mesma função).
- **Upload em duas fases** (sign → PUT direto no R2 → commit): funções da Vercel limitam o corpo a 4,5 MB, então vídeos de 15 MB não podem passar pela rota. A validação de magic bytes acontece no *commit*, lendo os primeiros bytes do objeto no R2.
- **Contador de views via `POST /api/views`** chamado pelo cliente: a página `/` é estática com revalidação sob demanda (carrega instantaneamente), e Server Components não podem gravar cookies.
- **`cacheComponents` desativado:** o modelo clássico de renderização + `revalidatePath` é o que a SPEC descreve.
- **Seed com `tsx`** em vez de `ts-node`; **Prisma 6** (o schema da SPEC usa `url = env(...)`, removido no Prisma 7).
- Ícones de marcas são SVGs próprios (o lucide-react 1.x removeu ícones de marcas). As mídias padrão em `public/` foram geradas proceduralmente.
- O botão "próximo" do player avança 10 s (há uma única faixa por perfil).

## Limitações conhecidas

- O rate limit de login é em memória, por instância serverless (como na SPEC). Para um limite global, use Upstash/Redis.
- A sessão é um JWT sem estado: o logout apaga o cookie, mas um token copiado continua válido até expirar (7 dias). Trocar `JWT_SECRET` invalida todas as sessões.
- O status do Discord exige que o usuário esteja no servidor da Lanyard.
