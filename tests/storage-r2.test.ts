import { test } from "node:test";
import assert from "node:assert/strict";
import { createUploadTarget, keyFromPublicUrl, publicUrlFor, storageMode } from "@/lib/storage";

test("R2 driver presigns PUT with content-type and length bound to the signature", async () => {
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "acc123",
    R2_ACCESS_KEY_ID: "AKIDEXAMPLE",
    R2_SECRET_ACCESS_KEY: "fake-secret-for-signing-only",
    R2_BUCKET_NAME: "media",
    R2_PUBLIC_DOMAIN: "media.example.com",
  });
  assert.equal(storageMode(), "r2");
  const key = "avatar/9411488e-ce2a-43c3-b052-e825edb161b1.png";
  const target = await createUploadTarget(key, "image/png", 70);
  const url = new URL(target.url);
  assert.equal(url.host, "media.acc123.r2.cloudflarestorage.com");
  assert.equal(url.pathname, `/${key}`);
  assert.match(url.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-length/);
  assert.match(url.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-type/);
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");

  assert.equal(publicUrlFor(key), `https://media.example.com/${key}`);
  assert.equal(keyFromPublicUrl(`https://media.example.com/${key}`), key);
  assert.equal(keyFromPublicUrl(`https://evil.com/${key}`), null);
  assert.equal(keyFromPublicUrl("/default-avatar.webp"), null);
});
