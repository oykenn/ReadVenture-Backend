import express from "express";
import { pool } from "../db.js";
import requireAuthFromHeaderOrQuery from "../middleware/requireAuthFromHeaderOrQuery.js";

const router = express.Router();

// Require valid JWT for all section routes
router.use(requireAuthFromHeaderOrQuery);

// Admin-only authorization
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required.",
    });
  }

  next();
};

// For now, protect all section routes
router.use(requireAdmin);

// CREATE SECTION — ADMIN ONLY
router.post("/create", async (req, res) => {
  const { section_name, teacher_id } = req.body;

  if (!section_name?.trim() || !teacher_id) {
    return res.status(400).json({
      success: false,
      message: "Section name and teacher are required.",
    });
  }

  try {
    // Verify that the selected user is a teacher
    const teacher = await pool.query(
      `SELECT id FROM users
       WHERE id = $1 AND role = 'teacher'`,
      [teacher_id]
    );

    if (teacher.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    // Create section
    const result = await pool.query(
      `INSERT INTO sections (section_name, teacher_id)
       VALUES ($1, $2)
       RETURNING *`,
      [section_name.trim(), teacher_id]
    );

    return res.status(201).json({
      success: true,
      message: "Section created successfully.",
      section: result.rows[0],
    });

  } catch (error) {
    console.error("CREATE SECTION ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This section already exists for this teacher.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});


// GET SECTIONS BY TEACHER — ADMIN ONLY
router.get("/teacher/:teacherId", async (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!Number.isSafeInteger(teacherId) || teacherId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid teacher ID.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, section_name, teacher_id
       FROM sections
       WHERE teacher_id = $1
       ORDER BY section_name ASC`,
      [teacherId]
    );

    return res.json({
      success: true,
      teacher_id: teacherId,
      sections: result.rows,
    });
  } catch (error) {
    console.error("GET TEACHER SECTIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

// GET ALL SECTIONS — ADMIN ONLY
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.section_name,
        s.teacher_id,
        u.firstname AS teacher_firstname,
        u.lastname AS teacher_lastname,
        COUNT(st.id)::INTEGER AS student_count
      FROM sections s
      JOIN users u
        ON u.id = s.teacher_id
       AND u.role = 'teacher'
      LEFT JOIN users st
        ON st.section_id = s.id
       AND st.role = 'student'
      GROUP BY
        s.id,
        s.section_name,
        s.teacher_id,
        u.firstname,
        u.lastname
      ORDER BY s.section_name ASC, s.id ASC
      `
    );

    return res.status(200).json({
      success: true,
      total_sections: result.rows.length,
      sections: result.rows,
    });
  } catch (error) {
    console.error("GET ALL SECTIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sections.",
    });
  }
});

export default router;