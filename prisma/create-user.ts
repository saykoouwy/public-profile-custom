/**
 * Cria um usuário com perfil próprio (página em /<usuário>, painel em /customize).
 *
 *   $env:NEW_USER_PASSWORD="..."; npm run user:create -- <usuário>
 *
 * A senha vem de variável de ambiente para não ficar no histórico do shell nem no repositório.
 * Cada usuário só edita o próprio perfil: as Server Actions e a rota de upload resolvem o perfil
 * pelo userId da sessão, nunca por um id vindo do cliente.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { loginSchema } from "../src/lib/validators";

// Rotas do app que um /<usuário> sombrearia.
const RESERVED = new Set(["customize", "login", "api", "admin", "_next", "favicon.ico"]);

const prisma = new PrismaClient();

async function main() {
  const parsed = loginSchema.safeParse({
    username: process.argv[2],
    password: process.env.NEW_USER_PASSWORD,
  });
  if (!parsed.success) {
    throw new Error(
      "Uso: $env:NEW_USER_PASSWORD=\"...\"; npm run user:create -- <usuário>\n" +
        parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  const { username, password } = parsed.data;
  if (RESERVED.has(username.toLowerCase())) throw new Error(`"${username}" é uma rota reservada.`);

  const taken = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) throw new Error(`Usuário "${username}" já existe — nada foi alterado.`);

  await prisma.user.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      // Valores explícitos: os defaults do schema são os do perfil original.
      profile: { create: { displayName: username, bio: null, location: null } },
    },
  });

  console.log(`Usuário "${username}" criado. Perfil em /${username}, painel em /customize.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
