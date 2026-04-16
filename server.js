const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MySQL config
const db = mysql.createPool({
  host: "127.0.0.1",
  user: "root",
  password: "mahimajoshi123",
  database: "stress_db",
  waitForConnections: true,
  connectionLimit: 10,
});

// Ensure 'uploads' directory exists and is accessible
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Uploads directory created");
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);  
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Init DB
(async () => {
  try {
    const conn = await db.promise().getConnection();

    // Create 'users' table if not exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255),
        profile_image VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create 'stress_results' table for saving stress data
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stress_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        stress_level INT,
        detection_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    conn.release();
    console.log("MySQL connected and tables ensured");
  } catch (err) {
    console.error("DB Error:", err);
  }
})();

// Signup
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "Missing fields" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.promise().execute(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, hash]
    );
    res.json({ token: String(result.insertId), userId: result.insertId, name, email });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.promise().execute("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(400).json({ error: "Invalid credentials" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ token: String(user.id), userId: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Save stress result to DB
app.post("/api/save-stress", async (req, res) => {
  const { userId, stress_level, sentiment_neg, keywords, classifier_confidence, total_score, input_text } = req.body;

  // Check if any required fields are missing
  if (!userId || stress_level == null || sentiment_neg == null || keywords == null || classifier_confidence == null || total_score == null || input_text == null) {
    return res.status(400).json({ error: "Missing one or more fields" });
  }

  try {
    // Insert all values into the database
    await db.promise().execute(
      "INSERT INTO stress_results (user_id, stress_level, sentiment_neg, keywords, classifier_confidence, total_score, input_text) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, stress_level, sentiment_neg, keywords, classifier_confidence, total_score, input_text]  // Passing all values
    );
    res.json({ message: "Stress result saved successfully" });
  } catch (err) {
    console.error("Error saving stress result:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/get-stress-results", async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const [rows] = await db.promise().execute(
      "SELECT input_text, stress_level, keywords, sentiment_neg, classifier_confidence, total_score, created_at FROM stress_results WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching results:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.post('/api/camera-result', async (req, res) => {
  const { userId, stressLevel, detectedEmotion } = req.body;

  if (!userId || !stressLevel || !detectedEmotion) {
    return res.status(400).send("Missing required fields.");
  }

  try {
    await db.query(
      'INSERT INTO camera_results (user_id, stress_level, emotion) VALUES (?, ?, ?)',
      [userId, stressLevel, detectedEmotion]
    );
    res.status(200).send("Saved successfully.");
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).send("Database error.");
  }
});


app.get('/api/camera-results', async (req, res) => {
  const userId = req.query.userId;
  console.log('Received userId:', userId);

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  try {
    const [results] = await db.promise().execute(
      'SELECT * FROM camera_results WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    console.log(`Fetched ${results.length} camera results for userId=${userId}`);
    res.json(results);
  } catch (err) {
    console.error('Error fetching camera results:', err);
    res.status(500).json({ error: 'Server error' });
  }
});





// Multer File Upload for Profile
app.post("/api/upload-profile", upload.single("profile"), async (req, res) => {
  const userId = req.body.userId;
  if (!req.file || !userId) {
    console.error("Upload error: Missing file or userId");
    return res.status(400).json({ error: "Missing data" });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  try {
    const [result] = await db.promise().execute("UPDATE users SET profile_image = ? WHERE id = ?", [imageUrl, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found or update failed" });
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Fetch Profile Photo
app.get("/api/profile-image/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.promise().execute("SELECT profile_image FROM users WHERE id = ?", [userId]);
    if (rows.length === 0 || !rows[0].profile_image) {
      return res.status(404).json({ error: "No image" });
    }
    res.json({ imageUrl: rows[0].profile_image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch error" });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
