import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Database', () => {
  it('should apply migrations and enable FKs', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    const db = app.db;

    // Check if tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('cars');
    expect(tableNames).toContain('refuelings');

    // Check FKs
    const fkEnabled = db.pragma('foreign_keys', { simple: true });
    expect(fkEnabled).toBe(1);

    await app.close();
  });

  it('should enforce FK constraints', async () => {
    const app = buildApp({ databasePath: ':memory:' });
    const db = app.db;

    // Try to insert a car for non-existent user
    expect(() => {
      db.prepare('INSERT INTO cars (user_id, name, fuel_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(999, 'Test Car', 'petrol', '2026-01-01', '2026-01-01');
    }).toThrow(/FOREIGN KEY constraint failed/);

    await app.close();
  });
});
