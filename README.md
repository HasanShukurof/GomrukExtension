# 🏛️ Gömrük Extension

Chrome extension for automatically filling customs forms using OCR technology.

## 🌟 Xüsusiyyətlər

- 📄 PDF fayllarını yükləyir (həm text, həm scan edilmiş)
- 🔍 Tesseract.js ilə OCR (Optical Character Recognition)
- 📝 Formları avtomatik doldurur
- 🎨 Müasir və sadə istifadəçi interfeysi
- ✨ Drag & Drop dəstəyi
- 🧪 Test rejimi dəstəyi (Turanbank)

## 🌐 Dəstəklənən Saytlar

### Əsas Saytlar (Production):
1. **E-gov.az** - `https://e-gov.az/*`
2. **Gömrük Portal** - `https://gbportal.customs.gov.az/*`
3. **Custom.gov.az** - `https://custom.gov.az/*`

### Test Saytı:
- **Turanbank** - `https://mobile2.turanbank.az/*` (Test üçün)

## 📦 Quraşdırma

1. Chrome brauzerdə `chrome://extensions/` səhifəsinə daxil olun
2. Sağ yuxarıdan "Developer mode" seçimini aktiv edin
3. "Load unpacked" düyməsinə klikləyin
4. `gomruk_extension` qovluğunu seçin

## 🚀 İstifadə

### Test Rejimi (Turanbank):
1. Test saytını açın: https://mobile2.turanbank.az/login/individual/mobile
2. Extension ikonasına klikləyin
3. PDF faylını seçin (məsələn: `pdf scan.pdf`)
4. "PDF-i Oxu və Doldur" düyməsinə basın
5. Extension PDF-dən **Invoice → Name:** field-ini tapıb **Şifrə** xanasına yazacaq

### Production Rejimi (Gömrük saytları):
1. Gömrük saytlarından birini açın
2. Extension ikonasına klikləyin
3. PDF faylını seçin
4. "PDF-i Oxu və Doldur" düyməsinə basın
5. Extension formu avtomatik dolduracaq

## 🔍 PDF-dən Çıxarılan Məlumatlar

Extension aşağıdakı məlumatları tanıyır:
- **Company Name** (Şirkət adı): "Name: GLB LOGISTICS CORPORATION"
- **Address** (Ünvan): "30 N GOULD ST STE R, SHERIDAN WY 82801, USA"
- **Tax ID / VOEN**: "99-0667903"
- **VIN nömrəsi**: "5NPD84LF3JH249799"
- **Invoice məlumatları**

## 📋 Fayllar

- `manifest.json` - Extension konfiqurasiyası (v1.2.0)
- `popup.html` - İstifadəçi interfeysi
- `popup.js` - UI məntiq və fayl idarəetməsi
- `background.js` - Background service worker
- `content.js` - Web səhifə ilə əlaqə və form doldurma

## 🔧 Texnologiyalar

- Chrome Extension Manifest V3
- Tesseract.js (OCR)
- PDF.js (PDF oxuma)
- Vanilla JavaScript
- Modern CSS3

## ⚠️ Qeydlər

- Extension həm text, həm scan edilmiş PDF-ləri oxuyur
- Test üçün Turanbank saytı istifadə olunur
- Production-da əsas gömrük saytlarında işləyəcək
- PDF faylları təmiz və oxunaqlı olmalıdır

## 🧪 Test Prosesi

1. **Hazırlıq:**
   - Test saytı: Turanbank login page
   - Test PDF: Invoice sənədləri olan PDF (scan edilmiş)

2. **Test Addımları:**
   - PDF yüklə → OCR oxu → "Name:" field tap → Şifrə xanasına yaz

3. **Uğur Kriteriyası:**
   - ✅ PDF-dən mətn düzgün çıxarılır
   - ✅ "Name:" field tapılır
   - ✅ Şifrə xanası avtomatik doldurulur

4. **Production Keçid:**
   - Test successful olduqdan sonra əsas gömrük saytlarında tətbiq ediləcək

## 📝 Versiya

**v1.2.0** - Test rejimi (Turanbank dəstəyi)

## 👨‍💻 Müəllif

Created with ❤️ for Azerbaijani customs users



