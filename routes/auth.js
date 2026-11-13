import express from "express";
import { pool } from "../db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import multer from "multer";
import { parse } from "csv-parse/sync";
import path from "path";

import { randomBytes } from "node:crypto";


const router = express.Router();

const csvUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },

  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".csv") {
      return cb(
        new Error("Invalid file format. Only CSV files are allowed.")
      );
    }

    cb(null, true);
  },
});

const uploadCsvFile = (req, res, next) => {
  csvUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          err.code === "LIMIT_FILE_SIZE"
            ? "CSV file is too large. Maximum size is 2MB."
            : err.message,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    next();
  });
};


// const jwt = require("jsonwebtoken");
/**
 * POST /auth/login
 */

router.post("/login-v4", async (req, res) => {
  const { username, password } = req.body;

  console.log("\n==============================");
  console.log("LOGIN-V4 REQUEST");
  console.log("==============================");

  // console.log("RAW BODY:", req.body);
  // console.log("USERNAME RECEIVED:", username);
  // // console.log("PASSWORD RECEIVED:", password);

  if (!username || !password) {
    console.log("LOGIN FAILED: Missing username or password");

    return res.status(400).json({
      success: false,
      message: "username and password required",
    });
  }

  try {
    console.log("SEARCHING USER IN DATABASE...");

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        role,
        password,
        placement_done
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    console.log("USERS FOUND:", result.rows.length);

    if (result.rows.length === 0) {
      console.log("LOGIN FAILED: Username not found");
      console.log("==============================\n");

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = result.rows[0];

    // console.log("USER FOUND:");

    console.log({
      id: user.id,
      username: user.username,
      role: user.role,
      placement_done: user.placement_done,
    });

    // console.log(
    //   "PASSWORD VALUE IN DB:",
    //   user.password
    // );

    // =========================================
    // DETECT PASSWORD TYPE
    // =========================================
    const isBcryptHash =
      user.password &&
      (
        user.password.startsWith("$2a$") ||
        user.password.startsWith("$2b$") ||
        user.password.startsWith("$2y$")
      );

    console.log(
      "PASSWORD STORED AS BCRYPT:",
      isBcryptHash
    );

    let isPasswordValid = false;

    // =========================================
    // BCRYPT PASSWORD
    // =========================================
    if (isBcryptHash) {
      console.log(
        "CHECKING PASSWORD USING bcrypt.compare..."
      );

      isPasswordValid = await bcrypt.compare(
        password,
        user.password
      );

      console.log(
        "BCRYPT PASSWORD MATCH:",
        isPasswordValid
      );
    }

    // =========================================
    // OLD PLAIN-TEXT PASSWORD
    // =========================================
    else {
      console.log(
        "CHECKING OLD PLAIN-TEXT PASSWORD..."
      );

      isPasswordValid =
        user.password === password;

      console.log(
        "PLAIN-TEXT PASSWORD MATCH:",
        isPasswordValid
      );
    }

    // =========================================
    // INVALID PASSWORD
    // =========================================
    if (!isPasswordValid) {
      console.log("==============================");
      console.log("LOGIN FAILED");
      console.log("==============================");

      console.log("REASON: Password mismatch");
      console.log("USERNAME:", user.username);

      console.log("==============================\n");

      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // =========================================
    // CREATE JWT
    // =========================================
    console.log("PASSWORD VALID");

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env.JWT_EXPIRES_IN || "7d",
      }
    );

    console.log("==============================");
    console.log("LOGIN SUCCESSFUL");
    console.log("==============================");

    console.log("USER ID:", user.id);
    console.log("USERNAME:", user.username);
    console.log("ROLE:", user.role);
    console.log(
      "PLACEMENT DONE:",
      user.placement_done
    );

    console.log("==============================\n");

    return res.json({
      success: true,
      accessToken,

      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        placement_done: user.placement_done,
      },
    });
  } catch (err) {
    console.error("\n==============================");
    console.error("LOGIN-V4 ERROR");
    console.error("==============================");

    console.error("MESSAGE:", err.message);
    console.error("STACK:", err.stack);
    console.error("FULL ERROR:", err);

    console.error("==============================\n");

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  let token =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

  // FlutterFlow fallback
  if (
    !token &&
    req.body &&
    (req.body.accessToken || req.body.token)
  ) {
    token =
      req.body.accessToken || req.body.token;
  }

  // Optional query fallback
  if (
    !token &&
    req.query &&
    (req.query.accessToken || req.query.token)
  ) {
    token =
      req.query.accessToken || req.query.token;
  }

  if (!token) {
    console.log("AUTH FAILED: Missing token");

    return res.status(401).json({
      success: false,
      message: "Missing token",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (err) {
    console.log(
      "JWT VERIFY FAILED:",
      err.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// Verify current user / auto-login
router.get("/me-v3", requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

/**
 * ✅ ME V2
 * - DO NOT return req.user directly
 * - Query DB so placement_done is always fresh
 */
router.get("/me-v2", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, firstname, lastname, username, role, placement_done
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: result.rows[0], // ✅ fresh from DB
    });
  } catch (err) {
    console.error("ME-V2 ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ✅ Save placement result (called after pre-test)
router.patch("/placement-v1", requireAuth, async (req, res) => {
    console.log("PLACEMENT BODY:", req.body);
  const { reading_path, placement_score } = req.body;

  const allowedPaths = ["Foundation", "Developing", "Advanced"];

  if (!allowedPaths.includes(reading_path)) {
    return res.status(400).json({
      success: false,
      message: "Invalid reading_path",
    });
  }

  if (typeof placement_score !== "number") {
    return res.status(400).json({
      success: false,
      message: "placement_score must be a number",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET placement_done = TRUE,
           reading_path = $1,
           placement_score = $2
       WHERE id = $3
       RETURNING id, username, role, placement_done, reading_path, placement_score`,
      [reading_path, placement_score, req.user.id]
    );

    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("PLACEMENT-V1 ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

//working na to
// router.get("/users-v2", requireAuth, async (req, res) => {
//   // =========================================
// // 1. ROLE AUTHORIZATION
// // =========================================
// const allowedRoles = ["admin", "teacher", "student"];

// if (!allowedRoles.includes(req.user?.role)) {
//   return res.status(403).json({
//     success: false,
//     message: "Access denied",
//   });
// }

//   try {
//     // =========================================
//     // 2. GET QUERY PARAMETERS
//     // =========================================
//     const { role, search, sort = "az" } = req.query;

//     // =========================================
//     // 3. BUILD SQL QUERY
//     // =========================================
//     let query = `
//       SELECT
//         id,
//         username,
//         role,
//         firstname,
//         lastname
//       FROM users
//       WHERE 1 = 1
//     `;

//     const values = [];

//     // =========================================
//     // 4. FILTER BY ROLE
//     // =========================================
//     if (
//       typeof role === "string" &&
//       role !== "All" &&
//       role !== "all" &&
//       role.trim() !== ""
//     ) {
//       values.push(role.trim().toLowerCase());

//       query += ` AND role = $${values.length}`;
//     }

//     // =========================================
//     // 5. SEARCH USERS
//     // =========================================
//     if (
//       typeof search === "string" &&
//       search !== "null" &&
//       search !== "undefined" &&
//       search.trim() !== ""
//     ) {
//       values.push(`%${search.trim()}%`);

//       query += `
//         AND (
//           firstname ILIKE $${values.length}
//           OR lastname ILIKE $${values.length}
//           OR username ILIKE $${values.length}
//           OR role ILIKE $${values.length}
//         )
//       `;
//     }

//     // =========================================
//     // 6. SORT USERS
//     // =========================================
//     if (sort === "za") {
//       query += `
//         ORDER BY
//           firstname DESC,
//           lastname DESC,
//           id ASC
//       `;
//     } else {
//       query += `
//         ORDER BY
//           firstname ASC,
//           lastname ASC,
//           id ASC
//       `;
//     }

//     // =========================================
//     // 7. EXECUTE DATABASE QUERY
//     // =========================================
//     const result = await pool.query(query, values);

//     // =========================================
//     // 8. RETURN USERS
//     // =========================================
//     return res.status(200).json({
//       success: true,
//       count: result.rows.length,
//       users: result.rows,
//     });

//   } catch (error) {
//     console.error("GET USERS V2 ERROR:", error.message);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to retrieve users",
//     });
//   }
// });


router.get("/users-v2", requireAuth, async (req, res) => {
  try {
    // 1. AUTHORIZATION
    const userId = req.user?.id;
    const userRole = String(req.user?.role || "").toLowerCase();

    const allowedRoles = ["admin", "teacher", "student"];

    if (!userId || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // 2. QUERY PARAMETERS
    const { role, search, sort = "az" } = req.query;

    // 3. BASE QUERY
    let query = `
      SELECT
        id,
        username,
        role,
        firstname,
        lastname
      FROM users
      WHERE 1 = 1
    `;

    const values = [];

    // 4. JWT USER FILTER
    // Admin: Can access all users
    // Teacher/Student: Own account only
    if (userRole !== "admin") {
      values.push(userId);
      query += ` AND id = $${values.length}`;
    }

    // 5. ADMIN ROLE FILTER
    if (
      userRole === "admin" &&
      typeof role === "string" &&
      role.trim() !== "" &&
      role.toLowerCase() !== "all"
    ) {
      values.push(role.trim().toLowerCase());
      query += ` AND LOWER(role) = $${values.length}`;
    }

    // 6. ADMIN SEARCH
    if (
      userRole === "admin" &&
      typeof search === "string" &&
      search.trim() !== "" &&
      search !== "null" &&
      search !== "undefined"
    ) {
      values.push(`%${search.trim()}%`);

      query += `
        AND (
          firstname ILIKE $${values.length}
          OR lastname ILIKE $${values.length}
          OR username ILIKE $${values.length}
          OR role ILIKE $${values.length}
        )
      `;
    }

    // 7. SORT
    if (sort === "za") {
      query += `
        ORDER BY firstname DESC, lastname DESC, id ASC
      `;
    } else {
      query += `
        ORDER BY firstname ASC, lastname ASC, id ASC
      `;
    }

    // 8. EXECUTE QUERY
    const result = await pool.query(query, values);

    // 9. RETURN RESPONSE
    return res.status(200).json({
      success: true,
      count: result.rows.length,
      users: result.rows,
    });

  } catch (error) {
    console.error("GET USERS V2 ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
});


router.get('/users-stats', async (req, res) => {
  try {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE role = 'student') AS students,
        COUNT(*) FILTER (WHERE role = 'teacher') AS teachers,
        COUNT(*) FILTER (WHERE role = 'admin') AS admins
      FROM users;
    `;

    const { rows } = await pool.query(query);

    res.status(200).json({
      success: true,
      stats: {
        students: Number(rows[0].students),
        teachers: Number(rows[0].teachers),
        admins: Number(rows[0].admins),
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
    });
  }
});

router.post("/add-user", requireAuth, async (req, res) => {
  // =========================================
  // 1. ADMIN AUTHORIZATION
  // =========================================
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  const { firstname, lastname, role, teacher_id } =
    req.body || {};

  // =========================================
  // 2. VALIDATE INPUT
  // =========================================
  if (
    typeof firstname !== "string" ||
    typeof lastname !== "string" ||
    typeof role !== "string" ||
    !firstname.trim() ||
    !lastname.trim() ||
    !role.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid firstname, lastname, and role are required",
    });
  }

  const normalizedRole = role.trim().toLowerCase();
  const allowedRoles = ["student", "teacher", "admin"];

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role. Must be student, teacher, or admin.",
    });
  }

  // =========================================
  // 3. CLEAN NAMES
  // =========================================
  const cleanName = (value) =>
    String(value)
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

  const cleanFirstName = cleanName(firstname);
  const cleanLastName = cleanName(lastname);

  if (!cleanFirstName || !cleanLastName) {
    return res.status(400).json({
      success: false,
      message: "Firstname and lastname must contain valid letters",
    });
  }

  try {
    // =========================================
    // 4. VALIDATE TEACHER FOR STUDENTS
    // =========================================
    let finalTeacherId = null;

    if (normalizedRole === "student") {
      const parsedTeacherId = Number(teacher_id);

      if (
        !Number.isSafeInteger(parsedTeacherId) ||
        parsedTeacherId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid teacher_id is required for students",
        });
      }

      const teacherResult = await pool.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
          AND role = 'teacher'
        LIMIT 1
        `,
        [parsedTeacherId]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid teacher_id",
        });
      }

      finalTeacherId = parsedTeacherId;
    }

    // =========================================
    // 5. GENERATE UNIQUE USERNAME
    // =========================================
    const baseUsername =
      `${cleanLastName}.${cleanFirstName}@jhg`;

    let username = baseUsername;
    let counter = 2;

    while (true) {
      const existingUser = await pool.query(
        `
        SELECT id
        FROM users
        WHERE username = $1
        LIMIT 1
        `,
        [username]
      );

      if (existingUser.rows.length === 0) {
        break;
      }

      username =
        `${cleanLastName}.${cleanFirstName}${counter}@jhg`;

      counter++;
    }

    // =========================================
    // 6. GENERATE DEFAULT PASSWORD
    // =========================================
    // ReadVenture agreed format:
    // lastname + firstname initials + !
    //
    // Example:
    // firstname = Paolo
    // lastname  = Ad
    // password  = adP!
    //
    // Example:
    // firstname = Kenn Louis Mario
    // lastname  = Apellido
    // password  = apellidoKLM!

    const firstNameInitials = firstname
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => {
        const cleaned = cleanName(name);
        return cleaned.charAt(0).toUpperCase();
      })
      .join("");

    const generatedPassword =
      `${cleanLastName}${firstNameInitials}!`;

    // =========================================
    // 7. HASH PASSWORD
    // =========================================
    const hashedPassword = await bcrypt.hash(
      generatedPassword,
      12
    );

    // =========================================
    // 8. INSERT USER INTO POSTGRESQL
    // =========================================
    const result = await pool.query(
      `
      INSERT INTO users (
        firstname,
        lastname,
        username,
        password,
        role,
        teacher_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        firstname,
        lastname,
        username,
        role,
        teacher_id
      `,
      [
        firstname.trim(),
        lastname.trim(),
        username,
        hashedPassword,
        normalizedRole,
        finalTeacherId,
      ]
    );

    console.log("USER CREATED:", {
      id: result.rows[0].id,
      role: result.rows[0].role,
    });

    // =========================================
    // 9. RETURN USER AND DEFAULT CREDENTIALS
    // =========================================
    return res.status(201).json({
      success: true,
      message: "User added successfully.",
      user: result.rows[0],
      credentials: {
        username,
        temporary_password: generatedPassword,
      },
    });

  } catch (err) {
    console.error("ADD USER ERROR:", err.message);

    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Username already exists. Please retry.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add user",
    });
  }
});


router.post(
  "/add-users-csv",

  // 1. JWT AUTHENTICATION
  requireAuth,

  // 2. ADMIN AUTHORIZATION
  (req, res, next) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  },

  // 3. CSV FILE UPLOAD
  uploadCsvFile,

  // =========================================
  // 4. CSV PROCESSING
  // =========================================
  async (req, res) => {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    console.log(
      "CSV FILE RECEIVED:",
      req.file.originalname
    );

    let rows;
    let detectedHeaders = [];

    try {
      const csvText = req.file.buffer.toString("utf8");

      rows = parse(csvText, {
        columns: (headers) => {
          detectedHeaders = headers.map((header) =>
            String(header).trim().toLowerCase()
          );

          return detectedHeaders;
        },

        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid CSV format. Please check the file and try again.",
      });
    }

    // =========================================
    // 5. VALIDATE CSV HEADERS
    // =========================================
    const requiredColumns = [
      "firstname",
      "lastname",
      "role",
      "teacher_lastname",
    ];

    const missingColumns = requiredColumns.filter(
      (column) => !detectedHeaders.includes(column)
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid CSV format. Missing column(s): ${missingColumns.join(", ")}`,
        required_columns: requiredColumns,
      });
    }

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "CSV file contains no users.",
      });
    }

    if (rows.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maximum of 500 users per CSV import.",
      });
    }

    // =========================================
    // 6. ALLOWED CSV ROLES
    // =========================================
    // Admin accounts are created individually.
    const allowedRoles = ["student", "teacher"];

    const cleanName = (value) =>
      String(value)
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");

    // =========================================
    // 7. DATABASE TRANSACTION
    // =========================================
    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      await client.query("BEGIN");
      transactionStarted = true;

      const createdUsers = [];

      // =====================================
      // PROCESS EACH CSV ROW
      // =====================================
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        const firstname = String(
          row.firstname || ""
        ).trim();

        const lastname = String(
          row.lastname || ""
        ).trim();

        const role = String(
          row.role || ""
        ).trim().toLowerCase();

        const teacherLastname = String(
          row.teacher_lastname || ""
        ).trim();

        // ===================================
        // VALIDATE USER DATA
        // ===================================
        if (!firstname || !lastname || !role) {
          throw new Error(
            `Row ${rowNumber}: firstname, lastname, and role are required.`
          );
        }

        if (!allowedRoles.includes(role)) {
          throw new Error(
            `Row ${rowNumber}: invalid role. Only student and teacher are allowed in CSV imports.`
          );
        }

        // ===================================
        // VALIDATE STUDENT'S TEACHER
        // ===================================
        let teacherId = null;

        if (role === "student") {
          if (!teacherLastname) {
            throw new Error(
              `Row ${rowNumber}: teacher_lastname is required for students.`
            );
          }

          const teacherResult = await client.query(
            `
            SELECT
              id,
              firstname,
              lastname,
              username
            FROM users
            WHERE LOWER(TRIM(lastname)) =
                  LOWER(TRIM($1))
              AND role = 'teacher'
            `,
            [teacherLastname]
          );

          if (teacherResult.rows.length === 0) {
            throw new Error(
              `Row ${rowNumber}: teacher "${teacherLastname}" was not found.`
            );
          }

          if (teacherResult.rows.length > 1) {
            throw new Error(
              `Row ${rowNumber}: multiple teachers have the lastname "${teacherLastname}".`
            );
          }

          teacherId = teacherResult.rows[0].id;
        }

        // ===================================
        // CLEAN FIRSTNAME AND LASTNAME
        // ===================================
        const cleanFirstName = cleanName(firstname);
        const cleanLastName = cleanName(lastname);

        if (!cleanFirstName || !cleanLastName) {
          throw new Error(
            `Row ${rowNumber}: invalid firstname or lastname.`
          );
        }

        // ===================================
        // GENERATE FIRSTNAME INITIALS
        // ===================================
        const firstNameInitials = firstname
          .split(/\s+/)
          .filter(Boolean)
          .map((name) => {
            const cleaned = cleanName(name);
            return cleaned.charAt(0).toUpperCase();
          })
          .join("");

        // ===================================
        // GENERATE UNIQUE USERNAME
        // ===================================
        let username =
          `${cleanLastName}.${cleanFirstName}@jhg`;

        let counter = 2;

        while (true) {
          const existingUser = await client.query(
            `
            SELECT id
            FROM users
            WHERE username = $1
            LIMIT 1
            `,
            [username]
          );

          if (existingUser.rows.length === 0) {
            break;
          }

          username =
            `${cleanLastName}.${cleanFirstName}${counter}@jhg`;

          counter++;
        }

        // ===================================
        // GENERATE DEFAULT PASSWORD
        // ===================================
        // Same format as /auth/add-user:
        // lastname + firstname initials + !

        const generatedPassword =
          `${cleanLastName}${firstNameInitials}!`;

        // ===================================
        // HASH DEFAULT PASSWORD
        // ===================================
        const hashedPassword = await bcrypt.hash(
          generatedPassword,
          12
        );

        // ===================================
        // INSERT USER INTO POSTGRESQL
        // ===================================
        const result = await client.query(
          `
          INSERT INTO users (
            firstname,
            lastname,
            username,
            password,
            role,
            teacher_id
          )
          VALUES ($1, $2, $3, $4, $5, $6)

          RETURNING
            id,
            firstname,
            lastname,
            username,
            role,
            teacher_id
          `,
          [
            firstname,
            lastname,
            username,
            hashedPassword,
            role,
            teacherId,
          ]
        );

        // ===================================
        // COLLECT CREATED ACCOUNTS
        // ===================================
        createdUsers.push({
          ...result.rows[0],
          temporary_password: generatedPassword,
        });

        console.log("CSV USER CREATED:", {
          id: result.rows[0].id,
          role: result.rows[0].role,
        });
      }

      // =====================================
      // 8. COMMIT DATABASE TRANSACTION
      // =====================================
      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        success: true,
        message:
          `${createdUsers.length} users imported successfully.`,
        total_created: createdUsers.length,
        users: createdUsers,
      });

    } catch (err) {
      if (client && transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          console.error(
            "CSV ROLLBACK ERROR:",
            rollbackErr.message
          );
        }
      }

      console.error("CSV IMPORT ERROR:", err.message);

      const isRowError =
        /^Row \d+:/.test(err.message);

      return res.status(isRowError ? 400 : 500).json({
        success: false,
        message: isRowError
          ? err.message
          : "CSV import failed",
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// GET teachers (for assign-teacher dropdown)
router.get("/teachers", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        username,
        firstname,
        lastname,
        TRIM(
          CONCAT(
            COALESCE(firstname, ''),
            ' ',
            COALESCE(lastname, '')
          )
        ) AS display_name
      FROM users
      WHERE role = 'teacher'
      ORDER BY
        COALESCE(lastname, ''),
        COALESCE(firstname, ''),
        username
    `);

    return res.json({ success: true, count: rows.length, teachers: rows });
  } catch (err) {
    console.error("GET /teachers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE user by id
router.delete("/delete-user/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    // Protect main admin (adjust condition to your preference)
    const protectedUser = await pool.query(
      "SELECT id, username, role FROM users WHERE id = $1 LIMIT 1",
      [id]
    );

    if (protectedUser.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const u = protectedUser.rows[0];
    if (u.username === "KennDev" || u.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "This user cannot be deleted",
      });
    }

    // delete
    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New passwords do not match",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, password
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = result.rows[0];

    let isCurrentPasswordValid = false;

    // Support both old plain-text and newer bcrypt passwords
    if (
      user.password &&
      (
        user.password.startsWith("$2a$") ||
        user.password.startsWith("$2b$") ||
        user.password.startsWith("$2y$")
      )
    ) {
      isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
    } else {
      isCurrentPasswordValid = user.password === currentPassword;
    }

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE users
       SET password = $1
       WHERE id = $2`,
      [hashedNewPassword, req.user.id]
    );

    return res.json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/reset-password", async (req, res) => {
  const { username } = req.body;

  console.log("\n==============================");
  console.log("RESET PASSWORD REQUEST");
  console.log("==============================");
  console.log("USERNAME RECEIVED:", username);

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username is required",
    });
  }

  try {
    // Find existing account
    const result = await pool.query(
      `
      SELECT
        id,
        username,
        firstname,
        lastname,
        role
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      console.log("ACCOUNT NOT FOUND");

      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const user = result.rows[0];

    console.log("ACCOUNT FOUND:", {
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role,
    });

    // Clean lastname
    const cleanLastName = String(user.lastname)
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    // Get initials from firstname
    // John Paolo -> JP
    // Venice Angelica -> VA
    // Paulo -> P
    const firstNameInitials = String(user.firstname)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => name.charAt(0).toUpperCase())
      .join("");

    // Default password format:
    // lastname + firstname initials + !
    const defaultPassword =
      `${cleanLastName}${firstNameInitials}!`;

    // console.log("GENERATED DEFAULT PASSWORD:", defaultPassword);

    // Hash password
    const hashedPassword = await bcrypt.hash(
      defaultPassword,
      10
    );

    // Update user password
    await pool.query(
      `
      UPDATE users
      SET password = $1
      WHERE id = $2
      `,
      [hashedPassword, user.id]
    );

    // Verify saved password
    const verifyResult = await pool.query(
      `
      SELECT password
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [user.id]
    );

    const passwordMatch = await bcrypt.compare(
      defaultPassword,
      verifyResult.rows[0].password
    );

    console.log("PASSWORD RESET VERIFY:", passwordMatch);

    if (!passwordMatch) {
      return res.status(500).json({
        success: false,
        message: "Password reset verification failed",
      });
    }

    console.log("PASSWORD RESET SUCCESSFUL");
    console.log("==============================\n");

    return res.json({
      success: true,
      message:
        "Password reset successfully. Please change your password immediately in Settings.",
    });

  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
