# 🔥 Warmers App - Akıllı Tabanlık Isıtıcı Kontrol Uygulaması

Bu uygulama, **BLEDOM (ELK-BLEDOM)** Bluetooth LED kontrolcü kablosunu akıllı bir **ısıtıcılı tabanlık termostatına** dönüştüren özel bir mobil ve web uygulamasıdır.

Lotus Lantern gibi karmaşık ve alakasız RGB/müzik modları yerine sadece tabanlık ısıtma ihtiyacına odaklanmış modern bir arayüz sunar.

---

## 📱 Özellikler

1. **Termal Isı Kadranı (Circular Dial):**
   - %0 ile %100 arasında hassas PWM güç kontrolü
   - Tahmini tabanlık sıcaklığı göstergesi (22°C - 55°C)
   - Isıya göre değişen renkler (Kapalı ➔ Yeşil ➔ Sarı ➔ Turuncu ➔ Alev Kırmızısı)
   - Dokunmatik veya mouse ile dairesel sürükleme desteği

2. **Hızlı Isı Kademeleri (Presets):**
   - ❄️ **Kapalı (%0)**
   - 🌿 **Eco / Ilık (%30 • ~32°C):** Pil tasarrufu, hafif ılıklık
   - ♨️ **Konfor (%60 • ~42°C):** Günlük ideal sıcaklık
   - 🔥 **Sıcak (%85 • ~48°C):** Yoğun kış soğukları için
   - ⚡ **Turbo (%100 • ~55°C):** Hızlı ön ısıtma

3. **Güvenlik Zamanlayıcısı (Auto Shut-Off):**
   - 15, 30, 45, 60 dakika veya Sürekli mod
   - Süre bitince tabanlık gücünü otomatik keser, pilinizi korur ve aşırı ısınmayı önler.

4. **Bluetooth Protokol & Log Konsolu:**
   - Cihaza giden 9 baytlık hex komutlarını canlı gösterir.
   - Cihaz yanınızda değilken denemek için **"Demo Modu"** içerir.

---

## 🚀 Nasıl Çalıştırılır?

### Adım 1: Bilgisayarda Sunucuyu Başlatın
Masaüstündeki `WarmersApp` klasöründe yer alan **`Baslat.bat`** dosyasına çift tıklayın.

Ekranda şu bilgi belirecektir:
```text
💻 Bilgisayarınızdan: http://localhost:8080
📱 Telefondan:        http://192.168.1.101:8080
```

---

### Adım 2: Telefondan Bağlanma

#### 🍎 iPhone (iOS) İçin:
Apple, Safari tarayıcısında Bluetooth'a izin vermez. Bu nedenle:
1. iPhone'unuzdan App Store'a girip ücretsiz **"Bluefy - Web BLE Browser"** uygulamasını indirin.
2. Bluefy'ı açıp adres çubuğuna bilgisayarınızın gösterdiği IP adresini yazın:  
   👉 `http://192.168.1.101:8080`
3. Sağ üstteki **"Bağlan"** butonuna dokunun ve çıkan listeden **`BLEDOM`** cihazınızı seçin.
4. Artık tabanlığınızı kontrol edebilirsiniz!

#### 🤖 Android İçin:
1. Telefonunuzun **Google Chrome** tarayıcısını açın.
2. Bilgisayarınızın gösterdiği adrese girin: `http://192.168.1.101:8080`
3. **"Bağlan"** butonuna dokunup cihazınızı seçin.
*(Chrome yerel IP'de Bluetooth kısıtlaması verirse, tarayıcıda `chrome://flags/#unsafely-treat-insecure-origin-as-secure` açıp IP'nizi ekleyebilirsiniz veya projeyi ücretsiz GitHub Pages'e yükleyebilirsiniz).*

---

## 🌐 İnternet Üzerinden (Ev Ağında Olmadan) Kullanmak (Opsiyonel)

Uygulamanızı **GitHub Pages**, **Vercel** veya **Netlify** gibi ücretsiz platformlara tek tıkla yüklerseniz:
- Bilgisayarınızın açık olmasına gerek kalmaz.
- Size `https://kullaniciadiniz.github.io/warmers` gibi bir link verir.
- Dünyanın her yerinden, doğrudan HTTPS ile güvenli şekilde hem Android hem iPhone'da tek tıkla çalışır.

---

## 🔬 Teknik Bluetooth (BLE) Protokol Referansı

- **Servis UUID:** `0000fff0-0000-1000-8000-00805f9b34fb`
- **Karakteristik UUID:** `0000fff3-0000-1000-8000-00805f9b34fb` (Yazma)

| İşlem | Gönderilen Hex Paketi |
|---|---|
| **Aç (Power ON)** | `7e 00 04 f0 00 01 ff 00 ef` |
| **Kapat (Power OFF)** | `7e 00 04 00 00 00 ff 00 ef` |
| **Tüm Kanalları Aç (RGB Max)** | `7e 00 05 03 ff ff ff 00 ef` |
| **Isı / Güç Ayarı (%0 - %100)** | `7e 00 01 [GÜÇ_HEX] 00 00 00 00 ef` |
*(Örnek: %50 güç için `7e 00 01 32 00 00 00 00 ef`)*
