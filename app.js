// ==========================================
// WARMERS APP - BLUETOOTH LOW ENERGY DRIVER
// Özel Isıtıcılı Tabanlık Kontrol Uygulaması
// ==========================================

const BLE_CONFIG = {
  // Lotus Lantern / ELK-BLEDOM Standart Servis & Karakteristik UUID'leri
  SERVICE_UUID: "0000fff0-0000-1000-8000-00805f9b34fb",
  WRITE_CHAR_UUID: "0000fff3-0000-1000-8000-00805f9b34fb",
  // Alternatif klon çipler için yedek servisler
  OPTIONAL_SERVICES: [
    "0000fff0-0000-1000-8000-00805f9b34fb",
    "0000ffd5-0000-1000-8000-00805f9b34fb",
    "0000fee7-0000-1000-8000-00805f9b34fb"
  ]
};

// Uygulama Durumu (State)
const state = {
  device: null,
  server: null,
  characteristic: null,
  isConnected: false,
  isPoweredOn: false,
  heatLevel: 0, // 0 - 100
  demoMode: false,
  timerDurationMinutes: 0,
  timerRemainingSeconds: 0,
  timerInterval: null,
  isSending: false,
  pendingCommand: null
};

// DOM Elemanları
const el = {
  btnConnect: document.getElementById('btnConnect'),
  connectLabel: document.getElementById('connectLabel'),
  deviceName: document.getElementById('deviceName'),
  powerSwitch: document.getElementById('powerSwitch'),
  dialProgress: document.getElementById('dialProgress'),
  dialGlow: document.getElementById('dialGlow'),
  powerPercent: document.getElementById('powerPercent'),
  tempEstimate: document.getElementById('tempEstimate'),
  modeBadge: document.getElementById('modeBadge'),
  dialSvg: document.getElementById('dialSvg'),
  dialKnob: document.getElementById('dialKnob'),
  knobGlow: document.getElementById('knobGlow'),
  knobCenter: document.getElementById('knobCenter'),
  knobGroup: document.getElementById('knobGroup'),
  btnStepDown: document.getElementById('btnStepDown'),
  btnStepUp: document.getElementById('btnStepUp'),
  presetCards: document.querySelectorAll('.preset-card'),
  timerChips: document.querySelectorAll('.timer-chips .chip'),
  timerCountdown: document.getElementById('timerCountdown'),
  toggleConsoleBtn: document.getElementById('toggleConsoleBtn'),
  consoleBody: document.getElementById('consoleBody'),
  consoleArrow: document.getElementById('consoleArrow'),
  demoModeCheckbox: document.getElementById('demoModeCheckbox'),
  clearLogBtn: document.getElementById('clearLogBtn'),
  logOutput: document.getElementById('logOutput'),
  dialContainer: document.querySelector('.dial-container')
};

// 240 Derece Yay Geometrisi Sabitleri
const CX = 150;
const CY = 150;
const RADIUS = 105;
const START_ANGLE = 150; // Derece (Sol alt = %0)
const SWEEP_ANGLE = 240; // Derece (Toplam açılım = %100)
const ARC_LENGTH = 2 * Math.PI * RADIUS * (SWEEP_ANGLE / 360); // 439.823 px

// Log Yardımcısı
function log(msg, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const time = new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.textContent = `[${time}] ${msg}`;
  el.logOutput.appendChild(line);
  el.logOutput.scrollTop = el.logOutput.scrollHeight;
}

// ==========================================
// BLUETOOTH İLETİŞİM FONKSİYONLARI (GATT)
// ==========================================

async function connectBLE() {
  if (state.isConnected) {
    disconnectBLE();
    return;
  }

  if (state.demoMode) {
    simulateConnect();
    return;
  }

  // Web Bluetooth API Desteği Kontrolü
  if (!navigator.bluetooth) {
    log("Web Bluetooth bu tarayıcıda desteklenmiyor!", "error");
    alert("Web Bluetooth tarayıcınızda aktif değil!\n\n• Android: Google Chrome veya Edge kullanın.\n• iPhone (iOS): App Store'dan ücretsiz 'Bluefy' tarayıcısını indirip bu adresi açın.");
    return;
  }

  try {
    log("Bluetooth cihaz araması başlatılıyor...", "info");
    el.connectLabel.textContent = "Aranıyor...";

    // Cihaz Seçim Diyaloğu
    state.device = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'BLEDOM' },
        { namePrefix: 'ELK' },
        { namePrefix: 'duoCo' },
        { namePrefix: 'LED' }
      ],
      optionalServices: BLE_CONFIG.OPTIONAL_SERVICES
    }).catch(async (err) => {
      // Eğer isim filtresiyle bulamazsa tüm cihazları listele
      log("Filtreli arama iptal edildi, tüm BLE cihazlar taranıyor...", "warn");
      return await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLE_CONFIG.OPTIONAL_SERVICES
      });
    });

    log(`Cihaz seçildi: ${state.device.name || "BLEDOM"}`, "info");
    state.device.addEventListener('gattserverdisconnected', onDisconnected);

    log("GATT sunucusuna bağlanılıyor...", "info");
    state.server = await state.device.gatt.connect();

    log("Isıtıcı kontrol servisi (0xFFF0) alınıyor...", "info");
    const service = await state.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);

    log("Yazma karakteristiği (0xFFF3) bulunuyor...", "info");
    state.characteristic = await service.getCharacteristic(BLE_CONFIG.WRITE_CHAR_UUID);

    // Başarılı Bağlantı
    state.isConnected = true;
    updateConnectionUI(true, state.device.name || "BLEDOM (Bağlandı)");
    log("Bağlantı kuruldu! Başlatma komutları gönderiliyor...", "tx");

    // Tüm RGB kanallarını tam güce ayarla (Hangi pine bağlıysa akım geçebilsin)
    await sendRGBFullPower();
    // Cihazı Aç
    await setPowerState(true);
    // Varsayılan %30 Ilık seviyeye getir
    setHeatLevel(30);

  } catch (error) {
    log(`Bağlantı hatası: ${error.message}`, "error");
    updateConnectionUI(false);
  }
}

function disconnectBLE() {
  if (state.device && state.device.gatt.connected) {
    state.device.gatt.disconnect();
  }
  onDisconnected();
}

function onDisconnected() {
  state.isConnected = false;
  state.isPoweredOn = false;
  state.characteristic = null;
  state.server = null;
  log("Bluetooth bağlantısı kesildi.", "warn");
  updateConnectionUI(false);
  setHeatLevel(0, false);
}

function updateConnectionUI(connected, name = "Cihaz Aranıyor... (BLEDOM)") {
  if (connected) {
    el.btnConnect.classList.add('connected');
    el.connectLabel.textContent = "Bağlı";
    el.deviceName.textContent = `📶 ${name}`;
    el.powerSwitch.disabled = false;
  } else {
    el.btnConnect.classList.remove('connected');
    el.connectLabel.textContent = "Bağlan";
    el.deviceName.textContent = name;
    el.powerSwitch.disabled = true;
    el.powerSwitch.checked = false;
  }
}

// ==========================================
// HEX PROTOKOL VE KOMUT GÖNDERİMİ
// ==========================================

// GATT Komut Gönderme (Throttling / Queue Mantığı ile)
async function sendRawCommand(hexArray) {
  if (state.demoMode) {
    const hexStr = hexArray.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    log(`[DEMO TX]: ${hexStr}`, "tx");
    return;
  }

  if (!state.characteristic) return;

  const buffer = new Uint8Array(hexArray);
  const hexStr = Array.from(buffer).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  try {
    if (state.characteristic.writeValueWithoutResponse) {
      await state.characteristic.writeValueWithoutResponse(buffer);
    } else {
      await state.characteristic.writeValue(buffer);
    }
    log(`TX: ${hexStr}`, "tx");
  } catch (err) {
    log(`Komut gönderme hatası: ${err.message}`, "error");
  }
}

// BLEDOM Güç Aç / Kapat
async function setPowerState(on) {
  state.isPoweredOn = on;
  el.powerSwitch.checked = on;

  if (on) {
    // Power ON Komutu: 7E 00 04 F0 00 01 FF 00 EF
    log("Güç AÇILIYOR...", "info");
    await sendRawCommand([0x7e, 0x00, 0x04, 0xf0, 0x00, 0x01, 0xff, 0x00, 0xef]);
    // Kanalların açık olduğundan emin ol
    await sendRGBFullPower();
  } else {
    // Power OFF Komutu: 7E 00 04 00 00 00 FF 00 EF
    log("Güç KAPATILIYOR...", "info");
    await sendRawCommand([0x7e, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0x00, 0xef]);
  }
}

// Tabanlığın bağlı olduğu RGB hattını %100 duty-cycle'a ayarla
// Komut: 7E 00 05 03 [R] [G] [B] 00 EF
async function sendRGBFullPower() {
  // Tüm renk kanallarını (R=255, G=255, B=255) açıyoruz.
  // Böylece kablonuz kırmızı, yeşil ya da mavi pinlerden hangisine lehimliyse çalışır.
  await sendRawCommand([0x7e, 0x00, 0x05, 0x03, 0xff, 0xff, 0xff, 0x00, 0xef]);
}

// Isı / Parlaklık (PWM Duty-Cycle) Ayarı
// Komut: 7E 00 01 [GÜÇ_0-100] 00 00 00 00 EF
let throttleTimeout = null;
function sendHeatPowerCommand(percent) {
  // Aşırı komut yığılmasını önlemek için 50ms debouncing
  if (throttleTimeout) clearTimeout(throttleTimeout);

  throttleTimeout = setTimeout(async () => {
    // 0-100 aralığını doğrudan hex olarak gönder
    const powerHex = Math.max(0, Math.min(100, Math.round(percent)));
    await sendRawCommand([0x7e, 0x00, 0x01, powerHex, 0x00, 0x00, 0x00, 0x00, 0xef]);
  }, 40);
}

// ==========================================
// ARAYÜZ VE ISIL KADRAN YÖNETİMİ
// ==========================================

function updateKnobPosition(percent) {
  // Yüzdeye karşılık gelen yay açısı
  const angleDeg = START_ANGLE + (percent / 100) * SWEEP_ANGLE;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  // (CX, CY) etrafında RADIUS yarıçapında kartezyen koordinatlar
  const x = CX + RADIUS * Math.cos(angleRad);
  const y = CY + RADIUS * Math.sin(angleRad);
  
  el.dialKnob.setAttribute('cx', x.toFixed(2));
  el.dialKnob.setAttribute('cy', y.toFixed(2));
  el.knobGlow.setAttribute('cx', x.toFixed(2));
  el.knobGlow.setAttribute('cy', y.toFixed(2));
  el.knobCenter.setAttribute('cx', x.toFixed(2));
  el.knobCenter.setAttribute('cy', y.toFixed(2));
}

function setHeatLevel(percent, sendCommand = true) {
  percent = Math.max(0, Math.min(100, Math.round(percent)));
  state.heatLevel = percent;

  // Güç %0 ise şalteri de senkronize et
  if (percent > 0 && !state.isPoweredOn) {
    setPowerState(true);
  }

  // Değerleri Güncelle
  el.powerPercent.textContent = percent;

  // Tahmini Sıcaklık (Ortam 20°C, Maksimum 40°C)
  const estimatedTemp = Math.round(20 + (percent * 0.20));
  el.tempEstimate.textContent = estimatedTemp;

  // 240 Derecelik Termostat Yayı İlerlemesi (Stroke Dashoffset)
  const offset = ARC_LENGTH * (1 - (percent / 100));
  el.dialProgress.style.strokeDashoffset = offset;

  // Sürüklenebilir Topun (Knob) Konumunu Güncelle
  updateKnobPosition(percent);

  // Isı Seviyesine Göre Dinamik Renk ve Mod Belirleme
  let modeName = "KAPALI";
  let heatColor = "var(--heat-off)";

  if (percent === 0) {
    modeName = "KAPALI";
    heatColor = "var(--heat-off)";
  } else if (percent <= 35) {
    modeName = "ECO • ILIK";
    heatColor = "var(--heat-eco)";
  } else if (percent <= 65) {
    modeName = "KONFOR";
    heatColor = "var(--heat-mid)";
  } else if (percent <= 85) {
    modeName = "SICAK";
    heatColor = "var(--heat-high)";
  } else {
    modeName = "TURBO • MAKS";
    heatColor = "var(--heat-turbo)";
  }

  el.modeBadge.textContent = modeName;
  document.documentElement.style.setProperty('--current-heat-color', heatColor);

  // Preset Butonlarının Aktiflik Durumu
  el.presetCards.forEach(card => {
    const cardLevel = parseInt(card.dataset.level, 10);
    if (cardLevel === percent) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // Haptic Feedback (Telefon Destekliyorsa)
  if (window.navigator && window.navigator.vibrate && sendCommand) {
    window.navigator.vibrate(8);
  }

  // Cihaza Komut Gönder
  if (sendCommand && (state.isConnected || state.demoMode)) {
    sendHeatPowerCommand(percent);
  }
}

// ==========================================
// SEZGİSEL TOP (KNOB) SÜRÜKLEME VE DOKUNMATİK
// ==========================================

let isDragging = false;

function calculateAngleAndSetHeat(clientX, clientY) {
  const rect = el.dialSvg.getBoundingClientRect();
  // SVG içi 300x300 normalize koordinatlar
  const svgX = ((clientX - rect.left) / rect.width) * 300;
  const svgY = ((clientY - rect.top) / rect.height) * 300;

  const deltaX = svgX - CX;
  const deltaY = svgY - CY;

  // Merkezden açı hesabı (0 - 360 derece)
  let angleDeg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  if (angleDeg < 0) angleDeg += 360;

  // Yayımız 150° (sol alt) den başlayıp 30° (sağ alt) de biter (Toplam 240°)
  let relativeAngle;
  if (angleDeg >= 150) {
    relativeAngle = angleDeg - 150; // 0° ile 210° arası (sol alttan tepeye ve sağa)
  } else {
    relativeAngle = angleDeg + 210; // 210° ile 240° arası (sağ üstten sağ alta)
  }

  // Alt kısımdaki boşluk (Dead-Zone: 30° ile 150° arasındaki 120 derecelik alt aralık)
  if (relativeAngle > 240) {
    // Parmağın en yakın olduğu uca kilitle (sıçramayı kesinlikle önler)
    if (relativeAngle < 300) {
      relativeAngle = 240; // %100 ucu
    } else {
      relativeAngle = 0;   // %0 ucu
    }
  }

  // 0 - 240 dereceyi doğrudan 0 - 100% aralığına ölçekle
  const percent = Math.round((relativeAngle / 240) * 100);
  setHeatLevel(percent);
}

// Mouse Eventleri
el.dialSvg.addEventListener('mousedown', (e) => {
  if (!state.isConnected && !state.demoMode) return;
  isDragging = true;
  el.knobGroup.classList.add('dragging');
  calculateAngleAndSetHeat(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  calculateAngleAndSetHeat(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    el.knobGroup.classList.remove('dragging');
  }
});

// Mobil Dokunmatik Eventler
el.dialSvg.addEventListener('touchstart', (e) => {
  if (!state.isConnected && !state.demoMode) return;
  if (e.touches && e.touches[0]) {
    isDragging = true;
    el.knobGroup.classList.add('dragging');
    calculateAngleAndSetHeat(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isDragging) return;
  if (e.touches && e.touches[0]) {
    e.preventDefault(); // Sayfa kaymasını engelle
    calculateAngleAndSetHeat(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

window.addEventListener('touchend', () => {
  if (isDragging) {
    isDragging = false;
    el.knobGroup.classList.remove('dragging');
  }
});

// ==========================================
// HASSAS ARTIRMA / AZALTMA BUTONLARI (+ / -)
// ==========================================

el.btnStepDown.addEventListener('click', () => {
  if (!state.isConnected && !state.demoMode) {
    alert("Önce 'Bağlan' butonuna dokunun veya Demo Modunu açın.");
    return;
  }
  setHeatLevel(Math.max(0, state.heatLevel - 5));
});

el.btnStepUp.addEventListener('click', () => {
  if (!state.isConnected && !state.demoMode) {
    alert("Önce 'Bağlan' butonuna dokunun veya Demo Modunu açın.");
    return;
  }
  setHeatLevel(Math.min(100, state.heatLevel + 5));
});

// ==========================================
// ZAMANLAYICI (TIMER) MANTIĞI
// ==========================================

function startTimer(minutes) {
  state.timerDurationMinutes = minutes;
  if (state.timerInterval) clearInterval(state.timerInterval);

  if (minutes === 0) {
    el.timerCountdown.textContent = "KAPALI";
    return;
  }

  state.timerRemainingSeconds = minutes * 60;
  updateTimerDisplay();

  log(`Zamanlayıcı başlatıldı: ${minutes} dakika sonra otomatik kapanacak.`, "info");

  state.timerInterval = setInterval(() => {
    state.timerRemainingSeconds--;
    updateTimerDisplay();

    if (state.timerRemainingSeconds <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      log("Zamanlayıcı süresi doldu! Güvenlik için ısıtıcı kapatılıyor.", "warn");
      setHeatLevel(0);
      setPowerState(false);
      el.timerCountdown.textContent = "BİTTİ";

      // Titreşimli uyarı
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200, 100, 400]);
      }
      alert("Warmers App: Zamanlayıcı süresi bitti, ısıtıcı otomatik olarak kapatıldı.");
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(state.timerRemainingSeconds / 60);
  const s = state.timerRemainingSeconds % 60;
  el.timerCountdown.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Timer Butonları
el.timerChips.forEach(chip => {
  chip.addEventListener('click', () => {
    el.timerChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const minutes = parseInt(chip.dataset.minutes, 10);
    startTimer(minutes);
  });
});

// ==========================================
// PRESET & GÜÇ BUTONLARI
// ==========================================

el.presetCards.forEach(card => {
  card.addEventListener('click', () => {
    if (!state.isConnected && !state.demoMode) {
      alert("Önce 'Bağlan' butonuna basarak BLEDOM cihazınıza bağlanın veya Demo Modunu açın.");
      return;
    }
    const level = parseInt(card.dataset.level, 10);
    setHeatLevel(level);
  });
});

el.powerSwitch.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  setPowerState(isChecked);
  if (!isChecked) {
    setHeatLevel(0);
  } else if (state.heatLevel === 0) {
    setHeatLevel(30);
  }
});

// ==========================================
// DEMO MODU & TEST
// ==========================================

function simulateConnect() {
  log("Demo Modu: Sanal BLEDOM cihazına bağlanılıyor...", "info");
  updateConnectionUI(true, "BLEDOM (Demo Simülatör)");
  state.isConnected = true;
  setPowerState(true);
  setHeatLevel(40);
  log("Demo Modu hazır! Isı kadranını ve modları test edebilirsiniz.", "tx");
}

el.demoModeCheckbox.addEventListener('change', (e) => {
  state.demoMode = e.target.checked;
  if (state.demoMode) {
    simulateConnect();
  } else {
    disconnectBLE();
  }
});

// Konsolu Göster / Gizle
el.toggleConsoleBtn.addEventListener('click', () => {
  const isHidden = el.consoleBody.classList.toggle('hidden');
  el.consoleArrow.textContent = isHidden ? "▼" : "▲";
});

el.clearLogBtn.addEventListener('click', () => {
  el.logOutput.innerHTML = '';
});

// Buton Bağlama
el.btnConnect.addEventListener('click', connectBLE);

// Başlangıç Durumu
setHeatLevel(0, false);
log("Warmers App yüklendi. Bluetooth cihazı hazır.", "info");

// PWA Service Worker Kaydı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => log("PWA Çevrimdışı modu aktif.", "info"))
      .catch((e) => console.log("SW error", e));
  });
}

