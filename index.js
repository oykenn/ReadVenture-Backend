import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import quizRoutes from "./routes/quiz.js";
import quiz2Routes from "./routes/quiz2.js";
import quiz3Routes from "./routes/quiz3.js";
import wordsRoutes from "./routes/words.js";
import phraseRoutes from "./routes/phrase.js";
import sentenceRoutes from "./routes/sentence.js";
import readingRoutes from "./routes/reading.js";
import badgeRoutes from "./routes/badge.js";
import tchrRoutes from "./routes/teacher.js";
import adminStud from "./routes/adminStudentDetails.js";
import adminTchr from "./routes/adminTchrDtls.js";
import poemsRouter from "./routes/poems.js";
import shortStoriesRouter from "./routes/shortstories.js";
import textsRouter from "./routes/texts.js";
import aiUsageRoutes from "./routes/aiUsage.js";

import healthRoutes from "./routes/health.js"; 

import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/**
 * ✅ CORS configuration (FlutterFlow Web + ngrok safe)
 */
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "ngrok-skip-browser-warning"],
};

// Enable CORS
app.use(cors(corsOptions));

// Handle preflight requests (VERY IMPORTANT for web)
app.options(/.*/, cors(corsOptions));

/**
 * ✅ Body parsers
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ✅ Serve audio files
 */
app.use("/audio", express.static(path.join(__dirname, "audios")));

/**
 * ✅ Debug logger (keep for now)
 */
app.use((req, res, next) => {
  console.log("---- REQUEST ----");
  console.log("METHOD:", req.method);
  console.log("URL:", req.originalUrl);
  // console.log("BODY:", req.body);
  next();
});

/**
 * ✅ Routes
 */
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/quiz", quizRoutes);
app.use("/quiz2", quiz2Routes);
app.use("/quiz3", quiz3Routes);
app.use("/words", wordsRoutes);
app.use("/phrase", phraseRoutes);
app.use("/sentence", sentenceRoutes);
app.use("/admin", aiUsageRoutes);
// IMPORTANT: POEMS FIRST
app.use("/reading", poemsRouter);
app.use("/reading", shortStoriesRouter);
app.use("/reading", textsRouter);

// OLD GENERAL READING ROUTER AFTER
app.use("/reading", readingRoutes);

app.use("/badges", badgeRoutes);
app.use("/teacher", tchrRoutes);
app.use("/admin/student", adminStud);
app.use("/admin", adminTchr);

app.use("/health", healthRoutes);

/**
 * ✅ Start server
  */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});