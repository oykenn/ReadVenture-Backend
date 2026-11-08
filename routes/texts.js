import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ======================================================
// GET TEXTS PROGRESS
// ======================================================

router.get("/progress/texts", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
        SELECT level, score, completed
        FROM user_progress
        WHERE user_id = $1
          AND activity_type = 'texts'
        ORDER BY level ASC
      `,
      [userId]
    );

    const completedLevels = result.rows
      .filter((row) => row.completed)
      .map((row) => Number(row.level));

    return res.status(200).json({
      success: true,

      completedLevels,

      unlockLevel2: completedLevels.includes(1),
      unlockLevel3: completedLevels.includes(2),
      unlockLevel4: completedLevels.includes(3),
      unlockLevel5: completedLevels.includes(4),
      unlockLevel6: completedLevels.includes(5),
      unlockLevel7: completedLevels.includes(6),
      unlockLevel8: completedLevels.includes(7),
      unlockLevel9: completedLevels.includes(8),
      unlockLevel10: completedLevels.includes(9),
      unlockLevel11: completedLevels.includes(10),
      unlockLevel12: completedLevels.includes(11),
      unlockLevel13: completedLevels.includes(12),
      unlockLevel14: completedLevels.includes(13),
      unlockLevel15: completedLevels.includes(14),

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


// ======================================================
// GET TEXT + AI QUESTIONS
// ======================================================

router.get("/texts/:path/:level", async (req, res) => {
  try {

    const { path: readingPath, level } = req.params;

    const normalizedPath = String(readingPath)
      .trim()
      .toLowerCase();

    const parsedLevel = Number(level);

    console.log("======================================");
    console.log("AI TEXT REQUEST");
    console.log("Path:", normalizedPath);
    console.log("Level:", parsedLevel);
    console.log("======================================");


    // ==================================================
    // VALIDATE PATH
    // ==================================================

    const allowedPaths = [
      "foundation",
      "developing",
      "advanced",
    ];

    if (!allowedPaths.includes(normalizedPath)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path.",
      });
    }


    // ==================================================
    // VALIDATE LEVEL
    // ==================================================

    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel > 15
    ) {
      return res.status(400).json({
        success: false,
        message: "Level must be between 1 and 15.",
      });
    }


    // ==================================================
    // CHOOSE JSON FILE
    // ==================================================

    let fileName = "";

    if (normalizedPath === "foundation") {
      fileName = "texts_foundation_v2.json";
    } else if (normalizedPath === "developing") {
      fileName = "texts_developing_v2.json";
    } else if (normalizedPath === "advanced") {
      fileName = "texts_advanced_v2.json";
    }


    const filePath = path.join(
      __dirname,
      "../questionBanks",
      fileName
    );


    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Text file not found: ${fileName}`,
      });
    }


    const rawData = fs.readFileSync(filePath, "utf8");

    const texts = JSON.parse(rawData);

    if (!Array.isArray(texts)) {
      throw new Error(
        "Texts JSON must contain an array."
      );
    }


    // ==================================================
    // FIND LEVEL
    // ==================================================

    const textItem = texts.find(
      (item) => Number(item.level) === parsedLevel
    );

    if (!textItem) {
      return res.status(404).json({
        success: false,
        message: "Text level not found.",
      });
    }


    if (!textItem.title || !textItem.text_content) {
      throw new Error(
        "Text is missing title or text_content."
      );
    }


    // ==================================================
    // DIFFICULTY
    // ==================================================

    let difficultyInstruction = "";

    if (normalizedPath === "foundation") {
      difficultyInstruction = `
FOUNDATION PATH:

- Use simple and direct comprehension questions.
- Focus mostly on details clearly stated in the text.
- Ask simple who, what, where, and what happened questions.
- Keep choices short and easy.
`;
    }

    if (normalizedPath === "developing") {
      difficultyInstruction = `
DEVELOPING PATH:

- Mix direct questions with simple reasoning.
- Include sequence, cause and effect, meaning, and main idea.
- Include simple inference when appropriate.
- Keep the language suitable for Grade 3.
`;
    }

    if (normalizedPath === "advanced") {
      difficultyInstruction = `
ADVANCED PATH:

- Make the thinking more challenging,
  but keep the language appropriate for Grade 3.
- Include main idea, cause and effect,
  inference, meaning, and lesson when appropriate.
- Advanced means harder thinking, NOT harder English.
`;
    }


    // ==================================================
    // PROMPT
    // ==================================================

    const prompt = `
You are creating a reading comprehension activity
for a Grade 3 elementary learner.

READING PATH:
${normalizedPath}

LEVEL:
${parsedLevel}

TEXT TITLE:
${textItem.title}

TEXT:
${textItem.text_content}


${difficultyInstruction}


Generate exactly 5 multiple-choice questions.

Each question must:

- Be based ONLY on the provided text.
- Have exactly 4 choices.
- Have only ONE correct answer.
- Have a correct_answer that exactly matches one choice.
- Use simple Grade 3 English.
- Test reading comprehension.

Use a reasonable mixture of:

1. Direct detail
2. Meaning
3. Sequence
4. Main idea
5. Cause and effect
6. Simple inference
7. Lesson or message when appropriate


Generate one hint for every question.

The hint must:

- Help the learner think.
- Not reveal the answer.
- Use simple language.
- Never mention sentence or paragraph numbers.


Generate one feedback explanation for every question.

Feedback must:

- Explain why the answer is correct.
- Be short.
- Be friendly.
- Use Grade 3 English.


Return ONLY valid JSON.

Use exactly this structure:

{
  "questions": [
    {
      "question_id": 1,
      "question_text": "",
      "choices": [
        "",
        "",
        "",
        ""
      ],
      "correct_answer": "",
      "hint": "",
      "feedback": ""
    }
  ]
}
`;


    // ==================================================
    // OPENAI
    // ==================================================

    const completion =
      await openai.chat.completions.create({
        model: "gpt-5-mini",

        messages: [
          {
            role: "system",
            content: `
You are an educational reading activity generator.

Your learners are Grade 3 elementary students.

Always use simple, child-friendly English.

Return valid JSON only.
`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        response_format: {
          type: "json_object",
        },

        // temperature: 0.6,
      });


    const aiText =
      completion.choices?.[0]?.message?.content;

    if (!aiText) {
      throw new Error(
        "OpenAI returned an empty response."
      );
    }


    const aiData = JSON.parse(aiText);

    if (!Array.isArray(aiData.questions)) {
      throw new Error(
        "AI response does not contain questions array."
      );
    }

    if (aiData.questions.length !== 5) {
      throw new Error(
        `AI returned ${aiData.questions.length} questions instead of 5.`
      );
    }


    // ==================================================
    // NORMALIZE QUESTIONS
    // ==================================================

    const questions = aiData.questions.map(
      (question, index) => ({
        question_id: index + 1,

        question_text: String(
          question.question_text || ""
        ).trim(),

        choices: Array.isArray(question.choices)
          ? question.choices.map((choice) =>
              String(choice).trim()
            )
          : [],

        correct_answer: String(
          question.correct_answer || ""
        ).trim(),

        correct_choice_index: Array.isArray(question.choices)
          ? question.choices
              .map((choice) => String(choice).trim())
              .indexOf(
                String(
                  question.correct_answer || ""
                ).trim()
              )
          : -1,

        hint: String(
          question.hint || ""
        ).trim(),

        feedback: String(
          question.feedback || ""
        ).trim(),
      })
    );


    // ==================================================
    // VALIDATION
    // ==================================================

    for (const question of questions) {

      if (!question.question_text) {
        throw new Error(
          "AI generated an empty question."
        );
      }

      if (question.choices.length !== 4) {
        throw new Error(
          `Question ${question.question_id} must have exactly 4 choices.`
        );
      }

      if (
        !question.choices.includes(
          question.correct_answer
        )
      ) {
        throw new Error(
          `Question ${question.question_id}: correct answer is not in choices.`
        );
      }

      if (!question.hint) {
        throw new Error(
          `Question ${question.question_id} has no hint.`
        );
      }

      if (!question.feedback) {
        throw new Error(
          `Question ${question.question_id} has no feedback.`
        );
      }
    }

    // Shuffle choices and update the correct answer index
    for (const question of questions) {
      for (let i = question.choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [question.choices[i], question.choices[j]] =
          [question.choices[j], question.choices[i]];
      }

      question.correct_choice_index =
        question.choices.indexOf(question.correct_answer);
    }


    // ==================================================
    // RESPONSE
    // ==================================================

  const responseData = {
    success: true,
    ai_generated: true,
    path: normalizedPath,
    level: parsedLevel,
    title: textItem.title,
    text_content: textItem.text_content,
    total_questions: questions.length,
    questions,
    questionNumber: 1,
    totalQuestions: questions.length,
  };

  console.log("=== GENERATED TEXTS RESPONSE ===");
  console.log(JSON.stringify(responseData, null, 2));

  return res.status(200).json(responseData);


  } catch (err) {

    console.error(
      "AI TEXT ROUTE ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Unable to prepare the text activity.",
      error: err.message,
    });
  }
});


export default router;