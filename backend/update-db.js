const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecoloop',
};

async function updateDatabase() {
  try {
    const pool = mysql.createPool(dbConfig);
    
    // Update admin user name
    await pool.query(
      "UPDATE users SET name = 'Delord Pajo' WHERE username = 'admin'"
    );
    
    console.log('✓ Updated admin user name to Delord Pajo');
    
    await pool.end();
    console.log('✓ Database update complete');
  } catch (error) {
    console.error('✗ Error updating database:', error.message);
    process.exit(1);
  }
}

updateDatabase();
