  // ANTONYMS QUIZ ROUTES
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db.js";

import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadAntonymsCsv() {
  const csvPath = path.join(
    __dirname,
    "../csvFiles/antonyms_vocabulary_v3.csv"
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

// router.get("/antonyms/:path/:level", (req, res) => {
//   try {
//     const { path: readingPath, level } = req.params;
//     const normalizedPath = readingPath.toLowerCase();

//     console.log("Antonyms request path:", normalizedPath, "level:", level);

//     let fileName = "";

//     if (normalizedPath === "foundation") {
//       fileName = "antonyms_foundation.json";
//     } else if (normalizedPath === "developing") {
//       fileName = "antonyms_developing.json";
//     } else if (normalizedPath === "advanced") {
//       fileName = "antonyms_advanced.json";
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path."
//       });
//     }

//     const filePath = path.join(__dirname, "../questionBanks", fileName);

//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({
//         success: false,
//         message: "Antonyms question bank file not found."
//       });
//     }

//     const rawData = fs.readFileSync(filePath, "utf8");
//     const questions = JSON.parse(rawData);

//     const levelQuestions = questions[level];

//     if (!levelQuestions) {
//       return res.status(404).json({
//         success: false,
//         message: "Level not found."
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       path: normalizedPath,
//       level: Number(level),
//       total_questions: levelQuestions.length,
//       questions: levelQuestions,
//       questionNumber: 1,
//       totalQuestions: levelQuestions.length
//     });
//   } catch (err) {
//     console.error("Antonyms route error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error."
//     });
//   }
// });

router.get("/antonyms/:path/:level", async (req, res) => {
  try {
    const { path: readingPath, level } = req.params;

    const normalizedPath = String(readingPath).trim().toLowerCase();
    const parsedLevel = Number(level);

    console.log(
      "AI Antonyms request path:",
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

    // read CSV
    const vocabulary = loadAntonymsCsv();

    // get only current path + level
    const levelWords = vocabulary.filter(
      row =>
        String(row.reading_path).trim().toLowerCase() === normalizedPath &&
        Number(row.level) === parsedLevel
    );

    if (levelWords.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No antonym vocabulary found for this path and level."
      });
    }

    const prompt = `
You are an AI antonym quiz generator for Grade 3 learners.

Reading Path: ${normalizedPath}
Current Level: ${parsedLevel}

Use ONLY these approved word-antonym pairs:

${levelWords
  .map(
    (row, index) =>
      `${index + 1}. Word: ${row.word}, Correct antonym: ${row.antonym}`
  )
  .join("\n")}

Generate exactly ${levelWords.length} antonym questions.

IMPORTANT RULES:

1. The target word is FIXED and must come from the provided dataset.
2. The correct antonym is FIXED and must come from the provided dataset.
3. Do NOT change or invent another correct answer.
4. Use this exact question format:
   "What is the opposite of [word]?"
5. Each question must have exactly 4 choices:
   - 1 correct antonym from the dataset
   - 3 AI-generated incorrect choices
6. Generate the 3 incorrect choices dynamically.
7. Randomize the position of the correct answer.
8. Keep all vocabulary appropriate for Grade 3 learners.
9. Do not include explanations.

DIFFICULTY BASED ON LEVEL:

Levels 1-5:
- Use easy and obvious wrong choices.
- Distractors should be clearly different from the correct antonym.

Levels 6-10:
- Use moderately challenging wrong choices.
- Distractors may be somewhat believable but must still be incorrect.

Levels 11-15:
- Use more challenging and closely related distractors.
- The choices should require more careful thinking.
- There must still be only one clearly correct antonym.
- Keep vocabulary suitable for Grade 3 learners.

Generate questions ONLY for the current reading path and level.

Return ONLY valid JSON.
No markdown.
No backticks.
No comments.

Use exactly this structure:

{
  "questions": [
    {
      "question_id": 1,
      "question_text": "What is the opposite of gigantic?",
      "choices": [
        "Huge",
        "Tall",
        "Wide",
        "Miniature"
      ],
      "correct_answer": "Miniature"
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

    const outputText = result.output_text?.trim();

    if (!outputText) {
      throw new Error("No output received from AI.");
    }

    console.log("RAW ANTONYMS AI OUTPUT:");
    console.log(outputText);

    let generatedQuiz;

    try {
      generatedQuiz = JSON.parse(outputText);
    } catch (parseErr) {
      console.error("ANTONYMS JSON PARSE ERROR:", outputText);

      return res.status(500).json({
        success: false,
        message: "AI returned invalid JSON."
      });
    }

    if (
      !generatedQuiz ||
      !Array.isArray(generatedQuiz.questions)
    ) {
      return res.status(500).json({
        success: false,
        message: "AI returned an invalid quiz structure."
      });
    }

    if (generatedQuiz.questions.length !== levelWords.length) {
      return res.status(500).json({
        success: false,
        message: "AI returned an incorrect number of questions."
      });
    }

    // validate correct antonyms against CSV
    const approvedAnswers = new Map(
      levelWords.map(row => [
        String(row.word).trim().toLowerCase(),
        String(row.antonym).trim().toLowerCase()
      ])
    );

    for (const question of generatedQuiz.questions) {
      if (
        !question.question_text ||
        !Array.isArray(question.choices) ||
        question.choices.length !== 4 ||
        !question.correct_answer
      ) {
        return res.status(500).json({
          success: false,
          message: "AI generated an invalid antonym question."
        });
      }

      const match = String(question.question_text)
        .match(/^What is the opposite of (.+)\?$/i);

      if (!match) {
        return res.status(500).json({
          success: false,
          message: "AI generated an invalid question format."
        });
      }

      const targetWord = match[1].trim().toLowerCase();
      const expectedAnswer = approvedAnswers.get(targetWord);

      if (!expectedAnswer) {
        return res.status(500).json({
          success: false,
          message: `AI used an unapproved word: ${targetWord}`
        });
      }

      if (
        String(question.correct_answer).trim().toLowerCase() !==
        expectedAnswer
      ) {
        return res.status(500).json({
          success: false,
          message: `AI changed the correct antonym for "${targetWord}".`
        });
      }

      const choiceValues = question.choices.map(choice =>
        String(choice).trim().toLowerCase()
      );

      if (!choiceValues.includes(expectedAnswer)) {
        return res.status(500).json({
          success: false,
          message: `Correct antonym is missing from choices for "${targetWord}".`
        });
      }
    }

    return res.status(200).json({
      success: true,
      ai_generated: true,
      path: normalizedPath,
      level: parsedLevel,
      total_questions: generatedQuiz.questions.length,
      questions: generatedQuiz.questions,
      questionNumber: 1,
      totalQuestions: generatedQuiz.questions.length
    });

  } catch (err) {
    console.error("AI ANTONYMS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Server error."
    });
  }
});

// router.post("/antonyms/next", (req, res) => {
//   try {
//     const {
//       path: readingPath,
//       level,
//       currentQuestionIndex,
//       score,
//       selectedAnswer,
//     } = req.body || {};

//     if (
//       !readingPath ||
//       level === undefined ||
//       currentQuestionIndex === undefined ||
//       score === undefined ||
//       !selectedAnswer
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields.",
//       });
//     }

//     const normalizedPath = String(readingPath).toLowerCase();

//     let fileName = "";

//     if (normalizedPath === "foundation") {
//       fileName = "antonyms_foundation.json";
//     } else if (normalizedPath === "developing") {
//       fileName = "antonyms_developing.json";
//     } else if (normalizedPath === "advanced") {
//       fileName = "antonyms_advanced.json";
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path.",
//       });
//     }

//     const filePath = path.join(__dirname, "../questionBanks", fileName);

//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({
//         success: false,
//         message: "Antonyms question bank file not found.",
//       });
//     }

//     const rawData = fs.readFileSync(filePath, "utf8");
//     const questionsByLevel = JSON.parse(rawData);

//     const questions = questionsByLevel[String(level)];

//     if (!questions) {
//       return res.status(404).json({
//         success: false,
//         message: "Level not found.",
//       });
//     }

//     const currentIndex = Number(currentQuestionIndex);
//     const currentScore = Number(score);

//     if (
//       Number.isNaN(currentIndex) ||
//       Number.isNaN(currentScore) ||
//       currentIndex < 0 ||
//       currentIndex >= questions.length
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid question index or score.",
//       });
//     }

//     // same approach as synonyms: no backend scoring here
//     let newScore = currentScore;

//     const nextIndex = currentIndex + 1;

//     // If last question
//     if (nextIndex >= questions.length) {
//       return res.json({
//         success: true,
//         finished: true,
//         score: newScore,
//       });
//     }

//     const nextQuestion = questions[nextIndex];

//     return res.json({
//       success: true,
//       finished: false,
//       score: newScore,
//       currentQuestionIndex: nextIndex,
//       questionNumber: nextIndex + 1,
//       totalQuestions: questions.length,
//       questionText: nextQuestion.question_text,
//       choices: nextQuestion.choices,
//       correctAnswer: nextQuestion.correct_answer,
//     });

//   } catch (err) {
//     console.error("ANTONYMS NEXT ROUTE ERROR:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//     });
//   }
// });

router.post("/antonyms/next", (req, res) => {
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

    const normalizedPath = String(readingPath).trim().toLowerCase();
    const parsedLevel = Number(level);
    const currentIndex = Number(currentQuestionIndex);
    const currentScore = Number(score);

    if (
      !["foundation", "developing", "advanced"].includes(normalizedPath)
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

    // scoring is still handled by FlutterFlow
    const newScore = currentScore;

    const nextIndex = currentIndex + 1;

    // Last question
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

    return res.status(200).json({
      success: true,
      finished: false,
      score: newScore,

      currentQuestionIndex: nextIndex,
      questionNumber: nextIndex + 1,
      totalQuestions: questions.length,

      // camelCase because this matched your working FlutterFlow synonyms setup
      questionText: nextQuestion.question_text,
      choices: nextQuestion.choices,
      correctAnswer: nextQuestion.correct_answer
    });

  } catch (err) {
    console.error("ANTONYMS NEXT ROUTE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
});

router.get("/progress/unlocks", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT level, score, completed
      FROM user_progress
      WHERE user_id = $1
        AND activity_type = 'antonyms'
      ORDER BY level ASC
      `,
      [userId]
    );

    const completedLevels = result.rows
      .filter((row) => row.completed)
      .map((row) => row.level);

    // 🔓 Unlock logic
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
    console.error("GET ANTONYMS PROGRESS UNLOCKS ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

router.post("/antonyms/review", async (req, res) => {
  try {
    const {
      path: readingPath,
      level,
      answers
    } = req.body || {};

    // -----------------------------
    // VALIDATE REQUEST
    // -----------------------------
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

    // -----------------------------
    // LOAD ANTONYMS CSV
    // -----------------------------
    const vocabulary = loadAntonymsCsv();

    const levelWords = vocabulary.filter(
      row =>
        String(row.reading_path || "")
          .trim()
          .toLowerCase() === normalizedPath &&
        Number(row.level) === parsedLevel
    );

    if (levelWords.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          "No antonym vocabulary found for this path and level."
      });
    }

    // Make sure number of answers is valid
    if (answers.length > levelWords.length) {
      return res.status(400).json({
        success: false,
        message:
          "Received more answers than available vocabulary items."
      });
    }

    // -----------------------------
    // CHECK EACH STUDENT ANSWER
    // -----------------------------
    //
    // IMPORTANT:
    // We do NOT trust answer.word anymore.
    // Word + correct answer come directly
    // from the CSV using the question index.
    // -----------------------------
    const checkedAnswers = answers.map(
      (answer, index) => {

        const csvWord = levelWords[index];

        if (!csvWord) {
          throw new Error(
            `Vocabulary item at index ${index} was not found.`
          );
        }

        const word = String(
          csvWord.word || ""
        ).trim();

        const correctAnswer = String(
          csvWord.antonym || ""
        ).trim();

        const selectedAnswer = String(
          answer.selectedAnswer || ""
        ).trim();

        if (!word) {
          throw new Error(
            `Missing vocabulary word at index ${index}.`
          );
        }

        if (!correctAnswer) {
          throw new Error(
            `Missing antonym for "${word}".`
          );
        }

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

    console.log(
      "CHECKED ANTONYM ANSWERS:",
      checkedAnswers
    );

    // -----------------------------
    // AI REVIEW CONTENT
    // -----------------------------
    const prompt = `
You create vocabulary review content for Grade 3 learners.

Activity:
Antonyms

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

    const outputText =
      result.output_text?.trim();

    if (!outputText) {
      throw new Error(
        "No review output received from AI."
      );
    }

    console.log(
      "RAW ANTONYMS REVIEW AI OUTPUT:"
    );

    console.log(outputText);

    let aiData;

    // -----------------------------
    // PARSE AI JSON
    // -----------------------------
    try {
      aiData = JSON.parse(outputText);
    } catch (parseErr) {

      console.error(
        "ANTONYMS REVIEW JSON PARSE ERROR:",
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

    // -----------------------------
    // MERGE AI + ANSWER RESULT
    // -----------------------------
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
          questionNumber:
            answer.index + 1,

          word:
            answer.word,

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
            String(
              aiItem.meaning || ""
            ).trim(),

          hint:
            String(
              aiItem.hint || ""
            ).trim(),

          example:
            String(
              aiItem.example || ""
            ).trim()
        };
      }
    );

    // -----------------------------
    // SEND RESPONSE
    // -----------------------------
    return res.status(200).json({
      success: true,

      path:
        normalizedPath,

      level:
        parsedLevel,

      totalReviews:
        reviews.length,

      reviews
    });

  } catch (err) {

    console.error(
      "ANTONYMS REVIEW ERROR:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        err.message ||
        "Failed to generate antonyms review."
    });
  }
});

// router.post("/antonyms/review", async (req, res) => {
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
//     // LOAD SAME ANTONYMS CSV
//     // -----------------------------
//     const vocabulary = loadAntonymsCsv();

//     const levelWords = vocabulary.filter(
//       row =>
//         String(row.reading_path || "")
//           .trim()
//           .toLowerCase() === normalizedPath &&
//         Number(row.level) === parsedLevel
//     );

//     if (levelWords.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message:
//           "No antonym vocabulary found for this path and level."
//       });
//     }

//     // -----------------------------
//     // CHECK EACH STUDENT ANSWER
//     // -----------------------------
//     const checkedAnswers = answers.map(
//       (answer, index) => {

//         const word = String(
//           answer.word || ""
//         ).trim();

//         const selectedAnswer = String(
//           answer.selectedAnswer || ""
//         ).trim();

//         if (!word) {
//           throw new Error(
//             `Missing word for answer at index ${index}.`
//           );
//         }

//         const csvWord = levelWords.find(
//           row =>
//             String(row.word || "")
//               .trim()
//               .toLowerCase() ===
//             word.toLowerCase()
//         );

//         if (!csvWord) {
//           throw new Error(
//             `Word "${word}" was not found in the antonyms CSV.`
//           );
//         }

//         const correctAnswer = String(
//           csvWord.antonym || ""
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
// You create vocabulary review content for Grade 3 learners.

// Activity:
// Antonyms

// Reading Path:
// ${normalizedPath}

// Level:
// ${parsedLevel}

// Below are the vocabulary words that the learner answered:

// ${checkedAnswers
//   .map(
//     item =>
//       `${item.index}. Word: ${item.word}`
//   )
//   .join("\n")}

// For EACH word, generate:

// 1. meaning
//    - A simple child-friendly definition of the WORD itself.

// 2. hint
//    - A short clue that helps a Grade 3 learner understand or remember the word.
//    - Do not mention whether the learner answered correctly or incorrectly.

// 3. example
//    - One short sentence that correctly uses the word.

// RULES:
// - Use simple English appropriate for Grade 3.
// - Keep the meaning short.
// - Keep the hint short.
// - Keep the example sentence natural.
// - Preserve each exact vocabulary word.
// - Do not generate quiz questions.
// - Do not generate answer choices.
// - Do not determine correctness.
// - Return exactly one item for every provided word.

// Return ONLY valid JSON.
// No markdown.
// No backticks.
// No comments.

// Use exactly this format:

// {
//   "items": [
//     {
//       "index": 0,
//       "word": "gigantic",
//       "meaning": "Very large in size.",
//       "hint": "Think of something much bigger than normal.",
//       "example": "The gigantic elephant walked across the field."
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

//     const outputText =
//       result.output_text?.trim();

//     if (!outputText) {
//       throw new Error(
//         "No review output received from AI."
//       );
//     }

//     console.log(
//       "RAW ANTONYMS REVIEW AI OUTPUT:"
//     );

//     console.log(outputText);

//     let aiData;

//     try {
//       aiData = JSON.parse(outputText);
//     } catch (parseErr) {
//       console.error(
//         "ANTONYMS REVIEW JSON PARSE ERROR:",
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
//           questionNumber:
//             answer.index + 1,

//           word:
//             answer.word,

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
//             String(
//               aiItem.meaning || ""
//             ).trim(),

//           hint:
//             String(
//               aiItem.hint || ""
//             ).trim(),

//           example:
//             String(
//               aiItem.example || ""
//             ).trim()
//         };
//       }
//     );

//     // -----------------------------
//     // SEND RESPONSE
//     // -----------------------------
//     return res.status(200).json({
//       success: true,
//       path: normalizedPath,
//       level: parsedLevel,
//       totalReviews: reviews.length,
//       reviews
//     });

//   } catch (err) {
//     console.error(
//       "ANTONYMS REVIEW ERROR:",
//       err
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         err.message ||
//         "Failed to generate antonyms review."
//     });
//   }
// });


// router.get("/antonyms-review/:path/:level", (req, res) => {
//   try {
//     const { path: readingPath, level } = req.params;
//     const normalizedPath = readingPath.toLowerCase();

//     let fileName = "";

//     if (normalizedPath === "foundation") {
//       fileName = "foundation_antonyms_review.json";
//     } else if (normalizedPath === "developing") {
//       fileName = "developing_antonyms_review.json";
//     } else if (normalizedPath === "advanced") {
//       fileName = "advanced_antonyms_review.json";
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path.",
//       });
//     }

//     const filePath = path.join(__dirname, "../reviewBanks", fileName);
//     const rawData = fs.readFileSync(filePath, "utf8");
//     const reviewData = JSON.parse(rawData);

//     const levelReview = reviewData[level];

//     if (!levelReview) {
//       return res.status(404).json({
//         success: false,
//         message: "Review level not found.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       path: normalizedPath,
//       level: Number(level),
//       total_words: levelReview.length,
//       reviews: levelReview,
//     });
//   } catch (err) {
//     console.error("Antonyms review route error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Server error.",
//     });
//   }
// });

export default router;