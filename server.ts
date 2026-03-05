import express from "express";
import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import db, { initDb } from "./db.js";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

app.use(express.json());

// Initialize Database
initDb();

// --- Middleware ---

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const authorizeRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Unauthorized access" });
    }
    next();
  };
};

// --- Auth Routes ---

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, fullName: user.full_name } });
});

// --- Houses Routes ---

app.get("/api/houses", authenticateToken, (req, res) => {
  const houses = db.prepare(`
    SELECT h.*, t.full_name as tenant_name 
    FROM houses h 
    LEFT JOIN tenants t ON h.id = t.house_id
  `).all();
  res.json(houses);
});

app.post("/api/houses", authenticateToken, authorizeRole(['LANDLORD']), (req, res) => {
  const { house_number, rent_amount } = req.body;
  try {
    const result = db.prepare('INSERT INTO houses (house_number, rent_amount) VALUES (?, ?)')
      .run(house_number, rent_amount);
    res.json({ id: result.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/houses/:id", authenticateToken, authorizeRole(['LANDLORD']), (req, res) => {
  const { house_number, rent_amount, status } = req.body;
  try {
    db.prepare('UPDATE houses SET house_number = ?, rent_amount = ?, status = ? WHERE id = ?')
      .run(house_number, rent_amount, status, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/houses/:id", authenticateToken, authorizeRole(['LANDLORD']), (req, res) => {
  try {
    db.prepare('DELETE FROM houses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Tenants Routes ---

app.get("/api/tenants", authenticateToken, (req, res) => {
  const tenants = db.prepare(`
    SELECT t.*, h.house_number, h.rent_amount as monthly_rent
    FROM tenants t
    LEFT JOIN houses h ON t.house_id = h.id
  `).all();
  res.json(tenants);
});

app.get("/api/tenants/:id", authenticateToken, (req, res) => {
  const tenant: any = db.prepare(`
    SELECT t.*, h.house_number, h.rent_amount as monthly_rent
    FROM tenants t
    LEFT JOIN houses h ON t.house_id = h.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const payments = db.prepare('SELECT * FROM payments WHERE tenant_id = ? ORDER BY payment_date DESC').all(req.params.id);
  const records = db.prepare('SELECT * FROM monthly_rent_records WHERE tenant_id = ? ORDER BY month_year DESC').all(req.params.id);

  res.json({ ...tenant, payments, records });
});

app.post("/api/tenants", authenticateToken, (req, res) => {
  const { full_name, phone, national_id, house_id, entry_date, security_deposit } = req.body;
  
  const transaction = db.transaction(() => {
    // Insert tenant
    const result = db.prepare(`
      INSERT INTO tenants (full_name, phone, national_id, house_id, entry_date, security_deposit)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(full_name, phone, national_id, house_id, entry_date, security_deposit);
    
    const tenantId = result.lastInsertRowid;

    // Update house status
    if (house_id) {
      db.prepare("UPDATE houses SET status = 'OCCUPIED' WHERE id = ?").run(house_id);
      
      // Create initial monthly record for the entry month
      const monthYear = entry_date.substring(0, 7); // YYYY-MM
      const house: any = db.prepare('SELECT rent_amount FROM houses WHERE id = ?').get(house_id);
      
      db.prepare(`
        INSERT INTO monthly_rent_records (tenant_id, month_year, rent_due, arrears_brought_forward, total_due, balance)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tenantId, monthYear, house.rent_amount, 0, house.rent_amount, house.rent_amount);
    }

    return tenantId;
  });

  try {
    const tenantId = transaction();
    res.json({ id: tenantId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Payments Routes ---

app.post("/api/payments", authenticateToken, (req, res) => {
  const { tenant_id, amount, payment_date, month_year, type } = req.body;
  const recorded_by = (req as any).user.id;

  const transaction = db.transaction(() => {
    // Record payment
    db.prepare(`
      INSERT INTO payments (tenant_id, amount, payment_date, month_year, type, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tenant_id, amount, payment_date, month_year, type, recorded_by);

    if (type === 'RENT') {
      // Update monthly record
      let record: any = db.prepare('SELECT * FROM monthly_rent_records WHERE tenant_id = ? AND month_year = ?')
        .get(tenant_id, month_year);

      if (!record) {
        // If record doesn't exist (e.g. advance payment for future month), create it
        const tenant: any = db.prepare('SELECT house_id FROM tenants WHERE id = ?').get(tenant_id);
        const house: any = db.prepare('SELECT rent_amount FROM houses WHERE id = ?').get(tenant.house_id);
        
        // Get previous month arrears
        const prevMonth = new Date(month_year + "-01");
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const prevMonthStr = prevMonth.toISOString().substring(0, 7);
        const prevRecord: any = db.prepare('SELECT balance FROM monthly_rent_records WHERE tenant_id = ? AND month_year = ?')
          .get(tenant_id, prevMonthStr);
        
        const arrears = prevRecord ? prevRecord.balance : 0;
        const totalDue = house.rent_amount + arrears;

        db.prepare(`
          INSERT INTO monthly_rent_records (tenant_id, month_year, rent_due, arrears_brought_forward, total_due, amount_paid, balance)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(tenant_id, month_year, house.rent_amount, arrears, totalDue, amount, totalDue - amount);
      } else {
        const newAmountPaid = record.amount_paid + amount;
        const newBalance = record.total_due - newAmountPaid;
        db.prepare('UPDATE monthly_rent_records SET amount_paid = ?, balance = ? WHERE id = ?')
          .run(newAmountPaid, newBalance, record.id);
      }

      // Propagate balance to subsequent months if they exist
      const futureRecords = db.prepare('SELECT * FROM monthly_rent_records WHERE tenant_id = ? AND month_year > ? ORDER BY month_year ASC')
        .all(tenant_id, month_year);
      
      let currentArrears = record ? (record.total_due - (record.amount_paid + amount)) : 0; // This is wrong logic if record was just created above
      // Let's re-fetch the updated record to be safe
      const updatedRecord: any = db.prepare('SELECT balance FROM monthly_rent_records WHERE tenant_id = ? AND month_year = ?')
        .get(tenant_id, month_year);
      currentArrears = updatedRecord.balance;

      for (const fRecord of futureRecords as any[]) {
        const newTotalDue = fRecord.rent_due + currentArrears;
        const newBalance = newTotalDue - fRecord.amount_paid;
        db.prepare('UPDATE monthly_rent_records SET arrears_brought_forward = ?, total_due = ?, balance = ? WHERE id = ?')
          .run(currentArrears, newTotalDue, newBalance, fRecord.id);
        currentArrears = newBalance;
      }
    }
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Dashboard & Reports ---

app.get("/api/dashboard/stats", authenticateToken, (req, res) => {
  const totalHouses = db.prepare('SELECT COUNT(*) as count FROM houses').get() as any;
  const occupiedHouses = db.prepare("SELECT COUNT(*) as count FROM houses WHERE status = 'OCCUPIED'").get() as any;
  const vacantHouses = db.prepare("SELECT COUNT(*) as count FROM houses WHERE status = 'VACANT'").get() as any;
  
  const currentMonth = new Date().toISOString().substring(0, 7);
  const expectedRent = db.prepare('SELECT SUM(rent_due) as sum FROM monthly_rent_records WHERE month_year = ?').get(currentMonth) as any;
  const collectedRent = db.prepare("SELECT SUM(amount) as sum FROM payments WHERE type = 'RENT' AND month_year = ?").get(currentMonth) as any;
  const collectedDeposits = db.prepare("SELECT SUM(amount) as sum FROM payments WHERE type = 'DEPOSIT' AND month_year = ?").get(currentMonth) as any;
  const totalArrears = db.prepare('SELECT SUM(balance) as sum FROM monthly_rent_records WHERE month_year = ?').get(currentMonth) as any;

  res.json({
    totalHouses: totalHouses.count,
    occupiedHouses: occupiedHouses.count,
    vacantHouses: vacantHouses.count,
    expectedRent: expectedRent.sum || 0,
    collectedRent: collectedRent.sum || 0,
    collectedDeposits: collectedDeposits.sum || 0,
    totalArrears: totalArrears.sum || 0
  });
});

app.get("/api/reports/arrears", authenticateToken, (req, res) => {
  const currentMonth = new Date().toISOString().substring(0, 7);
  const arrearsList = db.prepare(`
    SELECT t.full_name, t.phone, h.house_number, r.balance as arrears_amount
    FROM monthly_rent_records r
    JOIN tenants t ON r.tenant_id = t.id
    JOIN houses h ON t.house_id = h.id
    WHERE r.month_year = ? AND r.balance > 0
  `).all(currentMonth);
  res.json(arrearsList);
});

// Admin only: Generate monthly invoices for all occupied houses
app.post("/api/admin/generate-monthly-records", authenticateToken, authorizeRole(['LANDLORD']), (req, res) => {
  const { month_year } = req.body; // YYYY-MM
  
  const transaction = db.transaction(() => {
    const occupiedTenants = db.prepare(`
      SELECT t.id as tenant_id, h.rent_amount
      FROM tenants t
      JOIN houses h ON t.house_id = h.id
      WHERE h.status = 'OCCUPIED'
    `).all();

    for (const tenant of occupiedTenants as any[]) {
      // Check if record already exists
      const existing = db.prepare('SELECT id FROM monthly_rent_records WHERE tenant_id = ? AND month_year = ?')
        .get(tenant.tenant_id, month_year);
      
      if (!existing) {
        // Get previous month arrears
        const prevMonth = new Date(month_year + "-01");
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        const prevMonthStr = prevMonth.toISOString().substring(0, 7);
        const prevRecord: any = db.prepare('SELECT balance FROM monthly_rent_records WHERE tenant_id = ? AND month_year = ?')
          .get(tenant.tenant_id, prevMonthStr);
        
        const arrears = prevRecord ? prevRecord.balance : 0;
        const totalDue = tenant.rent_amount + arrears;

        db.prepare(`
          INSERT INTO monthly_rent_records (tenant_id, month_year, rent_due, arrears_brought_forward, total_due, balance)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(tenant.tenant_id, month_year, tenant.rent_amount, arrears, totalDue, totalDue);
      }
    }
  });

  try {
    transaction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
