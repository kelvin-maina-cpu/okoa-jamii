import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';

const port = Number(process.env.PORT || 5000);

async function start(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000' } });
  io.on('connection', (socket) => socket.emit('connected', { service: 'Okoa Jamii' }));
  server.listen(port, () => console.log(`Okoa Jamii API listening on http://localhost:${port}`));
}

start().catch((error) => {
  console.error('Unable to start Okoa Jamii API:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
