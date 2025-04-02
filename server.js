import express from "express";
import bodyParser from "body-parser";
import path from "path";
import pkg from "pg"; // Use the default export from pg
const { Pool } = pkg;
import cron from "node-cron";
import nodemailer from "nodemailer";
import { Configuration, OpenAIApi } from "openai";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
app.use(bodyParser.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Initialize Heroku PostgreSQL connection pool using DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Heroku Postgres requires SSL with this setting
  ssl: {
    rejectUnauthorized: false,
  },
});

// Create the tickets table if it doesn't exist
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
    phone TEXT
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
  const { description, email, phone, noAI } = req.body; // Capture additional fields including the noAI flag
  const summary = summarizeText(description);
  const ticketNumber = generateTicketNumber();
  const createdAt = Date.now();
  const reminderTime = createdAt + 2 * 24 * 60 * 60 * 1000; // 2 days later

  try {
    const result = await pool.query(
      `INSERT INTO tickets (description, summary, ticketNumber, createdAt, reminderTime, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [description, summary, ticketNumber, createdAt, reminderTime, email, phone]
    );
    res.json(result.rows[0]);
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

// /api/ai-process Endpoint
app.post("/api/ai-process", async (req, res) => {
  try {
    const { description, email, phone, noAI } = req.body;

    // If noAI flag is true, bypass AI processing and return default values
    if (noAI) {
      return res.json({
        condensed: "AI processing skipped.",
        inProgressSubject: "Ticket In-Progress",
        inProgressText: "Please update your ticket manually.",
      });
    }

    // Build a prompt for the AI
    const prompt = `
You are an AI assistant that condenses a ticket description and extracts any contact information, then creates an "in-progress" email subject and message for follow-up.

Ticket Description: ${description}
Contact Email: ${email || "None"}
Contact Phone: ${phone || "None"}

Provide the output in JSON format with these keys:
- "condensed": A condensed summary of the ticket that prioritizes contact information.
- "inProgressSubject": A suggested subject line for an in-progress update.
- "inProgressText": A suggested message text for an in-progress update.

Return only the JSON.
    `;

    // Call OpenAI's API using Chat Completion (GPT-4)
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    // Get the response text from OpenAI
    const responseText = completion.data.choices[0].message.content;

    // Try to parse the JSON response
    let aiData;
    try {
      aiData = JSON.parse(responseText);
    } catch (err) {
      console.error("Error parsing AI response:", err);
      // Fallback values if parsing fails
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

// /api/send-email Endpoint
app.post("/api/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const mailOptions = {
      from: process.env.EMAIL_USER || "your.email@gmail.com",
      to: to, // recipient email address
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
