# Feature: Car fuel management web app

## Summary
A web app where a user logs in, manages their cars, records refuelings for each car, and views a report of fuel use and spend.

## User stories

### 1. Accounts
- Register with email + password, log in, log out.
- Anonymous users are redirected to the login page.
- Each user sees and changes only their own cars and refuelings. Another user's record id returns 404.
- Passwords are hashed. No API response ever includes a password or hash.
- No password reset, email verification, or social login.

### 2. Cars (CRUD)
- Fields:
  - name: required
  - make, model: optional
  - year: optional, sane range
  - license plate: optional
  - fuel type: required, one of petrol | diesel | LPG | electric | other
  - tank capacity (liters): optional, > 0
  - initial odometer (km): optional, >= 0, default 0
- List page shows the user's cars. Create, edit, delete.
- Delete asks for confirmation. Deleting a car also deletes its refuelings, and the confirm text says so.

### 3. Refuelings (CRUD, per car)
- Fields:
  - date: required, not in the future
  - odometer (km): required, >= the car's initial odometer
  - liters: required, > 0
  - total cost: required, >= 0
  - full tank: boolean, default true
  - notes: optional, max 500 chars
- Price per liter (cost / liters) is shown. Store it or compute it: tech-lead decides.
- Per-car list, newest first. Create, edit, delete.

### 4. Report page
- Filters: car (one car or all cars) and date range (from / to, default all time).
- Summary: total spend, total liters, refueling count, average price per liter, distance covered (max odometer - min odometer in range), average consumption (L/100 km), cost per km.
- Monthly breakdown: liters and cost per month, as a table or chart.
- Tech-lead documents the consumption formula in `.herdr/out/design.md`. It must use full-tank refuelings.

## Assumptions
- Metric units: km and liters.
- Money: plain decimal amounts, one currency, no conversion.
- Stack: tech-lead chooses it in the design. The repo `.gitignore` already lists `node_modules/`, `dist/`, `*.db`, `.env`, so Node/TypeScript + SQLite fits. Keep it simple to run locally.
- Setup and run steps go in a root `README.md`.

## Non-goals
- Password reset, email verification, OAuth.
- Sharing cars between users, admin UI.
- Service, maintenance, or other expense tracking.
- Import/export, multi-currency, native mobile app.

## Layout constraint
- Backend code in `backend/`.
- Frontend code in `frontend/`.
- Repo root keeps `.herdr/`, `.gitignore`, and `README.md`.

## Quality bar
- All car and refueling endpoints require auth and are scoped to the owner.
- Server-side validation for every field. The UI shows the errors.
- Backend unit + integration tests. Frontend component tests.
- One E2E test: register -> add car -> add refueling -> report shows the expected numbers.
- `npm test` passes in both `backend/` and `frontend/`.
- Layout works at phone width with no horizontal page scroll.
