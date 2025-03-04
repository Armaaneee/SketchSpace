// Socket initialization with improved reconnection settings and error handling
const socket = io({
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

// Add connection status monitoring with ping/pong
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus('Connected', 'Socket connection established');
  }
  
  // Start ping-pong to verify connection is working
  startPingInterval();
  
  // Request drawings after connection is established
  setTimeout(() => {
    redrawFromServer();
  }, 1000);
});

socket.on('connectionConfirmed', (data) => {
  console.log('Server confirmed connection:', data.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server. Reason:', reason);
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus('Disconnected', 'Socket connection lost: ' + reason);
  }
  
  // Clear ping interval on disconnect
  stopPingInterval();
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus('Error', 'Connection error: ' + error.message);
  }
});

socket.on('error', (data) => {
  console.error('Server error:', data.message);
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus('Error', data.message);
  }
  
  // Show error to user
  alert(`Error: ${data.message}`);
});

// Ping-pong mechanism to check connection health
let pingInterval;
function startPingInterval() {
  // Clear any existing interval
  stopPingInterval();
  
  // Start a new ping every 5 seconds
  pingInterval = setInterval(() => {
    if (socket.connected) {
      const start = Date.now();
      socket.emit('ping');
      socket.once('pong', () => {
        const latency = Date.now() - start;
        console.log(`Connection is healthy. Latency: ${latency}ms`);
      });
    }
  }, 5000);
}

function stopPingInterval() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

// Canvas Setup
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

let lastX = null;
let lastY = null;
let drawing = false;
let penColor = '#000000';
let penThickness = 5;
let eraserThickness = 20;
let isEraser = false;

// Update canvas size to fill the window
function resizeCanvas() {
  canvas.width = window.innerWidth - 70;  // Adjust for new sidebar width of 70px
  canvas.height = window.innerHeight;
  // Redraw canvas after resize if necessary (for saved drawings)
  redrawFromServer();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Tool buttons
const penButton = document.getElementById('pen-button');
const eraserButton = document.getElementById('eraser-button');
const clearButton = document.getElementById('clear-button');
const thicknessSlider = document.getElementById('thickness-slider');
const thicknessValue = document.getElementById('thickness-value');
const thicknessDot = document.getElementById('thickness-dot');
const thicknessPreview = document.querySelector('.thickness-preview');
const thicknessPopup = document.querySelector('.thickness-popup');
const infoButton = document.getElementById('info-button');
const infoModal = document.getElementById('info-modal');
const closeButton = document.querySelector('.close-button');
const eraserThicknessSlider = document.getElementById('eraser-thickness-slider');
const eraserThicknessValue = document.getElementById('eraser-thickness-value');
const eraserThicknessDot = document.getElementById('eraser-thickness-dot');
const eraserThicknessPreview = document.querySelector('.eraser-thickness-preview');
const eraserThicknessPopup = document.querySelector('.eraser-thickness-popup');

// Set initial thickness dot size
updateThicknessDot(penThickness);
updateEraserThicknessDot(eraserThickness);

// Toggle thickness popup when clicking on the preview
thicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent event from propagating to document
  thicknessPopup.classList.toggle('show');
  eraserThicknessPopup.classList.remove('show'); // Hide eraser popup if open
});

// Toggle eraser thickness popup when clicking on its preview
eraserThicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation(); // Prevent event from propagating to document
  eraserThicknessPopup.classList.toggle('show');
  thicknessPopup.classList.remove('show'); // Hide pen popup if open
});

// Keep popups open when interacting with the sliders
thicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

eraserThicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Close popups when clicking elsewhere on the document
document.addEventListener('click', () => {
  thicknessPopup.classList.remove('show');
  eraserThicknessPopup.classList.remove('show');
});

// Pen/eraser mode toggle
penButton.addEventListener('click', () => {
  isEraser = false;
  penButton.classList.add('active');
  eraserButton.classList.remove('active');
});

eraserButton.addEventListener('click', () => {
  isEraser = true;
  eraserButton.classList.add('active');
  penButton.classList.remove('active');
});

// Clear canvas functionality
clearButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the entire canvas?')) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clearCanvas');
  }
});

// Color control
document.getElementById('color-picker').addEventListener('input', (e) => {
  penColor = e.target.value;
});

// Thickness control for pen
thicknessSlider.addEventListener('input', (e) => {
  penThickness = parseInt(e.target.value);
  thicknessValue.textContent = penThickness + 'px';
  updateThicknessDot(penThickness);
});

// Thickness control for eraser
eraserThicknessSlider.addEventListener('input', (e) => {
  eraserThickness = parseInt(e.target.value);
  eraserThicknessValue.textContent = eraserThickness + 'px';
  updateEraserThicknessDot(eraserThickness);
});

// Info modal
infoButton.addEventListener('click', () => {
  infoModal.style.display = 'flex';
});

closeButton.addEventListener('click', () => {
  infoModal.style.display = 'none';
});

// Close the modal if the user clicks outside of it
window.addEventListener('click', (e) => {
  if (e.target === infoModal) {
    infoModal.style.display = 'none';
  }
});

// Update thickness dot size
function updateThicknessDot(size) {
  const scaledSize = Math.max(4, Math.min(size * 0.8, 18));
  thicknessDot.style.width = scaledSize + 'px';
  thicknessDot.style.height = scaledSize + 'px';
}

// Update eraser thickness dot size
function updateEraserThicknessDot(size) {
  const scaledSize = Math.max(4, Math.min(size * 0.6, 20));
  eraserThicknessDot.style.width = scaledSize + 'px';
  eraserThicknessDot.style.height = scaledSize + 'px';
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    penButton.click();
  } else if (e.key === 'e' || e.key === 'E') {
    eraserButton.click();
  } else if (e.key === 'c' || e.key === 'C') {
    clearButton.click();
  }
});

// Drawing functionality
function startDrawing(x, y) {
  drawing = true; // Make sure we set drawing to true
  lastX = x;
  lastY = y;
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  // Set proper globalCompositeOperation based on tool
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }
  
  // Set line properties here to ensure they're applied correctly
  ctx.lineWidth = isEraser ? eraserThickness : penThickness;
  ctx.lineCap = 'round';
  ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : penColor;
  
  // Draw a point at the start position
  ctx.arc(x, y, 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function draw(x, y) {
  if (!drawing) return; // Guard clause for safety
  
  if (lastX === null || lastY === null) {
    startDrawing(x, y);
    return;
  }

  ctx.lineWidth = isEraser ? eraserThickness : penThickness;
  ctx.lineCap = 'round';
  
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
  }

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  
  // Send data to server
  socket.emit('draw', { 
    x, y, lastX, lastY, 
    penColor: isEraser ? 'eraser' : penColor,
    penThickness: isEraser ? eraserThickness : penThickness,
    isEraser 
  });

  lastX = x;
  lastY = y;
}

// Function to redraw canvas from server data - with retry mechanism
function redrawFromServer() {
  console.log('Requesting drawings from server...');
  socket.emit('requestDrawings');
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  console.log('Mouse down at:', e.offsetX, e.offsetY);
  drawing = true;
  startDrawing(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
  if (drawing) {
    draw(e.offsetX, e.offsetY);
  }
});

canvas.addEventListener('mouseup', () => {
  drawing = false;
  lastX = null;
  lastY = null;
});

canvas.addEventListener('mouseout', () => {
  drawing = false;
  lastX = null;
  lastY = null;
});

// Touch events for mobile devices
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  drawing = true;
  startDrawing(touch.pageX - canvas.offsetLeft, touch.pageY - canvas.offsetTop);
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (drawing) {
    const touch = e.touches[0];
    draw(touch.pageX - canvas.offsetLeft, touch.pageY - canvas.offsetTop);
  }
});

canvas.addEventListener('touchend', () => {
  drawing = false;
  lastX = null;
  lastY = null;
});

// Listen for incoming drawing data from other users with better error handling
socket.on('draw', (data) => {
  if (!data || !data.hasOwnProperty('x') || !data.hasOwnProperty('y') || 
      !data.hasOwnProperty('lastX') || !data.hasOwnProperty('lastY')) {
    console.error('Received invalid drawing data:', data);
    return;
  }
  
  console.log('Received drawing from another user');
  
  ctx.lineWidth = data.penThickness;
  ctx.lineCap = 'round';
  
  if (data.isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter in erase mode
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = data.penColor;
  }

  ctx.beginPath();
  ctx.moveTo(data.lastX, data.lastY);
  ctx.lineTo(data.x, data.y);
  ctx.stroke();
});

// Clear canvas command from another user
socket.on('clearCanvas', () => {
  console.log('Received clear canvas command from server');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Load previous drawings from database on initial load
socket.on('loadDrawing', (drawings) => {
  console.log(`Received ${drawings.length} drawings from server`);
  
  // Clear the canvas before loading drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw each stroke in order
  drawings.forEach((drawing) => {
    ctx.lineWidth = drawing.penThickness;
    ctx.lineCap = 'round';
    
    if (drawing.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter in erase mode
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawing.penColor;
    }

    ctx.beginPath();
    ctx.moveTo(drawing.lastX, drawing.lastY);
    ctx.lineTo(drawing.x, drawing.y);
    ctx.stroke();
  });
  
  // Reset to default drawing mode after loading drawings
  ctx.globalCompositeOperation = 'source-over';
  
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus('Connected', `Loaded ${drawings.length} drawings`);
  }
});
