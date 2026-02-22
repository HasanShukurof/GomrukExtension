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
                        const results = await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: injectAndFill,
                            args: [extractedPdfText]
                        });
                        showProgress(100);
                        const success = results && results[0] && results[0].result;
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
                console.warn('⚠️ OCR xətası (davam edilir):', ocrErr.message);
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

// OCR only the specified page numbers
async function processWithOCRPages(pdf, pageNumbers) {
    const ENG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_fast/';
    showStatus('OCR başladılır...', 'info');

    const worker = await Tesseract.createWorker({
        workerPath: chrome.runtime.getURL('libs/tesseract.min.js'),
        corePath: chrome.runtime.getURL('libs/tesseract-core/tesseract-core.wasm.js'),
        langPath: ENG_CDN,
        logger: m => {
            if (m.status === 'recognizing text' && m.progress) {
                showStatus(`OCR: ${Math.round(m.progress * 100)}%`, 'info');
            } else if (m.status === 'loading language traineddata') {
                showStatus('Dil faylı yüklənir...', 'info');
            }
        }
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    console.log('✅ Tesseract hazırdır');

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

    await worker.terminate();
    return allText;
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
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
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

        // Parse PDF text - only company name and address (NOT VÖEN)
        const nameMatch = extractedText.match(/Name[:\s]+([A-Z][A-Z\s&.,'-]+?(?:LLC|CORPORATION|CORP|INC|LTD))/i);
        const companyName = nameMatch ? nameMatch[1].trim() : null;

        const addrMatch = extractedText.match(/(?:COMPANY\s+Add(?:ress|Tes+)[:\s]+)([^\n]{5,})/i);
        const companyAddress = addrMatch ? addrMatch[1].trim() : null;

        console.log('📦 Məlumatlar:', { companyName, companyAddress });

        // Find the "2.Göndərən/İxracatçı" section container
        let senderSection = null;
        for (const el of document.querySelectorAll('td, th, div, span, b, strong')) {
            const t = (el.innerText || '').trim();
            if ((t.includes('2.Göndərən') || t.includes('Göndərən/İxracatçı')) && el.children.length < 4) {
                senderSection = el.closest('table') || el.closest('div') || el.parentElement;
                break;
            }
        }
        console.log('📌 Göndərən bölməsi:', senderSection ? 'tapıldı' : 'tapılmadı');

        // Fill a field by matching its label text within a container
        function fillByLabel(container, labelTexts, value) {
            if (!value) return false;
            const scope = container || document;
            for (const cell of scope.querySelectorAll('td, th, label, span, b')) {
                const cellText = (cell.innerText || '').trim();
                if (!labelTexts.includes(cellText)) continue;

                // Look for input in next sibling or parent's next sibling
                const candidates = [
                    cell.nextElementSibling,
                    cell.parentElement?.nextElementSibling,
                    cell.closest('tr')?.querySelector('input, textarea'),
                ];
                for (const cand of candidates) {
                    if (!cand) continue;
                    const inp = cand.tagName === 'INPUT' || cand.tagName === 'TEXTAREA'
                        ? cand
                        : cand.querySelector('input:not([type="hidden"]):not([type="button"]), textarea');
                    if (inp && !inp.disabled && !inp.readOnly) {
                        triggerEvents(inp, value);
                        highlight(inp);
                        console.log(`✅ "${cellText}" → "${value}"`);
                        return true;
                    }
                }
            }
            return false;
        }

        let filled = 0;
        if (fillByLabel(senderSection, ['Adı'], companyName)) filled++;
        if (fillByLabel(senderSection, ['Ünvan', 'Unvan'], companyAddress)) filled++;

        console.log(`✅ ${filled} sahə dolduruldu`);
        return filled > 0;
    }

    return false;
}