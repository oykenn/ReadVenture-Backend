
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";

const router = express.Router();

// ======================================================
// ES MODULE __dirname FIX
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ======================================================
// OPENAI
// ======================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// ======================================================
// GET POEMS PROGRESS
// ======================================================

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
    console.error("GET POEMS PROGRESS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});


router.get("/poems/:path/:level", async (req, res) => {
  try {
    // ==================================================
    // REQUEST PARAMS
    // ==================================================

    const { path: readingPath, level } = req.params;

    const normalizedPath = String(readingPath)
      .trim()
      .toLowerCase();

    const parsedLevel = Number(level);

    console.log("======================================");
    console.log("AI POEM REQUEST");
    console.log("Path:", normalizedPath);
    console.log("Level:", parsedLevel);
    console.log("======================================");

    // ==================================================
    // VALIDATE READING PATH
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
      fileName = "poems_foundation_v2.json";
    } else if (normalizedPath === "developing") {
      fileName = "poems_developing_v2.json";
    } else if (normalizedPath === "advanced") {
      fileName = "poems_advanced_v2.json";
    }

    // FILE PATH
    const filePath = path.join(
      __dirname,
      "../questionBanks",
      fileName
    );

    // ==================================================
    // CHECK FILE
    // ==================================================

    if (!fs.existsSync(filePath)) {
      console.error("FILE NOT FOUND:", filePath);

      return res.status(404).json({
        success: false,
        message: `Poem file not found: ${fileName}`,
      });
    }

    // ==================================================
    // READ JSON
    // ==================================================

    const rawData = fs.readFileSync(
      filePath,
      "utf8"
    );

    const poems = JSON.parse(rawData);

    if (!Array.isArray(poems)) {
      throw new Error(
        "Poem JSON must contain an array."
      );
    }

    // ==================================================
    // FIND POEM BY LEVEL
    // ==================================================

    const poem = poems.find(
      (item) => Number(item.level) === parsedLevel
    );

    if (!poem) {
      return res.status(404).json({
        success: false,
        message: "Poem level not found.",
      });
    }

    // ==================================================
    // CHECK POEM DATA
    // ==================================================

    if (!poem.title || !poem.poem_text) {
      throw new Error(
        "Poem is missing title or poem_text."
      );
    }

    console.log("POEM FOUND:", poem.title);

    // ==================================================
    // ADAPTIVE DIFFICULTY
    // ==================================================

    let difficultyInstruction = "";

    if (normalizedPath === "foundation") {
      difficultyInstruction = `
FOUNDATION PATH:

- Use very simple and direct comprehension questions.
- Focus mainly on details clearly stated in the poem.
- Ask about who, what, where, or what happened.
- Include only very simple inference when appropriate.
- Keep choices short and easy to understand.
`;
    }

    if (normalizedPath === "developing") {
      difficultyInstruction = `
DEVELOPING PATH:

- Use a mix of direct comprehension and simple reasoning.
- Include questions about details, meaning, sequence,
  simple cause and effect, and main idea.
- Include some simple inference.
- Keep all wording easy for a Grade 3 learner.
`;
    }

    if (normalizedPath === "advanced") {
      difficultyInstruction = `
ADVANCED PATH:

- Make the thinking slightly more challenging,
  but ALWAYS keep the language at Grade 3 level.
- Include questions about main idea, message,
  simple inference, meaning, feelings, or decisions.
- Do not use difficult academic words.
- Do not make long or complicated questions.
- Advanced means harder thinking, NOT harder English.
`;
    }

    // ==================================================
    // AI PROMPT
    // ==================================================

    const prompt = `
You are creating a reading comprehension activity
for a Grade 3 elementary learner.

READING PATH:
${normalizedPath}

LEVEL:
${parsedLevel}

POEM TITLE:
${poem.title}

POEM:
${poem.poem_text}


==================================================
IMPORTANT AGE RULE
==================================================

The learner is Grade 3.

EVERYTHING you generate must be understandable
by a Grade 3 learner.

This includes:

- question_text
- choices
- correct_answer
- hint
- feedback

Use:

- short sentences
- common words
- simple English
- clear instructions

Avoid:

- advanced vocabulary
- academic wording
- long sentences
- confusing expressions
- complicated grammar


${difficultyInstruction}


==================================================
QUESTION REQUIREMENTS
==================================================

Generate exactly 5 multiple-choice questions.

Every question must:

- Be based ONLY on the provided poem.
- Have exactly 4 choices.
- Have only ONE correct answer.
- Have a correct_answer that EXACTLY matches
  one of the four choices.
- Have short and readable choices.
- Be appropriate for Grade 3.
- Test reading comprehension.

Do not create questions about information
that is not supported by the poem.

Do not make all 5 questions simple recall questions.

Use a reasonable mixture of:

1. Direct detail
2. Meaning
3. Main idea
4. Simple cause and effect
5. Feeling or character understanding
6. Message or lesson
7. Simple inference

Only use question types that make sense
for the poem.

Questions must be objective.

Do NOT ask for the learner's personal opinion
or personal feelings.

BAD:
"How does the poem make you feel?"

GOOD:
"What feeling does the poem show?"


==================================================
CHOICE RULES
==================================================

Each question must have exactly 4 choices.

Choices should:

- Be short.
- Be easy to read.
- Use Grade 3 vocabulary.
- Have only one clearly correct answer.
- Include believable wrong answers.

Avoid choices that are almost identical.

Do not make trick questions.


==================================================
HINT RULES
==================================================

Generate one hint for every question.

The hint should:

- Help the learner think.
- Give a small clue.
- Use simple Grade 3 language.
- NOT reveal the correct answer.
- NOT tell exactly where the answer is found.

GOOD EXAMPLES:

"Think about what happens when the day begins."

"Think about how the person feels."

"Think about what changed in the poem."

"Remember what happened after the seed got sun and rain."

DO NOT write hints like:

"Read the first line."

"Read the second line."

"Look at line 3."

"Check the last line."

"Look at the answer in the poem."

"The answer is morning."

Never mention line numbers.

Never directly reveal the correct answer.


==================================================
FEEDBACK RULES
==================================================

Generate one feedback explanation for every question.

Feedback should:

- Explain why the correct answer is correct.
- Use simple Grade 3 English.
- Be short.
- Be friendly and educational.
- Refer to the idea from the poem.
- Help the learner understand the answer.

Do not say:

"Read line 1."

"According to line 2."

"Look at the third line."

Do not use difficult academic explanations.


==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

Do not use markdown.

Do not write explanations before or after the JSON.

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
    // OPENAI REQUEST
    // ==================================================

    console.log("Generating AI poem questions...");

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4.1-mini",

        messages: [
          {
            role: "system",
            content: `
You are an educational reading activity generator.

Your learners are Grade 3 elementary students.

Always use simple, child-friendly English.

Difficulty may change based on the learner's reading path,
but vocabulary and sentence structure must always remain
appropriate for Grade 3.

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

        temperature: 0.6,
      });

    // ==================================================
    // GET AI RESPONSE
    // ==================================================

    const aiText =
      completion.choices?.[0]?.message?.content;

    if (!aiText) {
      throw new Error(
        "OpenAI returned an empty response."
      );
    }

    console.log("AI RESPONSE RECEIVED");

    // ==================================================
    // PARSE JSON
    // ==================================================

    let aiData;

    try {
      aiData = JSON.parse(aiText);
    } catch (parseError) {
      console.error(
        "AI JSON PARSE ERROR:",
        aiText
      );

      throw new Error(
        "AI returned invalid JSON."
      );
    }

    // ==================================================
    // CHECK QUESTIONS ARRAY
    // ==================================================

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
    // CLEAN / NORMALIZE QUESTIONS
    // ==================================================

    const questions = aiData.questions.map(
      (question, index) => {
        return {
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
                .indexOf(String(question.correct_answer || "").trim())
            : -1,

          hint: String(
            question.hint || ""
          ).trim(),

          feedback: String(
            question.feedback || ""
          ).trim(),
        };
      }
    );

    // ==================================================
    // VALIDATE EACH QUESTION
    // ==================================================

    for (const question of questions) {
      if (!question.question_text) {
        throw new Error(
          "AI generated an empty question_text."
        );
      }

      if (
        !Array.isArray(question.choices) ||
        question.choices.length !== 4
      ) {
        throw new Error(
          `Question ${question.question_id} does not have exactly 4 choices.`
        );
      }

      if (
        question.choices.some(
          (choice) => !choice
        )
      ) {
        throw new Error(
          `Question ${question.question_id} has an empty choice.`
        );
      }

      if (!question.correct_answer) {
        throw new Error(
          `Question ${question.question_id} has no correct_answer.`
        );
      }

      if (
        !question.choices.includes(
          question.correct_answer
        )
      ) {
        throw new Error(
          `Question ${question.question_id}: correct_answer is not included in choices.`
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

    // ==================================================
    // TERMINAL OUTPUT
    // ==================================================

    console.log(
      `SUCCESS: Generated ${questions.length} questions for ${poem.title}`
    );

    console.log("======================================");
    console.log("AI GENERATED QUESTIONS");
    console.log("======================================");

    console.log(
      JSON.stringify(questions, null, 2)
    );

    console.log("======================================");

    // ==================================================
    // SUCCESS RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      ai_generated: true,

      path: normalizedPath,

      level: parsedLevel,

      title: poem.title,

      poem_text: poem.poem_text,

      total_questions: questions.length,

      questions,

      questionNumber: 1,

      totalQuestions: questions.length,
    });

  } catch (err) {
    // ==================================================
    // ERROR
    // ==================================================

    console.error(
      "AI POEM ROUTE ERROR:",
      err
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to prepare the poem activity.",

      error: err.message,
    });
  }
});
export default router;