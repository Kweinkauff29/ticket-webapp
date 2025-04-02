import express from "express";
import bodyParser from "body-parser";
import path from "path";
import pkg from "pg"; // Import the default export from pg
const { Pool } = pkg;
import cron from "node-cron";
import nodemailer from "nodemailer";
// import { Configuration, OpenAIApi } from "openai";  // Commented out AI integration
import { fileURLToPath } from "url";
import { dirname } from "path";

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Initialize Heroku PostgreSQL connection pool using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create the tickets table if it doesn't exist and add an "assignee" column
pool.query(
  `CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    description TEXT,
    summary TEXT,
    ticketNumber TEXT,
    createdAt BIGINT,
    reminderTime BIGINT,
    completed INTEGER DEFAULT 0,
    email TEXT,
    phone TEXT,
    assignee TEXT DEFAULT 'Kevin'
  )`,
  (err) => {
    if (err) {
      console.error("Error creating tickets table:", err);
    } else {
      console.log("Tickets table is ready.");
    }
  }
);

// Dummy summarization and ticket number functions
function summarizeText(text) {
  return text.substring(0, 100) + (text.length > 100 ? "..." : "");
}

function generateTicketNumber() {
  return "TICKET-" + Date.now();
}

// Endpoint to create a ticket
app.post("/api/create-ticket", async (req, res) => {
  const { description, email, phone } = req.body;
  const summary = summarizeText(description);
  const ticketNumber = generateTicketNumber();
  const createdAt = Date.now();
  const reminderTime = createdAt + 2 * 24 * 60 * 60 * 1000; // 2 days later
  // Default assignee is set to "Kevin" (could be made dynamic later)
  const assignee = "Kevin";

  try {
    const result = await pool.query(
      `INSERT INTO tickets (description, summary, ticketNumber, createdAt, reminderTime, email, phone, assignee)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [description, summary, ticketNumber, createdAt, reminderTime, email, phone, assignee]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET endpoint to retrieve all tickets (active & completed)
app.get("/api/tickets", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM tickets ORDER BY createdAt DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Endpoint to mark a ticket as completed
app.post("/api/complete-ticket/:id", async (req, res) => {
  const ticketId = req.params.id;
  try {
    await pool.query(`UPDATE tickets SET completed = 1 WHERE id = $1`, [ticketId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Cron job for sending email reminders
cron.schedule("0 * * * *", async () => {
  const now = Date.now();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tickets WHERE completed = 0 AND reminderTime <= $1`,
      [now]
    );
    rows.forEach((ticket) => {
      sendReminder(ticket);
    });
  } catch (err) {
    console.error("Error checking tickets:", err);
  }
});

// Set up nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "your.email@gmail.com",
    pass: process.env.EMAIL_PASS || "your_app_password",
  },
});

function sendReminder(ticket) {
  const mailOptions = {
    from: process.env.EMAIL_USER || "your.email@gmail.com",
    to: process.env.EMAIL_USER || "your.email@gmail.com",
    subject: `Reminder: Ticket ${ticket.ticketNumber} is pending`,
    text: `Ticket ${ticket.ticketNumber} summary: ${ticket.summary}\nPlease complete this ticket.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.error("Error sending reminder:", error);
    else console.log("Reminder sent:", info.response);
  });
}

// AI-related endpoint is commented out
// app.post("/api/ai-process", async (req, res) => { ... });

// /api/send-email Endpoint
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const mailOptions = {
      from: process.env.EMAIL_USER || "your.email@gmail.com",
      to: to,
      subject: subject,
      text: text,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Failed to send email" });
      } else {
        res.json({ success: true, info: info.response });
      }
    });
  } catch (error) {
    console.error("Error in /api/send-email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// Listen on the port provided by Heroku
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
