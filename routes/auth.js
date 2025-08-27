const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../middlewares/checkLog');
const Schedule = require('../models/Schedule');

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
    const { name, matricNumber, password, role, department, level } = req.body;

    try {
        // Validate required fields
        if (!name || !matricNumber || !password) {
            req.flash('error', 'Name, email, and password are required.');
            return res.redirect('/register');
        }

        // If registering student, matric number required
        if (role === 'student' && !matricNumber) {
            req.flash('error', 'Matric number is required for students.');
            return res.redirect('/register');
        }

        // Check if user already exists by email
        const existingMatricNumber = await User.findOne({ matricNumber });
        if (existingMatricNumber) {
            req.flash('error', 'Matric number already exists.');
            return res.redirect('/register');
        }

        // If student, check matric uniqueness
        if (role === 'student') {
            const existingMatric = await User.findOne({ matricNumber });
            if (existingMatric) {
                req.flash('error', 'Matric number already exists.');
                return res.redirect('/register');
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user
        const newUser = new User({
            name,
            matricNumber: matricNumber.toLowerCase(),
            password: hashedPassword, // Make sure this is not being hashed again in a pre-save hook
            role,
            department,
            level,
            matricNumber: role === 'student' ? matricNumber : undefined,
        });
        
        await newUser.save();

        req.flash('success', 'Account created successfully. Please login.');
        return res.redirect('/login');

    } catch (error) {
        console.error('🔥 Registration error:', error);
        req.flash('error', 'An error occurred while registering.');
        return res.redirect('/register');
    }
});


// -------------------- LOGIN -------------------- //
router.post('/login', async (req, res) => {
    let { identifier, password } = req.body;

    try {
        if (!identifier || !password) {
            req.flash('error', 'Both identifier and password are required.');
            return res.redirect('/login');
        }

        let user;

        // Normalize identifier
        identifier = identifier.trim().toLowerCase();

        // Check if it's an email (contains "@")
        if (identifier.includes('@')) {
            console.log("📧 Email login attempt:", identifier + password);
            user = await User.findOne({ email: identifier });
        } else {
            console.log("🎓 Matric login attempt:", identifier);
            user = await User.findOne({ matricNumber: identifier, role: 'student' });
        }

        // Check if user exists
        if (!user) {
            console.log("❌ No user found for:", identifier);
            req.flash('error', 'Invalid credentials.');
            return res.redirect('/login');
        }
        console.log("✅ User found:", user.email || user.matricNumber);
        // Ensure user.password is the hashed password from DB
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log("❌ Password mismatch for:", identifier);
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        // Create JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'dev_secret',
            { expiresIn: '1h' }
        );

        // Save JWT in cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        console.log("✅ Login successful for:", user.email || user.matricNumber);
        req.flash('success', `Welcome back, ${user.name || 'User'}!`);
        return res.redirect('/dashboard');

    } catch (error) {
        console.error('🔥 Login error:', error);
        req.flash('error', 'An error occurred while logging in.');
        return res.redirect('/login');
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

        // 🎯 Role-based dashboard
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

// -------------------- Timetable -------------------- //
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
