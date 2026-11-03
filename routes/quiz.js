// import express from "express";
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";
// import { requireAuth } from "../middleware/authMiddleware.js";
// import { pool } from "../db.js";

// import dotenv from "dotenv";
// import OpenAI from "openai";

// dotenv.config();

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// const router = express.Router();

// // fix __dirname for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// function loadVocabularyCsv() {
//   const csvPath = path.join(
//     __dirname,
//     "../csvFiles/synonyms_vocabulary_v3.csv"
//   );

//   const raw = fs.readFileSync(csvPath, "utf8").trim();
//   const lines = raw.split(/\r?\n/);

//   const headers = lines[0].split(",").map(h => h.trim());

//   return lines.slice(1).map(line => {
//     const values = line.split(",").map(v => v.trim());

//     const row = {};

//     headers.forEach((header, index) => {
//       row[header] = values[index];
//     });

//     return row;
//   });
// }


// router.get("/synonyms/:path/:level", async (req, res) => {
//   try {
//     const { path: readingPath, level } = req.params;

//     const normalizedPath = String(readingPath).trim().toLowerCase();
//     const parsedLevel = Number(level);

//     console.log(
//       "AI Quiz request path:",
//       normalizedPath,
//       "level:",
//       parsedLevel
//     );

//     const allowedPaths = ["foundation", "developing", "advanced"];

//     if (!allowedPaths.includes(normalizedPath)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path."
//       });
//     }

//     if (
//       !Number.isInteger(parsedLevel) ||
//       parsedLevel < 1 ||
//       parsedLevel > 15
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid level. Level must be between 1 and 15."
//       });
//     }

//     // Load CSV
//     const vocabulary = loadVocabularyCsv();

//     // Filter current path + level
//     const levelWords = vocabulary.filter(
//       row =>
//         String(row.reading_path).trim().toLowerCase() === normalizedPath &&
//         Number(row.level) === parsedLevel
//     );

//     if (levelWords.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No vocabulary found for this path and level."
//       });
//     }

//     // AI ONLY generates distractors
//     const prompt = `
// You generate ONLY incorrect answer choices for a Grade 3 synonym quiz.

// Reading Path: ${normalizedPath}
// Current Level: ${parsedLevel}

// Approved words and correct synonyms:

// ${levelWords
//   .map(
//     (row, index) =>
//       `${index + 1}. Word: ${row.word}, Correct synonym: ${row.synonym}`
//   )
//   .join("\n")}

// For each word, generate exactly 3 INCORRECT distractors.

// DIFFICULTY:

// Levels 1-5:
// - Use easy and clearly incorrect distractors.

// Levels 6-10:
// - Use moderately believable distractors.

// Levels 11-15:
// - Use more challenging and closely related distractors.
// - There must still be only one correct answer.

// RULES:
// - Do NOT include the correct synonym as a distractor.
// - Generate exactly 3 distractors for every word.
// - Keep vocabulary appropriate for Grade 3 learners.
// - Do NOT generate the question text.
// - Do NOT generate the correct answer.
// - Do NOT add explanations.

// Return ONLY valid JSON.
// No markdown.
// No backticks.
// No comments.

// Use exactly this structure:

// {
//   "items": [
//     {
//       "word": "big",
//       "distractors": [
//         "Tiny",
//         "Slow",
//         "Cold"
//       ]
//     }
//   ]
// }
// `;

//     const result = await openai.responses.create({
//       model: "gpt-5-mini",
//       input: [
//         {
//           role: "user",
//           content: [
//             {
//               type: "input_text",
//               text: prompt
//             }
//           ]
//         }
//       ]
//     });

//     const outputText = result.output_text?.trim();

//     if (!outputText) {
//       throw new Error("No output received from AI.");
//     }

//     console.log("RAW AI OUTPUT:");
//     console.log(outputText);

//     let aiData;

//     try {
//       aiData = JSON.parse(outputText);
//     } catch (parseErr) {
//       console.error("JSON PARSE ERROR:", outputText);

//       return res.status(500).json({
//         success: false,
//         message: "AI returned invalid JSON."
//       });
//     }

//     // New AI structure:
//     // { items: [...] }
//     if (
//       !aiData ||
//       !Array.isArray(aiData.items)
//     ) {
//       console.error("INVALID AI STRUCTURE:", aiData);

//       return res.status(500).json({
//         success: false,
//         message: "AI returned an invalid distractor structure."
//       });
//     }

//     if (aiData.items.length !== levelWords.length) {
//       return res.status(500).json({
//         success: false,
//         message: "AI returned an incorrect number of distractor sets."
//       });
//     }

//     // Node.js constructs the final questions
//     const generatedQuestions = levelWords.map((row, index) => {
//       const aiItem = aiData.items.find(
//         item =>
//           String(item.word).trim().toLowerCase() ===
//           String(row.word).trim().toLowerCase()
//       );

//       if (
//         !aiItem ||
//         !Array.isArray(aiItem.distractors) ||
//         aiItem.distractors.length !== 3
//       ) {
//         throw new Error(
//           `Invalid distractors generated for "${row.word}".`
//         );
//       }

//       const correctAnswer = String(row.synonym).trim();

//       // Ensure AI did not accidentally repeat the correct answer
//       const distractors = aiItem.distractors.filter(
//         choice =>
//           String(choice).trim().toLowerCase() !==
//           correctAnswer.toLowerCase()
//       );

//       if (distractors.length !== 3) {
//         throw new Error(
//           `AI generated the correct answer as a distractor for "${row.word}".`
//         );
//       }

//       // Check duplicate distractors
//       const normalizedDistractors = distractors.map(choice =>
//         String(choice).trim().toLowerCase()
//       );

//       if (new Set(normalizedDistractors).size !== 3) {
//         throw new Error(
//           `AI generated duplicate distractors for "${row.word}".`
//         );
//       }

//       // Correct answer + 3 AI distractors
//       const choices = [
//         correctAnswer,
//         ...distractors
//       ];

//       // Shuffle
//       for (let i = choices.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));

//         [choices[i], choices[j]] = [
//           choices[j],
//           choices[i]
//         ];
//       }

//       // return {
//       //   question_id: index + 1,
//       //   question_text: `What is another word for ${row.word}?`,
//       //   choices,
//       //   correct_answer: correctAnswer
//       // };
//       return {
//           question_id: index + 1,
//           word: String(row.word).trim(), // ADD THIS
//           question_text: `What is another word for ${row.word}?`,
//           choices,
//           correct_answer: correctAnswer
//         };
//     });

//     return res.status(200).json({
//       success: true,
//       ai_generated: true,
//       path: normalizedPath,
//       level: parsedLevel,
//       total_questions: generatedQuestions.length,
//       questions: generatedQuestions,
//       questionNumber: 1,
//       totalQuestions: generatedQuestions.length
//     });

//   } catch (err) {
//     console.error("AI QUIZ ERROR:", err);

//     return res.status(500).json({
//       success: false,
//       message: err.message || "Server error."
//     });
//   }
// });

// router.post("/synonyms/next", (req, res) => {
//   try {
//     const {
//       path: readingPath,
//       level,
//       currentQuestionIndex,
//       score,
//       selectedAnswer,
//       questions
//     } = req.body || {};

//     if (
//       !readingPath ||
//       level === undefined ||
//       currentQuestionIndex === undefined ||
//       score === undefined ||
//       !selectedAnswer ||
//       !Array.isArray(questions)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields."
//       });
//     }

//     const normalizedPath = String(readingPath).trim().toLowerCase();
//     const parsedLevel = Number(level);
//     const currentIndex = Number(currentQuestionIndex);
//     const currentScore = Number(score);

//     if (
//       !["foundation", "developing", "advanced"].includes(normalizedPath)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path."
//       });
//     }

//     if (
//       !Number.isInteger(parsedLevel) ||
//       parsedLevel < 1 ||
//       parsedLevel > 15
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid level."
//       });
//     }

//     if (
//       !Number.isInteger(currentIndex) ||
//       !Number.isInteger(currentScore) ||
//       currentIndex < 0 ||
//       currentIndex >= questions.length
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid question index or score."
//       });
//     }

//     const currentQuestion = questions[currentIndex];

//     if (
//       !currentQuestion ||
//       !currentQuestion.correct_answer
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid current question."
//       });
//     }

//     // Keep your current setup:
//     // scoring is handled elsewhere, so score does not change here.
//     const newScore = currentScore;

//     const nextIndex = currentIndex + 1;

//     // Last question reached
//     if (nextIndex >= questions.length) {
//       return res.status(200).json({
//         success: true,
//         finished: true,
//         score: newScore,
//         currentQuestionIndex: currentIndex,
//         questionNumber: questions.length,
//         totalQuestions: questions.length
//       });
//     }

//     const nextQuestion = questions[nextIndex];

//     console.log("NEXT QUESTION:", nextQuestion);
//     console.log("NEXT INDEX:", nextIndex);
//     console.log("TOTAL QUESTIONS:", questions.length);

//     return res.status(200).json({
//       success: true,
//       finished: false,
//       score: newScore,

//       currentQuestionIndex: nextIndex,
//       questionNumber: nextIndex + 1,
//       totalQuestions: questions.length,

//       questionText: nextQuestion.question_text,
//       choices: nextQuestion.choices,
//       correctAnswer: nextQuestion.correct_answer
//     });

//   } catch (err) {
//     console.error("NEXT ROUTE ERROR:", err);

//     return res.status(500).json({
//       success: false,
//       message: "Server error."
//     });
//   }
// });




// router.post("/synonyms/review", async (req, res) => {
//   try {
//     const {
//       path: readingPath,
//       level,
//       answers
//     } = req.body || {};

//     // -----------------------------
//     // VALIDATE REQUEST
//     // -----------------------------
//     if (
//       !readingPath ||
//       level === undefined ||
//       !Array.isArray(answers) ||
//       answers.length === 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields."
//       });
//     }

//     const normalizedPath = String(readingPath)
//       .trim()
//       .toLowerCase();

//     const parsedLevel = Number(level);

//     const allowedPaths = [
//       "foundation",
//       "developing",
//       "advanced"
//     ];

//     if (!allowedPaths.includes(normalizedPath)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path."
//       });
//     }

//     if (
//       !Number.isInteger(parsedLevel) ||
//       parsedLevel < 1 ||
//       parsedLevel > 15
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid level."
//       });
//     }

//     // -----------------------------
//     // LOAD SAME CSV
//     // -----------------------------
//     const vocabulary = loadVocabularyCsv();

//     const levelWords = vocabulary.filter(
//       row =>
//         String(row.reading_path)
//           .trim()
//           .toLowerCase() === normalizedPath &&
//         Number(row.level) === parsedLevel
//     );

//     if (levelWords.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "No vocabulary found for this path and level."
//       });
//     }

//     // -----------------------------
//     // CHECK EACH STUDENT ANSWER
//     // -----------------------------
//     const checkedAnswers = answers.map(
//       (answer, index) => {

//         const word = String(answer.word || "").trim();

//         const selectedAnswer = String(
//           answer.selectedAnswer || ""
//         ).trim();

//         const csvWord = levelWords.find(
//           row =>
//             String(row.word)
//               .trim()
//               .toLowerCase() ===
//             word.toLowerCase()
//         );

//         if (!csvWord) {
//           throw new Error(
//             `Word "${word}" was not found in the vocabulary CSV.`
//           );
//         }

//         const correctAnswer = String(
//           csvWord.synonym
//         ).trim();

//         const isCorrect =
//           selectedAnswer.toLowerCase() ===
//           correctAnswer.toLowerCase();

//         return {
//           index,
//           word,
//           selectedAnswer,
//           correctAnswer,
//           isCorrect
//         };
//       }
//     );

//     // -----------------------------
//     // AI REVIEW CONTENT
//     // -----------------------------
//     const prompt = `
//     You create vocabulary review content for Grade 3 learners.

//     Activity:
//     Synonyms

//     Reading Path:
//     ${normalizedPath}

//     Level:
//     ${parsedLevel}

//     Below are the vocabulary words that the learner answered:

//     ${checkedAnswers
//       .map(
//         item =>
//           `${item.index}. Word: ${item.word}`
//       )
//       .join("\n")}

//     For EACH word, generate:

//     1. meaning
//       - A simple child-friendly definition of the WORD itself.

//     2. hint
//       - A short clue that helps a Grade 3 learner understand or remember the word.
//       - Do not mention whether the learner answered correctly or incorrectly.

//     3. example
//       - One short sentence that correctly uses the word.

//     RULES:
//     - Use simple English appropriate for Grade 3.
//     - Keep the meaning short.
//     - Keep the hint short.
//     - Keep the example sentence natural.
//     - Preserve each exact vocabulary word.
//     - Do not generate quiz questions.
//     - Do not generate answer choices.
//     - Do not determine correctness.
//     - Return exactly one item for every provided word.

//     Return ONLY valid JSON.
//     No markdown.
//     No backticks.
//     No comments.

//     Use exactly this format:

//     {
//       "items": [
//         {
//           "index": 0,
//           "word": "gigantic",
//           "meaning": "Very large in size.",
//           "hint": "Think of something much bigger than normal.",
//           "example": "The gigantic elephant walked across the field."
//         }
//       ]
//     }
//     `;

//     const result = await openai.responses.create({
//       model: "gpt-5-mini",
//       input: [
//         {
//           role: "user",
//           content: [
//             {
//               type: "input_text",
//               text: prompt
//             }
//           ]
//         }
//       ]
//     });

//     const outputText =
//       result.output_text?.trim();

//     if (!outputText) {
//       throw new Error(
//         "No review output received from AI."
//       );
//     }

//     console.log("RAW REVIEW AI OUTPUT:");
//     console.log(outputText);

//     let aiData;

//     try {
//       aiData = JSON.parse(outputText);
//     } catch (parseErr) {
//       console.error(
//         "REVIEW JSON PARSE ERROR:",
//         outputText
//       );

//       return res.status(500).json({
//         success: false,
//         message:
//           "AI returned invalid review JSON."
//       });
//     }

//     if (
//       !aiData ||
//       !Array.isArray(aiData.items)
//     ) {
//       return res.status(500).json({
//         success: false,
//         message:
//           "AI returned an invalid review structure."
//       });
//     }

//     // -----------------------------
//     // MERGE AI + CORRECT/WRONG RESULT
//     // -----------------------------
//     const reviews = checkedAnswers.map(
//       answer => {

//         const aiItem = aiData.items.find(
//           item =>
//             Number(item.index) === answer.index
//         );

//         if (!aiItem) {
//           throw new Error(
//             `Missing AI review for "${answer.word}".`
//           );
//         }

//         return {
//           questionNumber: answer.index + 1,

//           word: answer.word,

//           selectedAnswer:
//             answer.selectedAnswer,

//           correctAnswer:
//             answer.correctAnswer,

//           isCorrect:
//             answer.isCorrect,

//           status:
//             answer.isCorrect
//               ? "✅ Correct"
//               : "📖 Needs Review",

//           meaning:
//             String(aiItem.meaning || "").trim(),

//           hint:
//             String(aiItem.hint || "").trim(),

//           example:
//             String(aiItem.example || "").trim()
//         };
//       }
//     );

//     return res.status(200).json({
//       success: true,
//       path: normalizedPath,
//       level: parsedLevel,
//       totalReviews: reviews.length,
//       reviews
//     });

//   } catch (err) {
//     console.error(
//       "SYNONYMS REVIEW ERROR:",
//       err
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         err.message ||
//         "Failed to generate synonyms review."
//     });
//   }
// });

// router.post("/progress/save", requireAuth, async (req, res) => {
//   console.log("ENTERED /progress/save ROUTE");

//   try {
//     const userId = req.user.id;
//     const { activity_type, level, score } = req.body || {};

//     const PASSING_SCORE = 3;

//     // Validate required fields
//     if (
//       !activity_type ||
//       level === undefined ||
//       score === undefined
//     ) {
//       return res.status(400).json({
//         success: false,
//         passed: false,
//         saved: false,
//         retry_required: false,
//         message: "Missing required fields.",
//       });
//     }

//     const normalizedActivityType = String(activity_type)
//       .trim()
//       .toLowerCase();

//     const parsedLevel = Number(level);
//     const parsedScore = Number(score);

//     // Validate values
//     if (
//       !Number.isInteger(parsedLevel) ||
//       !Number.isInteger(parsedScore) ||
//       parsedLevel < 1 ||
//       parsedScore < 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         passed: false,
//         saved: false,
//         retry_required: false,
//         message: "Invalid level or score.",
//       });
//     }

//     console.log("SAVE BODY:", req.body);
//     console.log("SAVE USER ID:", userId);
//     console.log("SAVE SCORE:", parsedScore);

//     /*
//      * Do not save scores below 3.
//      * The student must retry the same level.
//      */
//     if (parsedScore < PASSING_SCORE) {
//       return res.status(200).json({
//         success: true,
//         passed: false,
//         saved: false,
//         retry_required: true,
//         unlock_next_level: false,
//         score: parsedScore,
//         passing_score: PASSING_SCORE,
//         message: `You need at least ${PASSING_SCORE} points to pass. Please retry this level.`,
//       });
//     }

//     // Get reading_path from the logged-in user
//     const userResult = await pool.query(
//       `
//       SELECT reading_path
//       FROM users
//       WHERE id = $1
//       LIMIT 1
//       `,
//       [userId]
//     );

//     if (userResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         passed: false,
//         saved: false,
//         retry_required: false,
//         message: "User not found.",
//       });
//     }

//     const readingPath = userResult.rows[0].reading_path;

//     console.log("SAVE READING PATH:", readingPath);

//     if (!readingPath) {
//       return res.status(400).json({
//         success: false,
//         passed: false,
//         saved: false,
//         retry_required: false,
//         message: "User has no reading_path yet.",
//       });
//     }

//     const allowedPaths = [
//       "Foundation",
//       "Developing",
//       "Advanced",
//     ];

//     if (!allowedPaths.includes(readingPath)) {
//       return res.status(400).json({
//         success: false,
//         passed: false,
//         saved: false,
//         retry_required: false,
//         message: "Invalid reading_path in user record.",
//       });
//     }

//     // Check whether the passed level was already recorded
//     const existing = await pool.query(
//       `
//       SELECT
//         id,
//         user_id,
//         activity_type,
//         reading_path,
//         level,
//         score,
//         completed,
//         created_at
//       FROM user_progress
//       WHERE user_id = $1
//         AND activity_type = $2
//         AND reading_path = $3
//         AND level = $4
//       LIMIT 1
//       `,
//       [
//         userId,
//         normalizedActivityType,
//         readingPath,
//         parsedLevel,
//       ]
//     );

//     if (existing.rows.length > 0) {
//       console.log("EXISTING PROGRESS FOUND:", existing.rows[0]);

//       return res.status(200).json({
//         success: true,
//         passed: true,
//         saved: false,
//         already_completed: true,
//         retry_required: false,
//         unlock_next_level: true,
//         score: existing.rows[0].score,
//         passing_score: PASSING_SCORE,
//         message:
//           "This level was already completed. The official score was not overwritten.",
//         progress: existing.rows[0],
//       });
//     }

//     // Save only passing scores
//     const insertResult = await pool.query(
//       `
//       INSERT INTO user_progress (
//         user_id,
//         activity_type,
//         reading_path,
//         level,
//         score,
//         completed
//       )
//       VALUES ($1, $2, $3, $4, $5, TRUE)
//       RETURNING
//         id,
//         user_id,
//         activity_type,
//         reading_path,
//         level,
//         score,
//         completed,
//         created_at
//       `,
//       [
//         userId,
//         normalizedActivityType,
//         readingPath,
//         parsedLevel,
//         parsedScore,
//       ]
//     );

//     console.log("PROGRESS SAVED:", insertResult.rows[0]);

//     return res.status(201).json({
//       success: true,
//       passed: true,
//       saved: true,
//       already_completed: false,
//       retry_required: false,
//       unlock_next_level: true,
//       score: parsedScore,
//       passing_score: PASSING_SCORE,
//       message: "Level passed. Progress saved successfully.",
//       progress: insertResult.rows[0],
//     });
//   } catch (err) {
//     console.error("SAVE PROGRESS ERROR:", err);

//     return res.status(500).json({
//       success: false,
//       passed: false,
//       saved: false,
//       retry_required: false,
//       message: "Server error.",
//     });
//   }
// });

// router.get("/progress", requireAuth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const result = await pool.query(
//       `
//       SELECT activity_type, reading_path, level, score, completed
//       FROM user_progress
//       WHERE user_id = $1
//       ORDER BY level ASC
//       `,
//       [userId]
//     );

//     return res.json({
//       success: true,
//       progress: result.rows,
//     });
//   } catch (err) {
//     console.error("GET PROGRESS ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//     });
//   }
// });

// router.get("/progress/unlocks", requireAuth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     const result = await pool.query(
//       `
//       SELECT level, score, completed
//       FROM user_progress
//       WHERE user_id = $1
//         AND activity_type = 'synonyms'
//       ORDER BY level ASC
//       `,
//       [userId]
//     );

//     const completedLevels = result.rows
//       .filter((row) => row.completed)
//       .map((row) => row.level);

//     // 🔓 Unlock logic
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
//     console.error("GET PROGRESS UNLOCKS ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//     });
//   }
// });



// export default router;


import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = express.Router();

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================================
// LOAD SYNONYMS CSV
// =======================================

function loadVocabularyCsv() {
  const csvPath = path.join(
    __dirname,
    "../csvFiles/synonyms_vocabulary_v3.csv"
  );

  const raw = fs.readFileSync(csvPath, "utf8").trim();
  const lines = raw.split(/\r?\n/);

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    return row;
  });
}

// =======================================
// AI WALLET ESTIMATED DEDUCTION
// Uses existing ai_credit_balance table
// =======================================

async function deductEstimatedAIUsage(result, activityType) {
  try {
    if (!result?.usage) {
      console.warn(
        "AI WALLET: Missing token usage for",
        activityType
      );
      return;
    }

    const inputTokens = Number(
      result.usage.input_tokens || 0
    );

    const outputTokens = Number(
      result.usage.output_tokens || 0
    );

    const cachedTokens = Number(
      result.usage.input_tokens_details?.cached_tokens || 0
    );

    if (
      ![inputTokens, outputTokens, cachedTokens].every(
        Number.isFinite
      ) ||
      inputTokens < 0 ||
      outputTokens < 0 ||
      cachedTokens < 0 ||
      cachedTokens > inputTokens
    ) {
      console.warn("AI WALLET: Invalid token usage");
      return;
    }

    // GPT-5 mini estimated text token pricing
    // USD per 1 million tokens.
    // Update these rates if OpenAI pricing changes.

    const estimatedCost =
      (
        (inputTokens - cachedTokens) * 0.25 +
        cachedTokens * 0.025 +
        outputTokens * 2.00
      ) / 1_000_000;

    console.log(
      `${activityType} ESTIMATED AI COST:`,
      estimatedCost
    );

    if (estimatedCost <= 0) return;

    const deduction = await pool.query(
      `
      UPDATE ai_credit_balance
      SET current_balance = current_balance - $1
      WHERE id = (
        SELECT id
        FROM ai_credit_balance
        ORDER BY verified_at DESC, id DESC
        LIMIT 1
      )
      AND current_balance >= $1
      RETURNING current_balance
      `,
      [estimatedCost.toFixed(8)]
    );

    if (deduction.rowCount > 0) {
      console.log(
        "AI WALLET BALANCE:",
        deduction.rows[0].current_balance
      );
    } else {
      console.warn(
        "AI WALLET: Balance insufficient or unavailable"
      );
    }

  } catch (error) {
    // Never interrupt student activities
    // because of wallet logging errors.
    console.error(
      "AI WALLET ERROR:",
      error.message
    );
  }
}

// =======================================
// SYNONYMS QUESTION GENERATION
// =======================================

router.get("/synonyms/:path/:level", async (req, res) => {
  try {
    const { path: readingPath, level } = req.params;

    const normalizedPath = String(readingPath)
      .trim()
      .toLowerCase();

    const parsedLevel = Number(level);

    console.log(
      "AI Quiz request path:",
      normalizedPath,
      "level:",
      parsedLevel
    );

    const allowedPaths = [
      "foundation",
      "developing",
      "advanced"
    ];

    if (!allowedPaths.includes(normalizedPath)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel > 15
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid level. Level must be between 1 and 15."
      });
    }

    // Load CSV
    const vocabulary = loadVocabularyCsv();

    // Filter current path and level
    const levelWords = vocabulary.filter(
      row =>
        String(row.reading_path)
          .trim()
          .toLowerCase() === normalizedPath &&
        Number(row.level) === parsedLevel
    );

    if (levelWords.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No vocabulary found for this path and level."
      });
    }

    // AI ONLY generates distractors.
    // Correct answers remain from the approved CSV.

    const prompt = `
You generate ONLY incorrect answer choices for a Grade 3 synonym quiz.

Reading Path: ${normalizedPath}
Current Level: ${parsedLevel}

Approved words and correct synonyms:

${levelWords
  .map(
    (row, index) =>
      `${index + 1}. Word: ${row.word}, Correct synonym: ${row.synonym}`
  )
  .join("\n")}

For each word, generate exactly 3 INCORRECT distractors.

DIFFICULTY:

Levels 1-5:
- Use easy and clearly incorrect distractors.

Levels 6-10:
- Use moderately believable distractors.

Levels 11-15:
- Use more challenging and closely related distractors.
- There must still be only one correct answer.

RULES:
- Do NOT include the correct synonym as a distractor.
- Generate exactly 3 distractors for every word.
- Keep vocabulary appropriate for Grade 3 learners.
- Do NOT generate the question text.
- Do NOT generate the correct answer.
- Do NOT add explanations.

Return ONLY valid JSON.
No markdown.
No backticks.
No comments.

Use exactly this structure:

{
  "items": [
    {
      "word": "big",
      "distractors": [
        "Tiny",
        "Slow",
        "Cold"
      ]
    }
  ]
}
`;

    const result = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ]
    });

    // ===================================
    // NEW: SYNONYMS QUESTIONS DEDUCTION
    // ===================================

    console.log(
      "SYNONYMS QUESTIONS AI RESPONSE ID:",
      result.id
    );

    console.log(
      "SYNONYMS QUESTIONS AI MODEL:",
      result.model
    );

    console.log(
      "SYNONYMS QUESTIONS AI TOKEN USAGE:",
      result.usage
    );

    await deductEstimatedAIUsage(
      result,
      "SYNONYMS QUESTIONS"
    );

    // ===================================
    // EXISTING QUESTION GENERATION LOGIC
    // ===================================

    const outputText = result.output_text?.trim();

    if (!outputText) {
      throw new Error("No output received from AI.");
    }

    console.log("RAW AI OUTPUT:");
    console.log(outputText);

    let aiData;

    try {
      aiData = JSON.parse(outputText);
    } catch (parseErr) {
      console.error("JSON PARSE ERROR:", outputText);

      return res.status(500).json({
        success: false,
        message: "AI returned invalid JSON."
      });
    }

    if (
      !aiData ||
      !Array.isArray(aiData.items)
    ) {
      console.error("INVALID AI STRUCTURE:", aiData);

      return res.status(500).json({
        success: false,
        message:
          "AI returned an invalid distractor structure."
      });
    }

    if (aiData.items.length !== levelWords.length) {
      return res.status(500).json({
        success: false,
        message:
          "AI returned an incorrect number of distractor sets."
      });
    }

    // Node.js constructs the final questions.
    // Approved CSV controls correct answers.

    const generatedQuestions = levelWords.map(
      (row, index) => {

        const aiItem = aiData.items.find(
          item =>
            String(item.word).trim().toLowerCase() ===
            String(row.word).trim().toLowerCase()
        );

        if (
          !aiItem ||
          !Array.isArray(aiItem.distractors) ||
          aiItem.distractors.length !== 3
        ) {
          throw new Error(
            `Invalid distractors generated for "${row.word}".`
          );
        }

        const correctAnswer = String(
          row.synonym
        ).trim();

        // Ensure correct answer is not a distractor.
        const distractors = aiItem.distractors.filter(
          choice =>
            String(choice).trim().toLowerCase() !==
            correctAnswer.toLowerCase()
        );

        if (distractors.length !== 3) {
          throw new Error(
            `AI generated the correct answer as a distractor for "${row.word}".`
          );
        }

        // Check duplicate distractors
        const normalizedDistractors = distractors.map(
          choice =>
            String(choice).trim().toLowerCase()
        );

        if (
          new Set(normalizedDistractors).size !== 3
        ) {
          throw new Error(
            `AI generated duplicate distractors for "${row.word}".`
          );
        }

        // Correct answer + 3 AI distractors
        const choices = [
          correctAnswer,
          ...distractors
        ];

        // Shuffle answer choices
        for (
          let i = choices.length - 1;
          i > 0;
          i--
        ) {
          const j = Math.floor(
            Math.random() * (i + 1)
          );

          [choices[i], choices[j]] = [
            choices[j],
            choices[i]
          ];
        }

        return {
          question_id: index + 1,
          word: String(row.word).trim(),
          question_text:
            `What is another word for ${row.word}?`,
          choices,
          correct_answer: correctAnswer
        };
      }
    );

    return res.status(200).json({
      success: true,
      ai_generated: true,
      path: normalizedPath,
      level: parsedLevel,
      total_questions: generatedQuestions.length,
      questions: generatedQuestions,
      questionNumber: 1,
      totalQuestions: generatedQuestions.length
    });

  } catch (err) {
    console.error("AI QUIZ ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error."
    });
  }
});

// =======================================
// SYNONYMS NEXT
// Existing FlutterFlow-compatible logic
// =======================================

router.post("/synonyms/next", (req, res) => {
  try {
    const {
      path: readingPath,
      level,
      currentQuestionIndex,
      score,
      selectedAnswer,
      questions
    } = req.body || {};

    if (
      !readingPath ||
      level === undefined ||
      currentQuestionIndex === undefined ||
      score === undefined ||
      !selectedAnswer ||
      !Array.isArray(questions)
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }

    const normalizedPath = String(readingPath)
      .trim()
      .toLowerCase();

    const parsedLevel = Number(level);
    const currentIndex = Number(currentQuestionIndex);
    const currentScore = Number(score);

    if (
      !["foundation", "developing", "advanced"]
        .includes(normalizedPath)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel > 15
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid level."
      });
    }

    if (
      !Number.isInteger(currentIndex) ||
      !Number.isInteger(currentScore) ||
      currentIndex < 0 ||
      currentIndex >= questions.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid question index or score."
      });
    }

    const currentQuestion = questions[currentIndex];

    if (
      !currentQuestion ||
      !currentQuestion.correct_answer
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid current question."
      });
    }

    // Existing scoring logic:
    // FlutterFlow handles scoring.
    const newScore = currentScore;

    const nextIndex = currentIndex + 1;

    // Last question reached
    if (nextIndex >= questions.length) {
      return res.status(200).json({
        success: true,
        finished: true,
        score: newScore,
        currentQuestionIndex: currentIndex,
        questionNumber: questions.length,
        totalQuestions: questions.length
      });
    }

    const nextQuestion = questions[nextIndex];

    console.log("NEXT QUESTION:", nextQuestion);
    console.log("NEXT INDEX:", nextIndex);
    console.log(
      "TOTAL QUESTIONS:",
      questions.length
    );

    return res.status(200).json({
      success: true,
      finished: false,
      score: newScore,
      currentQuestionIndex: nextIndex,
      questionNumber: nextIndex + 1,
      totalQuestions: questions.length,
      questionText: nextQuestion.question_text,
      choices: nextQuestion.choices,
      correctAnswer: nextQuestion.correct_answer
    });

  } catch (err) {
    console.error("NEXT ROUTE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

// =======================================
// SYNONYMS REVIEW
// =======================================

router.post("/synonyms/review", async (req, res) => {
  try {
    const {
      path: readingPath,
      level,
      answers
    } = req.body || {};

    // Validate request
    if (
      !readingPath ||
      level === undefined ||
      !Array.isArray(answers) ||
      answers.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields."
      });
    }

    const normalizedPath = String(readingPath)
      .trim()
      .toLowerCase();

    const parsedLevel = Number(level);

    const allowedPaths = [
      "foundation",
      "developing",
      "advanced"
    ];

    if (!allowedPaths.includes(normalizedPath)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path."
      });
    }

    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel > 15
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid level."
      });
    }

    // Load same CSV
    const vocabulary = loadVocabularyCsv();

    const levelWords = vocabulary.filter(
      row =>
        String(row.reading_path)
          .trim()
          .toLowerCase() === normalizedPath &&
        Number(row.level) === parsedLevel
    );

    if (levelWords.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No vocabulary found for this path and level."
      });
    }

    // Check each student's answer
    const checkedAnswers = answers.map(
      (answer, index) => {

        const word = String(
          answer.word || ""
        ).trim();

        const selectedAnswer = String(
          answer.selectedAnswer || ""
        ).trim();

        const csvWord = levelWords.find(
          row =>
            String(row.word)
              .trim()
              .toLowerCase() ===
            word.toLowerCase()
        );

        if (!csvWord) {
          throw new Error(
            `Word "${word}" was not found in the vocabulary CSV.`
          );
        }

        const correctAnswer = String(
          csvWord.synonym
        ).trim();

        const isCorrect =
          selectedAnswer.toLowerCase() ===
          correctAnswer.toLowerCase();

        return {
          index,
          word,
          selectedAnswer,
          correctAnswer,
          isCorrect
        };
      }
    );

    // ===================================
    // AI REVIEW CONTENT
    // ===================================

    const prompt = `
You create vocabulary review content for Grade 3 learners.

Activity:
Synonyms

Reading Path:
${normalizedPath}

Level:
${parsedLevel}

Below are the vocabulary words that the learner answered:

${checkedAnswers
  .map(
    item =>
      `${item.index}. Word: ${item.word}`
  )
  .join("\n")}

For EACH word, generate:

1. meaning
   - A simple child-friendly definition of the WORD itself.

2. hint
   - A short clue that helps a Grade 3 learner understand or remember the word.
   - Do not mention whether the learner answered correctly or incorrectly.

3. example
   - One short sentence that correctly uses the word.

RULES:
- Use simple English appropriate for Grade 3.
- Keep the meaning short.
- Keep the hint short.
- Keep the example sentence natural.
- Preserve each exact vocabulary word.
- Do not generate quiz questions.
- Do not generate answer choices.
- Do not determine correctness.
- Return exactly one item for every provided word.

Return ONLY valid JSON.
No markdown.
No backticks.
No comments.

Use exactly this format:

{
  "items": [
    {
      "index": 0,
      "word": "gigantic",
      "meaning": "Very large in size.",
      "hint": "Think of something much bigger than normal.",
      "example": "The gigantic elephant walked across the field."
    }
  ]
}
`;

    const result = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ]
        }
      ]
    });

    // ===================================
    // NEW: SYNONYMS REVIEW DEDUCTION
    // ===================================

    console.log(
      "SYNONYMS REVIEW AI RESPONSE ID:",
      result.id
    );

    console.log(
      "SYNONYMS REVIEW AI MODEL:",
      result.model
    );

    console.log(
      "SYNONYMS REVIEW AI TOKEN USAGE:",
      result.usage
    );

    await deductEstimatedAIUsage(
      result,
      "SYNONYMS REVIEW"
    );

    // ===================================
    // EXISTING REVIEW PROCESSING
    // ===================================

    const outputText =
      result.output_text?.trim();

    if (!outputText) {
      throw new Error(
        "No review output received from AI."
      );
    }

    console.log("RAW REVIEW AI OUTPUT:");
    console.log(outputText);

    let aiData;

    try {
      aiData = JSON.parse(outputText);
    } catch (parseErr) {
      console.error(
        "REVIEW JSON PARSE ERROR:",
        outputText
      );

      return res.status(500).json({
        success: false,
        message:
          "AI returned invalid review JSON."
      });
    }

    if (
      !aiData ||
      !Array.isArray(aiData.items)
    ) {
      return res.status(500).json({
        success: false,
        message:
          "AI returned an invalid review structure."
      });
    }

    // Merge AI + correct/wrong results
    const reviews = checkedAnswers.map(
      answer => {

        const aiItem = aiData.items.find(
          item =>
            Number(item.index) === answer.index
        );

        if (!aiItem) {
          throw new Error(
            `Missing AI review for "${answer.word}".`
          );
        }

        return {
          questionNumber: answer.index + 1,

          word: answer.word,

          selectedAnswer:
            answer.selectedAnswer,

          correctAnswer:
            answer.correctAnswer,

          isCorrect:
            answer.isCorrect,

          status:
            answer.isCorrect
              ? "✅ Correct"
              : "📖 Needs Review",

          meaning:
            String(aiItem.meaning || "").trim(),

          hint:
            String(aiItem.hint || "").trim(),

          example:
            String(aiItem.example || "").trim()
        };
      }
    );

    return res.status(200).json({
      success: true,
      path: normalizedPath,
      level: parsedLevel,
      totalReviews: reviews.length,
      reviews
    });

  } catch (err) {
    console.error(
      "SYNONYMS REVIEW ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message:
        err.message ||
        "Failed to generate synonyms review."
    });
  }
});

// =======================================
// SAVE STUDENT PROGRESS
// =======================================

router.post(
  "/progress/save",
  requireAuth,
  async (req, res) => {

    console.log("ENTERED /progress/save ROUTE");

    try {
      const userId = req.user.id;

      const {
        activity_type,
        level,
        score
      } = req.body || {};

      const PASSING_SCORE = 3;

      if (
        !activity_type ||
        level === undefined ||
        score === undefined
      ) {
        return res.status(400).json({
          success: false,
          passed: false,
          saved: false,
          retry_required: false,
          message: "Missing required fields."
        });
      }

      const normalizedActivityType =
        String(activity_type)
          .trim()
          .toLowerCase();

      const parsedLevel = Number(level);
      const parsedScore = Number(score);

      if (
        !Number.isInteger(parsedLevel) ||
        !Number.isInteger(parsedScore) ||
        parsedLevel < 1 ||
        parsedScore < 0
      ) {
        return res.status(400).json({
          success: false,
          passed: false,
          saved: false,
          retry_required: false,
          message: "Invalid level or score."
        });
      }

      console.log("SAVE BODY:", req.body);
      console.log("SAVE USER ID:", userId);
      console.log("SAVE SCORE:", parsedScore);

      // Do not save scores below 3.
      if (parsedScore < PASSING_SCORE) {
        return res.status(200).json({
          success: true,
          passed: false,
          saved: false,
          retry_required: true,
          unlock_next_level: false,
          score: parsedScore,
          passing_score: PASSING_SCORE,
          message:
            `You need at least ${PASSING_SCORE} points to pass. Please retry this level.`
        });
      }

      // Get reading_path from logged-in user
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
          passed: false,
          saved: false,
          retry_required: false,
          message: "User not found."
        });
      }

      const readingPath =
        userResult.rows[0].reading_path;

      console.log(
        "SAVE READING PATH:",
        readingPath
      );

      if (!readingPath) {
        return res.status(400).json({
          success: false,
          passed: false,
          saved: false,
          retry_required: false,
          message:
            "User has no reading_path yet."
        });
      }

      const allowedPaths = [
        "Foundation",
        "Developing",
        "Advanced"
      ];

      if (!allowedPaths.includes(readingPath)) {
        return res.status(400).json({
          success: false,
          passed: false,
          saved: false,
          retry_required: false,
          message:
            "Invalid reading_path in user record."
        });
      }

      // Do not overwrite existing completed progress.
      const existing = await pool.query(
        `
        SELECT
          id,
          user_id,
          activity_type,
          reading_path,
          level,
          score,
          completed,
          created_at
        FROM user_progress
        WHERE user_id = $1
          AND activity_type = $2
          AND reading_path = $3
          AND level = $4
        LIMIT 1
        `,
        [
          userId,
          normalizedActivityType,
          readingPath,
          parsedLevel
        ]
      );

      if (existing.rows.length > 0) {
        console.log(
          "EXISTING PROGRESS FOUND:",
          existing.rows[0]
        );

        return res.status(200).json({
          success: true,
          passed: true,
          saved: false,
          already_completed: true,
          retry_required: false,
          unlock_next_level: true,
          score: existing.rows[0].score,
          passing_score: PASSING_SCORE,
          message:
            "This level was already completed. The official score was not overwritten.",
          progress: existing.rows[0]
        });
      }

      // Save passing score
      const insertResult = await pool.query(
        `
        INSERT INTO user_progress (
          user_id,
          activity_type,
          reading_path,
          level,
          score,
          completed
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING
          id,
          user_id,
          activity_type,
          reading_path,
          level,
          score,
          completed,
          created_at
        `,
        [
          userId,
          normalizedActivityType,
          readingPath,
          parsedLevel,
          parsedScore
        ]
      );

      console.log(
        "PROGRESS SAVED:",
        insertResult.rows[0]
      );

      return res.status(201).json({
        success: true,
        passed: true,
        saved: true,
        already_completed: false,
        retry_required: false,
        unlock_next_level: true,
        score: parsedScore,
        passing_score: PASSING_SCORE,
        message:
          "Level passed. Progress saved successfully.",
        progress: insertResult.rows[0]
      });

    } catch (err) {
      console.error(
        "SAVE PROGRESS ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        passed: false,
        saved: false,
        retry_required: false,
        message: "Server error."
      });
    }
  }
);

// =======================================
// GET STUDENT PROGRESS
// =======================================

router.get(
  "/progress",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT
          activity_type,
          reading_path,
          level,
          score,
          completed
        FROM user_progress
        WHERE user_id = $1
        ORDER BY level ASC
        `,
        [userId]
      );

      return res.json({
        success: true,
        progress: result.rows
      });

    } catch (err) {
      console.error(
        "GET PROGRESS ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

// =======================================
// SYNONYMS LEVEL UNLOCKS
// =======================================

router.get(
  "/progress/unlocks",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT level, score, completed
        FROM user_progress
        WHERE user_id = $1
          AND activity_type = 'synonyms'
        ORDER BY level ASC
        `,
        [userId]
      );

      const completedLevels = result.rows
        .filter(row => row.completed)
        .map(row => row.level);

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
        progress: result.rows
      });

    } catch (err) {
      console.error(
        "GET PROGRESS UNLOCKS ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);

export default router;
