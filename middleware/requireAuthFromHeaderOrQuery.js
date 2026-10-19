import jwt from "jsonwebtoken";

const requireAuthFromHeaderOrQuery = (req, res, next) => {
  try {
    let token = null;

    // Normal Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // Token from URL query, for PDF export Launch URL
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();
  } catch (error) {
    console.error("AUTH HEADER OR QUERY ERROR:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

export default requireAuthFromHeaderOrQuery;