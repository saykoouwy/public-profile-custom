import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { signSession, verifyToken, verifyPassword, hashPassword } from "@/lib/auth";

process.env.JWT_SECRET = "test-secret-".padEnd(64, "x");

// getSecret() reads the env lazily, so setting it before the first call is enough.

test("signSession produces a token that verifyToken accepts", async () => {
  const token = await signSession("4c3c0a64-0000-4000-8000-000000000001", 3);
  assert.deepEqual(await verifyToken(token), { userId: "4c3c0a64-0000-4000-8000-000000000001", tokenVersion: 3 });
});

test("tokens without a session version (pre-revocation) are rejected", async () => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const legacy = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("user-1")
    .setIssuer("biolink").setAudience("biolink-admin").setExpirationTime("1h").sign(secret);
  assert.equal(await verifyToken(legacy), null);
  const bogus = await new SignJWT({ ver: "0" }).setProtectedHeader({ alg: "HS256" }).setSubject("user-1")
    .setIssuer("biolink").setAudience("biolink-admin").setExpirationTime("1h").sign(secret);
  assert.equal(await verifyToken(bogus), null);
});

test("tampered, missing or foreign tokens are rejected", async () => {
  const token = await signSession("user-1");
  const [h, p, s] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
  assert.equal(await verifyToken(`${h}.${forgedPayload}.${s}`), null);
  assert.equal(await verifyToken(`${h}.${p}.${s.slice(0, -2)}aa`), null);
  assert.equal(await verifyToken(undefined), null);
  assert.equal(await verifyToken("garbage"), null);

  const otherSecret = new TextEncoder().encode("another-secret".padEnd(64, "y"));
  const foreign = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("user-1")
    .setIssuer("biolink").setAudience("biolink-admin").setExpirationTime("1h").sign(otherSecret);
  assert.equal(await verifyToken(foreign), null);
});

test("expired tokens are rejected", async () => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("user-1")
    .setIssuer("biolink").setAudience("biolink-admin")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secret);
  assert.equal(await verifyToken(expired), null);
});

test("bcrypt hashing uses cost 12 and verifies", async () => {
  const hash = await hashPassword("correct horse");
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(await verifyPassword("correct horse", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.equal(await verifyPassword("correct horse", null), false);
});
