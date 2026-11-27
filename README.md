# Custom Profile

Página de bio pessoal com fundo em vídeo ou imagem, avatar, links sociais, status do Discord e player de música, parecido com o Gunslol, mas posso adicionar mais coisas.

Feito com Next.js, Tailwind CSS, Prisma (PostgreSQL) e Cloudflare R2 para os arquivos enviados.

## Rodando localmente

```bash
npm install
cp .env.example .env    # preencha as variáveis
npx prisma db push      # cria/atualiza as tabelas (rode de novo após mudanças no schema)
npx prisma db seed      # cria o usuário admin
npm run dev             # http://localhost:3000
```

Depois disso:

- `/` explica o que é o app
- `/login` entra no painel
- `/customize` é onde você personaliza o perfil
- `/<seu-usuário>` é o seu perfil público

Sem as variáveis `R2_*`, os uploads em desenvolvimento ficam salvos em `public/uploads/`.

Usernames são gravados em minúsculas e o login não diferencia maiúsculas. Nomes que colidem com rotas ou arquivos do site (`login`, `customize`, `api`, `uploads`, `logo.png`…) são recusados pelo seed e pelo `npm run user:create`.

## Privilégios

| Privilégio | Quem | O que pode |
| --- | --- | --- |
| **Ultra** | Só o criador do site (uma única conta) | Tudo + aba **Admin** no painel: cadastrar contas, mudar privilégios, banir (temporário/permanente) e excluir |
| **Premium** | Escolhido pelo Ultra na aba Admin | Personalização padrão + recursos extras (use `hasPrivilege(role, "PREMIUM")` em `src/lib/roles.ts`) |
| **Membro** | Toda conta nova | Personalização padrão |

O Ultra é dado uma única vez pelo terminal e fica preso ao id da conta (não ao nome de usuário):

```bash
npm run user:grant-ultra -- rubris
```

O painel nunca consegue atribuir Ultra, e a conta Ultra não pode ser rebaixada, banida nem excluída por ele.

## Produção

- **Rate limit compartilhado:** em hospedagem serverless (Vercel) cada instância tem a própria memória. Defina `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (Upstash Redis / Vercel KV) para o limite de tentativas de login, de uploads e de visualizações valer entre todas as instâncias.
- **IP do visitante:** na Vercel e atrás da Cloudflare o IP vem de headers da própria plataforma. Atrás de um proxy reverso seu (Nginx, Caddy…) que sobrescreve `X-Forwarded-For`, defina `TRUST_PROXY=1`.
- **Uploads abandonados no R2:** os envios são limitados (30 a cada 10 min por perfil) e arquivos rejeitados no `commit` são apagados na hora. Não use uma regra de *Object lifecycle* por idade no bucket inteiro: as mídias válidas ficam nos mesmos prefixos (`avatar/`, `background/`…) e também seriam apagadas.
- **Sessões:** sair da conta encerra a sessão em todos os dispositivos.

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
