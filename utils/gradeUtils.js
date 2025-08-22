// utils/gradeUtils.js
function getGrade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

function gradePoint(grade) {
  switch (grade) {
    case "A": return 5;
    case "B": return 4;
    case "C": return 3;
    case "D": return 2;
    case "E": return 1;
    default: return 0;
  }
}

async function calculateGPA(studentId, department) {
  const Result = require("../models/Result");
  const results = await Result.find({ student: studentId })
    .populate("course");

  const filtered = results.filter(r => r.course.department.toLowerCase() === department.toLowerCase());

  let totalPoints = 0;
  let totalUnits = 0;

  for (const r of filtered) {
    totalPoints += r.course.unit * gradePoint(r.grade);
    totalUnits += r.course.unit;
  }

  return totalUnits === 0 ? 0 : (totalPoints / totalUnits).toFixed(2);
}

module.exports = { getGrade, gradePoint, calculateGPA };
