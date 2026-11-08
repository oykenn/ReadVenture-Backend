import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ==========================================
// FETCH OPENAI ORGANIZATION DATA
// ==========================================

async function getOpenAIData(endpoint, startTime, endTime) {
  const adminKey = process.env.OPENAI_ADMIN_KEY;

  if (!adminKey) {
    throw new Error("OPENAI_ADMIN_KEY is missing");
  }

  if (
    !Number.isInteger(startTime) ||
    !Number.isInteger(endTime) ||
    startTime >= endTime
  ) {
    throw new Error("Invalid timestamp range");
  }

  const allBuckets = [];
  let page = null;

  do {
    const url = new URL(
      `https://api.openai.com/v1/organization/${endpoint}`
    );

    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");

    if (page) {
      url.searchParams.set("page", page);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adminKey}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();

      console.error("OPENAI API ERROR:", {
        endpoint,
        status: response.status,
        message: errorBody
      });

      throw new Error(
        `OpenAI API error: ${response.status}`
      );
    }

    const data = await response.json();

    allBuckets.push(...(data.data || []));

    page = data.has_more
      ? data.next_page
      : null;

  } while (page);

  return allBuckets;
}

// ==========================================
// CALCULATE OPENAI SPENDING
// ==========================================

function calculateCosts(buckets) {
  let total = 0;

  for (const bucket of buckets) {
    for (const item of bucket.results || []) {
      total += Number(item.amount?.value || 0);
    }
  }

  return total;
}

// ==========================================
// GET ESTIMATED AI WALLET BALANCE
// FROM POSTGRESQL
// ==========================================

async function getAIWalletBalance() {
  const result = await pool.query(`
    SELECT
      starting_balance,
      current_balance,
      verified_at
    FROM ai_credit_balance
    ORDER BY verified_at DESC, id DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return {
      creditBalance: null,
      verifiedBalance: null,
      balanceCheckedAt: null,
      balanceStatus: "Balance unavailable"
    };
  }

  const record = result.rows[0];

  const verifiedBalance =
    Number(record.starting_balance);

  const creditBalance =
    record.current_balance === null
      ? null
      : Number(record.current_balance);

  const balanceCheckedAt =
    new Date(record.verified_at).toISOString();

  return {
    creditBalance,
    verifiedBalance,
    balanceCheckedAt,
    balanceStatus:
      creditBalance === null
        ? "Balance unavailable"
        : "Estimated balance"
  };
}

// ==========================================
// GET /admin/ai-usage
// ==========================================

router.get("/ai-usage", async (req, res) => {
  try {
    const now = new Date();

    const endTime = Math.floor(
      now.getTime() / 1000
    );

    // First day of current month (UTC)
    const monthStart = Math.floor(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1
      ) / 1000
    );

    // Last 7 days
    const sevenDaysAgo =
      endTime - 7 * 86400;

    // Get wallet balance directly from PostgreSQL
    const wallet = await getAIWalletBalance();

    // Retrieve official OpenAI usage and costs
    const [costs, usage] = await Promise.all([
      getOpenAIData(
        "costs",
        monthStart,
        endTime
      ),

      getOpenAIData(
        "usage/completions",
        sevenDaysAgo,
        endTime
      )
    ]);

    // ======================================
    // CURRENT MONTH SPENDING
    // ======================================

    const amountSpent = calculateCosts(costs);

    // ======================================
    // LAST 7 DAYS TOKENS AND REQUESTS
    // ======================================

    let totalTokens = 0;
    let totalRequests = 0;

    for (const bucket of usage) {
      for (const item of bucket.results || []) {
        totalTokens +=
          Number(item.input_tokens || 0) +
          Number(item.output_tokens || 0);

        totalRequests +=
          Number(item.num_model_requests || 0);
      }
    }

    // ======================================
    // SEND RESPONSE TO FLUTTERFLOW
    // ======================================

    return res.status(200).json({
      success: true,

      // Official OpenAI spending this month
      amount_spent: Number(
        amountSpent.toFixed(4)
      ),

      // Official last 7 days text-model usage
      total_tokens: totalTokens,
      ai_requests: totalRequests,

      // Current estimated wallet from PostgreSQL
      credit_balance: wallet.creditBalance,

      // Last manually verified starting balance
      verified_balance: wallet.verifiedBalance,

      // No longer calculated using OpenAI costs,
      // to avoid double-counting existing deductions.
      spent_since_verification: null,

      credit_balance_status:
        wallet.balanceStatus,

      balance_checked_at:
        wallet.balanceCheckedAt,

      currency: "USD",

      spending_period: "Current month UTC",
      usage_period: "Last 7 days",

      // Clarify the two different sources.
      source: "OpenAI Organization API",
      balance_source: "ReadVenture PostgreSQL",

      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error(
      "AI USAGE ERROR:",
      error.message
    );

    return res.status(502).json({
      success: false,
      message:
        "Unable to retrieve OpenAI usage data"
    });
  }
});

router.put("/ai-wallet/sync", async (req, res) => {
  try {
    // Verify JWT from Authorization header
    const authHeader = req.headers.authorization || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const jwt = (await import("jsonwebtoken")).default;

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const adminResult = await pool.query(
      `
      SELECT id, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [decoded.id]
    );

    if (
      adminResult.rows.length === 0 ||
      adminResult.rows[0].role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin access required."
      });
    }

    // Validate verified OpenAI balance
    const { verified_balance } = req.body || {};

    if (
      verified_balance === undefined ||
      verified_balance === null ||
      typeof verified_balance !== "number" ||
      !Number.isFinite(verified_balance) ||
      verified_balance < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid balance is required."
      });
    }

    // Update existing AI wallet record.
    // Keep starting_balance in sync with the
    // newly verified baseline.
    const result = await pool.query(
      `
      UPDATE ai_credit_balance
      SET
        starting_balance = $1,
        current_balance = $1,
        verified_at = NOW()
      WHERE id = (
        SELECT id
        FROM ai_credit_balance
        ORDER BY verified_at DESC, id DESC
        LIMIT 1
      )
      RETURNING
        id,
        starting_balance,
        current_balance,
        verified_at
      `,
      [verified_balance]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "AI wallet record not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "AI wallet balance synchronized successfully.",
      credit_balance: Number(
        result.rows[0].current_balance
      ),
      verified_balance: Number(
        result.rows[0].starting_balance
      ),
      balance_checked_at:
        result.rows[0].verified_at,
      currency: "USD"
    });

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please log in again."
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    console.error("AI WALLET SYNC ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to synchronize AI wallet balance."
    });
  }
});

export default router;

