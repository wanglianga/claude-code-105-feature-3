import fs from 'fs'
import path from 'path'
import type { AppState } from '../shared/types'
import { buildInitialState, accounts as seedAccounts } from './seed'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

let state: AppState

export function loadState(): AppState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
      if (raw && raw.orders && raw.catalog) {
        migrate(raw)
        state = raw
        return state
      }
    }
  } catch (e) {
    console.warn('[store] db.json 读取失败，使用种子数据', e)
  }
  state = buildInitialState()
  saveState()
  return state
}

// 旧版本数据迁移：补齐取货后造型申诉相关字段
function migrate(raw: any) {
  if (!Array.isArray(raw.coupons)) raw.coupons = []
  for (const o of raw.orders || []) {
    if (!Array.isArray(o.appeals)) o.appeals = []
    if (typeof o.remakeCount !== 'number') o.remakeCount = 0
  }
}

export function getState(): AppState {
  return state
}

let saveTimer: NodeJS.Timeout | null = null
export function saveState() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const tmp = DB_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
    fs.renameSync(tmp, DB_FILE)
  }, 120)
}

export function resetState(): AppState {
  state = buildInitialState()
  saveState()
  return state
}

// ---- 简易会话（演示环境单租户，token 即会话表索引）----
const sessions = new Map<string, string>() // token -> accountId

export function login(username: string, password: string) {
  const acc = seedAccounts.find(a => a.username === username && a.password === password)
  if (!acc) return null
  const token = Buffer.from(`${acc.id}:${Date.now()}`).toString('base64url')
  sessions.set(token, acc.id)
  const { password: _pw, ...safe } = acc
  return { token, account: safe }
}

export function me(token?: string) {
  if (!token) return null
  const id = sessions.get(token)
  if (!id) return null
  const acc = seedAccounts.find(a => a.id === id)
  if (!acc) return null
  const { password: _pw, ...safe } = acc
  return safe
}

export function nextOrderNo(): string {
  const n = 1004 + Math.max(0, state.orders.length - 3)
  const used = new Set(state.orders.map(o => o.id))
  let id = `OD${n}`
  let i = 1
  while (used.has(id)) id = `OD${n + i++}`
  return id
}

export function nextPickupCode(): string {
  const used = new Set(state.orders.map(o => o.pickupCode))
  for (;;) {
    const code = String(1000 + Math.floor(Math.random() * 9000))
    if (!used.has(code)) return code
  }
}
