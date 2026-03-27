const mongoose   = require('mongoose');
const multer     = require('multer');
const { Readable } = require('stream');

const ALLOWED_TYPES = [
  'image/', 'video/', 'audio/',
  'application/pdf', 'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'text/plain',
];

// In-memory storage — buffer flows straight into GridFS, no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_TYPES.some(t => file.mimetype.startsWith(t));
    cb(ok ? null : new Error('File type not allowed.'), ok);
  },
});

/**
 * Derive message type from MIME type.
 */
const mimeToType = (mime) => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
};

/**
 * POST /api/v1/upload
 * Upload a file — stored in MongoDB GridFS.
 * Returns: { fileId, fileUrl, fileName, fileSize, type }
 */
const uploadFile = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file provided.' });

      const db     = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });

      // Write buffer to GridFS
      const readable = Readable.from(req.file.buffer);
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: { originalName: req.file.originalname },
      });

      readable.pipe(uploadStream);

      uploadStream.on('error', (err) => next(err));
      uploadStream.on('finish', () => {
        const fileId  = uploadStream.id.toString();
        const fileUrl = `/api/v1/files/${fileId}`;
        res.status(201).json({
          fileId,
          fileUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          type:     mimeToType(req.file.mimetype),
        });
      });
    } catch (err) {
      next(err);
    }
  },
];

/**
 * GET /api/v1/files/:id
 * Stream a file from GridFS by its ObjectId.
 */
const downloadFile = async (req, res, next) => {
  try {
    const db     = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
    const fileId = new mongoose.Types.ObjectId(req.params.id);

    // Fetch file metadata for Content-Type header
    const [file] = await bucket.find({ _id: fileId }).toArray();
    if (!file) return res.status(404).json({ message: 'File not found.' });

    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    res.set('Cache-Control', 'public, max-age=86400'); // 1-day browser cache

    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.on('error', () => res.status(404).json({ message: 'File not found.' }));
    downloadStream.pipe(res);
  } catch (err) {
    // Invalid ObjectId format
    if (err.name === 'BSONError' || err.message.includes('ObjectId')) {
      return res.status(400).json({ message: 'Invalid file ID.' });
    }
    next(err);
  }
};

module.exports = { uploadFile, downloadFile };
