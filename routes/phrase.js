
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

function detectMeaningfulSpeech(wavBuffer) {
  try {
    if (!Buffer.isBuffer(wavBuffer) || wavBuffer.length < 44) {
      return { hasSpeech: false };
    }

    let offset = 12;
    let dataOffset = null;
    let dataSize = null;

    while (offset + 8 <= wavBuffer.length) {
      const chunkId = wavBuffer.toString(
        "ascii",
        offset,
        offset + 4
      );

      const chunkSize =
        wavBuffer.readUInt32LE(offset + 4);

      if (chunkId === "data") {
        dataOffset = offset + 8;
        dataSize = Math.min(
          chunkSize,
          wavBuffer.length - dataOffset
        );
        break;
      }

      offset += 8 + chunkSize + (chunkSize % 2);
    }

    if (dataOffset === null || !dataSize) {
      return { hasSpeech: false };
    }

    let sumSquares = 0;
    let peak = 0;
    let samples = 0;

    for (
      let i = dataOffset;
      i + 1 < dataOffset + dataSize;
      i += 2
    ) {
      const sample =
        wavBuffer.readInt16LE(i) / 32768;

      const abs = Math.abs(sample);

      if (abs > peak) {
        peak = abs;
      }

      sumSquares += sample * sample;
      samples++;
    }

    if (samples === 0) {
      return { hasSpeech: false };
    }

    const rms =
      Math.sqrt(sumSquares / samples);

    const hasSpeech =
      peak >= 0.03 &&
      rms >= 0.0035;

    return {
      hasSpeech,
      diagnostics: {
        peak: Number(peak.toFixed(6)),
        rms: Number(rms.toFixed(6)),
      },
    };
  } catch (err) {
    console.error(
      "PHRASE SPEECH DETECTOR ERROR:",
      err
    );

    return {
      hasSpeech: true,
    };
  }
}

router.get(
  "/progress/phrase",

  requireAuth,

  async (req, res) => {
    try {
      const userId = req.user.id;

      const result =
        await pool.query(
          `
          SELECT level, score, completed
          FROM user_progress

          WHERE user_id = $1
            AND activity_type = 'phrases'

          ORDER BY level ASC
          `,
          [userId]
        );

      const completedLevels =
        result.rows
          .filter(
            (row) => row.completed
          )
          .map(
            (row) => row.level
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
        "GET PHRASE PROGRESS ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Server error.",
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
        "Phrase request path:",
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
        "https://dkyyecsxlmbjicbntuwa.supabase.co/storage/v1/object/public/phrase-audios";

      let fileName = "";

      if (
        normalizedPath ===
        "foundation"
      ) {
        fileName =
          "phrase_foundation.json";

      } else if (
        normalizedPath ===
        "developing"
      ) {
        fileName =
          "phrase_developing.json";

      } else if (
        normalizedPath ===
        "advanced"
      ) {
        fileName =
          "phrase_advanced.json";
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
              "Phrase question bank file not found.",
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
                ? `${supabaseAudioBase}/${normalizedPath}_phrase/level${parsedLevel}/${encodeURIComponent(
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
        "PHRASE QUESTIONS ERROR:",
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
        "---- PHRASE PRONUNCIATION REQUEST ----"
      );

      console.log(
        "PHRASE MULTER BODY:",
        req.body
      );

      console.log(
        "PHRASE MULTER FILE:",
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
        return res.status(400).json({
          success: false,
          message: "Audio file is required.",
        });
      }

      if (req.file.size < 1000) {
        return res.status(400).json({
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

      const normalizedPath = String(
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
        return res.status(400).json({
          success: false,
          message:
            "Invalid reading path.",
        });
      }

      if (
        !Number.isInteger(parsedLevel) ||
        parsedLevel < 1 ||
        parsedLevel > 15
      ) {
        return res.status(400).json({
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
        return res.status(400).json({
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
          "phrase_foundation.json";
      } else if (
        normalizedPath ===
        "developing"
      ) {
        fileName =
          "phrase_developing.json";
      } else {
        fileName =
          "phrase_advanced.json";
      }

      const filePath =
        path.join(
          __dirname,
          "../questionBanks",
          fileName
        );

      if (
        !fs.existsSync(filePath)
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Phrase question bank file not found.",
          expected_file:
            fileName,
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
        return res.status(404).json({
          success: false,
          message:
            "Phrase level not found.",
        });
      }

      const selectedQuestion =
        levelQuestions.find(
          (question) =>
            Number(
              question.question_id
            ) === parsedQuestionId
        );

      if (!selectedQuestion) {
        return res.status(404).json({
          success: false,
          message:
            "Phrase question not found.",
        });
      }

      const targetPhrase =
        String(
          selectedQuestion.target_word ||
          selectedQuestion.target_phrase ||
          selectedQuestion.phrase ||
          ""
        ).trim();

      if (!targetPhrase) {
        return res.status(400).json({
          success: false,
          message:
            "Selected question has no target phrase.",
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
        "Target phrase from JSON:",
        targetPhrase
      );

      console.log(
        "STARTING PHRASE AUDIO CONVERSION..."
      );

      const wavBuffer =
        await convertAudioToWav(
          req.file.buffer,
          req.file.originalname
        );

      console.log(
        "PHRASE AUDIO CONVERSION SUCCESS"
      );

      console.log(
        "Converted WAV size:",
        wavBuffer.length
      );

      if (
        wavBuffer.length < 1000
      ) {
        return res.status(400).json({
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
        "PHRASE SPEECH CHECK:",
        speechCheck
      );

      if (
        speechCheck.hasSpeech ===
        false
      ) {
        console.log(
          "NO MEANINGFUL SPEECH DETECTED"
        );

        console.log(
          "RETURNING WRONG RESULT WITHOUT OPENAI"
        );

        return res.status(200).json({
          success: true,

          path:
            normalizedPath,

          level:
            parsedLevel,

          question_id:
            parsedQuestionId,

          target_phrase:
            targetPhrase,

          recognized_text:
            "No speech detected",

          phrase_match:
            false,

          is_correct:
            false,

          result_status:
            "wrong",

          mistake:
            "No clear speech was detected.",

          analysis: {
            pronunciation:
              "We could not hear the phrase clearly.",

            stress_intonation:
              "Try reading the phrase with a natural voice.",

            pacing:
              "Read the phrase slowly and clearly.",

            fluency:
              "No clear speech was detected.",
          },

          tips: {
            pronunciation:
              "Say each word clearly.",

            pacing:
              "Do not rush. Read one part at a time.",

            breathing:
              "Take a small breath before reading.",

            exercise:
              `Try reading "${targetPhrase}" again clearly.`,
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
        "SENDING PHRASE AUDIO TO OPENAI..."
      );

      const completion =
        await openai.chat.completions.create(
          {

            model: "gpt-audio",

            modalities: ["text"],

            audio: {
              voice: "alloy",
              format: "wav",
            },

            messages: [
              {
                role: "system",

                content: `
You are an English pronunciation and oral reading coach for Grade 3 learners.

The child is practicing ONE English phrase.

TARGET PHRASE:
"${targetPhrase}"

Listen carefully to the child's audio.

This activity is for Grade 3 learners.

Be patient and forgiving.

==================================================
CRITICAL AUDIO RULE
==================================================

You MUST judge only what is actually audible.

NEVER guess that the child said the target phrase simply because you know the target phrase.

NEVER turn silence, microphone noise, breathing, tapping, fan noise, static, or room noise into guessed English speech.

If there is no clear human speech, return:

recognized_text:
No speech detected

phrase_match:
false

If speech exists but is too unclear to understand, return:

recognized_text:
Unclear

phrase_match:
false

The target phrase is provided only so you can compare the child's ACTUAL spoken audio against it.

Do NOT use the target phrase as a hint for inventing what the learner said.

==================================================
GRADE 3 ORAL READING
==================================================

The child may:
- speak slowly
- pause between words
- have a child-like accent
- slightly mispronounce vowels or consonants
- weaken or drop a small sound
- slightly change a word ending
- use imperfect stress or intonation

Do NOT require perfect native-like pronunciation.

==================================================
RECOGNIZED TEXT
==================================================

recognized_text should approximately represent what the child actually said.

Use normal English words whenever they are reasonably identifiable.

Do NOT invent words that were not spoken.

If the learner skips a word, recognized_text should reflect that omission.

==================================================
PHRASE MATCH
==================================================

phrase_match determines whether the learner recognizably read the target phrase.

Be forgiving because the learner is a Grade 3 student.

phrase_match may still be true when:
- pronunciation is imperfect
- the learner has a child-like accent
- the learner reads slowly
- the learner pauses between words
- stress or intonation is imperfect
- a small sound or ending is slightly incorrect

Return phrase_match = true when the learner clearly attempted the correct phrase and the important words are present and recognizable.

Return phrase_match = false when:
- there is no clear human speech
- there is only silence or noise
- a completely different phrase was spoken
- several important words are missing or replaced
- the speech is too unclear
- the spoken phrase cannot reasonably be recognized as the target phrase

==================================================
PRONUNCIATION FEEDBACK
==================================================

Phrase matching and pronunciation feedback are separate.

A learner may have phrase_match = true while still having pronunciation or fluency issues.

Give short Grade 3 friendly feedback for:

1. pronunciation
2. stress and intonation
3. pacing
4. fluency

==================================================
MISTAKE
==================================================

Briefly describe the MAIN improvement the learner should work on.

If there is no important issue, return exactly:

"No major pronunciation mistake detected."

==================================================
TIPS
==================================================

Give simple Grade 3 friendly tips for:

- pronunciation
- pacing
- breathing
- one practice exercise

The exercise should preferably use the target phrase.

Do NOT return:
- numerical scores
- percentages
- ratings
- pass/fail labels
- correct/wrong labels

Keep all feedback short, clear, encouraging, and child-friendly.
                `,
              },

              {
                role: "user",

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
                type: "function",

                function: {
                  name:
                    "phrase_pronunciation_analysis",

                  description:
                    "Analyze the child's spoken phrase.",

                  parameters: {
                    type: "object",

                    properties: {
                      recognized_text: {
                        type: "string",
                      },

                      phrase_match: {
                        type: "boolean",
                      },

                      mistake: {
                        type: "string",
                      },

                      analysis: {
                        type: "object",

                        properties: {
                          pronunciation: {
                            type: "string",
                          },

                          stress_intonation: {
                            type: "string",
                          },

                          pacing: {
                            type: "string",
                          },

                          fluency: {
                            type: "string",
                          },
                        },

                        required: [
                          "pronunciation",
                          "stress_intonation",
                          "pacing",
                          "fluency",
                        ],
                      },

                      tips: {
                        type: "object",

                        properties: {
                          pronunciation: {
                            type: "string",
                          },

                          pacing: {
                            type: "string",
                          },

                          breathing: {
                            type: "string",
                          },

                          exercise: {
                            type: "string",
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
                      "phrase_match",
                      "mistake",
                      "analysis",
                      "tips",
                    ],
                  },
                },
              },
            ],

            tool_choice: {
              type: "function",

              function: {
                name:
                  "phrase_pronunciation_analysis",
              },
            },
          }
        );

      console.log(
        "OPENAI PHRASE RESPONSE RECEIVED"
      );

      const toolCall =
        completion
          .choices?.[0]
          ?.message
          ?.tool_calls?.[0];

      if (!toolCall) {
        throw new Error(
          "AI did not return phrase pronunciation analysis."
        );
      }

      const pronunciationAnalysis =
        JSON.parse(
          toolCall.function.arguments
        );

      const recognizedText =
        String(
          pronunciationAnalysis
            .recognized_text ||
          ""
        ).trim();

      const normalizedRecognizedText =
        recognizedText.toLowerCase();

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
          .phrase_match === true &&
        aiSaysNoSpeech === false;

      console.log(
        "AI PHRASE PRONUNCIATION FEEDBACK:",
        pronunciationAnalysis
      );

      console.log(
        "RECOGNIZED TEXT:",
        recognizedText
      );

      console.log(
        "TARGET PHRASE:",
        targetPhrase
      );

      console.log(
        "PHRASE MATCH:",
        pronunciationAnalysis
          .phrase_match
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

      return res.status(200).json({
        success: true,

        path:
          normalizedPath,

        level:
          parsedLevel,

        question_id:
          parsedQuestionId,

        target_phrase:
          targetPhrase,

        recognized_text:
          recognizedText,

        phrase_match:
          pronunciationAnalysis
            .phrase_match === true,

        is_correct:
          isCorrect,

        result_status:
          isCorrect
            ? "correct"
            : "wrong",

        mistake:
          pronunciationAnalysis
            .mistake || "",

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
        "PHRASE PRONUNCIATION ROUTE ERROR:",
        err
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to analyze phrase pronunciation.",

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
