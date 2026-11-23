# Authentication and User Management (Phase 2)

## Backend

Authentication API routes:

- `POST /api/auth/register`: citizen self-registration only.
- `POST /api/auth/login`: user login with generic invalid-credentials error.
- `POST /api/auth/refresh`: refresh token rotation.
- `POST /api/auth/logout`: refresh token revocation.
- `GET /api/auth/me`: authenticated profile and permissions.
- `POST /api/auth/provision-admin`: controlled admin provisioning (Super Administrator only).

Security controls:

- Passwords are hashed with bcrypt (`passwordHash` only).
- Access tokens are short-lived JWT tokens.
- Refresh tokens are signed JWT tokens plus server-side hashed persistence for revocation and rotation.
- Rate limiting is applied to register/login/refresh.
- Validation is enforced with Zod.
- Centralized error handling prevents sensitive leakage.
- Password hashes and internal token hashes are never returned in normal user responses.

Refresh token behavior:

- A refresh token record is stored as a SHA-256 hash.
- On refresh, old token is revoked and replaced by a newly issued refresh token.
- Replayed/invalid refresh tokens are rejected.

## Dashboard session strategy

- Dashboard uses Next.js API route handlers as a BFF layer to communicate with the Express API.
- Access and refresh tokens are stored in HttpOnly cookies.
- `/api/session/me` refreshes expired access sessions when a valid refresh token exists.
- Citizens are denied access to admin sessions even if they successfully authenticate for mobile features.

## Mobile session strategy

- Mobile uses `x-auth-mode: token` and stores tokens in Expo SecureStore.
- Session restoration sequence:
  1. Load tokens from secure storage.
  2. Call `/auth/me` with access token.
  3. If expired, call `/auth/refresh` and retry `/auth/me`.
- Logout revokes the server refresh token and clears local secure storage.
- Forgot password is intentionally shown as not yet available.

## Permissions matrix

- Citizen: none in admin dashboard.
- Community Leader: view incidents, escalate incidents, publish community alerts.
- Security Officer: view incidents, acknowledge incidents, assign incidents, resolve incidents.
- County Administrator: full operational and governance permissions.
- Super Administrator: full operational and governance permissions.

## Testing scope completed

Backend automated tests cover:

- registration
- duplicate users
- login
- invalid credentials
- expired refresh token
- refresh rotation
- logout
- missing authentication
- expired access token

Client build/type checks are executed for mobile and dashboard.
