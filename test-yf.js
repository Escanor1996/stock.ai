const yahooFinance = require('yahoo-finance2').default;

async function test() {
  try {
    const result = await yahooFinance.quoteSummary('E2E.NS', { modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics'] });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
