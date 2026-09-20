import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://www.screener.in/company/E2E/consolidated/', { waitUntil: 'networkidle2' });
  const content = await page.evaluate(() => {
    // Extract Quarterly Results Table
    const quarters = [];
    const section = document.getElementById('quarters');
    if (section) {
      const thead = section.querySelector('thead tr');
      const ths = thead ? Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim()) : [];
      
      const salesRow = Array.from(section.querySelectorAll('tbody tr')).find(tr => tr.textContent.includes('Sales'));
      const npRow = Array.from(section.querySelectorAll('tbody tr')).find(tr => tr.textContent.includes('Net Profit'));
      const epsRow = Array.from(section.querySelectorAll('tbody tr')).find(tr => tr.textContent.includes('EPS in Rs'));
      const opmRow = Array.from(section.querySelectorAll('tbody tr')).find(tr => tr.textContent.includes('OPM %'));
      
      if (salesRow && ths.length > 1) {
        const salesTds = Array.from(salesRow.querySelectorAll('td')).map(td => td.textContent.trim());
        const npTds = npRow ? Array.from(npRow.querySelectorAll('td')).map(td => td.textContent.trim()) : [];
        const epsTds = epsRow ? Array.from(epsRow.querySelectorAll('td')).map(td => td.textContent.trim()) : [];
        const opmTds = opmRow ? Array.from(opmRow.querySelectorAll('td')).map(td => td.textContent.trim()) : [];
        
        for (let i = 1; i < ths.length; i++) {
          if (ths[i]) {
            quarters.push({
              quarter: ths[i],
              revenue: parseFloat(salesTds[i-1].replace(/,/g, '')),
              pat: npTds.length > 0 ? parseFloat(npTds[i-1].replace(/,/g, '')) : 0,
              eps: epsTds.length > 0 ? parseFloat(epsTds[i-1].replace(/,/g, '')) : 0,
              ebitdaMargin: opmTds.length > 0 ? parseFloat(opmTds[i-1].replace(/%/g, '')) : 0,
            });
          }
        }
      }
    }
    return quarters;
  });
  
  console.log(JSON.stringify(content, null, 2));
  
  await browser.close();
})();
