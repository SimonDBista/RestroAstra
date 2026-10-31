// Force Nepal Standard Time (NPT: UTC+5:45) exclusively for this project
process.env.TZ = 'Asia/Kathmandu';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3005', 10);

console.log(`> Starting RestroAstra server (${dev ? 'development' : 'production'})...`);

const app = next({ dev, hostname: dev ? 'localhost' : hostname, port });
const handle = app.getRequestHandler();

const MIME_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

app.prepare().then(() => {
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Directly serve /uploads/ from disk so runtime uploads are never 404'd by Next.js
      if (pathname && (pathname.startsWith('/uploads/') || pathname === '/uploads')) {
        const relativeFile = pathname.replace(/^\/uploads\/?/, '');
        const targetPath = path.resolve(uploadsDir, relativeFile);

        // Security check: ensure target stays inside uploadsDir
        if (targetPath.startsWith(uploadsDir) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
          const ext = path.extname(targetPath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          const stream = fs.createReadStream(targetPath);
          stream.pipe(res);
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Attach Socket.io server
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/api/socketio',
  });

  // Make io globally accessible to Next.js API routes
  global.io = io;

  io.on('connection', (socket) => {
    // Hotel dashboard joins hotel room for verified order and chat alerts
    socket.on('join_hotel', (hotelId) => {
      if (typeof hotelId === 'string' && hotelId.trim()) {
        socket.join(`hotel_${hotelId.trim()}`);
      }
    });

    // Customer or staff joins order-specific room for live order chat & tracking
    socket.on('join_order', (orderId) => {
      if (typeof orderId === 'string' && orderId.trim()) {
        socket.join(`order_${orderId.trim()}`);
      }
    });

    // Customer or staff joins table-specific room for live table chat
    socket.on('join_table', (data) => {
      if (typeof data === 'string' && data.trim()) {
        socket.join(`table_${data.trim()}`);
      } else if (data && data.hotelId && data.tableNumber) {
        socket.join(`table_${String(data.hotelId).trim()}_${String(data.tableNumber).trim()}`);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> RestroAstra ready on:`);
    console.log(`  - Local:   http://localhost:${port}`);
    console.log(`  - Network: http://127.0.0.1:${port}`);
    console.log(`> Socket.io listening on path /api/socketio`);
  });
});
