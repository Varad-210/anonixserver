const express  = require('express');
const router   = express.Router();
const { uploadFile, downloadFile } = require('../controllers/uploadController');

// Upload a file → stored in MongoDB GridFS
router.post('/', uploadFile);

// Stream / download a stored file by GridFS ObjectId
router.get('/:id', downloadFile);

module.exports = router;
