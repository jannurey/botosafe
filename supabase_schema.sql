-- Supabase/PostgreSQL schema for BotoSafe voting system

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users table - stores all users (admins and voters)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  fullname VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(10) CHECK (role IN ('admin', 'voter')) NOT NULL,
  age INTEGER NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')) NULL,
  course VARCHAR(255) NULL,
  year_level VARCHAR(50) NULL,
  school_id VARCHAR(50) UNIQUE NULL,
  approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'declined')),
  user_status VARCHAR(20) DEFAULT 'active' CHECK (user_status IN ('active', 'inactive')),
  is_verified BOOLEAN DEFAULT FALSE,
  can_vote BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP WITH TIME ZONE NULL,
  approved_at TIMESTAMP WITH TIME ZONE NULL,
  must_change_password BOOLEAN DEFAULT TRUE, -- New column to track first-time login, default TRUE for existing users
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Elections table - stores election information
CREATE TABLE elections (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('upcoming', 'filing', 'ongoing', 'closed')) NOT NULL,
  start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  filing_start_time TIMESTAMP WITHOUT TIME ZONE NULL,
  filing_end_time TIMESTAMP WITHOUT TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Positions table - stores positions for elections
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Partylists table - stores partylists for elections
CREATE TABLE partylists (
  id SERIAL PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(election_id, name)
);

-- 5. Candidates table - stores candidate information
CREATE TABLE candidates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NULL,
  partylist VARCHAR(255) NULL,
  coc_file_url VARCHAR(500) NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Candidate achievements table - stores achievements for candidates
CREATE TABLE candidate_achievements (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. User OTPs table - stores one-time passwords for user authentication
CREATE TABLE user_otps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. User faces table - stores face embeddings for facial recognition
CREATE TABLE user_faces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  face_embedding TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Votes table - stores encrypted votes
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_id INTEGER NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  encrypted_vote TEXT NOT NULL,
  cast_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Settings table - stores application settings
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  k VARCHAR(255) NOT NULL UNIQUE,
  v TEXT NULL,
  updated_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Password resets table - stores password reset tokens
CREATE TABLE password_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Face verification events table - logs face verification attempts
CREATE TABLE face_verification_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  election_id INTEGER NULL REFERENCES elections(id) ON DELETE SET NULL,
  attempt_label VARCHAR(20) DEFAULT 'genuine' CHECK (attempt_label IN ('genuine', 'impostor', 'unknown')),
  source VARCHAR(20) DEFAULT 'login' CHECK (source IN ('login', 'vote', 'enroll', 'other')),
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_approval_status ON users(approval_status);
CREATE INDEX idx_elections_status ON elections(status);
CREATE INDEX idx_positions_election ON positions(election_id);
CREATE INDEX idx_partylists_election ON partylists(election_id);
CREATE INDEX idx_candidates_election ON candidates(election_id);
CREATE INDEX idx_candidates_position ON candidates(position_id);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_user_otps_user ON user_otps(user_id);
CREATE INDEX idx_user_otps_expires ON user_otps(expires_at);
CREATE INDEX idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX idx_face_verification_user ON face_verification_events(user_id);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_elections_updated_at BEFORE UPDATE ON elections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partylists_updated_at BEFORE UPDATE ON partylists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_faces_updated_at BEFORE UPDATE ON user_faces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();