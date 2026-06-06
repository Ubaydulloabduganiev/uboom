# Uboom WebRTC

A simple Zoom-style WebRTC meeting app using Node.js, Express, Socket.IO, and WebRTC.

## Correct way to run

Do **not** open `index.html` directly. Do **not** use VS Code Live Server. This app needs the Node server because `/socket.io/socket.io.js` is served by the backend.

```bash
cd uboom-webrtc
npm install
npm start
```

Then open:

```txt
http://localhost:3000
```

To test two users, open the same link in another browser or incognito window.

## If Start Meeting does nothing

You probably opened the HTML file directly. Start the backend with `npm start` and open `http://localhost:3000`.

## Notes

- Works locally on `localhost`.
- For public deployment, use HTTPS.
- For calls across difficult networks, add a TURN server.
