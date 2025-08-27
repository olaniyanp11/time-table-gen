const express = require('express');
const path = require('path');
const route = require('./routes/route');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cookieparser = require('cookie-parser');
const flash = require('connect-flash');
const session = require('express-session');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // Adjust path as necessary
const dotenv = require('dotenv')
dotenv.config()
const app = express();



// Session only for flash
app.use(session({
  secret: 'just_for_flash_only',
  resave: false,
  saveUninitialized: false,
}));

app.use(flash());
// Flash message variables accessible in views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success');
  res.locals.error_msg = req.flash('error');
  res.locals.errors = req.flash('errors'); // Optional for validation arrays
  next();
});
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(morgan('tiny'));
app.use(cookieparser());
app.use('/', route);


app.use((req, res, next)=>{
    res.render('404', { title: '404 Not Found' });
})


app.listen(3000, async () => {
    console.log('🚀 Server running on http://localhost:3000');

    try {
        await mongoose.connect(process.env.dbURL);
        console.log('✅ Connected to MongoDB');

        const rootEmail = "admin@gmail.com";

        const existingAdmin = await User.findOne({ email: rootEmail });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash("admin123", 10);

            const rootAdmin = new User({
                name: "Root Admin",
                email: rootEmail,
                password: hashedPassword,
                role: "admin", // make sure your User schema has a role field
            });

            await rootAdmin.save();
            console.log("👑 Root admin created:", rootEmail);
        } else {
            console.log("👑 Root admin already exists:", rootEmail);
        }

    } catch (err) {
        console.error('❌ Error connecting to MongoDB:', err);
    }
});
