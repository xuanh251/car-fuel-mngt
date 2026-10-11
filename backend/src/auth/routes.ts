import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './password.js';
import { generateToken, createSession, deleteSession, getSessionUserId } from './sessions.js';
import { authGuard } from './guard.js';
import { parseBody } from '../body.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

// No email format check: a malformed email is a credential mismatch (401), like a wrong password.
const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

let dummyHash: string | null = null;
async function getDummyHash() {
  if (!dummyHash) {
    dummyHash = await hashPassword('dummy-password');
  }
  return dummyHash;
}

export async function authRoutes(fastify: FastifyInstance) {
  
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password } = parseBody(registerSchema, request.body);

    try {
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();

      const user = fastify.db.prepare(
        'INSERT INTO users (email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run(email, passwordHash, now, now);

      const userId = Number(user.lastInsertRowid);
      const token = generateToken();
      createSession(fastify.db, userId, token);

      reply.setCookie('sid', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1209600,
        secure: process.env.NODE_ENV === 'production',
      });

      return reply.status(201).send({
        user: { id: userId, email },
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed: users.email')) {
        return reply.status(409).send({ error: 'email_taken', message: 'Email already registered' });
      }
      throw err;
    }
  });

  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = parseBody(loginSchema, request.body);

    const user = fastify.db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email) as any;

    // Timing attack mitigation: always run scrypt
    const hashToVerify = user ? user.password_hash : await getDummyHash();
    const isValid = await verifyPassword(password, hashToVerify);

    if (!user || !isValid) {
      return reply.status(401).send({ error: 'invalid_credentials', message: 'Invalid email or password' });
    }

    const token = generateToken();
    createSession(fastify.db, user.id, token);

    reply.setCookie('sid', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1209600,
      secure: process.env.NODE_ENV === 'production',
    });

    return reply.status(200).send({
      user: { id: user.id, email },
    });
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const token = request.cookies.sid;
    if (token) {
      deleteSession(fastify.db, token);
    }
    reply.clearCookie('sid');
    return reply.status(204).send();
  });

  fastify.get('/auth/me', async (request, reply) => {
    const token = request.cookies.sid;
    if (!token) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Authentication required' });
    }

    const userId = getSessionUserId(fastify.db, token);
    if (!userId) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Invalid or expired session' });
    }

    const user = fastify.db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as any;
    return reply.status(200).send({
      user: { id: user.id, email: user.email },
    });
  });
}

// Helper for getSessionUserId since it's not exported from sessions.ts in a way that avoids circular dep if not careful
// Actually it is exported. Let me check.
