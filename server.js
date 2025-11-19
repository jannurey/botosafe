/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const { createServer: createHttpsServer } = require("https");
const next = require("next");
const { parse } = require("url");
const fs = require("fs");
const os = require("os");

// Memory monitoring
require('./scripts/memory-monitor');

const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Set memory limits for the server
require('v8').setFlagsFromString('--max-old-space-size=4096');

// Get network IP address
function getNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const networkIP = getNetworkIP();

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
      console.log(`> Network: https://${networkIP}:${port}`);
      console.log(`\n⚠️  IMPORTANT: Ensure Windows Firewall allows port ${port}`);
      console.log(`   Run as Administrator: netsh advfirewall firewall add rule name="Next.js Dev Server" dir=in action=allow protocol=TCP localport=${port}\n`);
    });
  } else {
    // Fallback to HTTP server if no certificates found
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, "0.0.0.0", (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
      console.log(`> Network: http://${networkIP}:${port}`);
      console.log(`\n⚠️  IMPORTANT: Ensure Windows Firewall allows port ${port}`);
      console.log(`   Run as Administrator: netsh advfirewall firewall add rule name="Next.js Dev Server" dir=in action=allow protocol=TCP localport=${port}\n`);
    });
  }
});