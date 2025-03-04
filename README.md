# SketchSpace

A real-time collaborative whiteboard application that allows multiple users to draw together.

## Features

- Real-time drawing with Socket.IO
- Pen and eraser tools with adjustable thickness
- Color selection for drawing
- Built-in grid for better alignment
- Clear canvas functionality
- Persistent drawings with MongoDB
- Mobile-friendly touch support

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Real-time Communication**: Socket.IO

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB

### Installation

1. Clone the repository
```bash
git clone https://github.com/Armaaneee/SketchSpace.git
cd SketchSpace
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:
```
MONGO_URI=MONGO_URL
```

4. Start the server
```bash
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Keyboard Shortcuts

- **P**: Select Pen tool
- **E**: Select Eraser tool
- **C**: Clear canvas (with confirmation)

## License

MIT

## Author

Armaan Johar
