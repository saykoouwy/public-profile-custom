import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_INIT_USERNAME?.trim();
  const password = process.env.ADMIN_INIT_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_INIT_USERNAME and ADMIN_INIT_PASSWORD must be set.");
  }
  if (password.length < 6) {
    throw new Error("ADMIN_INIT_PASSWORD must have at least 6 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash },
  });

  const existing = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (existing) {
    console.log(`Admin "${username}" already exists — profile left untouched.`);
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
