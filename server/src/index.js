require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const { query } = require('./db')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/db-health', async (req, res) => {
  try {
    const result = await query('SELECT 1 AS ok')
    res.json({ status: 'ok', db: result.rows[0].ok })
  } catch (err) {
    console.error('DB health check failed', err)
    res.status(500).json({ status: 'error', message: 'Database connection failed' })
  }
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})

