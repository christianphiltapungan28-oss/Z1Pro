import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { betaAllows } from "@/lib/beta";
import { safeCallback } from "@/lib/safe-callback";
import { open, seal } from "@/lib/secret-box";
import { newTotpSecret, totpCodeAt, totpUri, verifyTotp } from "@/lib/totp";
import { unsubscribeLink, validUnsubscribe } from "@/lib/unsubscribe";

// These modules read AUTH_SECRET on each call, so setting it here is enough.
process.env.AUTH_SECRET = "test-secret-for-unit-tests-only";

// RFC 6238 appendix B: ASCII "12345678901234567890" as base32.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  test("matches the RFC 6238 test vectors (last 6 digits)", () => {
    assert.equal(totpCodeAt(RFC_SECRET, 59_000), "287082");
    assert.equal(totpCodeAt(RFC_SECRET, 1_111_111_109_000), "081804");
    assert.equal(totpCodeAt(RFC_SECRET, 1_234_567_890_000), "005924");
    assert.equal(totpCodeAt(RFC_SECRET, 2_000_000_000_000), "279037");
  });

  test("accepts the current code and one step either side, nothing further", () => {
    const now = 1_700_000_000_000;
    const secret = newTotpSecret();
    assert.notEqual(verifyTotp(secret, totpCodeAt(secret, now), now), null);
    assert.notEqual(verifyTotp(secret, totpCodeAt(secret, now - 30_000), now), null);
    assert.notEqual(verifyTotp(secret, totpCodeAt(secret, now + 30_000), now), null);
    assert.equal(verifyTotp(secret, totpCodeAt(secret, now - 90_000), now), null);
  });

  test("returns the matching step so a code can't be reused", () => {
    const now = 1_700_000_000_000;
    const secret = newTotpSecret();
    assert.equal(verifyTotp(secret, totpCodeAt(secret, now), now), Math.floor(now / 30_000));
  });

  test("rejects malformed codes", () => {
    const secret = newTotpSecret();
    for (const code of ["", "12345", "1234567", "abcdef", "12 34 5a"]) {
      assert.equal(verifyTotp(secret, code), null, code);
    }
  });

  test("new secrets are 160-bit base32 and appear in the otpauth link", () => {
    const secret = newTotpSecret();
    assert.match(secret, /^[A-Z2-7]{32}$/);
    assert.ok(totpUri(secret, "a@b.com").includes(`secret=${secret}`));
  });
});

describe("secret-box", () => {
  test("round-trips and uses a fresh IV each time", () => {
    const a = seal("JBSWY3DPEHPK3PXP");
    const b = seal("JBSWY3DPEHPK3PXP");
    assert.notEqual(a, b);
    assert.equal(open(a), "JBSWY3DPEHPK3PXP");
  });

  test("refuses tampered ciphertext", () => {
    const [v, iv, tag, data] = seal("secret").split(".");
    const flipped = data.slice(0, -1) + (data.endsWith("A") ? "B" : "A");
    assert.throws(() => open([v, iv, tag, flipped].join(".")));
    assert.throws(() => open("v2.x.y.z"));
  });
});

describe("unsubscribe links", () => {
  const userId = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";

  test("accept their own signature only", () => {
    const token = new URL(unsubscribeLink(userId)).searchParams.get("t")!;
    assert.equal(validUnsubscribe(userId, token), true);
    assert.equal(validUnsubscribe("00000000-0000-4000-8000-000000000000", token), false);
    assert.equal(validUnsubscribe(userId, token.slice(1)), false);
    assert.equal(validUnsubscribe("not-a-uuid", token), false);
  });
});

describe("beta allowlist", () => {
  beforeEach(() => {
    delete process.env.BETA_ALLOWLIST;
  });

  test("open to everyone when unset", () => {
    assert.equal(betaAllows("anyone@example.com"), true);
  });

  test("allows listed emails and @domains, case-insensitively", () => {
    process.env.BETA_ALLOWLIST = "Friend@Example.com, @flowsmart.au";
    assert.equal(betaAllows("friend@example.com"), true);
    assert.equal(betaAllows("someone@FLOWSMART.au"), true);
    assert.equal(betaAllows("other@example.com"), false);
    assert.equal(betaAllows("evil@notflowsmart.au"), false);
    assert.equal(betaAllows(null), false);
  });
});

describe("safeCallback", () => {
  test("keeps same-site paths", () => {
    assert.equal(safeCallback("/journeys/1?x=2"), "/journeys/1?x=2");
    assert.equal(safeCallback(["/a", "/b"]), "/a");
  });

  test("turns anything off-site into /", () => {
    for (const url of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", undefined]) {
      assert.equal(safeCallback(url), "/", String(url));
    }
  });
});
