import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import path from "path";
import dotenv from "dotenv";
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import nodemailer from 'nodemailer';

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
    CREATE TABLE IF NOT EXISTS reset_tokens (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
  `);

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
  const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as any[];
  const taskColumnNames = taskColumns.map(c => c.name);
  
  if (!taskColumnNames.includes('leadName')) {
    db.exec("ALTER TABLE tasks ADD COLUMN leadName TEXT");
  }
  if (!taskColumnNames.includes('leadReason')) {
    db.exec("ALTER TABLE tasks ADD COLUMN leadReason TEXT");
  }
  if (!taskColumnNames.includes('companySize')) {
    db.exec("ALTER TABLE tasks ADD COLUMN companySize TEXT");
  }
  if (!taskColumnNames.includes('estimatedBudget')) {
    db.exec("ALTER TABLE tasks ADD COLUMN estimatedBudget REAL");
  }
  if (!taskColumnNames.includes('documentUrl')) {
    db.exec("ALTER TABLE tasks ADD COLUMN documentUrl TEXT");
  }
  if (!taskColumnNames.includes('segmentation')) {
    db.exec("ALTER TABLE tasks ADD COLUMN segmentation TEXT");
  }
  if (!taskColumnNames.includes('leadType')) {
    db.exec("ALTER TABLE tasks ADD COLUMN leadType TEXT DEFAULT 'company'");
  }
  if (!taskColumnNames.includes('meetingLink')) {
    db.exec("ALTER TABLE tasks ADD COLUMN meetingLink TEXT");
  }
  if (!taskColumnNames.includes('reminderSent')) {
    db.exec("ALTER TABLE tasks ADD COLUMN reminderSent INTEGER DEFAULT 0");
  }

  console.log("Database initialized successfully");
} catch (err) {
  console.error("Database initialization error:", err);
}

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "mock_user",
    pass: process.env.SMTP_PASS || "mock_pass",
  },
});

// Reminder Cron Job (runs every minute)
cron.schedule('* * * * *', () => {
  const now = new Date();
  const tasks = db.prepare(`
    SELECT t.*, u.name as userName, u.email as userEmail 
    FROM tasks t 
    JOIN users u ON t.userId = u.id 
    WHERE t.reminderType = 'email' 
    AND t.reminderSent = 0 
    AND t.completed = 0
    AND t.dueDate IS NOT NULL
  `).all() as any[];

  tasks.forEach(async (task) => {
    const dueDate = new Date(task.dueDate);
    const timing = task.reminderTiming === '24h' ? 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
    const reminderTime = new Date(dueDate.getTime() - timing);

    if (now >= reminderTime && now < dueDate) {
      try {
        const targetEmail = task.contactInfo || task.userEmail;
        
        await transporter.sendMail({
          from: '"BrandBuilder" <noreply@brandbuilder.com>',
          to: targetEmail,
          subject: `Lembrete: ${task.text}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
              <h2 style="color: #059669;">Lembrete de Tarefa</h2>
              <p>Olá, este é um lembrete para a sua tarefa:</p>
              <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Tarefa:</strong> ${task.text}</p>
                <p><strong>Data/Hora:</strong> ${new Date(task.dueDate).toLocaleString('pt-BR')}</p>
                ${task.meetingLink ? `<p><strong>Link da Reunião:</strong> <a href="${task.meetingLink}">${task.meetingLink}</a></p>` : ''}
              </div>
              <p>Atenciosamente,<br>Equipe BrandBuilder</p>
            </div>
          `,
        });

        db.prepare("UPDATE tasks SET reminderSent = 1 WHERE id = ?").run(task.id);
        console.log(`Reminder sent for task: ${task.id} to ${targetEmail}`);
      } catch (error) {
        console.error(`Failed to send reminder for task ${task.id}:`, error);
      }
    }
  });
});

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

const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${appUrl}/auth/callback`
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
  console.log(`Register attempt for: ${email}`);
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  try {
    const id = Math.random().toString(36).substring(2, 15);
    const hashedPassword = await bcrypt.hash(password, 10);

    db.prepare("INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)").run(id, name, email, hashedPassword);
    
    const token = jwt.sign({ userId: id }, JWT_SECRET);
    if (req.session) {
      req.session.token = token;
    }
    
    console.log(`Register successful for: ${email}`);
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
  
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;

    if (!user) {
      console.log(`Login failed: User not found for ${email}`);
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for ${email}`);
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    if (req.session) {
      req.session.token = token;
    }
    console.log(`Login successful for: ${email}`);
    
    res.json({ success: true, userId: user.id, token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
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
        isPremium: !!user.isPremium,
        isGoogleConnected: !!req.session?.tokens
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

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email é obrigatório" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user) {
    // For security reasons, don't reveal if user exists
    return res.json({ success: true, message: "Se o e-mail estiver cadastrado, você receberá um link de redefinição." });
  }

  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expires = Date.now() + 3600000; // 1 hour

  db.prepare("INSERT OR REPLACE INTO reset_tokens (email, token, expires) VALUES (?, ?, ?)").run(email, token, expires);

  const resetLink = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await transporter.sendMail({
      from: '"SmartSync CRM" <noreply@smartsynccrm.com>',
      to: email,
      subject: "Redefinição de Senha - SmartSync CRM",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #059669;">Redefinição de Senha</h2>
          <p>Olá,</p>
          <p>Você solicitou a redefinição de sua senha no SmartSync CRM. Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Redefinir Minha Senha</a>
          </div>
          <p>Este link expira em 1 hora.</p>
          <p>Se você não solicitou esta alteração, ignore este e-mail.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Se o botão não funcionar, copie e cole este link no seu navegador:<br>${resetLink}</p>
        </div>
      `,
    });
    res.json({ success: true, message: "E-mail de redefinição enviado com sucesso." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ error: "Erro ao enviar e-mail de redefinição." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) return res.status(400).json({ error: "Todos os campos são obrigatórios" });

  const resetData = db.prepare("SELECT * FROM reset_tokens WHERE email = ? AND token = ?").get(email, token) as any;

  if (!resetData || resetData.expires < Date.now()) {
    return res.status(400).json({ error: "Link de redefinição inválido ou expirado." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hashedPassword, email);
    db.prepare("DELETE FROM reset_tokens WHERE email = ?").run(email);
    res.json({ success: true, message: "Senha redefinida com sucesso!" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Erro ao redefinir senha." });
  }
});

// Task Endpoints
app.get("/api/tasks", authenticate, (req: any, res) => {
  const tasks = db.prepare("SELECT * FROM tasks WHERE userId = ? ORDER BY dueDate ASC").all(req.userId);
  res.json(tasks.map((t: any) => ({ ...t, completed: !!t.completed })));
});

app.post("/api/tasks", authenticate, (req: any, res) => {
  const { 
    id, text, priority, dueDate, googleEventId, meetingLink, reminderType, reminderTiming, contactInfo,
    leadName, leadReason, companySize, estimatedBudget, documentUrl, leadType 
  } = req.body;

  // Simple Pre-qualification / Segmentation logic
  let segmentation = 'Low Interest';
  if (leadType === 'company') {
    if (estimatedBudget > 5000 || companySize === '50-200' || companySize === '200+') {
      segmentation = 'High Value Lead';
    } else if (estimatedBudget > 1000) {
      segmentation = 'Qualified Lead';
    }
  } else {
    segmentation = 'Individual Lead';
  }

  db.prepare(`
    INSERT INTO tasks (
      id, userId, text, priority, dueDate, googleEventId, meetingLink, reminderType, reminderTiming, contactInfo,
      leadName, leadReason, companySize, estimatedBudget, documentUrl, segmentation, leadType
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.userId, text, priority, dueDate, googleEventId, meetingLink || '', reminderType || 'none', reminderTiming || '1h', contactInfo || '',
    leadName || '', leadReason || '', companySize || '', estimatedBudget || 0, documentUrl || '', segmentation, leadType || 'company'
  );
  res.json({ success: true, segmentation });
});

app.put("/api/tasks/:id", authenticate, (req: any, res) => {
  const { 
    text, priority, dueDate, completed, reminderType, reminderTiming, contactInfo,
    leadName, leadReason, companySize, estimatedBudget, documentUrl, leadType, meetingLink
  } = req.body;

  // Simple Pre-qualification / Segmentation logic (same as POST)
  let segmentation = 'Low Interest';
  if (leadType === 'company') {
    if (estimatedBudget > 5000 || companySize === '50-200' || companySize === '200+') {
      segmentation = 'High Value Lead';
    } else if (estimatedBudget > 1000) {
      segmentation = 'Qualified Lead';
    }
  } else {
    segmentation = 'Individual Lead';
  }

  try {
    if (completed !== undefined && Object.keys(req.body).length === 1) {
      // Legacy support for toggleTodo
      db.prepare("UPDATE tasks SET completed = ? WHERE id = ? AND userId = ?").run(completed ? 1 : 0, req.params.id, req.userId);
    } else {
      // Full update
      db.prepare(`
        UPDATE tasks SET 
          text = COALESCE(?, text),
          priority = COALESCE(?, priority),
          dueDate = COALESCE(?, dueDate),
          completed = COALESCE(?, completed),
          reminderType = COALESCE(?, reminderType),
          reminderTiming = COALESCE(?, reminderTiming),
          contactInfo = COALESCE(?, contactInfo),
          leadName = COALESCE(?, leadName),
          leadReason = COALESCE(?, leadReason),
          companySize = COALESCE(?, companySize),
          estimatedBudget = COALESCE(?, estimatedBudget),
          documentUrl = COALESCE(?, documentUrl),
          leadType = COALESCE(?, leadType),
          meetingLink = COALESCE(?, meetingLink),
          segmentation = ?
        WHERE id = ? AND userId = ?
      `).run(
        text, priority, dueDate, completed !== undefined ? (completed ? 1 : 0) : null, 
        reminderType, reminderTiming, contactInfo,
        leadName, leadReason, companySize, estimatedBudget, documentUrl, leadType, meetingLink,
        segmentation, req.params.id, req.userId
      );
    }
    res.json({ success: true, segmentation });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
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

app.put("/api/user/profile", authenticate, (req: any, res) => {
  const { name, email } = req.body;
  try {
    db.prepare(`
      UPDATE users 
      SET name = ?, email = ?
      WHERE id = ?
    `).run(name, email, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
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
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });
    
    const event = response.data;
    res.json({
      id: event.id,
      hangoutLink: event.hangoutLink
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

app.post("/api/test-reminder", authenticate, async (req: any, res: any) => {
  const id = Math.random().toString(36).substring(2, 15);
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 61 * 60 * 1000); // 1 hour and 1 minute from now
  
  const text = "Teste de Lembrete BrandBuilder";
  const dueDate = oneHourFromNow.toISOString();
  const reminderType = 'email';
  const reminderTiming = '1h';
  const contactInfo = req.body.email || '';

  try {
    db.prepare(`
      INSERT INTO tasks (
        id, userId, text, priority, dueDate, reminderType, reminderTiming, contactInfo, completed, reminderSent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `).run(id, req.userId, text, 'high', dueDate, reminderType, reminderTiming, contactInfo);
    
    res.json({ success: true, message: "Tarefa de teste criada. O lembrete será enviado em instantes." });
  } catch (error) {
    console.error("Test reminder error:", error);
    res.status(500).json({ error: "Failed to create test reminder" });
  }
});

app.get("/api/analytics", authenticate, (req: any, res) => {
  try {
    const tasks = db.prepare("SELECT * FROM tasks WHERE userId = ?").all(req.userId) as any[];
    
    if (tasks.length === 0) {
      return res.json({
        attendanceRate: 0,
        mostScheduledTime: "N/A",
        revenueByHour: [],
        conversionByType: [],
        totalLeads: 0
      });
    }

    const now = new Date();
    const pastTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const attendedTasks = pastTasks.filter(t => t.completed === 1);
    const attendanceRate = pastTasks.length > 0 ? (attendedTasks.length / pastTasks.length) * 100 : 0;

    // Hourly analysis
    const hourlyData: Record<number, { count: number, revenue: number }> = {};
    for (let i = 0; i < 24; i++) hourlyData[i] = { count: 0, revenue: 0 };

    tasks.forEach(t => {
      if (t.dueDate) {
        const hour = new Date(t.dueDate).getHours();
        hourlyData[hour].count++;
        hourlyData[hour].revenue += (t.estimatedBudget || 0);
      }
    });

    const revenueByHour = Object.entries(hourlyData).map(([hour, data]) => ({
      hour: `${hour}:00`,
      revenue: data.revenue,
      count: data.count
    }));

    const mostScheduledHour = revenueByHour.reduce((prev, current) => (prev.count > current.count) ? prev : current);

    // Conversion by leadType
    const types = ['company', 'individual'];
    const conversionByType = types.map(type => {
      const typeTasks = tasks.filter(t => t.leadType === type);
      const typePastTasks = typeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
      const typeAttended = typePastTasks.filter(t => t.completed === 1);
      const rate = typePastTasks.length > 0 ? (typeAttended.length / typePastTasks.length) * 100 : 0;
      return {
        name: type === 'company' ? 'Empresa' : 'Individual',
        rate: Math.round(rate),
        count: typeTasks.length
      };
    });

    res.json({
      attendanceRate: Math.round(attendanceRate),
      mostScheduledTime: `${mostScheduledHour.hour}`,
      revenueByHour,
      conversionByType,
      totalLeads: tasks.length
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
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

