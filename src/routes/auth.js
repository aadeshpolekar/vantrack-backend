const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

module.exports = router;
