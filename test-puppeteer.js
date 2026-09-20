import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Navigate the page to a URL
  await page.goto('https://equisense.ai/company/E2E', { waitUntil: 'networkidle2' });
  
  // Wait for the data to load by looking for the 360 profile section
  await page.waitForSelector('text/360° Profile', { timeout: 10000 }).catch(e => console.log('Timeout waiting for selector'));

  // Get content
  const content = await page.evaluate(() => {
    return document.body.innerText.substring(0, 5000);
  });
  
  console.log(content);
  
  await browser.close();
})();
