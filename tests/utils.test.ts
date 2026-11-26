import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCount, formatTime } from "@/lib/utils";

test("formatTime", () => {
  assert.equal(formatTime(366), "6:06");
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(3759), "1:02:39");
  assert.equal(formatTime(Infinity), "0:00");
  assert.equal(formatTime(-5), "0:00");
});

test("formatCount", () => {
  assert.equal(formatCount(166), "166");
  assert.equal(formatCount(1234), "1.2K");
});
