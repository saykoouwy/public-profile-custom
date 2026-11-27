import { test } from "node:test";
import assert from "node:assert/strict";
import { clamp, cursorStyle, formatCount, formatNumber, formatTime } from "@/lib/utils";

test("formatTime", () => {
  assert.equal(formatTime(366), "6:06");
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(3759), "1:02:39");
  assert.equal(formatTime(Infinity), "0:00");
  assert.equal(formatTime(-5), "0:00");
});

test("formatCount / formatNumber use pt-BR", () => {
  // O Intl separa "1,2" de "mil" com espaço não separável (U+00A0).
  const plain = (s: string) => s.replace(/\s/g, " ");
  assert.equal(formatCount(166), "166");
  assert.equal(plain(formatCount(1234)), "1,2 mil");
  assert.equal(formatNumber(1200), "1.200");
});

test("clamp", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test("cursorStyle escapes characters that would break url(...)", () => {
  assert.equal(cursorStyle("/uploads/cursor/a.png"), 'url("/uploads/cursor/a.png") 4 4, auto');
  const css = cursorStyle(String.raw`https://cdn.example.com/a")b('c\d.png`);
  assert.equal(css, 'url("https://cdn.example.com/a%22%29b%28%27c%5Cd.png") 4 4, auto');
});
