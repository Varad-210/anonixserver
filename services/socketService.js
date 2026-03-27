const {
  addUserToRoom,
  removeUserFromRoom,
  saveMessage,
  getRoomHistory,
  findRoom,
  validateRoomPassword,
} = require('./roomService');

/**
 * In-memory map: socketId → { roomCode, username, sessionId }
 * For horizontal scaling, this would move to Redis.
 */
const socketRoomMap = new Map();

/**
 * In-memory WebRTC call states per room: roomCode → Set<socketId>
 */
const activeCallSockets = new Map();

const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // ─────────────────────────────────────────
    // JOIN ROOM
    // ─────────────────────────────────────────
    socket.on('room:join', async ({ roomCode, username, sessionId, password }) => {
      try {
        const room = await findRoom(roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room not found or expired.' });
          return;
        }

        // Password gate
        const valid = await validateRoomPassword(room, password);
        if (!valid) {
          socket.emit('error', { message: 'Incorrect room password.' });
          return;
        }

        // User capacity check
        if (room.activeUsers.length >= room.maxUsers) {
          socket.emit('error', { message: 'Room is full.' });
          return;
        }

        // Leave previous room if rejoining
        const prev = socketRoomMap.get(socket.id);
        if (prev) {
          socket.leave(prev.roomCode);
          await removeUserFromRoom(prev.roomCode, prev.sessionId);
          // Leave any active call
          const callSocks = activeCallSockets.get(prev.roomCode);
          if (callSocks) callSocks.delete(socket.id);
        }

        // Join Socket.io room
        socket.join(roomCode);
        socketRoomMap.set(socket.id, { roomCode, username, sessionId });

        // Persist user
        await addUserToRoom(roomCode, sessionId, username);

        // Send history
        const history = await getRoomHistory(roomCode, 50);
        socket.emit('room:history', {
          messages: history.reverse(),
          selfDestruct: room.selfDestruct,
          selfDestructAfter: room.selfDestructAfter,
        });

        // System join message
        const systemMsg = await saveMessage({
          roomCode,
          sessionId,
          username,
          content: `${username} has entered the void.`,
          type: 'system',
        });
        io.to(roomCode).emit('room:system', { message: systemMsg });

        // Broadcast updated users
        const updatedRoom = await findRoom(roomCode);
        io.to(roomCode).emit('room:users', { users: updatedRoom?.activeUsers || [] });

        console.log(`[WS] ${username} joined room ${roomCode}`);
      } catch (err) {
        console.error('[WS] room:join error:', err.message);
        socket.emit('error', { message: 'Failed to join room.' });
      }
    });

    // ─────────────────────────────────────────
    // SEND MESSAGE (text or media)
    // ─────────────────────────────────────────
    socket.on('message:send', async ({ content, type = 'text', fileUrl, fileName, fileSize }) => {
      try {
        const ctx = socketRoomMap.get(socket.id);
        if (!ctx) { socket.emit('error', { message: 'Not in a room.' }); return; }

        const trimmed = content?.trim();
        // 5MB limit to handle AES-encrypted + base64-encoded payloads
        if (!trimmed || trimmed.length > 5_000_000) {
          socket.emit('error', { message: 'Invalid message or payload too large.' });
          return;
        }

        const message = await saveMessage({
          roomCode: ctx.roomCode,
          sessionId: ctx.sessionId,
          username: ctx.username,
          content: trimmed,
          type,
          fileUrl,
          fileName,
          fileSize,
        });

        io.to(ctx.roomCode).emit('message:receive', { message });

        // Emit 'delivered' status back to sender after broadcast
        socket.emit('message:status:update', {
          messageId: message._id,
          status: 'delivered',
        });
      } catch (err) {
        console.error('[WS] message:send error:', err.message);
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // ─────────────────────────────────────────
    // MESSAGE READ STATUS
    // ─────────────────────────────────────────
    socket.on('message:status', ({ messageId, status }) => {
      const ctx = socketRoomMap.get(socket.id);
      if (!ctx) return;
      socket.to(ctx.roomCode).emit('message:status:update', {
        messageId,
        status,
        userId: ctx.sessionId,
      });
    });

    // ─────────────────────────────────────────
    // SELF-DESTRUCT ACKNOWLEDGEMENT
    // ─────────────────────────────────────────
    socket.on('message:destruct', ({ messageId }) => {
      const ctx = socketRoomMap.get(socket.id);
      if (!ctx) return;
      // Broadcast destruction to all in room so everyone hides the message
      io.to(ctx.roomCode).emit('message:destroyed', { messageId });
    });

    // ─────────────────────────────────────────
    // TYPING INDICATOR
    // ─────────────────────────────────────────
    socket.on('typing:start', () => {
      const ctx = socketRoomMap.get(socket.id);
      if (ctx) socket.to(ctx.roomCode).emit('typing:update', { username: ctx.username, isTyping: true });
    });

    socket.on('typing:stop', () => {
      const ctx = socketRoomMap.get(socket.id);
      if (ctx) socket.to(ctx.roomCode).emit('typing:update', { username: ctx.username, isTyping: false });
    });

    // ─────────────────────────────────────────
    // WEBRTC SIGNALING (Voice & Video)
    // ─────────────────────────────────────────
    socket.on('webrtc:call', ({ callType = 'audio' }) => {
      const ctx = socketRoomMap.get(socket.id);
      if (!ctx) return;
      if (!activeCallSockets.has(ctx.roomCode)) activeCallSockets.set(ctx.roomCode, new Set());
      activeCallSockets.get(ctx.roomCode).add(socket.id);
      socket.to(ctx.roomCode).emit('webrtc:call', {
        from: socket.id,
        username: ctx.username,
        callType,
      });
    });

    socket.on('webrtc:offer', ({ offer, to }) => {
      io.to(to).emit('webrtc:offer', { offer, from: socket.id });
    });

    socket.on('webrtc:answer', ({ answer, to }) => {
      io.to(to).emit('webrtc:answer', { answer, from: socket.id });
    });

    socket.on('webrtc:ice', ({ candidate, to }) => {
      io.to(to).emit('webrtc:ice', { candidate, from: socket.id });
    });

    socket.on('webrtc:hangup', () => {
      const ctx = socketRoomMap.get(socket.id);
      if (!ctx) return;
      const callSocks = activeCallSockets.get(ctx.roomCode);
      if (callSocks) callSocks.delete(socket.id);
      socket.to(ctx.roomCode).emit('webrtc:hangup', { from: socket.id, username: ctx.username });
    });

    // ─────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        const ctx = socketRoomMap.get(socket.id);
        if (ctx) {
          await removeUserFromRoom(ctx.roomCode, ctx.sessionId);
          const systemMsg = await saveMessage({
            roomCode: ctx.roomCode,
            sessionId: ctx.sessionId,
            username: ctx.username,
            content: `${ctx.username} has left the void.`,
            type: 'system',
          });
          io.to(ctx.roomCode).emit('room:system', { message: systemMsg });

          const updatedRoom = await findRoom(ctx.roomCode);
          io.to(ctx.roomCode).emit('room:users', { users: updatedRoom?.activeUsers || [] });

          // End any ongoing call
          const callSocks = activeCallSockets.get(ctx.roomCode);
          if (callSocks?.has(socket.id)) {
            callSocks.delete(socket.id);
            socket.to(ctx.roomCode).emit('webrtc:hangup', { from: socket.id, username: ctx.username });
          }

          socketRoomMap.delete(socket.id);
          console.log(`[WS] ${ctx.username} disconnected from ${ctx.roomCode}`);
        }
      } catch (err) {
        console.error('[WS] disconnect error:', err.message);
      }
    });
  });
};

module.exports = { registerSocketHandlers };
