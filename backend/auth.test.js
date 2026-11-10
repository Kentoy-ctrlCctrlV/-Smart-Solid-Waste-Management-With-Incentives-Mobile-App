const test = require("node:test");
const assert = require("node:assert/strict");
const { clearSessionCookie, setSessionCookie, signSession, verifySession } = require("./auth");
const { hashPassword, verifyPassword } = require("./db");

test("password hashes verify without storing the original password", () => {
  const password = "a secure test password";
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.match(hash, /^scrypt\$/);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("incorrect password", hash), false);
  assert.equal(verifyPassword(password, password), false);
});

test("signed sessions reject tampering and expired tokens", () => {
  const now = 1_800_000_000_000;
  const token = signSession("user-123", now, "session-123");

  assert.deepEqual(verifySession(token, now), {
    userId: "user-123",
    sessionId: "session-123",
    expiresAt: now + 8 * 60 * 60 * 1000,
  });
  assert.equal(verifySession(token, now + 8 * 60 * 60 * 1000 + 1), null);
  assert.equal(verifySession(`${token}tampered`, now), null);
});

test("session cookies are HttpOnly and can be cleared", () => {
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };

  setSessionCookie(response, "signed-token");
  assert.match(headers["Set-Cookie"], /HttpOnly/);
  assert.match(headers["Set-Cookie"], /SameSite=Lax/);
  assert.match(headers["Set-Cookie"], /signed-token/);

  clearSessionCookie(response);
  assert.match(headers["Set-Cookie"], /Max-Age=0/);
});
