# Setup

1. Install Node.js and npm.
2. Install dependencies at repository root and in each application.
3. Copy each `.env.example` to the local environment file.
4. Set `MONGODB_URI` for MongoDB. No credential is assumed or bundled.
5. Start the backend, dashboard, and mobile app independently.

The first backend start requires a reachable MongoDB instance. The health endpoint is available only after the Express server starts; startup will stop if MongoDB connection fails.
