import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT = "tamreen-whoop-v1";

function keyFromSecret(secret: string): Buffer {
  if (secret.length < 16) {
    throw new Error("WHOOP token secret is too short.");
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptWhoopSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function decryptWhoopSecret(payload: string, secret: string): string {
  const buffer = Buffer.from(payload, "base64url");
  if (buffer.length < 29) {
    throw new Error("WHOOP token payload is incomplete.");
  }
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
