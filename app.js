const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');

const roomRoutes   = require('./routes/roomRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes  = require('./routes/adminRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — explicit origin whitelist ──────────────────────────────────────
// CLIENT_URL can be comma-separated for multiple origins, e.g.:
//   https://ghostnet.netlify.app,http://localhost:5173
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://anonix.netlify.app/',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(o => o.trim()) : []),
];
console.log('[CORS] Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman, Render health checks)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    console.warn('[CORS] Blocked origin:', origin);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Dev request logger ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[REQ] ${req.method} ${req.path}`, req.method !== 'GET' ? req.body : '');
    next();
  });
}

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/rooms',   roomRoutes);
app.use('/api/v1/upload',  uploadRoutes);  // POST /api/v1/upload
app.use('/api/v1/files',   uploadRoutes);  // GET  /api/v1/files/:id (GridFS download)
app.use('/api/v1/admin',   adminRoutes);

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  console.log('[HEALTH] Ping received');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Global error handler ──────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
