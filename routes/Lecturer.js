// routes/lecturer.js
const express = require("express");
const router = express.Router();
const Result = require("../models/Result");
const Course = require("../models/Course");
const User = require("../models/User");
const { getGrade } = require("../utils/gradeUtils");
const authenticateToken = require("../middlewares/checkLog");
const getUser = require("../middlewares/getUser");
const { Parser } = require("json2csv");
const multer = require("multer");
const XLSX = require("xlsx");

const upload = multer({ dest: "uploads/" });

/**
 * Middleware to check lecturer role
 */
function isLecturer(req, res, next) {
  if (req.user && req.user.role === "lecturer") {
    return next();
  }
  req.flash("error", "Access denied. Lecturers only.");
  res.redirect("/");
}
// routes/lecturer.js
const Schedule = require("../models/Schedule"); // <-- import schedule model
const csv = require("csv-parser");
const fs = require("fs");
const { log } = require("console");

// Download results for a department
router.get("/results/download/:department", authenticateToken, getUser, isLecturer, async (req, res) => {
  try {
    const { department } = req.params;

    const results = await Result.find()
      .populate({
        path: "student",
        match: { role: "student", department },
        select: "name matricNumber level department"
      })
      .populate("course", "code title");

    const filtered = results.filter(r => r.student);

    if (!filtered.length) {
      req.flash("error", "No results found for this department.");
      return res.redirect("/lecturer/results");
    }

    const data = filtered.map(r => ({
      name: r.student.name,
      matricNumber: r.student.matricNumber,
      level: r.student.level,
      department: r.student.department,
      course: `${r.course.code} - ${r.course.title}`,
      score: r.score,
      grade: r.grade
    }));

    const fields = ["name", "matricNumber", "level", "department", "course", "score", "grade"];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment(`${department}_results.csv`);
    res.send(csv);
  } catch (err) {
    console.error("Download error:", err);
    req.flash("error", "Error downloading results.");
    res.redirect("/lecturer/results");
  }
});
router.get("/results/analysis/:department", authenticateToken, getUser, isLecturer, async (req, res) => {
  try {
    const { department } = req.params;

    const results = await Result.find()
      .populate({
        path: "student",
        match: { role: "student", department },
        select: "name matricNumber level department"
      })
      .populate("course", "code title");

    const filtered = results.filter(r => r.student);

    if (!filtered.length) {
      req.flash("error", "No results found for this department.");
      return res.redirect("/lecturer/results");
    }

    // ✅ Define pass mark (you can change this if needed)
    const PASS_MARK = 40;

    const passes = filtered.filter(r => r.score >= PASS_MARK);
    const fails = filtered.filter(r => r.score < PASS_MARK);

    // ✅ Format student details for CSV
    const formatData = arr =>
      arr.map(r => ({
        name: r.student.name,
        matricNumber: r.student.matricNumber,
        level: r.student.level,
        department: r.student.department,
        course: `${r.course.code} - ${r.course.title}`,
        score: r.score,
        grade: r.grade
      }));

    const data = {
      summary: {
        total: filtered.length,
        passed: passes.length,
        failed: fails.length
      },
      passedStudents: formatData(passes),
      failedStudents: formatData(fails)
    };

    // ✅ If you want CSV download instead of JSON:
    const fields = ["name", "matricNumber", "level", "department", "course", "score", "grade"];
    const parser = new Parser({ fields });
    const csvPassed = parser.parse(data.passedStudents);
    const csvFailed = parser.parse(data.failedStudents);

    res.header("Content-Type", "text/csv");
    res.attachment(`${department}_analysis.csv`);
    res.send(`SUMMARY\nTotal: ${data.summary.total}, Passed: ${data.summary.passed}, Failed: ${data.summary.failed}\n\nPASSED STUDENTS\n${csvPassed}\n\nFAILED STUDENTS\n${csvFailed}`);

    // ✅ Or just return JSON analysis
    res.json(data);

  } catch (err) {
    console.error("Analysis error:", err);
    req.flash("error", "Error generating analysis.");
    res.redirect("/lecturer/results");
  }
});

// Upload filled student file (CSV/Excel)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded");

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const inserted = await User.insertMany(
      data.map((d) => ({
        name: d.name,
        matricNumber: d.matricNumber,   // <-- changed
        department: d.department,
        role: "student",
      })),
      { ordered: false }
    );

    res.json({
      message: "Students uploaded successfully",
      count: inserted.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send(err.message);
  }
});

// Bulk upload results
router.post("/results/upload", authenticateToken, getUser, isLecturer, upload.single("csvFile"), async (req, res) => {
  try {
    if (!req.file) {
      req.flash("error", "No file uploaded.");
      return res.redirect("/lecturer/results");
    }

    const filePath = req.file.path;

    const rows = await new Promise((resolve, reject) => {
      const data = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => data.push(row))
        .on("end", () => resolve(data))
        .on("error", reject);
    });

    let successCount = 0;
    let skipped = [];

    for (const row of rows) {
      const matricNumber = row.matricNumber || row.MatricNumber;
      const score = row.scores || row.score || row.Score;
      const courseField = row.course || row.Course;

      if (!matricNumber || !score || !courseField) {
        skipped.push(row);
        continue;
      }

      const student = await User.findOne({ matricNumber, role: "student" });
      const courseCode = courseField.split(" - ")[0].trim();
      const course = await Course.findOne({ code: courseCode, lecturer: req.user._id });

      if (!student || !course) {
        skipped.push(row);
        continue;
      }

      const grade = getGrade(Number(score));

      await Result.findOneAndUpdate(
        { student: student._id, course: course._id },
        { score: Number(score), grade },
        { upsert: true, new: true }
      );

      successCount++;
    }

    fs.unlinkSync(filePath);

    if (skipped.length > 0) {
      req.flash("warning", `Uploaded ${successCount} results, but skipped ${skipped.length} rows.`);
    } else {
      req.flash("success", `Uploaded ${successCount} results successfully.`);
    }

    res.redirect("/lecturer/results");
  } catch (err) {
    console.error("Bulk upload error:", err);
    req.flash("error", "Error processing CSV.");
    res.redirect("/lecturer/results");
  }
});

// View lecturer's courses
router.get(
  "/courses",
  authenticateToken,
  getUser,
  isLecturer,
  async (req, res) => {
    try {
      const courses = await Course.find({ lecturer: req.user._id });

      res.render("lecturer/courses", {
        courses,
        title: "My Courses",
        user: req.user,
        isLoggedIn: true,
      });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching courses.");
      res.redirect("/lecturer/dashboard");
    }
  }
);

// View lecturer's timetable
router.get(
  "/timetable",
  authenticateToken,
  getUser,
  isLecturer,
  async (req, res) => {
    try {
      const schedules = await Schedule.find({ lecturer: req.user._id })
        .populate("course")
        .populate("classroom");

      res.render("lecturer/timetable", {
        schedules,
        title: "My Timetable",
        user: req.user,
        isLoggedIn: true,
      });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching timetable.");
      res.redirect("/lecturer/dashboard");
    }
  }
);

// Lecturer dashboard
router.get("/dashboard", authenticateToken, getUser, isLecturer, async (req, res) => {
  try {
    // Get lecturer info
    const lecturer = await User.findById(req.user._id);

    // Get students in lecturer's department
    const students = await User.find({
      role: "student",
      department: lecturer.department,
    });

    // Get courses assigned to lecturer
    const courses = await Course.find({ lecturer: lecturer._id });

    // Prepare course stats for chart: students per course
    const courseStats = await Promise.all(
      courses.map(async (course) => {
        // Count students enrolled in this course
        // Assumes User model has courses array field storing enrolled course IDs
        const enrolledCount = await User.countDocuments({
          role: "student",
          courses: course._id,
        });
        return { name: course.title, count: enrolledCount };
      })
    );

    // Render dashboard
    res.render("lecturer/dashboard", {
      lecturer,
      students,
      courses,
      stats: {
        totalStudents: students.length,
        totalCourses: courses.length,
      },
      courseStats,   // Pass this for the chart
      title: "Lecturer Dashboard",
      user: req.user,
      isLoggedIn: true,
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Error loading dashboard.");
    res.redirect("/");
  }
});
// View all students in lecturer's department
router.get(
  "/students",
  authenticateToken,
  getUser,
  isLecturer,
  async (req, res) => {
    try {
      const lecturer = await User.findById(req.user._id);

      const students = await User.find({
        role: "student",
        department: lecturer.department,
      });

      // Get lecturer's courses for score modal dropdown
      const courses = await Course.find({ lecturer: lecturer._id });

      res.render("lecturer/students", {
        students,
        department: lecturer.department,
        courses,
        title: "Lecturer Dashboard",
        user: req.user,
        isLoggedIn: true,
      });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching students.");
      res.redirect("/lecturer/dashboard");
    }
  }
);

// Score a student
router.post(
  "/score/:studentId",
  authenticateToken,
  getUser,
  isLecturer,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { courseId, score } = req.body;

      // Convert score -> grade
      const grade = getGrade(score);

      await Result.findOneAndUpdate(
        { student: studentId, course: courseId },
        { score, grade },
        { upsert: true, new: true }
      );

      req.flash("success", "Score recorded successfully.");
      res.redirect("/lecturer/students");
    } catch (err) {
      console.error(err);
      req.flash("error", "Error recording score.");
      res.redirect("/lecturer/students");
    }
  }
);
// View all student results (lecturer's department only)
router.get(
  "/results",
  authenticateToken,
  getUser,
  isLecturer,
  async (req, res) => {
    try {
      const lecturer = await User.findById(req.user._id);

      // Get all students in the lecturer’s department
      const students = await User.find({
        role: "student",
        department: lecturer.department,
      });

      const studentIds = students.map((s) => s._id);

      // Fetch results
      const results = await Result.find({ student: { $in: studentIds } })
        .populate("student")
        .populate("course");

      // --- ✅ Analysis ---
      const PASS_MARK = 40;
      const passes = results.filter(r => r.score >= PASS_MARK);
      const fails = results.filter(r => r.score < PASS_MARK);

      res.render("lecturer/results", {
        results,
        department: lecturer.department,
        title: "Department Results",
        user: req.user,
        isLoggedIn: true,

        // analysis data
        summary: {
          total: results.length,
          passed: passes.length,
          failed: fails.length
        },
        passedStudents: passes,
        failedStudents: fails
      });
    } catch (err) {
      console.error(err);
      req.flash("error", "Error fetching results.");
      res.redirect("/lecturer/dashboard");
    }
  }
);

module.exports = router;
