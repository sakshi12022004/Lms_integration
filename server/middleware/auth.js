const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
      
      // Attach user info to request
      req.user = decoded;
      
      // For non-superadmin users, ensure superadminId is set
      if (decoded.role !== 'superadmin' && !decoded.superadminId) {
        // This should come from the user's record in the tenant database
        // The tenant middleware will handle this
        console.log('Non-superadmin user without superadminId:', decoded);
      }
      
      next();
    });
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
