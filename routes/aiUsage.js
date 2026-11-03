
// import express from "express";
// import { pool } from "../db.js";

// const router = express.Router();

// // Fetch actual OpenAI usage and cost information
// async function getOpenAIData(endpoint, startTime, endTime) {
//   const adminKey = process.env.OPENAI_ADMIN_KEY;

//   if (!adminKey) {
//     throw new Error("OPENAI_ADMIN_KEY is missing");
//   }

//   if (
//     !Number.isInteger(startTime) ||
//     !Number.isInteger(endTime) ||
//     startTime >= endTime
//   ) {
//     throw new Error("Invalid timestamp range");
//   }

//   const allBuckets = [];
//   let page = null;

//   do {
//     const url = new URL(
//       `https://api.openai.com/v1/organization/${endpoint}`
//     );

//     url.searchParams.set("start_time", String(startTime));
//     url.searchParams.set("end_time", String(endTime));
//     url.searchParams.set("bucket_width", "1d");
//     url.searchParams.set("limit", "31");

//     if (page) {
//       url.searchParams.set("page", page);
//     }

//     const response = await fetch(url, {
//       headers: {
//         Authorization: `Bearer ${adminKey}`
//       }
//     });

//     if (!response.ok) {
//       const errorBody = await response.text();

//       console.error("OPENAI API ERROR:", {
//         endpoint,
//         status: response.status,
//         message: errorBody
//       });

//       throw new Error(`OpenAI API error: ${response.status}`);
//     }

//     const data = await response.json();

//     allBuckets.push(...(data.data || []));
//     page = data.has_more ? data.next_page : null;

//   } while (page);

//   return allBuckets;
// }

// // Calculate spending from OpenAI cost buckets
// function calculateCosts(buckets) {
//   let total = 0;

//   for (const bucket of buckets) {
//     for (const item of bucket.results || []) {
//       total += Number(item.amount?.value || 0);
//     }
//   }

//   return total;
// }

// // GET /admin/ai-usage
// router.get("/ai-usage", async (req, res) => {
//   try {
//     const now = new Date();
//     const endTime = Math.floor(now.getTime() / 1000);

//     // First day of current month (UTC)
//     const monthStart = Math.floor(
//       Date.UTC(
//         now.getUTCFullYear(),
//         now.getUTCMonth(),
//         1
//       ) / 1000
//     );

//     // Last 7 days
//     const sevenDaysAgo = endTime - 7 * 86400;

//     // Retrieve last manually verified balance
//     const balanceResult = await pool.query(`
//       SELECT starting_balance, verified_at
//       FROM ai_credit_balance
//       ORDER BY verified_at DESC, id DESC
//       LIMIT 1
//     `);

//     const balanceRecord = balanceResult.rows[0] || null;

//     // OpenAI organization costs and text-model usage
//     const [costs, usage] = await Promise.all([
//       getOpenAIData("costs", monthStart, endTime),
//       getOpenAIData(
//         "usage/completions",
//         sevenDaysAgo,
//         endTime
//       )
//     ]);

//     const amountSpent = calculateCosts(costs);

//     let totalTokens = 0;
//     let totalRequests = 0;

//     for (const bucket of usage) {
//       for (const item of bucket.results || []) {
//         totalTokens +=
//           Number(item.input_tokens || 0) +
//           Number(item.output_tokens || 0);

//         totalRequests += Number(item.num_model_requests || 0);
//       }
//     }

//     // Estimated remaining credits
//     let verifiedBalance = null;
//     let estimatedBalance = null;
//     let spentSinceVerification = null;
//     let balanceCheckedAt = null;

//     if (balanceRecord) {
//       verifiedBalance = Number(balanceRecord.starting_balance);

//       const verifiedDate = new Date(balanceRecord.verified_at);
//       balanceCheckedAt = verifiedDate.toISOString();

//       const verifiedTime = Math.floor(
//         verifiedDate.getTime() / 1000
//       );

//       if (verifiedTime < endTime) {
//         // Include the verification day and same-day
//         // spending reported by OpenAI.
//         const balanceCosts = await getOpenAIData(
//           "costs",
//           verifiedTime,
//           endTime
//         );

//         spentSinceVerification = calculateCosts(balanceCosts);
//       } else {
//         spentSinceVerification = 0;
//       }

//       estimatedBalance = Math.max(
//         0,
//         verifiedBalance - spentSinceVerification
//       );
//     }

//     return res.status(200).json({
//       success: true,

//       // Current month spending
//       amount_spent: Number(amountSpent.toFixed(4)),

//       // Last 7 days text-model usage
//       total_tokens: totalTokens,
//       ai_requests: totalRequests,

//       // Estimated credits
//       credit_balance:
//         estimatedBalance === null
//           ? null
//           : Number(estimatedBalance.toFixed(2)),

//       verified_balance: verifiedBalance,

//       spent_since_verification:
//         spentSinceVerification === null
//           ? null
//           : Number(spentSinceVerification.toFixed(4)),

//       credit_balance_status: balanceRecord
//         ? "Estimated balance"
//         : "Balance unavailable",

//       balance_checked_at: balanceCheckedAt,

//       currency: "USD",
//       spending_period: "Current month UTC",
//       usage_period: "Last 7 days",
//       source: "OpenAI Organization API",
//       last_updated: new Date().toISOString()
//     });

//   } catch (error) {
//     console.error("AI USAGE ERROR:", error.message);

//     return res.status(502).json({
//       success: false,
//       message: "Unable to retrieve OpenAI usage data"
//     });
//   }
// });

// export default router;



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

export default router;

