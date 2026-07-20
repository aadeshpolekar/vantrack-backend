-- VanTrack database schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  van_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT NOT NULL,
  route TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  cycle_months INTEGER NOT NULL CHECK (cycle_months IN (1,2,3)),
  amount NUMERIC(10,2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'upcoming' | 'expired'
  sent_at TIMESTAMPTZ DEFAULT now(),
  provider_response TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_owner ON students(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_end_date ON payments(end_date);
