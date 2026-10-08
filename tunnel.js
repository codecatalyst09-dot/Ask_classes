const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const PORT = parseInt(process.env.PORT || '8000', 10);
const TUNNEL_FILE = path.join(__dirname, 'active_tunnel.json');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function fetchPublicIP() {
  return new Promise((resolve) => {
    const req = https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.ip || '');
        } catch (e) {
          resolve('');
        }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(4000, () => {
      req.destroy();
      resolve('');
    });
  });
}

async function startTunnel() {
  console.log('\n====================================================================');
  console.log('🚀 ASK CLASSES — INITIALIZING GLOBAL WORLDWIDE GATEWAY');
  console.log('====================================================================');
  console.log(`Connecting port ${PORT} to the global tunnel network...`);

  const localIP = getLocalIP();
  const publicIP = await fetchPublicIP();
  const subdomain = `askclasses-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const tunnel = await localtunnel({ port: PORT, subdomain });

    const tunnelData = {
      url: tunnel.url,
      localIP,
      publicIP,
      port: PORT,
      startedAt: new Date().toISOString()
    };

    fs.writeFileSync(TUNNEL_FILE, JSON.stringify(tunnelData, null, 2));

    console.log('\n✅ GLOBAL GATEWAY IS ONLINE! ANYONE CAN JOIN FROM ANYWHERE:');
    console.log('--------------------------------------------------------------------');
    console.log(`🌐 Worldwide Public Link:  ${tunnel.url}`);
    console.log(`📱 Local WiFi Link:        http://${localIP}:${PORT}`);
    console.log(`💻 Local Computer Link:    http://localhost:${PORT}`);
    if (publicIP) {
      console.log(`🔑 Tunnel Password (if requested): ${publicIP}`);
    }
    console.log('--------------------------------------------------------------------');
    console.log('💡 How to share with students:');
    console.log(`   Send this link to students on WhatsApp/Telegram/Email:`);
    console.log(`   👉 ${tunnel.url}`);
    console.log('   Students can join on Mobile 4G/5G, tablets, or any Wi-Fi from any city!');
    console.log('====================================================================\n');

    tunnel.on('close', () => {
      console.log('⚠️ Global Tunnel was closed. Reconnecting in 5 seconds...');
      try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
      setTimeout(startTunnel, 5000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
    });

    process.on('SIGINT', () => {
      console.log('\nClosing global tunnel...');
      try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
      tunnel.close();
      process.exit();
    });

  } catch (err) {
    console.error('❌ Failed to establish global tunnel:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
