const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware untuk parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, etc.)
app.use(express.static(path.join(__dirname)));

// Store connected WebSocket clients
let wsClients = new Set();

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  console.log("✅ WebSocket client connected from:", req.socket.remoteAddress);
  wsClients.add(ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: "welcome",
    message: "Connected to MT5 Ticker Server",
    timestamp: new Date().toISOString()
  }));

  ws.on("message", (message) => {
    try {
      console.log("📥 WebSocket message received:", message.toString());
      
      // Broadcast to all connected WebSocket clients
      broadcastToWebSocketClients(message.toString());
    } catch (error) {
      console.error("❌ Error processing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("❌ WebSocket client disconnected");
    wsClients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    wsClients.delete(ws);
  });
});

// Function to broadcast to all WebSocket clients
function broadcastToWebSocketClients(message) {
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error("❌ Error sending to WebSocket client:", error);
        wsClients.delete(client);
      }
    }
  });
}

// ===== HTTP API ENDPOINTS FOR MT5 EA =====

// Health check endpoint
app.get('/api/status', (req, res) => {
  console.log("💓 Health check requested from:", req.ip);
  
  res.json({
    status: "ok",
    server: "MT5 WebSocket Server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    connected_clients: wsClients.size,
    uptime: process.uptime()
  });
});

// Main ticker data endpoint - This is where MT5 EA sends data
app.post('/api/ticker', (req, res) => {
  try {
    console.log("📡 Ticker data received from MT5 EA:");
    console.log("   Remote IP:", req.ip);
    console.log("   Content-Type:", req.get('Content-Type'));
    console.log("   Body type:", typeof req.body);
    console.log("   Raw body:", req.body);
    
    // Extra validation for body
    if (!req.body) {
      console.error("❌ Empty body received");
      return res.status(400).json({
        error: "Empty request body",
        received: req.body
      });
    }
    
    // Validate received data
    if (!req.body.data || !Array.isArray(req.body.data)) {
      console.error("❌ Invalid data format:", req.body);
      return res.status(400).json({
        error: "Invalid data format",
        expected: "JSON with 'data' array property",
        received: req.body
      });
    }

    // Add server timestamp
    const dataWithTimestamp = {
      ...req.body,
      server_timestamp: new Date().toISOString(),
      server_received: true
    };

    // Broadcast to all connected WebSocket clients (browsers)
    const message = JSON.stringify(dataWithTimestamp);
    console.log("📤 Broadcasting to", wsClients.size, "WebSocket clients");
    
    broadcastToWebSocketClients(message);

    // Send success response to MT5 EA
    res.status(200).json({
      status: "success",
      message: "Data received and broadcasted",
      timestamp: new Date().toISOString(),
      clients_notified: wsClients.size
    });

  } catch (error) {
    console.error("❌ Error processing ticker data:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// Root endpoint - redirect to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    available_endpoints: {
      "GET /": "Main ticker viewer page",
      "GET /api/status": "Server health check",
      "POST /api/ticker": "Submit ticker data (MT5 EA)",
      "WebSocket /": "Real-time data stream"
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Express error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 =================================");
  console.log("🚀 MT5 WebSocket Server is running!");
  console.log("🚀 =================================");
  console.log("📡 Port:", PORT);
  console.log("🌐 HTTP API: http://localhost:" + PORT + "/api/ticker");
  console.log("🔌 WebSocket: ws://localhost:" + PORT);
  console.log("📊 Viewer: http://localhost:" + PORT);
  console.log("💓 Health: http://localhost:" + PORT + "/api/status");
  console.log("🚀 =================================");
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});