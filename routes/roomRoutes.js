const express = require('express');
const router  = express.Router();
const { createRoomHandler, joinRoomHandler, getRoomHandler, getRoomMessagesHandler } = require('../controllers/roomController');

router.post('/',           createRoomHandler);
router.get('/:code',       getRoomHandler);
router.post('/:code/join', joinRoomHandler);
router.get('/:code/messages', getRoomMessagesHandler);

module.exports = router;
