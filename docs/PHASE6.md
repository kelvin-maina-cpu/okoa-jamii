# Phase 6: system integration, analytics, and security

## Real-time flow

1. The authenticated dashboard requests `POST /api/auth/realtime-ticket` through its same-origin BFF route. The access token remains in an HttpOnly cookie.
2. The backend returns a five-minute, audience-scoped ticket only to users with `viewIncidents`.
3. Socket.IO verifies that ticket, reloads the user from MongoDB, and rejects inactive accounts or roles without current incident-view permission. The socket is disconnected at ticket expiry; the dashboard renews tickets and reconnects.
4. The server publishes `incident:event` records containing only `eventId`, event type, incident ID, and timestamp. The dashboard deduplicates event IDs and reloads authorized API data. On reconnection it also refreshes the queue to recover events missed while disconnected.

Event types are `created`, `status_changed`, `assigned`, `escalated`, and `resolved`. API routes remain the source of truth and the dashboard keeps its manual refresh and normal request paths.

## Analytics

`GET /api/analytics/incidents?from=<ISO>&to=<ISO>` requires `viewAnalytics` (County Administrator and Super Administrator). The default range is the previous 30 days; explicit ranges are limited to 366 days. The result includes totals, active/pending/escalated/resolved counts, category/status distributions, daily UTC trends, response-time measures, and coarse location groups.

The dashboard `/admin/analytics` uses live MongoDB aggregates and provides date filters, responsive category/status/trend charts, empty/loading/error states, and response-time sample counts. Average acknowledgement/resolution times use only valid stored `acknowledgedAt`/`resolvedAt` timestamps. Missing historical timestamps yield `averageMinutes: null` and `sampleSize: 0`, not a fabricated zero. Location groups round coordinates to 0.1 degrees and hide groups with fewer than three reports.

## Audit and notifications

Successful registration, login, refresh, logout, admin provisioning, incident creation/actions, SMS tracking, and community-alert changes write `AuditLog` events. Audit reads use `GET /api/audit` and require `viewAuditLogs`; the route is read-only, paginated, and omits sensitive metadata keys. Ordinary application APIs do not update or delete audit rows.

`GET /api/notifications` lists the authenticated user's in-app incident updates; `PATCH /api/notifications/:id/read` marks only that user's record read. Status notifications use generic wording and an idempotency key. The reporter receives response-state changes, and the assigned officer receives assignment events. Dashboard live events are a separate channel. Existing SMS notification records/providers remain separate and retain explicit `not_configured`, `queued`, `simulated`, `sent`, and `failed` states.

Mobile fetches published community announcements from `GET /api/alerts` and status notifications from `/api/notifications` on the home screen. Expo push is not configured because no device-token registration, consent, or push provider is present. Evidence remains metadata-only until upload storage is configured. Do not infer SMS delivery or responder dispatch from a saved notification.

## Security controls and limits

- Passwords use bcrypt; refresh tokens are stored as hashes and rotated/revoked server-side. Access tokens are short-lived (15 minutes by default); an already-issued access token can remain valid until expiry after logout or role change.
- Production requires a 32-character-or-longer signing secret. Keep secrets in the deployment secret manager and out of source control/client bundles.
- API validation, JSON body limit, Helmet, API/auth/incident rate limits, and exact-origin CORS allowlisting are enabled.
- Socket tickets are short-lived, audience-scoped, and revalidated against current active-user/role data. Socket payloads contain no description, coordinates, reporter contact, or evidence.
- Analytics locations are coarse and suppressed for groups under three records. Authorized incident detail and the incident map still include precise report coordinates; protect access and display them only to incident-view roles.
- SMS provider integration, push delivery, evidence upload, and dispatch are not active integrations. The backend escalation timer is in-process and intended for one long-lived API process; deployments with multiple or serverless instances require a single external scheduler.

## Verification and manual end-to-end walkthrough

Automated checks are `npm --prefix backend test`, `npm --prefix backend run build`, `npm --prefix dashboard run lint`, `npm --prefix dashboard run typecheck`, `npm --prefix dashboard run build`, `npm --prefix mobile run typecheck`, and `npm run mobile:test` from the repository root. Backend tests use Mongo mocks; they do not replace a live multi-device deployment check.

1. Start MongoDB and configure the backend, dashboard, and mobile API base URLs.
2. Sign in on mobile as a citizen and submit an incident online. Confirm the server reference appears under My Reports and the dashboard queue.
3. Sign in to the dashboard as a County Administrator. Check the live-update indicator, acknowledge the report, assign an active Security Officer, escalate if appropriate, and resolve it. Verify status history and audit rows.
4. Open `/admin/analytics`, choose a date range containing the report, and confirm summary/category/status/trend data and response sample counts.
5. Open the mobile home screen and verify a published announcement and incident status notification. Mark the update read and open its incident.
6. Disconnect dashboard networking, perform an authorized action from another session, restore connectivity, and confirm the queue refreshes after socket reconnection. Repeat with an expired ticket.
7. Enable airplane mode on a physical phone, save a report, close/reopen the app, restore connectivity, and confirm the original report synchronizes once with the same client-generated ID.
8. Attempt analytics/audit/socket access with a Citizen token and an incident API request without a token; verify denials. Use a deliberately failing SMS provider configuration in a non-production environment and confirm the incident remains saved with a tracked failed/not-configured notification state.
