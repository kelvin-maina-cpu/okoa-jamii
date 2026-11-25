import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { autoEscalateStaleIncidents } from './services/incidentService.js';
import { attachRealtimeServer } from './services/realtimeService.js';

const port = Number(process.env.PORT || 5000);

async function start(): Promise<void> {
  await connectDatabase();
  const checkMs = Math.max(15_000, Number(process.env.INCIDENT_ESCALATION_CHECK_INTERVAL_MS || 60_000));
  let escalationRunning = false;
  const escalationTimer = setInterval(async () => {
    if (escalationRunning) return;
    escalationRunning = true;
    try { await autoEscalateStaleIncidents(); }
    catch (error) { console.error('Incident escalation scheduler failed:', error instanceof Error ? error.message : error); }
    finally { escalationRunning = false; }
  }, checkMs);
  escalationTimer.unref();
  const app = createApp();
  const server = http.createServer(app);
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
  const io = new Server(server, { cors: { origin: allowedOrigins } });
  attachRealtimeServer(io);
  server.listen(port, () => console.log(`Okoa Jamii API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Unable to start Okoa Jamii API:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
