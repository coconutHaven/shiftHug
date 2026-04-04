import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'supportmate.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    service_description TEXT DEFAULT 'Assistance to Access Community and Social participation',
    ref_number TEXT DEFAULT '04_104_0125_6_1',
    hourly_rate REAL NOT NULL DEFAULT 44.00,
    km_rate REAL NOT NULL DEFAULT 0.95,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS client_rates (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    rate_name TEXT NOT NULL,
    rate_amount REAL NOT NULL,
    reference_number TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fixed_shifts (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    default_hours REAL NOT NULL,
    rate_id TEXT,
    rate_name TEXT,
    notes TEXT,
    hourly_rate REAL,
    mileage REAL,
    mileage_rate REAL,
    expenses TEXT,
    reference_number TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    invoice_number INTEGER NOT NULL,
    invoice_date TEXT NOT NULL DEFAULT (date('now')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    total_amount REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_shifts (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    shift_date TEXT NOT NULL,
    day_name TEXT,
    hours REAL NOT NULL DEFAULT 0,
    hourly_rate REAL NOT NULL DEFAULT 0,
    rate_name TEXT,
    reference_number TEXT,
    km REAL NOT NULL DEFAULT 0,
    km_rate REAL NOT NULL DEFAULT 0,
    expenses TEXT DEFAULT '[]',
    expenses_total REAL NOT NULL DEFAULT 0,
    shift_total REAL NOT NULL DEFAULT 0,
    invoice_hours REAL NOT NULL DEFAULT 0,
    invoice_rate REAL NOT NULL DEFAULT 0,
    invoice_amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    abn TEXT,
    bsb TEXT,
    account_number TEXT,
    color_scheme TEXT DEFAULT 'warm-sunset',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const app = express();
app.use(express.json());

// ─── Clients ───

app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  const rates = db.prepare('SELECT * FROM client_rates').all();
  const shifts = db.prepare('SELECT * FROM fixed_shifts ORDER BY day_of_week').all();

  const result = clients.map(c => ({
    ...c,
    client_rates: rates.filter(r => r.client_id === c.id),
    fixed_shifts: shifts.filter(s => s.client_id === c.id).map(s => ({
      ...s,
      expenses: parseExpenses(s.expenses),
    })),
  }));

  res.json(result);
});

app.post('/api/clients', (req, res) => {
  const { name, email, phone, address, service_description, ref_number, hourly_rate, km_rate } = req.body;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO clients (id, name, email, phone, address, service_description, ref_number, hourly_rate, km_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email ?? null, phone ?? null, address ?? null, service_description ?? null, ref_number ?? null, hourly_rate, km_rate);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.json(client);
});

app.put('/api/clients/:id', (req, res) => {
  const allowed = ['name', 'email', 'phone', 'address', 'service_description', 'ref_number', 'hourly_rate', 'km_rate'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return res.status(400).json({ error: 'No valid fields' });

  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  db.prepare(`UPDATE clients SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Client Rates ───

app.get('/api/clients/:clientId/rates', (req, res) => {
  const rates = db.prepare('SELECT * FROM client_rates WHERE client_id = ?').all(req.params.clientId);
  res.json(rates);
});

app.post('/api/clients/:clientId/rates', (req, res) => {
  const { rate_name, rate_amount, reference_number } = req.body;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO client_rates (id, client_id, rate_name, rate_amount, reference_number)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.clientId, rate_name, rate_amount, reference_number ?? null);

  res.json({ id, client_id: req.params.clientId, rate_name, rate_amount, reference_number });
});

app.delete('/api/client-rates/:id', (req, res) => {
  db.prepare('DELETE FROM client_rates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Fixed Shifts ───

app.get('/api/clients/:clientId/fixed-shifts', (req, res) => {
  const shifts = db.prepare('SELECT * FROM fixed_shifts WHERE client_id = ? ORDER BY day_of_week').all(req.params.clientId);
  res.json(shifts.map(s => ({ ...s, expenses: parseExpenses(s.expenses) })));
});

app.post('/api/clients/:clientId/fixed-shifts', (req, res) => {
  const { day_of_week, default_hours, rate_id, rate_name, notes, hourly_rate, mileage, mileage_rate, expenses, reference_number } = req.body;
  const id = randomUUID();

  db.prepare(`
    INSERT INTO fixed_shifts (id, client_id, day_of_week, default_hours, rate_id, rate_name, notes, hourly_rate, mileage, mileage_rate, expenses, reference_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.clientId, day_of_week, default_hours, rate_id ?? null, rate_name ?? null, notes ?? null, hourly_rate ?? null, mileage ?? null, mileage_rate ?? null, expenses ? JSON.stringify(expenses) : '[]', reference_number ?? null);

  const shift = db.prepare('SELECT * FROM fixed_shifts WHERE id = ?').get(id);
  res.json({ ...shift, expenses: parseExpenses(shift.expenses) });
});

app.put('/api/fixed-shifts/:id', (req, res) => {
  const allowed = ['day_of_week', 'default_hours', 'rate_id', 'rate_name', 'notes', 'hourly_rate', 'mileage', 'mileage_rate', 'expenses', 'reference_number'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return res.status(400).json({ error: 'No valid fields' });

  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([k, v]) => k === 'expenses' ? JSON.stringify(v) : v);

  db.prepare(`UPDATE fixed_shifts SET ${sets} WHERE id = ?`).run(...values, req.params.id);
  const shift = db.prepare('SELECT * FROM fixed_shifts WHERE id = ?').get(req.params.id);
  res.json({ ...shift, expenses: parseExpenses(shift.expenses) });
});

app.delete('/api/fixed-shifts/:id', (req, res) => {
  db.prepare('DELETE FROM fixed_shifts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Invoices ───

function parseExpenses(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

app.get('/api/invoices', (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY invoice_number DESC').all();

  const clientIds = [...new Set(invoices.map(i => i.client_id))];
  const clientMap = {};
  if (clientIds.length > 0) {
    const placeholders = clientIds.map(() => '?').join(',');
    db.prepare(`SELECT id, name FROM clients WHERE id IN (${placeholders})`).all(...clientIds)
      .forEach(c => { clientMap[c.id] = { name: c.name }; });
  }

  const invoiceIds = invoices.map(i => i.id);
  const allShifts = [];
  if (invoiceIds.length > 0) {
    const placeholders = invoiceIds.map(() => '?').join(',');
    db.prepare(`SELECT * FROM invoice_shifts WHERE invoice_id IN (${placeholders}) ORDER BY sort_order`).all(...invoiceIds)
      .forEach(s => { allShifts.push({ ...s, expenses: parseExpenses(s.expenses) }); });
  }

  const result = invoices.map(inv => ({
    ...inv,
    clients: clientMap[inv.client_id] || null,
    invoice_shifts: allShifts.filter(s => s.invoice_id === inv.id),
  }));

  res.json(result);
});

app.get('/api/invoices/next-number/:clientId', (req, res) => {
  const row = db.prepare(
    'SELECT invoice_number FROM invoices WHERE client_id = ? ORDER BY invoice_number DESC LIMIT 1'
  ).get(req.params.clientId);

  res.json({ next: (row?.invoice_number ?? 0) + 1 });
});

app.post('/api/invoices', (req, res) => {
  const { client_id, invoice_date, shifts, invoice_number: customNumber } = req.body;

  let invoiceNumber;
  if (customNumber != null) {
    invoiceNumber = customNumber;
  } else {
    const row = db.prepare(
      'SELECT invoice_number FROM invoices WHERE client_id = ? ORDER BY invoice_number DESC LIMIT 1'
    ).get(client_id);
    invoiceNumber = (row?.invoice_number ?? 0) + 1;
  }

  const totalAmount = shifts.reduce((sum, s) => sum + s.invoice_amount, 0);
  const id = randomUUID();

  const formattedDate = new Date(invoice_date).toISOString().split('T')[0];

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, client_id, invoice_number, invoice_date, total_amount, status)
    VALUES (?, ?, ?, ?, ?, 'draft')
  `);

  const insertShift = db.prepare(`
    INSERT INTO invoice_shifts (id, invoice_id, shift_date, day_name, hours, hourly_rate, rate_name, reference_number, km, km_rate, expenses, expenses_total, shift_total, invoice_hours, invoice_rate, invoice_amount, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertInvoice.run(id, client_id, invoiceNumber, formattedDate, totalAmount);

    shifts.forEach((s, i) => {
      insertShift.run(
        randomUUID(), id, s.shift_date, s.day_name, s.hours, s.hourly_rate,
        s.rate_name || 'Standard', s.reference_number ?? null,
        s.km, s.km_rate, JSON.stringify(s.expenses), s.expenses_total,
        s.shift_total, s.invoice_hours, s.invoice_rate, s.invoice_amount, i
      );
    });
  });

  transaction();

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  res.json(invoice);
});

app.put('/api/invoices/:id', (req, res) => {
  const allowed = ['invoice_date', 'notes', 'total_amount'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return res.status(400).json({ error: 'No valid fields' });

  const sets = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  db.prepare(`UPDATE invoices SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);
  res.json({ ok: true });
});

app.put('/api/invoices/:id/publish', (req, res) => {
  db.prepare("UPDATE invoices SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', (req, res) => {
  const result = db.prepare("DELETE FROM invoices WHERE id = ? AND status = 'draft'").run(req.params.id);
  if (result.changes === 0) {
    return res.status(400).json({ error: 'Can only delete draft invoices' });
  }
  res.json({ ok: true });
});

// ─── Settings ───

app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM user_settings LIMIT 1').get();
  res.json(settings || null);
});

app.put('/api/settings', (req, res) => {
  const { display_name, email, phone, abn, bsb, account_number } = req.body;
  const existing = db.prepare('SELECT id FROM user_settings LIMIT 1').get();

  if (existing) {
    db.prepare(`
      UPDATE user_settings SET display_name = ?, email = ?, phone = ?, abn = ?, bsb = ?, account_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(display_name, email, phone, abn, bsb, account_number, existing.id);
  } else {
    db.prepare(`
      INSERT INTO user_settings (id, display_name, email, phone, abn, bsb, account_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), display_name, email, phone, abn, bsb, account_number);
  }

  res.json({ ok: true });
});

// ─── Production: serve frontend ───

if (process.env.NODE_ENV === 'production') {
  const { default: serveStatic } = await import('serve-static');
  app.use(serveStatic(join(__dirname, '..', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SupportMate API running on http://localhost:${PORT}`);
});
