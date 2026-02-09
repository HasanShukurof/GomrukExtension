# 📦 Gömrük Extension - Quraşdırma Təlimatları

## Chrome Brauzerdə Quraşdırma

### Addım 1: Developer Mode Aktiv Edin
1. Chrome brauzerini açın
2. Ünvan sətirinə yazın: `chrome://extensions/`
3. Sağ yuxarı küncdən **"Developer mode"** seçimini aktiv edin

### Addım 2: Extension Yükləyin
1. **"Load unpacked"** düyməsinə klikləyin
2. Fayl seçicidə `gomruk_extension` qovluğuna keçin:
   ```
   ~/AndroidStudioProjects/gomruk_extension
   ```
3. Qovluğu seçin və **"Select"** düyməsinə basın

### Addım 3: Extension Yükləndi! ✅
- Toolbar-da yeni ikon görünəcək (bənövşəyi gradient ilə "G" hərfi)
- Extension hazırdır!

## 🚀 İstifadə Təlimatı

### 1. e-gov.az Saytına Keçin
   - Saytı açın: https://e-gov.az/az/services/readwidenew/3505/2
   - Form səhifəsinə gedin

### 2. Extension-ı Açın
   - Toolbar-dakı Gömrük Extension ikonasına klikləyin
   - Popup pəncərə açılacaq

### 3. PDF Yükləyin
   İki üsul:
   - **Üsul 1:** "PDF faylı seçin" sahəsinə klikləyin və faylı seçin
   - **Üsul 2:** PDF faylını pəncərəyə sürüyüb atın (drag & drop)

### 4. Prosesi Başladın
   - **"PDF-i Oxu və Doldur"** düyməsinə basın
   - Extension:
     1. PDF-i oxuyacaq
     2. OCR ilə mətn çıxaracaq (Tesseract.js)
     3. Məlumatları parse edəcək
     4. Formu avtomatik dolduracaq

### 5. Nəticə
   - Doldurulmuş sahələr yaşıl rənglə highlight olunacaq
   - Status mesajı göstəriləcək

## 🎯 Tanınan Məlumatlar

Extension aşağıdakı məlumatları axtarır və doldurur:

- 👤 **Ad**
- 👤 **Soyad**
- 👤 **Ata adı**
- 🆔 **FIN kod** (7 simvol)
- 🛂 **Pasport nömrəsi** (AZE + 7 rəqəm)
- 📱 **Telefon nömrəsi** (+994 formatı)
- 📧 **Email**
- 🏠 **Ünvan**

## ⚙️ Texniki Tələblər

- **Brauzer:** Google Chrome 88+
- **İnternet:** Tələb olunur (CDN-dən kitabxanalar yüklənir)
- **PDF:** Təmiz və oxunaqlı skan
- **Dil:** Azərbaycan və İngilis dili dəstəyi

## ❗ Məhdudiyyətlər

- Extension yalnız `e-gov.az` saytında işləyir
- PDF faylları çox kiçik və ya keyfiyyətsiz olarsa, OCR uğursuz ola bilər
- Əlyazma mətnləri tanınmaya bilər
- Formun strukturu dəyişərsə, field matching yeniləmə tələb edə bilər

## 🔧 Problemlər və Həllər

### Extension yüklənmir
- Developer mode aktiv olduğundan əmin olun
- Düzgün qovluğu seçdiyinizdən əmin olun
- Console-da xəta olub olmadığını yoxlayın

### PDF oxunmur
- Fayl həcmini yoxlayın (çox böyük fayllar problem yarada bilər)
- İnternet bağlantısını yoxlayın
- PDF faylının zədələnmədiyindən əmin olun

### Form doldurulmur
- e-gov.az saytında olduğunuzdan əmin olun
- Səhifə tam yüklənməsini gözləyin
- Console-da xəta mesajlarını yoxlayın

## 🛠️ Developer Rejimi

Extension-ı inkişaf etdirmək istəyirsinizsə:

1. Kod dəyişiklikləri edin
2. `chrome://extensions/` səhifəsində **"Reload"** (🔄) düyməsinə basın
3. Dəyişiklikləri test edin

## 📞 Əlavə Məlumat

- README.md faylına baxın
- Source code-u nəzərdən keçirin
- Problemlər üçün issue yaradın

---

**Uğurlar! 🎉**

