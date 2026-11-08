import express from "express";
import { pool } from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      success: true,
      application: "ReadVenture API",
      status: "healthy",
      database: "connected",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("HEALTH CHECK ERROR:", error.message);

    return res.status(503).json({
      success: false,
      application: "ReadVenture API",
      status: "unhealthy",
      database: "disconnected"
    });
  }
});


export default router;
