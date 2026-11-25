# Setup

1. Install Node.js and npm.
2. Install dependencies at repository root and in each application.
3. Copy each `.env.example` to the local environment file.
4. Set `MONGODB_URI` for MongoDB and use a random `JWT_SECRET` with at least 32 characters in production. No credentials are bundled.
5. Start the backend, dashboard, and mobile app independently.

Configure `CORS_ORIGIN` as a comma-separated allowlist of exact web origins (for example `http://localhost:3000,http://localhost:8081`). Do not use `*` in production. `NEXT_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL` must point to the reachable backend `/api` URL for each client; a physical phone needs the development machine's LAN address rather than `localhost`.

For the dashboard realtime connection, serve the dashboard and backend over compatible origins and allow the dashboard origin in `CORS_ORIGIN`. The dashboard obtains short-lived socket tickets through its same-origin API route; do not expose the backend JWT secret or dashboard session cookies to client code.

The first backend start requires a reachable MongoDB instance. The health endpoint is available only after the Express server starts; startup will stop if MongoDB connection fails.
