// Import required libraries
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

// Set up the Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Get the port from environment variables, with a fallback for local development
const PORT = process.env.PORT || 3000;

// Create the WebSocket server and attach it to the HTTP server
const wss = new WebSocketServer({ server });

// WebSocket connection logic
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send a welcome message to the newly connected client
  ws.send('Welcome to the WebSocket server!');

  // Handle messages from the client
  ws.on('message', (message) => {
    console.log(`Received message => ${message}`);

    // Broadcast the received message to all connected clients
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(`A client said: ${message}`);
      }
    });
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Create a basic HTTP route for Render's health check
app.get('/', (req, res) => {
  res.status(200).send('WebSocket Server is running and healthy.');
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});