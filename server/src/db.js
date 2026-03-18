const { Pool } = require('pg')

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
    })
  : new Pool({
      host: (process.env.DB_HOST || '127.0.0.1') === 'localhost' ? '127.0.0.1' : process.env.DB_HOST || '127.0.0.1',
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

