import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const db = new Database('rental_system.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDb() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('LANDLORD', 'CARETAKER')) NOT NULL,
      full_name TEXT NOT NULL
    )
  `);

  // Houses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_number TEXT UNIQUE NOT NULL,
      rent_amount REAL NOT NULL,
      status TEXT CHECK(status IN ('VACANT', 'OCCUPIED')) DEFAULT 'VACANT'
    )
  `);

  // Tenants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      national_id TEXT UNIQUE NOT NULL,
      house_id INTEGER UNIQUE,
      entry_date TEXT NOT NULL,
      security_deposit REAL NOT NULL,
      FOREIGN KEY (house_id) REFERENCES houses(id) ON DELETE SET NULL
    )
  `);

  // Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      month_year TEXT NOT NULL, -- Format: YYYY-MM
      type TEXT CHECK(type IN ('RENT', 'DEPOSIT')) NOT NULL,
      recorded_by INTEGER NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    )
  `);

  // Monthly Rent Records (for arrears tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS monthly_rent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      month_year TEXT NOT NULL, -- Format: YYYY-MM
      rent_due REAL NOT NULL,
      arrears_brought_forward REAL DEFAULT 0,
      total_due REAL NOT NULL,
      amount_paid REAL DEFAULT 0,
      balance REAL NOT NULL,
      UNIQUE(tenant_id, month_year),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    )
  `);

  // Create default admin if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
      .run('admin', hashedPassword, 'LANDLORD', 'System Administrator');
    
    // Create a default caretaker too for testing
    const caretakerPassword = bcrypt.hashSync('caretaker123', 10);
    db.prepare('INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)')
      .run('manager', caretakerPassword, 'CARETAKER', 'Property Manager');
  }

  console.log('Database initialized successfully');
}

export default db;
