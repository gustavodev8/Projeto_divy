const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'nura.db'));

function initDatabase() {
  console.log('🔄 Inicializando banco de dados...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      responsible TEXT DEFAULT 'Eu',
      due_date DATE,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
      status TEXT CHECK(status IN ('pendente', 'progresso', 'concluido')) DEFAULT 'pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      description TEXT NOT NULL,
      generated_text TEXT,
      start_time TEXT,
      end_time TEXT,
      model_used TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
  
  const userExists = db.prepare('SELECT id FROM users WHERE id = 1').get();
  if (!userExists) {
    db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Usuário Nura', 'usuario@nura.com');
    console.log('✅ Usuário padrão criado');
  }
  
  console.log('✅ Banco de dados inicializado com sucesso!');
  return db;
}

module.exports = { db, initDatabase };