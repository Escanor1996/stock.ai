import axios from 'axios';

async function test() {
  try {
    const url = "https://query2.finance.yahoo.com/v10/finance/quoteSummary/E2E.NS?modules=financialData,defaultKeyStatistics,summaryDetail,earnings,incomeStatementHistoryQuarterly";
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    console.log(JSON.stringify(res.data.quoteSummary.result[0], null, 2));
  } catch(e) {
    console.error(e.message);
  }
}
test();
