const express = require('express')
const { query } = require('./db')

const router = express.Router()

// GET /api/menus
router.get('/menus', async (req, res) => {
  try {
    const includeOptions = req.query.includeOptions !== 'false'

    const menusResult = await query(
      'SELECT id, name, description, price, image_url AS "imageUrl", stock_quantity AS "stockQuantity" FROM menus ORDER BY id',
    )

    let menus = menusResult.rows

    if (includeOptions) {
      const optionsResult = await query(
        'SELECT id, menu_id AS "menuId", name, extra_price AS "extraPrice" FROM options ORDER BY id',
      )
      const optionsByMenu = optionsResult.rows.reduce((acc, opt) => {
        acc[opt.menuId] = acc[opt.menuId] || []
        acc[opt.menuId].push({
          id: opt.id,
          name: opt.name,
          extraPrice: opt.extraPrice,
        })
        return acc
      }, {})
      menus = menus.map((m) => ({
        ...m,
        options: optionsByMenu[m.id] || [],
      }))
    }

    res.json(menus)
  } catch (err) {
    console.error('GET /api/menus failed', err)
    res.status(500).json({
      message: 'Failed to load menus',
      error:
        process.env.NODE_ENV === 'development'
          ? {
              name: err?.name,
              code: err?.code,
              message: err?.message,
            }
          : undefined,
    })
  }
})

// POST /api/orders
router.post('/orders', async (req, res) => {
  const client = await require('./db').pool.connect()
  try {
    const { items } = req.body
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items is required' })
    }

    await client.query('BEGIN')

    // 1. 재고 체크 및 금액 계산
    let totalPrice = 0
    const detailedItems = []

    for (const item of items) {
      const { menuId, quantity } = item
      const menuResult = await client.query(
        'SELECT id, price, stock_quantity FROM menus WHERE id = $1 FOR UPDATE',
        [menuId],
      )
      if (menuResult.rowCount === 0) {
        throw new Error('Menu not found')
      }
      const menu = menuResult.rows[0]
      if (menu.stock_quantity < quantity) {
        throw new Error('Not enough stock')
      }

      const linePrice = menu.price * quantity
      totalPrice += linePrice

      detailedItems.push({
        menuId,
        quantity,
        unitPrice: menu.price,
        linePrice,
      })
    }

    // 2. 주문 생성
    const orderResult = await client.query(
      `INSERT INTO orders (ordered_at, status, total_price)
       VALUES (NOW(), 'RECEIVED', $1)
       RETURNING id, ordered_at, status, total_price`,
      [totalPrice],
    )
    const order = orderResult.rows[0]

    // 3. 주문 아이템 + 재고 차감
    for (const item of detailedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_id, quantity, unit_price, line_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.menuId, item.quantity, item.unitPrice, item.linePrice],
      )
      await client.query(
        'UPDATE menus SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [item.quantity, item.menuId],
      )
    }

    await client.query('COMMIT')

    res.status(201).json({
      id: order.id,
      orderedAt: order.ordered_at,
      status: order.status,
      totalPrice: order.total_price,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /api/orders failed', err)
    res.status(500).json({ message: 'Failed to create order' })
  } finally {
    client.release()
  }
})

// GET /api/orders/:id
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params
    const orderResult = await query(
      'SELECT id, ordered_at AS "orderedAt", status, total_price AS "totalPrice" FROM orders WHERE id = $1',
      [id],
    )
    if (orderResult.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }
    const itemsResult = await query(
      `SELECT oi.quantity,
              oi.unit_price AS "unitPrice",
              oi.line_price AS "linePrice",
              m.name AS "menuName"
       FROM order_items oi
       JOIN menus m ON oi.menu_id = m.id
       WHERE oi.order_id = $1`,
      [id],
    )
    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows,
    })
  } catch (err) {
    console.error('GET /api/orders/:id failed', err)
    res.status(500).json({ message: 'Failed to load order' })
  }
})

// PATCH /api/orders/:id/status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    if (!status) {
      return res.status(400).json({ message: 'status is required' })
    }
    const result = await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status',
      [status, id],
    )
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Order not found' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('PATCH /api/orders/:id/status failed', err)
    res.status(500).json({ message: 'Failed to update status' })
  }
})

// PATCH /api/menus/:id/stock
router.patch('/menus/:id/stock', async (req, res) => {
  try {
    const { id } = req.params
    const { delta, stockQuantity } = req.body

    let result
    if (typeof stockQuantity === 'number') {
      result = await query(
        'UPDATE menus SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING id, stock_quantity AS "stockQuantity"',
        [stockQuantity, id],
      )
    } else if (typeof delta === 'number') {
      result = await query(
        'UPDATE menus SET stock_quantity = GREATEST(stock_quantity + $1, 0), updated_at = NOW() WHERE id = $2 RETURNING id, stock_quantity AS "stockQuantity"',
        [delta, id],
      )
    } else {
      return res.status(400).json({ message: 'delta or stockQuantity is required' })
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Menu not found' })
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('PATCH /api/menus/:id/stock failed', err)
    res.status(500).json({ message: 'Failed to update stock' })
  }
})

module.exports = router

