import yf from 'yahoo-finance2';
async function test() {
  try {
    const res = await yf.quote('E2E.NS');
    console.log(res);
  } catch(e) {
    console.error(e);
  }
}
test();
