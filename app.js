const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');

const roomRoutes   = require('./routes/roomRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes  = require('./routes/adminRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ── Trust proxy (required for Render, Heroku, etc.) ──────────────────────
// This allows express-rate-limit to correctly identify users behind proxies
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin file access
  contentSecurityPolicy: false, // Disable CSP to allow inline media
}));

// ── CORS — production-safe pattern matching ──────────────────────────────
// ✅ Allows: any *.netlify.app subdomain + localhost (any port)
// ✅ Strips trailing slashes so 'https://anonix.netlify.app/' also passes
// ✅ credentials:true is kept (incompatible with origin:'*', so we use a fn)
app.use(cors({
  origin: (origin, callback) => {
    // No origin = server-to-server, curl, Postman, mobile apps — always allow
    if (!origin) return callback(null, true);

    // Strip trailing slash before comparing
    const cleanOrigin = origin.replace(/\/$/, '');

    if (
      cleanOrigin.includes('netlify.app') ||
      cleanOrigin.includes('localhost')
    ) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', cleanOrigin);
      callback(new Error('Not allowed by CORS'));
    }
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
