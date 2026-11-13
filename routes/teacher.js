import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";
import PDFDocument from "pdfkit";
import jwt from "jsonwebtoken";


import requireAuthFromHeaderOrQuery from "../middleware/requireAuthFromHeaderOrQuery.js";

const router = express.Router();


router.get("/student-count", requireAuth, async (req, res) => {
  try {
    const teacherId = req.user.id;

    const result = await pool.query(
      `
      SELECT COUNT(*) AS student_count
      FROM users
      WHERE teacher_id = $1
        AND role = 'student'
      `,
      [teacherId]
    );

    res.json({
      success: true,
      student_count: Number(result.rows[0].student_count),
    });
  } catch (error) {
    console.error("GET TEACHER STUDENT COUNT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error while getting student count.",
    });
  }
});


// router.get("/students-progress/:readingPath", requireAuth, async (req, res) => {
//   try {
//     const teacherId = req.user.id;

//     const rawReadingPath = decodeURIComponent(req.params.readingPath || "All").trim();
//     const normalizedReadingPath = rawReadingPath.toLowerCase();

//     const rawSearch = String(req.query.search || "").trim();
//     const normalizedSearch = `%${rawSearch.toLowerCase()}%`;

//     const values = [teacherId];

//     let readingPathFilter = "";
//     let searchFilter = "";

//     if (normalizedReadingPath !== "all") {
//       values.push(normalizedReadingPath);
//       readingPathFilter = `AND LOWER(TRIM(s.reading_path)) = $${values.length}`;
//     }

//     if (rawSearch !== "") {
//       values.push(normalizedSearch);
//       searchFilter = `
//         AND (
//           LOWER(s.firstname) LIKE $${values.length}
//           OR LOWER(s.lastname) LIKE $${values.length}
//           OR LOWER(CONCAT(s.firstname, ' ', s.lastname)) LIKE $${values.length}
//         )
//       `;
//     }

//     const result = await pool.query(
//       `
//       SELECT
//         s.id,
//         s.firstname,
//         s.lastname,
//         COALESCE(s.reading_path, 'Not Set') AS reading_path,

//         COALESCE(
//           ROUND(
//             AVG(
//               CASE 
//                 WHEN up.activity_type IN ('synonyms', 'antonyms', 'definition')
//                 THEN (up.score::numeric / 5) * 100
//               END
//             )
//           ), 0
//         ) AS vocabulary_percent,

//         COALESCE(
//           ROUND(
//             AVG(
//               CASE 
//                 WHEN up.activity_type IN ('word', 'phrase', 'sentence')
//                 THEN (up.score::numeric / 5) * 100
//               END
//             )
//           ), 0
//         ) AS speaking_percent,

//         COALESCE(
//           ROUND(
//             AVG(
//               CASE 
//                 WHEN up.activity_type IN ('poem', 'story', 'reading')
//                 THEN (up.score::numeric / 5) * 100
//               END
//             )
//           ), 0
//         ) AS comprehension_percent

//       FROM users s
//       LEFT JOIN user_progress up
//         ON up.user_id = s.id

//       WHERE s.teacher_id = $1
//         AND s.role = 'student'
//         ${readingPathFilter}
//         ${searchFilter}

//       GROUP BY
//         s.id,
//         s.firstname,
//         s.lastname,
//         s.reading_path

//       ORDER BY s.lastname ASC, s.firstname ASC
//       `,
//       values
//     );

//     return res.status(200).json({
//       success: true,
//       selected_reading_path: rawReadingPath,
//       search: rawSearch,
//       students: result.rows,
//     });

//   } catch (error) {
//     console.error("GET TEACHER STUDENTS PROGRESS FILTERED ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while getting students progress.",
//     });
//   }
// });

router.get("/students-progress/:readingPath", requireAuth, async (req, res) => {
  try {
    // =========================================
    // 1. GET LOGGED-IN TEACHER ID
    // =========================================
    const teacherId = req.user.id;

    // =========================================
    // 2. GET FILTER PARAMETERS
    // =========================================
    const rawReadingPath = decodeURIComponent(
      req.params.readingPath || "All"
    ).trim();

    const normalizedReadingPath = rawReadingPath.toLowerCase();

    const rawSearch = String(req.query.search || "").trim();
    const normalizedSearch = `%${rawSearch.toLowerCase()}%`;

    const values = [teacherId];

    let readingPathFilter = "";
    let searchFilter = "";

    // =========================================
    // 3. FILTER BY READING PATH
    // =========================================
    if (normalizedReadingPath !== "all") {
      values.push(normalizedReadingPath);

      readingPathFilter =
        `AND LOWER(TRIM(s.reading_path)) = $${values.length}`;
    }

    // =========================================
    // 4. SEARCH STUDENTS
    // =========================================
    if (rawSearch !== "") {
      values.push(normalizedSearch);

      searchFilter = `
        AND (
          LOWER(s.firstname) LIKE $${values.length}
          OR LOWER(s.lastname) LIKE $${values.length}
          OR LOWER(CONCAT(s.firstname, ' ', s.lastname))
             LIKE $${values.length}
        )
      `;
    }

    // =========================================
    // 5. FETCH STUDENT PROGRESS
    // =========================================
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.firstname,
        s.lastname,

        COALESCE(
          s.reading_path,
          'Not Set'
        ) AS reading_path,

        -- =====================================
        -- VOCABULARY PROGRESS
        -- 3 ACTIVITIES x 15 LEVELS = 45
        -- PASSING SCORE: 3/5
        -- =====================================
        COALESCE(
          ROUND(
            COUNT(
              DISTINCT CASE
                WHEN up.activity_type IN (
                  'synonyms',
                  'antonyms',
                  'definitions'
                )
                AND up.score >= 3
                AND up.level BETWEEN 1 AND 15
                THEN (up.activity_type, up.level)
              END
            )::numeric / 45 * 100,
            2
          ),
          0
        ) AS vocabulary_percent,

        -- =====================================
        -- SPEAKING PROGRESS
        -- EXISTING FORMULA (UNCHANGED)
        -- =====================================
        COALESCE(
          ROUND(
            AVG(
              CASE
                WHEN up.activity_type IN (
                  'word',
                  'phrase',
                  'sentence'
                )
                THEN (up.score::numeric / 5) * 100
              END
            )
          ),
          0
        ) AS speaking_percent,

        -- =====================================
        -- READING PROGRESS
        -- EXISTING FORMULA (UNCHANGED)
        -- =====================================
        COALESCE(
          ROUND(
            AVG(
              CASE
                WHEN up.activity_type IN (
                  'poem',
                  'story',
                  'reading'
                )
                THEN (up.score::numeric / 5) * 100
              END
            )
          ),
          0
        ) AS comprehension_percent

      FROM users s

      LEFT JOIN user_progress up
        ON up.user_id = s.id

      WHERE s.teacher_id = $1
        AND s.role = 'student'
        ${readingPathFilter}
        ${searchFilter}

      GROUP BY
        s.id,
        s.firstname,
        s.lastname,
        s.reading_path

      ORDER BY
        s.lastname ASC,
        s.firstname ASC
      `,
      values
    );

    // =========================================
    // 6. RETURN RESPONSE
    // =========================================
    return res.status(200).json({
      success: true,
      selected_reading_path: rawReadingPath,
      search: rawSearch,
      students: result.rows,
    });

  } catch (error) {
    console.error(
      "GET TEACHER STUDENTS PROGRESS FILTERED ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while getting students progress.",
    });
  }
});


router.get("/profile", requireAuth, async (req, res) => {
  try {
    const teacherId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        firstname,
        lastname,
        username
      FROM users
      WHERE id = $1
        AND role = 'teacher'
      LIMIT 1
      `,
      [teacherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found.",
      });
    }

    const teacher = result.rows[0];

    return res.status(200).json({
      success: true,
      firstname: teacher.firstname,
      lastname: teacher.lastname,
      username: teacher.username,
      full_name: `${teacher.firstname} ${teacher.lastname}`,
    });

  } catch (error) {
    console.error("GET TEACHER PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while getting teacher profile.",
    });
  }
});

router.get("/student-scores/:studentId", requireAuth, async (req, res) => {
  try {
    const teacherId = req.user.id;
    const studentId = Number(req.params.studentId);

    if (Number.isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    // Check if the student belongs to the logged-in teacher
    const studentResult = await pool.query(
      `
      SELECT
        id,
        firstname,
        lastname,
        COALESCE(reading_path, 'Not Set') AS reading_path
      FROM users
      WHERE id = $1
        AND teacher_id = $2
        AND role = 'student'
      LIMIT 1
      `,
      [studentId, teacherId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found or not assigned to this teacher.",
      });
    }

    const progressResult = await pool.query(
      `
      SELECT
        activity_type,
        level,
        score,
        completed
      FROM user_progress
      WHERE user_id = $1
      ORDER BY activity_type ASC, level ASC
      `,
      [studentId]
    );

    const emptyCategory = () => ({
      total_score: "0/0",
      total_points: 0,
      max_points: 0,
      percent: 0,
      levels: [],
    });

  
    const scores = {
    synonyms: emptyCategory(),
    antonyms: emptyCategory(),
    definitions: emptyCategory(),

    words: emptyCategory(),
    phrases: emptyCategory(),
    sentences: emptyCategory(),

    poems: emptyCategory(),
    short_stories: emptyCategory(),
    texts: emptyCategory(),
    };

    progressResult.rows.forEach((row) => {
      if (!scores[row.activity_type]) return;

      scores[row.activity_type].levels.push({
        level: row.level,
        score: row.score,
        max_score: 5,
        display_score: `${row.score}/5`,
        completed: row.completed,
      });
    });

    // Compute totals per activity
    Object.keys(scores).forEach((activityType) => {
      const levels = scores[activityType].levels;

      const totalPoints = levels.reduce((sum, item) => {
        return sum + Number(item.score || 0);
      }, 0);

      const maxPoints = levels.length * 5;

      scores[activityType].total_points = totalPoints;
      scores[activityType].max_points = maxPoints;
      scores[activityType].total_score = `${totalPoints}/${maxPoints}`;
      scores[activityType].percent =
        maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    });

    return res.status(200).json({
      success: true,
      student: studentResult.rows[0],
      scores,
    });

  } catch (error) {
    console.error("GET STUDENT SCORES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while getting student scores.",
    });
  }
});


// router.get("/student/:studentId/scores/export-pdf", requireAuthFromHeaderOrQuery, async (req, res) => {
//   try {
//     const teacherId = req.user.id;
//     const studentId = Number(req.params.studentId);

//     if (Number.isNaN(studentId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid student ID.",
//       });
//     }

//     // 1. Get student + teacher info
//     const studentResult = await pool.query(
//       `
//       SELECT 
//         s.id,
//         s.firstname AS student_firstname,
//         s.lastname AS student_lastname,
//         COALESCE(s.reading_path, 'Not Set') AS reading_path,
//         t.firstname AS teacher_firstname,
//         t.lastname AS teacher_lastname
//       FROM users s
//       LEFT JOIN users t
//         ON s.teacher_id = t.id
//       WHERE s.id = $1
//         AND s.teacher_id = $2
//         AND s.role = 'student'
//       LIMIT 1
//       `,
//       [studentId, teacherId]
//     );

//     if (studentResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found or not assigned to this teacher.",
//       });
//     }

//     const student = studentResult.rows[0];

//     // 2. Get all scores of the selected student
//     const scoresResult = await pool.query(
//       `
//       SELECT 
//         activity_type,
//         level,
//         score,
//         completed
//       FROM user_progress
//       WHERE user_id = $1
//       ORDER BY activity_type ASC, level ASC
//       `,
//       [studentId]
//     );

//     const scores = scoresResult.rows;

//     // 3. Score helpers
//     const FIXED_ACTIVITY_MAX = 75;

//     const getTotal = (activityType) => {
//       return scores
//         .filter((item) => item.activity_type === activityType)
//         .reduce((sum, item) => sum + Number(item.score || 0), 0);
//     };

//     const formatScore = (activityType) => {
//       const total = getTotal(activityType);
//       return `${total} / ${FIXED_ACTIVITY_MAX}`;
//     };

//     const formatTotal = (total, max) => {
//       return `${total} / ${max}`;
//     };

//     // Actual activity_type names in your database:
//     // synonyms, antonyms, definitions, words, phrases, sentences, poems, short_stories
//     // texts can stay here for future use even if no records yet.

//     const synonymsTotal = getTotal("synonyms");
//     const antonymsTotal = getTotal("antonyms");
//     const definitionsTotal = getTotal("definitions");

//     const wordsTotal = getTotal("words");
//     const phrasesTotal = getTotal("phrases");
//     const sentencesTotal = getTotal("sentences");

//     const poemsTotal = getTotal("poems");
//     const textsTotal = getTotal("texts");
//     const shortStoriesTotal = getTotal("short_stories");

//     const vocabularyTotal = synonymsTotal + antonymsTotal + definitionsTotal;
//     const speakingTotal = wordsTotal + phrasesTotal + sentencesTotal;
//     const readingTotal = poemsTotal + textsTotal + shortStoriesTotal;

//     const vocabularyMax = FIXED_ACTIVITY_MAX * 3;
//     const speakingMax = FIXED_ACTIVITY_MAX * 3;
//     const readingMax = FIXED_ACTIVITY_MAX * 3;

//     // 4. Create PDF
//     const doc = new PDFDocument({
//       margin: 50,
//       size: "A4",
//     });

//     const studentName = `${student.student_firstname} ${student.student_lastname}`;
//     const teacherName = student.teacher_firstname
//       ? `${student.teacher_firstname} ${student.teacher_lastname}`
//       : "N/A";

//     const safeStudentName = studentName.replace(/\s+/g, "_");
//     const filename = `readventure-score-report-${safeStudentName}.pdf`;

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

//     doc.pipe(res);

//     const dateExported = new Date().toLocaleDateString("en-PH", {
//       year: "numeric",
//       month: "long",
//       day: "numeric",
//     });

//     doc.fontSize(18).text("READVENTURE STUDENT SCORE REPORT", {
//       align: "center",
//     });

//     doc.moveDown(2);

//     doc.fontSize(12).text(`Student Name: ${studentName}`);
//     doc.text(`Reading Path: ${student.reading_path || "N/A"}`);
//     doc.text(`Teacher: ${teacherName}`);
//     doc.text(`Date Exported: ${dateExported}`);

//     doc.moveDown();
//     doc.text("------------------------------------");

//     doc.moveDown();
//     doc.fontSize(14).text("VOCABULARY ACTIVITIES");
//     doc.fontSize(12).text(`TOTAL SCORE: ${formatTotal(vocabularyTotal, vocabularyMax)}`);
//     doc.text(`Synonyms: ${formatScore("synonyms")}`);
//     doc.text(`Antonyms: ${formatScore("antonyms")}`);
//     doc.text(`Definition: ${formatScore("definitions")}`);

//     doc.moveDown();
//     doc.fontSize(14).text("SPEAKING ACTIVITIES");
//     doc.fontSize(12).text(`TOTAL SCORE: ${formatTotal(speakingTotal, speakingMax)}`);
//     doc.text(`Word: ${formatScore("words")}`);
//     doc.text(`Phrase: ${formatScore("phrases")}`);
//     doc.text(`Sentence: ${formatScore("sentences")}`);

//     doc.moveDown();
//     doc.fontSize(14).text("READING ACTIVITIES");
//     doc.fontSize(12).text(`TOTAL SCORE: ${formatTotal(readingTotal, readingMax)}`);
//     doc.text(`Poems: ${formatScore("poems")}`);
//     doc.text(`Texts: ${formatScore("texts")}`);
//     doc.text(`Short Stories: ${formatScore("short_stories")}`);

//     doc.moveDown(2);
//     doc.text("------------------------------------");

//     doc.moveDown();
//     doc.fontSize(10).text("Generated by ReadVenture", {
//       align: "center",
//     });

//     doc.end();
//   } catch (error) {
//     console.error("EXPORT PDF ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while exporting PDF.",
//     });
//   }
// });

router.get(
  "/student/:studentId/scores/export-pdf",
  requireAuthFromHeaderOrQuery,
  async (req, res) => {
    try {
      const teacherId = req.user.id;
      const studentId = Number(req.params.studentId);

      if (
        !Number.isInteger(studentId) ||
        studentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID.",
        });
      }

      // =====================================
      // 1. GET STUDENT AND TEACHER DETAILS
      // =====================================

      const studentResult = await pool.query(
        `
        SELECT
          s.id,
          s.firstname AS student_firstname,
          s.lastname AS student_lastname,
          COALESCE(
            s.reading_path,
            'Not Set'
          ) AS reading_path,
          t.firstname AS teacher_firstname,
          t.lastname AS teacher_lastname
        FROM users s
        LEFT JOIN users t
          ON s.teacher_id = t.id
        WHERE s.id = $1
          AND s.teacher_id = $2
          AND s.role = 'student'
        LIMIT 1
        `,
        [studentId, teacherId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Student not found or not assigned to this teacher.",
        });
      }

      const student = studentResult.rows[0];

      // =====================================
      // 2. GET STUDENT SCORES
      // =====================================

      const scoresResult = await pool.query(
        `
        SELECT
          activity_type,
          level,
          score,
          completed
        FROM user_progress
        WHERE user_id = $1
        ORDER BY
          activity_type ASC,
          level ASC
        `,
        [studentId]
      );

      const scores = scoresResult.rows;

      // =====================================
      // 3. SCORE CALCULATIONS
      // =====================================

      const FIXED_ACTIVITY_MAX = 75;

      const getTotal = (activityType) => {
        return scores
          .filter(
            item =>
              item.activity_type === activityType
          )
          .reduce(
            (sum, item) =>
              sum + Number(item.score || 0),
            0
          );
      };

      const formatScore = (activityType) => {
        return (
          `${getTotal(activityType)} / ` +
          `${FIXED_ACTIVITY_MAX}`
        );
      };

      const formatTotal = (total, max) => {
        return `${total} / ${max}`;
      };

      // Vocabulary
      const synonymsTotal =
        getTotal("synonyms");

      const antonymsTotal =
        getTotal("antonyms");

      const definitionsTotal =
        getTotal("definitions");

      // Speaking
      const wordsTotal =
        getTotal("words");

      const phrasesTotal =
        getTotal("phrases");

      const sentencesTotal =
        getTotal("sentences");

      // Reading
      const poemsTotal =
        getTotal("poems");

      const textsTotal =
        getTotal("texts");

      const shortStoriesTotal =
        getTotal("short_stories");

      const vocabularyTotal =
        synonymsTotal +
        antonymsTotal +
        definitionsTotal;

      const speakingTotal =
        wordsTotal +
        phrasesTotal +
        sentencesTotal;

      const readingTotal =
        poemsTotal +
        textsTotal +
        shortStoriesTotal;

      const vocabularyMax =
        FIXED_ACTIVITY_MAX * 3;

      const speakingMax =
        FIXED_ACTIVITY_MAX * 3;

      const readingMax =
        FIXED_ACTIVITY_MAX * 3;

      // =====================================
      // 4. STUDENT REPORT INFORMATION
      // =====================================

      const studentName =
        `${student.student_firstname} ` +
        `${student.student_lastname}`;

      const teacherName =
        student.teacher_firstname
          ? `${student.teacher_firstname} ${student.teacher_lastname}`
          : "N/A";

      const readingPath =
        student.reading_path || "Not Set";

      const dateExported = new Date()
        .toLocaleDateString("en-PH", {
          timeZone: "Asia/Manila",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

      const safeStudentName =
        studentName
          .replace(/[^a-zA-Z0-9 -]/g, "")
          .trim()
          .replace(/\s+/g, "_") || "Student";

      const filename =
        `readventure-score-report-${safeStudentName}.pdf`;

      // =====================================
      // 5. CREATE PDF DOCUMENT
      // =====================================

      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        autoFirstPage: true,
        info: {
          Title: "ReadVenture Student Score Report",
          Author: "ReadVenture",
          Subject: "Student Activity Performance",
        },
      });

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      const left = 48;
      const right = pageWidth - 48;
      const contentWidth = right - left;

      const COLORS = {
        navy: "#23304D",
        blue: "#527BCB",
        lightBlue: "#EFF4FC",
        border: "#DCE5F0",
        text: "#293344",
        muted: "#65748B",
        white: "#FFFFFF",
      };

      // =====================================
// 6. SCHOOL HEADER IMAGE
// =====================================

const schoolHeaderPath = path.resolve(
  process.cwd(),
  "assets",
  "jhg_header.png"
);

console.log("SCHOOL HEADER PATH:", schoolHeaderPath);
console.log("IMAGE EXISTS:", fs.existsSync(schoolHeaderPath));

if (!fs.existsSync(schoolHeaderPath)) {
  throw new Error(
    `School header image not found: ${schoolHeaderPath}`
  );
}

const headerImage = doc.openImage(schoolHeaderPath);

const headerWidth = contentWidth;
const headerHeight =
  headerWidth * (headerImage.height / headerImage.width);

doc.image(headerImage, left, 34, {
  width: headerWidth,
  height: headerHeight,
});

const headerBottomY = 34 + headerHeight + 16;

      // =====================================
      // 7. REPORT TITLE
      // =====================================

      doc
        .moveTo(left, headerBottomY)
        .lineTo(right, headerBottomY)
        .strokeColor(COLORS.border)
        .lineWidth(1)
        .stroke();

      const titleY = headerBottomY + 15;

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(COLORS.navy)
        .text(
          "STUDENT SCORE REPORT",
          left,
          titleY,
          {
            width: contentWidth,
            align: "center",
          }
        );

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.muted)
        .text(
          "ReadVenture Reading Comprehension System",
          left,
          doc.y + 5,
          {
            width: contentWidth,
            align: "center",
          }
        );

      // =====================================
      // 8. STUDENT INFORMATION
      // =====================================

      const infoY = doc.y + 20;
      const infoHeight = 91;

      doc
        .roundedRect(
          left,
          infoY,
          contentWidth,
          infoHeight,
          8
        )
        .fillColor(COLORS.lightBlue)
        .fill();

      const labelX = left + 15;
      const valueX = left + 125;

      const writeInfoRow = (
        label,
        value,
        y
      ) => {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLORS.muted)
          .text(label, labelX, y, {
            width: 105,
            lineBreak: false,
          });

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLORS.text)
          .text(
            String(value),
            valueX,
            y,
            {
              width: right - valueX - 12,
              lineBreak: false,
              ellipsis: true,
            }
          );
      };

      writeInfoRow(
        "Student Name:",
        studentName,
        infoY + 12
      );

      writeInfoRow(
        "Reading Path:",
        readingPath,
        infoY + 32
      );

      writeInfoRow(
        "Teacher:",
        teacherName,
        infoY + 52
      );

      writeInfoRow(
        "Date Exported:",
        dateExported,
        infoY + 72
      );

      // =====================================
      // 9. ACTIVITY SCORE TABLE HELPER
      // =====================================

      let currentY = infoY + infoHeight + 22;

      const drawScoreSection = (
        title,
        total,
        maximum,
        activities
      ) => {
        const headerHeight = 27;
        const rowHeight = 19;

        const sectionHeight =
          headerHeight +
          21 +
          activities.length * rowHeight +
          13;

        // Add another page if needed.
        if (
          currentY + sectionHeight >
          pageHeight - 65
        ) {
          doc.addPage();
          currentY = 48;
        }

        // Section heading background
        doc
          .roundedRect(
            left,
            currentY,
            contentWidth,
            headerHeight,
            5
          )
          .fillColor(COLORS.navy)
          .fill();

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLORS.white)
          .text(
            title,
            left + 12,
            currentY + 8,
            {
              width: contentWidth - 24,
            }
          );

        currentY += headerHeight + 9;

        // Category total
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLORS.navy)
          .text(
            "TOTAL SCORE",
            left + 12,
            currentY,
            {
              width: 230,
            }
          );

        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(COLORS.blue)
          .text(
            formatTotal(total, maximum),
            right - 132,
            currentY,
            {
              width: 120,
              align: "right",
            }
          );

        currentY += 22;

        // Activity rows
        for (const activity of activities) {
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(COLORS.text)
            .text(
              activity.label,
              left + 12,
              currentY,
              {
                width: 230,
              }
            );

          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(COLORS.text)
            .text(
              formatScore(activity.type),
              right - 132,
              currentY,
              {
                width: 120,
                align: "right",
              }
            );

          currentY += rowHeight;
        }

        currentY += 4;

        // Bottom divider
        doc
          .moveTo(left, currentY)
          .lineTo(right, currentY)
          .strokeColor(COLORS.border)
          .lineWidth(0.7)
          .stroke();

        currentY += 16;
      };

      // =====================================
      // 10. VOCABULARY ACTIVITIES
      // =====================================

      drawScoreSection(
        "VOCABULARY ACTIVITIES",
        vocabularyTotal,
        vocabularyMax,
        [
          {
            label: "Synonyms",
            type: "synonyms",
          },
          {
            label: "Antonyms",
            type: "antonyms",
          },
          {
            label: "Definitions",
            type: "definitions",
          },
        ]
      );

      // =====================================
      // 11. SPEAKING ACTIVITIES
      // =====================================

      drawScoreSection(
        "SPEAKING ACTIVITIES",
        speakingTotal,
        speakingMax,
        [
          {
            label: "Words",
            type: "words",
          },
          {
            label: "Phrases",
            type: "phrases",
          },
          {
            label: "Sentences",
            type: "sentences",
          },
        ]
      );

      // =====================================
      // 12. READING ACTIVITIES
      // =====================================

      drawScoreSection(
        "READING ACTIVITIES",
        readingTotal,
        readingMax,
        [
          {
            label: "Poems",
            type: "poems",
          },
          {
            label: "Texts",
            type: "texts",
          },
          {
            label: "Short Stories",
            type: "short_stories",
          },
        ]
      );

      // =====================================
      // 13. PDF FOOTER
      // =====================================

      const footerY = pageHeight - 44;

      doc
        .moveTo(left, footerY - 10)
        .lineTo(right, footerY - 10)
        .strokeColor(COLORS.border)
        .lineWidth(0.7)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          "Generated by ReadVenture",
          left,
          footerY,
          {
            width: contentWidth,
            align: "center",
            lineBreak: false,
          }
        );

      // =====================================
      // 14. SEND PDF
      // =====================================

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      doc.pipe(res);

      doc.end();

    } catch (error) {
      console.error(
        "EXPORT PDF ERROR:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message:
            "Server error while exporting PDF.",
        });
      }

      res.destroy(error);
    }
  }
);

export default router;