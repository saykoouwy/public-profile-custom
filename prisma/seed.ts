import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { isReservedUsername, normalizeUsername } from "../src/lib/usernames";
import { loginSchema } from "../src/lib/validators";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.ADMIN_INIT_USERNAME || !process.env.ADMIN_INIT_PASSWORD) {
    throw new Error("ADMIN_INIT_USERNAME and ADMIN_INIT_PASSWORD must be set.");
  }
  // Mesmas regras do login e do user:create: formato, tamanho e senha mínima.
  const parsed = loginSchema.safeParse({
    username: process.env.ADMIN_INIT_USERNAME,
    password: process.env.ADMIN_INIT_PASSWORD,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `ADMIN_INIT_${i.path.join(".").toUpperCase()}: ${i.message}`);
    throw new Error(issues.join("\n"));
  }
  const username = normalizeUsername(parsed.data.username);
  if (isReservedUsername(username)) {
    throw new Error(`"${username}" é uma rota reservada: a página /${username} ficaria inacessível.`);
  }

  // Busca sem diferenciar maiúsculas: rodar o seed com "Admin" não cria um segundo "admin".
  const user =
    (await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } })) ??
    (await prisma.user.create({ data: { username, passwordHash: await hashPassword(parsed.data.password) } }));

  // O primeiro admin de um banco novo vira o criador do site (Ultra), se ainda não houver um.
  if (!(await prisma.user.findFirst({ where: { role: "ULTRA" }, select: { id: true } }))) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ULTRA", ultraSlot: 1 } });
  }

  const existing = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (existing) {
    console.log(`Admin "${user.username}" already exists — profile left untouched.`);
    return;
  }

  await prisma.profile.create({
    data: {
      userId: user.id,
      avatarUrl: "/default-avatar.webp",
      backgroundType: "VIDEO",
      backgroundUrl: "/default-bg.mp4",
      manualActivityType: "LISTENING",
      manualStatusText: "DMMCR — rxbris",
      tracks: {
        create: [{ title: "DMMCR", artist: "rxbris", orderIndex: 0 }],
      },
      socialLinks: {
        create: [
          { platform: "x", label: "X", url: "https://x.com", iconName: "x", orderIndex: 0 },
          { platform: "steam", label: "Steam", url: "https://steamcommunity.com", iconName: "steam", orderIndex: 1 },
          { platform: "spotify", label: "Spotify", url: "https://open.spotify.com", iconName: "spotify", orderIndex: 2 },
          { platform: "lastfm", label: "Last.fm", url: "https://www.last.fm", iconName: "lastfm", orderIndex: 3 },
        ],
      },
    },
  });

  console.log(`Admin "${username}" and default profile created.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
