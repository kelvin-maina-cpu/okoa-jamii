# Phase 4: Offline incident sync and SMS fallback

## Mobile incident storage

The Expo app stores incident payloads in `okoa-jamii-incidents.db` before sending any request. The `incidents` table keeps the authenticated owner ID, client id, report fields, endpoint, retry state, last attempt, server incident id, and error text. SQLite `user_version` migrations preserve records from the Phase 3 `pending_incidents` table; future changes should add another forward-only migration rather than recreate the database. Sync queries are scoped to the currently authenticated owner so signing into another account cannot submit a report on the first account's behalf. The user profile is cached in secure device storage after a successful login/profile refresh so an already-authenticated citizen can reopen the app offline. Legacy Phase 3 rows have no stored owner and are preserved without being auto-submitted; **My reports** explains that recovery is needed.

Run the queue and sync unit tests with `npm run mobile:test`. They use an in-memory SQLite adapter and mocked network/API responses to cover migrations, process reloads, owner isolation, offline behavior, restored connectivity, server outages, duplicate responses, and the sync lock. Physical airplane-mode and device power-cycle checks still need to be run on target iOS/Android devices. Existing users must connect once after upgrading if they have not previously cached a secure user profile.

Rows move through `pending_sync`, `syncing`, `synced`, and `failed`. A row is marked `synced` only after a successful API response includes the same `clientGeneratedId` and a server incident ID. Local records are retained after sync. Repository deletion refuses to remove a row unless the server has confirmed it. Retries use the original payload and client ID, a single in-process synchronization lock, connectivity and foreground listeners, a five second exponential base backoff capped at six hours, and at most eight total automatic attempts before another manual retry is needed. Users can request a manual retry from **My reports**.

The app can guarantee queue persistence across restarts on the same installed app and device. It cannot restore app data after the operating system or user clears the app's local storage.

## SMS notification boundary

SOS creation remains the source of truth. After a newly created SOS has been saved, the backend creates a separate `IncidentNotification` tracking row and, when explicitly configured in development, calls the mock `SmsProvider`. SMS failures never roll back an incident. Delivery states mean:

- `not_configured`: provider or authorized recipients are missing; no attempt was made.
- `queued`: a notification record was created for a configured provider.
- `simulated`: the development mock logged a simulation; no SMS was sent.
- `sent`: reserved for a future provider that confirms acceptance/delivery according to its contract.
- `failed`: validation or provider attempt failed.

The SMS mock is opt-in and development-only. It masks the destination and logs only a simulation marker and message length. Production never selects the mock provider. The future `kenyan` provider is intentionally not implemented and remains `not_configured`, even when credentials are present.

## Preparing an authorized provider integration

1. Select a Kenyan SMS aggregator and review its delivery callbacks, opt-in rules, data handling, sender ID requirements, and account permissions.
2. Implement a provider adapter that satisfies `SmsProvider`; store API credentials in the deployment secret manager, never in source control or client code.
3. Configure `OKOA_SMS_PROVIDER=kenyan`, `OKOA_SMS_REAL_PROVIDER_ENABLED=true`, `OKOA_SMS_API_KEY`, and `OKOA_SMS_SENDER_ID` in the server environment.
4. Set `OKOA_SMS_RECIPIENTS` to an explicitly authorized comma-separated allowlist of Kenyan mobile numbers in `+2547XXXXXXXX` or `+2541XXXXXXXX` format. The service rejects invalid recipient configuration and does not infer recipients from the reporter's phone number.
5. Add signed provider callback handling before treating provider acceptance as final delivery. Persist provider message IDs and callback outcomes; test against the provider sandbox first.
6. Keep real sending disabled until the provider account, recipients, credentials, and approval are verified.

SMS notification status does not indicate that a handset had cellular coverage, received the message, or that a responder was dispatched. A local offline report is never described as server-received until synchronization confirms it.
