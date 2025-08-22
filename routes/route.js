const express = require('express');
const authRoutes = require('./auth');
const adminRoute = require('./admin');
const lecturerRoute = require('./Lecturer');
const stdentRoute = require('./student')
// const userRoute = require('./user')
const router = express.Router();

router.use("/",authRoutes)
router.use("/admin",adminRoute)
router.use("/lecturer",lecturerRoute)
router.use("/student",stdentRoute)

module.exports = router;