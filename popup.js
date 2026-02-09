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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && (tabs[0].url.includes('e-gov.az') || tabs[0].url.includes('gbportal.customs.gov.az') || tabs[0].url.includes('custom.gov.az'))) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'aspnetForm',
                    text: extractedPdfText
                }, (fillResponse) => {
                    showProgress(100);
                    if (fillResponse && fillResponse.success) {
                        showStatus('✅ Form uğurla dolduruldu!', 'success');
                    } else {
                        showStatus('⚠️ Mətn çıxarıldı, ancaq form doldurula bilmədi', 'error');
                    }
                    processBtn.disabled = false;
                    setTimeout(hideProgress, 2000);
                });
            } else {
                showProgress(100);
                showStatus('⚠️ Mətn çıxarıldı. Form doldurmaq üçün gömrük saytına keçin', 'info');
                processBtn.disabled = false;
                setTimeout(hideProgress, 2000);
            }
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
            const ocrText = await processWithOCR(pdf);
            if (ocrText && ocrText.trim().length > 50) {
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
        // Initialize Tesseract worker
        const worker = await Tesseract.createWorker({
            workerPath: chrome.runtime.getURL('libs/tesseract.min.js'),
            corePath: chrome.runtime.getURL('libs/tesseract-core/tesseract-core.wasm.js'),
            langPath: chrome.runtime.getURL('libs/tesseract-core/'),
            logger: m => {
                if (m.status === 'recognizing text' && m.progress) {
                    const percent = Math.round(m.progress * 100);
                    showStatus(`OCR: ${percent}%`, 'info');
                }
            }
        });

        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        console.log('✅ Tesseract hazırdır');

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
    // This function is kept for reference but not used anymore
    // We now use OCR with Tesseract.js
    console.log('Note: Using OCR instead of text extraction');
    return '';
}