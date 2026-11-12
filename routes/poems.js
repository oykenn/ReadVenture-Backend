
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


// router.get("/poems/:path/:level", async (req, res) => {
//   try {
//     // ==================================================
//     // REQUEST PARAMS
//     // ==================================================

//     const { path: readingPath, level } = req.params;

//     const normalizedPath = String(readingPath)
//       .trim()
//       .toLowerCase();

//     const parsedLevel = Number(level);

//     console.log("======================================");
//     console.log("AI POEM REQUEST");
//     console.log("Path:", normalizedPath);
//     console.log("Level:", parsedLevel);
//     console.log("======================================");

//     // ==================================================
//     // VALIDATE READING PATH
//     // ==================================================

//     const allowedPaths = [
//       "foundation",
//       "developing",
//       "advanced",
//     ];

//     if (!allowedPaths.includes(normalizedPath)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path.",
//       });
//     }

//     // ==================================================
//     // VALIDATE LEVEL
//     // ==================================================

//     if (
//       !Number.isInteger(parsedLevel) ||
//       parsedLevel < 1 ||
//       parsedLevel > 15
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Level must be between 1 and 15.",
//       });
//     }

//     // ==================================================
//     // CHOOSE JSON FILE
//     // ==================================================

//     let fileName = "";

//     if (normalizedPath === "foundation") {
//       fileName = "poems_foundation_v2.json";
//     } else if (normalizedPath === "developing") {
//       fileName = "poems_developing_v2.json";
//     } else if (normalizedPath === "advanced") {
//       fileName = "poems_advanced_v2.json";
//     }

//     // FILE PATH
//     const filePath = path.join(
//       __dirname,
//       "../questionBanks",
//       fileName
//     );

//     // ==================================================
//     // CHECK FILE
//     // ==================================================

//     if (!fs.existsSync(filePath)) {
//       console.error("FILE NOT FOUND:", filePath);

//       return res.status(404).json({
//         success: false,
//         message: `Poem file not found: ${fileName}`,
//       });
//     }

//     // ==================================================
//     // READ JSON
//     // ==================================================

//     const rawData = fs.readFileSync(
//       filePath,
//       "utf8"
//     );

//     const poems = JSON.parse(rawData);

//     if (!Array.isArray(poems)) {
//       throw new Error(
//         "Poem JSON must contain an array."
//       );
//     }

//     // ==================================================
//     // FIND POEM BY LEVEL
//     // ==================================================

//     const poem = poems.find(
//       (item) => Number(item.level) === parsedLevel
//     );

//     if (!poem) {
//       return res.status(404).json({
//         success: false,
//         message: "Poem level not found.",
//       });
//     }

//     // ==================================================
//     // CHECK POEM DATA
//     // ==================================================

//     if (!poem.title || !poem.poem_text) {
//       throw new Error(
//         "Poem is missing title or poem_text."
//       );
//     }

//     console.log("POEM FOUND:", poem.title);

//     // ==================================================
//     // ADAPTIVE DIFFICULTY
//     // ==================================================

//     let difficultyInstruction = "";

//     if (normalizedPath === "foundation") {
//       difficultyInstruction = `
// FOUNDATION PATH:

// - Use very simple and direct comprehension questions.
// - Focus mainly on details clearly stated in the poem.
// - Ask about who, what, where, or what happened.
// - Include only very simple inference when appropriate.
// - Keep choices short and easy to understand.
// `;
//     }

//     if (normalizedPath === "developing") {
//       difficultyInstruction = `
// DEVELOPING PATH:

// - Use a mix of direct comprehension and simple reasoning.
// - Include questions about details, meaning, sequence,
//   simple cause and effect, and main idea.
// - Include some simple inference.
// - Keep all wording easy for a Grade 3 learner.
// `;
//     }

//     if (normalizedPath === "advanced") {
//       difficultyInstruction = `
// ADVANCED PATH:

// - Make the thinking slightly more challenging,
//   but ALWAYS keep the language at Grade 3 level.
// - Include questions about main idea, message,
//   simple inference, meaning, feelings, or decisions.
// - Do not use difficult academic words.
// - Do not make long or complicated questions.
// - Advanced means harder thinking, NOT harder English.
// `;
//     }

//     // ==================================================
//     // AI PROMPT
//     // ==================================================

//     const prompt = `
// You are creating a reading comprehension activity
// for a Grade 3 elementary learner.

// READING PATH:
// ${normalizedPath}

// LEVEL:
// ${parsedLevel}

// POEM TITLE:
// ${poem.title}

// POEM:
// ${poem.poem_text}


// ==================================================
// IMPORTANT AGE RULE
// ==================================================

// The learner is Grade 3.

// EVERYTHING you generate must be understandable
// by a Grade 3 learner.

// This includes:

// - question_text
// - choices
// - correct_answer
// - hint
// - feedback

// Use:

// - short sentences
// - common words
// - simple English
// - clear instructions

// Avoid:

// - advanced vocabulary
// - academic wording
// - long sentences
// - confusing expressions
// - complicated grammar


// ${difficultyInstruction}


// ==================================================
// QUESTION REQUIREMENTS
// ==================================================

// Generate exactly 5 multiple-choice questions.

// Every question must:

// - Be based ONLY on the provided poem.
// - Have exactly 4 choices.
// - Have only ONE correct answer.
// - Have a correct_answer that EXACTLY matches
//   one of the four choices.
// - Have short and readable choices.
// - Be appropriate for Grade 3.
// - Test reading comprehension.

// Do not create questions about information
// that is not supported by the poem.

// Do not make all 5 questions simple recall questions.

// Use a reasonable mixture of:

// 1. Direct detail
// 2. Meaning
// 3. Main idea
// 4. Simple cause and effect
// 5. Feeling or character understanding
// 6. Message or lesson
// 7. Simple inference

// Only use question types that make sense
// for the poem.

// Questions must be objective.

// Do NOT ask for the learner's personal opinion
// or personal feelings.

// BAD:
// "How does the poem make you feel?"

// GOOD:
// "What feeling does the poem show?"


// ==================================================
// CHOICE RULES
// ==================================================

// Each question must have exactly 4 choices.

// Choices should:

// - Be short.
// - Be easy to read.
// - Use Grade 3 vocabulary.
// - Have only one clearly correct answer.
// - Include believable wrong answers.

// Avoid choices that are almost identical.

// Do not make trick questions.


// ==================================================
// HINT RULES
// ==================================================

// Generate one hint for every question.

// The hint should:

// - Help the learner think.
// - Give a small clue.
// - Use simple Grade 3 language.
// - NOT reveal the correct answer.
// - NOT tell exactly where the answer is found.

// GOOD EXAMPLES:

// "Think about what happens when the day begins."

// "Think about how the person feels."

// "Think about what changed in the poem."

// "Remember what happened after the seed got sun and rain."

// DO NOT write hints like:

// "Read the first line."

// "Read the second line."

// "Look at line 3."

// "Check the last line."

// "Look at the answer in the poem."

// "The answer is morning."

// Never mention line numbers.

// Never directly reveal the correct answer.


// ==================================================
// FEEDBACK RULES
// ==================================================

// Generate one feedback explanation for every question.

// Feedback should:

// - Explain why the correct answer is correct.
// - Use simple Grade 3 English.
// - Be short.
// - Be friendly and educational.
// - Refer to the idea from the poem.
// - Help the learner understand the answer.

// Do not say:

// "Read line 1."

// "According to line 2."

// "Look at the third line."

// Do not use difficult academic explanations.


// ==================================================
// OUTPUT
// ==================================================

// Return ONLY valid JSON.

// Do not use markdown.

// Do not write explanations before or after the JSON.

// Use exactly this structure:

// {
//   "questions": [
//     {
//       "question_id": 1,
//       "question_text": "",
//       "choices": [
//         "",
//         "",
//         "",
//         ""
//       ],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     }
//   ]
// }
// `;

//     // ==================================================
//     // OPENAI REQUEST
//     // ==================================================

//     console.log("Generating AI poem questions...");

//     const completion =
//       await openai.chat.completions.create({
//         model: "gpt-5-mini",

//         messages: [
//           {
//             role: "system",
//             content: `
// You are an educational reading activity generator.

// Your learners are Grade 3 elementary students.

// Always use simple, child-friendly English.

// Difficulty may change based on the learner's reading path,
// but vocabulary and sentence structure must always remain
// appropriate for Grade 3.

// Return valid JSON only.
// `,
//           },

//           {
//             role: "user",
//             content: prompt,
//           },
//         ],

//         response_format: {
//           type: "json_object",
//         },

//         // temperature: 0.6,
//       });

//     // ==================================================
//     // GET AI RESPONSE
//     // ==================================================

//     const aiText =
//       completion.choices?.[0]?.message?.content;

//     if (!aiText) {
//       throw new Error(
//         "OpenAI returned an empty response."
//       );
//     }

//     console.log("AI RESPONSE RECEIVED");

//     // ==================================================
//     // PARSE JSON
//     // ==================================================

//     let aiData;

//     try {
//       aiData = JSON.parse(aiText);
//     } catch (parseError) {
//       console.error(
//         "AI JSON PARSE ERROR:",
//         aiText
//       );

//       throw new Error(
//         "AI returned invalid JSON."
//       );
//     }

//     // ==================================================
//     // CHECK QUESTIONS ARRAY
//     // ==================================================

//     if (!Array.isArray(aiData.questions)) {
//       throw new Error(
//         "AI response does not contain questions array."
//       );
//     }

//     if (aiData.questions.length !== 5) {
//       throw new Error(
//         `AI returned ${aiData.questions.length} questions instead of 5.`
//       );
//     }

//     // ==================================================
//     // CLEAN / NORMALIZE QUESTIONS
//     // ==================================================

//     const questions = aiData.questions.map(
//       (question, index) => {
//         return {
//           question_id: index + 1,

//           question_text: String(
//             question.question_text || ""
//           ).trim(),

//           choices: Array.isArray(question.choices)
//             ? question.choices.map((choice) =>
//                 String(choice).trim()
//               )
//             : [],

//           correct_answer: String(
//             question.correct_answer || ""
//           ).trim(),

//           correct_choice_index: Array.isArray(question.choices)
//             ? question.choices
//                 .map((choice) => String(choice).trim())
//                 .indexOf(String(question.correct_answer || "").trim())
//             : -1,

//           hint: String(
//             question.hint || ""
//           ).trim(),

//           feedback: String(
//             question.feedback || ""
//           ).trim(),
//         };
//       }
//     );

//     // ==================================================
//     // VALIDATE EACH QUESTION
//     // ==================================================

//     for (const question of questions) {
//       if (!question.question_text) {
//         throw new Error(
//           "AI generated an empty question_text."
//         );
//       }

//       if (
//         !Array.isArray(question.choices) ||
//         question.choices.length !== 4
//       ) {
//         throw new Error(
//           `Question ${question.question_id} does not have exactly 4 choices.`
//         );
//       }

//       if (
//         question.choices.some(
//           (choice) => !choice
//         )
//       ) {
//         throw new Error(
//           `Question ${question.question_id} has an empty choice.`
//         );
//       }

//       if (!question.correct_answer) {
//         throw new Error(
//           `Question ${question.question_id} has no correct_answer.`
//         );
//       }

//       if (
//         !question.choices.includes(
//           question.correct_answer
//         )
//       ) {
//         throw new Error(
//           `Question ${question.question_id}: correct_answer is not included in choices.`
//         );
//       }

//       if (!question.hint) {
//         throw new Error(
//           `Question ${question.question_id} has no hint.`
//         );
//       }

//       if (!question.feedback) {
//         throw new Error(
//           `Question ${question.question_id} has no feedback.`
//         );
//       }
//     }

//     // ==================================================
//     // TERMINAL OUTPUT
//     // ==================================================

//     console.log(
//       `SUCCESS: Generated ${questions.length} questions for ${poem.title}`
//     );

//     console.log("======================================");
//     console.log("AI GENERATED QUESTIONS");
//     console.log("======================================");

//     console.log(
//       JSON.stringify(questions, null, 2)
//     );

//     console.log("======================================");

//     // ==================================================
//     // SUCCESS RESPONSE
//     // ==================================================

//     return res.status(200).json({
//       success: true,

//       ai_generated: true,

//       path: normalizedPath,

//       level: parsedLevel,

//       title: poem.title,

//       poem_text: poem.poem_text,

//       total_questions: questions.length,

//       questions,

//       questionNumber: 1,

//       totalQuestions: questions.length,
//     });

//   } catch (err) {
//     // ==================================================
//     // ERROR
//     // ==================================================

//     console.error(
//       "AI POEM ROUTE ERROR:",
//       err
//     );

//     return res.status(500).json({
//       success: false,

//       message:
//         "Unable to prepare the poem activity.",

//       error: err.message,
//     });
//   }
// });


// router.get("/poems/:path/:level", async (req, res) => {
//   try {
//     // ==================================================
//     // REQUEST PARAMS
//     // ==================================================

//     const { path: readingPath, level } = req.params;

//     const normalizedPath = String(readingPath)
//       .trim()
//       .toLowerCase();

//     const parsedLevel = Number(level);

//     console.log("======================================");
//     console.log("AI POEM REQUEST");
//     console.log("Path:", normalizedPath);
//     console.log("Level:", parsedLevel);
//     console.log("======================================");

//     // ==================================================
//     // VALIDATE READING PATH
//     // ==================================================

//     const allowedPaths = [
//       "foundation",
//       "developing",
//       "advanced",
//     ];

//     if (!allowedPaths.includes(normalizedPath)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid reading path.",
//       });
//     }

//     // ==================================================
//     // VALIDATE LEVEL
//     // ==================================================

//     if (
//       !Number.isInteger(parsedLevel) ||
//       parsedLevel < 1 ||
//       parsedLevel > 15
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Level must be between 1 and 15.",
//       });
//     }

//     // ==================================================
//     // CHOOSE JSON FILE
//     // ==================================================

//     let fileName = "";

//     if (normalizedPath === "foundation") {
//       fileName = "poems_foundation_v2.json";
//     } else if (normalizedPath === "developing") {
//       fileName = "poems_developing_v2.json";
//     } else if (normalizedPath === "advanced") {
//       fileName = "poems_advanced_v2.json";
//     }

//     const filePath = path.join(
//       __dirname,
//       "../questionBanks",
//       fileName
//     );

//     // ==================================================
//     // CHECK FILE
//     // ==================================================

//     if (!fs.existsSync(filePath)) {
//       console.error("FILE NOT FOUND:", filePath);

//       return res.status(404).json({
//         success: false,
//         message: `Poem file not found: ${fileName}`,
//       });
//     }

//     // ==================================================
//     // READ JSON
//     // ==================================================

//     const rawData = fs.readFileSync(
//       filePath,
//       "utf8"
//     );

//     const poems = JSON.parse(rawData);

//     if (!Array.isArray(poems)) {
//       throw new Error(
//         "Poem JSON must contain an array."
//       );
//     }

//     // ==================================================
//     // FIND POEM BY LEVEL
//     // ==================================================

//     const poem = poems.find(
//       (item) => Number(item.level) === parsedLevel
//     );

//     if (!poem) {
//       return res.status(404).json({
//         success: false,
//         message: "Poem level not found.",
//       });
//     }

//     // ==================================================
//     // CHECK POEM DATA
//     // ==================================================

//     if (!poem.title || !poem.poem_text) {
//       throw new Error(
//         "Poem is missing title or poem_text."
//       );
//     }

//     console.log("POEM FOUND:", poem.title);

//     // ==================================================
//     // ADAPTIVE DIFFICULTY BY READING PATH
//     // ==================================================

//     let difficultyInstruction = "";

//     if (normalizedPath === "foundation") {
//       difficultyInstruction = `
// FOUNDATION PATH:

// - Use very simple and direct comprehension questions.
// - Use common Grade 3 vocabulary.
// - Keep sentences short.
// - Make the required inference very simple.
// - Use clear clues from the poem.
// - Avoid complicated figurative language.
// - Keep the choices short and understandable.
// `;
//     }

//     if (normalizedPath === "developing") {
//       difficultyInstruction = `
// DEVELOPING PATH:

// - Use a mix of direct comprehension and reasoning.
// - Ask questions that require simple understanding.
// - Include a simple inference based on the poem.
// - Keep all wording appropriate for Grade 3.
// - Use clear and believable answer choices.
// `;
//     }

//     if (normalizedPath === "advanced") {
//       difficultyInstruction = `
// ADVANCED PATH:

// - Make the thinking slightly more challenging.
// - Include deeper understanding of the poem.
// - Ask for simple conclusions based on context.
// - Keep all language appropriate for Grade 3.
// - Advanced means harder thinking, NOT harder English.
// - Avoid long or complicated questions.
// `;
//     }

//     // ==================================================
//     // FIXED COMPREHENSION SKILLS
//     // ==================================================

//     const poemSkills = [
//       "theme",
//       "supporting_details",
//       "meaning_of_line",
//       "feelings",
//       "inference",
//     ];

//     // ==================================================
//     // AI PROMPT
//     // ==================================================

//     const prompt = `
// You are creating a reading comprehension activity
// for a Grade 3 elementary learner.

// READING PATH:
// ${normalizedPath}

// LEVEL:
// ${parsedLevel}

// POEM TITLE:
// ${poem.title}

// POEM:
// ${poem.poem_text}

// ==================================================
// IMPORTANT AGE RULE
// ==================================================

// The learner is Grade 3.

// EVERYTHING you generate must be understandable
// by a Grade 3 learner.

// This includes:

// - question_text
// - choices
// - correct_answer
// - hint
// - feedback

// Use:

// - short sentences
// - common words
// - simple English
// - clear instructions

// Avoid:

// - advanced vocabulary
// - academic wording
// - long sentences
// - confusing expressions
// - complicated grammar

// ${difficultyInstruction}

// ==================================================
// QUESTION REQUIREMENTS
// ==================================================

// Generate EXACTLY 5 multiple-choice questions.

// Every question must:

// - Be based ONLY on the provided poem.
// - Have exactly 4 choices.
// - Have only ONE correct answer.
// - Have a correct_answer that EXACTLY matches
//   one of the four choices.
// - Have short and readable choices.
// - Be appropriate for Grade 3.
// - Test reading comprehension.
// - Include a skill_type field.

// Do not invent information that is not
// supported by the poem.

// Questions must be objective.

// Do NOT ask for the learner's personal opinion
// or personal feelings.

// BAD:
// "How does the poem make you feel?"

// GOOD:
// "What feeling does the poem show?"

// ==================================================
// FIXED COMPREHENSION SKILL DISTRIBUTION
// ==================================================

// Each question MUST assess ONE specific
// reading comprehension skill.

// Use EXACTLY this order:

// QUESTION 1:
// skill_type: "theme"

// Assess the central theme or main message
// of the poem.

// Example:
// "What is the main message of the poem?"

// QUESTION 2:
// skill_type: "supporting_details"

// Assess the student's understanding of
// an important detail found in the poem.

// Example:
// "What did the child see in the garden?"

// QUESTION 3:
// skill_type: "meaning_of_line"

// Assess the student's understanding of
// a phrase, expression, or idea in the poem.

// Example:
// "What does 'the sky smiled' mean?"

// If the poem has no figurative language,
// ask about the meaning of a simple statement
// or expression actually present in the poem.

// Do NOT invent a line or expression.

// QUESTION 4:
// skill_type: "feelings"

// Assess the feelings, emotions, or mood
// expressed in the poem.

// Example:
// "How does the character feel?"

// The correct answer must be supported
// by the poem.

// QUESTION 5:
// skill_type: "inference"

// Assess the student's ability to make
// a simple conclusion based on the poem.

// Example:
// "What can we understand from the
// character's actions?"

// The answer must be supported by
// the ideas or events in the poem.

// ==================================================
// IMPORTANT SKILL RULES
// ==================================================

// - Generate exactly one question per skill.
// - Follow the required order.
// - Do not repeat skill types.
// - Do not change the skill_type names.
// - Do not assign a question to the wrong skill.
// - The actual question must genuinely assess
//   its assigned comprehension skill.
// - Questions must be answerable from the poem.
// - Never invent events, characters, or details.
// - Do not generate unsupported interpretations.

// If the poem cannot support one or more
// required comprehension skills, return:

// {
//   "questions": [],
//   "error": "Poem cannot support required skill types"
// }

// ==================================================
// CHOICE RULES
// ==================================================

// Each question must have exactly 4 choices.

// Choices should:

// - Be short.
// - Be easy to read.
// - Use Grade 3 vocabulary.
// - Have only one clearly correct answer.
// - Include 3 believable incorrect answers.
// - Be different from one another.

// Do not repeat choices.

// Avoid choices that are almost identical.

// Do not make trick questions.

// ==================================================
// HINT RULES
// ==================================================

// Generate one hint for every question.

// The hint should:

// - Help the learner think.
// - Give a small clue.
// - Use simple Grade 3 language.
// - NOT reveal the correct answer.
// - NOT tell exactly where the answer is found.

// GOOD EXAMPLES:

// "Think about what happens when the day begins."

// "Think about how the person feels."

// "Think about what changed in the poem."

// DO NOT write hints like:

// "Read the first line."

// "Read the second line."

// "Look at line 3."

// "Check the last line."

// "Look at the answer in the poem."

// Never mention line numbers.

// Never directly reveal the correct answer.

// ==================================================
// FEEDBACK RULES
// ==================================================

// Generate one feedback explanation for
// every question.

// Feedback should:

// - Explain why the correct answer is correct.
// - Use simple Grade 3 English.
// - Be short.
// - Be friendly and educational.
// - Refer to the idea from the poem.
// - Help the learner understand the answer.

// Do not say:

// "Read line 1."

// "According to line 2."

// "Look at the third line."

// Do not use difficult academic explanations.

// ==================================================
// OUTPUT
// ==================================================

// Return ONLY valid JSON.

// Do not use markdown.

// Do not write explanations before
// or after the JSON.

// Return exactly 5 question objects.

// Use this structure:

// {
//   "questions": [
//     {
//       "question_id": 1,
//       "skill_type": "theme",
//       "question_text": "",
//       "choices": ["", "", "", ""],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     },
//     {
//       "question_id": 2,
//       "skill_type": "supporting_details",
//       "question_text": "",
//       "choices": ["", "", "", ""],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     },
//     {
//       "question_id": 3,
//       "skill_type": "meaning_of_line",
//       "question_text": "",
//       "choices": ["", "", "", ""],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     },
//     {
//       "question_id": 4,
//       "skill_type": "feelings",
//       "question_text": "",
//       "choices": ["", "", "", ""],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     },
//     {
//       "question_id": 5,
//       "skill_type": "inference",
//       "question_text": "",
//       "choices": ["", "", "", ""],
//       "correct_answer": "",
//       "hint": "",
//       "feedback": ""
//     }
//   ]
// }
// `;

//     // ==================================================
//     // OPENAI REQUEST
//     // ==================================================

//     console.log("Generating AI poem questions...");

//     const completion =
//       await openai.chat.completions.create({
//         model: "gpt-5-mini",

//         messages: [
//           {
//             role: "system",
//             content: `
// You are an educational reading activity generator.

// Your learners are Grade 3 elementary students.

// Always use simple, child-friendly English.

// Difficulty may change based on the learner's
// reading path, but vocabulary and sentence
// structure must remain appropriate for Grade 3.

// Every question must assess its assigned
// comprehension skill.

// Return valid JSON only.
// `,
//           },
//           {
//             role: "user",
//             content: prompt,
//           },
//         ],

//         response_format: {
//           type: "json_object",
//         },
//       });

//     // ==================================================
//     // GET AI RESPONSE
//     // ==================================================

//     const aiText =
//       completion.choices?.[0]?.message?.content;

//     if (!aiText) {
//       throw new Error(
//         "OpenAI returned an empty response."
//       );
//     }

//     console.log("AI RESPONSE RECEIVED");

//     // ==================================================
//     // PARSE JSON
//     // ==================================================

//     let aiData;

//     try {
//       aiData = JSON.parse(aiText);
//     } catch (parseError) {
//       console.error(
//         "AI JSON PARSE ERROR:",
//         aiText
//       );

//       throw new Error(
//         "AI returned invalid JSON."
//       );
//     }

//     // ==================================================
//     // CHECK QUESTIONS ARRAY
//     // ==================================================

//     if (!Array.isArray(aiData.questions)) {
//       throw new Error(
//         "AI response does not contain questions array."
//       );
//     }

//     if (aiData.questions.length !== 5) {
//       throw new Error(
//         aiData.error ||
//         `AI returned ${aiData.questions.length} questions instead of 5.`
//       );
//     }

//     // ==================================================
//     // CLEAN / NORMALIZE QUESTIONS
//     // ==================================================

//     const questions = aiData.questions.map(
//       (question, index) => {
//         const choices = Array.isArray(question.choices)
//           ? question.choices.map((choice) =>
//               String(choice).trim()
//             )
//           : [];

//         const correctAnswer = String(
//           question.correct_answer || ""
//         ).trim();

//         return {
//           question_id: index + 1,

//           // NEW: Comprehension skill classification
//           skill_type: String(
//             question.skill_type || ""
//           ).trim(),

//           question_text: String(
//             question.question_text || ""
//           ).trim(),

//           choices,

//           correct_answer: correctAnswer,

//           correct_choice_index:
//             choices.indexOf(correctAnswer),

//           hint: String(
//             question.hint || ""
//           ).trim(),

//           feedback: String(
//             question.feedback || ""
//           ).trim(),
//         };
//       }
//     );

//     // ==================================================
//     // VALIDATE EACH QUESTION
//     // ==================================================

//     for (const [index, question] of questions.entries()) {

//       // CHECK REQUIRED COMPREHENSION SKILL
//       const expectedSkill = poemSkills[index];

//       if (question.skill_type !== expectedSkill) {
//         throw new Error(
//           `Question ${question.question_id}: Expected skill_type '${expectedSkill}', received '${question.skill_type}'.`
//         );
//       }

//       if (!question.question_text) {
//         throw new Error(
//           "AI generated an empty question_text."
//         );
//       }

//       if (
//         !Array.isArray(question.choices) ||
//         question.choices.length !== 4
//       ) {
//         throw new Error(
//           `Question ${question.question_id} does not have exactly 4 choices.`
//         );
//       }

//       if (
//         question.choices.some(
//           (choice) => !choice
//         )
//       ) {
//         throw new Error(
//           `Question ${question.question_id} has an empty choice.`
//         );
//       }

//       // CHECK DUPLICATE CHOICES
//       const uniqueChoices = new Set(
//         question.choices.map((choice) =>
//           choice.toLowerCase()
//         )
//       );

//       if (uniqueChoices.size !== 4) {
//         throw new Error(
//           `Question ${question.question_id} has duplicate choices.`
//         );
//       }

//       if (!question.correct_answer) {
//         throw new Error(
//           `Question ${question.question_id} has no correct_answer.`
//         );
//       }

//       if (
//         !question.choices.includes(
//           question.correct_answer
//         )
//       ) {
//         throw new Error(
//           `Question ${question.question_id}: correct_answer is not included in choices.`
//         );
//       }

//       if (!question.hint) {
//         throw new Error(
//           `Question ${question.question_id} has no hint.`
//         );
//       }

//       if (!question.feedback) {
//         throw new Error(
//           `Question ${question.question_id} has no feedback.`
//         );
//       }
//     }

//     // ==================================================
//     // TERMINAL OUTPUT
//     // ==================================================

//     console.log(
//       `SUCCESS: Generated ${questions.length} questions for ${poem.title}`
//     );

//     console.log("======================================");
//     console.log("AI GENERATED QUESTIONS WITH SKILLS");
//     console.log("======================================");

//     console.log(
//       JSON.stringify(questions, null, 2)
//     );

//     console.log("======================================");

//     // ==================================================
//     // SUCCESS RESPONSE
//     // ==================================================

//     return res.status(200).json({
//       success: true,

//       ai_generated: true,

//       path: normalizedPath,

//       level: parsedLevel,

//       title: poem.title,

//       poem_text: poem.poem_text,

//       total_questions: questions.length,

//       questions,

//       questionNumber: 1,

//       totalQuestions: questions.length,
//     });

//   } catch (err) {
//     // ==================================================
//     // ERROR
//     // ==================================================

//     console.error(
//       "AI POEM ROUTE ERROR:",
//       err
//     );

//     return res.status(500).json({
//       success: false,

//       message: "Unable to prepare the poem activity.",

//       error: err.message,
//     });
//   }
// });


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
    } else {
      fileName = "poems_advanced_v2.json";
    }

    const filePath = path.join(
      __dirname,
      "../questionBanks",
      fileName
    );

    // ==================================================
    // CHECK FILE
    // ==================================================

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `Poem file not found: ${fileName}`,
      });
    }

    // ==================================================
    // READ POEM JSON
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

    if (!poem.title || !poem.poem_text) {
      throw new Error(
        "Poem is missing title or poem_text."
      );
    }

    console.log("POEM FOUND:", poem.title);

    // ==================================================
    // DIFFICULTY BASED ON READING PATH
    // ==================================================

    let difficultyInstruction = "";

    if (normalizedPath === "foundation") {
      difficultyInstruction = `
FOUNDATION PATH:

- Use very simple and direct questions.
- Use common English words for Grade 3.
- Keep questions and choices short.
- Make vocabulary questions straightforward.
- Make inferences simple and clearly supported.
- Ask cause-and-effect questions only when
  the poem provides a clear relationship.
- Avoid complicated interpretations.
`;
    }

    if (normalizedPath === "developing") {
      difficultyInstruction = `
DEVELOPING PATH:

- Use a mixture of direct comprehension
  and simple reasoning.
- Include vocabulary understanding
  through context clues.
- Ask reasonable inference questions.
- Assess simple cause-and-effect relationships.
- Keep language appropriate for Grade 3.
`;
    }

    if (normalizedPath === "advanced") {
      difficultyInstruction = `
ADVANCED PATH:

- Make the thinking slightly more challenging.
- Require more careful understanding of ideas.
- Include contextual vocabulary questions.
- Include reasonable inferences.
- Include supported cause-and-effect reasoning.
- Keep vocabulary and sentence structure
  appropriate for Grade 3.
- Advanced means harder thinking,
  NOT harder English.
`;
    }

    // ==================================================
    // FIXED COMPREHENSION SKILLS
    // ==================================================

    const requiredSkills = [
      "main_idea",
      "supporting_details",
      "vocabulary_in_context",
      "inference",
      "cause_effect",
    ];

    // ==================================================
    // AI PROMPT
    // ==================================================

    const prompt = `
You are creating a reading comprehension
activity for a Grade 3 elementary learner.

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

All generated content must be understandable
by a Grade 3 learner.

This includes:

- question_text
- choices
- correct_answer
- hint
- feedback

Use:
- Simple English
- Short sentences
- Common words
- Clear instructions
- Age-appropriate explanations

Avoid:
- Difficult vocabulary
- Academic language
- Long sentences
- Confusing questions
- Complicated grammar

${difficultyInstruction}

==================================================
QUESTION REQUIREMENTS
==================================================

Generate EXACTLY FIVE multiple-choice questions.

Each question must:

- Be based ONLY on the given poem.
- Have exactly FOUR answer choices.
- Have exactly ONE correct answer.
- Include THREE believable distractors.
- Include a skill_type.
- Include a hint.
- Include feedback.
- Be appropriate for Grade 3.

The correct_answer MUST exactly match
one of the choices.

Do not invent information or events.

Do not ask personal opinion questions.

==================================================
FIXED COMPREHENSION SKILL DISTRIBUTION
==================================================

There must be exactly ONE question
for each required comprehension skill.

Follow this exact order:

--------------------------------------------------
QUESTION 1: MAIN IDEA
--------------------------------------------------

skill_type: "main_idea"

PURPOSE:
Understand the overall topic or message.

Generate a question that asks the learner
to identify what the whole poem is mainly about.

The answer should represent the overall idea,
not just one small detail.

Example question:
"What is the poem mostly about?"

Do not confuse the main idea with
a single supporting detail.

--------------------------------------------------
QUESTION 2: SUPPORTING DETAILS
--------------------------------------------------

skill_type: "supporting_details"

PURPOSE:
Identify facts or details stated in the poem.

Generate a question about an important
detail that is directly mentioned.

Possible question types:

- Who?
- What?
- Where?
- What happened?

Example:
"What does the cat play with?"

The correct answer must be directly
supported by the poem.

--------------------------------------------------
QUESTION 3: VOCABULARY IN CONTEXT
--------------------------------------------------

skill_type: "vocabulary_in_context"

PURPOSE:
Understand a word based on its use
in the poem.

Choose ONE actual word from the poem.

Ask what that word means based on
the surrounding words or situation.

Example:
"What does the word 'tiny' mean
in the poem?"

Correct answer:
"Very small"

IMPORTANT:

- Use an actual word from the poem.
- Do not invent a vocabulary word.
- Use context clues from the poem.
- Avoid meanings unrelated to the poem.
- Keep the answer choices short.
- Make sure the context helps explain
  the correct meaning.

--------------------------------------------------
QUESTION 4: INFERENCE
--------------------------------------------------

skill_type: "inference"

PURPOSE:
Draw a reasonable conclusion from the poem.

Generate a question that asks the learner
to understand something that is NOT
directly stated but can be reasonably
concluded from clues in the poem.

Example:

Poem information:
A cat plays all day and sleeps at night.

Question:
"Why might the cat be ready to sleep?"

Correct answer:
"It is tired from playing."

IMPORTANT:

- The inference must be supported by the poem.
- It must go beyond simply repeating a line.
- It must not rely on unsupported guesses.
- Avoid questions that are only direct recall.
- Make the inference simple enough for Grade 3.

--------------------------------------------------
QUESTION 5: CAUSE AND EFFECT
--------------------------------------------------

skill_type: "cause_effect"

PURPOSE:
Understand why something happens
or what results from an action.

Generate a question about a clear
cause-and-effect relationship
within the poem.

Possible questions:

- "Why did something happen?"
- "What happened because of an action?"
- "What caused the event?"

IMPORTANT:

- The cause and effect must be supported
  by the poem.
- Do not invent an event or explanation.
- Do not assume an unrelated cause.
- Distinguish a causal relationship
  from a simple sequence of events.
- Keep the relationship understandable
  for a Grade 3 learner.


IMPORTANT CAUSE-AND-EFFECT VALIDATION:

A sequence of events is NOT automatically
a cause-and-effect relationship.

Do not assume that because Event B happened
after Event A, Event A caused Event B.

The poem must provide enough evidence
to support the causal relationship.

Do not create a cause-and-effect question
if the poem only describes unrelated
or sequential events.

The cause-and-effect question must assess
a different understanding from the
inference question.

If no supported cause-and-effect relationship
exists in the poem, do not invent one.
Return the specified unsupported-skill error.


==================================================
IMPORTANT SKILL ACCURACY RULES
==================================================

Each question MUST genuinely assess
its assigned comprehension skill.

Do not just attach a skill_type label
to an unrelated question.

Required skill order:

1. main_idea
2. supporting_details
3. vocabulary_in_context
4. inference
5. cause_effect

Do not change these labels.

Do not repeat a skill.

Do not reorder the questions.

Do not invent content to force a skill
that the poem cannot support.

If any required skill cannot be assessed
from the given poem, return this JSON:

{
  "questions": [],
  "error": "Poem cannot support required skill types"
}

==================================================
CHOICE RULES
==================================================

Every question must have exactly FOUR choices.

Choices must:

- Be short and clear.
- Use Grade 3 language.
- Have ONE clearly correct answer.
- Include THREE believable wrong answers.
- Be meaningfully different.

Do not include duplicate choices.

Do not make trick questions.

Do not include more than one
reasonable correct answer.

==================================================
HINT RULES
==================================================

Generate ONE hint per question.

Hints must:

- Help the student think.
- Use simple English.
- Give useful guidance.
- Never directly reveal the answer.

Do not say:

"Look at line 1."
"Read the third line."
"The correct answer is..."
"Choose option A."

Never mention line numbers.

==================================================
FEEDBACK RULES
==================================================

Generate ONE feedback explanation
for each question.

Feedback must:

- Explain why the answer is correct.
- Use simple Grade 3 English.
- Be friendly.
- Be short and clear.
- Connect the explanation to the poem.

Do not mention line numbers.

Do not use complicated terminology.

==================================================
OUTPUT FORMAT
==================================================

Return ONLY a valid JSON object.

Do not use markdown.

Do not write explanations outside JSON.

Return exactly FIVE questions.

Each question must include:

- question_id
- skill_type
- question_text
- choices
- correct_answer
- hint
- feedback

Use this JSON structure:

{
  "questions": [
    {
      "question_id": 1,
      "skill_type": "main_idea",
      "question_text": "",
      "choices": ["", "", "", ""],
      "correct_answer": "",
      "hint": "",
      "feedback": ""
    },
    {
      "question_id": 2,
      "skill_type": "supporting_details",
      "question_text": "",
      "choices": ["", "", "", ""],
      "correct_answer": "",
      "hint": "",
      "feedback": ""
    },
    {
      "question_id": 3,
      "skill_type": "vocabulary_in_context",
      "question_text": "",
      "choices": ["", "", "", ""],
      "correct_answer": "",
      "hint": "",
      "feedback": ""
    },
    {
      "question_id": 4,
      "skill_type": "inference",
      "question_text": "",
      "choices": ["", "", "", ""],
      "correct_answer": "",
      "hint": "",
      "feedback": ""
    },
    {
      "question_id": 5,
      "skill_type": "cause_effect",
      "question_text": "",
      "choices": ["", "", "", ""],
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
        model: "gpt-5-mini",

        messages: [
          {
            role: "system",
            content: `
You are an educational reading activity generator.

Your learners are Grade 3 elementary students.

Use simple, child-friendly English.

Generate questions that genuinely assess
their assigned comprehension skills.

Base every answer only on the given poem.

Do not invent unsupported information.

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
    // PARSE AI JSON
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
    // VALIDATE QUESTIONS ARRAY
    // ==================================================

    if (!Array.isArray(aiData.questions)) {
      throw new Error(
        "AI response does not contain questions array."
      );
    }

    if (aiData.questions.length !== 5) {
      throw new Error(
        aiData.error ||
        `AI returned ${aiData.questions.length} questions instead of 5.`
      );
    }

    // ==================================================
    // NORMALIZE QUESTIONS
    // ==================================================

    const questions = aiData.questions.map(
      (question, index) => {

        const choices = Array.isArray(question.choices)
          ? question.choices.map((choice) =>
              String(choice).trim()
            )
          : [];

          for (let i = choices.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));

  [choices[i], choices[j]] = [choices[j], choices[i]];
}

        const correctAnswer = String(
          question.correct_answer || ""
        ).trim();

        return {
          question_id: index + 1,

          skill_type: String(
            question.skill_type || ""
          ).trim(),

          question_text: String(
            question.question_text || ""
          ).trim(),

          choices,

          correct_answer: correctAnswer,

          correct_choice_index:
            choices.indexOf(correctAnswer),

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

    for (const [index, question] of questions.entries()) {

      const expectedSkill = requiredSkills[index];

      // VALIDATE SKILL TYPE
      if (question.skill_type !== expectedSkill) {
        throw new Error(
          `Question ${question.question_id}: Expected '${expectedSkill}', received '${question.skill_type}'.`
        );
      }

      // VALIDATE QUESTION TEXT
      if (!question.question_text) {
        throw new Error(
          `Question ${question.question_id} has no question_text.`
        );
      }

      // VALIDATE CHOICES
      if (
        !Array.isArray(question.choices) ||
        question.choices.length !== 4
      ) {
        throw new Error(
          `Question ${question.question_id} must have exactly 4 choices.`
        );
      }

      if (
        question.choices.some((choice) => !choice)
      ) {
        throw new Error(
          `Question ${question.question_id} has an empty choice.`
        );
      }

      // CHECK DUPLICATE CHOICES
      const uniqueChoices = new Set(
        question.choices.map((choice) =>
          choice.toLowerCase()
        )
      );

      if (uniqueChoices.size !== 4) {
        throw new Error(
          `Question ${question.question_id} has duplicate choices.`
        );
      }

      // VALIDATE CORRECT ANSWER
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

      // VALIDATE HINT
      if (!question.hint) {
        throw new Error(
          `Question ${question.question_id} has no hint.`
        );
      }

      // VALIDATE FEEDBACK
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
    console.log("AI GENERATED QUESTIONS WITH SKILLS");
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
    // ERROR HANDLING
    // ==================================================

    console.error(
      "AI POEM ROUTE ERROR:",
      err
    );

    return res.status(500).json({
      success: false,

      message: "Unable to prepare the poem activity.",

      error: err.message,
    });
  }
});

router.get(
  "/progress/pattern",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const activityType = String(
        req.query.activity_type || ""
      ).trim().toLowerCase();

      const level = Number(req.query.level);

      if (
        !activityType ||
        !Number.isInteger(level) ||
        level < 3 ||
        level > 15 ||
        level % 3 !== 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid activity or checkpoint level."
        });
      }

      const userResult = await pool.query(
        "SELECT reading_path FROM users WHERE id = $1",
        [userId]
      );

      if (!userResult.rows.length) {
        return res.status(404).json({
          success: false,
          message: "User not found."
        });
      }

      const readingPath = userResult.rows[0].reading_path;

      const result = await pool.query(
        `
        SELECT level, score
        FROM user_progress
        WHERE user_id = $1
          AND activity_type = $2
          AND reading_path = $3
          AND level BETWEEN $4 AND $5
          AND completed = TRUE
        ORDER BY level ASC
        `,
        [
          userId,
          activityType,
          readingPath,
          level - 2,
          level
        ]
      );

      const scores = result.rows;

      if (
        scores.length !== 3 ||
        scores.some(
          (row, i) => Number(row.level) !== level - 2 + i
        )
      ) {
        return res.json({
          success: true,
          ready: false,
          message: "Complete three levels first."
        });
      }

      const minimumPassCount = scores.filter(
        row => Number(row.score) === 3
      ).length;

      const hasPattern = minimumPassCount >= 2;

      return res.json({
        success: true,
        ready: true,
        activity_type: activityType,
        review_level: level,
        scores,
        minimum_pass_count: minimumPassCount,
        has_pattern: hasPattern,
        pattern_type: hasPattern
          ? "recurring_comprehension_difficulty"
          : "no_recurring_difficulty"
      });

    } catch (err) {
      console.error("PATTERN ERROR:", err);

      return res.status(500).json({
        success: false,
        message: "Server error."
      });
    }
  }
);


 // ======================================================
 // SAVE FIRST-ATTEMPT READING COMPREHENSION SKILLS
 // Shared by Poems, Short Stories, Informational Texts
 // ======================================================

// router.post(
//   "/reading-skills/save",
//   requireAuth,
//   async (req, res) => {
//     try {
//       console.log("ENTERED /reading-skills/save");

//       const userId = req.user.id;

//       const {
//         activity_type,
//         level,
//         skill_results
//       } = req.body || {};

//       // ==========================================
//       // VALIDATE ACTIVITY TYPE
//       // ==========================================

//       const activityType = String(
//         activity_type || ""
//       ).trim().toLowerCase();

//       console.log("DEBUG ACTIVITY TYPE:", activityType);
//       console.log("DEBUG REQUEST URL:", req.originalUrl);
//       console.log("DEBUG REQUEST BODY:", req.body);

//       const allowedActivities = [
//         "poems",
//         "short_stories",
//         "informational_texts"
//       ];

//       if (!allowedActivities.includes(activityType)) {
//         return res.status(400).json({
//           success: false,
//           saved: false,
//           message: "Invalid reading activity type."
//         });
//       }

//       // ==========================================
//       // VALIDATE LEVEL
//       // ==========================================

//       const parsedLevel = Number(level);

//       if (
//         !Number.isInteger(parsedLevel) ||
//         parsedLevel < 1 ||
//         parsedLevel > 15
//       ) {
//         return res.status(400).json({
//           success: false,
//           saved: false,
//           message: "Level must be between 1 and 15."
//         });
//       }

//       // ==========================================
//       // REQUIRED COMPREHENSION SKILLS
//       // ==========================================

//       const requiredSkills = [
//         "main_idea",
//         "supporting_details",
//         "vocabulary_in_context",
//         "inference",
//         "cause_effect"
//       ];

//       // Same five skills for all Reading activities.
//       // Question-generation routes must use
//       // these exact skill_type values.

//       if (
//         !skill_results ||
//         typeof skill_results !== "object" ||
//         Array.isArray(skill_results)
//       ) {
//         return res.status(400).json({
//           success: false,
//           saved: false,
//           message: "skill_results must be an object."
//         });
//       }

//       const receivedSkills = Object.keys(
//         skill_results
//       );

//       const validSkills =
//         receivedSkills.length === requiredSkills.length &&
//         requiredSkills.every(
//           (skill) =>
//             Object.prototype.hasOwnProperty.call(
//               skill_results,
//               skill
//             ) &&
//             typeof skill_results[skill] === "boolean"
//         );

//       if (!validSkills) {
//         return res.status(400).json({
//           success: false,
//           saved: false,
//           message:
//             "Invalid or incomplete comprehension skill results."
//         });
//       }

//       // ==========================================
//       // GET READING PATH FROM LOGGED-IN USER
//       // ==========================================

//       const userResult = await pool.query(
//         `
//         SELECT reading_path
//         FROM users
//         WHERE id = $1
//         LIMIT 1
//         `,
//         [userId]
//       );

//       if (userResult.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           saved: false,
//           message: "User not found."
//         });
//       }

//       const readingPath = String(
//         userResult.rows[0].reading_path || ""
//       ).trim().toLowerCase();

//       const allowedPaths = [
//         "foundation",
//         "developing",
//         "advanced"
//       ];

//       if (!allowedPaths.includes(readingPath)) {
//         return res.status(400).json({
//           success: false,
//           saved: false,
//           message: "Student has no valid reading path."
//         });
//       }

//       // ==========================================
//       // SAVE FIRST ATTEMPT ONLY
//       // ==========================================

//       const insertResult = await pool.query(
//         `
//         INSERT INTO reading_skill_history (
//           user_id,
//           activity_type,
//           reading_path,
//           level,
//           skill_results
//         )
//         VALUES ($1, $2, $3, $4, $5::jsonb)

//         ON CONFLICT (
//           user_id,
//           activity_type,
//           reading_path,
//           level
//         )
//         DO NOTHING

//         RETURNING
//           id,
//           user_id,
//           activity_type,
//           reading_path,
//           level,
//           skill_results,
//           created_at
//         `,
//         [
//           userId,
//           activityType,
//           readingPath,
//           parsedLevel,
//           JSON.stringify(skill_results)
//         ]
//       );

//       // ==========================================
//       // EXISTING FIRST ATTEMPT
//       // ==========================================

//       if (insertResult.rows.length === 0) {
//         console.log(
//           "FIRST ATTEMPT ALREADY RECORDED"
//         );

//         return res.status(200).json({
//           success: true,
//           saved: false,
//           already_recorded: true,
//           message:
//             "First-attempt results already exist. Original results were preserved."
//         });
//       }

//       // ==========================================
//       // FIRST ATTEMPT SAVED
//       // ==========================================

//       console.log(
//         "READING SKILL HISTORY SAVED:",
//         insertResult.rows[0]
//       );

//       return res.status(201).json({
//         success: true,
//         saved: true,
//         already_recorded: false,
//         message:
//           "First-attempt reading skill results saved successfully.",
//         history: insertResult.rows[0]
//       });

//     } catch (err) {
//       console.error(
//         "SAVE READING SKILLS ERROR:",
//         err
//       );

//       return res.status(500).json({
//         success: false,
//         saved: false,
//         message:
//           "Unable to save reading skill results."
//       });
//     }
//   }
// );
// router.get(
//   "/reading-skills/pattern",
//   requireAuth,
//   async (req, res) => {
//     try {
//       const userId = req.user.id;

//       const activityType = String(
//         req.query.activity_type || ""
//       ).trim().toLowerCase();

//       const reviewLevel = Number(req.query.level);

//       const allowedActivities = [
//         "poems",
//         "short_stories",
//         "informational_texts"
//       ];

//       const checkpointLevels = [3, 6, 9, 12, 15];

//       const requiredSkills = [
//         "main_idea",
//         "supporting_details",
//         "vocabulary_in_context",
//         "inference",
//         "cause_effect"
//       ];

//       if (!allowedActivities.includes(activityType)) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid reading activity type."
//         });
//       }

//       if (!checkpointLevels.includes(reviewLevel)) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Pattern review is available only at levels 3, 6, 9, 12, and 15."
//         });
//       }

//       const userResult = await pool.query(
//         `
//         SELECT reading_path
//         FROM users
//         WHERE id = $1
//         LIMIT 1
//         `,
//         [userId]
//       );

//       if (userResult.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: "User not found."
//         });
//       }

//       const readingPath = String(
//         userResult.rows[0].reading_path || ""
//       ).trim().toLowerCase();

//       if (
//         !["foundation", "developing", "advanced"]
//           .includes(readingPath)
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid student reading path."
//         });
//       }

//       const startLevel = reviewLevel - 2;

//       const historyResult = await pool.query(
//         `
//         SELECT level, skill_results
//         FROM reading_skill_history
//         WHERE user_id = $1
//           AND activity_type = $2
//           AND LOWER(reading_path) = $3
//           AND level BETWEEN $4 AND $5
//         ORDER BY level ASC
//         `,
//         [
//           userId,
//           activityType,
//           readingPath,
//           startLevel,
//           reviewLevel
//         ]
//       );

//       const history = historyResult.rows;

//       const expectedLevels = [
//         startLevel,
//         startLevel + 1,
//         reviewLevel
//       ];

//       const actualLevels = history.map(
//         (record) => Number(record.level)
//       );

//       const missingLevels = expectedLevels.filter(
//         (level) => !actualLevels.includes(level)
//       );

//       if (missingLevels.length > 0) {
//         return res.status(200).json({
//           success: true,
//           ready: false,
//           has_pattern: false,
//           activity_type: activityType,
//           review_level: reviewLevel,
//           levels_analyzed: actualLevels,
//           missing_levels: missingLevels,
//           message:
//             "Not enough first-attempt records to analyze recurring misunderstandings."
//         });
//       }

//       const skillLabels = {
//         main_idea: "Main Idea",
//         supporting_details: "Supporting Details",
//         vocabulary_in_context: "Vocabulary in Context",
//         inference: "Making Inferences",
//         cause_effect: "Cause and Effect"
//       };

//       const skillAdvice = {
//         main_idea:
//           "Think about what the whole reading is mostly about.",
//         supporting_details:
//           "Look for important facts and details in the reading.",
//         vocabulary_in_context:
//           "Use the words around a new word to understand its meaning.",
//         inference:
//           "Use clues from the reading to make a smart guess.",
//         cause_effect:
//           "Think about why something happened and what happened next."
//       };

//       const skillAnalysis = requiredSkills.map(
//         (skill) => {
//           const incorrectLevels = history
//             .filter(
//               (record) =>
//                 record.skill_results?.[skill] === false
//             )
//             .map((record) => Number(record.level));

//           return {
//             skill_type: skill,
//             skill_name: skillLabels[skill],
//             incorrect_count: incorrectLevels.length,
//             total_levels: 3,
//             incorrect_levels: incorrectLevels,
//             recurring: incorrectLevels.length >= 2,
//             recommendation: skillAdvice[skill]
//           };
//         }
//       );

//       // If a record is incomplete, do not
//       // treat missing values as correct.
//       const incompleteHistory = history.some(
//         (record) =>
//           requiredSkills.some(
//             (skill) =>
//               typeof record.skill_results?.[skill] !==
//               "boolean"
//           )
//       );

//       if (incompleteHistory) {
//         return res.status(422).json({
//           success: false,
//           ready: false,
//           message:
//             "Some skill history records are incomplete."
//         });
//       }

//       const patterns = skillAnalysis
//         .filter((skill) => skill.recurring)
//         .sort(
//           (a, b) =>
//             b.incorrect_count - a.incorrect_count
//         );

//       const hasPattern = patterns.length > 0;

//       const primaryPattern = patterns[0] || null;

//       const feedback = hasPattern
//         ? `Let's practice ${primaryPattern.skill_name}! ${primaryPattern.recommendation}`
//         : "Great work! No recurring difficulty was detected in these three levels. Keep practicing!";

//       return res.status(200).json({
//         success: true,
//         ready: true,
//         activity_type: activityType,
//         reading_path: readingPath,
//         review_level: reviewLevel,
//         levels_analyzed: expectedLevels,
//         has_pattern: hasPattern,
//         pattern_count: patterns.length,
//         primary_pattern: primaryPattern,
//         patterns: patterns,
//         skill_analysis: skillAnalysis,
//         feedback: feedback
//       });

//     } catch (err) {
//       console.error(
//         "READING PATTERN ERROR:",
//         err
//       );

//       return res.status(500).json({
//         success: false,
//         ready: false,
//         message:
//           "Unable to analyze reading misunderstanding patterns."
//       });
//     }
//   }
// );
// router.get(
//   "/reading-skills/pattern",
//   requireAuth,
//   async (req, res) => {
//     try {
//       // ==================================================
//       // AUTHENTICATED STUDENT
//       // ==================================================

//       const userId = req.user.id;

//       const activityType = String(
//         req.query.activity_type || ""
//       ).trim().toLowerCase();

//       const reviewLevel = Number(req.query.level);

//       // ==================================================
//       // CONFIGURATION
//       // ==================================================

//       const allowedActivities = [
//         "poems",
//         "short_stories",
//         "informational_texts"
//       ];

//       const checkpointLevels = [3, 6, 9, 12, 15];

//       const requiredSkills = [
//         "main_idea",
//         "supporting_details",
//         "vocabulary_in_context",
//         "inference",
//         "cause_effect"
//       ];

//       const skillLabels = {
//         main_idea: "Main Idea",
//         supporting_details: "Supporting Details",
//         vocabulary_in_context: "Vocabulary in Context",
//         inference: "Making Inferences",
//         cause_effect: "Cause and Effect"
//       };

//       const skillAdvice = {
//         main_idea:
//           "Think about what the whole reading is mostly about.",

//         supporting_details:
//           "Look for important facts and details in the reading.",

//         vocabulary_in_context:
//           "Use nearby words and sentences to understand unfamiliar words.",

//         inference:
//           "Use clues from the reading to make a reasonable guess.",

//         cause_effect:
//           "Think about why something happened and what happened because of it."
//       };

//       // ==================================================
//       // VALIDATE ACTIVITY TYPE
//       // ==================================================

//       if (!allowedActivities.includes(activityType)) {
//         return res.status(400).json({
//           success: false,
//           ready: false,
//           message: "Invalid reading activity type."
//         });
//       }

//       // ==================================================
//       // VALIDATE CHECKPOINT LEVEL
//       // ==================================================

//       if (!checkpointLevels.includes(reviewLevel)) {
//         return res.status(400).json({
//           success: false,
//           ready: false,
//           message:
//             "Pattern review is available only at levels 3, 6, 9, 12, and 15."
//         });
//       }

//       // ==================================================
//       // GET STUDENT READING PATH
//       // ==================================================

//       const userResult = await pool.query(
//         `
//         SELECT reading_path
//         FROM users
//         WHERE id = $1
//         LIMIT 1
//         `,
//         [userId]
//       );

//       if (userResult.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           ready: false,
//           message: "User not found."
//         });
//       }

//       const readingPath = String(
//         userResult.rows[0].reading_path || ""
//       ).trim().toLowerCase();

//       if (
//         !["foundation", "developing", "advanced"]
//           .includes(readingPath)
//       ) {
//         return res.status(400).json({
//           success: false,
//           ready: false,
//           message: "Invalid student reading path."
//         });
//       }

//       // ==================================================
//       // DETERMINE THREE-LEVEL WINDOW
//       // ==================================================

//       const startLevel = reviewLevel - 2;

//       const expectedLevels = [
//         startLevel,
//         startLevel + 1,
//         reviewLevel
//       ];

//       // ==================================================
//       // FETCH FIRST-ATTEMPT HISTORY
//       // ==================================================

//       const historyResult = await pool.query(
//         `
//         SELECT level, skill_results
//         FROM reading_skill_history
//         WHERE user_id = $1
//           AND activity_type = $2
//           AND LOWER(reading_path) = $3
//           AND level BETWEEN $4 AND $5
//         ORDER BY level ASC
//         `,
//         [
//           userId,
//           activityType,
//           readingPath,
//           startLevel,
//           reviewLevel
//         ]
//       );

//       const history = historyResult.rows;

//       const actualLevels = history.map(
//         (record) => Number(record.level)
//       );

//       const missingLevels = expectedLevels.filter(
//         (level) => !actualLevels.includes(level)
//       );

//       // ==================================================
//       // INCOMPLETE HISTORY
//       // ==================================================

//       if (missingLevels.length > 0) {
//         return res.status(200).json({
//           success: true,
//           ready: false,
//           has_pattern: false,
//           activity_type: activityType,
//           reading_path: readingPath,
//           review_level: reviewLevel,
//           levels_analyzed: actualLevels,
//           missing_levels: missingLevels,
//           feedback: "",
//           recommendation: "",
//           ai_generated: false,
//           message:
//             "Not enough first-attempt records to analyze recurring misunderstandings."
//         });
//       }

//       // ==================================================
//       // VALIDATE STORED SKILL RESULTS
//       // ==================================================

//       const incompleteHistory = history.some(
//         (record) =>
//           requiredSkills.some(
//             (skill) =>
//               typeof record.skill_results?.[skill] !==
//               "boolean"
//           )
//       );

//       if (incompleteHistory) {
//         return res.status(422).json({
//           success: false,
//           ready: false,
//           message:
//             "Some skill history records are incomplete."
//         });
//       }

//       // ==================================================
//       // ANALYZE EACH COMPREHENSION SKILL
//       // ==================================================

//       const skillAnalysis = requiredSkills.map(
//         (skill) => {

//           const incorrectLevels = history
//             .filter(
//               (record) =>
//                 record.skill_results[skill] === false
//             )
//             .map(
//               (record) => Number(record.level)
//             );

//           return {
//             skill_type: skill,
//             skill_name: skillLabels[skill],
//             incorrect_count: incorrectLevels.length,
//             total_levels: 3,
//             incorrect_levels: incorrectLevels,
//             recurring: incorrectLevels.length >= 2,
//             recommendation: skillAdvice[skill]
//           };
//         }
//       );

//       // ==================================================
//       // DETECT RECURRING PATTERNS
//       // ==================================================

//       const patterns = skillAnalysis
//         .filter((skill) => skill.recurring)
//         .sort(
//           (a, b) =>
//             b.incorrect_count - a.incorrect_count
//         );

//       const hasPattern = patterns.length > 0;

//       const primaryPattern = patterns[0] || null;

//       // ==================================================
//       // DEFAULT FEEDBACK (FALLBACK)
//       // ==================================================

//       let feedback = hasPattern
//         ? `Let's keep practicing! Some reading skills need a little more attention.`
//         : "Great work! No recurring difficulty was detected in these three levels.";

//       let recommendation = hasPattern
//         ? patterns
//             .map(
//               (pattern) =>
//                 `${pattern.skill_name}: ${pattern.recommendation}`
//             )
//             .join(" ")
//         : "Keep reading, learning new words, and practicing your reading skills!";

//       let aiGenerated = false;

//       // ==================================================
//       // GENERATE PERSONALIZED AI FEEDBACK
//       // ==================================================

//       try {
//         const activityLabels = {
//           poems: "poems",
//           short_stories: "short stories",
//           informational_texts: "informational texts"
//         };

//         const detectedPatterns = patterns.map(
//           (pattern) => ({
//             skill_type: pattern.skill_type,
//             skill_name: pattern.skill_name,
//             incorrect_count: pattern.incorrect_count,
//             total_levels: 3
//           })
//         );

//         const aiPrompt = `
// You are a friendly reading tutor for Grade 3 learners.

// Generate personalized reading feedback based
// ONLY on the comprehension skill analysis provided.

// READING ACTIVITY:
// ${activityLabels[activityType]}

// READING PATH:
// ${readingPath}

// LEVELS ANALYZED:
// ${expectedLevels.join(", ")}

// RECURRING DIFFICULTIES:
// ${JSON.stringify(detectedPatterns)}

// HAS RECURRING PATTERN:
// ${hasPattern}

// ==================================================
// IMPORTANT RULES
// ==================================================

// The student is in Grade 3.

// Use simple, friendly, encouraging English.

// Do not use difficult academic words.

// Do not shame or discourage the student.

// Do not say the student is bad at reading.

// Do not claim the student has a permanent weakness.

// Do not invent mistakes, scores, or learning results.

// Do not mention skills that were not identified
// as recurring difficulties.

// If multiple recurring skills are detected,
// address ALL detected skills.

// Do not use the exact phrase
// "misunderstanding pattern" in student feedback.

// Do not mention numerical scores such as
// "2 out of 3" in the student-facing message.

// Only recommend strategies that students can
// perform using the provided reading text.

// Do not mention pictures, illustrations,
// audio, or other materials unless they
// are actually available in the activity.

// For poems, focus on words, lines, events,
// and feelings expressed in the poem.

// For short stories, focus on characters,
// events, actions, and details in the story.

// For informational texts, focus on facts,
// explanations, and important information.

// Keep every recommendation practical,
// specific, and appropriate for Grade 3 learners.

// If NO recurring difficulty was detected,
// provide positive encouragement and a
// general reading practice recommendation.

// ==================================================
// FEEDBACK REQUIREMENTS
// ==================================================

// Generate:

// 1. feedback
// - 1 or 2 short sentences.
// - Friendly and encouraging.
// - Explain which reading skills need practice.
// - If no recurring difficulties exist,
//   congratulate the learner.

// 2. recommendation
// - 2 to 4 short sentences.
// - Provide specific, actionable reading tips.
// - Address every detected recurring skill.
// - Use Grade 3 language.
// - Keep the advice suitable for the activity.

// Examples of suitable learning tips:

// Main Idea:
// Think about what the whole reading is mostly about.

// Supporting Details:
// Look for important facts in the reading.

// Vocabulary in Context:
// Use nearby words to understand a new word.

// Making Inferences:
// Use clues to make a smart guess.

// Cause and Effect:
// Think about why something happened.

// ==================================================
// OUTPUT FORMAT
// ==================================================

// Return ONLY valid JSON.

// Use exactly this structure:

// {
//   "feedback": "",
//   "recommendation": ""
// }
// `;

//         const completion =
//           await openai.chat.completions.create({
//             model: "gpt-5-mini",

//             messages: [
//               {
//                 role: "system",
//                 content:
//                   "You are a Grade 3 reading tutor. Return valid JSON only."
//               },
//               {
//                 role: "user",
//                 content: aiPrompt
//               }
//             ],

//             response_format: {
//               type: "json_object"
//             }
//           });

//         const aiText =
//           completion.choices?.[0]?.message?.content;

//         if (!aiText) {
//           throw new Error(
//             "OpenAI returned empty feedback."
//           );
//         }

//         const aiResponse = JSON.parse(aiText);

//         const generatedFeedback =
//           String(aiResponse.feedback || "").trim();

//         const generatedRecommendation =
//           String(aiResponse.recommendation || "").trim();

//         // Only use the AI response if BOTH fields exist.
//         if (
//           !generatedFeedback ||
//           !generatedRecommendation
//         ) {
//           throw new Error(
//             "AI feedback response is incomplete."
//           );
//         }

//         feedback = generatedFeedback;
//         recommendation = generatedRecommendation;
//         aiGenerated = true;

//         console.log(
//           "AI PATTERN FEEDBACK GENERATED:",
//           {
//             feedback,
//             recommendation
//           }
//         );

//       } catch (aiError) {
//         // Keep the fallback feedback.
//         console.error(
//           "AI FEEDBACK GENERATION ERROR:",
//           aiError.message
//         );
//       }

//       // ==================================================
//       // SUCCESS RESPONSE
//       // ==================================================

//       return res.status(200).json({
//         success: true,
//         ready: true,

//         activity_type: activityType,
//         reading_path: readingPath,

//         review_level: reviewLevel,
//         levels_analyzed: expectedLevels,

//         has_pattern: hasPattern,
//         pattern_count: patterns.length,

//         primary_pattern: primaryPattern,
//         patterns: patterns,
//         skill_analysis: skillAnalysis,

//         ai_generated: aiGenerated,

//         feedback: feedback,
//         recommendation: recommendation
//       });

//     } catch (err) {
//       // ==================================================
//       // ERROR HANDLING
//       // ==================================================

//       console.error(
//         "READING PATTERN ERROR:",
//         err
//       );

//       return res.status(500).json({
//         success: false,
//         ready: false,
//         message:
//           "Unable to analyze reading misunderstanding patterns."
//       });
//     }
//   }
// );

export default router;