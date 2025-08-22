const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middlewares/checkLog');

/* =====================================================
   ✅ Middleware: inject isLoggedIn + user into all views
===================================================== */
router.use(async (req, res, next) => {
    try {
        let user = null;
        let isLoggedIn = false;

        if (req.user && req.user.userId) {
            user = await User.findById(req.user.userId).lean();
            if (user) isLoggedIn = true;
        }

        res.locals.isLoggedIn = isLoggedIn;
        res.locals.user = user;
        next();
    } catch (err) {
        console.error("Global user middleware error:", err);
        res.locals.isLoggedIn = false;
        res.locals.user = null;
        next();
    }
});

// -------------------- Pages -------------------- //
router.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

router.get('/register', (req, res) => {
    res.render('register', { title: 'Register' });
});

router.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// -------------------- Register -------------------- //
router.post('/register', async (req, res) => {
    const { name, email, password, role, department, level } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already exists.');
            return res.redirect('/register');
        }

        if (password.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long.');
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'student', // default role
            department,
            level,
        });
        await newUser.save();

        req.flash('success', 'Account created successfully. Please login.');
        res.redirect('/login');
    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred while registering.');
        res.redirect('/register');
    }
});

// -------------------- Login -------------------- //
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'dev_secret',
            { expiresIn: '1h' }
        );
        res.cookie('token', token, { httpOnly: true });

        req.flash('success', 'Welcome back!');
        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred while logging in.');
        res.redirect('/login');
    }
});

// -------------------- Dashboard -------------------- //
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }

        // 🎯 role-based dashboard
        let dashboardView = 'protected/dashboard';
        if (user.role === 'student') return res.redirect('student/dashboard');
        if (user.role === 'lecturer') return res.redirect('lecturer/dashboard');
        if (user.role === 'admin') return res.redirect('admin/dashboard');
        req.flash('error', 'Something went wrong.');
        res.redirect('/logout');
       
    } catch (error) {
        console.error(error);
        req.flash('error', 'Something went wrong.');
        res.redirect('/login');
    }
});
// View timetable by department
router.get('/timetable/:departmentId', authenticateToken, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const schedules = await Schedule.find({ department: departmentId })
      .populate('course lecturer classroom');

    res.render('timetable/view', { schedules });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error loading timetable.');
    res.redirect('/');
  }
});

// -------------------- Logout -------------------- //
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    req.flash('success', 'You have logged out.');
    res.redirect('/login');
});

module.exports = router;
