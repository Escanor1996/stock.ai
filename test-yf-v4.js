import { YahooFinance } from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const res = await yahooFinance.quoteSummary('E2E.NS', { modules: ['summaryDetail', 'financialData', 'earnings', 'defaultKeyStatistics'] });
    console.log(Object.keys(res));
  } catch(e) {
    console.error(e);
  }
}
test();
