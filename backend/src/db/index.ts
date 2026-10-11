import Database from 'better-sqlite3';
import { AppOptions } from '../app.js';

export function initDb(options: AppOptions) {
  const db = new Database(options.databasePath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations
  migrate(db);

  return db;
}

function migrate(db: Database.Database) {
  let userVersion = db.pragma('user_version', { simple: true }) as number;

  if (userVersion === 0) {
    const migration1 = `
      CREATE TABLE users (
        id            INTEGER PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE cars (
        id                  INTEGER PRIMARY KEY,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name                TEXT NOT NULL,
        make                TEXT,
        model               TEXT,
        year                INTEGER,
        license_plate       TEXT,
        fuel_type           TEXT NOT NULL CHECK (fuel_type IN ('petrol','diesel','lpg','electric','other')),
        tank_capacity_l     REAL CHECK (tank_capacity_l IS NULL OR tank_capacity_l > 0),
        initial_odometer_km INTEGER NOT NULL DEFAULT 0 CHECK (initial_odometer_km >= 0),
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );
      CREATE INDEX cars_user_idx ON cars(user_id);

      CREATE TABLE refuelings (
        id               INTEGER PRIMARY KEY,
        car_id           INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
        date             TEXT NOT NULL,
        odometer_km      INTEGER NOT NULL CHECK (odometer_km >= 0),
        liters           REAL NOT NULL CHECK (liters > 0),
        total_cost_cents INTEGER NOT NULL CHECK (total_cost_cents >= 0),
        full_tank        INTEGER NOT NULL DEFAULT 1 CHECK (full_tank IN (0,1)),
        notes            TEXT,
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );
      CREATE INDEX refuelings_car_date_idx ON refuelings(car_id, date, odometer_km);
    `;
    
    db.transaction(() => {
      db.exec(migration1);
      db.pragma('user_version = 1');
    })();
    userVersion = 1;
  }

  // Future migrations go here
}
