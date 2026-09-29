const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.evaluateOnNewDocument(() => {
    window.setReactVal = function(el, val) {
      if (!el) return;
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, val); else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // Add party
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.find(b => b.textContent.includes('Parties')).click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.find(b => b.textContent.includes('Add New Customer')).click();
  });
  await new Promise(r => setTimeout(r, 400));

  await page.evaluate(() => {
    const form = document.querySelector('form');
    const inputs = Array.from(form.querySelectorAll('input, textarea'));
    window.setReactVal(inputs[0], 'Test Garments Private Limited');
    window.setReactVal(inputs[1], '12, Cotton Market Road, Tirupur - 641604, Tamil Nadu');
    window.setReactVal(inputs[2], '33ABCDE1234F1Z9');
    window.setReactVal(inputs[3], '9876543210');
    form.querySelector('button[type="submit"]').click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Back to workspace
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('header button'));
    buttons.find(b => b.textContent.includes('Workspace')).click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Select customer
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('button'));
    const chip = chips.find(b => b.textContent.includes('Test Garments Private Limited'));
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Set date
  await page.evaluate(() => {
    const dateInput = document.querySelector('input[type="date"]');
    window.setReactVal(dateInput, '2026-09-28');
  });
  await new Promise(r => setTimeout(r, 400));

  async function fillDC(dcIndex, ourDc, partyDc, date, entries) {
    const currentDCCount = await page.evaluate(() => document.querySelectorAll('.bg-slate-100\\/80').length);
    if (dcIndex >= currentDCCount) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const addDcBtn = buttons.find(b => b.textContent.includes('Add Another Delivery Challan'));
        if (addDcBtn) addDcBtn.click();
      });
      await new Promise(r => setTimeout(r, 400));
    }

    await page.evaluate((idx, oDc, pDc, pDate) => {
      const dcBlocks = document.querySelectorAll('.bg-slate-100\\/80');
      const block = dcBlocks[idx];
      const inputs = block.querySelectorAll(':scope > .grid input');
      window.setReactVal(inputs[0], oDc);
      window.setReactVal(inputs[1], pDc);
      window.setReactVal(inputs[2], pDate);
    }, dcIndex, ourDc, partyDc, date);
    await new Promise(r => setTimeout(r, 200));

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

  console.log('Filling DCs...');
  await fillDC(0, '147', '128', '2026-03-26', [
    { desc: 'White', rolls: 61, weight: '620.400', rate: 33 },
    { desc: 'White Lot', rolls: 37, weight: '310.800', rate: 33 },
  ]);
  await fillDC(1, '120', '126', '2026-03-20', [
    { desc: 'Lt. Maroon', rolls: 5, weight: '92.900', rate: 80 },
    { desc: 'Skin', rolls: 7, weight: '140.000', rate: 80 },
  ]);
  await fillDC(2, '154', '130', '2026-03-31', [
    { desc: 'White', rolls: 56, weight: '570.900', rate: 33 },
  ]);
  await fillDC(3, '153', '129', '2026-03-26', [
    { desc: 'White', rolls: 37, weight: '310.800', rate: 33 },
  ]);
  await fillDC(4, '138/139', 'DC-A', '2026-03-28', [
    { desc: 'Bio Wash & Stenter', rolls: 10, weight: '125 KG 500 GMS', rate: 45 },
  ]);

  await new Promise(r => setTimeout(r, 500));

  // Diagnose state
  const state = await page.evaluate(() => {
    const summary = document.querySelector('.lg\\:col-span-4');
    const finBtn = summary ? summary.querySelector('button') : null;
    const alertBox = summary ? summary.querySelector('.bg-amber-50') : null;
    const okBox = summary ? summary.querySelector('.bg-emerald-50') : null;
    return {
      finBtnDisabled: finBtn ? finBtn.disabled : null,
      finBtnText: finBtn ? finBtn.textContent : null,
      alertText: alertBox ? alertBox.textContent : null,
      okText: okBox ? okBox.textContent : null,
    };
  });

  console.log('Diagnose state:', state);

  // Now click finalize
  await page.evaluate(() => {
    const summary = document.querySelector('.lg\\:col-span-4');
    const finBtn = summary.querySelector('button');
    finBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  const afterFinalize = await page.evaluate(() => {
    const invArea = document.querySelector('#invoice-print-area');
    return {
      hasInvArea: !!invArea,
      text: invArea ? invArea.textContent.substring(0, 300) : 'none'
    };
  });

  console.log('After finalize:', afterFinalize);
  await browser.close();
})();
