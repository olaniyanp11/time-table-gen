const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    console.log("No token found");
    req.flash?.('error', 'You must log in first');
    return res.redirect('/login');
  }

  try {
    console.log("Token found, verifying...");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    req.user = decoded; // attach user data to request
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    if (err.name === 'TokenExpiredError') {
      req.flash?.('error', 'Session expired, please log in again');
    } else {
      req.flash?.('error', 'Invalid authentication token');
    }
    return res.redirect('/login');
  }
}

module.exports = authenticateToken;
