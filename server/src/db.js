const { Pool } = require('pg')

const rawHost = process.env.DB_HOST || '127.0.0.1'
const dbHost = rawHost === 'localhost' ? '127.0.0.1' : rawHost

const pool = new Pool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 3000,
})

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err)
})

async function query(text, params) {
  return pool.query(text, params)
}

module.exports = {
  pool,
  query,
}

