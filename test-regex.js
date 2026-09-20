const text = `
REVENUE PROJECTIONS [AI MODELING]
Confidence: 88%
⚠ AI-generated estimate · Not investment advice · Not SEBI registered
₹156.76 Cr
Q1 FY27
Actual
₹250 Cr
Q2 FY27
QoQ +59.5%
YoY +470.8%
₹320 Cr
Q3 FY27
QoQ +28.0%
YoY +357.0%
`;
const extractQuarters = (rawText) => {
  const lines = rawText.split('\n');
  const projIndex = lines.findIndex(l => l.includes('REVENUE PROJECTIONS'));
  const quarters = [];
  if (projIndex !== -1) {
    let currentQ = {};
    for (let i = projIndex; i < Math.min(projIndex + 50, lines.length); i++) {
      const line = lines[i].trim();
      if (line.match(/^₹[\d.,]+\s*Cr$/)) {
        if (currentQ.quarter) quarters.push(currentQ);
        currentQ = {
          revenue: parseFloat(line.replace(/[^\d.]/g, '')),
          pat: 0, ebitdaMargin: 0, eps: 0, beat: true, patGrowthYoY: 0, revGrowthYoY: 0
        };
      } else if (line.match(/^Q\d\s+FY\d+$/)) {
        if (currentQ.revenue !== undefined) currentQ.quarter = line;
      } else if (line.match(/^YoY\s+([+-][\d.]+)%$/)) {
        if (currentQ.revenue !== undefined) {
            const match = line.match(/^YoY\s+([+-][\d.]+)%$/);
            currentQ.revGrowthYoY = parseFloat(match[1]);
        }
      }
    }
    if (currentQ.quarter) quarters.push(currentQ);
  }
  return quarters;
};

console.log(extractQuarters(text));
