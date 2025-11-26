const https = require('https');
const http = require('http');

// Use the same port as your Next.js app
const port = process.env.PORT || 3000;
const isHttps = port === 443 || process.env.NODE_ENV === 'production';

const postData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: port,
  path: '/api/setup-admin',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = (port === 443 ? https : http).request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();