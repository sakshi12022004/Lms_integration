const roleMiddleware = (roles) => {
  return (req, res, next) => {
    console.log("Role Middleware: Entering");

    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User data not found" });
    }

    // ✅ ALLOW ADMIN TO ACCESS ALL ROLE-PROTECTED ROUTES
    if (req.user.role === "admin") {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
};

module.exports = roleMiddleware;
