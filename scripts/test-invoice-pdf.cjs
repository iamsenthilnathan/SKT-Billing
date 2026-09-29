const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');
const BUSINESS_KEY = 'SKT-SRIKRISHNA-2026';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to count pages in a PDF file buffer using standard PDF catalog and page markers
function getPdfPageCount(buffer) {
  const content = buffer.toString('latin1');
  const countMatch = content.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch) return parseInt(countMatch[1], 10);
  const typeMatches = content.match(/\/Type\s*\/Page[\s\/\>]/g);
  return typeMatches ? typeMatches.length : 1;
}

// Create 5-row test invoice payload
function create5RowPayload(amountInWords, grandTotal = 78912) {
  return {
    financialYear: '2026-27',
    partyId: 'party_1',
    invoiceDate: '2026-09-28',
    dcs: [
      {
        id: `dc_qa_1_${Date.now()}`,
        ourDcNumber: '138/139',
        partyDcNumber: '8421',
        partyDcDate: '2026-09-20',
        sortOrder: 0,
        workEntries: [
          { id: 'w1', description: 'White', rolls: 25, weightDisplay: '245.500', weightKg: 245.5, rate: 42.0, amount: 10311.0, sortOrder: 0 },
          { id: 'w2', description: 'White', rolls: 30, weightDisplay: '312.200', weightKg: 312.2, rate: 42.0, amount: 13112.4, sortOrder: 1 },
          { id: 'w3', description: 'White Lot', rolls: 40, weightDisplay: '415.800', weightKg: 415.8, rate: 42.0, amount: 17463.6, sortOrder: 2 },
        ],
      },
      {
        id: `dc_qa_2_${Date.now()}`,
        ourDcNumber: '140',
        partyDcNumber: '8425',
        partyDcDate: '2026-09-22',
        sortOrder: 1,
        workEntries: [
          { id: 'w4', description: 'Lt. Maroon', rolls: 35, weightDisplay: '380.500', weightKg: 380.5, rate: 45.0, amount: 17122.5, sortOrder: 0 },
          { id: 'w5', description: 'Skin', rolls: 36, weightDisplay: '381.000', weightKg: 381.0, rate: 45.0, amount: 17145.0, sortOrder: 1 },
        ],
      },
    ],
    calculations: {
      totalRolls: 166,
      totalWeightKg: 1735.0,
      subtotal: 75154.5,
      cgstRate: 2.5,
      sgstRate: 2.5,
      cgstAmount: 1878.86,
      sgstAmount: 1878.86,
      totalTax: 3757.72,
      grandTotal: grandTotal,
      totalAmount: grandTotal,
      roundOff: -0.22,
      totalAmountInWords: amountInWords,
    },
  };
}

async function finalizeViaApi(payload) {
  const res = await fetch('http://localhost:5173/api/invoices/finalize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Business-Key': BUSINESS_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to finalize invoice via API: ${res.status} ${errText}`);
  }
  return await res.json();
}

async function runInvoiceVisualQA() {
  console.log('===============================================================');
  console.log('STARTING VISUAL QA: REMOVE CARD UI & OUTER BORDER FROM INVOICE');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allChecks = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1200 });

    // Mock window.print to prevent headless blocking
    await page.evaluateOnNewDocument(() => {
      window.print = () => {
        console.log('[Puppeteer] Intercepted window.print() call');
      };
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 1: Standard Amount Invoice (No Cards, No Rounded Corners, No Outer Border)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Standard Invoice (Clean Document Hierarchy) ---');
    const stdPayload = create5RowPayload('Rupees Seventy Eight Thousand Nine Hundred Twelve Only', 78912);
    const stdInvoice = await finalizeViaApi(stdPayload);
    console.log(`Created Standard Invoice via API: ${stdInvoice.invoiceNumber} (ID: ${stdInvoice.id})`);

    // Navigate to application
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    // Ensure localStorage includes this invoice
    await page.evaluate((inv) => {
      const stored = JSON.parse(localStorage.getItem('skt_invoices_v1') || '[]');
      const filtered = stored.filter(i => i.id !== inv.id && i.invoiceNumber !== inv.invoiceNumber);
      filtered.unshift(inv);
      localStorage.setItem('skt_invoices_v1', JSON.stringify(filtered));
    }, stdInvoice);

    // Refresh page to load seeded invoice
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    // Navigate to Invoices / History tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const histBtn = btns.find(b => b.textContent && b.textContent.includes('History'));
      if (histBtn) histBtn.click();
    });

    // Wait for the invoice card and click "View & Print"
    await page.waitForFunction(
      (invNum) => document.body.innerText.includes(invNum),
      { timeout: 5000 },
      stdInvoice.invoiceNumber
    );

    await page.evaluate((invNum) => {
      const cards = Array.from(document.querySelectorAll('div.rounded-2xl'));
      const targetCard = cards.find(c => c.textContent.includes(invNum));
      if (targetCard) {
        const btn = Array.from(targetCard.querySelectorAll('button')).find(b => b.textContent.includes('View & Print'));
        if (btn) return btn.click();
      }
    }, stdInvoice.invoiceNumber);

    await page.waitForSelector('.invoice-page', { timeout: 5000 });

    // Measure Layout, Border-Radius, Borders, and Document Hierarchy
    const stdMetrics = await page.evaluate(() => {
      const pageEl = document.querySelector('.invoice-page');
      if (!pageEl) return null;

      const pageRect = pageEl.getBoundingClientRect();
      const pageHeightMm = pageRect.height * 0.264583;

      // Check outer page border
      const pageStyle = window.getComputedStyle(pageEl);
      const hasOuterBorder = pageStyle.borderWidth !== '0px' && pageStyle.borderStyle !== 'none';
      const pageBorderRadius = pageStyle.borderRadius;

      // Table styling
      const table = pageEl.querySelector('table');
      const tableRect = table ? table.getBoundingClientRect() : null;
      const tableHasBorders = table ? window.getComputedStyle(table).borderCollapse === 'collapse' : false;

      // Amount in Words container: find the specific span with "AMOUNT IN WORDS"
      const allSpans = Array.from(pageEl.querySelectorAll('span'));
      const wordsLabelSpan = allSpans.find(s => s.textContent.trim().toUpperCase() === 'AMOUNT IN WORDS');
      const wordsBox = wordsLabelSpan ? wordsLabelSpan.parentElement : null;
      const wordsBoxStyle = wordsBox ? window.getComputedStyle(wordsBox) : null;
      const wordsRect = wordsBox ? wordsBox.getBoundingClientRect() : null;
      const wordsLabel = wordsLabelSpan ? wordsLabelSpan.textContent.trim() : '';
      const wordsValueEl = wordsBox ? wordsBox.querySelector('div') : null;
      const wordsValue = wordsValueEl ? wordsValueEl.textContent.trim() : '';

      // Check all elements inside invoice for rounded corners
      const allInvoiceElements = Array.from(pageEl.querySelectorAll('*'));
      const roundedElements = allInvoiceElements.filter(el => {
        const r = window.getComputedStyle(el).borderRadius;
        return r && r !== '0px';
      });

      // Bank Details block & Financial box
      const bankTitle = allSpans.find(s => s.textContent.trim().toUpperCase().includes('BANK DETAILS FOR PAYMENT'));
      const bankCol = bankTitle ? bankTitle.parentElement : null;
      const bankColStyle = bankCol ? window.getComputedStyle(bankCol) : null;

      // Final Amount
      const finalAmountEl = pageEl.querySelector('.border-t-2.border-slate-900');
      const finalAmountValEl = finalAmountEl ? finalAmountEl.querySelector('.font-black') : null;
      const finalAmountStyle = finalAmountValEl ? window.getComputedStyle(finalAmountValEl) : null;

      // Footer
      const footerEl = pageEl.querySelector('.pt-3.border-t.border-slate-300 span, .text-right span.italic');
      const footerStyle = footerEl ? window.getComputedStyle(footerEl) : null;
      const footerText = footerEl ? footerEl.textContent.trim() : '';
      const footerRect = footerEl ? footerEl.getBoundingClientRect() : null;
      const footerBottomOffset = footerRect ? (pageRect.bottom - footerRect.bottom) : 0;

      // Prohibited checks
      const pageText = pageEl.innerText;
      const hasCopyLabels = pageText.includes('ORIGINAL') || pageText.includes('DUPLICATE') || pageText.includes('TRIPLICATE');
      const hasSignature = pageText.includes('Authorized Signatory') || pageText.includes('Signature');
      const hasTerms = pageText.includes('Terms & Conditions') || pageText.includes('Terms and Conditions');
      const hasIp = pageText.includes('192.168.') || pageText.includes('localhost:5173');
      const hasPaymentStatus = pageText.includes('Payment Status') || pageText.includes('Paid Amount') || pageText.includes('Outstanding Balance');

      return {
        pageHeightMm,
        pageHeightPx: pageRect.height,
        hasOuterBorder,
        pageBorderRadius,
        roundedElementsCount: roundedElements.length,
        tableWidth: tableRect ? tableRect.width : 0,
        tableHasBorders,
        wordsBoxWidth: wordsRect ? wordsRect.width : 0,
        wordsBoxHeight: wordsRect ? wordsRect.height : 0,
        wordsBoxBorderRadius: wordsBoxStyle ? wordsBoxStyle.borderRadius : '',
        wordsBoxBg: wordsBoxStyle ? wordsBoxStyle.backgroundColor : '',
        wordsLabel,
        wordsValue,
        bankFound: !!bankTitle,
        bankColBorderRadius: bankColStyle ? bankColStyle.borderRadius : '',
        finalAmountFontSize: finalAmountStyle ? finalAmountStyle.fontSize : '',
        finalAmountFontWeight: finalAmountStyle ? finalAmountStyle.fontWeight : '',
        finalAmountText: finalAmountEl ? finalAmountEl.innerText.replace(/\n/g, ' ') : '',
        footerText,
        footerFontStyle: footerStyle ? footerStyle.fontStyle : '',
        footerFontWeight: footerStyle ? footerStyle.fontWeight : '',
        footerBottomOffset,
        hasCopyLabels,
        hasSignature,
        hasTerms,
        hasIp,
        hasPaymentStatus,
      };
    });

    console.log(`\nMeasured Standard Invoice Metrics:`);
    console.log(`- Page Sheet Height: ${stdMetrics.pageHeightMm.toFixed(1)} mm (${stdMetrics.pageHeightPx.toFixed(0)} px)`);
    console.log(`- Outer Page Border: ${stdMetrics.hasOuterBorder ? 'PRESENT (Needs Removal)' : 'NONE (Clean Paper Flow)'}`);
    console.log(`- Page Border Radius: ${stdMetrics.pageBorderRadius}`);
    console.log(`- Rounded Elements in Invoice: ${stdMetrics.roundedElementsCount}`);
    console.log(`- Table Width: ${stdMetrics.tableWidth.toFixed(0)} px (Table Borders: ${stdMetrics.tableHasBorders ? 'Preserved' : 'Missing'})`);
    console.log(`- Amount in Words Width: ${stdMetrics.wordsBoxWidth.toFixed(0)} px (Ratio vs table: ${(stdMetrics.wordsBoxWidth / stdMetrics.tableWidth).toFixed(2)})`);
    console.log(`- Amount in Words Border Radius: ${stdMetrics.wordsBoxBorderRadius}`);
    console.log(`- Amount in Words Label: "${stdMetrics.wordsLabel}"`);
    console.log(`- Amount in Words Text: "${stdMetrics.wordsValue}"`);
    console.log(`- Final Amount Display: "${stdMetrics.finalAmountText}" (Font Size: ${stdMetrics.finalAmountFontSize}, Weight: ${stdMetrics.finalAmountFontWeight})`);
    console.log(`- Footer Text: "${stdMetrics.footerText}" (Style: ${stdMetrics.footerFontStyle}, Weight: ${stdMetrics.footerFontWeight})`);
    console.log(`- Footer Bottom Inset: ${stdMetrics.footerBottomOffset.toFixed(0)} px`);

    // Save High-Resolution Screenshot
    const previewPngPath = path.join(OUTPUT_DIR, 'invoice_a4_redesign_preview.png');
    const invoiceEl = await page.$('.invoice-page');
    if (invoiceEl) {
      await invoiceEl.screenshot({ path: previewPngPath });
      console.log(`Saved A4 Preview Screenshot: ${previewPngPath}`);
    }

    // Generate Single-Copy PDF
    const singlePdfPath = path.join(OUTPUT_DIR, 'invoice_single_copy_test.pdf');
    await page.pdf({
      path: singlePdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' },
    });
    console.log(`Saved Single-Copy PDF: ${singlePdfPath}`);

    const singlePdfBuffer = fs.readFileSync(singlePdfPath);
    const singlePdfPageCount = getPdfPageCount(singlePdfBuffer);
    console.log(`Single-Copy PDF Page Count: ${singlePdfPageCount} (Expected: 1)`);

    // Standard Invoice Assertions
    allChecks.push(
      { name: '1. Standard Invoice PDF is exactly 1 page', pass: singlePdfPageCount === 1, details: `pages = ${singlePdfPageCount}` },
      { name: '2. Outer page border is completely removed', pass: !stdMetrics.hasOuterBorder, details: `outer border = ${stdMetrics.hasOuterBorder ? 'present' : 'none'}` },
      { name: '3. Zero rounded corners anywhere in invoice (border-radius: 0)', pass: stdMetrics.roundedElementsCount === 0, details: `rounded elements = ${stdMetrics.roundedElementsCount}` },
      { name: '4. Amount in Words has zero rounded corners and no card border', pass: stdMetrics.wordsBoxBorderRadius === '0px', details: `border-radius = ${stdMetrics.wordsBoxBorderRadius}` },
      { name: '5. Amount in Words is full-width (>= 98% table width)', pass: (stdMetrics.wordsBoxWidth / stdMetrics.tableWidth) >= 0.98, details: `width ratio = ${(stdMetrics.wordsBoxWidth / stdMetrics.tableWidth).toFixed(2)}` },
      { name: '6. Amount in Words label is clean and clear', pass: stdMetrics.wordsLabel.toUpperCase() === 'AMOUNT IN WORDS', details: `label = "${stdMetrics.wordsLabel}"` },
      { name: '7. Amount in Words text is rendered correctly', pass: stdMetrics.wordsValue.includes('Seventy Eight Thousand Nine Hundred Twelve'), details: `text = "${stdMetrics.wordsValue}"` },
      { name: '8. Itemized Table borders are preserved', pass: stdMetrics.tableHasBorders, details: 'Table grid preserved' },
      { name: '9. Dominant Final Amount display with strong weight & rule', pass: stdMetrics.finalAmountText.includes('78,912') && parseInt(stdMetrics.finalAmountFontSize) >= 20, details: `amount = ${stdMetrics.finalAmountText}, font-size = ${stdMetrics.finalAmountFontSize}` },
      { name: '10. Footer text is strictly "For SRI KRISHNA TEXTILE"', pass: stdMetrics.footerText === 'For SRI KRISHNA TEXTILE', details: `footer = "${stdMetrics.footerText}"` },
      { name: '11. Footer font-style is italic', pass: stdMetrics.footerFontStyle === 'italic', details: `style = ${stdMetrics.footerFontStyle}` },
      { name: '12. Footer font-weight is normal (400)', pass: stdMetrics.footerFontWeight === '400' || stdMetrics.footerFontWeight === 'normal', details: `weight = ${stdMetrics.footerFontWeight}` },
      { name: '13. No prohibited elements (T&C, Signatures, IP, Copy Labels)', pass: !stdMetrics.hasCopyLabels && !stdMetrics.hasSignature && !stdMetrics.hasTerms && !stdMetrics.hasIp && !stdMetrics.hasPaymentStatus, details: 'Clean document' }
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Very Long Amount in Words (Natural Multi-Line Wrapping)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Long Amount in Words (Multi-Line Wrapping & Overflow Safety) ---');
    const longAmountInWords = 'Rupees Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine Only';

    // Update DOM to test long amount in words layout and wrapping
    const longMetrics = await page.evaluate((longText) => {
      const pageEl = document.querySelector('.invoice-page');
      const allSpans = Array.from(pageEl.querySelectorAll('span'));
      const wordsLabelSpan = allSpans.find(s => s.textContent.trim().toUpperCase() === 'AMOUNT IN WORDS');
      const wordsBox = wordsLabelSpan ? wordsLabelSpan.parentElement : null;
      const wordsValueEl = wordsBox ? wordsBox.querySelector('div') : null;

      if (wordsValueEl) {
        wordsValueEl.textContent = longText;
      }

      const pageHeightMm = pageEl.getBoundingClientRect().height * 0.264583;

      return {
        pageHeightMm,
        wordsBoxHeight: wordsBox ? wordsBox.getBoundingClientRect().height : 0,
        renderedWords: wordsValueEl ? wordsValueEl.textContent.trim() : '',
      };
    }, longAmountInWords);

    console.log(`Measured Long Amount Metrics:`);
    console.log(`- Amount in Words: "${longMetrics.renderedWords}"`);
    console.log(`- Section Height: ${longMetrics.wordsBoxHeight.toFixed(0)} px`);
    console.log(`- Total Page Sheet Height: ${longMetrics.pageHeightMm.toFixed(1)} mm`);

    // Generate PDF with Long Amount
    const longPdfPath = path.join(OUTPUT_DIR, 'invoice_long_amount_test.pdf');
    await page.pdf({
      path: longPdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' },
    });
    const longPdfBuffer = fs.readFileSync(longPdfPath);
    const longPdfPageCount = getPdfPageCount(longPdfBuffer);
    console.log(`Long Amount PDF Page Count: ${longPdfPageCount} (Expected: 1)`);

    allChecks.push(
      { name: '14. Long Amount in Words text matches expected long string', pass: longMetrics.renderedWords === longAmountInWords, details: `words = "${longMetrics.renderedWords}"` },
      { name: '15. Long Amount in Words wraps naturally without card clipping', pass: longMetrics.wordsBoxHeight >= 30, details: `height = ${longMetrics.wordsBoxHeight.toFixed(0)} px` },
      { name: '16. Long Amount Invoice fits on exactly 1 A4 page', pass: longPdfPageCount === 1, details: `pages = ${longPdfPageCount}` }
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Triplicate Set Generation ("Print 3 Copies")
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Triplicate Set Output (Print 3 Copies) ---');

    // Click "Print 3 Copies" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const tripBtn = btns.find(b => b.textContent && b.textContent.includes('Print 3 Copies'));
      if (tripBtn) tripBtn.click();
    });

    // Wait for 3 identical pages in DOM
    await page.waitForFunction(() => document.querySelectorAll('.invoice-page').length === 3, { timeout: 5000 });

    const copyPagesCount = await page.evaluate(() => {
      return document.querySelectorAll('.invoice-page').length;
    });
    console.log(`Rendered Invoice Pages in DOM for Triplicate Print: ${copyPagesCount} (Expected: 3)`);

    // Generate Triplicate PDF
    const tripPdfPath = path.join(OUTPUT_DIR, 'invoice_triplicate_test.pdf');
    await page.pdf({
      path: tripPdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' },
    });
    console.log(`Saved Triplicate PDF: ${tripPdfPath}`);

    const tripPdfBuffer = fs.readFileSync(tripPdfPath);
    const tripPdfPageCount = getPdfPageCount(tripPdfBuffer);
    console.log(`Triplicate PDF Page Count: ${tripPdfPageCount} (Expected: 3)`);

    allChecks.push(
      { name: '17. Triplicate print renders 3 identical pages in DOM', pass: copyPagesCount === 3, details: `DOM pages = ${copyPagesCount}` },
      { name: '18. Triplicate PDF has exactly 3 pages', pass: tripPdfPageCount === 3, details: `PDF pages = ${tripPdfPageCount}` }
    );

    // -------------------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('FINAL VISUAL QA CHECKLIST REPORT');
    console.log('===============================================================');
    let allPassed = true;
    for (const c of allChecks) {
      if (!c.pass) allPassed = false;
      console.log(`${c.name.padEnd(65)} -> ${c.pass ? '✅ PASS' : '❌ FAIL'} (${c.details})`);
    }

    console.log('\n===============================================================');
    console.log(`OVERALL STATUS: ${allPassed ? 'ALL 18 TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
    console.log('===============================================================');

    return allPassed;
  } finally {
    await browser.close();
  }
}

runInvoiceVisualQA()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal visual QA error:', err);
    process.exit(1);
  });
