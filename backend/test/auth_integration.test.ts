import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Auth Integration', () => {
  it('should register and login a user', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body).toContain('test@example.com');
    expect(registerRes.headers['set-cookie']).toBeDefined();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.headers['set-cookie']).toBeDefined();
    await app.close();
  });

  it('should fail register with existing email', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe('email_taken');
    await app.close();
  });

  it('should fail login with wrong password', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'wrong' },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe('invalid_credentials');
    await app.close();
  });

  it('should authenticate /auth/me with cookie', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'me@example.com', password: 'password123' },
    });
    const cookie = reg.headers['set-cookie'];

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: cookie.split(';')[0].split('=')[1] },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.email).toBe('me@example.com');
    await app.close();
  });

  it('should logout and invalidate session', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'out@example.com', password: 'password123' },
    });
    const cookie = reg.headers['set-cookie'];
    const sid = cookie.split(';')[0].split('=')[1];

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { sid },
    });

    expect(logoutRes.statusCode).toBe(204);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid },
    });

    expect(meRes.statusCode).toBe(401);
    await app.close();
  });

  it('should log out with JSON content type and no body, then reject the old cookie', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'json-out@example.com', password: 'password123' },
    });
    const sid = reg.headers['set-cookie'].split(';')[0].split('=')[1];

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { 'content-type': 'application/json' },
      cookies: { sid },
    });
    expect(logoutRes.statusCode).toBe(204);

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid },
    });
    expect(meRes.statusCode).toBe(401);

    const carsRes = await app.inject({
      method: 'GET',
      url: '/api/cars',
      cookies: { sid },
    });
    expect(carsRes.statusCode).toBe(401);
    await app.close();
  });

  it('should return the same 401 for a malformed login email as for a wrong password', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'shape-login@example.com', password: 'password123' },
    });

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'shape-login@example.com', password: 'wrong' },
    });
    const malformedEmail = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad-format', password: 'password123' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(malformedEmail.statusCode).toBe(401);
    expect(malformedEmail.body).toBe(wrongPassword.body);
    await app.close();
  });
});
