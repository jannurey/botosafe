/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const { createServer: createHttpsServer } = require("https");
const next = require("next");
const { parse } = require("url");
const fs = require("fs");

// Memory monitoring
require('./scripts/memory-monitor');

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Set memory limits for the server
require('v8').setFlagsFromString('--max-old-space-size=4096');

// Check if SSL certificates exist for HTTPS
const sslOptions = {
  key: fs.existsSync("./localhost+2-key.pem") ? fs.readFileSync("./localhost+2-key.pem") : null,
  cert: fs.existsSync("./localhost+2.pem") ? fs.readFileSync("./localhost+2.pem") : null,
};

app.prepare().then(() => {
  if (sslOptions.key && sslOptions.cert) {
    // Create HTTPS server if certificates are available
    createHttpsServer(sslOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, "0.0.0.0", (err) => {
      if (err) throw err;
      console.log(`> Ready on https://localhost:${port}`);
      console.log(`> Ready on https://10.236.18.99:${port} (Network)`);
    });
  } else {
    // Fallback to HTTP server if no certificates found
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, "0.0.0.0", (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
      console.log(`> Ready on http://10.236.18.99:${port} (Network)`);
    });
  }
});