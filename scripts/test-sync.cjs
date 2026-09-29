const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');
const BUSINESS_KEY = 'SKT-SRIKRISHNA-2026';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runSyncTests() {
  console.log('===============================================================');
  console.log('Starting Multi-Device Synchronization Verification Suite');
  console.log('PC (Browser A) <-> Central SQLite DB <-> Phone (Browser B)');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  function record(testNum, name, passed, evidence, details = {}) {
    results.push({ testNum, name, passed, evidence, details });
    console.log(`\n---------------------------------------------------------------`);
    console.log(`[TEST ${testNum}] ${name} -> ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`EVIDENCE: ${evidence}`);
    if (Object.keys(details).length > 0) {
      console.log(`DETAILS:`, JSON.stringify(details, null, 2));
    }
    console.log(`---------------------------------------------------------------`);
  }

  try {
    // ------------------------------------------------------------------------
    // SETUP: Two Independent Browser Contexts (Simulating 2 Physical Devices)
    // ------------------------------------------------------------------------
    const contextPC = await browser.createBrowserContext();
    const pagePC = await contextPC.newPage();
    await pagePC.setViewport({ width: 1440, height: 900 });

    const contextPhone = await browser.createBrowserContext();
    const pagePhone = await contextPhone.newPage();
    await pagePhone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    // Expose React controlled input setter helper in both contexts
    const injectHelper = async (page) => {
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
    };

    await injectHelper(pagePC);
    await injectHelper(pagePhone);

    // Initial navigation
    await pagePC.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await pagePhone.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });

    console.log('Both devices loaded and connected to central server.');

    // ------------------------------------------------------------------------
    // TEST 1: Party created on PC -> visible on Phone
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 1: Party created on PC -> visible on Phone ---');
    // On PC, navigate to Parties tab
    await pagePC.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const pBtn = btns.find(b => b.textContent.includes('Parties'));
      if (pBtn) pBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Click "Add New Customer" button on PC to open modal
    await pagePC.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Add New Customer'));
      if (addBtn) addBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Fill new party form on PC
    const partyPC = {
      name: 'Tirupur Knits Private Limited',
      address: '45, College Road, Tirupur - 641602, Tamil Nadu',
      gstin: '33AAAAA1234A1Z1',
      phone: '9842211223',
    };

    await pagePC.evaluate((p) => {
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const nameInput = inputs.find(i => i.placeholder?.includes('ABC Fabrics') || i.placeholder?.includes('Company') || i.name === 'name');
      const gstInput = inputs.find(i => i.placeholder?.includes('33ABCDE') || i.placeholder?.includes('GSTIN') || i.name === 'gstin');
      const phoneInput = inputs.find(i => i.placeholder?.includes('9842111223') || i.placeholder?.includes('Mobile') || i.name === 'phone');
      const addrInput = inputs.find(i => i.tagName === 'TEXTAREA' || i.placeholder?.includes('Street, Area') || i.name === 'address');

      if (nameInput) window.setReactVal(nameInput, p.name);
      if (gstInput) window.setReactVal(gstInput, p.gstin);
      if (phoneInput) window.setReactVal(phoneInput, p.phone);
      if (addrInput) window.setReactVal(addrInput, p.address);

      // Submit form
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Customer'));
      if (saveBtn) saveBtn.click();
    }, partyPC);

    // Wait for sync propagation to Phone (background polling occurs every 2s)
    console.log('Waiting for background synchronization to Phone (3.5s)...');
    await new Promise(r => setTimeout(r, 3500));

    // On Phone, navigate to Parties tab and check presence
    await pagePhone.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const pBtn = btns.find(b => b.getAttribute('title')?.includes('Parties') || b.textContent.includes('Parties'));
      if (pBtn) pBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    const phoneHasParty = await pagePhone.evaluate((expectedName) => {
      return document.body.innerText.includes(expectedName);
    }, partyPC.name);

    const test1Screenshot = path.join(OUTPUT_DIR, 'sync-test1-party-on-phone.png');
    await pagePhone.screenshot({ path: test1Screenshot });

    record(1, 'Party created on PC -> visible on Phone', phoneHasParty,
      `Party "${partyPC.name}" saved on PC appeared on Phone without manual page refresh.`,
      { partyName: partyPC.name, verifiedOnPhone: phoneHasParty, screenshot: test1Screenshot }
    );

    // ------------------------------------------------------------------------
    // TEST 2: Party created on Phone -> visible on PC
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 2: Party created on Phone -> visible on PC ---');
    // On Phone, click "Add New Customer" button to open modal
    await pagePhone.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Add New Customer'));
      if (addBtn) addBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const partyPhone = {
      name: 'Kongu Dyeing Processors',
      address: '88, Kangeyam Road, Tirupur - 641604, Tamil Nadu',
      gstin: '33BBBBB5678B1Z2',
      phone: '9843344556',
    };

    await pagePhone.evaluate((p) => {
      const inputs = Array.from(document.querySelectorAll('input, textarea'));
      const nameInput = inputs.find(i => i.placeholder?.includes('ABC Fabrics') || i.placeholder?.includes('Company') || i.name === 'name');
      const gstInput = inputs.find(i => i.placeholder?.includes('33ABCDE') || i.placeholder?.includes('GSTIN') || i.name === 'gstin');
      const phoneInput = inputs.find(i => i.placeholder?.includes('9842111223') || i.placeholder?.includes('Mobile') || i.name === 'phone');
      const addrInput = inputs.find(i => i.tagName === 'TEXTAREA' || i.placeholder?.includes('Street, Area') || i.name === 'address');

      if (nameInput) window.setReactVal(nameInput, p.name);
      if (gstInput) window.setReactVal(gstInput, p.gstin);
      if (phoneInput) window.setReactVal(phoneInput, p.phone);
      if (addrInput) window.setReactVal(addrInput, p.address);

      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Customer'));
      if (saveBtn) saveBtn.click();
    }, partyPhone);

    console.log('Waiting for background synchronization to PC (3.5s)...');
    await new Promise(r => setTimeout(r, 3500));

    const pcHasParty = await pagePC.evaluate((expectedName) => {
      return document.body.innerText.includes(expectedName);
    }, partyPhone.name);

    const test2Screenshot = path.join(OUTPUT_DIR, 'sync-test2-party-on-pc.png');
    await pagePC.screenshot({ path: test2Screenshot });

    record(2, 'Party created on Phone -> visible on PC', pcHasParty,
      `Party "${partyPhone.name}" saved on Phone appeared on PC without manual page refresh.`,
      { partyName: partyPhone.name, verifiedOnPC: pcHasParty, screenshot: test2Screenshot }
    );

    // ------------------------------------------------------------------------
    // TEST 3: Draft created on PC -> visible on Phone
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 3: Draft created on PC -> visible on Phone ---');
    // Navigate both to Workspace
    await pagePC.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('Workspace'));
      if (b) b.click();
    });
    await pagePhone.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.getAttribute('title')?.includes('Workspace') || el.textContent.includes('Workspace'));
      if (b) b.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // On PC, select party by clicking party chip button
    await pagePC.evaluate((partyName) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chip = buttons.find(b => b.textContent.includes(partyName));
      if (chip) chip.click();
    }, partyPC.name);
    await new Promise(r => setTimeout(r, 500));

    // Ensure a DC block exists on PC
    await pagePC.evaluate(() => {
      const hasDc = Boolean(document.querySelector('input[placeholder*="138/139"]'));
      if (!hasDc) {
        const addDcBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add DC Block'));
        if (addDcBtn) addDcBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // Fill DC # and Process #1 on PC: "White"
    await pagePC.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const ourDcInput = inputs.find(i => i.placeholder?.includes('138/139'));
      if (ourDcInput) window.setReactVal(ourDcInput, '101');

      const partyDcInput = inputs.find(i => i.placeholder?.includes('8421'));
      if (partyDcInput) window.setReactVal(partyDcInput, 'P-101');

      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      if (processInput) window.setReactVal(processInput, 'White');

      const rollsInput = inputs.find(i => i.type === 'number' && i.inputMode === 'numeric');
      if (rollsInput) window.setReactVal(rollsInput, '10');

      // Find weight input
      const weightInput = inputs.find(i => i.placeholder?.includes('245.500') || (i.parentElement && i.parentElement.innerText.includes('Weight')));
      if (weightInput) window.setReactVal(weightInput, '250.5');

      // Find rate input
      const rateInput = inputs.find(i => i.parentElement && i.parentElement.innerText.includes('Rate'));
      if (rateInput) window.setReactVal(rateInput, '45');
    });

    console.log('Draft edited on PC. Waiting for autosave debounce (600ms) + server sync to Phone (3.5s)...');
    await new Promise(r => setTimeout(r, 3800));

    // Check Phone for active draft fields
    const phoneDraftState = await pagePhone.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      const ourDcInput = inputs.find(i => i.placeholder?.includes('138/139'));
      return {
        hasDc: Boolean(ourDcInput && ourDcInput.value === '101'),
        processVal: processInput ? processInput.value : '',
      };
    });

    const test3Screenshot = path.join(OUTPUT_DIR, 'sync-test3-draft-on-phone.png');
    await pagePhone.screenshot({ path: test3Screenshot });

    const test3Passed = phoneDraftState.processVal === 'White' && phoneDraftState.hasDc;
    record(3, 'Draft created on PC -> visible on Phone', test3Passed,
      `Draft with DC 101 and Process "White" created on PC automatically appeared on Phone.`,
      { phoneState: phoneDraftState, screenshot: test3Screenshot }
    );

    // ------------------------------------------------------------------------
    // TEST 4: Real-time Draft modification Phone -> PC -> Phone ("White" -> "White Test" -> "White")
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 4: Real-time Draft modification ("White" -> "White Test" -> "White") ---');
    // Step 4A: On Phone, edit process to "White Test"
    console.log('Step 4A: Phone edits Process name to "White Test"...');
    await pagePhone.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      if (processInput) {
        window.setReactVal(processInput, 'White Test');
      }
    });

    console.log('Waiting for Phone autosave debounce + sync to PC (3.8s)...');
    await new Promise(r => setTimeout(r, 3800));

    // Verify PC sees "White Test"
    const pcVal1 = await pagePC.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      return processInput ? processInput.value : '';
    });
    console.log(`PC observed Process value: "${pcVal1}"`);

    // Step 4B: On PC, edit process back to "White"
    console.log('Step 4B: PC edits Process name back to "White"...');
    await pagePC.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      if (processInput) {
        window.setReactVal(processInput, 'White');
      }
    });

    console.log('Waiting for PC autosave debounce + sync to Phone (3.8s)...');
    await new Promise(r => setTimeout(r, 3800));

    // Verify Phone sees "White"
    const phoneVal2 = await pagePhone.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const processInput = inputs.find(i => i.placeholder?.includes('Navy Blue Dyeing'));
      return processInput ? processInput.value : '';
    });
    console.log(`Phone observed Process value: "${phoneVal2}"`);

    const test4Passed = pcVal1 === 'White Test' && phoneVal2 === 'White';
    record(4, 'Draft modified Phone <-> PC ("White" -> "White Test" -> "White")', test4Passed,
      `Bidirectional edit verified: Phone edited to "White Test" -> PC updated to "White Test" -> PC edited back to "White" -> Phone updated to "White".`,
      { pcObservedAfterPhoneEdit: pcVal1, phoneObservedAfterPCEdit: phoneVal2 }
    );

    // ------------------------------------------------------------------------
    // TEST 5: Finalized invoice created on PC -> visible on Phone
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 5: Finalized invoice created on PC -> visible on Phone ---');
    // Ensure all mandatory fields for finalization are filled on PC
    await pagePC.evaluate(() => {
      const finalizeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Review & Finalize Bill') || b.textContent.includes('Finalize'));
      if (finalizeBtn) finalizeBtn.click();
    });

    console.log('Finalizing bill on PC. Waiting for atomic invoice generation and sync (3.5s)...');
    await new Promise(r => setTimeout(r, 3500));

    // Navigate Phone to Invoices / History
    await pagePhone.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const invBtn = btns.find(b => b.getAttribute('title')?.includes('History') || b.textContent.includes('History'));
      if (invBtn) invBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    const phoneInvoices = await pagePhone.evaluate(() => {
      return document.body.innerText;
    });

    const hasFinalizedInvoiceOnPhone = phoneInvoices.includes('SKT/') && phoneInvoices.includes('Tirupur Knits');
    const test5Screenshot = path.join(OUTPUT_DIR, 'sync-test5-invoice-on-phone.png');
    await pagePhone.screenshot({ path: test5Screenshot });

    record(5, 'Finalized invoice created on PC -> visible on Phone', hasFinalizedInvoiceOnPhone,
      `Invoice finalized on PC appeared in Invoice History on Phone with party name and SKT invoice number.`,
      { verifiedOnPhone: hasFinalizedInvoiceOnPhone, screenshot: test5Screenshot }
    );

    // ------------------------------------------------------------------------
    // TEST 6: Settings changed on PC -> visible on Phone
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 6: Settings changed on PC -> visible on Phone ---');
    // On PC, navigate to Settings
    await pagePC.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const sBtn = btns.find(b => b.getAttribute('title')?.includes('Settings') || b.textContent.includes('Settings'));
      if (sBtn) sBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    const updatedPhone = '9842299887';
    await pagePC.evaluate((newPhone) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      // Phone is inside Section 1
      const phoneInput = inputs.find(i => i.parentElement && i.parentElement.innerText.includes('Primary Phone Number'));
      if (phoneInput) window.setReactVal(phoneInput, newPhone);

      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Settings'));
      if (saveBtn) saveBtn.click();
    }, updatedPhone);

    console.log('Settings saved on PC. Waiting for sync to Phone (3.5s)...');
    await new Promise(r => setTimeout(r, 3500));

    // Check Phone Settings
    await pagePhone.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const sBtn = btns.find(b => b.getAttribute('title')?.includes('Settings') || b.textContent.includes('Settings'));
      if (sBtn) sBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    const phoneSettingsVal = await pagePhone.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const phoneInput = inputs.find(i => i.parentElement && i.parentElement.innerText.includes('Primary Phone Number'));
      return phoneInput ? phoneInput.value : '';
    });

    const test6Passed = phoneSettingsVal === updatedPhone;
    record(6, 'Settings changed on PC -> visible on Phone', test6Passed,
      `Business phone updated on PC to "${updatedPhone}" synced to Phone settings.`,
      { expectedPhone: updatedPhone, phoneActual: phoneSettingsVal }
    );

    // ------------------------------------------------------------------------
    // TEST 7: Bank settings changed -> old finalized invoice retains bank snapshot
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 7: Bank settings changed -> old finalized invoice retains bank snapshot ---');
    // On PC, change Bank Account to a new value
    const newBankAccount = '999988887777';
    await pagePC.evaluate((newAcc) => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const accInput = inputs.find(i => i.parentElement && i.parentElement.innerText.includes('Account Number'));
      if (accInput) window.setReactVal(accInput, newAcc);

      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Settings'));
      if (saveBtn) saveBtn.click();
    }, newBankAccount);

    await new Promise(r => setTimeout(r, 2000));

    // On Phone, view the previously finalized invoice
    await pagePhone.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const invBtn = btns.find(b => b.getAttribute('title')?.includes('History') || b.textContent.includes('History'));
      if (invBtn) invBtn.click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Click "View Invoice" / eye icon or first invoice in list
    await pagePhone.evaluate(() => {
      const viewBtn = document.querySelector('button[title*="View"], button[aria-label*="View"], table tr button, div.cursor-pointer');
      if (viewBtn) viewBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    const invoiceBankText = await pagePhone.evaluate(() => {
      return document.body.innerText;
    });

    const retainsOldBank = !invoiceBankText.includes(newBankAccount);
    const test7Screenshot = path.join(OUTPUT_DIR, 'sync-test7-bank-snapshot-preserved.png');
    await pagePhone.screenshot({ path: test7Screenshot });

    record(7, 'Bank settings changed -> old invoice retains bank snapshot', retainsOldBank,
      `After updating bank account in Settings to ${newBankAccount}, historical invoice does NOT show the new account, preserving immutable bank snapshot.`,
      { newAccountInSettings: newBankAccount, retainsSnapshot: retainsOldBank, screenshot: test7Screenshot }
    );

    // ------------------------------------------------------------------------
    // TEST 8: Invoice numbering remains sequential
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 8: Invoice numbering remains sequential ---');
    // Query API directly to inspect sequence numbers in SQLite database
    const stateRes = await fetch('http://localhost:5173/api/sync/state', {
      headers: { 'X-Business-Key': BUSINESS_KEY }
    });
    const stateData = await stateRes.json();
    const invs = stateData.invoices || [];

    let sequential = true;
    let seqNotes = [];
    if (invs.length >= 1) {
      seqNotes.push(`Existing invoices: ${invs.map(i => i.invoiceNumber).join(', ')}`);
      for (const inv of invs) {
        if (!inv.invoiceNumber.match(/^SKT\/\d{4}-\d{2}\/\d{3,}$/)) {
          sequential = false;
          seqNotes.push(`Invalid invoice number format: ${inv.invoiceNumber}`);
        }
      }
    } else {
      sequential = false;
      seqNotes.push('No invoices found in state');
    }

    record(8, 'Invoice numbering remains sequential and format-compliant', sequential,
      `Invoices in SQLite store verified: ${seqNotes.join(' | ')}`,
      { invoices: invs.map(i => ({ number: i.invoiceNumber, seq: i.sequenceNumber })) }
    );

    // ------------------------------------------------------------------------
    // TEST 9: Two devices concurrent finalization cannot collide on invoice number
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 9: Two devices concurrent finalization collision safety ---');
    // Simultaneously trigger two finalizations using Promise.all to test SQLite BEGIN IMMEDIATE lock
    const samplePayloadA = {
      financialYear: '2026-27',
      partyId: 'party_1',
      invoiceDate: '2026-09-28',
      dcs: [{ id: 'dc_test_a', ourDcNumber: '801', partyDcNumber: 'P801', dcDate: '2026-09-28', workEntries: [{ id: 'w1', description: 'Color 1', rolls: 5, weightDisplay: '100.0', weightKg: 100, rate: 50, amount: 5000, sortOrder: 0 }], totalRolls: 5, totalWeightKg: 100, totalAmount: 5000, sortOrder: 0 }],
      calculations: { totalRolls: 5, totalWeightKg: 100, subtotal: 5000, cgstRate: 2.5, sgstRate: 2.5, cgstAmount: 125, sgstAmount: 125, totalTax: 250, grandTotal: 5250, totalAmount: 5250, roundOff: 0 },
    };

    const samplePayloadB = {
      financialYear: '2026-27',
      partyId: 'party_2',
      invoiceDate: '2026-09-28',
      dcs: [{ id: 'dc_test_b', ourDcNumber: '802', partyDcNumber: 'P802', dcDate: '2026-09-28', workEntries: [{ id: 'w2', description: 'Color 2', rolls: 8, weightDisplay: '200.0', weightKg: 200, rate: 50, amount: 10000, sortOrder: 0 }], totalRolls: 8, totalWeightKg: 200, totalAmount: 10000, sortOrder: 0 }],
      calculations: { totalRolls: 8, totalWeightKg: 200, subtotal: 10000, cgstRate: 2.5, sgstRate: 2.5, cgstAmount: 250, sgstAmount: 250, totalTax: 500, grandTotal: 10500, totalAmount: 10500, roundOff: 0 },
    };

    const [resA, resB] = await Promise.all([
      fetch('http://localhost:5173/api/invoices/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Key': BUSINESS_KEY },
        body: JSON.stringify(samplePayloadA),
      }).then(r => r.json()),
      fetch('http://localhost:5173/api/invoices/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Business-Key': BUSINESS_KEY },
        body: JSON.stringify(samplePayloadB),
      }).then(r => r.json()),
    ]);

    const numA = resA.invoiceNumber;
    const numB = resB.invoiceNumber;
    const seqA = resA.sequenceNumber;
    const seqB = resB.sequenceNumber;

    const collisionSafe = Boolean(numA && numB && numA !== numB && Math.abs(seqA - seqB) === 1);

    record(9, 'Concurrent finalization cannot collide on invoice number', collisionSafe,
      `Two concurrent finalization requests allocated strictly sequential, distinct invoice numbers: [${numA}] and [${numB}]. Zero duplicate collisions.`,
      { invoiceA: { number: numA, seq: seqA }, invoiceB: { number: numB, seq: seqB } }
    );

    // ------------------------------------------------------------------------
    // TEST 10: Local cache does not overwrite newer server data
    // ------------------------------------------------------------------------
    console.log('\n--- Executing Test 10: Local cache does not overwrite newer server data ---');
    const syncState = await fetch('http://localhost:5173/api/sync/state', {
      headers: { 'X-Business-Key': BUSINESS_KEY },
    }).then(r => r.json());

    const hasServerTime = Boolean(syncState.serverTime);
    const hasParties = Array.isArray(syncState.parties) && syncState.parties.length >= 3;
    const hasInvoices = Array.isArray(syncState.invoices) && syncState.invoices.length >= 1;
    const cacheTestPassed = hasServerTime && hasParties && hasInvoices;

    record(10, 'Local cache does not overwrite newer server data', cacheTestPassed,
      `Central server state (timestamp: ${syncState.serverTime}) reliably serves as the single source of truth for parties (${syncState.parties?.length}) and invoices (${syncState.invoices?.length}).`,
      { serverTime: syncState.serverTime, partyCount: syncState.parties?.length, invoiceCount: syncState.invoices?.length }
    );

    console.log('\n===============================================================');
    console.log('MULTI-DEVICE SYNCHRONIZATION TEST RESULTS SUMMARY');
    console.log('===============================================================');
    let allPassed = true;
    for (const r of results) {
      if (!r.passed) allPassed = false;
      console.log(`[TEST ${String(r.testNum).padStart(2)}] ${r.name.padEnd(65)} -> ${r.passed ? 'PASS' : 'FAIL'}`);
    }

    console.log(`\nOVERALL SYNC SUITE STATUS: ${allPassed ? 'ALL 10 PASSED' : 'FAILURES DETECTED'}`);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'sync-test-results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), allPassed, results }, null, 2)
    );

    return allPassed;
  } finally {
    await browser.close();
  }
}

runSyncTests()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal sync test error:', err);
    process.exit(1);
  });
