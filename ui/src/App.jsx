import React, { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [activeView, setActiveView] = useState('order')
  const [products, setProducts] = useState([])
  const [isLoadingMenus, setIsLoadingMenus] = useState(false)
  const [menuError, setMenuError] = useState(null)

  const API_BASE_URL = 'http://localhost:4000/api'

  const formatPrice = (value) =>
    value.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW' }).replace('₩', '') +
    '원'

  const calcLinePrice = (product, options, quantity) => {
    const base = product.price
    const shot = options.shot ? 500 : 0
    const syrup = options.syrup ? 500 : 0
    return (base + shot + syrup) * quantity
  }

  const [cart, setCart] = useState([])

  const handleAddToCart = (product, selectedOptions) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.options.shot === selectedOptions.shot &&
          item.options.syrup === selectedOptions.syrup,
      )
      if (existingIndex >= 0) {
        const next = [...prev]
        const existing = next[existingIndex]
        const quantity = existing.quantity + 1
        next[existingIndex] = {
          ...existing,
          quantity,
          linePrice: calcLinePrice(product, existing.options, quantity),
        }
        return next
      }
      const quantity = 1
      return [
        ...prev,
        {
          id: Date.now(),
          product,
          options: selectedOptions,
          quantity,
          linePrice: calcLinePrice(product, selectedOptions, quantity),
        },
      ]
    })
  }

  const handleChangeQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item
          const nextQuantity = item.quantity + delta
          if (nextQuantity <= 0) {
            return null
          }
          return {
            ...item,
            quantity: nextQuantity,
            linePrice: calcLinePrice(item.product, item.options, nextQuantity),
          }
        })
        .filter(Boolean),
    )
  }

  const totalPrice = cart.reduce((sum, item) => sum + item.linePrice, 0)

  const [selectedOptions, setSelectedOptions] = useState({})

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        setIsLoadingMenus(true)
        setMenuError(null)
        const res = await fetch(`${API_BASE_URL}/menus`)
        if (!res.ok) {
          throw new Error('메뉴를 불러오지 못했습니다.')
        }
        const data = await res.json()
        setProducts(data)
        setSelectedOptions(
          data.reduce(
            (acc, product) => ({
              ...acc,
              [product.id]: { shot: false, syrup: false },
            }),
            {},
          ),
        )
      } catch (err) {
        console.error(err)
        setMenuError(err.message)
      } finally {
        setIsLoadingMenus(false)
      }
    }

    fetchMenus()
  }, [])

  const toggleOption = (productId, optionKey) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [optionKey]: !prev[productId][optionKey],
      },
    }))
  }

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return

    const itemsSummary =
      cart.length === 1
        ? `${cart[0].product.name} × ${cart[0].quantity}`
        : `${cart[0].product.name} × ${cart[0].quantity} 외 ${cart.length - 1}건`

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            menuId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      })
      if (!res.ok) {
        throw new Error('주문 생성에 실패했습니다.')
      }
      const created = await res.json()

      setAdminOrders((prev) => [
        {
          id: created.id,
          orderedAt: new Date(created.orderedAt).toLocaleString('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          itemsSummary,
          totalPrice: created.totalPrice,
          status: created.status === 'RECEIVED' ? '주문 접수' : created.status,
        },
        ...prev,
      ])
      setOrderStatusSummary((prev) => ({
        ...prev,
        total: prev.total + 1,
        received: prev.received + 1,
      }))
      alert('주문이 완료되었습니다.')
      setCart([])
      setActiveView('admin')
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
  }

  const [stockItems, setStockItems] = useState([
    { id: 1, name: '아메리카노 (ICE)', quantity: 10 },
    { id: 2, name: '아메리카노 (HOT)', quantity: 10 },
    { id: 3, name: '카페라떼', quantity: 10 },
    { id: 4, name: '녹차 라떼', quantity: 10 },
  ])

  const [orderStatusSummary, setOrderStatusSummary] = useState({
    total: 0,
    received: 0,
    inProgress: 0,
    completed: 0,
  })

  const [adminOrders, setAdminOrders] = useState([])

  const getStockStatusLabel = (quantity) => {
    if (quantity === 0) return '품절'
    if (quantity < 5) return '주의'
    return '정상'
  }

  const handleChangeStock = (id, delta) => {
    setStockItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const nextQuantity = Math.max(0, item.quantity + delta)
        return { ...item, quantity: nextQuantity }
      }),
    )
  }

  const handleStartMaking = (id) => {
    setAdminOrders((prev) =>
      prev.map((order) =>
        order.id === id && order.status === '주문 접수'
          ? { ...order, status: '제조 중' }
          : order,
      ),
    )
    setOrderStatusSummary((prev) => ({
      ...prev,
      received: Math.max(0, prev.received - 1),
      inProgress: prev.inProgress + 1,
    }))
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">COZY</div>
        <nav className="nav">
          <button
            type="button"
            className={`nav-button ${activeView === 'order' ? 'nav-button--active' : ''}`}
            onClick={() => setActiveView('order')}
          >
            주문하기
          </button>
          <button
            type="button"
            className={`nav-button ${activeView === 'admin' ? 'nav-button--active' : ''}`}
            onClick={() => setActiveView('admin')}
          >
            관리자
          </button>
        </nav>
      </header>

      <main className="content">
        {activeView === 'order' && (
          <>
        <section className="menu-section">
          {isLoadingMenus && <p className="cart-empty">메뉴를 불러오는 중입니다...</p>}
          {menuError && <p className="cart-empty">{menuError}</p>}
          {!isLoadingMenus &&
            !menuError &&
            products.map((product) => {
            const options = selectedOptions[product.id]
            return (
              <article key={product.id} className="menu-card">
                <div className="menu-image-wrapper">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="menu-image"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = 'hidden'
                    }}
                  />
                </div>
                <div className="menu-body">
                  <h2 className="menu-title">{product.name}</h2>
                  <p className="menu-price">{formatPrice(product.price)}</p>
                  <p className="menu-description">{product.description}</p>
                  <div className="menu-options">
                    <label className="option-item">
                      <input
                        type="checkbox"
                        checked={options.shot}
                        onChange={() => toggleOption(product.id, 'shot')}
                      />
                      <span>샷 추가 (+500원)</span>
                    </label>
                    <label className="option-item">
                      <input
                        type="checkbox"
                        checked={options.syrup}
                        onChange={() => toggleOption(product.id, 'syrup')}
                      />
                      <span>시럽 추가 (+500원)</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleAddToCart(product, options)}
                  >
                    담기
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        <section className="cart-section">
          <div className="cart-left">
            <h2 className="cart-title">장바구니</h2>
            {cart.length === 0 ? (
              <p className="cart-empty">장바구니가 비어 있습니다. 메뉴를 선택해 주세요.</p>
            ) : (
              <ul className="cart-list">
                {cart.map((item) => (
                  <li key={item.id} className="cart-item">
                    <div className="cart-item-main">
                      <div>
                        <div className="cart-item-name">{item.product.name}</div>
                        <div className="cart-item-options">
                          {item.options.shot && <span>샷 추가</span>}
                          {item.options.syrup && <span>시럽 추가</span>}
                          {!item.options.shot && !item.options.syrup && <span>옵션 없음</span>}
                        </div>
                      </div>
                      <div className="cart-item-price">{formatPrice(item.linePrice)}</div>
                    </div>
                    <div className="cart-item-footer">
                      <div className="quantity-control">
                        <button
                          type="button"
                          className="quantity-button"
                          onClick={() => handleChangeQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span className="quantity-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="quantity-button"
                          onClick={() => handleChangeQuantity(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="cart-right">
            <div className="cart-summary">
              <span className="cart-summary-label">총 금액</span>
              <span className="cart-summary-value">{formatPrice(totalPrice)}</span>
            </div>
            <button
              type="button"
              className="primary-button primary-button--full"
              disabled={cart.length === 0}
              onClick={handlePlaceOrder}
            >
              주문하기
            </button>
          </aside>
        </section>
          </>
        )}

        {activeView === 'admin' && (
          <div className="admin-page">
            <section className="admin-dashboard">
              <h2 className="section-title">관리자 대시보드</h2>
              <div className="admin-dashboard-grid">
                <div className="dashboard-card">
                  <div className="dashboard-label">총 주문</div>
                  <div className="dashboard-value">{orderStatusSummary.total}</div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-label">주문 접수</div>
                  <div className="dashboard-value">{orderStatusSummary.received}</div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-label">제조 중</div>
                  <div className="dashboard-value">{orderStatusSummary.inProgress}</div>
                </div>
                <div className="dashboard-card">
                  <div className="dashboard-label">제조 완료</div>
                  <div className="dashboard-value">{orderStatusSummary.completed}</div>
                </div>
              </div>
            </section>

            <section className="admin-section">
              <h2 className="section-title">재고 현황</h2>
              <div className="stock-grid">
                {stockItems.map((item) => (
                  <article key={item.id} className="stock-card">
                    <div className="stock-header">
                      <div className="stock-name">{item.name}</div>
                    </div>
                    <div className="stock-quantity-row">
                      <span className="stock-quantity-label">재고</span>
                      <span className="stock-quantity-value">{item.quantity}개</span>
                      <span
                        className={`stock-status stock-status--${getStockStatusLabel(
                          item.quantity,
                        )}`}
                      >
                        {getStockStatusLabel(item.quantity)}
                      </span>
                    </div>
                    <div className="stock-controls">
                      <button
                        type="button"
                        className="quantity-button"
                        onClick={() => handleChangeStock(item.id, -1)}
                      >
                        -
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        type="button"
                        className="quantity-button"
                        onClick={() => handleChangeStock(item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-section">
              <h2 className="section-title">주문 현황</h2>
              {adminOrders.length === 0 ? (
                <p className="cart-empty">현재 들어온 주문이 없습니다.</p>
              ) : (
                <ul className="order-list">
                  {adminOrders.map((order) => (
                    <li key={order.id} className="order-item">
                      <div className="order-main">
                        <div className="order-info">
                          <div className="order-date">{order.orderedAt}</div>
                          <div className="order-items">{order.itemsSummary}</div>
                        </div>
                        <div className="order-meta">
                          <div className="order-price">{formatPrice(order.totalPrice)}</div>
                          <div className="order-status">{order.status}</div>
                          {order.status === '주문 접수' && (
                            <button
                              type="button"
                              className="primary-button order-action-button"
                              onClick={() => handleStartMaking(order.id)}
                            >
                              제조 시작
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
