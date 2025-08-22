// routes/student.js
const express = require("express");
const router = express.Router();
const Result = require("../models/Result");
const { calculateGPA } = require("../utils/gradeUtils");
const authenticateToken = require("../middlewares/checkLog");
const getUser = require("../middlewares/getUser");

// ✅ Fix role check
function isStudent(req, res, next) {
  if (req.user && req.user.role === "student") {
    return next();
  }
  req.flash("error", "Access denied. Students only.");
  return res.redirect("/");
}

router.get("/dashboard", authenticateToken, getUser , isStudent, async (req, res) => {
  try {
    const user =req.user
    console.log(user);
    
    res.render("student/dashboard", {
      title: "Student Dashboard",
      isLoggedIn: true,
      user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error loading dashboard");
    res.redirect("/");
  }
});

// View Results
router.get("/results", authenticateToken,getUser, isStudent, async (req, res) => {
  try {
    const results = await Result.find({ student: req.user._id })
      .populate("course");

    const gpa = await calculateGPA(req.user._id, req.user.department);

    res.render("student/results", {
      results,
      gpa,
      title: "My Results",
      isLoggedIn: true,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error fetching results");
    res.redirect("/student/dashboard");
  }
});

// View Timetable
router.get("/timetable", authenticateToken,getUser, isStudent, async (req, res) => {
  try {
    const Schedule = require("../models/Schedule");
    const schedules = await Schedule.find()
      .populate("course")
      .populate("lecturer")
      .populate("classroom");

    // ✅ Safer filter by department & level
    const filtered = schedules.filter(s => 
      s.course.department?.toString() === req.user.department?.toString() &&
      s.course.level?.includes(req.user.level)
    );

    res.render("student/timetable", {
      schedules: filtered,
      title: "My Timetable",
      isLoggedIn: true,
      user: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error fetching timetable");
    res.redirect("/student/dashboard");
  }
});

module.exports = router;
