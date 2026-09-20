import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto('https://equisense.ai/company/E2E', { waitUntil: 'networkidle2' });
  await page.waitForSelector('text/THE STORY', { timeout: 10000 }).catch(e => console.log('Timeout'));

  const data = await page.evaluate(() => {
    // Helper to get next text after a label
    const getTextAfter = (text) => {
      const els = Array.from(document.querySelectorAll('*')).filter(el => el.textContent === text && el.children.length === 0);
      if (els.length > 0) {
        // often the value is in the next sibling or parent's next sibling
        let current = els[0];
        if (current.nextElementSibling) return current.nextElementSibling.textContent.trim();
        if (current.parentElement && current.parentElement.nextElementSibling) return current.parentElement.nextElementSibling.textContent.trim();
        return current.parentElement.textContent.replace(text, '').trim();
      }
      return null;
    };
    
    // Find section by header
    const getSectionText = (headerText) => {
      const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, .section-title, p, div')).filter(el => el.textContent.trim() === headerText);
      if (headers.length > 0) {
        let text = [];
        let next = headers[0].nextElementSibling;
        while(next && !next.querySelector('h1, h2, h3, h4, h5, h6')) {
          if (next.tagName !== 'BUTTON') { // skip "Show more" buttons
            text.push(next.textContent.trim());
          }
          next = next.nextElementSibling;
        }
        return text.join('\n');
      }
      return null;
    };

    return {
      mktCap: getTextAfter('MKT CAP'),
      pe: getTextAfter('P/E'),
      roe: getTextAfter('ROE TTM'),
      story: getSectionText('THE STORY'),
      whatTheyDo: getSectionText('WHAT THEY DO'),
    };
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
