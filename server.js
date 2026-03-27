require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const { registerSocketHandlers } = require('./services/socketService');

const PORT        = process.env.PORT       || 5000;

const httpServer = http.createServer(app);

// Socket.io with optional Redis adapter for horizontal scaling
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // No origin = server-to-server, mobile apps — always allow
      if (!origin) return callback(null, true);

      // Strip trailing slash before comparing
      const cleanOrigin = origin.replace(/\/$/, '');

      if (
        cleanOrigin.includes('netlify.app') ||
        cleanOrigin.includes('localhost')
      ) {
        callback(null, true);
      } else {
        console.warn('[Socket.io CORS] Blocked origin:', cleanOrigin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5e6, // 5MB for encrypted payloads
});

// Optional: attach Redis adapter for multi-instance scaling
const attachRedisAdapter = async () => {
  try {
    const { createClient } = require('redis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    if (process.env.REDIS_URL) {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.io] Redis adapter attached.');
    }
  } catch (e) {
    console.warn('[Socket.io] Redis adapter skipped:', e.message);
  }
};

registerSocketHandlers(io);

const start = async () => {
  await connectDB();
  await connectRedis();
  await attachRedisAdapter();

  httpServer.listen(PORT, () => {
    console.log(`[SERVER] GhostNet running → http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

process.on('SIGTERM', () => {
  console.log('[SERVER] Graceful shutdown…');
  httpServer.close(() => process.exit(0));
});

start();
