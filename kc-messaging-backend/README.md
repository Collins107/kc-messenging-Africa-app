# KC Messaging Africa — backend

NestJS + Prisma (Postgres) + Socket.io, built to match the frontend contract from
`src/lib/api.ts`, `src/lib/socket.ts`, `src/lib/auth.tsx`, `src/routes/auth.tsx`, and
`src/routes/chat.tsx`.

## Endpoint contract

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/otp/send` | — | `{ phone }` → sends OTP (logs to console in dev mode) |
| POST | `/auth/otp/verify` | — | `{ phone, code, deviceId, platform? }` → `{ accessToken, refreshToken, deviceId }` |
| POST | `/auth/refresh` | — | `{ refreshToken, deviceId }` → rotated token pair |
| POST | `/auth/logout` | Bearer | revokes refresh tokens for that device |
| GET | `/users/me` | Bearer | current user profile |
| GET | `/conversations` | Bearer | conversation list with last message |
| POST | `/conversations` | Bearer | `{ participantIds[], title? }` → create/open |
| GET | `/conversations/:id/messages?cursor=&limit=` | Bearer | paginated history |
| POST | `/conversations/:id/messages` | Bearer | `{ body }` → sends + emits `message:new` |
| POST | `/conversations/:id/read` | Bearer | marks read |

Socket.io namespace: `/realtime`, handshake `{ auth: { token: accessToken } }`.
Events: `message:new` (server→client), `typing:start`/`typing:stop` (client→server),
`typing:update` (server→client).

## Setup

```bash
npm install
cp .env.example .env   # set CORS_ORIGIN to your Vite dev origin
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Requires a local Postgres instance matching `DATABASE_URL` in `.env`.

## Notes on decisions

- **OTP dev mode**: codes print to the server console instead of sending real SMS.
  Swap in Termii / Africa's Talking / Twilio inside `AuthService.sendOtp` for production —
  all three have solid coverage for African phone numbers.
- **Refresh rotation**: each `/auth/refresh` call revokes the old token and issues a new
  pair, so the frontend's single-flight refresh-and-retry logic works safely against
  concurrent requests.
- **deviceId**: the frontend generates/stores this; the backend uses it as the `Device`
  primary key so refresh tokens and push tokens are scoped per install, not per user.
