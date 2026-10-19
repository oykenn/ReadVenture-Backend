//reading.js - handles poems , short-stories and texts retrieval and progress tracking for the reading path
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";

const router = express.Router();

// fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/progress/poems", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT level, score, completed
      FROM user_progress
      WHERE user_id = $1
        AND activity_type = 'poems'
      ORDER BY level ASC
      `,
      [userId]
    );

    const completedLevels = result.rows
      .filter((row) => row.completed)
      .map((row) => row.level);

    const unlockLevel2 = completedLevels.includes(1);
    const unlockLevel3 = completedLevels.includes(2);
    const unlockLevel4 = completedLevels.includes(3);
    const unlockLevel5 = completedLevels.includes(4);
    const unlockLevel6 = completedLevels.includes(5);
    const unlockLevel7 = completedLevels.includes(6);
    const unlockLevel8 = completedLevels.includes(7);
    const unlockLevel9 = completedLevels.includes(8);
    const unlockLevel10 = completedLevels.includes(9);
    const unlockLevel11 = completedLevels.includes(10);
    const unlockLevel12 = completedLevels.includes(11);
    const unlockLevel13 = completedLevels.includes(12);
    const unlockLevel14 = completedLevels.includes(13);
    const unlockLevel15 = completedLevels.includes(14);

    return res.json({
      success: true,
      completedLevels,

      unlockLevel2,
      unlockLevel3,
      unlockLevel4,
      unlockLevel5,
      unlockLevel6,
      unlockLevel7,
      unlockLevel8,
      unlockLevel9,
      unlockLevel10,
      unlockLevel11,
      unlockLevel12,
      unlockLevel13,
      unlockLevel14,
      unlockLevel15,

      progress: result.rows,
    });
  } catch (err) {
    console.error("GET POEMS PROGRESS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

router.get("/poems/:path/:level", (req, res) => {
  try {
    const { path: readingPath, level } = req.params;
    const normalizedPath = readingPath.toLowerCase();

    console.log("Poem request path:", normalizedPath, "level:", level);

    let fileName = "";

    if (normalizedPath === "foundation") {
      fileName = "poems_foundation.json";
    } else if (normalizedPath === "developing") {
      fileName = "poems_developing.json";
    
    } else if (normalizedPath === "advanced") {
      fileName = "poems_advanced.json";
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    const filePath = path.join(__dirname, "../questionBanks", fileName);
    const rawData = fs.readFileSync(filePath, "utf8");
    const poems = JSON.parse(rawData);

    const parsedLevel = Number(level);

    if (Number.isNaN(parsedLevel) || parsedLevel < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid level."
      });
    }

    const levelPoem = poems.find((item) => Number(item.level) === parsedLevel);

    if (!levelPoem) {
      return res.status(404).json({
        success: false,
        message: "Level not found."
      });
    }

    return res.status(200).json({
      success: true,
      path: normalizedPath,
      level: parsedLevel,
      title: levelPoem.title,
      poem_text: levelPoem.poem_text,
      total_questions: levelPoem.questions.length,
      questions: levelPoem.questions,
      questionNumber: 1,
      totalQuestions: levelPoem.questions.length
    });
  } catch (err) {
    console.error("Poem route error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

router.get("/short-stories/:path/:level", (req, res) => {
  try {
    const { path: readingPath, level } = req.params;
    const normalizedPath = readingPath.toLowerCase();

    console.log("Short story request path:", normalizedPath, "level:", level);

    let fileName = "";

    if (normalizedPath === "foundation") {
      fileName = "short_stories_foundation.json";
    } else if (normalizedPath === "developing") {
     fileName = "short_stories_developing.json";
            // return res.status(404).json({
            //     success: false,
            //     message: "Advanced review not available yet.",
            // });
    } else if (normalizedPath === "advanced") {
      fileName = "short_stories_advanced.json";
            // return res.status(404).json({
            //     success: false,
            //     message: "Advanced review not available yet.",
            // });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    const filePath = path.join(__dirname, "../questionBanks", fileName);
    const rawData = fs.readFileSync(filePath, "utf8");
    const shortStories = JSON.parse(rawData);

    const parsedLevel = Number(level);

    if (Number.isNaN(parsedLevel) || parsedLevel < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid level."
      });
    }

    const levelStory = shortStories.find(
      (item) => Number(item.level) === parsedLevel
    );

    if (!levelStory) {
      return res.status(404).json({
        success: false,
        message: "Level not found."
      });
    }

    return res.status(200).json({
      success: true,
      path: normalizedPath,
      level: parsedLevel,
      title: levelStory.title,
      story_text: levelStory.story_text,
      total_questions: levelStory.questions.length,
      questions: levelStory.questions,
      questionNumber: 1,
      totalQuestions: levelStory.questions.length
    });
  } catch (err) {
    console.error("Short story route error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

router.get("/progress/short-stories", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT level, score, completed
      FROM user_progress
      WHERE user_id = $1
        AND activity_type = 'short_stories'
      ORDER BY level ASC
      `,
      [userId]
    );

    const completedLevels = result.rows
      .filter((row) => row.completed)
      .map((row) => row.level);

    const unlockLevel2 = completedLevels.includes(1);
    const unlockLevel3 = completedLevels.includes(2);
    const unlockLevel4 = completedLevels.includes(3);
    const unlockLevel5 = completedLevels.includes(4);
    const unlockLevel6 = completedLevels.includes(5);
    const unlockLevel7 = completedLevels.includes(6);
    const unlockLevel8 = completedLevels.includes(7);
    const unlockLevel9 = completedLevels.includes(8);
    const unlockLevel10 = completedLevels.includes(9);
    const unlockLevel11 = completedLevels.includes(10);
    const unlockLevel12 = completedLevels.includes(11);
    const unlockLevel13 = completedLevels.includes(12);
    const unlockLevel14 = completedLevels.includes(13);
    const unlockLevel15 = completedLevels.includes(14);

    return res.json({
      success: true,
      completedLevels,

      unlockLevel2,
      unlockLevel3,
      unlockLevel4,
      unlockLevel5,
      unlockLevel6,
      unlockLevel7,
      unlockLevel8,
      unlockLevel9,
      unlockLevel10,
      unlockLevel11,
      unlockLevel12,
      unlockLevel13,
      unlockLevel14,
      unlockLevel15,

      progress: result.rows,
    });
  } catch (err) {
    console.error("GET SHORT STORIES PROGRESS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

router.get("/texts/:path/:level", (req, res) => {
  try {
    const { path: readingPath, level } = req.params;
    const normalizedPath = readingPath.toLowerCase();

    console.log("Text request path:", normalizedPath, "level:", level);

    let fileName = "";

    if (normalizedPath === "foundation") {
      fileName = "text_foundation.json";
    } else if (normalizedPath === "developing") {
      fileName = "text_developing.json";
        // return res.status(404).json({
        //       success: false,
        //       message: "Advanced review not available yet.",
        //     });
    } else if (normalizedPath === "advanced") {
      fileName = "text_advanced.json";
    //    return res.status(404).json({
    //            success: false,
    //            message: "Advanced review not available yet.",
    //        });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    const filePath = path.join(__dirname, "../questionBanks", fileName);
    const rawData = fs.readFileSync(filePath, "utf8");
    const texts = JSON.parse(rawData);

    const parsedLevel = Number(level);

    if (Number.isNaN(parsedLevel) || parsedLevel < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid level."
      });
    }

    const levelText = texts.find((item) => Number(item.level) === parsedLevel);

    if (!levelText) {
      return res.status(404).json({
        success: false,
        message: "Level not found."
      });
    }

    // return res.status(200).json({
    //   success: true,
    //   path: normalizedPath,
    //   level: parsedLevel,
    //   title: levelText.title,
    //   story_text: levelText.story_text,
    //   total_questions: levelText.questions.length,
    //   questions: levelText.questions,
    //   questionNumber: 1,
    //   totalQuestions: levelText.questions.length
    // });

            return res.status(200).json({
        success: true,
        path: normalizedPath,
        level: parsedLevel,
        title: levelText.title,
        text: levelText.text,
        total_questions: levelText.questions.length,
        questions: levelText.questions,
        questionNumber: 1,
        totalQuestions: levelText.questions.length
        });
  } catch (err) {
    console.error("Text route error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// router.get("/progress/texts", requireAuth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const result = await pool.query(
//       `
//       SELECT level, score, completed
//       FROM user_progress
//       WHERE user_id = $1
//         AND activity_type = 'texts'
//       ORDER BY level ASC
//       `,
//       [userId]
//     );

//     const completedLevels = result.rows
//       .filter((row) => row.completed)
//       .map((row) => row.level);

//     const unlockLevel2 = completedLevels.includes(1);
//     const unlockLevel3 = completedLevels.includes(2);
//     const unlockLevel4 = completedLevels.includes(3);
//     const unlockLevel5 = completedLevels.includes(4);
//     const unlockLevel6 = completedLevels.includes(5);
//     const unlockLevel7 = completedLevels.includes(6);
//     const unlockLevel8 = completedLevels.includes(7);
//     const unlockLevel9 = completedLevels.includes(8);
//     const unlockLevel10 = completedLevels.includes(9);
//     const unlockLevel11 = completedLevels.includes(10);
//     const unlockLevel12 = completedLevels.includes(11);
//     const unlockLevel13 = completedLevels.includes(12);
//     const unlockLevel14 = completedLevels.includes(13);
//     const unlockLevel15 = completedLevels.includes(14);

//     return res.json({
//       success: true,
//       completedLevels,

//       unlockLevel2,
//       unlockLevel3,
//       unlockLevel4,
//       unlockLevel5,
//       unlockLevel6,
//       unlockLevel7,
//       unlockLevel8,
//       unlockLevel9,
//       unlockLevel10,
//       unlockLevel11,
//       unlockLevel12,
//       unlockLevel13,
//       unlockLevel14,
//       unlockLevel15,

//       progress: result.rows,
//     });
//   } catch (err) {
//     console.error("GET TEXTS PROGRESS ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//     });
//   }
// });

router.get("/progress/texts", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await pool.query(
      `
      SELECT reading_path
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const readingPath = userResult.rows[0].reading_path;

    const result = await pool.query(
      `
      SELECT level, score, completed
      FROM user_progress
      WHERE user_id = $1
        AND activity_type = 'texts'
        AND reading_path = $2
      ORDER BY level ASC
      `,
      [userId, readingPath]
    );

    const completedLevels = result.rows
      .filter((row) => row.completed)
      .map((row) => row.level);

    const unlockLevel2 = completedLevels.includes(1);
    const unlockLevel3 = completedLevels.includes(2);
    const unlockLevel4 = completedLevels.includes(3);
    const unlockLevel5 = completedLevels.includes(4);
    const unlockLevel6 = completedLevels.includes(5);
    const unlockLevel7 = completedLevels.includes(6);
    const unlockLevel8 = completedLevels.includes(7);
    const unlockLevel9 = completedLevels.includes(8);
    const unlockLevel10 = completedLevels.includes(9);
    const unlockLevel11 = completedLevels.includes(10);
    const unlockLevel12 = completedLevels.includes(11);
    const unlockLevel13 = completedLevels.includes(12);
    const unlockLevel14 = completedLevels.includes(13);
    const unlockLevel15 = completedLevels.includes(14);

    return res.json({
      success: true,
      reading_path: readingPath,
      completedLevels,

      unlockLevel2,
      unlockLevel3,
      unlockLevel4,
      unlockLevel5,
      unlockLevel6,
      unlockLevel7,
      unlockLevel8,
      unlockLevel9,
      unlockLevel10,
      unlockLevel11,
      unlockLevel12,
      unlockLevel13,
      unlockLevel14,
      unlockLevel15,

      progress: result.rows,
    });
  } catch (err) {
    console.error("GET TEXTS PROGRESS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

export default router;