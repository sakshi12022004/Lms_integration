const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    // Extract token from header or query parameter (for direct downloads/window.open)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove "Bearer " prefix
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      // Regular JWT token verification
      const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret_key";
      console.log("Auth - Using JWT_SECRET:", jwtSecret ? "set (length: " + jwtSecret.length + ")" : "not set");
        
        try {
          const decoded = jwt.verify(token, jwtSecret);
          req.user = {
            userId: decoded.userId,
            role: decoded.role,
            email: decoded.email, // Add email field
            name: decoded.name || "",
            universityId: decoded.universityId || decoded.university_id || 1
          };
          console.log("Auth - Token verified, userId:", req.user.userId, "role:", req.user.role, "email:", req.user.email, "universityId:", req.user.universityId);
          return next();
        } catch (tokenError) {
          console.log("Auth - Invalid token:", tokenError.message);
          console.log("Auth - Token was:", token.substring(0, 20) + "...");
          // For superadmin routes, don't fall through to guest
          if (req.originalUrl && req.originalUrl.includes('/superadmin/')) {
            return res.status(401).json({ success: false, message: "Invalid authentication token" });
          }
          // Fall through to set default user for other routes
        }
      }

    // No valid token - check if this is a superadmin route
    if (req.originalUrl && req.originalUrl.includes('/superadmin/')) {
      console.log("Auth - Superadmin route requires authentication");
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Set a user with available info or default for non-superadmin routes
    req.user = {
      userId: null,
      role: "guest",
      name: "Guest"
    };
    
    console.log("Auth - No valid token, using guest user");
    next();
  } catch (error) {
    console.log("Auth middleware error:", error.message);
    // Set default user on error
    req.user = {
      userId: null,
      role: "guest",
      name: "Guest"
    };
    next();
  }
};
