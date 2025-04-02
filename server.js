import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { Pool } from "pg";
import cron from "node-cron";
import nodemailer from "nodemailer";
import { Configuration, OpenAIApi } from "openai";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Postgres Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // Uncomment if needed
});

// Create table if not exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        description TEXT,
        summary TEXT,
        ticketNumber TEXT,
        createdAt BIGINT,
        reminderTime BIGINT,
        completed INT DEFAULT 0
      );
    `);
    console.log("Table 'tickets' is ready.");
  } catch (err) {
    console.error("Error creating table:", err);
  }
})();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Summarize function
function summarizeText(text) {
  return text.substring(0, 100) + (text.length > 100 ? "..." : "");
}

function generateTicketNumber() {
  return "TICKET-" + Date.now();
}

// Create ticket
app.post("/api/create-ticket", async (req, res) => {
  try {
    const { description, email, phone, noAI } = req.body;
    const summary = summarizeText(description);
    const ticketNumber = generateTicketNumber();
    const createdAt = Date.now();
    const reminderTime = createdAt + 2 * 24 * 60 * 60 * 1000;

    const insertQuery = `
      INSERT INTO tickets (description, summary, ticketNumber, createdAt, reminderTime)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const result = await pool.query(insertQuery, [
      description,
      summary,
      ticketNumber,
      createdAt,
      reminderTime
    ]);
    const insertedId = result.rows[0].id;

    res.json({
      id: insertedId,
      description,
      summary,
      ticketNumber,
      createdAt,
      reminderTime,
      completed: 0,
      email,
      phone,
      noAI
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Complete ticket
app.post("/api/complete-ticket/:id", async (req, res) => {
  try {
    const ticketId = req.params.id;
    const updateQuery = `UPDATE tickets SET completed = 1 WHERE id = $1`;
    await pool.query(updateQuery, [ticketId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Cron for reminders
cron.schedule("0 * * * *", async () => {
  try {
    const now = Date.now();
    const selectQuery = `
      SELECT * FROM tickets
      WHERE completed = 0
      AND reminderTime <= $1
    `;
    const result = await pool.query(selectQuery, [now]);
    const rows = result.rows;

    rows.forEach(ticket => {
      sendReminder(ticket);
    });
  } catch (err) {
    console.error("Error checking tickets:", err);
  }
});

// Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your.email@gmail.com",
    pass: process.env.EMAIL_PASS || "your_app_password"
  }
});

function sendReminder(ticket) {
  const mailOptions = {
    from: process.env.EMAIL_USER || "your.email@gmail.com",
    to: process.env.EMAIL_USER || "your.email@gmail.com",
    subject: `Reminder: Ticket ${ticket.ticketNumber} is pending`,
    text: `Ticket ${ticket.ticketNumber} summary: ${ticket.summary}\nPlease complete this ticket.`
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error("Error sending reminder:", error);
    else console.log("Reminder sent:", info.response);
  });
}

// AI process endpoint
app.post("/api/ai-process", async (req, res) => {
  try {
    const { description, email, phone, noAI } = req.body;
    if (noAI) {
      return res.json({
        condensed: "AI processing skipped.",
        inProgressSubject: "Ticket In-Progress",
        inProgressText: "Please update your ticket manually."
      });
    }
    const prompt = `...`;

    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });
    const responseText = completion.data.choices[0].message.content;

    let aiData;
    try {
      aiData = JSON.parse(responseText);
    } catch (err) {
      console.error("Error parsing AI response:", err);
      aiData = {
        condensed: "Condensed summary unavailable.",
        inProgressSubject: "Ticket In-Progress",
        inProgressText: "We are working on your ticket.",
      };
    }
    res.json(aiData);
  } catch (error) {
    console.error("Error in /api/ai-process:", error);
    res.status(500).json({ error: "Failed to process AI request" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
