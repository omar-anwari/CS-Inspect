/**
 * Helper script to start the dev server with mobile testing capabilities
 * This allows you to test the app on your mobile device by connecting to your computer's IP
 */
const { execSync } = require('child_process');
const os = require('os');

// Get network interfaces to find local IP address
const interfaces = os.networkInterfaces();
let localIP = '';

// Find the first non-internal IPv4 address
Object.keys(interfaces).forEach((iface) => {
  interfaces[iface].forEach((details) => {
    if (details.family === 'IPv4' && !details.internal) {
      localIP = details.address;
    }
  });
});

if (!localIP) {
  console.error('Could not find local IP address. Using localhost instead.');
  localIP = 'localhost';
}

console.log(`\n🚀 Starting development server for mobile testing`);
console.log(`\n📱 You can access the app on your mobile device at:`);
console.log(`\n   http://${localIP}:3000\n`);

// Set environment variables to expose the server to the network and use the detected IP
process.env.HOST = '0.0.0.0';
process.env.PUBLIC_URL = `http://${localIP}:3000`;

// Start the development server (uses react-scripts start under the hood)
try {
  execSync('npm start', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to start development server:', error);
  process.exit(1);
}
