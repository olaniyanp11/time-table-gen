const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Course = require('../models/Course');
const Classroom = require('../models/Classroom'); // <-- add this
const Schedule = require('../models/Schedule')
const authenticateToken= require('../middlewares/checkLog');
const getUser = require('../middlewares/getUser');

// Admin-only middleware
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    req.flash?.('error', 'Access denied.');
    return res.redirect('/'); // redirect to home or login instead of dashboard
  }
  next();
}

router.get('/dashboard', authenticateToken,getUser, isAdmin, async (req, res) => {
     try {
    const totalUsers = await User.countDocuments();
    const totalLecturers = await User.countDocuments({ role: "lecturer" });
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalCourses = await Course.countDocuments();
    const totalClassrooms = await Classroom.countDocuments();
    const user = req.user;

    res.render("protected/admin/dashboard", {
      title: "Admin Dashboard",
    user,
      isLoggedIn: true, 
      stats: {
        totalUsers,
        totalLecturers,
        totalStudents,
        totalCourses,
        totalClassrooms
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Error loading dashboard", error: err.message });
  }
})
/* ============================
   📌 LECTURER ROUTES
=============================== */

// GET: Add Lecturer Form (Web form route)
router.get('/add-lecturer', authenticateToken, isAdmin, (req, res) => {
  res.render('protected/admin/all-lecturers', { title: 'Add Lecturer' , user: req.user, isLoggedIn: true });
});

// POST: Create Lecturer (Web form route)
router.post('/add-lecturer', authenticateToken, isAdmin, async (req, res) => {
  const { name, email, password, department, specialization,  levels } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      req.flash('error', 'Email already in use.');
      return res.redirect('/admin/lecturers');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const lecturer = new User({
      name,
      email,
      password: hashedPassword,
      role: 'lecturer',
      levels,
      department,
      specialization
    });
    await lecturer.save();
    req.flash('success', 'Lecturer added successfully.');
    res.redirect('/admin/lecturers');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error creating lecturer.');
    res.redirect('admin/lecturers');
  }
});

// API: Create Lecturer (JSON)
router.post('/lecturers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, email, password, department, specialization } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const lecturer = new User({
      name,
      email,
      password: hashedPassword,
      role: 'lecturer',
      department,
      specialization
    });

    await lecturer.save();
    res.status(201).json(lecturer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Get all lecturers
router.get('/lecturers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const lecturers = await User.find({ role: 'lecturer' });
    res.render('protected/admin/all-lecturers', {
      title: 'All Lecturers',
      user: req.user,
      isLoggedIn: true,
      lecturers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single lecturer
router.get('/lecturers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const lecturer = await User.findById(req.params.id);
    if (!lecturer || lecturer.role !== 'lecturer') {
      return res.status(404).json({ error: 'Lecturer not found' });
    }
    res.json(lecturer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update lecturer
router.post('/update-lecturer/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
 const payload = { ...req.body, role: 'lecturer' };
if (payload.password && payload.password.trim() !== "") {
  payload.password = await bcrypt.hash(payload.password, 10);
}
if (payload.levels) {
  payload.levels = Array.isArray(payload.levels) ? payload.levels : [payload.levels];
}
const lecturer = await User.findOneAndUpdate(
  { _id: req.params.id, role: 'lecturer' },
  payload,
  { new: true, runValidators: true }
);
if (!lecturer) return res.redirect('/admin/lecturers');
    req.flash('success', 'Lecturer updated successfully.');
    res.redirect('/admin/lecturers');
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Delete lecturer (block if courses exist)
router.post('/del-lecturers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const hasCourses = await Course.countDocuments({ lecturer: req.params.id });
    if (hasCourses > 0) {
      return res.status(409).json({
        error: 'Cannot delete lecturer with assigned courses. Reassign or delete courses first.'
      });
    }
    const lecturer = await User.findOneAndDelete({ _id: req.params.id, role: 'lecturer' });
    if (!lecturer) return res.status(404).json({ error: 'Lecturer not found' });
    req.flash('success', 'Lecturer deleted successfully.');
    res.redirect('/admin/lecturers');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   📌 COURSE ROUTES
=============================== */

// API: Create course (validate lecturer)
router.get('/add-course', authenticateToken, isAdmin, (req, res) => {
  res.render('protected/add-course', { title: 'Add Course', user: req.user, isLoggedIn: true });
});
router.post('/courses', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { code, title, unit, department, lecturer, level } = req.body;
    const lec = await User.findById(lecturer);
    if (!lec || lec.role !== 'lecturer') {
      return res.status(400).json({ error: 'Invalid lecturer: must be a User with role=lecturer' });
    }
    const course = await Course.create({ code, title, unit, department, lecturer: lec._id, level });
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Get all courses
router.get('/courses', authenticateToken, isAdmin, async (req, res) => {
  try {
    const courses = await Course.find().populate('lecturer', 'name email department');
    const lecturers = await User.find({ role: 'lecturer' });
    req.flash('success', 'Courses retrieved successfully.');
    res.render('protected/admin/courses', {
      title: 'All Courses',
      user: req.user,
      isLoggedIn: true,
      lecturers,
      courses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get single course
router.get('/courses/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('lecturer', 'name email department');
    if (!course) return res.status(404).json({ error: 'Course not found' });
    req.flash('success', 'Course retrieved successfully.');
    res.render('protected/admin/course', {
      title: 'Course Details',
      user: req.user,
      isLoggedIn: true,
      course
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Update course (validate lecturer if changed)
router.post('/update-courses/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.lecturer) {
      const lec = await User.findById(payload.lecturer);
      if (!lec || lec.role !== 'lecturer') {
        return res.status(400).json({ error: 'Invalid lecturer: must be a User with role=lecturer' });
      }
    }
    const course = await Course.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    }).populate('lecturer', 'name email department');
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: Delete course
router.post('/del-courses/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    req.flash('success', 'Course deleted successfully.');
    res.redirect('/admin/courses');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ============================
   📌 CLASSROOM ROUTES (CLASSES)
=============================== */

// Create classroom
router.get('/classrooms', authenticateToken, isAdmin, async (req, res) => {
  const classrooms = await Classroom.find();
  res.render('protected/admin/classes', { title: 'All Classrooms', user: req.user, isLoggedIn: true, classrooms });
});
router.get('/add-classroom', authenticateToken, isAdmin, (req, res) => {
  res.render('protected/add-classroom', { title: 'Add Classroom', user: req.user, isLoggedIn: true });
});
router.post('/add-classroom', authenticateToken, isAdmin, async (req, res) => {
  try {
    const classroom = await Classroom.create(req.body);
    req.flash('success', 'Classroom created successfully.');
    res.redirect('/admin/classrooms');
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all classrooms
router.get('/classrooms', authenticateToken, isAdmin, async (req, res) => {
  try {
    const classrooms = await Classroom.find();
    res.json(classrooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single classroom
router.get('/classrooms/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    res.json(classroom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update classroom
router.post('/update-classroom/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
req.flash('success', 'Classroom updated successfully.');
res.redirect('/admin/classrooms');
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete classroom
router.post('/del-classroom/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const classroom = await Classroom.findByIdAndDelete(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    req.flash('success', 'Classroom deleted successfully.');
    res.redirect('/admin/classrooms');
  } catch (err) {
    req.flash('error', 'Error deleting classroom.');
    res.redirect('/admin/classrooms');

  }
});
// timtanbleeeeeee....


// Optional: DELETE Schedule
router.post('/del-schedule/:id',authenticateToken, isAdmin, async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.redirect('/admin/timetable');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Optional: Edit Schedule GET/POST
router.get('/edit-schedule/:id',authenticateToken, isAdmin, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('course')
      .populate('lecturer')
      .populate('classroom');

    const courses = await Course.find();
    const lecturers = await User.find({ role: 'lecturer' });
    const classrooms = await Classroom.find();

    res.render('admin/edit-schedule', { schedule, courses, lecturers, classrooms });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.post('/update-schedule/:id',authenticateToken, isAdmin, async (req, res) => {
  try {
    const { course, lecturer, classroom, day, time } = req.body;

    // Optional: check conflicts here (same time + same lecturer or classroom)
    const conflict = await Schedule.findOne({ 
      $or: [
        { lecturer, day, time },
        { classroom, day, time }
      ],
      _id: { $ne: req.params.id } // exclude current schedule
    });

    if (conflict) {
      return res.status(400).send("Schedule conflict detected");
    }

    await Schedule.findByIdAndUpdate(req.params.id, { course, lecturer, classroom, day, time });
    res.redirect('/admin/timetable');
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});
// POST Add Schedule
router.post('/schedules', authenticateToken, isAdmin,async (req, res) => {
  try {
    const { course, lecturer, classroom, day, time } = req.body;

    // Optional: check conflicts here (same time + same lecturer or classroom)
    const conflict = await Schedule.findOne({ $or: [
      { lecturer, day, time },
      { classroom, day, time }
    ]});

    if (conflict) {
      return res.status(400).send("Schedule conflict detected");
    }
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

    await Schedule.create({ course, lecturer, classroom, day, time });
    res.redirect('/admin/timetable', { schedules, days, times });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


// View timetable by department (POST)
router.post('/timetable', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { department } = req.body;

    const courses = await Course.find({ department: { $regex: `^${department}$`, $options: 'i' } });
    if (courses.length === 0) {
      req.flash('error', 'No courses found for this department.');
      return res.redirect('/timetable');
    }

    const schedules = await Schedule.find({ course: { $in: courses.map(c => c._id) } })
      .populate('course lecturer classroom');

    const lecturers = await User.find({ role: 'lecturer' });
    const classrooms = await Classroom.find();
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const times = ['08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00'];

    res.render('protected/admin/timetable', {
      schedules,
      courses,
      lecturers,
      classrooms,
      days,
      times,
      title: `Timetable - ${department}`,
      isLoggedIn: true,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error fetching timetable.');
    res.redirect('/timetable');
  }
});

// 2. Generate timetable for a department
router.get('/timetable/:department', authenticateToken, isAdmin, async (req, res) => {
  try {
    const departmentParam = req.params.department;

    // Case-insensitive search
    const courses = await Course.find({ department: { $regex: `^${departmentParam}$`, $options: 'i' } });
    
    if (courses.length === 0) {
      req.flash('error', 'No courses found for this department.');
      return res.redirect('/timetable'); // Or render a page with "no courses found"
    }

    const schedules = await Schedule.find({ course: { $in: courses.map(c => c._id) } })
      .populate('course lecturer classroom');

    const lecturers = await User.find({ role: 'lecturer' });
    const classrooms = await Classroom.find();
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const times = ['08:00 - 10:00','10:00 - 12:00','12:00 - 14:00','14:00 - 16:00'];

    res.render('protected/admin/timetable', {
      schedules,
      courses,
      lecturers,
      classrooms,
      days,
      times,
      title: `Timetable - ${departmentParam}`,
      isLoggedIn: true,
      user: req.user
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error fetching timetable.');
    res.redirect('/timetable');
  }
});

// Generate timetable for a department (POST)
router.post('/generate-timetable', authenticateToken, isAdmin, async (req, res) => {
  try {
    let { department } = req.body;
    department = department.trim().toLowerCase();
    console.log("Department:", department);

    // Find courses for this department
    const courses = await Course.find({ department }).populate('lecturer');
    if (courses.length === 0) {
      req.flash('error', 'No courses found for this department.');
      return res.redirect('/admin/dashboard');
    }

    // 🗑️ Delete old schedules for this department (if they exist)
    const courseIds = courses.map(c => c._id);
    await Schedule.deleteMany({ course: { $in: courseIds } });
    console.log(`Deleted old schedules for ${department}`);

    // Available classrooms, days, and times
    const classrooms = await Classroom.find();
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = ['08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '14:00 - 16:00'];

    const schedules = [];

    for (const course of courses) {
      const classroom = classrooms[Math.floor(Math.random() * classrooms.length)];

      let day, time, conflict;
      do {
        day = days[Math.floor(Math.random() * days.length)];
        time = times[Math.floor(Math.random() * times.length)];

        // Check conflicts with lecturer and classroom
        conflict = await Schedule.findOne({
          $or: [
            { lecturer: course.lecturer._id, day, time },
            { classroom: classroom._id, day, time }
          ]
        });
      } while (conflict);

      schedules.push({
        course: course._id,
        lecturer: course.lecturer._id,
        classroom: classroom._id,
        day,
        time
      });
    }

    // Save new schedules
    await Schedule.insertMany(schedules);
    req.flash('success', 'Timetable generated successfully.');
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error generating timetable.');
    res.redirect('/timetable');
  }
});

module.exports = router;
