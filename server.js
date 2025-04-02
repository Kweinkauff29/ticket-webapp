const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();  // if using SQLite
const cron = require("node-cron");
const nodemailer = require("nodemailer");

const app = express();
app.use(bodyParser.json());

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Initialize your database (or use another method)
const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run(`CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT,
    summary TEXT,
    ticketNumber TEXT,
    createdAt INTEGER,
    reminderTime INTEGER,
    completed INTEGER DEFAULT 0
  )`);
});

// Dummy summarization and ticket number functions
function summarizeText(text) {
  return text.substring(0, 100) + (text.length > 100 ? "..." : "");
}

function generateTicketNumber() {
  return "TICKET-" + Date.now();
}

app.post("/api/create-ticket", (req, res) => {
    const { description, email, phone } = req.body; // Capture additional fields
    const summary = summarizeText(description);
    const ticketNumber = generateTicketNumber();
    const createdAt = Date.now();
    const reminderTime = createdAt + 2 * 24 * 60 * 60 * 1000; // 2 days later
  
    const stmt = db.prepare(`INSERT INTO tickets (description, summary, ticketNumber, createdAt, reminderTime)
                               VALUES (?, ?, ?, ?, ?)`);
    stmt.run(description, summary, ticketNumber, createdAt, reminderTime, function (err) {
      if (err) return res.status(500).json({ error: "Database error" });
      // Include email and phone in the returned object if needed.
      res.json({
        id: this.lastID,
        description,
        summary,
        ticketNumber,
        createdAt,
        reminderTime,
        completed: 0,
        email,   // optional field
        phone    // optional field
      });
    });
    stmt.finalize();
  });

// API endpoint to mark a ticket as completed
app.post("/api/complete-ticket/:id", (req, res) => {
  const ticketId = req.params.id;
  db.run(`UPDATE tickets SET completed = 1 WHERE id = ?`, ticketId, function (err) {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ success: true });
  });
});

// Example cron job for sending email reminders (customize as needed)
cron.schedule("0 * * * *", () => {
  const now = Date.now();
  db.all(
    `SELECT * FROM tickets WHERE completed = 0 AND reminderTime <= ?`,
    now,
    (err, rows) => {
      if (err) {
        console.error("Error checking tickets:", err);
        return;
      }
      rows.forEach(ticket => {
        sendReminder(ticket);
      });
    }
  );
});

// Set up nodemailer (update with your email credentials)
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

// Listen on the port provided by Heroku
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
