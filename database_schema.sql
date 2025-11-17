-- Database schema for BotoSafe voting system
-- Create the database first
CREATE DATABASE IF NOT EXISTS botosafedb;
USE botosafedb;

-- 1. Users table - stores all users (admins and voters)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fullname VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'voter') NOT NULL,
  age INT NULL,
  gender ENUM('male', 'female', 'other') NULL,
  course VARCHAR(255) NULL,
  year_level VARCHAR(50) NULL,
  school_id VARCHAR(50) UNIQUE NULL,
  approval_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  user_status ENUM('active', 'inactive') DEFAULT 'active',
  is_verified BOOLEAN DEFAULT FALSE,
  can_vote BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Elections table - stores election information
CREATE TABLE elections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  status ENUM('upcoming', 'filing', 'ongoing', 'closed') NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  filing_start_time TIMESTAMP NULL DEFAULT NULL,
  filing_end_time TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Positions table - stores positions for elections
CREATE TABLE positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

-- 4. Partylists table - stores partylists for elections
CREATE TABLE partylists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  election_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
  UNIQUE KEY unique_partylist_per_election (election_id, name)
);

-- 5. Candidates table - stores candidate information
CREATE TABLE candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  election_id INT NOT NULL,
  position_id INT NOT NULL,
  photo_url VARCHAR(500) NULL,
  partylist VARCHAR(255) NULL,
  coc_file_url VARCHAR(500) NULL,
  status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- 6. Candidate achievements table - stores achievements for candidates
CREATE TABLE candidate_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- 7. User OTPs table - stores one-time passwords for user authentication
CREATE TABLE user_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. User faces table - stores face embeddings for facial recognition
CREATE TABLE user_faces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  face_embedding TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Votes table - stores encrypted votes
CREATE TABLE votes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  election_id INT NOT NULL,
  encrypted_vote TEXT NOT NULL,
  cast_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

-- 10. Settings table - stores application settings
CREATE TABLE settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  k VARCHAR(255) NOT NULL UNIQUE,
  v TEXT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. Password resets table - stores password reset tokens
CREATE TABLE password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Face verification events table - logs face verification attempts
CREATE TABLE face_verification_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  election_id INT NULL,
  attempt_label ENUM('genuine', 'impostor', 'unknown') DEFAULT 'genuine',
  source ENUM('login', 'vote', 'enroll', 'other') DEFAULT 'login',
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE SET NULL
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