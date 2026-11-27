import { test } from "node:test";
import assert from "node:assert/strict";
import { banSchema, loginSchema, profileUpdateSchema, usernameSchema } from "@/lib/validators";
import { isOwnMediaUrl } from "@/lib/storage";
import { mimeOfFile } from "@/lib/media-rules";
import { hasPrivilege, isBanActive } from "@/lib/roles";
import { isReservedUsername } from "@/lib/usernames";

// Regressões das correções do AUDITORIA.md.

test("mídia local só aceita a allowlist e /uploads/ (bloqueia /logout e outras rotas)", () => {
  for (const url of ["/logout", "/customize", "/api/upload", "/login", "/icon.svg", "/uploads/../logout"]) {
    assert.equal(profileUpdateSchema.safeParse({ avatarUrl: url }).success, false, url);
    assert.equal(isOwnMediaUrl(url), false, url);
  }
  for (const url of ["/default-avatar.webp", "/default-bg.mp4"]) {
    assert.equal(profileUpdateSchema.safeParse({ backgroundUrl: url }).success, true, url);
    assert.equal(isOwnMediaUrl(url), true, url);
  }
});

test("username exige letra ou número e usa o mesmo formato no login", () => {
  for (const bad of ["...", "---", "_._", "ab", "a b c"]) {
    assert.equal(usernameSchema.safeParse(bad).success, false, bad);
  }
  assert.equal(usernameSchema.parse("  rubris  "), "rubris");
  assert.equal(loginSchema.safeParse({ username: "...", password: "123456" }).success, false);
});

test("rotas e arquivos do site são nomes reservados", () => {
  for (const name of ["icon.svg", "icons", "opengraph-image", "twitter-image", "apple-icon.png", "LOGOUT"]) {
    assert.equal(isReservedUsername(name), true, name);
  }
});

test("banimento: temporário expira, permanente não, null não é banido", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  assert.equal(isBanActive({ bannedAt: null, banExpiresAt: null }, now), false);
  assert.equal(isBanActive({ bannedAt: now, banExpiresAt: null }, now), true);
  assert.equal(isBanActive({ bannedAt: now, banExpiresAt: new Date("2026-11-28T00:00:00Z") }, now), true);
  assert.equal(isBanActive({ bannedAt: now, banExpiresAt: new Date("2026-11-27T11:00:00Z") }, now), false);
});

test("privilégios seguem a hierarquia Membro < Premium < Ultra", () => {
  assert.equal(hasPrivilege("MEMBER", "PREMIUM"), false);
  assert.equal(hasPrivilege("PREMIUM", "PREMIUM"), true);
  assert.equal(hasPrivilege("ULTRA", "PREMIUM"), true);
  assert.equal(hasPrivilege("PREMIUM", "ULTRA"), false);
});

test("banSchema só aceita as durações oferecidas no painel", () => {
  assert.equal(banSchema.safeParse({ duration: "7d" }).success, true);
  assert.equal(banSchema.safeParse({ duration: "perm", reason: "spam" }).success, true);
  assert.equal(banSchema.safeParse({ duration: "999d" }).success, false);
});

test("tipo do arquivo cai para a extensão quando o navegador não informa", () => {
  assert.equal(mimeOfFile({ type: "", name: "musica.OGG" }), "audio/ogg");
  assert.equal(mimeOfFile({ type: "", name: "foto.webp" }), "image/webp");
  assert.equal(mimeOfFile({ type: "audio/mpeg", name: "x.ogg" }), "audio/mpeg");
  assert.equal(mimeOfFile({ type: "", name: "sem-extensao" }), "");
});
