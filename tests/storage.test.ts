import { test } from "node:test";
import assert from "node:assert/strict";
import { buildObjectKey, isValidObjectKey, mimeFromKey, normalizeMime, sniffMime } from "@/lib/storage";

const bytes = (...v: (number | string)[]) =>
  new Uint8Array(v.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

test("sniffMime recognises real signatures", () => {
  assert.equal(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0)), "image/jpeg");
  assert.equal(sniffMime(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a)), "image/png");
  assert.equal(sniffMime(bytes("GIF89a")), "image/gif");
  assert.equal(sniffMime(bytes("RIFF", 0, 0, 0, 0, "WEBP")), "image/webp");
  assert.equal(sniffMime(bytes(0, 0, 0, 0x20, "ftypisom")), "video/mp4");
  assert.equal(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3)), "video/webm");
  assert.equal(sniffMime(bytes("OggS")), "audio/ogg");
  assert.equal(sniffMime(bytes("ID3", 4, 0)), "audio/mpeg");
  assert.equal(sniffMime(bytes(0xff, 0xfb, 0x90)), "audio/mpeg");
});

test("sniffMime rejects disguised content", () => {
  assert.equal(sniffMime(bytes("<svg onload=alert(1)>")), null);
  assert.equal(sniffMime(bytes("<html><script>")), null);
  assert.equal(sniffMime(bytes("MZ", 0x90, 0)), null); // executável Windows
  assert.equal(sniffMime(bytes("%PDF-1.7")), null);
  assert.equal(sniffMime(new Uint8Array()), null);
});

test("object keys are random UUIDs and strictly validated", () => {
  const key = buildObjectKey("avatar", "image/png");
  assert.match(key, /^avatar\/[0-9a-f-]{36}\.png$/);
  assert.notEqual(key, buildObjectKey("avatar", "image/png"));
  assert.equal(isValidObjectKey(key), true);
  assert.equal(isValidObjectKey(key, "background"), false);
  assert.equal(mimeFromKey(key), "image/png");
  for (const bad of ["../../etc/passwd", "avatar/../x.png", "avatar/evil.png", "avatar/x.svg", "/avatar/a.png"]) {
    assert.equal(isValidObjectKey(bad), false, bad);
  }
});

test("normalizeMime handles aliases and rejects others", () => {
  assert.equal(normalizeMime("audio/mp3"), "audio/mpeg");
  assert.equal(normalizeMime("IMAGE/PNG; charset=binary"), "image/png");
  assert.equal(normalizeMime("image/svg+xml"), null);
  assert.equal(normalizeMime("text/html"), null);
});
