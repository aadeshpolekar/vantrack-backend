const pool = require("../db");
const { sendSMS } = require("../services/sms");

// Finds each student's latest payment and, once a day:
//  - sends an "upcoming" SMS REMINDER_DAYS_BEFORE days before it lapses
//  - sends an "expired" SMS on the day it lapses
// Avoids duplicate sends by checking notifications_log for today.
async function checkExpiryAndNotify() {
  const reminderDays = Number(process.env.REMINDER_DAYS_BEFORE || 3);

  const { rows } = await pool.query(
    `SELECT s.id AS student_id, s.name AS student_name, s.parent_phone, s.owner_id,
            p.end_date,
            (p.end_date - CURRENT_DATE) AS days_left
     FROM students s
     JOIN LATERAL (
       SELECT * FROM payments WHERE student_id = s.id ORDER BY end_date DESC LIMIT 1
     ) p ON true
     WHERE p.end_date = CURRENT_DATE
        OR p.end_date = CURRENT_DATE + ($1 || ' days')::interval`,
    [reminderDays]
  );

  for (const row of rows) {
    const kind = row.days_left === 0 ? "expired" : "upcoming";

    const already = await pool.query(
      `SELECT 1 FROM notifications_log
       WHERE student_id = $1 AND kind = $2 AND sent_at::date = CURRENT_DATE`,
      [row.student_id, kind]
    );
    if (already.rows.length) continue;

    const response = await sendSMS({
      toPhone: row.parent_phone,
      studentName: row.student_name,
      endDate: row.end_date,
      kind,
    });

    await pool.query(
      `INSERT INTO notifications_log (student_id, owner_id, recipient_phone, kind, provider_response)
       VALUES ($1,$2,$3,$4,$5)`,
      [row.student_id, row.owner_id, row.parent_phone, kind, JSON.stringify(response)]
    );
  }

  console.log(`[checkExpiry] Processed ${rows.length} student(s) at ${new Date().toISOString()}`);
}

module.exports = { checkExpiryAndNotify };
