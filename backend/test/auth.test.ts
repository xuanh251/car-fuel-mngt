import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { generateToken, hashToken, createSession, getSessionUserId, deleteSession } from '../src/auth/sessions.js';
import { buildApp } from '../src/app.js';

describe('Auth Unit Tests', () => {
  describe('Password Hashing', () => {
    it('should hash and verify password', async () => {
      const pwd = 'password123';
      const hash = await hashPassword(pwd);
      expect(hash).toContain('scrypt$16384$8$1$');
      expect(await verifyPassword(pwd, hash)).toBe(true);
    });

    it('should fail for wrong password', async () => {
      const pwd = 'password123';
      const hash = await hashPassword(pwd);
      expect(await verifyPassword('wrong_pwd', hash)).toBe(false);
    });

    it('should fail for invalid hash format', async () => {
      expect(await verifyPassword('pwd', 'not-a-hash')).toBe(false);
    });
  });

  describe('Sessions', () => {
    async function setupUser(db: any) {
      db.prepare('INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('test@example.com', 'hash', '2026-01-01', '2026-01-01');
      return db.prepare('SELECT id FROM users').get() as { id: number };
    }

    it('should create and retrieve session', async () => {
      const app = buildApp({ databasePath: ':memory:' });
      const db = app.db;
      const { id: userId } = await setupUser(db);
      const token = generateToken();

      createSession(db, userId, token);
      expect(getSessionUserId(db, token)).toBe(userId);
      await app.close();
    });

    it('should fail for invalid token', async () => {
      const app = buildApp({ databasePath: ':memory:' });
      const db = app.db;
      expect(getSessionUserId(db, 'invalid-token')).toBeNull();
      await app.close();
    });

    it('should handle expired sessions', async () => {
      const app = buildApp({ databasePath: ':memory:' });
      const db = app.db;
      const { id: userId } = await setupUser(db);
      const token = generateToken();

      // Manually insert expired session
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .run(hashToken(token), userId, '2000-01-01', '2000-01-02');

      expect(getSessionUserId(db, token)).toBeNull();
      // Verify it was deleted
      expect(db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token))).toBeUndefined();
      await app.close();
    });

    it('should delete session', async () => {
      const app = buildApp({ databasePath: ':memory:' });
      const db = app.db;
      const { id: userId } = await setupUser(db);
      const token = generateToken();

      createSession(db, userId, token);
      deleteSession(db, token);
      expect(getSessionUserId(db, token)).toBeNull();
      await app.close();
    });
  });
});
