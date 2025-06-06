// Import required libraries
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

// Set up the Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Get the port from environment variables - Render sets this
const PORT = process.env.PORT || 8080;

// Create the WebSocket server attached to the HTTP server
const wss = new WebSocketServer({ 
  server,
  // Important: disable perMessageDeflate for MT5 compatibility
  perMessageDeflate: false
});

// Store connected clients
const clients = new Set();

// WebSocket connection logic
wss.on('connection', (ws, request) => {
  console.log('MT5 client connected from:', request.socket.remoteAddress);
  clients.add(ws);

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString()
  }));

  // Handle messages from MT5
  ws.on('message', (message) => {
    try {
      // Convert buffer to string
      const messageStr = message.toString();
      console.log('Received from MT5:', messageStr);

      // Parse the JSON message
      const data = JSON.parse(messageStr);
      
      // Log the price update
      if (data.data && data.data[0]) {
        const priceData = data.data[0];
        console.log(`${priceData.symbol}: Bid=${priceData.bid}, Ask=${priceData.ask}`);
      }

      // Broadcast to all other connected clients (if you have Flutter apps connected)
      clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      });

    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle ping/pong for keeping connection alive
  ws.on('ping', () => {
    ws.pong();
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('MT5 client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Health check endpoint for Render
app.get('/', (req, res) => {
  const status = {
    status: 'healthy',
    websocket_clients: clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
  res.json(status);
});

// Additional endpoint to test WebSocket URL
app.get('/ws-info', (req, res) => {
  res.json({
    websocket_url: `wss://${req.hostname}`,
    note: 'Connect to this URL using WebSocket protocol'
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket server is listening on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/`);
});
