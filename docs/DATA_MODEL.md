# Okoa Jamii Data Model

## Relationships

- `User` owns `Incident` reports through `reporterId`.
- `Incident.assignedOfficerId` references a `User` with the Security Officer or administrator role.
- `CommunityAlert.createdBy` references the administrator or community leader who created it.
- `AuditLog.actorId` references the user who performed an action.
- `AuditLog.resourceId` links the log entry to an incident, alert, user, or other resource by identifier.

## Indexes and constraints

- User email and phone are unique when present and sparse.
- A User must have at least one of email or phone.
- Incident locations use a GeoJSON `Point` with `[longitude, latitude]` ordering and a `2dsphere` index.
- `(clientGeneratedId, reporterId)` is unique to prevent duplicate offline submissions.
- Incident status, priority, reporter, officer, and timestamps are indexed for monitoring queries.
- Community alerts and audit logs use publication and creation indexes.

## Development data

Seed records are marked with `[TEST]` or `[TEST DATA]`. They must never be used as real emergency records and must not be loaded in production.
