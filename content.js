// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillForm') {
        try {
            const success = fillFormFields(request.text);
            sendResponse({ success: success });
        } catch (error) {
            console.error('Form doldurma xətası:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    return true;
});

// Auto-detect current site and apply appropriate logic
function detectSiteAndStrategy(text) {
    const currentUrl = window.location.href;
    
    // Turanbank - Test site
    if (currentUrl.includes('mobile2.turanbank.az')) {
        return fillTuranbankForm(text);
    }
    
    // E-gov, customs sites
    if (currentUrl.includes('e-gov.az') || 
        currentUrl.includes('gbportal.customs.gov.az') || 
        currentUrl.includes('custom.gov.az')) {
        return fillCustomsForm(text);
    }
    
    return false;
}

// Fill Turanbank test form
function fillTuranbankForm(text) {
    console.log('🏦 Turanbank formu doldurulur...');
    
    // Extract "Name:" field value from Invoice section
    const invoiceNamePattern = /(?:Invoice[\s\S]*?)?Name:\s*([A-Z\s&.,-]+(?:LLC|CORPORATION|CORP|INC|LTD)?)/i;
    const match = text.match(invoiceNamePattern);
    
    if (!match || !match[1]) {
        console.error('❌ Invoice "Name:" field tapılmadı');
        return false;
    }
    
    const companyName = match[1].trim();
    console.log(`✅ Invoice Name tapıldı: "${companyName}"`);
    
    // Find password input field
    // Turanbank uses different selectors, try multiple approaches
    const passwordSelectors = [
        'input[type="password"]',
        'input[name*="password" i]',
        'input[name*="sifre" i]',
        'input[placeholder*="ifr" i]',
        'input[id*="password" i]',
        'input.form-control[type="password"]'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
        passwordInput = document.querySelector(selector);
        if (passwordInput) {
            console.log(`✅ Şifrə field tapıldı: ${selector}`);
            break;
        }
    }
    
    if (!passwordInput) {
        console.error('❌ Şifrə field tapılmadı');
        return false;
    }
    
    // Fill the password field with company name
    passwordInput.value = companyName;
    triggerInputEvents(passwordInput);
    
    console.log(`✅ Şifrə field dolduruldu: "${companyName}"`);
    
    // Highlight the field
    passwordInput.style.border = '3px solid #28a745';
    passwordInput.style.backgroundColor = '#d4edda';
    
    setTimeout(() => {
        passwordInput.style.border = '';
        passwordInput.style.backgroundColor = '';
    }, 3000);
    
    return true;
}

// Fill customs/e-gov forms (original logic)
function fillCustomsForm(text) {
    console.log('🏛️ Gömrük formu doldurulur...');
    const data = parseExtractedText(text);
    
    let filledCount = 0;
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea:not([name="Message"]):not([id="Message"]):not([name="txtMessage"])');
    
    console.log(`📊 Tapılan input sayı: ${inputs.length}`);
    
    inputs.forEach((input, index) => {
        // Skip contact form fields
        const parentText = input.closest('div')?.textContent || '';
        if (parentText.includes('Ad, Soyad') || parentText.includes('E-mail') || 
            input.name === 'Name' || input.name === 'txtMail' || input.name === 'txtPhone') {
            console.log(`⏭️ Skipping contact form field: ${input.name}`);
            return;
        }
        
        const fieldName = (input.name || input.id || input.placeholder || input.className || '').toLowerCase();
        const fieldLabel = getFieldLabel(input);
        
        console.log(`Field ${index}: name="${input.name}", id="${input.id}", placeholder="${input.placeholder}", label="${fieldLabel}"`);
        
        // Skip if field already filled
        if (input.value && input.value.length > 3) {
            console.log(`⏭️ Field already filled: ${input.name}`);
            return;
        }
        
        // Company Name
        if (data.companyName && (
            fieldLabel.includes('Adı') ||
            fieldLabel.includes('Göndərən') ||
            fieldLabel.includes('İxracatçı') ||
            fieldLabel.includes('İxrac') ||
            fieldLabel.toLowerCase().includes('adi') ||
            (input.tagName === 'TEXTAREA' && fieldLabel.includes('2.'))
        )) {
            input.value = data.companyName;
            triggerInputEvents(input);
            filledCount++;
            console.log(`✅ Şirkət adı dolduruldu: ${data.companyName}`);
            return;
        }
        
        // Company Address
        if (data.companyAddress && (
            fieldLabel.includes('Ünvan') ||
            fieldLabel.includes('Unvan') ||
            fieldLabel.toLowerCase().includes('ünvan') ||
            fieldLabel.toLowerCase().includes('unvan') ||
            (input.tagName === 'TEXTAREA' && fieldLabel.includes('Address'))
        )) {
            input.value = data.companyAddress;
            triggerInputEvents(input);
            filledCount++;
            console.log(`✅ Ünvan dolduruldu: ${data.companyAddress}`);
            return;
        }
        
        // VOEN
        if (data.voen && (
            fieldLabel.includes('VÖEN') ||
            fieldLabel.includes('VOEN') ||
            fieldLabel.toLowerCase().includes('vöen') ||
            fieldLabel.toLowerCase().includes('voen') ||
            input.name.toLowerCase() === 'voen'
        )) {
            input.value = data.voen;
            triggerInputEvents(input);
            filledCount++;
            console.log(`✅ VÖEN dolduruldu: ${data.voen}`);
            return;
        }
        
        // VIN
        if (data.vin && (
            fieldLabel.includes('VIN') ||
            fieldLabel.toLowerCase().includes('vin')
        )) {
            input.value = data.vin;
            triggerInputEvents(input);
            filledCount++;
            console.log(`✅ VIN dolduruldu: ${data.vin}`);
            return;
        }
        
        // Notes
        if (data.companyName && (
            fieldLabel.includes('Qeyd') ||
            fieldLabel.toLowerCase().includes('qeyd') ||
            fieldLabel.toLowerCase().includes('note')
        )) {
            input.value = `${data.companyName} - ${data.companyAddress || ''}`;
            triggerInputEvents(input);
            filledCount++;
            console.log(`✅ Qeyd dolduruldu`);
            return;
        }
    });
    
    console.log(`✅ ${filledCount} sahə dolduruldu`);
    highlightFilledFields();
    
    return filledCount > 0;
}

// Fill form fields based on extracted text
function fillFormFields(text) {
    console.log('Çıxarılmış mətn:', text);
    
    // Auto-detect site and apply appropriate strategy
    return detectSiteAndStrategy(text);
}

// Helper function to get field label
function getFieldLabel(input) {
    // Try to find associated label
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent;
    }
    
    // Try to find parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent;
    
    // Try previous sibling
    let prev = input.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN')) {
        return prev.textContent;
    }
    
    return '';
}

// Helper function to trigger events
function triggerInputEvents(input) {
    // Focus on the input
    input.focus();
    
    // Trigger multiple events to ensure the form detects changes
    const events = [
        new Event('focus', { bubbles: true }),
        new Event('input', { bubbles: true }),
        new Event('change', { bubbles: true }),
        new Event('keydown', { bubbles: true }),
        new Event('keyup', { bubbles: true }),
        new Event('blur', { bubbles: true })
    ];
    
    events.forEach(event => {
        input.dispatchEvent(event);
    });
    
    // Also try to trigger native setter (for React/Vue forms)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
    ).set;
    
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
    ).set;
    
    if (input.tagName === 'INPUT' && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, input.value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
        nativeTextAreaValueSetter.call(input, input.value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Blur to complete the input
    input.blur();
    
    console.log(`🔔 Event-lər trigger olundu: ${input.name || input.id}`);
}

// Parse extracted text to find specific information
function parseExtractedText(text) {
    const data = {};
    
    // Extract Company Information (GLB LOGISTICS, etc)
    const companyPatterns = [
        /(?:Name:|Company:|COMPANY Address:)\s*([A-Z\s&.,-]+(?:LLC|CORPORATION|CORP|INC|LTD)?)/i,
        /([A-Z\s&.,-]+(?:LOGISTICS|CORPORATION|CORP|LLC|INC|LTD))/,
        /GLB LOGISTICS CORP(?:ORATION)?/i
    ];
    
    for (const pattern of companyPatterns) {
        const companyMatch = text.match(pattern);
        if (companyMatch && companyMatch[1]) {
            data.companyName = companyMatch[1].trim();
            break;
        }
    }
    
    // Extract Company Address (30 N GOULD ST, NEW YORK, etc)
    const addressPatterns = [
        /(?:COMPANY Address:|Address:)\s*([^\n]+(?:USA|AMERICA|AMERİKA))/i,
        /(\d+\s+[A-Z\s,]+(?:ST|STREET|AVE|AVENUE|ROAD|RD)[^,\n]+,\s*[A-Z\s]+,\s*[A-Z]{2}\s+\d{5})/i,
        /(NEW YORK[^,\n]*(?:USA|AMERICA|AMERİKA|BİRLƏŞMİŞ ŞTATLAR))/i
    ];
    
    for (const pattern of addressPatterns) {
        const addrMatch = text.match(pattern);
        if (addrMatch && addrMatch[1]) {
            data.companyAddress = addrMatch[1].trim();
            break;
        }
    }
    
    // Extract VOEN/Tax ID (99-0667903)
    const voenMatch = text.match(/(?:Tax ID:|VÖEN:?)\s*(\d{2}-\d{7}|\d{10})/i);
    if (voenMatch) {
        data.voen = voenMatch[1];
    }
    
    // Extract VIN number
    const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (vinMatch) {
        data.vin = vinMatch[1];
    }
    
    // Extract Personal FIN code (Azerbaijani ID format: 7 letters/digits)
    const finMatch = text.match(/\b([A-Z0-9]{7})\b/);
    if (finMatch && finMatch[1].length === 7) {
        data.idNumber = finMatch[1];
    }
    
    // Extract passport number (format: AA + 7 digits or AZE + 7 digits)
    const passportMatch = text.match(/\b(AA\d{7}|AZE\d{7})\b/i);
    if (passportMatch) {
        data.passport = passportMatch[1].toUpperCase();
    }
    
    // Extract phone number
    const phoneMatch = text.match(/(\+994|994)?[\s-]?(\(?\d{2}\)?)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
    if (phoneMatch) {
        data.phone = phoneMatch[0].replace(/\s+/g, '');
    }
    
    // Extract email
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
        data.email = emailMatch[0];
    }
    
    // Extract personal name from ID card (ƏLƏSGƏROV ARZU ŞİRAZ OĞLU pattern)
    const idCardNameMatch = text.match(/SOYADI\/SURNAME[:\s]+([A-ZƏĞİÖŞÜ]+)[^\n]*ADI\/GIVEN NAME[:\s]+([A-ZƏĞİÖŞÜ]+)[^\n]*(?:ATASININ ADI|PATRONYMIC)[:\s]+([A-ZƏĞİÖŞÜa-zəğıöşü\s]+)/i);
    if (idCardNameMatch) {
        data.surname = idCardNameMatch[1];
        data.name = idCardNameMatch[2];
        data.fatherName = idCardNameMatch[3].replace(/\s+OĞLU|\s+QIZI/i, '').trim();
    } else {
        // Try alternative name patterns
        const nameMatch = text.match(/(?:Ad|Name|Adı|İsim|Buyer)[\s:]+([A-ZƏĞİÖŞÜ][a-zəğıöşü\s]+)/i);
        if (nameMatch) {
            data.name = nameMatch[1].trim();
        }
        
        const surnameMatch = text.match(/(?:Soyad|Surname|Soyadı|Familiya)[\s:]+([A-ZƏĞİÖŞÜ][a-zəğıöşü]+)/i);
        if (surnameMatch) {
            data.surname = surnameMatch[1];
        }
        
        const fatherMatch = text.match(/(?:Ata adı|Father|Atası)[\s:]+([A-ZƏĞİÖŞÜ][a-zəğıöşü]+)/i);
        if (fatherMatch) {
            data.fatherName = fatherMatch[1];
        }
    }
    
    // Extract personal address
    const personalAddressMatch = text.match(/(?:Ünvan[,:\s]+|Address[,:\s]+)(AZ\d{4}[^\n]+)/i);
    if (personalAddressMatch) {
        data.address = personalAddressMatch[1].trim();
    }
    
    console.log('Çıxarılmış məlumat:', data);
    return data;
}

// Highlight filled fields with animation
function highlightFilledFields() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes gomruk-fill-highlight {
            0% { background-color: #fff3cd; }
            100% { background-color: #d4edda; }
        }
        .gomruk-filled {
            animation: gomruk-fill-highlight 1s ease;
            background-color: #d4edda !important;
            border: 2px solid #28a745 !important;
        }
    `;
    document.head.appendChild(style);
    
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea');
    inputs.forEach(input => {
        if (input.value) {
            input.classList.add('gomruk-filled');
            setTimeout(() => {
                input.classList.remove('gomruk-filled');
            }, 2000);
        }
    });
}

// Initialize
console.log('Gömrük Extension content script yükləndi');

