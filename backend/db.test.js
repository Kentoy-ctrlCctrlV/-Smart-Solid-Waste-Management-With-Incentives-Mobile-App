const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatePoints } = require("./db");

test("calculatePoints applies established biodegradable and recyclable rates", () => {
  assert.equal(calculatePoints("biodegradable", 5, 90), 10);
  assert.equal(calculatePoints("recyclable", 5, 90), 25);
});

test("calculatePoints applies the segregation score multiplier and fallback rate", () => {
  assert.equal(calculatePoints("biodegradable", 5, 95), 12);
  assert.equal(calculatePoints("residual", 5, 90), 5);
  assert.equal(calculatePoints("biodegradable", 0.1, 90), 1);
});
