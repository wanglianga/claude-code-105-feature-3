import express from 'express'
import path from 'path'
import fs from 'fs'
import type { Account, ActionRequest, Order } from '../shared/types'
import { getState, loadState, login, me, resetState, saveState } from './store'
import * as eng from './engine'

const app = express()
app.use(express.json({ limit: '8mb' }))

// ---- 鉴权中间件 ----
function auth(roles?: Account['role'][]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '')
    const account = me(token)
    if (!account) return res.status(401).json({ error: '未登录或会话已过期' })
    if (roles && !roles.includes(account.role)) return res.status(403).json({ error: '当前角色无权执行该操作' })
    ;(req as any).account = account
    next()
  }
}

const getOrder = (id: string): Order => {
  const o = getState().orders.find(x => x.id === id)
  if (!o) { const e = new Error('订单不存在'); (e as any).status = 404; throw e }
  return o
}

// ---- 认证 ----
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const r = login(String(username || ''), String(password || ''))
  if (!r) return res.status(401).json({ error: '用户名或密码错误' })
  res.json(r)
})
app.get('/api/auth/me', auth(), (req, res) => res.json({ account: (req as any).account }))

// ---- 引导数据 ----
app.get('/api/bootstrap', (req, res) => {
  const { catalog, stores, stock, accounts } = getState()
  const today = new Date().toISOString().slice(0, 10)
  const capacity = stores.map(s => ({
    storeId: s.id,
    date: today,
    fridgeUsed: eng.fridgeUsage(getState(), s.id, today, false),
    fridgePending: eng.fridgeUsage(getState(), s.id, today, true) - eng.fridgeUsage(getState(), s.id, today, false),
    fridgeCapacity: s.fridgeCapacity,
    slots: catalog.slots.map(slot => ({ slot, used: eng.slotUsage(getState(), s.id, today, slot), capacity: s.slotCapacity }))
  }))
  res.json({ catalog, stores, stock, accounts, capacity })
})

app.get('/api/capacity', (req, res) => {
  const storeId = String(req.query.storeId || '')
  const date = String(req.query.date || new Date().toISOString().slice(0, 10))
  const state = getState()
  const store = state.stores.find(s => s.id === storeId)
  if (!store) return res.status(404).json({ error: '门店不存在' })
  res.json({
    storeId, date,
    fridgeUsed: eng.fridgeUsage(state, storeId, date, false),
    fridgeCapacity: store.fridgeCapacity,
    slots: state.catalog.slots.map(slot => ({ slot, used: eng.slotUsage(state, storeId, date, slot), capacity: store.slotCapacity }))
  })
})

// ---- 订单查询（三端各有视角，但数据源一致）----
app.get('/api/orders', auth(), (req, res) => {
  const acc = (req as any).account as Account
  const state = getState()
  let list = state.orders
  if (acc.role === 'customer') list = list.filter(o => o.customer.phone === acc.phone)
  if (acc.role === 'baker' || acc.role === 'front') list = list.filter(o => o.storeId === acc.storeId)
  // 列表轻量：不回传参考大图
  res.json({ orders: list })
})

app.get('/api/orders/:id', auth(), (req, res) => {
  const acc = (req as any).account as Account
  const o = getOrder(req.params.id)
  if (acc.role === 'customer' && o.customer.phone !== acc.phone) return res.status(403).json({ error: '无权查看他人订单' })
  if ((acc.role === 'baker' || acc.role === 'front') && o.storeId !== acc.storeId)
    return res.status(403).json({ error: '跨店订单，请联系客服协调' })
  res.json({ order: o, derived: {
    total: eng.orderTotal(o),
    modifyLocked: eng.modifyLocked(o),
    afterSaleDeadline: eng.afterSaleDeadline(o)
  } })
})

// ---- 下单 ----
app.post('/api/orders', auth(['customer']), (req, res) => {
  try {
    const o = eng.createOrder(req.body, (req as any).account)
    res.json({ order: o })
  } catch (e: any) { res.status(e.status || 400).json({ error: e.message }) }
})

// ---- 统一动作入口 ----
app.post('/api/orders/:id/action', auth(), (req, res) => {
  const acc = (req as any).account as Account
  const { action, payload = {} } = req.body as ActionRequest
  try {
    const o = getOrder(req.params.id)
    currentOrder = o
    const state = getState()
    switch (action) {
      // 顾客
      case 'pay': return res.json(go(() => eng.pay(o, acc)))
      case 'customer_modify':
        assertRole(acc, 'customer'); assertOwner(acc, o)
        return res.json(go(() => eng.customerModify(o, payload, acc)))
      case 'customer_decide':
        assertRole(acc, 'customer'); assertOwner(acc, o)
        return res.json(go(() => eng.customerDecide(o, payload.caseId, !!payload.accept, payload.note, acc)))
      case 'open_after_sale':
        assertRole(acc, 'customer'); assertOwner(acc, o)
        return res.json(go(() => eng.openAfterSale(o, payload as any, acc)))
      case 'customer_request_change':
        assertRole(acc, 'customer'); assertOwner(acc, o)
        return res.json(go(() => eng.customerRequestChange(o, payload.kind, payload.detail, payload.wish || {}, acc)))

      // 门店前台
      case 'accept': assertRole(acc, 'front'); assertStore(acc, o); return res.json(go(() => eng.acceptOrder(o, acc)))
      case 'handoff': assertRole(acc, 'front'); assertStore(acc, o)
        return res.json(go(() => eng.handoff(o, payload.code, payload.signer, acc)))

      // 裱花师
      case 'mark_materials': assertRole(acc, 'baker'); assertStore(acc, o)
        return res.json(go(() => eng.markMaterials(o, payload.note, acc)))
      case 'start_producing': assertRole(acc, 'baker'); assertStore(acc, o)
        return res.json(go(() => eng.startProducing(o, acc)))
      case 'log_rework': assertRole(acc, 'baker'); assertStore(acc, o)
        return res.json(go(() => eng.logRework(o, payload as any, acc)))
      case 'fruit_shortage': assertRole(acc, 'baker'); assertStore(acc, o)
        return res.json(go(() => eng.reportFruitShortage(o, payload.fruitId, payload.note, acc)))
      case 'fridge_report': assertRole(acc, 'baker', 'front'); assertStore(acc, o)
        return res.json(go(() => eng.reportFridge(o, payload.note, acc)))
      case 'upload_photos': assertRole(acc, 'baker'); assertStore(acc, o)
        return res.json(go(() => eng.uploadPhotos(o, payload.photos, acc)))

      // 客服
      case 'cs_propose': assertRole(acc, 'cs'); return res.json(go(() => eng.csPropose(o, payload.caseId, payload.proposal, acc)))
      case 'cs_close': assertRole(acc, 'cs'); return res.json(go(() => eng.csCloseCase(o, payload.caseId, payload.note, acc)))
      case 'cs_reject': assertRole(acc, 'cs'); return res.json(go(() => eng.csRejectCase(o, payload.caseId, payload.note, acc)))
      case 'cs_note': assertRole(acc, 'cs'); return res.json(go(() => eng.csNote(o, payload.text, acc)))
      case 'cs_force_ready': assertRole(acc, 'cs') // 客服协调后可推进
        if (o.status !== 'pending_accept') throw new eng.ActionError('仅待接单订单可由客服协调推进')
        o.status = 'accepted'
        o.timeline.push({ id: `ev${Date.now()}`, at: eng.nowIso(), actorRole: 'cs', actor: acc.name, type: 'status', text: '客服协调冷柜/跨店资源后，门店接单' })
        saveState()
        return res.json({ order: o })

      default: return res.status(400).json({ error: `未知动作：${action}` })
    }
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message })
  }
})

// ---- 库存（门店端更新）----
app.post('/api/stock/:storeId', auth(['baker', 'front', 'cs']), (req, res) => {
  const acc = (req as any).account as Account
  if (acc.role !== 'cs' && acc.storeId !== req.params.storeId) return res.status(403).json({ error: '跨店无权限' })
  const state = getState()
  state.stock[req.params.storeId] = { ...(state.stock[req.params.storeId] || {}), ...req.body }
  saveState()
  res.json({ ok: true })
})

// ---- 复盘看板 ----
app.get('/api/analytics', auth(['cs', 'baker', 'front']), (req, res) => {
  res.json(eng.analytics(getState()))
})

// ---- 演示：重置数据 ----
app.post('/api/reset', auth(['cs']), (req, res) => {
  res.json({ ok: true, state: resetState() })
})

function go(fn: () => any) {
  fn() // 各引擎动作均原地修改闭包中的订单 o
  return { order: currentOrder! }
}
let currentOrder: Order | null = null
function assertRole(acc: Account, ...roles: Account['role'][]) {
  if (!roles.includes(acc.role)) { const e = new eng.ActionError('当前角色无权执行该操作'); e.status = 403; throw e }
}
function assertOwner(acc: Account, o: Order) {
  if (o.customer.phone !== acc.phone) { const e = new eng.ActionError('只能操作自己的订单'); e.status = 403; throw e }
}
function assertStore(acc: Account, o: Order) {
  if (acc.storeId !== o.storeId) { const e = new eng.ActionError('这是其他门店的订单'); e.status = 403; throw e }
}

// ---- 静态资源（容器生产模式）----
// 编译产物位于 server-dist/server/，静态资源在 /app/dist
const dist = path.join(__dirname, '..', '..', 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, (_req, res) => {
  const index = path.join(dist, 'index.html')
  if (fs.existsSync(index)) res.sendFile(index)
  else res.status(404).send('building...')
})

const PORT = Number(process.env.PORT || 8080)
loadState()
app.listen(PORT, '0.0.0.0', () => console.log(`🍰 sweet-cake server listening on :${PORT}`))
