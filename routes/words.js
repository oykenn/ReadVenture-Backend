import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import { pool } from "../db.js";
import multer from "multer";

// Temporary audio conversion
import os from "os";
import { randomUUID } from "crypto";
import { promises as fsp } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

// OpenAI
import OpenAI from "openai";

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer: keep uploaded recording in memory only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
});

// Convert uploaded audio to mono 16kHz WAV
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
    // Temporarily write uploaded audio
    await fsp.writeFile(inputPath, buffer);

    // Convert to mono 16 kHz WAV
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      outputPath,
    ]);

    // Load converted audio back into memory
    const wavBuffer = await fsp.readFile(outputPath);

    return wavBuffer;
  } finally {
    // Always delete temporary files
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
      "WORD SPEECH DETECTOR ERROR:",
      err
    );

    return {
      hasSpeech: true,
    };
  }
}



// GET SAVED WORDS PROGRESS
router.get(
  "/progress/words",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT level, score, completed
        FROM user_progress
        WHERE user_id = $1
          AND activity_type = 'words'
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
      console.error(
        "GET WORDS PROGRESS ERROR:",
        err
      );

      return res.status(500).json({
        success: false,
        message: "Server error.",
      });
    }
  }
);

// GET WORD QUESTIONS BY PATH AND LEVEL
router.get("/:path/:level", (req, res) => {
  try {
    const { path: readingPath, level } = req.params;

    const normalizedPath =
      readingPath.toLowerCase();

    console.log(
      "Words request path:",
      normalizedPath,
      "level:",
      level
    );

    const supabaseAudioBase =
      "https://dkyyecsxlmbjicbntuwa.supabase.co/storage/v1/object/public/word-audios";

    let fileName = "";

    if (normalizedPath === "foundation") {
      fileName = "words_foundation.json";
    } else if (
      normalizedPath === "developing"
    ) {
      fileName = "words_developing.json";
    } else if (
      normalizedPath === "advanced"
    ) {
      fileName = "words_advanced.json";
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid reading path.",
      });
    }

    const filePath = path.join(
      __dirname,
      "../questionBanks",
      fileName
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message:
          "Words question bank file not found.",
      });
    }

    const rawData = fs.readFileSync(
      filePath,
      "utf8"
    );

    const questions = JSON.parse(rawData);

    const levelQuestions =
      questions[level];

    if (!levelQuestions) {
      return res.status(404).json({
        success: false,
        message: "Level not found.",
      });
    }

    const enrichedQuestions =
      levelQuestions.map((q) => ({
        ...q,
        audio_url: q.audio_file
          ? `${supabaseAudioBase}/${normalizedPath}_words/level${level}/${q.audio_file}`
          : null,
      }));

    return res.status(200).json({
      success: true,
      path: normalizedPath,
      level: Number(level),
      total_questions:
        enrichedQuestions.length,
      questions: enrichedQuestions,
      questionNumber: 1,
      totalQuestions:
        enrichedQuestions.length,
    });
  } catch (err) {
    console.error(
      "Words route error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
});

// ai analyze pronunciation of a single word
router.post(
  "/analyze-pronunciation",
  requireAuth,
  upload.single("audio"),
  async (req, res) => {
    try {
      // =====================================================
      // 1. VALIDATE AUDIO
      // =====================================================
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

      // =====================================================
      // 2. REQUEST DATA
      // =====================================================
      const {
        path: readingPath,
        level,
        question_id,
      } = req.body;

      const normalizedPath = String(
        readingPath || ""
      )
        .trim()
        .toLowerCase();

      const parsedLevel =
        Number(level);

      const parsedQuestionId =
        Number(question_id);

      // =====================================================
      // 3. VALIDATE PATH
      // =====================================================
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

      // =====================================================
      // 4. VALIDATE LEVEL
      // =====================================================
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

      // =====================================================
      // 5. VALIDATE QUESTION ID
      // =====================================================
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

      // =====================================================
      // 6. SELECT QUESTION BANK
      // =====================================================
      let fileName;

      if (
        normalizedPath ===
        "foundation"
      ) {
        fileName =
          "words_foundation.json";
      } else if (
        normalizedPath ===
        "developing"
      ) {
        fileName =
          "words_developing.json";
      } else {
        fileName =
          "words_advanced.json";
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
            "Words question bank file not found.",
        });
      }

      // =====================================================
      // 7. LOAD QUESTION BANK
      // =====================================================
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
            "Words level not found.",
        });
      }

      // =====================================================
      // 8. FIND CURRENT QUESTION
      // =====================================================
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
            "Word question not found.",
        });
      }

      const target_word =
        String(
          selectedQuestion
            .target_word || ""
        ).trim();

      if (!target_word) {
        return res.status(400).json({
          success: false,
          message:
            "Selected question has no target_word.",
        });
      }

      // =====================================================
      // 9. REQUEST LOGS
      // =====================================================
      console.log(
        "---- WORD PRONUNCIATION REQUEST ----"
      );

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
        "Target word from JSON:",
        target_word
      );

      console.log(
        "Original audio:",
        {
          originalname:
            req.file.originalname,

          mimetype:
            req.file.mimetype,

          size:
            req.file.size,
        }
      );

      // =====================================================
      // 10. CONVERT AUDIO TO WAV
      // =====================================================
      console.log(
        "STARTING WORD AUDIO CONVERSION..."
      );

      const wavBuffer =
        await convertAudioToWav(
          req.file.buffer,
          req.file.originalname
        );

      console.log(
        "WORD AUDIO CONVERSION SUCCESS"
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

      // =====================================================
      // 11. CHECK FOR ACTUAL SPEECH
      // =====================================================
      const speechCheck =
        detectMeaningfulSpeech(
          wavBuffer
        );

      console.log(
        "WORD SPEECH CHECK:",
        speechCheck
      );

      // =====================================================
      // SILENCE / NO MEANINGFUL SPEECH
      // =====================================================
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

          target_word:
            target_word,

          recognized_text:
            "No speech detected",
          

          recognized_word:
            "Unclear",

          is_correct:
            false,

          result_status:
            "wrong",

          mistake:
            "No clear speech was detected.",

          analysis: {
            vowel_sounds:
              "We could not hear the word clearly.",

            consonant_sounds:
              "We could not hear the word clearly.",

            stress_intonation:
              "Try saying the word clearly into the microphone.",

            fluency:
              "No clear speech was detected.",
          },

          tips: {
            tongue_placement:
              "Get ready to say the word clearly.",

            mouth_position:
              "Open your mouth naturally while saying the word.",

            breathing:
              "Take a small breath before speaking.",

            exercise:
              `Try saying "${target_word}" again clearly.`,
          },
        });
      }

      console.log(
        "MEANINGFUL SPEECH DETECTED"
      );

      // =====================================================
      // 12. AUDIO TO BASE64
      // =====================================================
      const audioBase64 =
        wavBuffer.toString(
          "base64"
        );

      console.log(
        "SENDING WORD AUDIO TO OPENAI..."
      );

      // =====================================================
      // 13. OPENAI
      // =====================================================
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
You are an English pronunciation coach for Grade 3 learners.

The child is practicing ONE English target word.

TARGET WORD:
"${target_word}"

Listen carefully to the child's audio.

This activity is for Grade 3 learners.

Be patient and forgiving.

==================================================
CRITICAL AUDIO RULE
==================================================

You MUST judge only what is actually audible.

NEVER guess that the child said the target word simply because you know the target word.

NEVER turn silence, microphone noise, breathing, tapping, fan noise, static, or room noise into a guessed English word.

If there is no clear human speech, or the audio contains only noise, return EXACTLY:

recognized_text:
No speech detected

recognized_word:
Unclear

word_match:
false

If speech exists but is too unclear to identify a reasonable word:

recognized_word:
Unclear

word_match:
false

The target word is provided only so you can compare actual spoken audio against it.

Do NOT use the target word as a hint for inventing what the learner said.

==================================================
GRADE 3 PRONUNCIATION
==================================================

The child may:
- speak slowly
- pause slightly
- separate syllables
- have a child-like accent
- mispronounce vowels
- mispronounce consonants
- weaken or drop a sound
- slightly change an ending
- use imperfect stress or intonation

Do NOT require perfect dictionary pronunciation.

==================================================
RECOGNIZED TEXT
==================================================

recognized_text should approximately represent what the child sounded like.

It may be phonetic.

Example:

Target:
exploration

Child sounds like:
explore-ayshun

recognized_text:
explore-ayshun

However, do NOT create phonetic text when there is no actual speech.

For silence or noise only:

recognized_text:
No speech detected

==================================================
RECOGNIZED WORD
==================================================

recognized_word must contain the closest normal English word that best represents what the child actually said.

Do NOT use phonetic spelling in recognized_word.

Example:

recognized_text:
explore-ayshun

recognized_word:
exploration

If the child clearly says another English word:

recognized_text:
table

recognized_word:
table

recognized_word must NEVER be empty.

If the audio is too unclear to identify a reasonable English word, return:

recognized_word:
Unclear

If there is no clear human speech:

recognized_word:
Unclear

==================================================
WORD MATCH
==================================================

word_match determines whether the child recognizably said the target word.

Be forgiving because the learner is a Grade 3 student.

Return word_match = true ONLY when actual human speech is audible and the spoken word is reasonably recognizable as the target word.

word_match may still be true when the child:

- mispronounces one or more sounds
- changes a vowel sound
- weakens or drops a consonant
- slightly changes a syllable
- slightly changes the ending
- separates syllables
- speaks slowly
- has imperfect stress
- has a child-like accent

If a teacher could reasonably understand from the ACTUAL AUDIO that the child intended to say the target word, word_match should normally be true.

Example:

Target:
responsible

Child sounds like:
re-spon-see-bol

recognized_word:
responsible

word_match:
true

Example:

Target:
exploration

Child says:
table

recognized_word:
table

word_match:
false

Return word_match = false when:

- no clear human speech is present
- there is only silence or noise
- a clearly different word was spoken
- most of the target word is missing
- the audio is too unclear
- the spoken word cannot reasonably be recognized as the target word

==================================================
PRONUNCIATION FEEDBACK
==================================================

Pronunciation feedback is separate from word_match.

A learner may have:

word_match = true

while still having pronunciation mistakes.

Give short, child-friendly feedback for:

- vowel sounds
- consonant sounds
- stress and intonation
- fluency

==================================================
MISTAKE
==================================================

Briefly describe the main pronunciation improvement.

If there is no important pronunciation issue, return:

"No major pronunciation mistake detected."

==================================================
TIPS
==================================================

Give simple Grade 3 friendly tips for:

- tongue placement
- mouth position
- breathing
- one practice exercise

Do NOT return:

- numerical scores
- percentages
- ratings
- pass/fail
- correct/wrong labels

Keep the feedback short and child-friendly.
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

            // =====================================================
            // STRUCTURED RESULT
            // =====================================================
            tools: [
              {
                type: "function",

                function: {
                  name:
                    "word_pronunciation_analysis",

                  description:
                    "Analyze the child's spoken word.",

                  parameters: {
                    type: "object",

                    properties: {
                      recognized_text: {
                        type: "string",
                      },

                      recognized_word: {
                        type: "string",
                      },

                      word_match: {
                        type: "boolean",
                      },

                      mistake: {
                        type: "string",
                      },

                      analysis: {
                        type: "object",

                        properties: {
                          vowel_sounds: {
                            type: "string",
                          },

                          consonant_sounds: {
                            type: "string",
                          },

                          stress_intonation: {
                            type: "string",
                          },

                          fluency: {
                            type: "string",
                          },
                        },

                        required: [
                          "vowel_sounds",
                          "consonant_sounds",
                          "stress_intonation",
                          "fluency",
                        ],
                      },

                      tips: {
                        type: "object",

                        properties: {
                          tongue_placement: {
                            type: "string",
                          },

                          mouth_position: {
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
                          "tongue_placement",
                          "mouth_position",
                          "breathing",
                          "exercise",
                        ],
                      },
                    },

                    required: [
                      "recognized_text",
                      "recognized_word",
                      "word_match",
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
                  "word_pronunciation_analysis",
              },
            },
          }
        );

      console.log(
        "OPENAI WORD RESPONSE RECEIVED"
      );

      // =====================================================
      // 14. READ OPENAI RESULT
      // =====================================================
      const toolCall =
        completion
          .choices?.[0]
          ?.message
          ?.tool_calls?.[0];

      if (!toolCall) {
        throw new Error(
          "AI did not return pronunciation analysis."
        );
      }

      const pronunciationAnalysis =
        JSON.parse(
          toolCall.function.arguments
        );

      // =====================================================
      // 15. CLEAN RESULT
      // =====================================================
      const recognizedText =
        String(
          pronunciationAnalysis
            .recognized_text || ""
        ).trim();

      const recognizedWord =
        String(
          pronunciationAnalysis
            .recognized_word ||
            "Unclear"
        ).trim() || "Unclear";

      // Extra safety:
      // even if AI accidentally says word_match=true,
      // "Unclear" / no-speech results can NEVER be correct.
      const normalizedRecognizedWord =
        recognizedWord.toLowerCase();

      const normalizedRecognizedText =
        recognizedText.toLowerCase();

      const aiSaysNoSpeech =
        normalizedRecognizedWord ===
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
          .word_match === true &&
        aiSaysNoSpeech === false;

      // =====================================================
      // 16. LOG RESULT
      // =====================================================
      console.log(
        "AI WORD PRONUNCIATION FEEDBACK:",
        pronunciationAnalysis
      );

      console.log(
        "RECOGNIZED TEXT:",
        recognizedText
      );

      console.log(
        "RECOGNIZED WORD:",
        recognizedWord
      );

      console.log(
        "TARGET WORD:",
        target_word
      );

      console.log(
        "WORD MATCH:",
        pronunciationAnalysis
          .word_match
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

      // =====================================================
      // 17. DIRECT RESPONSE TO FLUTTERFLOW
      // =====================================================
      return res.status(200).json({
        success: true,

        path:
          normalizedPath,

        level:
          parsedLevel,

        question_id:
          parsedQuestionId,

        target_word:
          target_word,

        recognized_text:
          recognizedText,

        recognized_word:
          recognizedWord,

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
          vowel_sounds:
            pronunciationAnalysis
              .analysis
              ?.vowel_sounds ||
            "",

          consonant_sounds:
            pronunciationAnalysis
              .analysis
              ?.consonant_sounds ||
            "",

          stress_intonation:
            pronunciationAnalysis
              .analysis
              ?.stress_intonation ||
            "",

          fluency:
            pronunciationAnalysis
              .analysis
              ?.fluency ||
            "",
        },

        tips: {
          tongue_placement:
            pronunciationAnalysis
              .tips
              ?.tongue_placement ||
            "",

          mouth_position:
            pronunciationAnalysis
              .tips
              ?.mouth_position ||
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
      // =====================================================
      // ERROR
      // =====================================================
      console.error(
        "WORD PRONUNCIATION ROUTE ERROR:",
        err
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to analyze word pronunciation.",

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