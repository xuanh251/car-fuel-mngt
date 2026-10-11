import crypto from 'node:crypto';
import Database from 'better-sqlite3';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(db: Database.Database, userId: number, token: string) {
  const tokenHash = hashToken(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(tokenHash, userId, createdAt, expiresAt);
}

export function getSessionUserId(db: Database.Database, token: string): number | null {
  const tokenHash = hashToken(token);
  const session = db.prepare(
    'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'
  ).get(tokenHash) as { user_id: number; expires_at: string } | undefined;

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }

  return session.user_id;
}

export function deleteSession(db: Database.Database, token: string) {
  const tokenHash = hashToken(token);
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}
