const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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

