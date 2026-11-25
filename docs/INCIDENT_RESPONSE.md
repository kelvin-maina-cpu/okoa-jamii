# Incident response operations

## Dashboard and API

The dashboard queue is backed by `GET /api/incidents/operations` with `page`, `limit`, `status`, `incidentType`, `priority`, `search`, and `assignedToMe` filters. Queue records include the reporter's display name, current assignment, status history, and GeoJSON GPS coordinates when available. Reporter contact details are not exposed in the operations queue.

Response routes are authenticated and permission checked:

- `POST /api/incidents/:id/acknowledge` — pending to acknowledged.
- `POST /api/incidents/:id/assign` — assigns an active Security Officer and records assignment history; pending/acknowledged reports become assigned.
- `POST /api/incidents/:id/escalate` — escalates unresolved reports. Configured SMS notifications are tracked separately and do not indicate dispatch.
- `POST /api/incidents/:id/resolve` — resolves an open report.
- `POST /api/incidents/:id/notes` — adds a timestamped internal response note without changing status.

Invalid state changes return conflict responses; invalid IDs return 404. Use `/api/incidents/:id` for authorized incident details.

## Community alerts

`POST /api/alerts` creates an audited draft. `PATCH /api/alerts/:id` updates drafts only. `POST /api/alerts/:id/publish` publishes an alert to authenticated users, and `POST /api/alerts/:id/archive` archives it. `GET /api/alerts` returns published unarchived alerts to authenticated users; community alert publishers can also see drafts. SMS delivery remains a separate configured notification path.

## Automatic escalation

Set `INCIDENT_ESCALATION_AFTER_MINUTES` (default `30`) and `INCIDENT_ESCALATION_CHECK_INTERVAL_MS` (default `60000`) in the backend environment. A single in-process worker checks pending or acknowledged incidents, writes an audit record, updates status history, and creates separately tracked escalation notification records. This timer is appropriate for a single long-lived API process. In serverless or multi-instance deployments, disable duplicate timers and run a single external scheduler/worker with equivalent locking and audit behavior.

Before deploying this schema change to a database created in Phase 4, run `npm --prefix backend run migrate:phase5-notifications`. It backfills legacy notification records as SOS notifications and replaces the prior uniqueness index so one incident can track both its SOS and escalation notifications.

## Map and dispatch

The dashboard maps stored GPS coordinates using OpenStreetMap tiles. Reports without GPS are omitted from the map and remain visible in the queue. No responder dispatch, arrival, or SMS delivery is inferred from an incident status.
