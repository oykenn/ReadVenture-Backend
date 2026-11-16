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

// ==========================================
// UPDATE SECTION — ADMIN ONLY
// PUT /sections/:id
// ==========================================

router.put("/:id", async (req, res) => {
  const sectionId = Number(req.params.id);
  const { section_name, teacher_id } = req.body || {};
  const newTeacherId = Number(teacher_id);

  // Validate section ID
  if (!Number.isSafeInteger(sectionId) || sectionId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid section ID.",
    });
  }

  // Validate section name
  if (
    typeof section_name !== "string" ||
    !section_name.trim() ||
    section_name.trim().length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid section name is required (max 100 characters).",
    });
  }

  // Validate teacher ID
  if (
    teacher_id == null ||
    teacher_id === "" ||
    !Number.isSafeInteger(newTeacherId) ||
    newTeacherId <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid teacher ID is required.",
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Check if section exists and lock it
    const existing = await client.query(
      `
      SELECT id, teacher_id
      FROM sections
      WHERE id = $1
      FOR UPDATE
      `,
      [sectionId]
    );

    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Section not found.",
      });
    }

    // Verify selected teacher exists
    const teacher = await client.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
        AND role = 'teacher'
      LIMIT 1
      `,
      [newTeacherId]
    );

    if (teacher.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Selected teacher does not exist.",
      });
    }

    // Prevent teacher reassignment if students exist
    if (Number(existing.rows[0].teacher_id) !== newTeacherId) {
      const students = await client.query(
        `
        SELECT id
        FROM users
        WHERE section_id = $1
          AND role = 'student'
        FOR UPDATE
        `,
        [sectionId]
      );

      if (students.rows.length > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message:
            "Cannot change teacher while students are enrolled. Transfer students first.",
        });
      }
    }

    // Update section information
    const result = await client.query(
      `
      UPDATE sections
      SET section_name = $1,
          teacher_id = $2
      WHERE id = $3
      RETURNING id, section_name, teacher_id, created_at
      `,
      [section_name.trim(), newTeacherId, sectionId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Section updated successfully.",
      section: result.rows[0],
    });

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(console.error);
    }

    console.error("UPDATE SECTION ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Section name already exists for this teacher.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update section.",
    });

  } finally {
    if (client) {
      client.release();
    }
  }
});

// ==========================================
// DELETE SECTION — ADMIN ONLY
// DELETE /sections/:id
// ==========================================

router.delete("/:id", async (req, res) => {
  const sectionId = Number(req.params.id);

  // Validate section ID
  if (!Number.isSafeInteger(sectionId) || sectionId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid section ID.",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // Lock section to prevent simultaneous modifications
    const sectionResult = await client.query(
      `
      SELECT id, section_name, teacher_id
      FROM sections
      WHERE id = $1
      FOR UPDATE
      `,
      [sectionId]
    );

    if (sectionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Section not found.",
      });
    }

    // Check whether ANY users are assigned to this section.
    // Do not delete sections with existing assignments.
    const assignedUsers = await client.query(
      `
      SELECT id
      FROM users
      WHERE section_id = $1
      LIMIT 1
      `,
      [sectionId]
    );

    if (assignedUsers.rows.length > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this section because students are still assigned to it.",
      });
    }

    // Delete empty section
    const deletedSection = await client.query(
      `
      DELETE FROM sections
      WHERE id = $1
      RETURNING id, section_name, teacher_id
      `,
      [sectionId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Section deleted successfully.",
      section: deletedSection.rows[0],
    });

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(console.error);
    }

    console.error("DELETE SECTION ERROR:", error);

    // Foreign key protection
    if (error.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete section because it still has assigned users.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete section.",
    });

  } finally {
    if (client) {
      client.release();
    }
  }
});

export default router;