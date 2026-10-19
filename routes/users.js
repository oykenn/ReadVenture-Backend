import express from "express";
import { pool } from "../db.js";
import { compareSync } from "bcrypt";

import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// get all users to display (Admin acc)
router.get("/users-v2" , async(req, res) =>{
    try{
        const result = await pool.query(`SELECT id, username, role, firstname, lastname
      FROM users
      ORDER BY id ASC`);
      res.status(200).json({
        success: true,
        count: result.rows.length,
        users: result.rows
      });
    }   catch(error){
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve users"
        })
    }
});

// stat counts for cards
router.get('/users-stats', async(req, res) => {
    try {
        const query =
         `SELECT
        COUNT(*) FILTER (WHERE role = 'student') AS students,
        COUNT(*) FILTER (WHERE role = 'teacher') AS teachers,
        COUNT(*) FILTER (WHERE role = 'admin') AS admins
        FROM users;
        `;

        const { rows } = await pool.query(query)
        res.status(200).json({
            success: true,
            stats: {
                students: Number(rows[0].students),
                teachers: Number(rows[0].teachers),
                admins: Number(rows[0].admins),
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user stats',
        });
    }
});

// GET teachers (in assigning dropdown)
router.get("/teachers" , async (req,res)=>{
    try {
        const {rows} = await pool.query(
            `SELECT
             id,username,firstname, lastname,     
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
            username`
        );
        
        return res.json({
            success: true,
            count: rows.length,
            teachers: rows
        });
        
    } catch (err) {
        console.error("GET /teachers error: ", err);
        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
});

router.get("/student-profile", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        s.firstname,
        s.lastname,
        s.reading_path,
        s.username,
        t.firstname AS teacher_firstname,
        t.lastname AS teacher_lastname
      FROM users s
      LEFT JOIN users t ON s.teacher_id = t.id
      WHERE s.id = $1
      LIMIT 1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.json({
      success: true,
      profile: result.rows[0],
    });

  } catch (error) {
    console.error("STUDENT PROFILE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
export default router;

