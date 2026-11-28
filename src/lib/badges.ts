/**
 * Badges exibidos ao lado do nome no card público. Só a conta Ultra atribui (aba Admin, inclusive
 * para si mesma); o dono do perfil não consegue se dar badges (não estão no schema do updateProfile).
 * Os ids são gravados no banco (Profile.badges, em ordem): renomear um id apaga o badge de quem o tinha.
 * Nomes e descrições podem ser mudados à vontade aqui. Ícones em components/badges/BadgeIcon.tsx.
 */
export const BADGE_IDS = [
  "founder",
  "bug_hunter",
  "tester",
  "verified",
  "featured",
  "champion",
  "supporter",
  "moderator",
  "pioneer",
  "gifted",
  "newcomer",
  "booster",
  "beloved",
  "developer",
  "exclusive",
  "musician",
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

/** Até quantos badges ficam na linha do nome; passando disso, todos vão juntos para a linha de baixo. */
export const BADGES_INLINE = 3;

export const BADGE_INFO: Record<BadgeId, { label: string; description: string }> = {
  founder: { label: "Fundador", description: "Criador do mypfp.me." },
  bug_hunter: { label: "Caçador de bugs", description: "Encontrou e reportou bugs no site." },
  tester: { label: "Testador", description: "Testou recursos antes do lançamento." },
  verified: { label: "Verificado", description: "Identidade confirmada pela equipe." },
  featured: { label: "Destaque", description: "Perfil em destaque na comunidade." },
  champion: { label: "Campeão", description: "Venceu um evento ou desafio." },
  supporter: { label: "Apoiador", description: "Apoia o projeto." },
  moderator: { label: "Moderador", description: "Ajuda a manter a comunidade segura." },
  pioneer: { label: "Pioneiro", description: "Um dos primeiros usuários do site." },
  gifted: { label: "Presenteado", description: "Ganhou em um sorteio ou evento." },
  newcomer: { label: "Novato", description: "Chegou há pouco por aqui." },
  booster: { label: "Impulsionador", description: "Deu um gás no projeto." },
  beloved: { label: "Querido", description: "Querido pela comunidade." },
  developer: { label: "Desenvolvedor", description: "Contribuiu com o código do site." },
  exclusive: { label: "Exclusivo", description: "Badge de acesso restrito." },
  musician: { label: "Músico", description: "Artista ou produtor musical." },
};

export function isBadgeId(v: unknown): v is BadgeId {
  return typeof v === "string" && (BADGE_IDS as readonly string[]).includes(v);
}

/** Limpa o que veio do banco: só ids conhecidos, sem repetição, na ordem gravada. */
export function sanitizeBadges(values: readonly string[]): BadgeId[] {
  return [...new Set(values)].filter(isBadgeId);
}
