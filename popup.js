const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const extractedText = document.getElementById('extractedText');

let selectedFile = null;

// Upload area click
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handleFileSelect(files[0]);
    } else {
        showStatus('Xəta: Yalnız PDF faylları dəstəklənir', 'error');
    }
});

// File input change
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
function handleFileSelect(file) {
    selectedFile = file;
    fileName.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    fileInfo.classList.add('show');
    processBtn.disabled = false;
    hideStatus();
    extractedText.classList.remove('show');
}

// Process button
processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    processBtn.disabled = true;
    showStatus('PDF oxunur...', 'info');
    showProgress(10);

    try {
        // Read file as array buffer
        const arrayBuffer = await readFileAsArrayBuffer(selectedFile);
        showProgress(30);

        // Process PDF directly in popup (no background.js needed)
        showStatus('PDF mətn çıxarılır...', 'info');
        const extractedPdfText = await processPDF(arrayBuffer);

        showProgress(80);
        showStatus('Mətn çıxarıldı! Form doldurulur...', 'success');
        extractedText.textContent = extractedPdfText;
        extractedText.classList.add('show');

        // Send extracted text to content script
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            const supportedSites = ['e-gov.az', 'gbportal.customs.gov.az', 'custom.gov.az', 'mobile2.turanbank.az'];
            const isSupported = tab && supportedSites.some(site => tab.url.includes(site));

            if (!isSupported) {
                showProgress(100);
                showStatus('⚠️ Mətn çıxarıldı. Dəstəklənən sayta keçin', 'info');
                processBtn.disabled = false;
                setTimeout(hideProgress, 2000);
                return;
            }

            // First try sendMessage to content.js
            chrome.tabs.sendMessage(tab.id, { action: 'fillForm', text: extractedPdfText }, async (fillResponse) => {
                // If content.js not loaded (receiving end does not exist), inject directly
                if (chrome.runtime.lastError || !fillResponse) {
                    console.log('Content script not found, injecting directly...');
                    try {
                        // Step 1: Navigate to XİFİ tab so its iframe is loaded in DOM
                        const tabUrl = tab.url || '';
                        const isEgov = tabUrl.includes('e-gov.az') ||
                                       tabUrl.includes('gbportal.customs.gov.az') ||
                                       tabUrl.includes('custom.gov.az');
                        if (isEgov) {
                            showStatus('🔄 XİFİ bölməsinə keçilir...', 'info');
                            // allFrames:true — XİFİ nav tab is inside the gbportal iframe, not the main frame
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id, allFrames: true },
                                func: () => {
                                    const allEls = document.querySelectorAll('a, li, td, div, span, button');
                                    for (const el of allEls) {
                                        const t = (el.innerText || el.textContent || '').trim();
                                        if (t === 'XİFİ' || t === 'XIFI') {
                                            el.click();
                                            console.log('🔄 XİFİ tabına keçildi:', window.location.href);
                                            return true;
                                        }
                                    }
                                    return false;
                                }
                            });
                            // Wait for XİFİ section content to render
                            await new Promise(resolve => setTimeout(resolve, 2500));
                        }

                        // Step 3: Fill form in all frames
                        showStatus('📝 Form doldurulur...', 'info');
                        const results = await chrome.scripting.executeScript({
                            target: { tabId: tab.id, allFrames: true },
                            func: injectAndFill,
                            args: [extractedPdfText]
                        });
                        showProgress(100);
                        const success = results && results.some(r => r && r.result);
                        if (success) {
                            showStatus('✅ Form uğurla dolduruldu!', 'success');
                        } else {
                            showStatus('⚠️ Form doldurula bilmədi. Console-u yoxlayın', 'error');
                        }
                    } catch (err) {
                        console.error('Script inject xətası:', err);
                        showStatus(`⚠️ Xəta: ${err.message}`, 'error');
                    }
                } else {
                    showProgress(100);
                    if (fillResponse.success) {
                        showStatus('✅ Form uğurla dolduruldu!', 'success');
                    } else {
                        showStatus('⚠️ Mətn çıxarıldı, ancaq form doldurula bilmədi', 'error');
                    }
                }
                processBtn.disabled = false;
                setTimeout(hideProgress, 2000);
            });
        });
    } catch (error) {
        showStatus(`Xəta: ${error.message}`, 'error');
        processBtn.disabled = false;
        hideProgress();
    }
});

// Clear button
clearBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.remove('show');
    processBtn.disabled = true;
    hideStatus();
    hideProgress();
    extractedText.classList.remove('show');
});

// Helper functions
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Fayl oxuna bilmədi'));
        reader.readAsArrayBuffer(file);
    });
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = `status show ${type}`;
}

function hideStatus() {
    status.classList.remove('show');
}

function showProgress(percent) {
    progress.classList.add('show');
    progressBar.style.width = `${percent}%`;
}

function hideProgress() {
    progress.classList.remove('show');
    progressBar.style.width = '0%';
}

// Process PDF - per-page hybrid: PDF.js text + OCR for image-only pages
async function processPDF(arrayBuffer) {
    try {
        showStatus('PDF yüklənir...', 'info');
        showProgress(20);

        const pdfLib = window['pdfjs-dist/build/pdf'];
        pdfLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');

        const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = Math.min(pdf.numPages, 10);
        console.log(`📄 PDF yükləndi: ${pdf.numPages} səhifə`);

        showStatus('Hər səhifə yoxlanılır...', 'info');
        showProgress(30);

        // Step 1: extract text from every page via PDF.js
        const pageTexts = [];
        for (let p = 1; p <= totalPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const t = content.items.map(i => i.str).join(' ').trim();
            pageTexts.push({ pageNum: p, text: t, page });
            console.log(`📄 Səhifə ${p}: ${t.length} xarakter (PDF.js)`);
        }

        // Step 2: identify image-only pages (< 30 meaningful chars)
        const imagePagesNeeded = pageTexts.filter(p => p.text.length < 30);
        console.log(`🔍 OCR lazım olan səhifələr: ${imagePagesNeeded.map(p => p.pageNum).join(', ') || 'yoxdur'}`);

        let allText = pageTexts.map(p => p.text).join('\n\n');

        // Step 3: OCR only the image pages
        if (imagePagesNeeded.length > 0) {
            showStatus(`🔍 ${imagePagesNeeded.length} şəkil səhifəsi OCR edilir...`, 'info');
            try {
                const ocrText = await processWithOCRPages(pdf, imagePagesNeeded.map(p => p.pageNum));
                if (ocrText) {
                    allText += '\n\n' + ocrText;
                    console.log('✅ OCR mətn əlavə edildi');
                }
            } catch (ocrErr) {
                console.error('⚠️ OCR xətası:', ocrErr, ocrErr?.message, ocrErr?.stack);
            }
        }

        allText = fixAzerbaijaniOCR(allText);
        console.log(`📝 Ümumi mətn: ${allText.length} xarakter`);
        console.log(`📝 Preview:`, allText.substring(0, 400));

        if (allText.trim().length > 20) {
            showStatus('✅ Mətn çıxarıldı!', 'success');
            return allText;
        }

        throw new Error('PDF-dən mətn çıxarıla bilmədi');

    } catch (error) {
        console.error('PDF processing error:', error);
        throw error;
    }
}

// OCR only the specified page numbers (Tesseract.js v5 API)
async function processWithOCRPages(pdf, pageNumbers) {
    showStatus('OCR başladılır...', 'info');

    // workerBlobURL:false → worker runs at chrome-extension:// URL directly.
    // From a chrome-extension:// worker, fetch('chrome-extension://...') works fine,
    // so standard createWorker('eng') with langPath works without any manual FS writes.
    let worker;
    try {
        // gzip:false is CRITICAL — default is true, worker appends '.gz' to filename.
        // We have eng.traineddata (uncompressed), not eng.traineddata.gz.
        // cacheMethod:'none' skips IndexedDB lookup, goes straight to fetch.
        worker = await Tesseract.createWorker('eng', 1, {
            workerBlobURL: false,
            workerPath: chrome.runtime.getURL('libs/tesseract-worker.min.js'),
            corePath: chrome.runtime.getURL('libs/tesseract-core/'),
            langPath: chrome.runtime.getURL('libs/tesseract-core/'),
            gzip: false,
            cacheMethod: 'none',
            logger: m => {
                if (m.status === 'recognizing text' && m.progress) {
                    showStatus(`OCR: ${Math.round(m.progress * 100)}%`, 'info');
                }
            }
        });

        console.log('✅ Tesseract v5 hazırdır');

        let allText = '';
        for (const pageNum of pageNumbers) {
            showStatus(`🔍 Səhifə ${pageNum} OCR...`, 'info');
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const { data: { text } } = await worker.recognize(canvas);
            allText += `\n\n--- Səhifə ${pageNum} ---\n` + text;
            console.log(`✅ Səhifə ${pageNum} OCR (${text.length} xarakter):`, text.substring(0, 150));
        }

        return allText;
    } finally {
        if (worker) await worker.terminate();
    }
}

// Simple PDF text extraction using browser APIs
async function extractTextFromPDF(arrayBuffer) {
    console.log('Note: Using OCR instead of text extraction');
    return '';
}

// Post-process OCR text to fix common Azerbaijani character recognition errors
function fixAzerbaijaniOCR(text) {
    const corrections = [
        // Common uppercase substitutions
        [/AZERBAYCAN|AZAREAYCAN|AZ[Ee]RBAYCAN/g,  'AZƏRBAYCAN'],
        [/RESPUBLIKAS[Iİ]/g,                        'RESPUBLİKASI'],
        [/D[Oo][Vv][Ll][Aa][Tt]/g,                 'DÖVLƏT'],
        [/G[Oo][Mm][Rr][Uu][Kk]|G[O0]MR\{,K|GOMR[{(]K/g, 'GÖMRÜK'],
        [/KOM[Iİ]T[Ee][Ss][Iİ]|[Oo]M[Ii]TAST/g,  'KOMİTƏSİ'],
        [/M[Ee][Rr][Kk][Ee][Zz][Iİ]|MaRKazi/g,   'MƏRKƏZİ'],
        [/XIDM[Ee]T[Iİ]/g,                         'XİDMƏTİ'],
        [/B[Ee]YANNAM[Ee]/g,                        'BƏYANNAMƏ'],
        [/G[Oo]NDaR[Ee]N/g,                        'GÖNDƏRƏNi'],
        [/[Iİ]XRACATCI/g,                          'İXRACATÇI'],
        [/UNVAN/g,                                  'ÜNVAN'],
        // Common lowercase substitutions
        [/azerbaycan|azareaycan/g,  'azərbaycan'],
        [/dovlet|dovlat/g,          'dövlət'],
        [/gomruk|gömruk/g,         'gömrük'],
        [/komitesi/g,               'komitəsi'],
        [/merkezi/g,                'mərkəzi'],
        // Bracket/brace fixes that OCR confuses with letters
        [/\{,/g, 'Ü'],
        [/\{/g,  'Ə'],
    ];

    let fixed = text;
    for (const [pattern, replacement] of corrections) {
        fixed = fixed.replace(pattern, replacement);
    }
    return fixed;
}

// This function is injected directly into the page - must be fully self-contained
function injectAndFill(extractedText) {
    const currentUrl = window.location.href;
    console.log('🚀 Direct inject: form doldurulur...', currentUrl);

    function triggerEvents(input, value) {
        // Must use the correct prototype: textarea has its own value setter
        const proto = (input.tagName === 'TEXTAREA')
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
        if (nativeSetter && nativeSetter.set) {
            nativeSetter.set.call(input, value);
        } else {
            input.value = value;
        }
        ['focus', 'input', 'change', 'keydown', 'keyup', 'blur'].forEach(ev => {
            input.dispatchEvent(new Event(ev, { bubbles: true }));
        });
    }

    function highlight(input) {
        input.style.border = '3px solid #28a745';
        input.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            input.style.border = '';
            input.style.backgroundColor = '';
        }, 3000);
    }

    // ── TURANBANK ──────────────────────────────────────────────────────────────
    if (currentUrl.includes('mobile2.turanbank.az')) {
        const nameMatch = extractedText.match(/Name[:\s]+([A-Z][A-Z\s&.,'-]+?(?:LLC|CORPORATION|CORP|INC|LTD))/i);
        if (!nameMatch) {
            console.error('❌ Invoice "Name:" tapılmadı');
            return false;
        }
        const companyName = nameMatch[1].trim();
        const passwordInput = document.querySelector('input[type="password"]');
        if (!passwordInput) { console.error('❌ Şifrə input tapılmadı'); return false; }
        triggerEvents(passwordInput, companyName);
        highlight(passwordInput);
        console.log(`✅ Şifrə → "${companyName}"`);
        return true;
    }

    // ── E-GOV.AZ / CUSTOMS ────────────────────────────────────────────────────
    if (currentUrl.includes('e-gov.az') ||
        currentUrl.includes('gbportal.customs.gov.az') ||
        currentUrl.includes('custom.gov.az')) {

        // Log full OCR text for debugging
        console.log('📄 Tam OCR mətni:\n', extractedText);

        // ── Company Name extraction ──────────────────────────────────────────────
        // PDF format: "Bank Name : BANK OF AMERICA Name: GLB LOGISTICS CORPORATION SWIFT"
        // We want the company (before SWIFT), not the bank name.
        let companyName = null;
        const namePatterns = [
            // "Name: COMPANY LLC/CORP/INC SWIFT" — stops at SWIFT/Account keyword
            /Name\s*:\s*([\w][\w\s.,&'-]+?(?:LLC|CORP(?:ORATION)?|INC|LTD|CO\.|COMPANY|GROUP|TRADING|IMPORT|EXPORT))\s+(?:SWIFT|Account|Routing)/i,
            // Shipper/Exporter/Sender fields (customs/invoice)
            /(?:Shipper|Seller|Exporter|Consignor|G[oö]nd[eə]r[eə]n)\s*[:\-]\s*([^\n]{3,80})/i,
            // "Company Name:" field
            /(?:Company\s*Name|Firma\s*Ad[iı])\s*[:\-]\s*([^\n]{3,80})/i,
            // Any line that is entirely a company name (has LLC/CORP/INC/LTD suffix)
            /^([\w][\w\s.,&'-]+(?:LLC|CORP(?:ORATION)?|INC|LTD))\s*$/im,
        ];
        for (const pat of namePatterns) {
            const m = extractedText.match(pat);
            if (m && m[1] && m[1].trim().length > 2) { companyName = m[1].trim(); break; }
        }

        // ── Company Address extraction ───────────────────────────────────────────
        // PDF format: "COMPANY Address: 30 N GOULD ST STE R. SHERIDAN WY 82801 ,USA Tax ID: ..."
        // We want just the street address, stopping before "Tax", "USA", etc.
        let companyAddress = null;
        const addrPatterns = [
            // "Address: ... USA" — capture everything up to (but not including) "Tax" or "AOLMINT"
            /(?:COMPANY\s+)?Address\s*:\s*([^,\n]{5,100}(?:,\s*[A-Z]{2}\s+\d{5})?)\s*(?=,?\s*(?:USA|Tax\s|AOLMINT|$))/i,
            // Fallback: "Address:" then trim at first comma+state or just 80 chars
            /(?:Address|Adres|[UÜ]nvan)\s*[:\-]\s*([^\n]{5,80})/i,
            /(?:Street|City)\s*[:\-]\s*([^\n]{5,80})/i,
        ];
        for (const pat of addrPatterns) {
            const m = extractedText.match(pat);
            if (m && m[1] && m[1].trim().length > 4) {
                // Strip trailing noise: "Tax ID...", extra spaces
                companyAddress = m[1].trim().replace(/\s*(,?\s*USA.*|Tax\s+ID.*)$/i, '').trim();
                break;
            }
        }

        console.log('📦 Məlumatlar:', { companyName, companyAddress });

        // ── Form field filling ───────────────────────────────────────────────────
        // Searches for label text in ALL element types; checks siblings and parent row.
        // Also logs all visible td/label elements so we can debug label mismatches.
        function fillFirstEmptyByLabel(labelTexts, value) {
            if (!value) return false;

            // Normalize for comparison: lowercase + collapse whitespace
            const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
            const targets = labelTexts.map(normalize);

            const allCells = document.querySelectorAll('td, th, label, span, b, div, p, li');
            for (const cell of allCells) {
                const raw = (cell.innerText || cell.textContent || '').trim();
                const cellNorm = normalize(raw);

                // Exact normalized match OR the cell text IS one of the targets
                if (!targets.some(t => cellNorm === t || raw === t)) continue;

                // Try next sibling, parent's next sibling, and any input inside parent row
                const candidates = [
                    cell.nextElementSibling,
                    cell.parentElement?.nextElementSibling,
                    cell.closest('tr')?.querySelector('input, textarea'),
                ];
                for (const cand of candidates) {
                    if (!cand) continue;
                    const inp = (cand.tagName === 'INPUT' || cand.tagName === 'TEXTAREA')
                        ? cand
                        : cand.querySelector('input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea');
                    if (inp && !inp.disabled && !inp.readOnly && inp.value === '') {
                        triggerEvents(inp, value);
                        highlight(inp);
                        console.log(`✅ "${raw}" → "${value}"`);
                        return true;
                    }
                }
            }
            // Debug: show what labels ARE visible on the page
            const found = [...document.querySelectorAll('td, th, label')].map(el => `"${(el.innerText||'').trim()}"`).filter(s => s.length > 2 && s.length < 30).slice(0, 30);
            console.warn(`⚠ Label tapılmadı: ${labelTexts} | Mövcud labellar: ${found.join(', ')}`);
            return false;
        }

        let filled = 0;
        if (fillFirstEmptyByLabel(['Adı', 'Ad\u0131', 'Adi'], companyName)) filled++;
        if (fillFirstEmptyByLabel(['Ünvan', 'Unvan', '\u00DCnvan'], companyAddress)) filled++;

        console.log(`✅ ${filled} sahə dolduruldu`);
        return filled > 0;
    }

    return false;
}