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

// Process PDF - try text extraction first, then OCR if needed
async function processPDF(arrayBuffer) {
    try {
        showStatus('PDF yüklənir...', 'info');
        showProgress(20);

        // Load PDF.js
        const pdfLib = window['pdfjs-dist/build/pdf'];
        pdfLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');

        // Load PDF
        const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        console.log(`📄 PDF yükləndi: ${pdf.numPages} səhifə`);

        showStatus('Mətn çıxarılır...', 'info');
        showProgress(40);

        let allText = '';

        // First, try to extract text (if PDF has text layer)
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const pageText = textContent.items.map(item => item.str).join(' ');
            allText += pageText + '\n\n';

            showProgress(40 + (pageNum / pdf.numPages) * 50);
        }

        console.log(`📝 Çıxarılmış mətn uzunluğu: ${allText.length}`);
        console.log(`📝 Mətn preview:`, allText.substring(0, 300));

        // Check if we got meaningful text
        if (allText.trim().length > 100) {
            console.log('✅ PDF-də mətn layer tapıldı');
            showStatus('✅ Mətn çıxarıldı!', 'success');
            return allText;
        }

        // If no text found, PDF is likely scanned - try OCR
        console.log('⚠️ PDF mətn layer yoxdur, OCR cəhd edilir...');
        showStatus('🔍 Scan edilmiş PDF, OCR işləyir...', 'info');
        showProgress(50);

        // Try OCR with Tesseract
        try {
            const rawOcrText = await processWithOCR(pdf);
            if (rawOcrText && rawOcrText.trim().length > 50) {
                const ocrText = fixAzerbaijaniOCR(rawOcrText);
                console.log('✅ Azərbaycan OCR düzəldilməsi tətbiq edildi');
                return ocrText;
            }
        } catch (ocrError) {
            console.error('❌ OCR xətası:', ocrError);
            // OCR failed, show helpful message
            throw new Error(
                'PDF scan edilmiş şəkildir və OCR Chrome Extension məhdudiyyətləri üzündən işləmir.\n\n' +
                '✅ Həll yolu:\n' +
                '1. PDF-i online OCR tool ilə text PDF-ə çevirin:\n' +
                '   - https://www.onlineocr.net/\n' +
                '   - https://www.ilovepdf.com/ocr_pdf\n' +
                '2. Yaxud PDF-dəki məlumatları manual olaraq kopyalayıb yapışdırın'
            );
        }

        // If both failed
        throw new Error('PDF-dən mətn çıxarıla bilmədi');

    } catch (error) {
        console.error('PDF processing error:', error);
        throw error;
    }
}

// Try OCR processing (may fail due to Manifest V3 restrictions)
async function processWithOCR(pdf) {
    try {
        // Use CDN for language data (eng + aze) for proper character recognition
        const TESSDATA_CDN = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/aze_best@1.0.0/data/';
        const ENG_CDN = 'https://tessdata.projectnaptha.com/4.0.0_fast/';

        showStatus('Dil paketi yüklənir...', 'info');

        const worker = await Tesseract.createWorker({
            workerPath: chrome.runtime.getURL('libs/tesseract.min.js'),
            corePath: chrome.runtime.getURL('libs/tesseract-core/tesseract-core.wasm.js'),
            langPath: ENG_CDN,
            logger: m => {
                if (m.status === 'recognizing text' && m.progress) {
                    const percent = Math.round(m.progress * 100);
                    showStatus(`OCR: ${percent}%`, 'info');
                } else if (m.status === 'loading language traineddata') {
                    showStatus('Dil faylı yüklənir...', 'info');
                }
            }
        });

        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        console.log('✅ Tesseract hazırdır (eng)');

        let allText = '';

        // Process each page with OCR
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
            showStatus(`🔍 Səhifə ${pageNum} OCR...`, 'info');

            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });

            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Run OCR
            const { data: { text } } = await worker.recognize(canvas);
            allText += text + '\n\n';

            console.log(`✅ Səhifə ${pageNum} OCR:`, text.substring(0, 100));
        }

        await worker.terminate();
        return allText;

    } catch (error) {
        console.error('OCR error:', error);
        throw error;
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

// This function is injected directly into the page when content.js is not available
function injectAndFill(extractedText) {
    const currentUrl = window.location.href;
    console.log('🚀 Direct inject: form doldurulur...', currentUrl);

    function triggerReactEvents(input, value) {
        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (nativeInputSetter && nativeInputSetter.set) {
            nativeInputSetter.set.call(input, value);
        } else {
            input.value = value;
        }
        ['focus', 'input', 'change', 'keydown', 'keyup', 'blur'].forEach(eventName => {
            input.dispatchEvent(new Event(eventName, { bubbles: true }));
        });
    }

    // Turanbank: fill password field with Invoice Name value
    if (currentUrl.includes('mobile2.turanbank.az')) {
        // Lazy match - stops exactly at the company suffix (CORPORATION, LLC, etc.)
        const nameMatch = extractedText.match(/Name[:\s]+([A-Z][A-Z\s&.,'-]+?(?:LLC|CORPORATION|CORP|INC|LTD))/i);
        if (!nameMatch) {
            console.error('❌ Invoice "Name:" tapılmadı. Mətn:', extractedText.substring(0, 500));
            return false;
        }
        const companyName = nameMatch[1].trim();
        console.log(`✅ Invoice Name: "${companyName}"`);

        const passwordInput = document.querySelector('input[type="password"]');
        if (!passwordInput) {
            console.error('❌ Şifrə input tapılmadı');
            return false;
        }

        triggerReactEvents(passwordInput, companyName);
        passwordInput.style.border = '3px solid #28a745';
        passwordInput.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            passwordInput.style.border = '';
            passwordInput.style.backgroundColor = '';
        }, 3000);

        console.log(`✅ Şifrə field dolduruldu: "${companyName}"`);
        return true;
    }

    // e-gov.az, gbportal.customs.gov.az, custom.gov.az - customs forms
    if (currentUrl.includes('e-gov.az') ||
        currentUrl.includes('gbportal.customs.gov.az') ||
        currentUrl.includes('custom.gov.az')) {
        return fillEGovForm(extractedText, triggerReactEvents);
    }

    return false;
}

// Fill e-gov.az ASP.NET customs form
function fillEGovForm(text, triggerFn) {
    console.log('🏛️ e-gov.az formu doldurulur...');

    // --- Parse data from PDF text ---
    const companyNameMatch = text.match(/Name[:\s]+([A-Z][A-Z\s&.,'-]+?(?:LLC|CORPORATION|CORP|INC|LTD))/i);
    const companyName = companyNameMatch ? companyNameMatch[1].trim() : null;

    const addressMatch = text.match(/(?:COMPANY\s+Add(?:ress|Tes+)[:\s]+)([^\n]{5,})/i);
    const companyAddress = addressMatch ? addressMatch[1].trim() : null;

    const voenMatch = text.match(/Tax\s+ID[:\s]+([0-9-]{5,})/i);
    const voen = voenMatch ? voenMatch[1].trim() : null;

    console.log('📦 Məlumatlar:', { companyName, companyAddress, voen });

    // --- Find the "2.Göndərən/İxracatçı" section first, then fill within it ---
    function findSectionByTitle(titles) {
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const t = el.innerText?.trim() || '';
            if (titles.some(title => t.includes(title)) && el.children.length < 5) {
                // Return the closest table or container that holds the section
                return el.closest('table, div, fieldset, tbody') || el.parentElement;
            }
        }
        return null;
    }

    // Fill input near a label text WITHIN a given container
    function fillInContainer(container, labelTexts, value) {
        if (!value || !container) return false;
        const cells = container.querySelectorAll('td, th, label, span');
        for (const cell of cells) {
            const cellText = cell.innerText?.trim() || '';
            if (!labelTexts.some(lbl => cellText === lbl)) continue;

            const candidates = [
                cell.nextElementSibling,
                cell.parentElement?.nextElementSibling,
            ];
            for (const cand of candidates) {
                if (!cand) continue;
                const input = cand.querySelector('input[type="text"], input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea');
                if (input) {
                    triggerFn(input, value);
                    input.style.border = '3px solid #28a745';
                    setTimeout(() => { input.style.border = ''; }, 3000);
                    console.log(`✅ "${cellText}" → "${value}"`);
                    return true;
                }
            }
        }
        return false;
    }

    // Find "2.Göndərən/İxracatçı" section
    const senderSection = findSectionByTitle(['2.Göndərən', 'Göndərən/İxracatçı', '2.Gönd']);
    console.log('📌 Göndərən bölməsi:', senderSection ? 'tapıldı' : 'tapılmadı');

    let filledCount = 0;

    if (senderSection) {
        if (fillInContainer(senderSection, ['Adı'], companyName)) filledCount++;
        if (fillInContainer(senderSection, ['Ünvan', 'Unvan'], companyAddress)) filledCount++;
        if (fillInContainer(senderSection, ['VÖEN', 'VOEN'], voen)) filledCount++;
    } else {
        // Fallback: scan entire page but skip already-filled inputs
        const allCells = document.querySelectorAll('td, th, label');
        const targets = [
            { labels: ['Adı'], value: companyName },
            { labels: ['Ünvan', 'Unvan'], value: companyAddress },
            { labels: ['VÖEN', 'VOEN'], value: voen },
        ];
        let firstMatch = true;
        for (const cell of allCells) {
            const cellText = cell.innerText?.trim() || '';
            for (const target of targets) {
                if (!target.value) continue;
                if (!target.labels.includes(cellText)) continue;
                const row = cell.parentElement;
                const input = row?.nextElementSibling?.querySelector('input, textarea') ||
                              cell.nextElementSibling?.querySelector('input, textarea');
                if (input && !input.value && firstMatch) {
                    triggerFn(input, target.value);
                    input.style.border = '3px solid #28a745';
                    setTimeout(() => { input.style.border = ''; }, 3000);
                    console.log(`✅ fallback "${cellText}" → "${target.value}"`);
                    filledCount++;
                    firstMatch = false;
                    break;
                }
            }
        }
    }

    console.log(`✅ Toplam ${filledCount} sahə dolduruldu`);
    return filledCount > 0;
}