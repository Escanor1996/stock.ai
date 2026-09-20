import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://equisense.ai/company/E2E', { waitUntil: 'networkidle2' });
  await page.waitForSelector('text/360° Profile', { timeout: 10000 }).catch(e => {});

  const content = await page.evaluate(() => {
    return document.body.innerText;
  });
  
  console.log(content.indexOf('REVENUE PROJECTIONS'));
  console.log(content.substring(content.indexOf('REVENUE PROJECTIONS'), content.indexOf('REVENUE PROJECTIONS') + 500));
  
  await browser.close();
})();
