const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'Mobile 320', width: 320, height: 640 },
  { name: 'Mobile 360', width: 360, height: 740 },
  { name: 'Mobile 390', width: 390, height: 844 },
  { name: 'Mobile 414', width: 414, height: 896 },
];

async function runResponsiveTests() {
  console.log('===============================================================');
  console.log('Starting Mobile Responsiveness Automated Verification Suite');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];

  function record(viewport, screen, clientWidth, scrollWidth, overflowHiddenUsed, passed, screenshotPath) {
    const overflowDiff = scrollWidth - clientWidth;
    results.push({
      viewport: `${viewport.width}x${viewport.height}`,
      name: viewport.name,
      screen,
      clientWidth,
      scrollWidth,
      overflowDiff,
      overflowHiddenUsed,
      passed,
      screenshot: screenshotPath,
    });

    console.log(`[VIEWPORT ${viewport.width}x${viewport.height}] Screen: ${screen}`);
    console.log(`  clientWidth: ${clientWidth}px | scrollWidth: ${scrollWidth}px | overflowDiff: ${overflowDiff}px`);
    console.log(`  overflow-x:hidden hack used: ${overflowHiddenUsed ? 'YES (FAIL)' : 'NO (CLEAN)'}`);
    console.log(`  STATUS: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Screenshot: ${screenshotPath}\n`);
  }

  try {
    const page = await browser.newPage();

    for (const vp of VIEWPORTS) {
      console.log(`\n-----------------------------------------------------------`);
      console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      console.log(`-----------------------------------------------------------`);

      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });
      await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
      await page.waitForSelector('header');

      // 1. Check Workspace Screen
      const wsMetrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const htmlStyle = window.getComputedStyle(root);
        const bodyStyle = window.getComputedStyle(body);
        const overflowHiddenUsed = htmlStyle.overflowX === 'hidden' || bodyStyle.overflowX === 'hidden';

        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          overflowHiddenUsed,
        };
      });

      const wsScreenshot = path.join(OUTPUT_DIR, `responsive-${vp.width}x${vp.height}-workspace.png`);
      await page.screenshot({ path: wsScreenshot, fullPage: false });

      const wsPassed = wsMetrics.scrollWidth <= wsMetrics.clientWidth && !wsMetrics.overflowHiddenUsed;
      record(vp, 'Workspace', wsMetrics.clientWidth, wsMetrics.scrollWidth, wsMetrics.overflowHiddenUsed, wsPassed, wsScreenshot);

      // 2. Check Invoices History Screen
      // Click History tab (mobile navbar uses compact buttons)
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const historyBtn = buttons.find(b =>
          b.getAttribute('title')?.includes('History') ||
          b.getAttribute('aria-label')?.includes('History') ||
          b.textContent.includes('History') ||
          b.innerHTML.includes('Receipt')
        );
        if (historyBtn) historyBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));

      const invMetrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const htmlStyle = window.getComputedStyle(root);
        const bodyStyle = window.getComputedStyle(body);
        const overflowHiddenUsed = htmlStyle.overflowX === 'hidden' || bodyStyle.overflowX === 'hidden';

        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          overflowHiddenUsed,
        };
      });

      const invScreenshot = path.join(OUTPUT_DIR, `responsive-${vp.width}x${vp.height}-invoices.png`);
      await page.screenshot({ path: invScreenshot, fullPage: false });

      const invPassed = invMetrics.scrollWidth <= invMetrics.clientWidth && !invMetrics.overflowHiddenUsed;
      record(vp, 'Invoices / History', invMetrics.clientWidth, invMetrics.scrollWidth, invMetrics.overflowHiddenUsed, invPassed, invScreenshot);

      // 3. Check Parties Screen
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const partyBtn = buttons.find(b =>
          b.getAttribute('title')?.includes('Parties') ||
          b.getAttribute('aria-label')?.includes('Parties') ||
          b.textContent.includes('Parties') ||
          b.innerHTML.includes('Users')
        );
        if (partyBtn) partyBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));

      const partyMetrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const htmlStyle = window.getComputedStyle(root);
        const bodyStyle = window.getComputedStyle(body);
        const overflowHiddenUsed = htmlStyle.overflowX === 'hidden' || bodyStyle.overflowX === 'hidden';

        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          overflowHiddenUsed,
        };
      });

      const partyScreenshot = path.join(OUTPUT_DIR, `responsive-${vp.width}x${vp.height}-parties.png`);
      await page.screenshot({ path: partyScreenshot, fullPage: false });

      const partyPassed = partyMetrics.scrollWidth <= partyMetrics.clientWidth && !partyMetrics.overflowHiddenUsed;
      record(vp, 'Party Manager', partyMetrics.clientWidth, partyMetrics.scrollWidth, partyMetrics.overflowHiddenUsed, partyPassed, partyScreenshot);
    }

    console.log('\n===============================================================');
    console.log('RESPONSIVENESS TEST RESULTS SUMMARY');
    console.log('===============================================================');
    let allPassed = true;
    for (const r of results) {
      if (!r.passed) allPassed = false;
      console.log(`Viewport ${r.viewport.padEnd(8)} | ${r.screen.padEnd(18)} | clientWidth: ${r.clientWidth}px | scrollWidth: ${r.scrollWidth}px | diff: ${r.overflowDiff}px | PASS: ${r.passed}`);
    }

    console.log(`\nOVERALL RESPONSIVENESS STATUS: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);

    // Save JSON results
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'responsive-test-results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), allPassed, results }, null, 2)
    );

    return allPassed;
  } finally {
    await browser.close();
  }
}

runResponsiveTests()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
