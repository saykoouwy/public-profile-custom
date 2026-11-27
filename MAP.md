# Mapa de Arquitetura e Guia de Customização: Sistema BioLink

Este documento mapeia detalhadamente todos os arquivos, funções, estruturas de dados, elementos visuais e opções de personalização do projeto BioLink Next.js. Seu propósito é servir como índice de navegação rápida para desenvolvedores que desejam modificar, refatorar ou adicionar novos recursos ao sistema.

---

## 1. Topologia Geral do Repositório

A estrutura de arquivos segue o padrão App Router do Next.js 16, organizada por camadas de responsabilidade e contextos de acesso:

```text
.
├── prisma/
│   ├── schema.prisma                  # Definição do banco PostgreSQL e modelos ORM
│   ├── seed.ts                        # Script de inicialização do administrador e perfil padrão
│   └── create-user.ts                 # `npm run user:create`: cria outro usuário com perfil próprio
├── public/                            # Mídias estáticas padrão e assets procedurais
│   └── uploads/                       # Diretório de fallback para uploads locais em desenvolvimento
├── src/
│   ├── actions/                       # Server Actions (Mutações sem rotas REST)
│   │   ├── admin.ts                   # Mutações de perfil, mídias e links sociais
│   │   └── auth.ts                    # Ações de login e logout com rate limiting
│   ├── app/
│   │   ├── (admin)/customize/         # Painel de personalização (/customize, autenticado)
│   │   │   ├── layout.tsx             # Proteção de sessão, barra superior e logout
│   │   │   └── page.tsx               # Seções "Envio de mídias" e "Perfil e redes"
│   │   ├── (auth)/login/              # Rota pública de autenticação
│   │   │   └── page.tsx               # Formulário de login dark glassmorphism
│   │   ├── (public)/                  # Rotas públicas
│   │   │   ├── page.tsx               # Raiz (/): página que explica o app
│   │   │   └── [username]/page.tsx    # Perfil público em /<usuário>, com SSR e cursor inline
│   │   ├── api/                       # Route Handlers para fluxos especializados
│   │   │   ├── upload/route.ts        # Upload seguro em 2 fases (sign/commit com Cloudflare R2)
│   │   │   └── views/route.ts         # Contador atômico de visualizações por perfil (24h, cookie + IP)
│   │   ├── logout/route.ts            # Apaga cookie de sessão órfão e leva ao /login (evita loop)
│   │   ├── globals.css                # Utilitários Tailwind v4, glassmorphism e animações
│   │   └── layout.tsx                 # Root layout com injeção de fontes Google Fonts
│   ├── components/
│   │   ├── icons/SocialIcons.tsx      # Ícones das redes (MASK_ICONS + /public/icons/social, SocialIcon, GitHubIcon, PICKER_PLATFORMS, PLATFORM_LABELS)
│   │   ├── landing/                   # Navbar, menus da conta (AccountMenuItems) e fundo animado
│   │   ├── admin/                     # Componentes do painel administrativo
│   │   │   ├── MediaManager.tsx       # Tiles de mídia, auréola e gerenciador de áudio (pop-up)
│   │   │   └── ProfileEditor.tsx      # Edição de textos, redes sociais e status Lanyard
│   │   └── public/                    # Componentes visuais da página pública
│   │       ├── ActivityWidget.tsx     # Widget de presença Discord/Lanyard e jogos
│   │       ├── AudioPlayer.tsx        # Player flutuante com scrubber e controles
│   │       ├── BackgroundMedia.tsx    # Fundo em vídeo/GIF/imagem e botão de mute global
│   │       ├── BioCard.tsx            # Cartão central com avatar, halo, bio e dock social
│   │       └── EnterScreen.tsx        # Tela "clique para entrar" que libera o som
│   ├── hooks/                         # useDismiss (fechar ao clicar fora/Esc), useCopyToClipboard, useSiteHost
│   ├── lib/                           # Serviços, segurança e utilitários de infraestrutura
│   │   ├── auth.ts                    # JWTs (jose) com tokenVersion, sessão validada no banco e cookies
│   │   ├── brand.ts                   # Nome único da marca (BRAND_NAME)
│   │   ├── db.ts                      # Instância singleton do Prisma Client
│   │   ├── media-rules.ts             # MIME aceitos e limites de upload (compartilhado cliente/servidor)
│   │   ├── password.ts                # hashPassword (bcrypt custo 12), usado também pelos scripts CLI
│   │   ├── rate-limit.ts              # Rate limit (Upstash Redis ou memória) e IP confiável da plataforma
│   │   ├── revalidate.ts              # Invalidação das páginas de perfil e do painel após mutações
│   │   ├── storage.ts                 # Cliente S3 (Cloudflare R2), sniff de MIME types e URLs
│   │   ├── usernames.ts               # Nomes reservados e normalização de username (minúsculas)
│   │   ├── utils.ts                   # Formatação (tempo, números pt-BR), clamp, cursorStyle e tailwind-merge
│   │   └── validators.ts              # Esquemas de validação de dados via Zod
│   ├── proxy.ts                       # Firewall de borda (função proxy()) das rotas /customize
│   └── types/
│       └── index.ts                   # Definições de tipos TypeScript compartilhados
└── tests/                             # Suíte de testes unitários e de integração
    ├── auth.test.ts
    ├── storage-r2.test.ts
    ├── storage.test.ts
    ├── utils.test.ts
    └── validators.test.ts
```

---

## 2. Camada Pública: Interface do Perfil (`/<usuário>`)

A raiz (`/`, em `src/app/(public)/page.tsx`) é uma página estática que explica o app e linka para o primeiro perfil como exemplo. Cada perfil fica em `/<usuário>`; nomes iguais a rotas fixas (`login`, `customize`, `api`) nunca abrem, porque as rotas fixas têm prioridade.

Responsável por renderizar a experiência visual do visitante. Todos os elementos visuais contam com efeitos de desfoque, gradientes escuros e alta fidelidade tipográfica.

### 2.1. Estrutura Base e Injeção de Cursor
* **Arquivo:** `src/app/(public)/[username]/page.tsx`
* **Função Principal:** `ProfilePage({ params })`
* **Responsabilidades:**
  * Busca o perfil pelo usuário da URL (sem diferenciar maiúsculas); usuário inexistente gera 404 (`notFound()`).
  * Renderizado sob demanda a cada requisição (`dynamic = "force-dynamic"`, sem ISR): alterações pelo painel ou direto no banco aparecem na hora. As mutações ainda chamam `revalidateProfilePages` (`src/lib/revalidate.ts`) para limpar o cache do roteador no cliente.
  * Injeta dinamicamente no wrapper `<main>` a URL do cursor customizado (`style={{ cursor: ... }}`).
  * Renderiza em ordem de empilhamento: `BackgroundMedia`, `BioCard`, `AudioPlayer` e `EnterScreen` (os dois últimos só quando há música).
  * O `BioCard` envia `POST /api/views` com o usuário para registrar a visita.

### 2.2. Plano de Fundo e Controle de Áudio Global
* **Arquivo:** `src/components/public/BackgroundMedia.tsx`
* **Função Principal:** `BackgroundMedia({ profile }: { profile: PublicProfile })`
* **Elementos e Customizações:**
  * **Renderização Condicional:**
    * Vídeo: Tag `<video>` com `autoPlay`, `loop`, `muted={isMuted}`, `playsInline` e `object-cover`.
    * Imagem/GIF: Tag `<img>` otimizada com `object-cover` e centralização absoluta.
  * **Camadas de Escurecimento:** `div` absoluta com `bg-black/45` e `backdrop-blur-[2px]`, controlando a legibilidade dos cartões sobrepostos.
  * **Botão de Mute:** Botão flutuante no canto superior esquerdo (`top-4 left-4`) com ícones dinâmicos `Volume2` e `VolumeX`, sincronizado com o elemento de vídeo.

### 2.3. Cartão Principal do Perfil
* **Arquivo:** `src/components/public/BioCard.tsx`
* **Função Principal:** `BioCard({ profile }: { profile: PublicProfile })`
* **Elementos e Customizações:**
  * **Efeito de Vidro (Glassmorphism):** Utiliza a classe utilitária `glass` definida no CSS global.
  * **Avatar e Efeito de Auréola (Halo):**
    * Se `profile.hasHaloEffect === true`, renderiza um SVG circular flutuante com gradientes radiais em tons de dourado (`#f5d061`, `#e6b800`, `#fffae6`) e animação sutil de pulso.
    * Avatar com recorte circular `rounded-full` de 96x96 pixels (`w-24 h-24`).
  * **Tipografia e Textos:**
    * Nome de exibição renderizado com a classe `font-display` (fonte *UnifrakturMaguntia*) e `text-glow`.
    * Bio com suporte a quebras de linha preservadas (`whitespace-pre-line`).
    * Localização acompanhada de ícone `MapPin`.
  * **Widget de Presença:** Integrado diretamente abaixo da localização chamando `<ActivityWidget />`.
  * **Dock de Redes Sociais:**
    * `src/components/icons/SocialIcons.tsx`: `MASK_ICONS` lista as redes com logo em `/public/icons/social/<rede>.svg` (aplicado como máscara CSS); as demais usam um ícone genérico. `PICKER_PLATFORMS` define o que aparece no seletor do painel e `PLATFORM_LABELS` os nomes. A lista aceita pelo servidor é `SOCIAL_PLATFORMS` em `src/types/index.ts`.
    * Efeito visual: Ícones com transição `scale-110` e brilho ao passar o mouse (`hover:text-white`).
  * **Contador de Visualizações:** Localizado no rodapé do cartão, com ícone `Eye` e formatação numérica localizada.

### 2.4. Widget de Presença e Atividade (Discord / Spotify / Fallback)
* **Arquivo:** `src/components/public/ActivityWidget.tsx`
* **Funções e Hooks:**
  * `useLanyard(discordUserId)`: Realiza polling HTTP a cada 30 segundos na API pública `https://api.lanyard.rest/v1/users/{userId}`.
  * `ActivityWidget({ profile }: { profile: PublicProfile })`: Componente de renderização.
* **Elementos e Customizações:**
  * **Indicador de Status do Discord:**
    * Mapeamento de cores via `STATUS_COLOR`: *Online* (`bg-emerald-500`), *Idle* (`bg-amber-400`), *Do Not Disturb* (`bg-rose-500`) e *Offline* (`bg-zinc-500`).
  * **Atividade do Spotify:** Exibe capa do álbum, nome da faixa, artista e uma barra de progresso em tempo real sincronizada via timestamp de início e término (`timestamps.start` e `timestamps.end`).
  * **Atividade de Jogos (Rich Presence):** Exibe o nome do jogo ativo e detalhes da partida (`activity.details` / `activity.state`).
  * **Presença Manual:** Caso o Discord não esteja ativo ou configurado, exibe os valores configurados manualmente no painel (`manualActivityType` e `manualStatusText`).

### 2.5. Player de Música Flutuante
* **Arquivo:** `src/components/public/AudioPlayer.tsx`
* **Função Principal:** `AudioPlayer({ tracks, shuffle })`
* **Elementos e Customizações:**
  * Elemento nativo `<audio>` controlado programaticamente via `useRef`; toca uma playlist de até 5 faixas.
  * Modo aleatório: a ordem é sorteada no navegador a cada visita (Fisher–Yates).
  * A música começa no clique da `EnterScreen` (evento `AUDIO_PLAY_EVENT`), já que navegadores bloqueiam som sem interação.
  * Constante `SKIP_SECONDS = 10`: salto do botão de avançar quando há uma única faixa.
  * **Controles Interativos:**
    * Anterior / Play-Pause / Próxima (`SkipBack`, `Play`/`Pause`, `SkipForward`).
    * Barra deslizante (`input[type="range"]` com classe `.scrubber`) para navegação precisa no tempo da faixa.
  * **Metadados Visuais:** Exibe capa, título, artista e a posição na playlist (ex.: `1/2`).

---

## 3. Painel Administrativo: Gestão e Customização (`/customize` e `/login`)

Camada restrita ao administrador para personalização de todos os aspectos visuais e estruturais do perfil.

### 3.1. Autenticação e Layout Administrativo
* **Login:** `src/app/(auth)/login/page.tsx`
  * Formulário interativo estilizado em Dark Glassmorphism.
  * Gerenciado via `useActionState` integrado à Server Action `loginAction`.
  * Feedback visual de credenciais incorretas e estado de carregamento no botão de envio.
* **Layout e Proteção:** `src/app/(admin)/customize/layout.tsx`
  * Valida a sessão no servidor chamando `requireAuth()`. Se o cookie for inválido, redireciona para `/login`.
  * Barra de navegação com link rápido para visualização pública e botão de encerramento de sessão via `logoutAction`.

### 3.2. Gerenciador de Mídias e Uploads
* **Arquivo:** `src/components/admin/MediaManager.tsx`
* **Função Principal:** `MediaManager({ media, tracks, shuffleTracks, storageEnabled })`
* **Módulos de Customização** (linha "Envio de mídias", até 4 blocos por linha):
  * **Hook Interno `useUploader`:**
    * Orquestra o upload em duas fases: solicita a assinatura para a API interna, realiza o `PUT` binário direto no Cloudflare R2 com monitoramento de progresso (`XMLHttpRequest.upload.onprogress`) e executa o `commit` de validação.
  * **Tiles (`MediaTile`):** clicar no tile envia ou troca o arquivo; o selo mostra a extensão e o `X` remove (`removeMedia`).
    * **Plano de fundo:** vídeo (MP4/WebM) ou imagem/GIF; o tipo é detectado pelos magic bytes no commit.
    * **Avatar do perfil:** imagem + interruptor da auréola dourada (`hasHaloEffect`) ao lado do título.
    * **Cursor personalizado:** PNG/GIF/WebP; passar o mouse no tile testa o cursor.
  * **Áudio (`AudioManagerDialog`):** o tile abre um pop-up (`<dialog>`) com prévia do áudio selecionado, lista de faixas (capa, título, artista, duração), edição pelo lápis (`TrackEditor`), remoção, "Embaralhar áudios" (`shuffleTracks`) e "Adicionar áudio" (cria a faixa e envia o arquivo de uma vez).

### 3.3. Editor de Informações Pessoais, Redes e Presença
* **Arquivo:** `src/components/admin/ProfileEditor.tsx`
* **Função Principal:** `ProfileEditor({ profile, links })`
* **Seções Configuráveis:**
  * **Dados Básicos do Perfil:**
    * Nome de exibição (`displayName`).
    * Biografia (`bio`) com contador regressivo limitador de caracteres (máximo 160).
    * Localização geográfica (`location`).
  * **Configuração de Presença e Discord:**
    * Campo para inserção do Discord User ID numérico.
    * Switch para habilitar exibição do status ao vivo via Lanyard.
    * Configuração de Fallback Manual: Seleção do tipo de atividade ("Ouvindo", "Jogando" ou texto livre) e mensagem personalizada.
  * **Gerenciador de Redes Sociais:**
    * Formulário de inserção: Seleção de plataforma (mapeada em `SOCIAL_PLATFORMS`), rótulo opcional e URL com validação estrita de HTTPS.
    * Lista Reordenável: Botões de mover para cima/baixo que invocam `updateSocialLinksOrder` via transação atômica no banco.
    * Alternador de visibilidade (ícone de olho) que aciona `toggleSocialLink`.
    * Botão de exclusão com confirmação que aciona `deleteSocialLink`.

---

## 4. Backend: Server Actions e Rotas de API

O sistema adota Server Actions para todas as mutações administrativas, reduzindo a superfície de ataque e eliminando a necessidade de dezenas de rotas REST redundantes.

### 4.1. Server Actions Administrativas
* **Arquivo:** `src/actions/admin.ts`
* **Funções Exportadas:**
  * `updateProfile(input)`: Valida os campos via `profileUpdateSchema`, verifica a sessão do administrador e atualiza a tabela `Profile` via Prisma, invalidando o perfil e o painel com `revalidateProfilePages(username)` (`revalidatePath("/(public)/[username]", "page")`, `/<usuário>` e `/customize`; o caminho inclui o route group `(public)`).
  * `addTrack()`, `updateTrack(id, input)`, `removeTrackCover(id)`, `deleteTrack(id)`: Gerenciam a playlist (até 5 faixas, tabela `Track`). Toda escrita filtra também por `profileId` (posse verificada de forma atômica). O arquivo de áudio não é removível sozinho: troca-se o arquivo ou exclui-se a faixa.
  * `removeMedia(kind)`: Remove fisicamente o objeto do bucket Cloudflare R2 ou diretório local e limpa a coluna correspondente do perfil (`avatarUrl`, `backgroundUrl` ou `customCursorUrl`).
  * `updateProfile` só aceita mídias do próprio storage ou assets locais de `/public` (`isOwnMediaUrl`): URLs `https://` de terceiros são recusadas para não rastrear visitantes.
  * `addSocialLink(input)`: Valida e adiciona um novo link social garantindo o teto máximo de 20 links por perfil.
  * `updateSocialLinksOrder(orderedIds: string[])`: Executa uma transação Prisma (`$transaction`) que atualiza em lote a coluna `orderIndex` de cada link.
  * `toggleSocialLink(id: string, isActive: boolean)`: Alterna a visibilidade pública de um link sem removê-lo do banco.
  * `deleteSocialLink(id: string)`: Exclui permanentemente um link social do perfil.

### 4.2. Server Actions de Autenticação
* **Arquivo:** `src/actions/auth.ts`
* **Funções Exportadas:**
  * `loginAction(prevState, formData)`: Aplica rate limiting (`src/lib/rate-limit.ts`: 5 tentativas/minuto por IP confiável da plataforma e 10 a cada 15 min por conta; compartilhado entre instâncias com Upstash Redis, em memória sem ele), valida o formulário via `loginSchema`, busca o usuário sem diferenciar maiúsculas, compara o hash da senha usando `bcrypt.compare` e define o cookie HTTP-only `admin_session` com o `tokenVersion` atual.
  * `logoutAction()`: Incrementa `User.tokenVersion` (revoga a sessão em todos os dispositivos), remove o cookie com `clearSessionCookie()` e redireciona para `/login`.

### 4.3. Route Handlers (APIs Especializadas)
* **Upload em Duas Fases:** `src/app/api/upload/route.ts`
  * Exige `Origin` igual ao do site (ou `Sec-Fetch-Site: same-origin` quando não há `Origin`).
  * `POST` com ação `sign`: Valida tipo de mídia e tamanho contra os limites pré-definidos (`MAX_BYTES`), limitado a 30 assinaturas a cada 10 min por perfil. Gera uma URL pré-assinada de escrita direta no Cloudflare R2 (contornando o limite de 4.5 MB do corpo de funções serverless da Vercel).
  * `POST` com ação `commit`: Executado após o cliente concluir o upload. Lê os primeiros 32 bytes (`SNIFF_BYTES`) diretamente do bucket para validar os *magic bytes* reais do arquivo via `sniffMime()`, grava a URL final no banco e invalida o cache.
  * `PUT` (só em desenvolvimento, sem R2): grava em `public/uploads/` respeitando o limite da categoria da chave e exigindo `Content-Length` igual ao corpo recebido.
* **Contador de Visitas:** `src/app/api/views/route.ts`
  * `POST { username }`: Incrementa o contador `viewsCount` do perfil daquele usuário.
  * Filtra requisições automatizadas através de regex de User-Agent de bots.
  * Verifica e emite o cookie de controle `bl_viewed_<id do perfil>` com duração de 24 horas (um por perfil) para evitar manipulação de métricas por recarregamento manual.
  * Também limita a 1 visita a cada 24h por hash de IP + perfil (quando a plataforma informa um IP confiável): scripts que ignoram cookies não inflam o contador.

---

## 5. Camada de Dados: Prisma ORM e Modelos

* **Arquivo de Esquema:** `prisma/schema.prisma`
* **Arquivo de Conexão Singleton:** `src/lib/db.ts`
* **Arquivo de Carga Inicial (Seed):** `prisma/seed.ts`

### 5.1. Modelos do Banco de Dados

#### Modelo `User`
Tabela responsável pelas credenciais de acesso ao painel administrativo.
* `id`: Chave primária UUID (`String @id @default(uuid())`).
* `username`: Identificador único do administrador (`String @unique`).
* `passwordHash`: Hash bcrypt da senha de acesso (`String`).
* `tokenVersion`: Versão das sessões (`Int @default(0)`). Vai dentro do JWT; incrementar invalida todas as sessões abertas.
* `role`: Privilégio (`MEMBER` padrão, `PREMIUM`, `ULTRA`). Regras em `src/lib/roles.ts` (`hasPrivilege`, `isBanActive`, `notBannedWhere`).
* `ultraSlot`: `Int? @unique`, preenchido com `1` só na conta Ultra: o próprio banco impede uma segunda.
* `bannedAt` / `banExpiresAt` / `banReason`: Banimento. `banExpiresAt = null` com `bannedAt` preenchido = permanente.
* `profile`: Relação um-para-um com o modelo `Profile`.
* A identidade da conta é o `id`: perfil, privilégio e banimento apontam para ele, nunca para o `username`.

#### Modelo `Profile`
Centraliza todas as configurações visuais, URLs de mídias e estados de personalização.
* `displayName`: Nome principal exibido no cartão (padrão: "rubris").
* `bio`: Texto biográfico curto (máximo 160 caracteres).
* `location`: Texto de localização geográfica (ex: "Berlin").
* `avatarUrl`: URL da imagem do avatar.
* `hasHaloEffect`: Booleano que ativa ou desativa o anel dourado animado ao redor do avatar.
* `customCursorUrl`: URL da imagem do cursor customizado.
* `backgroundType`: Enum `BackgroundType` com valores `IMAGE`, `GIF` ou `VIDEO`.
* `backgroundUrl`: URL da mídia de plano de fundo.
* `tracks`: Relação um-para-muitos com o modelo `Track` (playlist do player flutuante, até 5 faixas).
* `shuffleTracks`: Booleano que sorteia a ordem da playlist a cada visita.
* `discordUserId`: ID numérico do usuário no Discord para integração com a Lanyard.
* `showDiscordStatus`: Booleano para alternar entre status do Discord ou status manual.
* `manualStatusText` / `manualActivityType`: Valores de fallback para exibição de status quando o Discord não estiver conectado.
* `viewsCount`: Inteiro cumulativo que registra as visitas únicas da página.
* `socialLinks`: Relação um-para-muitos com o modelo `SocialLink`.

#### Modelo `Track`
Faixas da playlist do player flutuante.
* `title` / `artist`: Metadados exibidos no player.
* `audioUrl`: URL do arquivo de áudio (faixas sem arquivo não aparecem na página pública).
* `coverUrl`: URL da imagem de capa.
* `orderIndex`: Ordem na playlist. Índice `@@index([profileId, orderIndex])`.

#### Modelo `SocialLink`
Armazena a coleção ordenada de links externos do usuário.
* `platform`: Nome da plataforma (ex: "github", "spotify", "x").
* `label`: Texto descritivo ou handle do usuário.
* `url`: Endereço de destino validado estritamente com protocolo HTTPS.
* `iconName`: Identificador do ícone vetorial correspondente.
* `orderIndex`: Inteiro para controle de reordenação manual na interface.
* `isActive`: Booleano para ocultar ou exibir o link publicamente.
* Índices: `@@index([profileId, orderIndex])` para consultas de alta performance ordenadas.

---

## 6. Segurança, Autenticação e Validação

### 6.0. Privilégios e Aba Admin
* `src/lib/roles.ts`: hierarquia `MEMBER < PREMIUM < ULTRA`, banimento e rótulos (compartilhado por servidor, cliente e scripts).
* `src/lib/auth.ts`: `verifySession` devolve `role` e recusa contas banidas; `requireRole("PREMIUM" | "ULTRA")` protege ações.
* `src/actions/users.ts`: ações da aba Admin (criar conta, trocar privilégio, banir/desbanir, excluir). Só Ultra; nunca atribui Ultra; a conta Ultra nunca é alvo.
* `src/components/admin/UsersAdmin.tsx` + `RoleBadge.tsx`: interface da aba Admin (só renderizada para Ultra).
* `prisma/grant-ultra.ts` (`npm run user:grant-ultra -- <usuário>`): dá o Ultra uma única vez.
* Perfis, `/api/views`, `/api/presence`, `/api/cron/presence` e o "Ver um exemplo" da home ignoram contas banidas.

### 6.0.1. Helpers compartilhados
* `src/lib/action-utils.ts` (`runAction`): tratamento de erro comum das Server Actions.
* `src/lib/http.ts` (`isSameOrigin`): checagem de origem das rotas de API.
* `src/lib/media-rules.ts`: `DEFAULT_AVATAR`, `DEFAULT_BACKGROUND`, `LOCAL_MEDIA_ASSETS` (únicos caminhos locais aceitos como mídia, além de `/uploads/`) e `mimeOfFile`.
* `src/lib/validators.ts`: `usernameSchema` (login, cadastro e APIs). `src/lib/utils.ts`: `DISCORD_ID_RE`.

A arquitetura do sistema adota o princípio de defesa em profundidade, combinando proteção de borda, validação rigorosa de esquemas e verificação estrutural de arquivos.

### 6.1. Ciclo de Vida da Sessão e Criptografia
* **Arquivo:** `src/lib/auth.ts`
* **Biblioteca:** `jose` (compatível com Edge Runtime).
* **Funções Chave:**
  * `signSession(userId, tokenVersion)`: Assina um token JWT com chave de 64 caracteres (`JWT_SECRET`) contendo o ID do usuário, a versão da sessão (`ver`) e expiração de 7 dias.
  * `verifyToken(token)`: Valida assinatura, emissor, audiência, expiração e a presença de `ver` (sem consultar o banco; usado no `proxy`).
  * `verifySession()`: Lê o cookie `admin_session`, valida o token e confirma no banco que o usuário existe e que `ver === User.tokenVersion`.
  * `getAuthorizedProfile()` / `getCurrentUserNav()`: Sessão + perfil do usuário logado, memoizados por requisição.
  * `requireAuth()`: Interrompe a execução com erro caso a sessão seja inválida.
  * `revokeSessions(userId)`: Incrementa `tokenVersion` (usado no logout).
  * `setSessionCookie(token)`: Grava o cookie com `httpOnly: true`, `sameSite: "strict"`, `path: "/"` e `secure` em produção (em desenvolvimento não, para funcionar via IP da rede local).

### 6.2. Proteção de Borda (Edge Firewall)
* **Arquivo:** `src/proxy.ts` (convenção adotada pelo Next.js 16 para substituir o antigo `middleware.ts`).
* **Comportamento:**
  * Intercepta qualquer requisição direcionada para `/customize/:path*`.
  * Se o cookie `admin_session` não estiver presente ou for inválido, redireciona a requisição na borda diretamente para `/login`.
  * Não redireciona `/login` -> `/customize` (só a assinatura não basta: causaria loop com cookie órfão). Quem faz isso é a própria página de login, após validar sessão + perfil no banco.
  * Se o painel encontrar um token válido sem usuário/perfil (ou revogado), redireciona para `/logout`, que apaga o cookie e leva ao `/login`.

### 6.3. Validação de Entrada e Esquemas Zod
* **Arquivo:** `src/lib/validators.ts`
* **Esquemas:**
  * `loginSchema`: Exige usuário entre 3 e 30 caracteres e senha com no mínimo 6 caracteres.
  * `profileUpdateSchema`: Valida tipos de dados, limita tamanho de strings e restringe o enum de fundo.
  * `socialLinkSchema`: Valida se a URL começa obrigatoriamente com `https://` (bloqueando injeções maliciosas do tipo `javascript:`) e sanitiza rótulos.
  * `uploadSignSchema` e `uploadCommitSchema`: Garantem que apenas chaves de mídia reconhecidas sejam processadas pelo serviço de storage.

### 6.4. Inspeção de Arquivos e Armazenamento (Storage)
* **Arquivo:** `src/lib/storage.ts`
* **Mecanismos de Segurança:**
  * `sniffMime(buffer)`: Lê os números mágicos (*magic bytes*) no cabeçalho do arquivo para identificar o MIME real, impedindo que scripts executáveis sejam enviados mascarados com extensão de imagem.
  * `MAX_BYTES` (em `src/lib/media-rules.ts`, compartilhado com o painel): limites por categoria — 15 MB para vídeos, 10 MB para áudios e 5 MB para imagens (inclui avatar, capa e cursor; cursores maiores que 128×128 px são recusados no navegador antes do envio).
  * `ALLOWED_BY_KIND`: Lista branca de MIME types aceitos por finalidade de mídia.
  * MP4 exige caixa `ftyp` com tamanho plausível e *brand* conhecida; MP3 sem ID3 exige cabeçalho de frame MPEG válido (versão, camada, bitrate e sample rate).

### 6.5. Cabeçalhos HTTP
* **Arquivo:** `next.config.ts`
  * `Content-Security-Policy`: mídias só do próprio site e do bucket R2; imagens externas apenas dos CDNs do widget de atividade (Discord/Spotify) e do avatar do GitHub na página inicial; `fetch` só para a Lanyard e o upload direto no R2.
  * `Strict-Transport-Security` (somente em produção), além de `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`.
  * Suporte híbrido: Gravação no Cloudflare R2 em produção via `@aws-sdk/client-s3` ou em disco local (`public/uploads`) em ambiente de desenvolvimento sem credenciais configuradas.

---

## 7. Estilos Globais, Tipografia e Utilitários

### 7.1. Configuração de Estilos e Glassmorphism
* **Arquivo:** `src/app/globals.css`
* **Classes Utilitárias Customizadas:**
  * `@utility glass`: Define o efeito de vidro escuro padrão com `bg-zinc-950/60`, borda sutil `border-white/10` e desfoque `backdrop-blur-md`.
  * `@utility glass-soft`: Variação mais suave para botões e inputs internos (`bg-white/5` e `hover:bg-white/10`).
  * `@utility text-glow`: Cria um efeito de brilho suave ao redor de textos e títulos (`drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]`).
  * `.scrubber`: Estilização cross-browser da barra de progresso do player de áudio, personalizando trilha e botão deslizante (*thumb*).

### 7.2. Injeção de Fontes
* **Arquivo:** `src/app/layout.tsx`
* **Fontes Carregadas:**
  * `Geist Sans` e `Geist Mono`: Tipografia padrão da interface do sistema.
  * `UnifrakturMaguntia`: Fonte display gótica importada via `next/font/google`, vinculada à variável CSS `--font-display`, utilizada exclusivamente para conferir o estilo gótico marcante ao nome de exibição no cartão público.

### 7.3. Funções Utilitárias Gerais
* **Arquivo:** `src/lib/utils.ts`
* **Funções:**
  * `formatSeconds(sec)`: Converte números decimais de segundos em strings formatadas de tempo (ex: `03:45`).
  * `clamp(val, min, max)`: Garante que um valor numérico permaneça dentro de um intervalo delimitado.
  * `cn(...inputs)`: Utilitário para mesclagem condicional de classes CSS utilizando `clsx` e `tailwind-merge`.

---

## 8. Matriz de Consulta Rápida ("Onde Alterar o Quê")

Utilize esta matriz para localizar instantaneamente o arquivo e elemento correspondente à sua necessidade de customização:

| Objetivo da Modificação | Arquivo Alvo | Elemento, Função ou Constante |
| :--- | :--- | :--- |
| Mudar cores, bordas ou desfoque do cartão central | `src/app/globals.css` | Definição da classe `@utility glass` |
| Trocar a fonte do nome de perfil | `src/app/layout.tsx` e `src/components/public/BioCard.tsx` | Constante da fonte `UnifrakturMaguntia` e classe `font-display` |
| Customizar ou desativar as cores da auréola dourada | `src/components/public/BioCard.tsx` | Bloco SVG do elemento `hasHaloEffect` |
| Incluir ou alterar ícones de redes sociais | `src/components/icons/SocialIcons.tsx` e `public/icons/social/` | `MASK_ICONS`, `PICKER_PLATFORMS`, `PLATFORM_LABELS` |
| Adicionar suporte a uma nova plataforma social | `src/types/index.ts` e `src/components/admin/ProfileEditor.tsx` | Constante `SOCIAL_PLATFORMS` |
| Ajustar a frequência de atualização do status do Discord | `src/components/public/ActivityWidget.tsx` | Parâmetro de intervalo no hook `useLanyard` (padrão: 30000ms) |
| Mudar o tempo de salto do botão de avançar música | `src/components/public/AudioPlayer.tsx` | Constante `SKIP_SECONDS` (padrão: 10) |
| Ajustar a opacidade ou o desfoque sobre o vídeo de fundo | `src/components/public/BackgroundMedia.tsx` | Classes Tailwind `bg-black/45` e `backdrop-blur-[2px]` |
| Alterar o limite máximo de caracteres da biografia | `src/components/admin/ProfileEditor.tsx` e `src/lib/validators.ts` | Validador Zod `.max(160)` e contador de caracteres no input |
| Modificar o limite de upload de arquivos (ex: permitir vídeos maiores) | `src/lib/media-rules.ts` | Objeto `MAX_BYTES` (chaves `video`, `image`, `audio`) |
| Alterar os formatos de arquivo aceitos nos uploads | `src/lib/media-rules.ts` | Lista `ALLOWED_BY_KIND` (o `accept` dos inputs é gerado por `acceptFor`) |
| Alterar o tempo de expiração da sessão do administrador | `src/lib/auth.ts` | Constante `SESSION_MAX_AGE` |
| Ajustar o rate limit de tentativas de login | `src/actions/auth.ts` | Constantes `IP_LIMIT` e `ACCOUNT_LIMIT` |
| Trocar o nome da marca exibido no site | `src/lib/brand.ts` | Constante `BRAND_NAME` |
| Reservar um novo caminho para não virar username | `src/lib/usernames.ts` | Conjunto `RESERVED_USERNAMES` |
| Adicionar novos campos ao perfil no banco de dados | `prisma/schema.prisma` | Modelo `Profile` (requer `npx prisma db push` e `generate`) |
| Modificar regras de redirecionamento ou rotas protegidas | `src/proxy.ts` | Função `proxy()` e matcher de rotas |
