import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8080;
const DIST_DIR = path.join(__dirname, 'dist');

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // Parse URL and remove query string
  let filePath = req.url.split('?')[0];
  
  // Handle root path
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Construct full file path
  const fullPath = path.join(DIST_DIR, filePath);
  
  // Check if file exists
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      // File doesn't exist - serve index.html for SPA routing (except for API routes)
      if (!filePath.startsWith('/api/')) {
        const headers = {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        };
        
        // Add security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        res.writeHead(200, headers);
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.end(data);
          }
        });
      } else {
        // API route not found
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API route not found' }));
      }
      return;
    }

    // Get file extension for MIME type
    const extname = path.extname(fullPath).toLowerCase();
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    // Special handling for JavaScript modules
    if (extname === '.js' || extname === '.mjs') {
      contentType = 'application/javascript; charset=utf-8';
      // Add module-specific headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // CORS headers for development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else {
      // Set content type for other files
      res.setHeader('Content-Type', contentType);
    }

    // Read and serve the file
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Internal server error');
        return;
      }
      
      // Only set content-type if not already set above
      if (extname !== '.js' && extname !== '.mjs') {
        res.writeHead(200, { 'Content-Type': contentType });
      } else {
        res.writeHead(200);
      }
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving files from: ${DIST_DIR}`);
});