const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

// List all students with their latest payment + computed status
router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT s.*, sc.name AS school_name,
            p.id AS payment_id, p.cycle_months, p.start_date, p.end_date, p.amount,
            CASE
              WHEN p.end_date < CURRENT_DATE THEN 'expired'
              WHEN p.end_date <= CURRENT_DATE + INTERVAL '5 days' THEN 'expiring'
              ELSE 'active'
            END AS status
     FROM students s
     JOIN schools sc ON sc.id = s.school_id
     LEFT JOIN LATERAL (
       SELECT * FROM payments WHERE student_id = s.id ORDER BY end_date DESC LIMIT 1
     ) p ON true
     WHERE s.owner_id = $1
     ORDER BY p.end_date NULLS LAST`,
    [req.ownerId]
  );
  res.json(result.rows);
});

// Create a student + their first payment
router.post("/", async (req, res) => {
  const { name, schoolId, parentName, parentPhone, route, cycleMonths, amount, startDate } = req.body;
  if (!name || !schoolId || !parentPhone || !cycleMonths || !startDate) {
    return res.status(400).json({ error: "name, schoolId, parentPhone, cycleMonths, startDate are required" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const studentResult = await client.query(
      `INSERT INTO students (owner_id, school_id, name, parent_name, parent_phone, route)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.ownerId, schoolId, name, parentName || null, parentPhone, route || null]
    );
    const student = studentResult.rows[0];
    const endDate = addMonths(startDate, cycleMonths);
    const paymentResult = await client.query(
      `INSERT INTO payments (student_id, owner_id, cycle_months, amount, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [student.id, req.ownerId, cycleMonths, amount || null, startDate, endDate]
    );
    await client.query("COMMIT");
    res.status(201).json({ student, payment: paymentResult.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not create student" });
  } finally {
    client.release();
  }
});

// Renew / record a new payment for an existing student
router.post("/:id/payments", async (req, res) => {
  const { cycleMonths, amount, startDate } = req.body;
  const studentId = req.params.id;
  if (!cycleMonths || !startDate) {
    return res.status(400).json({ error: "cycleMonths and startDate are required" });
  }
  const owned = await pool.query("SELECT id FROM students WHERE id = $1 AND owner_id = $2", [studentId, req.ownerId]);
  if (!owned.rows.length) return res.status(404).json({ error: "Student not found" });

  const endDate = addMonths(startDate, cycleMonths);
  const result = await pool.query(
    `INSERT INTO payments (student_id, owner_id, cycle_months, amount, start_date, end_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [studentId, req.ownerId, cycleMonths, amount || null, startDate, endDate]
  );
  res.status(201).json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  const result = await pool.query(
    "DELETE FROM students WHERE id = $1 AND owner_id = $2 RETURNING id",
    [req.params.id, req.ownerId]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Student not found" });
  res.status(204).end();
});

module.exports = router;
