const express   = require('express');
const router    = express.Router();
const adminAuth = require('../middlewares/adminAuth');
const {
  adminLogin, getStats, listRooms, deleteRoom, listMessages, deleteMessage
} = require('../controllers/adminController');

router.post('/login',          adminLogin);
router.get('/stats',           adminAuth, getStats);
router.get('/rooms',           adminAuth, listRooms);
router.delete('/rooms/:code',  adminAuth, deleteRoom);
router.get('/messages',        adminAuth, listMessages);
router.delete('/messages/:id', adminAuth, deleteMessage);

module.exports = router;
