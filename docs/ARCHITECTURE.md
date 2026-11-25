# Architecture

- Mobile: Expo React Native, TypeScript, Expo SQLite for queued reports, Expo Location for GPS, SecureStore for tokens.
- Dashboard: Next.js, TypeScript, Tailwind CSS, Leaflet, Recharts, Socket.IO client. Server routes act as a backend-for-frontend so access/refresh tokens stay in HttpOnly cookies.
- Backend: Express, TypeScript, Mongoose, MongoDB Atlas-compatible connection, Socket.IO, short-lived signed realtime tickets.
- MongoDB stores incidents, user accounts, refresh-token hashes, audit events, SMS delivery tracking, in-app notifications, and community announcements.

Citizens submit reports over the authenticated API after they are persisted locally. The offline queue retries using the original idempotency key. Dashboard incident changes publish an ID-only event to the authorized Socket.IO room; the dashboard then reloads full details from its protected API route. The regular API remains the source of truth when realtime is disconnected.

Incident analytics aggregate database records by creation date. Location groups are rounded to 0.1 degrees and suppressed unless at least three records share the group. Acknowledgement/resolution averages use only records with explicit valid timestamps; no sample is represented as `null` rather than zero.

Audit records are append-only through application features and have no update/delete endpoint. The audit viewer is limited to the `viewAuditLogs` permission and removes sensitive metadata keys from the response. SMS status records are separate from incident creation. Mobile fetches published community announcements and in-app status notifications from authenticated APIs.

Expo push and evidence uploads are not configured. SMS sends only through an explicitly enabled provider; the development mock reports `simulated`, never `sent`. No notification status implies dispatch or handset delivery.
