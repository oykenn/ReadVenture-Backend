import express from "express";
import { pool } from "../db.js";

import { requireAuth } from "../middleware/authMiddleware.js";

import bcrypt from "bcryptjs";

const router = express.Router();

router.get("/:id/details", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.firstname,
        s.lastname,
        s.username,
        s.role,
        s.reading_path,
        t.firstname AS teacher_firstname,
        t.lastname AS teacher_lastname
      FROM users s
      LEFT JOIN users t
        ON s.teacher_id = t.id
      WHERE s.id = $1
        AND s.role = 'student'
      LIMIT 1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const student = result.rows[0];

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        firstname: student.firstname,
        lastname: student.lastname,
        username: student.username,
        role: student.role,
        reading_path: student.reading_path,
        assigned_teacher:
          student.teacher_firstname && student.teacher_lastname
            ? `${student.teacher_firstname} ${student.teacher_lastname}`
            : "No teacher assigned",
      },
    });
  } catch (error) {
    console.error("Error fetching student details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student details.",
    });
  }
});

router.get("/:id/scores", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        activity_type,
        COALESCE(SUM(score), 0) AS total_score,
        COUNT(*) FILTER (WHERE completed = true) AS completed_levels
      FROM user_progress
      WHERE user_id = $1
      GROUP BY activity_type
      `,
      [id]
    );

    const scores = {
      vocabulary: {
        synonyms: 0,
        synonymsPercent: 0,
        antonyms: 0,
        antonymsPercent: 0,
        definition: 0,
        definitionPercent: 0,
        total: 0,
        percent: 0,
      },
      speaking: {
        word: 0,
        wordPercent: 0,
        phrase: 0,
        phrasePercent: 0,
        sentence: 0,
        sentencePercent: 0,
        total: 0,
        percent: 0,
      },
      reading: {
        poems: 0,
        poemsPercent: 0,
        texts: 0,
        textsPercent: 0,
        shortstories: 0,
        shortstoriesPercent: 0,
        total: 0,
        percent: 0,
      },
      completed_levels: 0,
    };

    result.rows.forEach((row) => {
      const type = row.activity_type;
      const totalScore = Number(row.total_score);
      const completedLevels = Number(row.completed_levels);

      // VOCABULARY
      if (type === "synonyms") {
        scores.vocabulary.synonyms = totalScore;
        scores.vocabulary.total += totalScore;
      }

      if (type === "antonyms") {
        scores.vocabulary.antonyms = totalScore;
        scores.vocabulary.total += totalScore;
      }

      if (type === "definition") {
        scores.vocabulary.definition = totalScore;
        scores.vocabulary.total += totalScore;
      }

      // SPEAKING
      if (type === "words") {
        scores.speaking.word = totalScore;
        scores.speaking.total += totalScore;
      }

      if (type === "phrases") {
        scores.speaking.phrase = totalScore;
        scores.speaking.total += totalScore;
      }

      if (type === "sentences") {
        scores.speaking.sentence = totalScore;
        scores.speaking.total += totalScore;
      }

      // READING
      if (type === "poems") {
        scores.reading.poems = totalScore;
        scores.reading.total += totalScore;
      }

      if (type === "texts") {
        scores.reading.texts = totalScore;
        scores.reading.total += totalScore;
      }

      if (type === "shortstories") {
        scores.reading.shortstories = totalScore;
        scores.reading.total += totalScore;
      }

      scores.completed_levels += completedLevels;
    });

    // MAX SCORES
    const vocabMaxEach = 75;
    const vocabTotalMax = 225; // synonyms + antonyms + definition

    const speakingMaxEach = 75;
    const speakingTotalMax = 225; // word + phrase + sentence

    const readingMaxEach = 100;
    const readingTotalMax = 300; // poems + texts + shortstories

    // VOCABULARY PERCENTAGES
    scores.vocabulary.synonymsPercent = Math.min(
      100,
      Math.round((scores.vocabulary.synonyms / vocabMaxEach) * 100)
    );

    scores.vocabulary.antonymsPercent = Math.min(
      100,
      Math.round((scores.vocabulary.antonyms / vocabMaxEach) * 100)
    );

    scores.vocabulary.definitionPercent = Math.min(
      100,
      Math.round((scores.vocabulary.definition / vocabMaxEach) * 100)
    );

    scores.vocabulary.percent = Math.min(
      100,
      Math.round((scores.vocabulary.total / vocabTotalMax) * 100)
    );

    // SPEAKING PERCENTAGES
    scores.speaking.wordPercent = Math.min(
      100,
      Math.round((scores.speaking.word / speakingMaxEach) * 100)
    );

    scores.speaking.phrasePercent = Math.min(
      100,
      Math.round((scores.speaking.phrase / speakingMaxEach) * 100)
    );

    scores.speaking.sentencePercent = Math.min(
      100,
      Math.round((scores.speaking.sentence / speakingMaxEach) * 100)
    );

    scores.speaking.percent = Math.min(
      100,
      Math.round((scores.speaking.total / speakingTotalMax) * 100)
    );

    // READING PERCENTAGES
    scores.reading.poemsPercent = Math.min(
      100,
      Math.round((scores.reading.poems / readingMaxEach) * 100)
    );

    scores.reading.textsPercent = Math.min(
      100,
      Math.round((scores.reading.texts / readingMaxEach) * 100)
    );

    scores.reading.shortstoriesPercent = Math.min(
      100,
      Math.round((scores.reading.shortstories / readingMaxEach) * 100)
    );

    scores.reading.percent = Math.min(
      100,
      Math.round((scores.reading.total / readingTotalMax) * 100)
    );

    res.status(200).json({
      success: true,
      scores,
    });
  } catch (error) {
    console.error("Error fetching student scores:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch student scores.",
    });
  }
});

// router.put("/:id/update-profile", async (req, res) => {
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
//         AND role = 'student'
//       RETURNING id, firstname, lastname, username, role, reading_path
//       `,
//       [firstname, lastname, username, id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found.",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Student profile updated successfully.",
//       student: result.rows[0],
//     });
//   } catch (error) {
//     console.error("Error updating student profile:", error);

//     if (error.code === "23505") {
//       return res.status(409).json({
//         success: false,
//         message: "Username already exists.",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Failed to update student profile.",
//     });
//   }
// });

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


router.put("/:id/update-profile", requireAuth, async (req, res) => {
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
    const { id } = req.params;
    const { firstname, lastname, username } = req.body || {};

    // =========================================
    // 3. VALIDATE INPUT
    // =========================================
    if (!firstname || !lastname || !username) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, and username are required.",
      });
    }

    // =========================================
    // 4. UPDATE STUDENT PROFILE
    // =========================================
    const result = await pool.query(
      `
      UPDATE users
      SET
        firstname = $1,
        lastname = $2,
        username = $3
      WHERE id = $4
        AND role = 'student'
      RETURNING
        id,
        firstname,
        lastname,
        username,
        role,
        reading_path
      `,
      [firstname, lastname, username, id]
    );

    // =========================================
    // 5. CHECK STUDENT
    // =========================================
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    // =========================================
    // 6. RETURN RESPONSE
    // =========================================
    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully.",
      student: result.rows[0],
    });

  } catch (error) {
    console.error("Error updating student profile:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update student profile.",
    });
  }
});


router.put("/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation are required.",
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
        AND role = 'student'
      RETURNING id, firstname, lastname, username, role
      `,
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset successfully.",
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Error resetting student password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password.",
    });
  }
});

// router.delete("/:id/delete", async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { id } = req.params;

//     await client.query("BEGIN");

//     const studentCheck = await client.query(
//       `
//       SELECT id, firstname, lastname, username, role
//       FROM users
//       WHERE id = $1
//         AND role = 'student'
//       LIMIT 1
//       `,
//       [id]
//     );

//     if (studentCheck.rows.length === 0) {
//       await client.query("ROLLBACK");

//       return res.status(404).json({
//         success: false,
//         message: "Student not found.",
//       });
//     }

//     const student = studentCheck.rows[0];

//     // Delete student progress first to avoid foreign key issues
//     await client.query(
//       `
//       DELETE FROM user_progress
//       WHERE user_id = $1
//       `,
//       [id]
//     );

//     // Delete the student account
//     await client.query(
//       `
//       DELETE FROM users
//       WHERE id = $1
//         AND role = 'student'
//       `,
//       [id]
//     );

//     await client.query("COMMIT");

//     return res.status(200).json({
//       success: true,
//       message: "Student deleted successfully.",
//       deletedStudent: student,
//     });
//   } catch (error) {
//     await client.query("ROLLBACK");

//     console.error("Error deleting student:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to delete student.",
//     });
//   } finally {
//     client.release();
//   }
// });


router.delete("/:id/delete", requireAuth, async (req, res) => {

  // =========================================
  // 1. ADMIN AUTHORIZATION
  // =========================================
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  const client = await pool.connect();

  try {
    // =========================================
    // 2. GET STUDENT ID
    // =========================================
    const { id } = req.params;

    await client.query("BEGIN");

    // =========================================
    // 3. CHECK STUDENT
    // =========================================
    const studentCheck = await client.query(
      `
      SELECT id, firstname, lastname, username, role
      FROM users
      WHERE id = $1
        AND role = 'student'
      LIMIT 1
      `,
      [id]
    );

    if (studentCheck.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    const student = studentCheck.rows[0];

    // =========================================
    // 4. DELETE STUDENT PROGRESS
    // =========================================
    await client.query(
      `
      DELETE FROM user_progress
      WHERE user_id = $1
      `,
      [id]
    );

    // =========================================
    // 5. DELETE STUDENT
    // =========================================
    await client.query(
      `
      DELETE FROM users
      WHERE id = $1
        AND role = 'student'
      `,
      [id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully.",
      deletedStudent: student,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error deleting student:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete student.",
    });

  } finally {
    client.release();
  }
});


export default router;