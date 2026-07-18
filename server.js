const express = require("express");
const http = require("http");
const path = require("path");
const os = require("os");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

/*
  URL ROUTES

  https://uboom.uz                 -> landing page
  https://uboom.uz/meet            -> meeting app
  https://uboom.uz/meet?room=abc   -> specific meeting room

  Old /app links will redirect to /meet.
*/

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landingpage.html"));
});

app.get("/meet", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "meet.html"));
});

app.get("/app", (req, res) => {
  const room = req.query.room;

  if (room) {
    return res.redirect(301, `/meet?room=${encodeURIComponent(room)}`);
  }

  return res.redirect(301, "/meet");
});

/*
  Static files must stay AFTER the custom routes above.
*/
app.use(express.static(path.join(__dirname, "public")));

function getLocalNetworkUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }

  return urls;
}

app.get("/config", (req, res) => {
  res.json({
    networkUrls: getLocalNetworkUrls(PORT)
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size
  });
});

function getRoomUsers(roomId) {
  return Array.from(rooms.get(roomId)?.values() || []);
}

function removeUser(socket) {
  const { roomId } = socket.data;

  if (!roomId || !rooms.has(roomId)) return;

  const room = rooms.get(roomId);
  room.delete(socket.id);

  socket.to(roomId).emit("user-left", {
    socketId: socket.id
  });

  io.to(roomId).emit("participants-updated", getRoomUsers(roomId));

  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

io.on("connection", socket => {
  socket.on("join-room", ({ roomId, userName }) => {
    if (!roomId) return;

    const cleanName =
      String(userName || "Guest").trim().slice(0, 40) || "Guest";

    socket.data.roomId = roomId;
    socket.data.userName = cleanName;
    socket.data.micOn = true;
    socket.data.cameraOn = true;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    const existingUsers = Array.from(room.values());

    room.set(socket.id, {
      socketId: socket.id,
      userName: cleanName,
      micOn: true,
      cameraOn: true
    });

    socket.join(roomId);

    socket.emit("existing-users", existingUsers);

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userName: cleanName,
      micOn: true,
      cameraOn: true
    });

    io.to(roomId).emit("participants-updated", getRoomUsers(roomId));
  });

  socket.on("offer", ({ targetSocketId, offer }) => {
    socket.to(targetSocketId).emit("offer", {
      fromSocketId: socket.id,
      userName: socket.data.userName,
      offer
    });
  });

  socket.on("answer", ({ targetSocketId, answer }) => {
    socket.to(targetSocketId).emit("answer", {
      fromSocketId: socket.id,
      answer
    });
  });

  socket.on("ice-candidate", ({ targetSocketId, candidate }) => {
    socket.to(targetSocketId).emit("ice-candidate", {
      fromSocketId: socket.id,
      candidate
    });
  });

  socket.on("chat-message", ({ roomId, text }) => {
    const cleanText = String(text || "").trim().slice(0, 1000);

    if (!roomId || !cleanText) return;

    io.to(roomId).emit("chat-message", {
      socketId: socket.id,
      userName: socket.data.userName || "Guest",
      text: cleanText,
      time: new Date().toISOString()
    });
  });

  socket.on("media-state", ({ micOn, cameraOn }) => {
    const roomId = socket.data.roomId;

    if (!roomId || !rooms.has(roomId)) return;

    socket.data.micOn = Boolean(micOn);
    socket.data.cameraOn = Boolean(cameraOn);

    const room = rooms.get(roomId);
    const user = room.get(socket.id);

    if (user) {
      user.micOn = socket.data.micOn;
      user.cameraOn = socket.data.cameraOn;
    }

    socket.to(roomId).emit("media-state", {
      socketId: socket.id,
      micOn: socket.data.micOn,
      cameraOn: socket.data.cameraOn
    });

    io.to(roomId).emit("participants-updated", getRoomUsers(roomId));
  });

  socket.on("disconnect", () => {
    removeUser(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Uboom is running on port ${PORT}`);
});
