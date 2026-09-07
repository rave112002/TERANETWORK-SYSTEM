import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptCredentials,
  encryptCredentials,
  isCredentialCryptoConfigured,
} from "./credentialCrypto.js";

const KEY_A = crypto.randomBytes(32).toString("hex");
const KEY_B = crypto.randomBytes(32).toString("hex");

const CREDS = { username: "root", password: "s3cr3t-olt-pass", enablePassword: "en@ble" };

let original;

beforeEach(() => {
  original = process.env.CREDENTIAL_MASTER_KEY;
  process.env.CREDENTIAL_MASTER_KEY = KEY_A;
});

afterEach(() => {
  if (original === undefined) delete process.env.CREDENTIAL_MASTER_KEY;
  else process.env.CREDENTIAL_MASTER_KEY = original;
});

describe("round trip", () => {
  it("returns exactly what went in", () => {
    expect(decryptCredentials(encryptCredentials(CREDS))).toEqual(CREDS);
  });

  it("handles unicode and long secrets", () => {
    const creds = { username: "técnico", password: "ñ".repeat(500) + "🔐" };
    expect(decryptCredentials(encryptCredentials(creds))).toEqual(creds);
  });

  it("handles an empty object", () => {
    expect(decryptCredentials(encryptCredentials({}))).toEqual({});
  });

  it("rejects a non-object", () => {
    expect(() => encryptCredentials("just-a-string")).toThrow(/expects an object/i);
    expect(() => encryptCredentials(null)).toThrow(/expects an object/i);
  });
});

describe("the ciphertext itself", () => {
  it("never contains the plaintext", () => {
    const blob = encryptCredentials(CREDS);
    const asText = blob.toString("latin1");
    expect(asText).not.toContain("s3cr3t-olt-pass");
    expect(asText).not.toContain("root");
    expect(asText).not.toContain("en@ble");
  });

  it("differs every time, so identical credentials are not linkable", () => {
    // A fresh data key and IV per record. Without this, two OLTs sharing a
    // password would produce identical blobs and leak that fact.
    const a = encryptCredentials(CREDS);
    const b = encryptCredentials(CREDS);
    expect(a.equals(b)).toBe(false);
    expect(decryptCredentials(a)).toEqual(decryptCredentials(b));
  });

  it("is versioned, so the format can change later", () => {
    expect(encryptCredentials(CREDS)[0]).toBe(1);
  });

  it("rejects a version it does not understand", () => {
    const blob = encryptCredentials(CREDS);
    blob[0] = 99;
    expect(() => decryptCredentials(blob)).toThrow(/version 99/);
  });
});

describe("tamper detection", () => {
  it("refuses a modified ciphertext byte", () => {
    const blob = encryptCredentials(CREDS);
    blob[blob.length - 1] ^= 0xff;
    expect(() => decryptCredentials(blob)).toThrow(/integrity/i);
  });

  it("refuses a modified wrapped key", () => {
    const blob = encryptCredentials(CREDS);
    blob[35] ^= 0xff; // inside the wrapped data key
    expect(() => decryptCredentials(blob)).toThrow(/master key may have changed|tampered/i);
  });

  it("refuses a truncated blob", () => {
    const blob = encryptCredentials(CREDS);
    expect(() => decryptCredentials(blob.subarray(0, 40))).toThrow(/malformed or truncated/i);
  });

  it("refuses something that is not a buffer", () => {
    expect(() => decryptCredentials("nope")).toThrow(/malformed or truncated/i);
    expect(() => decryptCredentials(null)).toThrow(/malformed or truncated/i);
  });
});

describe("master key", () => {
  it("cannot read a blob written under a different key", () => {
    const blob = encryptCredentials(CREDS);
    process.env.CREDENTIAL_MASTER_KEY = KEY_B;
    expect(() => decryptCredentials(blob)).toThrow(/master key may have changed/i);
  });

  it("fails loudly when unset, with a way to generate one", () => {
    delete process.env.CREDENTIAL_MASTER_KEY;
    expect(() => encryptCredentials(CREDS)).toThrow(/CREDENTIAL_MASTER_KEY is not set/);
    expect(() => encryptCredentials(CREDS)).toThrow(/randomBytes/);
  });

  it("rejects a key of the wrong length rather than padding it", () => {
    process.env.CREDENTIAL_MASTER_KEY = "too-short";
    expect(() => encryptCredentials(CREDS)).toThrow(/must be 32 bytes/);
  });

  it("accepts a raw 32-byte string as well as 64 hex characters", () => {
    process.env.CREDENTIAL_MASTER_KEY = "a".repeat(32);
    expect(decryptCredentials(encryptCredentials(CREDS))).toEqual(CREDS);
  });

  it("does not leak the key or plaintext in the error message", () => {
    const blob = encryptCredentials(CREDS);
    process.env.CREDENTIAL_MASTER_KEY = KEY_B;
    try {
      decryptCredentials(blob);
      throw new Error("expected decryptCredentials to throw");
    } catch (error) {
      expect(error.message).not.toContain(KEY_B);
      expect(error.message).not.toContain("s3cr3t-olt-pass");
    }
  });
});

describe("isCredentialCryptoConfigured", () => {
  it("is true with a valid key", () => {
    expect(isCredentialCryptoConfigured()).toBe(true);
  });

  it("is false when unset or invalid, without throwing", () => {
    delete process.env.CREDENTIAL_MASTER_KEY;
    expect(isCredentialCryptoConfigured()).toBe(false);
    process.env.CREDENTIAL_MASTER_KEY = "short";
    expect(isCredentialCryptoConfigured()).toBe(false);
  });
});
