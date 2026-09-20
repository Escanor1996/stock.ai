import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ 
      executablePath: '/usr/bin/google-chrome', // Use system chrome to bypass install error
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    console.log('Navigated to localhost:3000');
    
    // Evaluate inside browser to click the 360 button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn360 = btns.find(b => b.textContent.includes('360° Deep Dive'));
      if (btn360) {
        console.log('Clicking 360 Deep Dive button...');
        btn360.click();
      } else {
        console.log('Could not find 360 button');
      }
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const text = await page.evaluate(() => document.body.innerText);
    console.log('TEXT LENGTH:', text.length);
    if (text.includes('Crash')) console.log('Caught by ErrorBoundary!');
    if (text.length < 50) console.log('HTML:', await page.evaluate(() => document.body.innerHTML));
    
    await browser.close();
  } catch (e) {
    console.log('Script failed:', e.message);
  }
})();