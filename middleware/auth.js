const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header: "Authorization: Bearer <token>"
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'prof_attendance_dashboard_secret_key_default_12345');
    req.user = decoded.sub; // sub holds the professor ID
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired, please login again' });
    }
    res.status(401).json({ message: 'Token is not valid' });
  }
};
