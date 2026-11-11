import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  // console.log("AUTH HEADER:", header);

  let token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token && req.body && (req.body.accessToken || req.body.token)) {
    token = req.body.accessToken || req.body.token;
  }

  if (!token && req.query && (req.query.accessToken || req.query.token)) {
    token = req.query.accessToken || req.query.token;
  }

  console.log("EXTRACTED TOKEN:", token ? "HAS TOKEN" : "NO TOKEN");

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("JWT DECODED USER:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("JWT VERIFY FAILED:", err.message);
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}