# Custom Profile

Página de bio pessoal com fundo em vídeo ou imagem, avatar, links sociais, status do Discord e player de música, parecido com o Gunslol, mas posso adicionar mais coisas.

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

## Licença

[PolyForm Noncommercial 1.0.0](LICENSE). Você pode usar, hospedar por conta própria (com o domínio que quiser) e modificar este projeto para **uso pessoal, sem fins comerciais**. Vender, cobrar pelo acesso ou oferecer como serviço pago **não é permitido** sem autorização do autor.
