/**
 * Atribui o privilégio ULTRA (criador do site) a uma conta existente — uma única vez.
 *
 *   npm run user:grant-ultra -- <usuário>
 *
 * O username só serve para encontrar a conta agora: o privilégio fica gravado no registro (id),
 * então trocar o nome de usuário depois não muda nada. Se já existir uma conta ULTRA, o script
 * recusa: o privilégio é exclusivo e não pode ser transferido nem duplicado pelo painel.
 */
import { PrismaClient } from "@prisma/client";
import { normalizeUsername } from "../src/lib/usernames";

const prisma = new PrismaClient();

async function main() {
  const raw = process.argv[2];
  if (!raw) throw new Error("Uso: npm run user:grant-ultra -- <usuário>");
  const username = normalizeUsername(raw);

  const existing = await prisma.user.findFirst({
    where: { role: "ULTRA" },
    select: { id: true, username: true, ultraSlot: true },
  });
  if (existing) {
    const same = existing.username.toLowerCase() === username;
    // Ultra criado antes da trava existir: preenche o ultraSlot (idempotente).
    if (existing.ultraSlot === null) {
      await prisma.user.update({ where: { id: existing.id }, data: { ultraSlot: 1 } });
      console.log(`Trava de unicidade aplicada ao Ultra "${existing.username}".`);
    }
    console.log(
      same
        ? `"${existing.username}" já é Ultra — nada foi alterado.`
        : `Já existe uma conta Ultra ("${existing.username}"). O privilégio é exclusivo — nada foi alterado.`,
    );
    if (!same) process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!user) throw new Error(`Usuário "${username}" não encontrado.`);

  // Ultra nunca fica banido. ultraSlot é @unique: se outra execução simultânea já gravou um Ultra,
  // o banco recusa esta (P2002) em vez de criar dois.
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ULTRA", ultraSlot: 1, bannedAt: null, banExpiresAt: null, banReason: null },
  });
  console.log(`"${user.username}" agora é Ultra (id ${user.id}).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
