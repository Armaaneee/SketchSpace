require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

// Initialize express and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize socket.io with proper CORS and production settings
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://sketchspace.vercel.app'] 
      : "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io'
});

// MongoDB URI from environment variables with fallback
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sketchspace';

// Configure Mongoose for production
mongoose.set('strictQuery', false);
mongoose.set('bufferCommands', false);

// Connect to MongoDB with production-ready options
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  compressors: 'zlib'
})
.then(() => { 
  console.log('Connected to MongoDB');
})
.catch((err) => {
  console.error('Error connecting to MongoDB:', err);
  // In production, we might want to keep the server running even if DB fails
  if (process.env.NODE_ENV === 'production') {
    console.log('Running in production without DB connection');
  } else {
    process.exit(1);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  if (err.name === 'MongooseServerSelectionError') {
    console.log('Attempting to reconnect to MongoDB...');
    // Attempt reconnection
    setTimeout(() => {
      mongoose.connect(MONGO_URI).catch(err => console.error('Reconnection failed:', err));
    }, 5000);
  }
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});
  
// Define the drawing schema for MongoDB
const drawingSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  lastX: Number,
  lastY: Number,
  penColor: String,  // Store pen color
  penThickness: Number,  // Store pen thickness
  isEraser: Boolean, // Store if it was drawn with an eraser
  eraserThickness: Number, // Store eraser thickness
  timestamp: { type: Date, default: Date.now },
});

// Create the model for the "Whiteboard" collection in the SketchSpace database
const Drawing = mongoose.model('Whiteboard', drawingSchema, 'Whiteboard');

// Serve static files (e.g., index.html, JS, CSS)
app.use(express.static('public'));

// Socket.io connection event
io.on('connection', (socket) => {

  // Send immediate confirmation to client
  socket.emit('connectionConfirmed', { message: 'You are connected to the server' });

  // Fetch drawings with a timeout and error handling
  const fetchDrawings = async () => {
    try {
      if (mongoose.connection.readyState !== 1) {
        socket.emit('error', { message: 'Database not connected. Please try again later.' });
        return;
      }
      
      const drawings = await Drawing.find().sort('timestamp').limit(1000).exec();
      socket.emit('loadDrawing', drawings);
    } catch (err) {
      console.error('Error fetching drawings:', err);
      socket.emit('error', { message: 'Failed to load drawings from database' });
    }
  };

  // Initial data load with retry mechanism
  const attemptDataLoad = (retries = 3, delay = 2000) => {
    fetchDrawings().catch(err => {
      console.error(`Fetch attempt failed (${retries} retries left):`, err);
      if (retries > 0) {
        setTimeout(() => attemptDataLoad(retries - 1, delay * 1.5), delay);
      } else {
        socket.emit('error', { message: 'Failed to load initial data after multiple attempts' });
      }
    });
  };
  
  // Try to load data immediately
  attemptDataLoad();

  // Handle request for drawings specifically
  socket.on('requestDrawings', () => {
    fetchDrawings();
  });

  // Listen for drawing events and save the new drawings to the database
  socket.on('draw', (data) => {
    // Validate data before processing
    if (!data || typeof data !== 'object' || !data.hasOwnProperty('x') || !data.hasOwnProperty('y')) {
      console.error('Invalid drawing data received');
      return;
    }

    // Create a new drawing document
    const newDrawing = new Drawing(data);

    // Save drawing to the database
    newDrawing.save()
      .then(() => {
        // Broadcast to ALL other clients
        socket.broadcast.emit('draw', data);
      })
      .catch((err) => {
        console.error('Error saving drawing to database:', err.message);
        socket.emit('error', { message: 'Failed to save your drawing' });
      });
  });

  // Handle canvas clearing
  socket.on('clearCanvas', () => {
    // Delete all drawings from the database
    Drawing.deleteMany({})
      .then((result) => {
        console.log('Canvas cleared in database. Deleted documents:', result.deletedCount);
        io.emit('clearCanvas'); // Broadcast the clear command to ALL clients, including the sender
      })
      .catch((err) => {
        console.error('Error clearing canvas in database:', err.message);
        socket.emit('error', { message: 'Failed to clear canvas' });
      });
  });

  // Handle disconnects with minimal logging
  socket.on('disconnect', () => {
    
  });

  // Handle explicit ping-pong to check connection
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'][dbStatus];
  
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
    database: dbStatusText,
    uptime: process.uptime()
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
