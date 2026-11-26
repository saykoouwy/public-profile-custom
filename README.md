# Custom Profile

Página de bio pessoal com fundo em vídeo ou imagem, avatar, links sociais, status do Discord e player de música, mais um painel em `/admin` para editar tudo.

Feito com Next.js, Tailwind CSS, Prisma (PostgreSQL) e Cloudflare R2 para os arquivos enviados.

## Rodando localmente

```bash
npm install
cp .env.example .env    # preencha as variáveis
npx prisma db push      # cria as tabelas
npx prisma db seed      # cria o usuário admin
npm run dev             # http://localhost:3000  ·  painel em /admin
```

Sem as variáveis `R2_*`, os uploads em desenvolvimento ficam salvos em `public/uploads/`.

## Scripts

| Comando             | O que faz                   |
| ------------------- | --------------------------- |
| `npm run dev`       | Servidor de desenvolvimento |
| `npm run build`     | Build de produção           |
| `npm test`          | Testes                      |
| `npm run typecheck` | Checagem de tipos           |
| `npm run lint`      | Lint                        |
