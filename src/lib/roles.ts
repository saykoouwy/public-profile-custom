/**
 * Privilégios e banimento, compartilhados por servidor, cliente e scripts CLI (sem "server-only").
 *
 * Hierarquia: MEMBER < PREMIUM < ULTRA. Para liberar uma personalização só para Premium (ou acima),
 * use `hasPrivilege(role, "PREMIUM")` no servidor (Server Action/rota) e, opcionalmente, no cliente
 * para esconder/travar o controle. A checagem que vale é sempre a do servidor.
 */

export const ROLES = ["MEMBER", "PREMIUM", "ULTRA"] as const;
export type Role = (typeof ROLES)[number];

/** Privilégios que o painel Admin pode atribuir. ULTRA nunca está aqui. */
export const ASSIGNABLE_ROLES = ["MEMBER", "PREMIUM"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: "Membro",
  PREMIUM: "Premium",
  ULTRA: "Ultra",
};

const RANK: Record<Role, number> = { MEMBER: 0, PREMIUM: 1, ULTRA: 2 };

/** true quando `role` é igual ou superior a `required`. */
export function hasPrivilege(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export type BanFields = { bannedAt: Date | null; banExpiresAt: Date | null };

/** Banimento em vigor: banido e (permanente ou ainda dentro do prazo). */
export function isBanActive(ban: BanFields, now: Date = new Date()): boolean {
  if (!ban.bannedAt) return false;
  return ban.banExpiresAt === null || ban.banExpiresAt > now;
}

/** Filtro Prisma para usuários SEM banimento em vigor (o oposto de isBanActive). */
export function notBannedWhere(now: Date = new Date()) {
  return { OR: [{ bannedAt: null }, { banExpiresAt: { lte: now } }] };
}

/** Durações de banimento oferecidas no painel. null = permanente. */
export const BAN_DURATIONS = {
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  perm: null,
} as const satisfies Record<string, number | null>;
export type BanDuration = keyof typeof BAN_DURATIONS;

export const BAN_DURATION_LABELS: Record<BanDuration, string> = {
  "1h": "1 hora",
  "1d": "1 dia",
  "7d": "7 dias",
  "30d": "30 dias",
  perm: "Permanente",
};

/** Data/hora legível, igual no servidor e no navegador (fuso fixo evita diferença de hidratação). */
export function formatBanDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}
