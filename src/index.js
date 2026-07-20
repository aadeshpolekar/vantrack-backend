require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const authRoutes = require("./routes/auth");
const schoolRoutes = require("./routes/schools");
const studentRoutes = require("./routes/students");
const { checkExpiryAndNotify } = require("./jobs/checkExpiry");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/students", studentRoutes);

// Run once a day at 9:00 AM server time. Change the cron string to suit.
cron.schedule("0 9 * * *", () => {
  checkExpiryAndNotify().catch((err) => console.error("checkExpiry failed:", err));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`VanTrack API listening on port ${port}`));
