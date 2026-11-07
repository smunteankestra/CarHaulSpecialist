import assert from "node:assert/strict";
import test from "node:test";

import { generatePassword, hashPassword, isRole, verifyPassword } from "../src/users.ts";

test("a password verifies against its own hash", async () => {
  const stored = await hashPassword("correct horse battery staple");
  const user = { password_hash: stored.hash, salt: stored.salt, iterations: stored.iterations };
  assert.equal(await verifyPassword("correct horse battery staple", user), true);
});

test("a wrong password does not verify", async () => {
  const stored = await hashPassword("s3cret-pass");
  const user = { password_hash: stored.hash, salt: stored.salt, iterations: stored.iterations };
  assert.equal(await verifyPassword("s3cret-pas", user), false);
  assert.equal(await verifyPassword("", user), false);
});

test("the same password hashes differently each time", async () => {
  const first = await hashPassword("same-input");
  const second = await hashPassword("same-input");
  assert.notEqual(first.hash, second.hash);
  assert.notEqual(first.salt, second.salt);
});

test("generated passwords are readable and unique", () => {
  const first = generatePassword();
  const second = generatePassword();
  assert.match(first, /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/);
  assert.notEqual(first, second);
});

test("only known roles are accepted", () => {
  assert.equal(isRole("admin"), true);
  assert.equal(isRole("dispatcher"), true);
  assert.equal(isRole("owner"), false);
});
