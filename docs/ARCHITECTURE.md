# Architecture

- Mobile: Expo React Native, TypeScript, Expo SQLite for queued reports, Expo Location for GPS.
- Dashboard: Next.js, TypeScript, Tailwind CSS, Leaflet, Recharts, Socket.IO client.
- Backend: Express, TypeScript, Mongoose, MongoDB Atlas-compatible connection, Socket.IO.

External SMS, push, and evidence providers are expected to implement provider interfaces. The MVP must not claim delivery or dispatch until a provider is configured and tested.
