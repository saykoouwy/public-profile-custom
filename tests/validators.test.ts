import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, profileUpdateSchema, socialLinkSchema, reorderSchema, sanitizeText, trackUpdateSchema } from "@/lib/validators";

test("socialLinkSchema rejects non-https and malicious URLs", () => {
  const bad = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "http://example.com",
    "vbscript:msgbox(1)",
    "//evil.com",
    "https://user:pass@evil.com",
    "file:///etc/passwd",
    "not a url",
  ];
  for (const url of bad) {
    assert.equal(socialLinkSchema.safeParse({ platform: "x", url }).success, false, url);
  }
  const ok = socialLinkSchema.parse({ platform: "github", url: "https://github.com/rubris", label: "<b>GitHub</b>" });
  assert.equal(ok.label, "GitHub");
});

test("socialLinkSchema rejects unknown platforms and extra keys", () => {
  assert.equal(socialLinkSchema.safeParse({ platform: "evil", url: "https://x.com" }).success, false);
  assert.equal(socialLinkSchema.safeParse({ platform: "x", url: "https://x.com", profileId: "other" }).success, false);
});

test("loginSchema enforces lengths and charset", () => {
  assert.equal(loginSchema.safeParse({ username: "ab", password: "123456" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "a".repeat(31), password: "123456" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "admin", password: "12345" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "adm' OR 1=1--", password: "123456" }).success, false);
  assert.equal(loginSchema.safeParse({ username: "admin", password: "123456" }).success, true);
});

test("profileUpdateSchema strips HTML and validates media/enum fields", () => {
  const parsed = profileUpdateSchema.parse({
    displayName: "<script>alert(1)</script>rubris",
    bio: "<img src=x onerror=alert(1)>ersticke †",
    location: "",
    backgroundType: "VIDEO",
    backgroundUrl: "/default-bg.mp4",
  });
  assert.equal(parsed.displayName, "alert(1)rubris");
  assert.equal(parsed.bio, "ersticke †");
  assert.equal(parsed.location, null);

  assert.equal(profileUpdateSchema.safeParse({ backgroundType: "SVG" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ backgroundUrl: "javascript:alert(1)" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ avatarUrl: "/../../etc/passwd" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ avatarUrl: "http://insecure.com/a.png" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ discordUserId: "abc" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ viewsCount: 999999 }).success, false, "unknown keys rejected");
  assert.equal(profileUpdateSchema.safeParse({ displayName: "<b></b>" }).success, false, "empty after sanitize");
});

test("reorderSchema requires unique UUIDs", () => {
  const id = "4c3c0a64-0000-4000-8000-000000000001";
  assert.equal(reorderSchema.safeParse([id, id]).success, false);
  assert.equal(reorderSchema.safeParse(["1; DROP TABLE"]).success, false);
  assert.equal(reorderSchema.safeParse([id]).success, true);
});

test("sanitizeText removes control chars and angle brackets", () => {
  assert.equal(sanitizeText("  a\u0000b <c  d>  "), "ab");
  assert.equal(sanitizeText("1 < 2"), "1 2");
});

test("profileUpdateSchema keeps manual activity and Discord status mutually exclusive", () => {
  assert.equal(profileUpdateSchema.safeParse({ showDiscordStatus: true, manualActivityType: "LISTENING" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ manualActivityType: "PLAYING", manualStatusText: "" }).success, false);
  assert.equal(profileUpdateSchema.safeParse({ showDiscordStatus: false, manualActivityType: "PLAYING", manualStatusText: "Elden Ring" }).success, true);
  assert.equal(profileUpdateSchema.safeParse({ showDiscordStatus: true, manualActivityType: null, manualStatusText: "" }).success, true);
});

test("trackUpdateSchema sanitizes text and rejects unknown keys", () => {
  const parsed = trackUpdateSchema.parse({ title: "<b>Demolition</b> Lovers", artist: "" });
  assert.equal(parsed.title, "Demolition Lovers");
  assert.equal(parsed.artist, null);
  assert.equal(trackUpdateSchema.safeParse({ title: "x".repeat(61), artist: "" }).success, false);
  assert.equal(trackUpdateSchema.safeParse({ title: "a", artist: "b", audioUrl: "https://evil.com/x.mp3" }).success, false);
});
