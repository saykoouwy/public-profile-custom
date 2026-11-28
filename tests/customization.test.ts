import { test } from "node:test";
import assert from "node:assert/strict";
import { badgesSchema, profileUpdateSchema } from "@/lib/validators";
import { sanitizeBadges } from "@/lib/badges";
import { nextNameChangeAt } from "@/lib/display-name";

// Regras da personalização do card: troca do nome de exibição, badges e campos novos do perfil.

const DAY = 24 * 60 * 60 * 1000;

test("Membro espera 14 dias entre trocas do nome de exibição; Premium e Ultra não esperam", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const fiveDaysAgo = new Date(now.getTime() - 5 * DAY);

  const next = nextNameChangeAt("MEMBER", fiveDaysAgo, now);
  assert.ok(next);
  assert.equal(next.getTime(), fiveDaysAgo.getTime() + 14 * DAY);

  assert.equal(nextNameChangeAt("MEMBER", new Date(now.getTime() - 14 * DAY), now), null, "14 dias completos libera");
  assert.equal(nextNameChangeAt("MEMBER", null, now), null, "nunca trocou: pode trocar");
  assert.equal(nextNameChangeAt("PREMIUM", fiveDaysAgo, now), null);
  assert.equal(nextNameChangeAt("ULTRA", fiveDaysAgo, now), null);
});

test("badges: só ids conhecidos, sem repetição", () => {
  assert.equal(badgesSchema.safeParse(["founder", "verified"]).success, true);
  assert.equal(badgesSchema.safeParse([]).success, true, "lista vazia remove todos");
  assert.equal(badgesSchema.safeParse(["founder", "founder"]).success, false, "repetido");
  assert.equal(badgesSchema.safeParse(["hacker"]).success, false, "desconhecido");
  assert.deepEqual(sanitizeBadges(["verified", "removido", "verified", "founder"]), ["verified", "founder"]);
});

test("o dono do perfil não consegue se dar badges pelo updateProfile", () => {
  assert.equal(profileUpdateSchema.safeParse({ badges: ["founder"] }).success, false);
});

test("fontes, efeitos e cores do card só aceitam valores conhecidos", () => {
  assert.equal(profileUpdateSchema.safeParse({ displayNameFont: "pixel", displayNameEffect: "corrupt" }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ displayNameFont: "comic-sans" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ displayNameEffect: "explode" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ backgroundEffect: "vhs" }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ backgroundEffect: "scanlines" }).success, false, "efeito removido");
  assert.equal(profileUpdateSchema.safeParse({ cardOpacity: 101 }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ cardBgColor: "red" }).success, false);
  const parsed = profileUpdateSchema.safeParse({ cardBgColor: "#ABCDEF" });
  assert.equal(parsed.success && parsed.data.cardBgColor, "#abcdef", "hex guardado em minúsculas");
});
