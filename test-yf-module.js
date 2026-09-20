import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const result = await yahooFinance.quoteSummary('E2E.NS', { modules: ['earnings', 'incomeStatementHistoryQuarterly'] });
    console.log(JSON.stringify(result.earnings, null, 2));
    console.log(JSON.stringify(result.incomeStatementHistoryQuarterly, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
