import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";

import multer from "multer";
import os from "os";
import { randomUUID } from "crypto";
import { promises as fsp } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

import OpenAI from "openai";

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const execFileAsync = promisify(execFile);

async function convertAudioToWav(
  buffer,
  originalName = "recording.m4a"
) {
  const id = randomUUID();

  const originalExtension =
    path.extname(originalName) || ".m4a";

  const inputPath = path.join(
    os.tmpdir(),
    `${id}${originalExtension}`
  );

  const outputPath = path.join(
    os.tmpdir(),
    `${id}.wav`
  );

  try {
    await fsp.writeFile(
      inputPath,
      buffer
    );

    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        outputPath,
      ]
    );

    const wavBuffer =
      await fsp.readFile(
        outputPath
      );

    return wavBuffer;
  } finally {
    await Promise.allSettled([
      fsp.unlink(inputPath),
      fsp.unlink(outputPath),
    ]);
  }
}

function detectMeaningfulSpeech(
  wavBuffer
) {
  try {
    if (
      !Buffer.isBuffer(wavBuffer) ||
      wavBuffer.length < 44
    ) {
      return {
        hasSpeech: false,
      };
    }

    let offset = 12;
    let dataOffset = null;
    let dataSize = null;

    while (
      offset + 8 <= wavBuffer.length
    ) {
      const chunkId =
        wavBuffer.toString(
          "ascii",
          offset,
          offset + 4
        );

      const chunkSize =
        wavBuffer.readUInt32LE(
          offset + 4
        );

      if (chunkId === "data") {
        dataOffset =
          offset + 8;

        dataSize = Math.min(
          chunkSize,
          wavBuffer.length -
            dataOffset
        );

        break;
      }

      offset +=
        8 +
        chunkSize +
        (chunkSize % 2);
    }

    if (
      dataOffset === null ||
      !dataSize
    ) {
      return {
        hasSpeech: false,
      };
    }

    let sumSquares = 0;
    let peak = 0;
    let samples = 0;

    for (
      let i = dataOffset;
      i + 1 <
      dataOffset + dataSize;
      i += 2
    ) {
      const sample =
        wavBuffer.readInt16LE(i) /
        32768;

      const abs =
        Math.abs(sample);

      if (abs > peak) {
        peak = abs;
      }

      sumSquares +=
        sample * sample;

      samples++;
    }

    if (samples === 0) {
      return {
        hasSpeech: false,
      };
    }

    const rms =
      Math.sqrt(
        sumSquares / samples
      );

    const hasSpeech =
      peak >= 0.03 &&
      rms >= 0.0035;

    return {
      hasSpeech,
      diagnostics: {
        peak: Number(
          peak.toFixed(6)
        ),
        rms: Number(
          rms.toFixed(6)
        ),
      },
    };
  } catch (err) {
    console.error(
      "SENTENCE SPEECH DETECTOR ERROR:",
      err
    );

    return {
      hasSpeech: true,
    };
  }
}

router.get(
  "/progress/sentence",
  requireAuth,
  async (req, res) => {
    try {
      const userId =
        req.user.id;

      const result =
        await pool.query(
          `
          SELECT level, score, completed
          FROM user_progress
          WHERE user_id = $1
            AND activity_type = 'sentences'
          ORDER BY level ASC
          `,
          [userId]
        );

      const completedLevels =
        result.rows
          .filter(
            (row) =>
              row.completed
          )
          .map(
            (row) =>
              row.level
          );

      const unlockLevel2 =
        completedLevels.includes(1);

      const unlockLevel3 =
        completedLevels.includes(2);

      const unlockLevel4 =
        completedLevels.includes(3);

      const unlockLevel5 =
        completedLevels.includes(4);

      const unlockLevel6 =
        completedLevels.includes(5);

      const unlockLevel7 =
        completedLevels.includes(6);

      const unlockLevel8 =
        completedLevels.includes(7);

      const unlockLevel9 =
        completedLevels.includes(8);

      const unlockLevel10 =
        completedLevels.includes(9);

      const unlockLevel11 =
        completedLevels.includes(10);

      const unlockLevel12 =
        completedLevels.includes(11);

      const unlockLevel13 =
        completedLevels.includes(12);

      const unlockLevel14 =
        completedLevels.includes(13);

      const unlockLevel15 =
        completedLevels.includes(14);

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

        progress:
          result.rows,
      });
    } catch (err) {
      console.error(
        "GET SENTENCE PROGRESS ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Server error.",
        });
    }
  }
);

router.get(
  "/:path/:level",
  (req, res) => {
    try {
      const {
        path: readingPath,
        level,
      } = req.params;

      const normalizedPath =
        String(readingPath)
          .trim()
          .toLowerCase();

      const parsedLevel =
        Number(level);

      console.log(
        "Sentence request path:",
        normalizedPath,
        "level:",
        parsedLevel
      );

      const allowedPaths = [
        "foundation",
        "developing",
        "advanced",
      ];

      if (
        !allowedPaths.includes(
          normalizedPath
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid reading path.",
          });
      }

      if (
        !Number.isInteger(
          parsedLevel
        ) ||
        parsedLevel < 1 ||
        parsedLevel > 15
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid level. Level must be between 1 and 15.",
          });
      }

      const supabaseAudioBase =
        "https://dkyyecsxlmbjicbntuwa.supabase.co/storage/v1/object/public/sentences-audios";

      let fileName = "";

      if (
        normalizedPath ===
        "foundation"
      ) {
        fileName =
          "sentence_foundation.json";
      } else if (
        normalizedPath ===
        "developing"
      ) {
        fileName =
          "sentence_developing.json";
      } else {
        fileName =
          "sentence_updated_V3.json";
      }

      const filePath =
        path.join(
          __dirname,
          "../questionBanks",
          fileName
        );

      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Sentence question bank file not found.",
          });
      }

      const rawData =
        fs.readFileSync(
          filePath,
          "utf8"
        );

      const questions =
        JSON.parse(
          rawData
        );

      const levelQuestions =
        questions[
          String(parsedLevel)
        ];

      if (
        !Array.isArray(
          levelQuestions
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Level not found.",
          });
      }

      const enrichedQuestions =
        levelQuestions.map(
          (q) => ({
            ...q,

            audio_url:
              q.audio_file
                ? `${supabaseAudioBase}/${normalizedPath}_sentences/level${parsedLevel}/${encodeURIComponent(
                    q.audio_file
                  )}`
                : null,
          })
        );

      return res
        .status(200)
        .json({
          success: true,

          path:
            normalizedPath,

          level:
            parsedLevel,

          total_questions:
            enrichedQuestions.length,

          questions:
            enrichedQuestions,

          questionNumber:
            1,

          totalQuestions:
            enrichedQuestions.length,
        });
    } catch (err) {
      console.error(
        "Sentence route error:",
        err
      );

      return res
        .status(500)
        .json({
          success: false,
          message:
            "Server error.",
        });
    }
  }
);

router.post(
  "/analyze-pronunciation",
  requireAuth,
  upload.single("audio"),
  async (req, res) => {
    try {
      console.log(
        "---- SENTENCE PRONUNCIATION REQUEST ----"
      );

      console.log(
        "SENTENCE MULTER BODY:",
        req.body
      );

      console.log(
        "SENTENCE MULTER FILE:",
        req.file
          ? {
              originalname:
                req.file.originalname,
              mimetype:
                req.file.mimetype,
              size:
                req.file.size,
            }
          : "NO FILE"
      );

      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Audio file is required.",
          });
      }

      if (
        req.file.size < 1000
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Audio recording is empty or too short. Please record again.",
          });
      }

      const {
        path: readingPath,
        level,
        question_id,
      } = req.body || {};

      const normalizedPath =
        String(
          readingPath || ""
        )
          .trim()
          .toLowerCase();

      const parsedLevel =
        Number(level);

      const parsedQuestionId =
        Number(question_id);

      const allowedPaths = [
        "foundation",
        "developing",
        "advanced",
      ];

      if (
        !allowedPaths.includes(
          normalizedPath
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid reading path.",
          });
      }

      if (
        !Number.isInteger(
          parsedLevel
        ) ||
        parsedLevel < 1 ||
        parsedLevel > 15
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid level. Level must be between 1 and 15.",
          });
      }

      if (
        !Number.isInteger(
          parsedQuestionId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Invalid question_id.",
          });
      }

      let fileName;

      if (
        normalizedPath ===
        "foundation"
      ) {
        fileName =
          "sentence_foundation.json";
      } else if (
        normalizedPath ===
        "developing"
      ) {
        fileName =
          "sentence_developing.json";
      } else {
        fileName =
          "sentence_updated_V3.json";
      }

      const filePath =
        path.join(
          __dirname,
          "../questionBanks",
          fileName
        );

      if (
        !fs.existsSync(
          filePath
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Sentence question bank file not found.",
          });
      }

      const questionBank =
        JSON.parse(
          fs.readFileSync(
            filePath,
            "utf8"
          )
        );

      const levelQuestions =
        questionBank[
          String(parsedLevel)
        ];

      if (
        !Array.isArray(
          levelQuestions
        )
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Sentence level not found.",
          });
      }

      const selectedQuestion =
        levelQuestions.find(
          (question) =>
            Number(
              question.question_id
            ) ===
            parsedQuestionId
        );

      if (
        !selectedQuestion
      ) {
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Sentence question not found.",
          });
      }

      const targetSentence =
        String(
          selectedQuestion
            .target_word ||
          selectedQuestion
            .target_sentence ||
          selectedQuestion
            .sentence ||
          ""
        ).trim();

      if (!targetSentence) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Selected question has no target sentence.",
          });
      }

      console.log(
        "User:",
        req.user?.id
      );

      console.log(
        "Path:",
        normalizedPath
      );

      console.log(
        "Level:",
        parsedLevel
      );

      console.log(
        "Question ID:",
        parsedQuestionId
      );

      console.log(
        "Question Bank:",
        fileName
      );

      console.log(
        "Target sentence from JSON:",
        targetSentence
      );

      console.log(
        "STARTING SENTENCE AUDIO CONVERSION..."
      );

      const wavBuffer =
        await convertAudioToWav(
          req.file.buffer,
          req.file.originalname
        );

      console.log(
        "SENTENCE AUDIO CONVERSION SUCCESS"
      );

      console.log(
        "Converted WAV size:",
        wavBuffer.length
      );

      if (
        wavBuffer.length < 1000
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Converted audio is invalid or too short.",
          });
      }

      const speechCheck =
        detectMeaningfulSpeech(
          wavBuffer
        );

      console.log(
        "SENTENCE SPEECH CHECK:",
        speechCheck
      );

      if (
        speechCheck.hasSpeech ===
        false
      ) {
        console.log(
          "NO MEANINGFUL SPEECH DETECTED"
        );

        return res
          .status(200)
          .json({
            success: true,

            path:
              normalizedPath,

            level:
              parsedLevel,

            question_id:
              parsedQuestionId,

            target_sentence:
              targetSentence,

            recognized_text:
              "No speech detected",

            sentence_match:
              false,

            is_correct:
              false,

            result_status:
              "wrong",

            mistake:
              "No clear speech was detected.",

            analysis: {
              pronunciation:
                "We could not hear the sentence clearly.",

              stress_intonation:
                "Try reading with a natural voice.",

              pacing:
                "Read slowly and clearly.",

              fluency:
                "No clear speech was detected.",

              pauses:
                "We could not evaluate your pauses.",
            },

            tips: {
              pronunciation:
                "Say each word clearly.",

              pacing:
                "Read at a steady speed.",

              breathing:
                "Take a small breath before reading.",

              exercise:
                `Try reading "${targetSentence}" again clearly.`,
            },
          });
      }

      console.log(
        "MEANINGFUL SPEECH DETECTED"
      );

      const audioBase64 =
        wavBuffer.toString(
          "base64"
        );

      console.log(
        "SENDING SENTENCE AUDIO TO OPENAI..."
      );

      const completion =
        await openai
          .chat
          .completions
          .create({
            model:
              "gpt-audio",

            modalities: [
              "text",
            ],

            audio: {
              voice:
                "alloy",
              format:
                "wav",
            },

            messages: [
              {
                role:
                  "system",

                content: `
You are an English pronunciation and oral reading coach for Grade 3 learners.

The child is practicing ONE English sentence.

TARGET SENTENCE:
"${targetSentence}"

Listen carefully to the child's actual audio.

Be patient and forgiving because the learner is in Grade 3.

==================================================
CRITICAL AUDIO RULE
==================================================

Judge ONLY what is actually audible.

NEVER assume the learner said the target sentence simply because you know the target sentence.

NEVER turn silence, microphone noise, breathing, tapping, fan noise, static, or room noise into guessed English speech.

If there is no clear human speech:

recognized_text:
No speech detected

sentence_match:
false

If speech is present but too unclear to understand:

recognized_text:
Unclear

sentence_match:
false

Do NOT invent missing words.

==================================================
GRADE 3 ORAL READING
==================================================

The learner may:

- speak slowly
- pause between words
- have a child-like accent
- slightly mispronounce vowels or consonants
- weaken or drop small sounds
- slightly change word endings
- use imperfect stress or intonation
- pause longer than an adult reader

Do NOT require perfect native-like pronunciation.

==================================================
RECOGNIZED TEXT
==================================================

recognized_text should represent what the learner actually said.

Use normal English words whenever reasonably identifiable.

If the learner skips words, the recognized_text should reflect those missing words.

Do NOT automatically copy the target sentence.

==================================================
SENTENCE MATCH
==================================================

sentence_match determines whether the learner recognizably read the intended sentence.

Be forgiving of small Grade 3 pronunciation mistakes.

sentence_match may be true even when:

- some words are slightly mispronounced
- the learner reads slowly
- there are short pauses
- the learner has a child-like accent
- stress or intonation is imperfect
- a small sound or ending is slightly incorrect

Return sentence_match = true when the intended sentence is clearly recognizable and MOST important words are present in the correct meaning and order.

Return sentence_match = false when:

- there is no clear speech
- there is only noise
- a completely different sentence is spoken
- several important words are missing
- several important words are replaced
- the sentence meaning changes significantly
- speech is too unclear
- the sentence cannot reasonably be recognized as the target sentence

==================================================
PRONUNCIATION FEEDBACK
==================================================

Sentence matching and pronunciation feedback are separate.

A learner may have sentence_match = true while still having pronunciation or fluency issues.

Analyze:

1. pronunciation
- clarity of individual words
- noticeable vowel or consonant problems

2. stress and intonation
- whether the sentence sounds natural
- whether important words receive suitable emphasis

3. pacing
- whether the learner reads too quickly or too slowly

4. fluency
- smoothness
- hesitation
- repetition

5. pauses
- whether pauses occur naturally
- whether there are unnecessary long pauses

==================================================
MISTAKE
==================================================

Briefly describe the MAIN thing the learner should improve.

Use simple Grade 3 friendly language.

If there is no important pronunciation problem, return exactly:

"No major pronunciation mistake detected."

==================================================
TIPS
==================================================

Give short Grade 3 friendly tips for:

- pronunciation
- pacing
- breathing
- one practice exercise

The exercise should preferably use the target sentence.

Do NOT return:

- percentages
- numerical scores
- ratings
- pass/fail labels
- correct/wrong labels

Keep all feedback short, encouraging, clear, and child-friendly.
                `,
              },

              {
                role:
                  "user",

                content: [
                  {
                    type:
                      "input_audio",

                    input_audio: {
                      data:
                        audioBase64,

                      format:
                        "wav",
                    },
                  },
                ],
              },
            ],

            tools: [
              {
                type:
                  "function",

                function: {
                  name:
                    "sentence_pronunciation_analysis",

                  description:
                    "Analyze the child's spoken sentence.",

                  parameters: {
                    type:
                      "object",

                    properties: {
                      recognized_text: {
                        type:
                          "string",
                      },

                      sentence_match: {
                        type:
                          "boolean",
                      },

                      mistake: {
                        type:
                          "string",
                      },

                      analysis: {
                        type:
                          "object",

                        properties: {
                          pronunciation: {
                            type:
                              "string",
                          },

                          stress_intonation: {
                            type:
                              "string",
                          },

                          pacing: {
                            type:
                              "string",
                          },

                          fluency: {
                            type:
                              "string",
                          },

                          pauses: {
                            type:
                              "string",
                          },
                        },

                        required: [
                          "pronunciation",
                          "stress_intonation",
                          "pacing",
                          "fluency",
                          "pauses",
                        ],
                      },

                      tips: {
                        type:
                          "object",

                        properties: {
                          pronunciation: {
                            type:
                              "string",
                          },

                          pacing: {
                            type:
                              "string",
                          },

                          breathing: {
                            type:
                              "string",
                          },

                          exercise: {
                            type:
                              "string",
                          },
                        },

                        required: [
                          "pronunciation",
                          "pacing",
                          "breathing",
                          "exercise",
                        ],
                      },
                    },

                    required: [
                      "recognized_text",
                      "sentence_match",
                      "mistake",
                      "analysis",
                      "tips",
                    ],
                  },
                },
              },
            ],

            tool_choice: {
              type:
                "function",

              function: {
                name:
                  "sentence_pronunciation_analysis",
              },
            },
          });

      console.log(
        "OPENAI SENTENCE RESPONSE RECEIVED"
      );

      const toolCall =
        completion
          .choices?.[0]
          ?.message
          ?.tool_calls?.[0];

      if (!toolCall) {
        throw new Error(
          "AI did not return sentence pronunciation analysis."
        );
      }

      const pronunciationAnalysis =
        JSON.parse(
          toolCall
            .function
            .arguments
        );

      const recognizedText =
        String(
          pronunciationAnalysis
            .recognized_text ||
          ""
        ).trim();

      const normalizedRecognizedText =
        recognizedText
          .toLowerCase();

      const aiSaysNoSpeech =
        !recognizedText ||
        normalizedRecognizedText ===
          "unclear" ||
        normalizedRecognizedText.includes(
          "no speech"
        ) ||
        normalizedRecognizedText.includes(
          "silence"
        ) ||
        normalizedRecognizedText.includes(
          "inaudible"
        );

      const isCorrect =
        pronunciationAnalysis
          .sentence_match === true &&
        aiSaysNoSpeech === false;

      console.log(
        "AI SENTENCE PRONUNCIATION FEEDBACK:",
        pronunciationAnalysis
      );

      console.log(
        "RECOGNIZED TEXT:",
        recognizedText
      );

      console.log(
        "TARGET SENTENCE:",
        targetSentence
      );

      console.log(
        "SENTENCE MATCH:",
        pronunciationAnalysis
          .sentence_match
      );

      console.log(
        "AI SAYS NO SPEECH:",
        aiSaysNoSpeech
      );

      console.log(
        "IS CORRECT:",
        isCorrect
      );

      console.log(
        "RETURNING RESPONSE TO FLUTTERFLOW"
      );

      return res
        .status(200)
        .json({
          success: true,

          path:
            normalizedPath,

          level:
            parsedLevel,

          question_id:
            parsedQuestionId,

          target_sentence:
            targetSentence,

          recognized_text:
            recognizedText,

          sentence_match:
            pronunciationAnalysis
              .sentence_match ===
            true,

          is_correct:
            isCorrect,

          result_status:
            isCorrect
              ? "correct"
              : "wrong",

          mistake:
            pronunciationAnalysis
              .mistake ||
            "",

          analysis: {
            pronunciation:
              pronunciationAnalysis
                .analysis
                ?.pronunciation ||
              "",

            stress_intonation:
              pronunciationAnalysis
                .analysis
                ?.stress_intonation ||
              "",

            pacing:
              pronunciationAnalysis
                .analysis
                ?.pacing ||
              "",

            fluency:
              pronunciationAnalysis
                .analysis
                ?.fluency ||
              "",

            pauses:
              pronunciationAnalysis
                .analysis
                ?.pauses ||
              "",
          },

          tips: {
            pronunciation:
              pronunciationAnalysis
                .tips
                ?.pronunciation ||
              "",

            pacing:
              pronunciationAnalysis
                .tips
                ?.pacing ||
              "",

            breathing:
              pronunciationAnalysis
                .tips
                ?.breathing ||
              "",

            exercise:
              pronunciationAnalysis
                .tips
                ?.exercise ||
              "",
          },
        });
    } catch (err) {
      console.error(
        "SENTENCE PRONUNCIATION ROUTE ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to analyze sentence pronunciation.",

          error:
            process.env.NODE_ENV ===
            "development"
              ? err.message
              : undefined,
        });
    }
  }
);

export default router;