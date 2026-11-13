import express from "express";
import { pool } from "../db.js";

import { requireAuth } from "../middleware/authMiddleware.js";

import bcrypt from "bcryptjs";

const router = express.Router();

// router.get("/teacher/:id/details", async (req, res) => {
//   const teacherId = req.params.id;

//   try {
//     const result = await pool.query(
//       `
//       SELECT
//         t.id,
//         t.firstname,
//         t.lastname,
//         t.username,
//         t.role,
//         COUNT(s.id)::int AS assigned_students
//       FROM users t
//       LEFT JOIN users s
//         ON s.teacher_id = t.id
//         AND s.role = 'student'
//       WHERE t.id = $1
//         AND t.role = 'teacher'
//       GROUP BY
//         t.id,
//         t.firstname,
//         t.lastname,
//         t.username,
//         t.role
//       LIMIT 1
//       `,
//       [teacherId]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found",
//       });
//     }

//     res.json({
//       success: true,
//       teacher: {
//         ...result.rows[0],
//         department: "N/A"
//       }
//     });
//   } catch (err) {
//     console.error("Teacher details error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// });

// router.put("/teacher/:id/update-profile", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { firstname, lastname, username } = req.body;

//     if (!firstname || !lastname || !username) {
//       return res.status(400).json({
//         success: false,
//         message: "First name, last name, and username are required.",
//       });
//     }

//     const result = await pool.query(
//       `
//       UPDATE users
//       SET
//         firstname = $1,
//         lastname = $2,
//         username = $3
//       WHERE id = $4
//        AND role IN ('teacher', 'admin')
//       RETURNING id, firstname, lastname, username, role
//       `,
//       [firstname, lastname, username, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Teacher profile updated successfully.",
//       teacher: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Error updating teacher profile:", error);

//     if (error.code === "23505") {
//       return res.status(409).json({
//         success: false,
//         message: "Username already exists.",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to update teacher profile.",
//     });
//   }
// });



//   try {
//     const { id } = req.params;
//     const { newPassword, confirmPassword } = req.body;

//     if (!newPassword || !confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "New password and confirmation are required.",
//       });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Passwords do not match.",
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: "Password must be at least 6 characters.",
//       });
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, 10);

//     const result = await pool.query(
//       `
//       UPDATE users
//       SET password = $1
//       WHERE id = $2
//         AND role = 'student'
//       RETURNING id, firstname, lastname, username, role
//       `,
//       [hashedPassword, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found.",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Password reset successfully.",
//       student: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Error resetting student password:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to reset password.",
//     });
//   }
// });


// router.put("/teacher/:id/update-profile", requireAuth, async (req, res) => {
//   try {
//     const targetId = Number(req.params.id);
//     const loggedInId = Number(req.user.id);

//     // Validate target ID
//     if (!Number.isInteger(targetId) || targetId <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid user ID.",
//       });
//     }

//     // Verify logged-in user's role from database
//     const requesterResult = await pool.query(
//       `
//       SELECT id, role
//       FROM users
//       WHERE id = $1
//       LIMIT 1
//       `,
//       [loggedInId]
//     );

//     if (
//       requesterResult.rows.length === 0 ||
//       requesterResult.rows[0].role !== "admin"
//     ) {
//       return res.status(403).json({
//         success: false,
//         message: "Administrator access required.",
//       });
//     }

//     // Validate profile fields
//     const { firstname, lastname, username } = req.body || {};

//     if (
//       typeof firstname !== "string" ||
//       typeof lastname !== "string" ||
//       typeof username !== "string" ||
//       !firstname.trim() ||
//       !lastname.trim() ||
//       !username.trim()
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "First name, last name, and username are required.",
//       });
//     }

//     // Check target account
//     const targetResult = await pool.query(
//       `
//       SELECT id, role
//       FROM users
//       WHERE id = $1
//       LIMIT 1
//       `,
//       [targetId]
//     );

//     if (targetResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Account not found.",
//       });
//     }

//     const targetRole = targetResult.rows[0].role;

//     // Allow teachers and the currently logged-in admin only
//     if (
//       targetRole !== "teacher" &&
//       !(targetRole === "admin" && targetId === loggedInId)
//     ) {
//       return res.status(403).json({
//         success: false,
//         message: "Not authorized to update this account.",
//       });
//     }

//     // Update teacher OR own admin profile
//     // Authorization is repeated in SQL to prevent
//     // editing a different admin if the role changes.
//     const result = await pool.query(
//       `
//       UPDATE users
//       SET
//         firstname = $1,
//         lastname = $2,
//         username = $3
//       WHERE id = $4
//         AND (
//           role = 'teacher'
//           OR (role = 'admin' AND id = $5)
//         )
//       RETURNING id, firstname, lastname, username, role
//       `,
//       [
//         firstname.trim(),
//         lastname.trim(),
//         username.trim(),
//         targetId,
//         loggedInId
//       ]
//     );

//     if (result.rows.length === 0) {
//       return res.status(403).json({
//         success: false,
//         message: "Account could not be updated.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Profile updated successfully.",
//       teacher: result.rows[0],
//     });

//   } catch (error) {
//     console.error("UPDATE PROFILE ERROR:", error);

//     if (error.code === "23505") {
//       return res.status(409).json({
//         success: false,
//         message: "Username already exists.",
//       });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Failed to update profile.",
//     });
//   }
// });

// router.put("/teacher/:id/reset-password", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { newPassword, confirmPassword } = req.body;

//     if (!newPassword || !confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "New password and confirm password are required.",
//       });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "Passwords do not match.",
//       });
//     }

//     if (newPassword.length < 6) {
//       return res.status(400).json({
//         success: false,
//         message: "Password must be at least 6 characters.",
//       });
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, 10);

//     const result = await pool.query(
//       `
//       UPDATE users
//       SET password = $1
//       WHERE id = $2
//         AND role = 'teacher'
//       RETURNING id, firstname, lastname, username, role
//       `,
//       [hashedPassword, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Teacher password reset successfully.",
//       teacher: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Error resetting teacher password:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to reset teacher password.",
//     });
//   }
// });

// router.delete("/teacher/:id/delete", async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { id } = req.params;

//     await client.query("BEGIN");

//     const teacherCheck = await client.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       LIMIT 1
//       `,
//       [id]
//     );

//     if (teacherCheck.rows.length === 0) {
//       await client.query("ROLLBACK");

//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const teacher = teacherCheck.rows[0];

//     // Unassign students first to avoid foreign key issues
//     await client.query(
//       `
//       UPDATE users
//       SET teacher_id = NULL
//       WHERE teacher_id = $1
//         AND role = 'student'
//       `,
//       [id]
//     );

//     // Delete the teacher account
//     await client.query(
//       `
//       DELETE FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       `,
//       [id]
//     );

//     await client.query("COMMIT");

//     return res.status(200).json({
//       success: true,
//       message: "Teacher deleted successfully.",
//       deletedTeacher: teacher,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");

//     console.error("Error deleting teacher:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete teacher.",
//     });
//   } finally {
//     client.release();
//   }
// });


router.get("/teacher/:id/details", requireAuth, async (req, res) => {
  // =========================================
  // 1. ADMIN AUTHORIZATION
  // =========================================
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  const teacherId = req.params.id;

  try {
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.firstname,
        t.lastname,
        t.username,
        t.role,
        COUNT(s.id)::int AS assigned_students
      FROM users t
      LEFT JOIN users s
        ON s.teacher_id = t.id
        AND s.role = 'student'
      WHERE t.id = $1
        AND t.role IN ('teacher', 'admin')
      GROUP BY
        t.id,
        t.firstname,
        t.lastname,
        t.username,
        t.role
      LIMIT 1
      `,
      [teacherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher or Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      teacher: {
        ...result.rows[0],
        department: "N/A"
      }
    });

  } catch (err) {
    console.error("Teacher/Admin details error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});


router.put("/teacher/:id/update-profile", requireAuth, async (req, res) => {
  try {
    // =========================================
    // 1. ADMIN AUTHORIZATION
    // =========================================
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // =========================================
    // 2. GET PARAMETERS
    // =========================================
    const targetId = Number(req.params.id);
    const { firstname, lastname, username } = req.body || {};

    if (!Number.isSafeInteger(targetId) || targetId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // =========================================
    // 3. VALIDATE INPUT
    // =========================================
    if (
      typeof firstname !== "string" ||
      typeof lastname !== "string" ||
      typeof username !== "string" ||
      !firstname.trim() ||
      !lastname.trim() ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and username are required.",
      });
    }

    // =========================================
    // 4. UPDATE TEACHER OR ADMIN
    // =========================================
    const result = await pool.query(
      `
      UPDATE users
      SET
        firstname = $1,
        lastname = $2,
        username = $3
      WHERE id = $4
        AND role IN ('teacher', 'admin')
      RETURNING
        id,
        firstname,
        lastname,
        username,
        role
      `,
      [
        firstname.trim(),
        lastname.trim(),
        username.trim(),
        targetId
      ]
    );

    // =========================================
    // 5. CHECK USER
    // =========================================
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher or Admin not found.",
      });
    }

    // =========================================
    // 6. RETURN RESPONSE
    // =========================================
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      teacher: result.rows[0],
    });

  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
});


router.put("/teacher/:id/reset-password", requireAuth, async (req, res) => {
  try {
    // =========================================
    // 1. ADMIN AUTHORIZATION
    // =========================================
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    // =========================================
    // 2. VALIDATE INPUT
    // =========================================
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    // =========================================
    // 3. HASH PASSWORD
    // =========================================
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // =========================================
    // 4. UPDATE TEACHER PASSWORD
    // =========================================
    const result = await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
        AND role = 'teacher'
      RETURNING id, firstname, lastname, username, role
      `,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher password reset successfully.",
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error("Error resetting teacher password:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset teacher password.",
    });
  }
});

// router.delete("/teacher/:id/delete", requireAuth, async (req, res) => {

//   // =========================================
//   // 1. ADMIN AUTHORIZATION
//   // =========================================
//   if (req.user?.role !== "admin") {
//     return res.status(403).json({
//       success: false,
//       message: "Admin access required",
//     });
//   }

//   const client = await pool.connect();

//   try {
//     const { id } = req.params;

//     await client.query("BEGIN");

//     // =========================================
//     // 2. CHECK TEACHER
//     // =========================================
//     const teacherCheck = await client.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//   AND role IN ('teacher', 'admin')
//   AND id <> $2
//       `,
//       [id]
//     );

//     if (teacherCheck.rows.length === 0) {
//       await client.query("ROLLBACK");

//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const teacher = teacherCheck.rows[0];

//     // =========================================
//     // 3. UNASSIGN STUDENTS
//     // =========================================
//     await client.query(
//       `
//       UPDATE users
//       SET teacher_id = NULL
//       WHERE teacher_id = $1
//         AND role = 'student'
//       `,
//       [id]
//     );

//     // =========================================
//     // 4. DELETE TEACHER
//     // =========================================
//     await client.query(
//       `
//       DELETE FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       `,
//       [id]
//     );

//     await client.query("COMMIT");

//     return res.status(200).json({
//       success: true,
//       message: "Teacher deleted successfully.",
//       deletedTeacher: teacher,
//     });

//   } catch (error) {
//     await client.query("ROLLBACK");

//     console.error("Error deleting teacher:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete teacher.",
//     });

//   } finally {
//     client.release();
//   }
// });


router.delete("/teacher/:id/delete", requireAuth, async (req, res) => {

  // =========================================
  // 1. ADMIN AUTHORIZATION
  // =========================================
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  const { id } = req.params;
  const targetId = Number(id);
  const loggedInAdminId = Number(req.user.id);

  // =========================================
  // 2. VALIDATE ID
  // =========================================
  if (!Number.isSafeInteger(targetId) || targetId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID.",
    });
  }

  // =========================================
  // 3. PREVENT SELF-DELETION
  // =========================================
  if (targetId === loggedInAdminId) {
    return res.status(403).json({
      success: false,
      message: "You cannot delete your own admin account.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // =========================================
    // 4. CHECK TEACHER OR ADMIN
    // =========================================
    const userCheck = await client.query(
      `
      SELECT id, firstname, lastname, username, role
      FROM users
      WHERE id = $1
        AND role IN ('teacher', 'admin')
      FOR UPDATE
      `,
      [targetId]
    );

    if (userCheck.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Teacher or admin not found.",
      });
    }

    const user = userCheck.rows[0];

    // =========================================
    // 5. UNASSIGN STUDENTS IF TEACHER
    // =========================================
    if (user.role === "teacher") {
      await client.query(
        `
        UPDATE users
        SET teacher_id = NULL
        WHERE teacher_id = $1
          AND role = 'student'
        `,
        [targetId]
      );
    }

    // =========================================
    // 6. DELETE TEACHER OR ADMIN
    // =========================================
    const deleteResult = await client.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND role IN ('teacher', 'admin')
      RETURNING id
      `,
      [targetId]
    );

    if (deleteResult.rowCount !== 1) {
      throw new Error("User deletion was not completed.");
    }

    await client.query("COMMIT");

    // =========================================
    // 7. SUCCESS RESPONSE
    // =========================================
    return res.status(200).json({
      success: true,
      message: `${
        user.role === "admin" ? "Admin" : "Teacher"
      } deleted successfully.`,
      deletedTeacher: user,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("DELETE TEACHER/ADMIN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user.",
    });

  } finally {
    client.release();
  }
});


router.get("/teacher/:id/assigned-students", async (req, res) => {
  const teacherId = req.params.id;

  try {
    const teacherCheck = await pool.query(
      `
      SELECT id, firstname, lastname, username, role
      FROM users
      WHERE id = $1
        AND role = 'teacher'
      LIMIT 1
      `,
      [teacherId]
    );

    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    const studentsResult = await pool.query(
      `
      WITH progress_levels AS (
        SELECT
          s.id AS student_id,
          s.firstname,
          s.lastname,
          s.username,
          s.reading_path,

          COUNT(*) FILTER (
            WHERE up.completed = true
              AND up.activity_type IN ('synonyms', 'antonyms', 'definition', 'definitions')
          ) AS vocabulary_completed_levels,

          COUNT(*) FILTER (
            WHERE up.completed = true
              AND up.activity_type IN ('word', 'words', 'phrase', 'phrases', 'sentence', 'sentences')
          ) AS speaking_completed_levels,

          COUNT(*) FILTER (
            WHERE up.completed = true
              AND up.activity_type IN ('poems', 'texts', 'shortstories', 'short_stories')
          ) AS reading_completed_levels

        FROM users s
        LEFT JOIN user_progress up
          ON up.user_id = s.id
        WHERE s.teacher_id = $1
          AND s.role = 'student'
        GROUP BY
          s.id,
          s.firstname,
          s.lastname,
          s.username,
          s.reading_path
      )

      SELECT
        student_id AS id,
        firstname,
        lastname,
        username,
        reading_path,

        vocabulary_completed_levels,
        speaking_completed_levels,
        reading_completed_levels,

        LEAST(100, ROUND((vocabulary_completed_levels / 45.0) * 100))::int AS vocabulary_percent,
        LEAST(100, ROUND((speaking_completed_levels / 45.0) * 100))::int AS speaking_percent,
        LEAST(100, ROUND((reading_completed_levels / 45.0) * 100))::int AS reading_percent

      FROM progress_levels
      ORDER BY lastname ASC, firstname ASC
      `,
      [teacherId]
    );

    return res.status(200).json({
      success: true,
      teacher: teacherCheck.rows[0],
      total_students: studentsResult.rows.length,
      students: studentsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching assigned students:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch assigned students.",
    });
  }
});

export default router;