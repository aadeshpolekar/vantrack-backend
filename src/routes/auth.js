const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pool = require("../db");

const router = express.Router();

function sign(ownerId) {
  return jwt.sign({ ownerId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

router.post("/signup", async (req, res) => {
  const { name, vanName, email, password, phone } = req.body;
  if (!name || !vanName || !email || !password) {
    return res.status(400).json({ error: "name, vanName, email and password are required" });
  }
  try {
    const existing = await pool.query("SELECT id FROM owners WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO owners (name, van_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, van_name, email`,
      [name, vanName, email.toLowerCase(), hash, phone || null]
    );
    const owner = result.rows[0];
    res.status(201).json({ token: sign(owner.id), owner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password are required" });
  try {
    const result = await pool.query("SELECT * FROM owners WHERE email = $1", [email.toLowerCase()]);
    const owner = result.rows[0];
    if (!owner) return res.status(401).json({ error: "Email or password is incorrect" });

    const ok = await bcrypt.compare(password, owner.password_hash);
    if (!ok) return res.status(401).json({ error: "Email or password is incorrect" });

    res.json({
      token: sign(owner.id),
      owner: { id: owner.id, name: owner.name, van_name: owner.van_name, email: owner.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });
  try {
    const result = await pool.query("SELECT id, name FROM owners WHERE email = $1", [email.toLowerCase()]);
    const owner = result.rows[0];

    // Always return the same message, whether or not the email exists — avoids leaking which emails are registered
    if (owner) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        "UPDATE owners SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
        [token, expires, owner.id]
      );

      const resetUrl = `${process.env.FRONTEND_URL}?reset_token=${token}`;

      if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: email,
          subject: "Reset your VanTrack password",
          html: `<p>Hi ${owner.name},</p><p>Click below to reset your VanTrack password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });
      } else {
        console.log(`[EMAIL SKIPPED - no SMTP configured] Reset link: ${resetUrl}`);
      }
    }

    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: "token and newPassword are required" });
  try {
    const result = await pool.query(
      "SELECT id FROM owners WHERE reset_token = $1 AND reset_token_expires > now()",
      [token]
    );
    const owner = result.rows[0];
    if (!owner) return res.status(400).json({ error: "Reset link is invalid or has expired" });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE owners SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hash, owner.id]
    );

    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password" });
  }
});

module.exports = router;