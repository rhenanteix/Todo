import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import path from "path";
import dotenv from "dotenv";
import Database from 'better-sqlite3';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const db = new Database('brandbuilder.db');

// Initialize DB
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  // Migration: Add missing columns if they don't exist
  const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('name')) {
    db.exec("ALTER TABLE users ADD COLUMN name TEXT");
  }
  if (!columnNames.includes('isPremium')) {
    db.exec("ALTER TABLE users ADD COLUMN isPremium INTEGER DEFAULT 0");
  }
  if (!columnNames.includes('brandName')) {
    db.exec("ALTER TABLE users ADD COLUMN brandName TEXT");
  }
  if (!columnNames.includes('logoUrl')) {
    db.exec("ALTER TABLE users ADD COLUMN logoUrl TEXT");
  }
  if (!columnNames.includes('primaryColor')) {
    db.exec("ALTER TABLE users ADD COLUMN primaryColor TEXT DEFAULT '#059669'");
  }
  if (!columnNames.includes('customDomain')) {
    db.exec("ALTER TABLE users ADD COLUMN customDomain TEXT");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      userId TEXT,
      text TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      priority TEXT,
      dueDate TEXT,
      googleEventId TEXT,
      reminderType TEXT,
      reminderTiming TEXT,
      contactInfo TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
  `);
  console.log("Database initialized successfully");
} catch (err) {
  console.error("Database initialization error:", err);
}

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "brandbuilder-secret-key";

app.set('trust proxy', 1);

app.use(express.json());
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "brandbuilder-session-secret"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: "none",
  })
);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/callback`
);

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.session?.token;

  if (!token) {
    console.log("Auth Middleware: No token found in header or session");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error("Auth Middleware: Token verification failed", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  try {
    const id = Math.random().toString(36).substring(2, 15);
    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare("INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)").run(id, name, email, hashedPassword);
    
    const token = jwt.sign({ userId: id }, JWT_SECRET);
    req.session!.token = token;
    
    res.json({ success: true, userId: id, token });
  } catch (err: any) {
    console.error("Register Error:", err);
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }
    res.status(500).json({ error: `Erro ao criar usuário: ${err.message || 'Erro desconhecido'}` });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt for: ${email}`);
  
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

  if (!user || !(await bcrypt.compare(password, user.password))) {
    console.log(`Login failed for: ${email}`);
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  req.session!.token = token;
  console.log(`Login successful and session set for: ${email}. Token: ${token.substring(0, 10)}...`);
  
  res.json({ success: true, userId: user.id, token });
});

app.get("/api/auth/status", (req: any, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.session?.token;

  if (!token) {
    console.log("No token found in status check");
    return res.json({ isAuthenticated: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare("SELECT id, name, email, isPremium, brandName, logoUrl, primaryColor, customDomain FROM users WHERE id = ?").get(decoded.userId) as any;
    
    if (!user) {
      console.log("User not found for token:", decoded.userId);
      return res.json({ isAuthenticated: false });
    }
    
    res.json({ 
      isAuthenticated: true,
      user: {
        ...user,
        isPremium: !!user.isPremium
      }
    });
  } catch (err) {
    console.error("Token verification failed in status check:", err);
    res.json({ isAuthenticated: false });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// Task Endpoints
app.get("/api/tasks", authenticate, (req: any, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE userId = ? ORDER BY dueDate ASC").all(req.userId);
  res.json(tasks.map((t: any) => ({ ...t, completed: !!t.completed })));
});

app.post("/api/tasks", authenticate, (req: any, res) => {
  const { id, text, priority, dueDate, googleEventId, reminderType, reminderTiming, contactInfo } = req.body;
  db.prepare(`
    INSERT INTO tasks (id, userId, text, priority, dueDate, googleEventId, reminderType, reminderTiming, contactInfo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, text, priority, dueDate, googleEventId, reminderType || 'none', reminderTiming || '1h', contactInfo || '');
  res.json({ success: true });
});

app.put("/api/tasks/:id", authenticate, (req: any, res) => {
  const { completed } = req.body;
  db.prepare("UPDATE tasks SET completed = ? WHERE id = ? AND userId = ?").run(completed ? 1 : 0, req.params.id, req.userId);
  res.json({ success: true });
});

app.delete("/api/tasks/:id", authenticate, (req: any, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ? AND userId = ?").run(req.params.id, req.userId);
  res.json({ success: true });
});

// Branding Routes
app.put("/api/user/branding", authenticate, (req: any, res) => {
  const { brandName, logoUrl, primaryColor, customDomain } = req.body;
  
  const user = db.prepare("SELECT isPremium FROM users WHERE id = ?").get(req.userId) as any;
  if (!user?.isPremium) {
    return res.status(403).json({ error: "Esta funcionalidade é exclusiva para usuários Premium." });
  }

  db.prepare(`
    UPDATE users 
    SET brandName = ?, logoUrl = ?, primaryColor = ?, customDomain = ?
    WHERE id = ?
  `).run(brandName, logoUrl, primaryColor, customDomain, req.userId);
  res.json({ success: true });
});

// Finance Routes
app.get("/api/finance/pix-qr", authenticate, (req, res) => {
  const cnpj = "27900115000199";
  const payload = `00020126360014BR.GOV.BCB.PIX0114${cnpj}5204000053039865802BR5913BrandBuilder6009SAO PAULO62070503***6304E22D`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payload)}`;
  
  res.json({
    qrCode: qrCodeUrl,
    payload: payload
  });
});

app.post("/api/finance/confirm-payment", authenticate, (req: any, res) => {
  db.prepare("UPDATE users SET isPremium = 1 WHERE id = ?").run(req.userId);
  res.json({ success: true });
});

// Google Calendar Proxy
app.get("/api/auth/google/url", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
  });
  res.json({ url });
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    req.session!.tokens = tokens;
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/calendar/events", async (req, res) => {
  if (!req.session?.tokens) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: "startTime",
    });
    res.json(response.data.items);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.post("/api/calendar/events", async (req, res) => {
  if (!req.session?.tokens) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { summary, description, startDateTime, endDateTime } = req.body;

  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary,
        description,
        start: { dateTime: startDateTime, timeZone: "UTC" },
        end: { dateTime: endDateTime, timeZone: "UTC" },
        conferenceData: {
          createRequest: {
            requestId: Math.random().toString(36).substring(7),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.resolve();
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

