import express from "express";
import { pool } from "../db.js";

import bcrypt from "bcryptjs";

const router = express.Router();

router.get("/teacher/:id/details", async (req, res) => {
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
        AND t.role = 'teacher'
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
        message: "Teacher not found",
      });
    }

    res.json({
      success: true,
      teacher: {
        ...result.rows[0],
        department: "N/A"
      }
    });
  } catch (err) {
    console.error("Teacher details error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.put("/teacher/:id/update-profile", async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, lastname, username } = req.body;

    if (!firstname || !lastname || !username) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and username are required.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET
        firstname = $1,
        lastname = $2,
        username = $3
      WHERE id = $4
        AND role = 'teacher'
      RETURNING id, firstname, lastname, username, role
      `,
      [firstname, lastname, username, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher profile updated successfully.",
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating teacher profile:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update teacher profile.",
    });
  }
});


// router.put("/:id/reset-password", async (req, res) => {
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

router.put("/teacher/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

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

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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

    res.status(200).json({
      success: true,
      message: "Teacher password reset successfully.",
      teacher: result.rows[0],
    });
  } catch (error) {
    console.error("Error resetting teacher password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset teacher password.",
    });
  }
});

router.delete("/teacher/:id/delete", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const teacherCheck = await client.query(
      `
      SELECT id, firstname, lastname, username, role
      FROM users
      WHERE id = $1
        AND role = 'teacher'
      LIMIT 1
      `,
      [id]
    );

    if (teacherCheck.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    const teacher = teacherCheck.rows[0];

    // Unassign students first to avoid foreign key issues
    await client.query(
      `
      UPDATE users
      SET teacher_id = NULL
      WHERE teacher_id = $1
        AND role = 'student'
      `,
      [id]
    );

    // Delete the teacher account
    await client.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND role = 'teacher'
      `,
      [id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Teacher deleted successfully.",
      deletedTeacher: teacher,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error deleting teacher:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete teacher.",
    });
  } finally {
    client.release();
  }
});

// router.get("/teacher/:id/assigned-students", async (req, res) => {
//   const teacherId = req.params.id;

//   try {
//     const teacherCheck = await pool.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       LIMIT 1
//       `,
//       [teacherId]
//     );

//     if (teacherCheck.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const studentsResult = await pool.query(
//       `
//       SELECT
//         id,
//         firstname,
//         lastname,
//         username,
//         reading_path
//       FROM users
//       WHERE teacher_id = $1
//         AND role = 'student'
//       ORDER BY lastname ASC, firstname ASC
//       `,
//       [teacherId]
//     );

//     return res.status(200).json({
//       success: true,
//       teacher: teacherCheck.rows[0],
//       total_students: studentsResult.rows.length,
//       students: studentsResult.rows,
//     });
//   } catch (error) {
//     console.error("Error fetching assigned students:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assigned students.",
//     });
//   }
// });

// router.get("/teacher/:id/assigned-students", async (req, res) => {
//   const teacherId = req.params.id;

//   try {
//     const teacherCheck = await pool.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       LIMIT 1
//       `,
//       [teacherId]
//     );

//     if (teacherCheck.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const studentsResult = await pool.query(
//       `
//       SELECT
//         s.id,
//         s.firstname,
//         s.lastname,
//         s.username,
//         s.reading_path,

//         COALESCE(
//           ROUND(
//             (
//               SUM(
//                 CASE
//                   WHEN up.activity_type IN ('synonyms', 'antonyms', 'definition')
//                   THEN up.score
//                   ELSE 0
//                 END
//               ) / 225.0
//             ) * 100
//           ),
//           0
//         )::int AS vocabulary_percent,

//         COALESCE(
//           ROUND(
//             (
//               SUM(
//                 CASE
//                   WHEN up.activity_type IN ('word', 'phrase', 'sentence')
//                   THEN up.score
//                   ELSE 0
//                 END
//               ) / 225.0
//             ) * 100
//           ),
//           0
//         )::int AS speaking_percent,

//         COALESCE(
//           ROUND(
//             (
//               SUM(
//                 CASE
//                   WHEN up.activity_type IN ('poems', 'texts', 'short_stories')
//                   THEN up.score
//                   ELSE 0
//                 END
//               ) / 300.0
//             ) * 100
//           ),
//           0
//         )::int AS reading_percent

//       FROM users s
//       LEFT JOIN user_progress up
//         ON up.user_id = s.id
//       WHERE s.teacher_id = $1
//         AND s.role = 'student'
//       GROUP BY
//         s.id,
//         s.firstname,
//         s.lastname,
//         s.username,
//         s.reading_path
//       ORDER BY s.lastname ASC, s.firstname ASC
//       `,
//       [teacherId]
//     );

//     return res.status(200).json({
//       success: true,
//       teacher: teacherCheck.rows[0],
//       total_students: studentsResult.rows.length,
//       students: studentsResult.rows,
//     });
//   } catch (error) {
//     console.error("Error fetching assigned students:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assigned students.",
//     });
//   }
// });

// router.get("/teacher/:id/assigned-students", async (req, res) => {
//   const teacherId = req.params.id;

//   try {
//     const teacherCheck = await pool.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       LIMIT 1
//       `,
//       [teacherId]
//     );

//     if (teacherCheck.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const studentsResult = await pool.query(
//       `
//       WITH activity_scores AS (
//         SELECT
//           s.id AS student_id,
//           s.firstname,
//           s.lastname,
//           s.username,
//           s.reading_path,

//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'synonyms' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS synonyms_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'antonyms' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS antonyms_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'definition' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS definition_percent,

//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'word' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS word_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'phrase' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS phrase_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'sentence' THEN up.score ELSE 0 END) / 75.0) * 100), 0)::int AS sentence_percent,

//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'poems' THEN up.score ELSE 0 END) / 100.0) * 100), 0)::int AS poems_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'texts' THEN up.score ELSE 0 END) / 100.0) * 100), 0)::int AS texts_percent,
//           COALESCE(ROUND((SUM(CASE WHEN up.activity_type = 'short_stories' THEN up.score ELSE 0 END) / 100.0) * 100), 0)::int AS short_stories_percent

//         FROM users s
//         LEFT JOIN user_progress up
//           ON up.user_id = s.id
//         WHERE s.teacher_id = $1
//           AND s.role = 'student'
//         GROUP BY
//           s.id,
//           s.firstname,
//           s.lastname,
//           s.username,
//           s.reading_path
//       )

//       SELECT
//         student_id AS id,
//         firstname,
//         lastname,
//         username,
//         reading_path,

//         ROUND((synonyms_percent + antonyms_percent + definition_percent) / 3.0)::int AS vocabulary_percent,
//         ROUND((word_percent + phrase_percent + sentence_percent) / 3.0)::int AS speaking_percent,
//         ROUND((poems_percent + texts_percent + short_stories_percent) / 3.0)::int AS reading_percent

//       FROM activity_scores
//       ORDER BY lastname ASC, firstname ASC
//       `,
//       [teacherId]
//     );

//     return res.status(200).json({
//       success: true,
//       teacher: teacherCheck.rows[0],
//       total_students: studentsResult.rows.length,
//       students: studentsResult.rows,
//     });
//   } catch (error) {
//     console.error("Error fetching assigned students:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assigned students.",
//     });
//   }
// });

// router.get("/teacher/:id/assigned-students", async (req, res) => {
//   const teacherId = req.params.id;

//   try {
//     const teacherCheck = await pool.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'teacher'
//       LIMIT 1
//       `,
//       [teacherId]
//     );

//     if (teacherCheck.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Teacher not found.",
//       });
//     }

//     const studentsResult = await pool.query(
//       `
//       WITH activity_scores AS (
//         SELECT
//           s.id AS student_id,
//           s.firstname,
//           s.lastname,
//           s.username,
//           s.reading_path,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'synonyms' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS synonyms_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'antonyms' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS antonyms_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'definitions' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS definitions_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'words' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS words_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'phrases' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS phrases_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'sentences' THEN up.score ELSE 0 END) / 75.0) * 100
//             ),
//             0
//           )::int AS sentences_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'poems' THEN up.score ELSE 0 END) / 100.0) * 100
//             ),
//             0
//           )::int AS poems_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'texts' THEN up.score ELSE 0 END) / 100.0) * 100
//             ),
//             0
//           )::int AS texts_percent,

//           COALESCE(
//             ROUND(
//               (SUM(CASE WHEN up.activity_type = 'short_stories' THEN up.score ELSE 0 END) / 100.0) * 100
//             ),
//             0
//           )::int AS short_stories_percent

//         FROM users s
//         LEFT JOIN user_progress up
//           ON up.user_id = s.id
//         WHERE s.teacher_id = $1
//           AND s.role = 'student'
//         GROUP BY
//           s.id,
//           s.firstname,
//           s.lastname,
//           s.username,
//           s.reading_path
//       )

//       SELECT
//         student_id AS id,
//         firstname,
//         lastname,
//         username,
//         reading_path,

//         ROUND((synonyms_percent + antonyms_percent + definitions_percent) / 3.0)::int AS vocabulary_percent,
//         ROUND((words_percent + phrases_percent + sentences_percent) / 3.0)::int AS speaking_percent,
//         ROUND((poems_percent + texts_percent + short_stories_percent) / 3.0)::int AS reading_percent

//       FROM activity_scores
//       ORDER BY lastname ASC, firstname ASC
//       `,
//       [teacherId]
//     );

//     return res.status(200).json({
//       success: true,
//       teacher: teacherCheck.rows[0],
//       total_students: studentsResult.rows.length,
//       students: studentsResult.rows,
//     });
//   } catch (error) {
//     console.error("Error fetching assigned students:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch assigned students.",
//     });
//   }
// });

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