/**
 * Individual Health Index (IHI) Engine — OHC Command
 * Score: 0–100 per employee based on clinical parameters
 *
 * Breakdown (max 100):
 *  Fitness Status     → 20 pts
 *  Blood Pressure     → 20 pts
 *  Blood Sugar        → 15 pts
 *  Haemoglobin        → 15 pts
 *  BMI                → 15 pts
 *  Cholesterol        → 10 pts
 *  Data completeness  →  5 pts
 */

export function calcIHI(employee = {}, latestExam = {}, latestVitals = {}) {
  let score = 0;
  const breakdown = {};

  // 1. FITNESS STATUS — 20 pts
  const fitness = latestExam?.fitnessResult || employee?.fitnessStatus || 'Pending';
  const fitMap = { 'Fit': 20, 'Fit with Restriction': 12, 'Unfit': 0, 'Pending': 8 };
  const fitScore = fitMap[fitness] ?? 8;
  score += fitScore; breakdown.fitness = fitScore;

  // 2. BLOOD PRESSURE — 20 pts
  const bp = latestExam?.bp || latestVitals?.bp || '';
  const bpScore = scoreBP(bp);
  score += bpScore; breakdown.bp = bpScore;

  // 3. BLOOD SUGAR — 15 pts
  const sugar = parseFloat(latestExam?.bloodSugar || latestVitals?.cbg || 0);
  const sugarScore = scoreSugar(sugar);
  score += sugarScore; breakdown.sugar = sugarScore;

  // 4. HAEMOGLOBIN — 15 pts
  const hb = parseFloat(latestExam?.haemoglobin || 0);
  const hbScore = scoreHB(hb, employee?.gender);
  score += hbScore; breakdown.hb = hbScore;

  // 5. BMI — 15 pts
  const weight = parseFloat(latestExam?.weight || latestVitals?.weight || 0);
  const height = parseFloat(latestExam?.height || latestVitals?.height || 0);
  const bmiScore = scoreBMI(weight, height);
  score += bmiScore; breakdown.bmi = bmiScore;

  // 6. CHOLESTEROL — 10 pts
  const chol = parseFloat(latestExam?.totalCholesterol || 0);
  const cholScore = scoreChol(chol);
  score += cholScore; breakdown.chol = cholScore;

  // 7. DATA COMPLETENESS — 5 pts
  const hasData = bp || sugar || hb || weight;
  const dataScore = hasData ? 5 : 0;
  score += dataScore; breakdown.data = dataScore;

  const total = Math.min(100, Math.round(score));
  return { score: total, grade: gradeIHI(total), color: colorIHI(total), breakdown };
}

function scoreBP(bp) {
  if (!bp) return 10;
  const [sysStr, diaStr] = bp.toString().split('/');
  const sys = parseInt(sysStr), dia = parseInt(diaStr);
  if (isNaN(sys) || isNaN(dia)) return 10;
  if (sys <= 120 && dia <= 80)  return 20;
  if (sys <= 130 && dia <= 85)  return 16;
  if (sys <= 140 && dia <= 90)  return 12;
  if (sys <= 160 && dia <= 100) return 6;
  return 0;
}

function scoreSugar(sugar) {
  if (!sugar || sugar <= 0) return 8;
  if (sugar <= 140) return 15;
  if (sugar <= 180) return 10;
  if (sugar <= 200) return 5;
  return 0;
}

function scoreHB(hb, gender) {
  if (!hb || hb <= 0) return 8;
  const female = gender?.toLowerCase() === 'female';
  const min = female ? 12 : 13;
  if (hb >= min)     return 15;
  if (hb >= min - 2) return 10;
  if (hb >= 8)       return 5;
  return 0;
}

function scoreBMI(weight, height) {
  if (!weight || !height || height <= 0) return 8;
  const bmi = weight / ((height / 100) ** 2);
  if (bmi >= 18.5 && bmi < 25)  return 15;
  if (bmi >= 17   && bmi < 27.5)return 10;
  if (bmi >= 15   && bmi < 30)  return 5;
  return 0;
}

function scoreChol(chol) {
  if (!chol || chol <= 0) return 5;
  if (chol < 200) return 10;
  if (chol < 240) return 6;
  return 0;
}

export function gradeIHI(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 30) return 'Below Average';
  return 'Poor';
}

export function colorIHI(score) {
  if (score >= 85) return '#74c69d';
  if (score >= 70) return '#4a9eca';
  if (score >= 50) return '#f0a500';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}
