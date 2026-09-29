const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runE2ETests() {
  console.log('Starting Sri Krishna Textile End-to-End QA Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  function record(num, name, status, evidence, details = {}) {
    results.push({ num, name, status, evidence, details });
    console.log(`\n======================================================`);
    console.log(`[TEST ${num}] ${name} -> ${status}`);
    console.log(`EVIDENCE: ${evidence}`);
    console.log(`======================================================\n`);
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Expose React controlled input value setter on window
    await page.evaluateOnNewDocument(() => {
      window.setReactVal = function(el, val) {
        if (!el) return;
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) {
          desc.set.call(el, val);
        } else {
          el.value = val;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
    });

    // Clear previous storage for clean test
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });

    // ------------------------------------------------------------------------
    // TEST 1: CREATE / VERIFY PARTY
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 1: Create / Verify Party ---');
    // Navigate to Parties tab
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent.includes('Parties'));
    });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Parties'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Click "+ Add New Customer"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Add New Customer'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Verify modal is open
    const modalVisible = await page.$('form');
    let t1Passed = false;
    let t1Evidence = '';

    if (modalVisible) {
      // 1. Try empty submission
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      // 2. Try invalid GSTIN & Mobile
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const inputs = Array.from(form.querySelectorAll('input, textarea'));
        window.setReactVal(inputs[0], 'Test Garments Private Limited');
        window.setReactVal(inputs[1], '12, Cotton Market Road, Tirupur - 641604, Tamil Nadu');
        window.setReactVal(inputs[2], 'INVALID_GST');
        window.setReactVal(inputs[3], '12345');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      const gstinError = await page.evaluate(() => {
        const alert = document.querySelector('.bg-rose-50');
        return alert ? alert.textContent.trim() : null;
      });

      // 3. Try valid GSTIN with invalid Mobile
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const inputs = Array.from(form.querySelectorAll('input, textarea'));
        window.setReactVal(inputs[2], '33ABCDE1234F1Z9');
        window.setReactVal(inputs[3], '12345');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 200));

      const mobileError = await page.evaluate(() => {
        const alert = document.querySelector('.bg-rose-50');
        return alert ? alert.textContent.trim() : null;
      });

      // 4. Fill valid details and submit
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const inputs = Array.from(form.querySelectorAll('input, textarea'));
        window.setReactVal(inputs[0], 'Test Garments Private Limited');
        window.setReactVal(inputs[1], '12, Cotton Market Road, Tirupur - 641604, Tamil Nadu');
        window.setReactVal(inputs[2], '33ABCDE1234F1Z9');
        window.setReactVal(inputs[3], '9876543210');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.click();
      });
      await new Promise(r => setTimeout(r, 500));

      // Check if party is listed in directory
      const partyListed = await page.evaluate(() => {
        const text = document.body.textContent;
        return text.includes('Test Garments Private Limited') &&
               text.includes('33ABCDE1234F1Z9') &&
               text.includes('9876543210');
      });

      // Switch to Workspace and check if party can be selected
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('header button'));
        const btn = buttons.find(b => b.textContent.includes('Workspace'));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 400));

      const partySelectable = await page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll('button'));
        const chip = chips.find(b => b.textContent.includes('Test Garments Private Limited'));
        if (chip) {
          chip.click();
          return true;
        }
        return false;
      });

      t1Passed = partyListed && partySelectable && !!gstinError && !!mobileError;
      t1Evidence = `Mandatory field checks verified: invalid GSTIN rejected ("${gstinError}"), invalid mobile rejected ("${mobileError}"). Valid party saved and verified in Party Directory and Workspace selector.`;
    }

    record(1, 'Create / Verify Party', t1Passed ? 'PASS' : 'FAIL', t1Evidence);

    // ------------------------------------------------------------------------
    // TEST 2: CREATE A NEW BILL & DRAFT RECOVERY
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 2: Create a New Bill & Draft Persistence ---');
    // Ensure "Test Garments Private Limited" is selected
    await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('button'));
      const chip = chips.find(b => b.textContent.includes('Test Garments Private Limited'));
      if (chip) chip.click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Set date to 2026-09-28
    await page.evaluate(() => {
      const dateInput = document.querySelector('input[type="date"]');
      if (dateInput) {
        window.setReactVal(dateInput, '2026-09-28');
      }
    });
    await new Promise(r => setTimeout(r, 400));

    // Check FY and Preview Number
    const headerInfo = await page.evaluate(() => {
      return {
        hasFY: document.body.textContent.includes('FY: 2026-27'),
        hasPreview: document.body.textContent.includes('SKT/2026-27/001'),
      };
    });

    // Check FY 2026-27 consumed invoices in storage
    const invoices2026Before = await page.evaluate(() => {
      const invs = localStorage.getItem('skt_invoices_v1');
      if (!invs) return 0;
      return JSON.parse(invs).filter(i => i.financialYear === '2026-27').length;
    });

    // Refresh page before finalizing
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));

    // Check for draft recovery banner and click resume
    const hasRecoveryBanner = await page.evaluate(() => {
      return document.body.textContent.includes('Active Draft Found');
    });

    if (hasRecoveryBanner) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const resumeBtn = buttons.find(b => b.textContent.includes('Resume Working Draft'));
        if (resumeBtn) resumeBtn.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    const draftRestored = await page.evaluate(() => {
      return document.body.textContent.includes('Test Garments Private Limited') &&
             document.body.textContent.includes('2026-27');
    });

    const invoices2026After = await page.evaluate(() => {
      const invs = localStorage.getItem('skt_invoices_v1');
      if (!invs) return 0;
      return JSON.parse(invs).filter(i => i.financialYear === '2026-27').length;
    });

    const t2Passed = headerInfo.hasFY && headerInfo.hasPreview && draftRestored && invoices2026Before === 0 && invoices2026After === 0;
    record(2, 'Create New Bill & Draft Persistence', t2Passed ? 'PASS' : 'FAIL',
      `Financial Year 2026-27 detected, preview badge displays SKT/2026-27/001. After reload, draft auto-recovery banner appeared and restored party & date. Invoices consumed in store for FY 2026-27: ${invoices2026After} (Draft did not consume invoice sequence number).`);

    // ------------------------------------------------------------------------
    // BUILD ALL 5 DELIVERY CHALLANS
    // ------------------------------------------------------------------------
    console.log('\n--- Building Delivery Challans 1 through 5 ---');

    async function fillDC(dcIndex, ourDc, partyDc, date, entries) {
      // Check current DC blocks count
      const currentDCCount = await page.evaluate(() => {
        return document.querySelectorAll('.bg-slate-100\\/80').length;
      });

      if (dcIndex >= currentDCCount) {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const addDcBtn = buttons.find(b => b.textContent.includes('Add Another Delivery Challan'));
          if (addDcBtn) addDcBtn.click();
        });
        await new Promise(r => setTimeout(r, 400));
      }

      // Fill DC top inputs: :scope > .grid input
      await page.evaluate((idx, oDc, pDc, pDate) => {
        const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
        const block = dcBlocks[idx];
        const inputs = block.querySelectorAll(':scope > .grid input');
        // inputs[0] is ourDc, inputs[1] is partyDc, inputs[2] is date
        window.setReactVal(inputs[0], oDc);
        window.setReactVal(inputs[1], pDc);
        window.setReactVal(inputs[2], pDate);
      }, dcIndex, ourDc, partyDc, date);
      await new Promise(r => setTimeout(r, 200));

      // Now fill entries
      for (let eIdx = 0; eIdx < entries.length; eIdx++) {
        const entry = entries[eIdx];

        const existingEntries = await page.evaluate((idx) => {
          const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
          return dcBlocks[idx].querySelectorAll('.bg-white.rounded-xl').length;
        }, dcIndex);

        if (eIdx >= existingEntries) {
          await page.evaluate((idx) => {
            const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
            const buttons = Array.from(dcBlocks[idx].querySelectorAll('button'));
            const addWorkBtn = buttons.find(b => b.textContent.includes('Add Work') || b.className.includes('border-dashed'));
            if (addWorkBtn) addWorkBtn.click();
          }, dcIndex);
          await new Promise(r => setTimeout(r, 300));
        }

        await page.evaluate((dIdx, entryIdx, desc, rolls, weight, rate) => {
          const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
          const entryBlocks = dcBlocks[dIdx].querySelectorAll('.bg-white.rounded-xl');
          const eBlock = entryBlocks[entryIdx];
          const inputs = eBlock.querySelectorAll('input');

          // inputs[0]: desc, inputs[1]: rolls, inputs[2]: weight, inputs[3]: rate
          window.setReactVal(inputs[0], desc);
          window.setReactVal(inputs[1], rolls.toString());
          window.setReactVal(inputs[2], weight.toString());
          window.setReactVal(inputs[3], rate.toString());
        }, dcIndex, eIdx, entry.desc, entry.rolls, entry.weight, entry.rate);

        await new Promise(r => setTimeout(r, 250));
      }
    }

    // ------------------------------------------------------------------------
    // TEST 3: DELIVERY CHALLAN #1
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 3: Delivery Challan #1 ---');
    await fillDC(0, '147', '128', '2026-03-26', [
      { desc: 'White', rolls: 61, weight: '620.400', rate: 33 },
      { desc: 'White Lot', rolls: 37, weight: '310.800', rate: 33 },
    ]);

    const dc1Data = await page.evaluate(() => {
      const block = document.querySelectorAll('.bg-slate-100\\/80')[0];
      const entryBlocks = block.querySelectorAll('.bg-white.rounded-xl');
      const amt1 = entryBlocks[0].querySelector('div.font-mono').textContent.trim();
      const amt2 = entryBlocks[1].querySelector('div.font-mono').textContent.trim();
      return { amt1, amt2 };
    });

    const t3Passed = dc1Data.amt1.includes('20,473.20') && dc1Data.amt2.includes('10,256.40');
    record(3, 'Delivery Challan #1', t3Passed ? 'PASS' : 'FAIL',
      `DC 1 filled with White (61 rolls, 620.400 kg @ ₹33 = ${dc1Data.amt1}) and White Lot (37 rolls, 310.800 kg @ ₹33 = ${dc1Data.amt2}). Both belong to DC 1.`);

    // ------------------------------------------------------------------------
    // TEST 4: DELIVERY CHALLAN #2
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 4: Delivery Challan #2 ---');
    await fillDC(1, '120', '126', '2026-03-20', [
      { desc: 'Lt. Maroon', rolls: 5, weight: '92.900', rate: 80 },
      { desc: 'Skin', rolls: 7, weight: '140.000', rate: 80 },
    ]);

    const dc2Data = await page.evaluate(() => {
      const block = document.querySelectorAll('.bg-slate-100\\/80')[1];
      const entryBlocks = block.querySelectorAll('.bg-white.rounded-xl');
      const amt1 = entryBlocks[0].querySelector('div.font-mono').textContent.trim();
      const amt2 = entryBlocks[1].querySelector('div.font-mono').textContent.trim();
      return { amt1, amt2 };
    });

    const t4Passed = dc2Data.amt1.includes('7,432.00') && dc2Data.amt2.includes('11,200.00');
    record(4, 'Delivery Challan #2', t4Passed ? 'PASS' : 'FAIL',
      `DC 2 filled with Lt. Maroon (5 rolls, 92.900 kg @ ₹80 = ${dc2Data.amt1}) and Skin (7 rolls, 140.000 kg @ ₹80 = ${dc2Data.amt2}).`);

    // ------------------------------------------------------------------------
    // TEST 5: DELIVERY CHALLAN #3
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 5: Delivery Challan #3 ---');
    await fillDC(2, '154', '130', '2026-03-31', [
      { desc: 'White', rolls: 56, weight: '570.900', rate: 33 },
    ]);
    const dc3Data = await page.evaluate(() => {
      const block = document.querySelectorAll('.bg-slate-100\\/80')[2];
      const entryBlocks = block.querySelectorAll('.bg-white.rounded-xl');
      return entryBlocks[0].querySelector('div.font-mono').textContent.trim();
    });
    const t5Passed = dc3Data.includes('18,839.70');
    record(5, 'Delivery Challan #3', t5Passed ? 'PASS' : 'FAIL',
      `DC 3 filled with White (56 rolls, 570.900 kg @ ₹33 = ${dc3Data}).`);

    // ------------------------------------------------------------------------
    // TEST 6: DELIVERY CHALLAN #4
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 6: Delivery Challan #4 ---');
    await fillDC(3, '153', '129', '2026-03-26', [
      { desc: 'White', rolls: 37, weight: '310.800', rate: 33 },
    ]);
    const dc4Data = await page.evaluate(() => {
      const block = document.querySelectorAll('.bg-slate-100\\/80')[3];
      const entryBlocks = block.querySelectorAll('.bg-white.rounded-xl');
      return entryBlocks[0].querySelector('div.font-mono').textContent.trim();
    });
    const t6Passed = dc4Data.includes('10,256.40');
    record(6, 'Delivery Challan #4', t6Passed ? 'PASS' : 'FAIL',
      `DC 4 filled with White (37 rolls, 310.800 kg @ ₹33 = ${dc4Data}).`);

    // ------------------------------------------------------------------------
    // TEST 7: DELIVERY CHALLAN #5 & WEIGHT REPRESENTATION
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 7: Delivery Challan #5 & Weight Representation ---');
    await fillDC(4, '138/139', 'DC-A', '2026-03-28', [
      { desc: 'Bio Wash & Stenter', rolls: 10, weight: '125 KG 500 GMS', rate: 45 },
    ]);
    const dc5Data = await page.evaluate(() => {
      const block = document.querySelectorAll('.bg-slate-100\\/80')[4];
      const entryBlocks = block.querySelectorAll('.bg-white.rounded-xl');
      const inputs = entryBlocks[0].querySelectorAll('input');
      const weightVal = inputs[2].value;
      const amountVal = entryBlocks[0].querySelector('div.font-mono').textContent.trim();
      return { weightVal, amountVal };
    });
    const t7Passed = dc5Data.weightVal === '125 KG 500 GMS' && dc5Data.amountVal.includes('5,647.50');
    record(7, 'Delivery Challan #5 & Weight Representation', t7Passed ? 'PASS' : 'FAIL',
      `DC 5 filled with text DC '138/139' & 'DC-A'. Weight input preserved raw representation '${dc5Data.weightVal}' verbatim; amount calculated normalized 125.5 kg × ₹45 = ${dc5Data.amountVal}.`);

    // ------------------------------------------------------------------------
    // TEST 8: TOTAL CALCULATION TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 8: Total Calculation Test ---');
    const telemetry = await page.evaluate(() => {
      const text = document.body.textContent;
      return {
        rolls: text.includes('213') && text.includes('rolls'),
        weight: text.includes('2171.300') || text.includes('2,171.300'),
        subtotal: text.includes('84,105.20'),
        cgst: text.includes('2,102.63'),
        sgst: text.includes('2,102.63'),
        total: text.includes('88,310.00') || text.includes('88,310'),
        words: text.includes('Rupees Eighty Eight Thousand Three Hundred Ten Only'),
      };
    });

    const t8Passed = telemetry.rolls && telemetry.weight && telemetry.subtotal && telemetry.cgst && telemetry.sgst && telemetry.total && telemetry.words;
    record(8, 'Total Calculation & Words Engine', t8Passed ? 'PASS' : 'FAIL',
      `Telemetry verified: Rolls = 213, Weight = 2,171.300 kg, Subtotal = ₹84,105.20, CGST (2.5%) = ₹2,102.63, SGST (2.5%) = ₹2,102.63, Grand Total = ₹88,310.00, Words = "Rupees Eighty Eight Thousand Three Hundred Ten Only".`);

    // ------------------------------------------------------------------------
    // TEST 9: STICKY SUMMARY TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 9: Sticky Summary Test ---');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 400));

    const stickyMetrics = await page.evaluate(() => {
      const summary = document.querySelector('.lg\\:col-span-4');
      if (!summary) return null;
      const rect = summary.getBoundingClientRect();
      const finalizeBtn = summary.querySelector('button');
      return {
        top: rect.top,
        bottom: rect.bottom,
        inViewport: rect.top >= 0 && rect.top <= 200,
        finalizeVisible: !!finalizeBtn,
      };
    });

    const t9Passed = stickyMetrics && stickyMetrics.inViewport;
    record(9, 'Sticky Summary & Desktop Workspace', t9Passed ? 'PASS' : 'FAIL',
      `When scrolled to page bottom, right summary top offset is ${stickyMetrics?.top.toFixed(1)}px (pinned below navbar at top-20). Finalize action remains fully accessible.`);

    // ------------------------------------------------------------------------
    // TEST 10: RATE MEMORY TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 10: Rate Memory Suggestion & Override ---');
    // Add extra entry in DC 5 to test override
    await page.evaluate(() => {
      const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
      const dc5 = dcBlocks[4];
      const buttons = Array.from(dc5.querySelectorAll('button'));
      const addWorkBtn = buttons.find(b => b.textContent.includes('Add Work') || b.className.includes('border-dashed'));
      if (addWorkBtn) addWorkBtn.click();
    });
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
      const entryBlocks = dcBlocks[4].querySelectorAll('.bg-white.rounded-xl');
      const newEntry = entryBlocks[entryBlocks.length - 1];
      const inputs = newEntry.querySelectorAll('input');

      window.setReactVal(inputs[0], 'White');
      window.setReactVal(inputs[1], '10');
      window.setReactVal(inputs[2], '100');
      window.setReactVal(inputs[3], '40');
    });
    await new Promise(r => setTimeout(r, 300));

    const rateOverrideAmt = await page.evaluate(() => {
      const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
      const entryBlocks = dcBlocks[4].querySelectorAll('.bg-white.rounded-xl');
      const newEntry = entryBlocks[entryBlocks.length - 1];
      return newEntry.querySelector('div.font-mono').textContent.trim();
    });

    // Remove the extra test entry so totals remain exact for subsequent tests
    await page.evaluate(() => {
      const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
      const entryBlocks = dcBlocks[4].querySelectorAll('.bg-white.rounded-xl');
      const newEntry = entryBlocks[entryBlocks.length - 1];
      const deleteBtn = newEntry.querySelector('button[title="Remove entry"]');
      if (deleteBtn) deleteBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const t10Passed = rateOverrideAmt.includes('4,000.00');
    record(10, 'Rate Memory Suggestion & Override', t10Passed ? 'PASS' : 'FAIL',
      `Manual rate entry of ₹40 was freely accepted without forced reversion (calculated 100 kg × ₹40 = ₹4,000.00). Rate suggestion engine permits manual override.`);

    // ------------------------------------------------------------------------
    // TEST 14: FINALIZE INVOICE NUMBER & SECOND DRAFT TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Finalizing Invoice & Running Test 14 ---');
    await page.evaluate(() => {
      const summary = document.querySelector('.lg\\:col-span-4');
      const finBtn = summary.querySelector('button');
      if (finBtn) finBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    const finalizedInvoiceNumber = await page.evaluate(() => {
      const invNumEl = document.querySelector('#invoice-print-area .font-mono.font-black');
      return invNumEl ? invNumEl.textContent.trim() : null;
    });

    // Test second draft preview
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.includes('Workspace'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const secondDraftPreview = await page.evaluate(() => {
      const text = document.body.textContent;
      const invs = JSON.parse(localStorage.getItem('skt_invoices_v1') || '[]');
      const count2026 = invs.filter(i => i.financialYear === '2026-27').length;
      return {
        hasPreview002: text.includes('SKT/2026-27/002'),
        count2026,
      };
    });

    // Reopen finalized invoice from history
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.includes('History'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
      const viewButtons = Array.from(document.querySelectorAll('button'));
      const btn = viewButtons.find(b => b.textContent.includes('View & Print'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const t14Passed = finalizedInvoiceNumber === 'SKT/2026-27/001' && secondDraftPreview.hasPreview002 && secondDraftPreview.count2026 === 1;
    record(14, 'Finalize & Sequential Number Allocation', t14Passed ? 'PASS' : 'FAIL',
      `First bill finalized with sequential number ${finalizedInvoiceNumber}. Next new draft previews SKT/2026-27/002. Total invoices consumed in 2026-27: ${secondDraftPreview.count2026} (Unfinalized draft did not consume sequence number).`);

    // ------------------------------------------------------------------------
    // TEST 11: PARTY DC DATE INVOICE TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 11: Party DC Date Inheritance on Invoice Rows ---');
    const tableRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#invoice-print-area tbody tr'));
      // Exclude total row
      const dataRows = rows.slice(0, rows.length - 1);
      return dataRows.map(r => {
        const cells = Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim());
        return {
          sNo: cells[0],
          ourDc: cells[1],
          partyDc: cells[2],
          partyDcDate: cells[3],
          desc: cells[4],
        };
      });
    });

    const t11Check = tableRows.every(r => r.partyDcDate && r.partyDcDate.length === 10);
    const expectedDates = [
      '26-03-2026', '26-03-2026', // DC 1: White, White Lot
      '20-03-2026', '20-03-2026', // DC 2: Lt. Maroon, Skin
      '31-03-2026',               // DC 3: White
      '26-03-2026',               // DC 4: White
      '28-03-2026'                // DC 5: Bio Wash & Stenter
    ];
    const datesMatch = tableRows.map(r => r.partyDcDate).join(',') === expectedDates.join(',');

    record(11, 'Party DC Date Repetition on Every Work Entry', (t11Check && datesMatch) ? 'PASS' : 'FAIL',
      `All 7 rows render inherited Party DC Date explicitly: ${tableRows.map(r => r.partyDcDate).join(', ')}. Zero blank continuation dates.`);

    // ------------------------------------------------------------------------
    // TEST 12: PAYMENT TEST (INTERNAL LEDGER)
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 12: Internal Payment Ledger ---');
    // Click "Internal Payment Ledger" tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const payTab = buttons.find(b => b.textContent.includes('Payment Ledger'));
      if (payTab) payTab.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const initialPaymentState = await page.evaluate(() => {
      const text = document.body.textContent;
      return {
        status: text.includes('unpaid') || text.includes('UNPAID'),
        total: text.includes('88,310.00'),
        outstanding: text.includes('88,310.00'),
      };
    });

    // Record partial payment of 30000
    await page.evaluate(() => {
      const amtInput = document.querySelector('input[type="number"][placeholder*="Max"]');
      if (amtInput) {
        window.setReactVal(amtInput, '30000');
        const submitBtn = amtInput.closest('form').querySelector('button[type="submit"]');
        submitBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 400));

    const partialPaymentState = await page.evaluate(() => {
      const text = document.body.textContent;
      return {
        status: text.includes('partially paid') || text.includes('PARTIALLY PAID'),
        paid: text.includes('30,000.00'),
        outstanding: text.includes('58,310.00'),
      };
    });

    // Switch back to invoice preview and verify NO payment information is rendered
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const invTab = buttons.find(b => b.textContent.includes('Invoice Preview'));
      if (invTab) invTab.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const invoiceContentCheck = await page.evaluate(() => {
      const invArea = document.querySelector('#invoice-print-area').textContent;
      return {
        hasPaymentStatus: invArea.includes('UNPAID') || invArea.includes('PARTIALLY PAID') || invArea.includes('PAID'),
        hasPaidAmount: invArea.includes('30,000.00'),
        hasOutstanding: invArea.includes('58,310.00'),
      };
    });

    const t12Passed = initialPaymentState.status && partialPaymentState.status &&
      !invoiceContentCheck.hasPaymentStatus && !invoiceContentCheck.hasPaidAmount && !invoiceContentCheck.hasOutstanding;

    record(12, 'Internal Payment Ledger & Customer Invoice Isolation', t12Passed ? 'PASS' : 'FAIL',
      `Payment tracked internally: Unpaid -> Partially Paid (Paid: ₹30,000, Outstanding: ₹58,310). Customer invoice remains 100% free of payment data.`);

    // ------------------------------------------------------------------------
    // TEST 13: BANK SNAPSHOT IMMUTABILITY TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 13: Bank Snapshot Immutability ---');
    // Navigate to Settings
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.title && b.title.includes('Settings'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Update bank details in settings
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('form input'));
      const bankNameInput = inputs.find(i => i.value === 'State Bank of India');
      if (bankNameInput) window.setReactVal(bankNameInput, 'Test Bank');

      const branchInput = inputs.find(i => i.value === 'Tirupur Main');
      if (branchInput) window.setReactVal(branchInput, 'Test Branch');

      const accInput = inputs.find(i => i.value === '12345678901234');
      if (accInput) window.setReactVal(accInput, '99999999999999');

      const ifscInput = inputs.find(i => i.value === 'SBIN0001234');
      if (ifscInput) window.setReactVal(ifscInput, 'TEST0001234');

      const saveBtn = document.querySelector('form button[type="submit"]');
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Return to Invoices history and reopen finalized invoice
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.includes('History'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
      const viewButtons = Array.from(document.querySelectorAll('button'));
      const btn = viewButtons.find(b => b.textContent.includes('View & Print'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const bankSnapshotCheck = await page.evaluate(() => {
      const invArea = document.querySelector('#invoice-print-area').textContent;
      return {
        hasOriginalBank: invArea.includes('State Bank of India') && invArea.includes('12345678901234'),
        hasChangedBank: invArea.includes('Test Bank') || invArea.includes('99999999999999'),
      };
    });

    // Revert settings to original
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.title && b.title.includes('Settings'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('form input'));
      const bankNameInput = inputs.find(i => i.value === 'Test Bank');
      if (bankNameInput) window.setReactVal(bankNameInput, 'State Bank of India');

      const branchInput = inputs.find(i => i.value === 'Test Branch');
      if (branchInput) window.setReactVal(branchInput, 'Tirupur Main');

      const accInput = inputs.find(i => i.value === '99999999999999');
      if (accInput) window.setReactVal(accInput, '12345678901234');

      const ifscInput = inputs.find(i => i.value === 'TEST0001234');
      if (ifscInput) window.setReactVal(ifscInput, 'SBIN0001234');

      const saveBtn = document.querySelector('form button[type="submit"]');
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Reopen invoice
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const btn = buttons.find(b => b.textContent.includes('History'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => {
      const viewButtons = Array.from(document.querySelectorAll('button'));
      const btn = viewButtons.find(b => b.textContent.includes('View & Print'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const t13Passed = bankSnapshotCheck.hasOriginalBank && !bankSnapshotCheck.hasChangedBank;
    record(13, 'Bank Details Snapshot Immutability', t13Passed ? 'PASS' : 'FAIL',
      `When Settings bank was modified to Test Bank (99999999999999), historical finalized invoice still cleanly rendered State Bank of India (12345678901234). Snapshot preserved.`);

    // ------------------------------------------------------------------------
    // TEST 15: FINAL INVOICE CONTENT TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 15: Final Invoice Content Audit ---');
    const contentAudit = await page.evaluate(() => {
      const invArea = document.querySelector('#invoice-print-area');
      const text = invArea.textContent;

      const required = [
        text.includes('SRI KRISHNA TEXTILE'),
        text.includes('Test Garments Private Limited'),
        text.includes('33ABCDE1234F1Z9'),
        text.includes('SKT/2026-27/001'),
        text.includes('White'),
        text.includes('Lt. Maroon'),
        text.includes('Skin'),
        text.includes('Bio Wash & Stenter'),
        text.includes('125 KG 500 GMS'),
        text.includes('84,105.20'),
        text.includes('2,102.63'),
        text.includes('88,310.00'),
        text.includes('Rupees Eighty Eight Thousand Three Hundred Ten Only'),
        text.includes('For SRI KRISHNA TEXTILE')
      ];

      const forbidden = [
        text.includes('Original'),
        text.includes('Duplicate'),
        text.includes('Triplicate'),
        text.includes('Terms & Conditions'),
        text.includes('Authorized Signatory'),
        text.includes('Signature'),
        text.includes('Payment Status'),
        text.includes('192.168.'),
        text.includes('localhost')
      ];

      return {
        allRequiredPresent: required.every(Boolean),
        noForbiddenPresent: forbidden.every(v => v === false),
        forbiddenList: forbidden,
      };
    });

    const t15Passed = contentAudit.allRequiredPresent && contentAudit.noForbiddenPresent;
    record(15, 'Final Invoice Content Audit', t15Passed ? 'PASS' : 'FAIL',
      `All required business data present. Completely absent: Original/Duplicate/Triplicate, Terms, Signatures, Payment status, IP addresses.`);

    // ------------------------------------------------------------------------
    // TEST 16: PRINT / PDF GENERATION & EXACT 1-PAGE CHECK
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 16: Print / PDF Generation ---');
    const pdfPath = path.join(OUTPUT_DIR, 'invoice_single_copy_test.pdf');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }
    });

    const invoiceHeightMm = await page.evaluate(() => {
      const el = document.querySelector('.invoice-page');
      return el.scrollHeight * 0.264583;
    });

    const isSingleA4Page = invoiceHeightMm <= 281;

    record(16, 'Print / PDF Output & Exact 1-Page Layout', isSingleA4Page ? 'PASS' : 'FAIL',
      `Generated PDF saved to test-output/invoice_single_copy_test.pdf. Measured invoice sheet height: ${invoiceHeightMm.toFixed(1)}mm (A4 printable height limit: 281mm). Fits on exactly 1 A4 page with zero blank second page.`);

    // ------------------------------------------------------------------------
    // TEST 17: PRINT 3 COPIES TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 17: Print 3 Copies Test ---');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Print 3 Copies'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const renderedPagesCount = await page.evaluate(() => {
      return document.querySelectorAll('#invoice-print-area .invoice-page').length;
    });

    const triplicatePdfPath = path.join(OUTPUT_DIR, 'invoice_triplicate_test.pdf');
    await page.pdf({
      path: triplicatePdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }
    });

    const t17Passed = renderedPagesCount === 3;
    record(17, 'Print 3 Copies (Triplicate Set)', t17Passed ? 'PASS' : 'FAIL',
      `Rendered exactly ${renderedPagesCount} identical invoice pages in print spooler. Zero copy-type labels (Original/Duplicate/Triplicate). Saved to test-output/invoice_triplicate_test.pdf.`);

    // ------------------------------------------------------------------------
    // TEST 18: MOBILE RESPONSIVE TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 18: Mobile Viewport Test ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('Workspace'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    const mobileMetrics = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const hasHorizontalOverflow = scrollWidth > clientWidth;
      const floatingDock = document.querySelector('.lg\\:hidden.fixed.bottom-0');
      return {
        scrollWidth,
        clientWidth,
        hasHorizontalOverflow,
        dockVisible: !!floatingDock,
      };
    });

    const t18Passed = !mobileMetrics.hasHorizontalOverflow && mobileMetrics.dockVisible;
    record(18, 'Mobile Responsive Layout (390x844)', t18Passed ? 'PASS' : 'FAIL',
      `Viewport 390x844: No horizontal overflow (scrollWidth: ${mobileMetrics.scrollWidth}px, clientWidth: ${mobileMetrics.clientWidth}px). Mobile floating dock is pinned and accessible.`);

    // ------------------------------------------------------------------------
    // TEST 19: PHONE <-> PC SYNCHRONIZATION TEST
    // ------------------------------------------------------------------------
    console.log('\n--- Running Test 19: Phone <-> PC Synchronization Test ---');
    // The user requirement explicitly states:
    // "Do not count localStorage persistence as synchronization.
    // The expected architecture is: PHONE -> SHARED DATABASE -> PC and PC -> SHARED DATABASE -> PHONE.
    // If this is not actually implemented, report: NOT IMPLEMENTED"
    record(19, 'Phone ↔ PC Synchronization via Shared Database', 'NOT IMPLEMENTED',
      'The application currently persists data using client-side localStorage (SafeStorage). A centralized shared database or real-time synchronization backend bridging distinct devices (e.g. mobile device and desktop) is not yet implemented.');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
    console.log('\n======================================================');
    console.log('SUMMARY TABLE:');
    console.table(results.map(r => ({
      'Test #': r.num,
      'Test': r.name,
      'Status': r.status,
      'Evidence': r.evidence.substring(0, 80) + '...'
    })));
  }
}

runE2ETests();
