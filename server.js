const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 8080;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let safePath = req.url === '/' ? 'index.html' : req.url.split('?')[0];
  let filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Dosya Bulunamadı');
      } else {
        res.writeHead(500);
        res.end(`Sunucu Hatası: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.1.101';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.clear();
  console.log('================================================================');
  console.log('🔥 WARMERS APP SUNUCUSU BAŞLATILDI');
  console.log('================================================================');
  console.log(`💻 Bilgisayarınızdan açmak için:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log('');
  console.log(`📱 Telefondan Yerel Ağ (Aynı Wi-Fi):`);
  console.log(`   👉 http://${localIP}:${PORT}`);
  console.log('');
  console.log(`🌐 Telefon için Güvenli HTTPS Tüneli Hazırlanıyor...`);
  console.log('================================================================');

  // Mobil cihazlar ve güvenlik duvarı engellerini aşmak için otomatik HTTPS tüneli
  try {
    const tunnel = spawn('cmd', ['/c', 'npx', '--yes', 'localtunnel', '--port', `${PORT}`]);

    tunnel.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('your url is:')) {
        const url = msg.replace('your url is:', '').trim();
        console.log(`\n🎉 TELEFONUNUZDAN AÇABİLECEĞİNİZ HTTPS LİNKİ HAZIR:`);
        console.log(`   👉 ${url}`);
        console.log(`\n💡 İPUCU:`);
        console.log(`• iPhone: Bluefy tarayıcısını açıp yukarıdaki HTTPS linkine gidin.`);
        console.log(`• İlk girişte "Click to Continue" butonu çıkarsa tıklamanız yeterlidir.`);
        console.log('================================================================\n');
      }
    });

    tunnel.stderr.on('data', () => {});
    tunnel.on('error', () => {
      console.log('Tünel başlatılamadı, yerel IP üzerinden devam ediliyor.');
    });
  } catch (e) {
    // Tünel açılamazsa yerel IP kullanılabilir
  }
});
