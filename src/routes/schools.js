const express = require("express");
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM schools WHERE owner_id = $1 ORDER BY name",
    [req.ownerId]
  );
  res.json(result.rows);
});

router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const result = await pool.query(
    "INSERT INTO schools (owner_id, name) VALUES ($1, $2) RETURNING *",
    [req.ownerId, name]
  );
  res.status(201).json(result.rows[0]);
});

module.exports = router;
