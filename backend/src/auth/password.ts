import crypto from 'node:crypto';

const N = 16384;
const r = 8;
const p = 1;
const keyLen = 64;

function runScrypt(password: string, salt: string, keylen: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N: n, r, p }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('base64');
  const derivedKey = await runScrypt(password, salt, keyLen, N, r, p);
  const keyB64 = derivedKey.toString('base64');
  return `scrypt$${N}$${r}$${p}$${salt}$${keyB64}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const n = parseInt(parts[1], 10);
  const r = parseInt(parts[2], 10);
  const p = parseInt(parts[3], 10);
  const salt = parts[4];
  const keyB64 = parts[5];

  const derivedKey = await runScrypt(password, salt, keyLen, n, r, p);
  const expectedKeyB64 = derivedKey.toString('base64');

  if (keyB64.length !== expectedKeyB64.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(keyB64),
    Buffer.from(expectedKeyB64)
  );
}
