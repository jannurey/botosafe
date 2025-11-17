// scripts/memory-monitor.js
// Memory monitoring script to track memory usage during development and production

const fs = require('fs');
const path = require('path');

// Function to get memory usage in MB
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // Resident Set Size
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // Total Size of V8's Memory Heap
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // Used Memory
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // External memory (off-heap)
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100 // Array Buffers
  };
}

// Function to log memory usage
function logMemoryUsage(label = '') {
  const timestamp = new Date().toISOString();
  const memory = getMemoryUsage();
  
  console.log(`[${timestamp}] ${label} Memory Usage:`);
  console.log(`  RSS: ${memory.rss} MB`);
  console.log(`  Heap Total: ${memory.heapTotal} MB`);
  console.log(`  Heap Used: ${memory.heapUsed} MB`);
  console.log(`  External: ${memory.external} MB`);
  console.log(`  Array Buffers: ${memory.arrayBuffers} MB`);
  console.log('---');
}

// Log memory usage periodically (every 30 seconds)
setInterval(() => {
  logMemoryUsage('Periodic');
}, 30000);

// Log memory usage on exit
process.on('exit', () => {
  logMemoryUsage('Exit');
});

// Log memory usage on uncaughtException
process.on('uncaughtException', (err) => {
  logMemoryUsage('Uncaught Exception');
  console.error(err);
  process.exit(1);
});

// Log memory usage on SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logMemoryUsage('SIGINT');
  process.exit(0);
});

// Export functions for use in other modules
module.exports = {
  getMemoryUsage,
  logMemoryUsage
};