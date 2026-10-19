
// import express from "express";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";
// import { requireAuth } from "../middleware/authMiddleware.js";
// import { pool } from "../db.js";
// import jwt from "jsonwebtoken";

// const router = express.Router();

// const authenticateUser = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Access token is required",
//       });
//     }

//     const accessToken = authHeader.split(" ")[1];

//     const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

//     req.userId = decoded.userId;

//     next();
//   } catch (error) {
//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired access token",
//     });
//   }
// };

// router.get("/vocabulary", authenticateUser, async (req, res) => {
//   try {
//     const userId = req.userId;

//     const LEVEL_COUNT = 15;
//     const POINTS_PER_LEVEL = 5;
//     const MAX_SCORE_PER_ACTIVITY = LEVEL_COUNT * POINTS_PER_LEVEL;

//     const query = `
//       SELECT
//         activity_type,
//         COALESCE(SUM(score), 0) AS score
//       FROM user_progress
//       WHERE user_id = $1
//       AND activity_type IN ('synonyms', 'antonyms', 'definitions')
//       AND completed = true
//       GROUP BY activity_type
//     `;

//     const result = await pool.query(query, [userId]);

//     const defaultScores = {
//       synonyms: {
//         activityType: "synonyms",
//         label: "Synonyms",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//       antonyms: {
//         activityType: "antonyms",
//         label: "Antonyms",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//       definitions: {
//         activityType: "definitions",
//         label: "Definitions",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//     };

//     result.rows.forEach((row) => {
//       defaultScores[row.activity_type].score = Number(row.score);
//     });

//     const activities = Object.values(defaultScores);

//     const totalScore = activities.reduce((sum, item) => sum + item.score, 0);
//     const maxScore = activities.reduce((sum, item) => sum + item.maxScore, 0);

//     return res.status(200).json({
//       success: true,
//       category: "Vocabulary",
//       totalScore,
//       maxScore,
//       activities,
//     });
//   } catch (error) {
//     console.error("Fetch vocabulary badge scores error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch vocabulary scores",
//     });
//   }
// });

// export default router;

// import express from "express";
// import jwt from "jsonwebtoken";
// import { pool } from "../db.js";

// const router = express.Router();

// const authenticateUser = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Access token is required",
//       });
//     }

//     const accessToken = authHeader.split(" ")[1];
//     const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

//     console.log("Decoded token:", decoded);

//     req.userId = decoded.userId || decoded.id;

//     console.log("Badge route userId:", req.userId);

//     if (!req.userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Token does not contain user ID",
//       });
//     }

//     next();
//   } catch (error) {
//     console.error("Badge auth error:", error.message);

//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired access token",
//     });
//   }
// };

// router.get("/vocabulary", authenticateUser, async (req, res) => {
//   try {
//     const userId = req.userId;

//     const LEVEL_COUNT = 15;
//     const POINTS_PER_LEVEL = 5;
//     const MAX_SCORE_PER_ACTIVITY = LEVEL_COUNT * POINTS_PER_LEVEL; // 75

//     const query = `
//       SELECT
//         activity_type,
//         COALESCE(SUM(score), 0) AS score
//       FROM user_progress
//       WHERE user_id = $1
//       AND activity_type IN ('synonyms', 'antonyms', 'definitions')
//       AND completed = true
//       GROUP BY activity_type
//     `;

//     const result = await pool.query(query, [userId]);

//     const defaultScores = {
//       synonyms: {
//         activityType: "synonyms",
//         label: "Synonyms",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//       antonyms: {
//         activityType: "antonyms",
//         label: "Antonyms",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//       definitions: {
//         activityType: "definitions",
//         label: "Definitions",
//         score: 0,
//         maxScore: MAX_SCORE_PER_ACTIVITY,
//       },
//     };

//     result.rows.forEach((row) => {
//       if (defaultScores[row.activity_type]) {
//         defaultScores[row.activity_type].score = Number(row.score);
//       }
//     });

//     const activities = Object.values(defaultScores);

//     const totalScore = activities.reduce((sum, item) => sum + item.score, 0);
//     const maxScore = activities.reduce((sum, item) => sum + item.maxScore, 0);

//     return res.status(200).json({
//       success: true,
//       category: "Vocabulary",
//       totalScore,
//       maxScore,
//       activities,
//     });
//   } catch (error) {
//     console.error("Fetch vocabulary badge scores error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch vocabulary scores",
//     });
//   }
// });

// export default router;

// import express from "express";
// import jwt from "jsonwebtoken";
// import { pool } from "../db.js";

// const router = express.Router();

// const authenticateUser = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Access token is required",
//       });
//     }

//     const accessToken = authHeader.split(" ")[1];
//     const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

//     req.userId = decoded.userId || decoded.id;

//     if (!req.userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Token does not contain user ID",
//       });
//     }

//     next();
//   } catch (error) {
//     console.error("Badge auth error:", error.message);

//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired access token",
//     });
//   }
// };

// router.get("/", authenticateUser, async (req, res) => {
//   try {
//     const userId = req.userId;

//     const LEVEL_COUNT = 15;
//     const POINTS_PER_LEVEL = 5;
//     const MAX_SCORE_PER_ACTIVITY = LEVEL_COUNT * POINTS_PER_LEVEL; // 75

//     const badgeGroups = {
//       vocabulary: {
//         category: "Vocabulary",
//         activities: {
//           synonyms: {
//             activityType: "synonyms",
//             label: "Synonyms",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           antonyms: {
//             activityType: "antonyms",
//             label: "Antonyms",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           definitions: {
//             activityType: "definitions",
//             label: "Definitions",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//         },
//       },

//       speaking: {
//         category: "Speaking",
//         activities: {
//           words: {
//             activityType: "words",
//             label: "Words",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           phrases: {
//             activityType: "phrases",
//             label: "Phrases",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           sentences: {
//             activityType: "sentences",
//             label: "Sentences",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//         },
//       },

//       reading: {
//         category: "Reading",
//         activities: {
//           texts: {
//             activityType: "texts",
//             label: "Texts",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           poems: {
//             activityType: "poems",
//             label: "Poems",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//           shortStories: {
//             activityType: "short_stories",
//             label: "Short Stories",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//           },
//         },
//       },
//     };

//     const activityTypes = [
//       "synonyms",
//       "antonyms",
//       "definitions",
//       "words",
//       "phrases",
//       "sentences",
//       "texts",
//       "poems",
//       "short_stories",
//     ];

//     const query = `
//       SELECT
//         activity_type,
//         COALESCE(SUM(score), 0) AS score
//       FROM user_progress
//       WHERE user_id = $1
//       AND activity_type = ANY($2)
//       AND completed = true
//       GROUP BY activity_type
//     `;

//     const result = await pool.query(query, [userId, activityTypes]);

//     result.rows.forEach((row) => {
//       const activityType = row.activity_type;
//       const score = Number(row.score);

//       Object.values(badgeGroups).forEach((group) => {
//         Object.values(group.activities).forEach((activity) => {
//           if (activity.activityType === activityType) {
//             activity.score = score;
//           }
//         });
//       });
//     });

//     const categories = Object.values(badgeGroups).map((group) => {
//       const activities = Object.values(group.activities);

//       const totalScore = activities.reduce((sum, item) => sum + item.score, 0);
//       const maxScore = activities.reduce((sum, item) => sum + item.maxScore, 0);

//       return {
//         category: group.category,
//         totalScore,
//         maxScore,
//         progressPercent: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
//         activities,
//       };
//     });

//     const overallTotalScore = categories.reduce(
//       (sum, category) => sum + category.totalScore,
//       0
//     );

//     const overallMaxScore = categories.reduce(
//       (sum, category) => sum + category.maxScore,
//       0
//     );

//     return res.status(200).json({
//       success: true,
//       overallTotalScore,
//       overallMaxScore,
//       overallProgressPercent:
//         overallMaxScore > 0
//           ? Math.round((overallTotalScore / overallMaxScore) * 100)
//           : 0,
//       categories,
//     });
//   } catch (error) {
//     console.error("Fetch all badge scores error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch badge scores",
//     });
//   }
// });

// export default router;

// import express from "express";
// import jwt from "jsonwebtoken";
// import { pool } from "../db.js";

// const router = express.Router();

// const REQUIRED_LEVELS = 15;
// const POINTS_PER_LEVEL = 5;
// const MAX_SCORE_PER_ACTIVITY = REQUIRED_LEVELS * POINTS_PER_LEVEL; // 75

// const getActivityMedalLevel = (score, completedLevels) => {
//   // Medal is locked until all 15 levels are completed.
//   if (completedLevels < REQUIRED_LEVELS) {
//     return "locked";
//   }

//   if (score <= 25) return "bronze";
//   if (score <= 50) return "silver";
//   return "gold";
// };

// const getCategoryMedalLevel = (totalScore, isCategoryCompleted) => {
//   // Master badge is locked until all 3 activities under the category are completed.
//   if (!isCategoryCompleted) {
//     return "locked";
//   }

//   if (totalScore <= 75) return "bronze";
//   if (totalScore <= 150) return "silver";
//   return "gold";
// };

// const authenticateUser = (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Access token is required",
//       });
//     }

//     const accessToken = authHeader.split(" ")[1];
//     const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

//     req.userId = decoded.userId || decoded.id;

//     if (!req.userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Token does not contain user ID",
//       });
//     }

//     next();
//   } catch (error) {
//     console.error("Badge auth error:", error.message);

//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired access token",
//     });
//   }
// };

// router.get("/", authenticateUser, async (req, res) => {
//   try {
//     const userId = req.userId;

//     const badgeGroups = {
//       vocabulary: {
//         category: "Vocabulary",
//         activities: {
//           synonyms: {
//             activityType: "synonyms",
//             label: "Synonyms",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           antonyms: {
//             activityType: "antonyms",
//             label: "Antonyms",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           definitions: {
//             activityType: "definitions",
//             label: "Definitions",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//         },
//       },

//       speaking: {
//         category: "Speaking",
//         activities: {
//           words: {
//             activityType: "words",
//             label: "Words",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           phrases: {
//             activityType: "phrases",
//             label: "Phrases",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           sentences: {
//             activityType: "sentences",
//             label: "Sentences",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//         },
//       },

//       reading: {
//         category: "Reading",
//         activities: {
//           texts: {
//             activityType: "texts",
//             label: "Texts",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           poems: {
//             activityType: "poems",
//             label: "Poems",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//           shortStories: {
//             activityType: "short_stories",
//             label: "Short Stories",
//             score: 0,
//             maxScore: MAX_SCORE_PER_ACTIVITY,
//             completedLevels: 0,
//             isCompleted: false,
//             medalLevel: "locked",
//           },
//         },
//       },
//     };

//     const activityTypes = [
//       "synonyms",
//       "antonyms",
//       "definitions",
//       "words",
//       "phrases",
//       "sentences",
//       "texts",
//       "poems",
//       "short_stories",
//     ];

//     /*
//       This query does two things:

//       1. Gets the real-time total score per activity.
//       2. Counts how many distinct completed levels the student has finished.

//       MAX(score) prevents duplicate saved rows for the same level from being counted twice.
//     */
//     const query = `
//       WITH level_scores AS (
//         SELECT
//           activity_type,
//           level,
//           MAX(score) AS level_score
//         FROM user_progress
//         WHERE user_id = $1
//         AND activity_type = ANY($2)
//         AND completed = true
//         GROUP BY activity_type, level
//       )
//       SELECT
//         activity_type,
//         COALESCE(SUM(level_score), 0) AS score,
//         COUNT(*) AS completed_levels
//       FROM level_scores
//       GROUP BY activity_type
//     `;

//     const result = await pool.query(query, [userId, activityTypes]);

//     result.rows.forEach((row) => {
//       const activityType = row.activity_type;
//       const score = Number(row.score);
//       const completedLevels = Number(row.completed_levels);

//       Object.values(badgeGroups).forEach((group) => {
//         Object.values(group.activities).forEach((activity) => {
//           if (activity.activityType === activityType) {
//             activity.score = score;
//             activity.completedLevels = completedLevels;
//             activity.isCompleted = completedLevels >= REQUIRED_LEVELS;
//             activity.medalLevel = getActivityMedalLevel(score, completedLevels);
//           }
//         });
//       });
//     });

//     const categories = Object.values(badgeGroups).map((group) => {
//       const activities = Object.values(group.activities);

//       const totalScore = activities.reduce((sum, item) => sum + item.score, 0);
//       const maxScore = activities.reduce((sum, item) => sum + item.maxScore, 0);

//       const isCategoryCompleted = activities.every(
//         (activity) => activity.completedLevels >= REQUIRED_LEVELS
//       );

//       return {
//         category: group.category,
//         totalScore,
//         maxScore,
//         progressPercent:
//           maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
//         completedActivities: activities.filter((activity) => activity.isCompleted).length,
//         totalActivities: activities.length,
//         isCompleted: isCategoryCompleted,
//         medalLevel: getCategoryMedalLevel(totalScore, isCategoryCompleted),
//         activities,
//       };
//     });

//     const overallTotalScore = categories.reduce(
//       (sum, category) => sum + category.totalScore,
//       0
//     );

//     const overallMaxScore = categories.reduce(
//       (sum, category) => sum + category.maxScore,
//       0
//     );

//     return res.status(200).json({
//       success: true,
//       overallTotalScore,
//       overallMaxScore,
//       overallProgressPercent:
//         overallMaxScore > 0
//           ? Math.round((overallTotalScore / overallMaxScore) * 100)
//           : 0,
//       categories,
//     });
//   } catch (error) {
//     console.error("Fetch all badge scores error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch badge scores",
//     });
//   }
// });

// export default router;

import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = express.Router();

const REQUIRED_LEVELS = 15;
const POINTS_PER_LEVEL = 5;
const MAX_SCORE_PER_ACTIVITY = REQUIRED_LEVELS * POINTS_PER_LEVEL; // 75

const getActivityMedalLevel = (score, completedLevels) => {
  // Medal stays locked until all 15 levels are completed.
  if (completedLevels < REQUIRED_LEVELS) {
    return "locked";
  }

  if (score <= 25) return "bronze";
  if (score <= 50) return "silver";
  return "gold";
};

const getCategoryMedalLevel = (totalScore, isCategoryCompleted) => {
  // Master/category medal stays locked until all 3 activities are completed.
  if (!isCategoryCompleted) {
    return "locked";
  }

  if (totalScore <= 75) return "bronze";
  if (totalScore <= 150) return "silver";
  return "gold";
};

const createMedalFlags = (medalLevel) => {
  return {
    showLockedMedal: medalLevel === "locked",
    showBronzeMedal: medalLevel === "bronze",
    showSilverMedal: medalLevel === "silver",
    showGoldMedal: medalLevel === "gold",
  };
};

const createDefaultActivity = (activityType, label) => {
  const medalLevel = "locked";

  return {
    activityType,
    label,
    score: 0,
    maxScore: MAX_SCORE_PER_ACTIVITY,
    completedLevels: 0,
    isCompleted: false,
    medalLevel,
    ...createMedalFlags(medalLevel),
  };
};

const authenticateUser = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    const accessToken = authHeader.split(" ")[1];
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    req.userId = decoded.userId || decoded.id;

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Token does not contain user ID",
      });
    }

    next();
  } catch (error) {
    console.error("Badge auth error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};

router.get("/", authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;

    const badgeGroups = {
      vocabulary: {
        category: "Vocabulary",
        activities: {
          synonyms: createDefaultActivity("synonyms", "Synonyms"),
          antonyms: createDefaultActivity("antonyms", "Antonyms"),
          definitions: createDefaultActivity("definitions", "Definitions"),
        },
      },

      speaking: {
        category: "Speaking",
        activities: {
          words: createDefaultActivity("words", "Words"),
          phrases: createDefaultActivity("phrases", "Phrases"),
          sentences: createDefaultActivity("sentences", "Sentences"),
        },
      },

      reading: {
        category: "Reading",
        activities: {
          texts: createDefaultActivity("texts", "Texts"),
          poems: createDefaultActivity("poems", "Poems"),
          shortStories: createDefaultActivity("short_stories", "Short Stories"),
        },
      },
    };

    const activityTypes = [
      "synonyms",
      "antonyms",
      "definitions",
      "words",
      "phrases",
      "sentences",
      "texts",
      "poems",
      "short_stories",
    ];

    /*
      This query:
      1. Gets the real-time score per activity.
      2. Counts completed levels per activity.
      3. Uses MAX(score) per level to avoid double-counting if duplicate rows exist.
    */
    const query = `
      WITH level_scores AS (
        SELECT
          activity_type,
          level,
          MAX(score) AS level_score
        FROM user_progress
        WHERE user_id = $1
        AND activity_type = ANY($2)
        AND completed = true
        GROUP BY activity_type, level
      )
      SELECT
        activity_type,
        COALESCE(SUM(level_score), 0) AS score,
        COUNT(*) AS completed_levels
      FROM level_scores
      GROUP BY activity_type
    `;

    const result = await pool.query(query, [userId, activityTypes]);

    result.rows.forEach((row) => {
      const activityType = row.activity_type;
      const score = Number(row.score);
      const completedLevels = Number(row.completed_levels);

      Object.values(badgeGroups).forEach((group) => {
        Object.values(group.activities).forEach((activity) => {
          if (activity.activityType === activityType) {
            const medalLevel = getActivityMedalLevel(score, completedLevels);

            activity.score = score;
            activity.completedLevels = completedLevels;
            activity.isCompleted = completedLevels >= REQUIRED_LEVELS;
            activity.medalLevel = medalLevel;

            const medalFlags = createMedalFlags(medalLevel);
            activity.showLockedMedal = medalFlags.showLockedMedal;
            activity.showBronzeMedal = medalFlags.showBronzeMedal;
            activity.showSilverMedal = medalFlags.showSilverMedal;
            activity.showGoldMedal = medalFlags.showGoldMedal;
          }
        });
      });
    });

    const categories = Object.values(badgeGroups).map((group) => {
      const activities = Object.values(group.activities);

      const totalScore = activities.reduce((sum, item) => sum + item.score, 0);
      const maxScore = activities.reduce((sum, item) => sum + item.maxScore, 0);

      const isCategoryCompleted = activities.every(
        (activity) => activity.completedLevels >= REQUIRED_LEVELS
      );

      const medalLevel = getCategoryMedalLevel(totalScore, isCategoryCompleted);
      const medalFlags = createMedalFlags(medalLevel);

      return {
        category: group.category,
        totalScore,
        maxScore,
        progressPercent:
          maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,

        completedActivities: activities.filter((activity) => activity.isCompleted).length,
        totalActivities: activities.length,
        isCompleted: isCategoryCompleted,

        medalLevel,
        ...medalFlags,

        activities,
      };
    });

    const overallTotalScore = categories.reduce(
      (sum, category) => sum + category.totalScore,
      0
    );

    const overallMaxScore = categories.reduce(
      (sum, category) => sum + category.maxScore,
      0
    );

    return res.status(200).json({
      success: true,
      overallTotalScore,
      overallMaxScore,
      overallProgressPercent:
        overallMaxScore > 0
          ? Math.round((overallTotalScore / overallMaxScore) * 100)
          : 0,
      categories,
    });
  } catch (error) {
    console.error("Fetch all badge scores error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch badge scores",
    });
  }
});

export default router;