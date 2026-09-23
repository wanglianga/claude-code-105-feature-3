import { create } from 'zustand'
import { api, setToken, clearToken, type Bootstrap, type Order, type Derived, type Analytics, type CustomerCoupon } from './api'
import type { Account, Catalog, StoreInfo } from '../shared/types'

interface Toast { id: number; kind: 'ok' | 'err' | 'info'; text: string }

interface Store {
  account: Account | null
  boot: Bootstrap | null
  orders: Order[]
  current?: { order: Order; derived: Derived }
  analytics: Analytics | null
  coupons: CustomerCoupon[]
  toasts: Toast[]
  busy: boolean

  login: (u: string, p: string) => Promise<void>
  logout: () => void
  init: () => Promise<void>
  refreshOrders: () => Promise<Order[]>
  openOrder: (id: string) => Promise<void>
  applyOrder: (o: Order) => void
  act: (id: string, action: string, payload?: any, opts?: { silent?: boolean }) => Promise<Order | null>
  createOrder: (body: any) => Promise<Order>
  loadAnalytics: () => Promise<void>
  loadCoupons: () => Promise<void>
  setStock: (storeId: string, body: Record<string, 'ok' | 'low' | 'out'>) => Promise<void>
  toast: (text: string, kind?: Toast['kind']) => void
  resetDemo: () => Promise<void>
}

let toastId = 0

export const useStore = create<Store>((set, get) => ({
  account: null,
  boot: null,
  orders: [],
  analytics: null,
  coupons: [],
  toasts: [],
  busy: false,

  toast: (text, kind = 'info') => {
    const id = ++toastId
    set(s => ({ toasts: [...s.toasts, { id, text, kind }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 2800)
  },

  login: async (u, p) => {
    const r = await api.login(u, p)
    setToken(r.token)
    set({ account: r.account })
    if (r.account.role === 'customer') get().loadCoupons()
  },

  logout: () => {
    clearToken()
    set({ account: null, orders: [], current: undefined, analytics: null, coupons: [] })
  },

  init: async () => {
    const boot = await api.bootstrap()
    set({ boot })
    try {
      const me = await api.me()
      set({ account: me.account })
      if (me.account.role === 'customer') get().loadCoupons()
    } catch { /* 未登录 */ }
  },

  refreshOrders: async () => {
    const { orders } = await api.listOrders()
    set({ orders })
    return orders
  },

  openOrder: async id => {
    const r = await api.getOrder(id)
    set({ current: r })
  },

  applyOrder: o => {
    set(s => ({
      orders: s.orders.map(x => x.id === o.id ? o : x),
      current: s.current?.order.id === o.id ? { order: o, derived: derive(s.boot!, o) } : s.current
    }))
  },

  act: async (id, action, payload = {}, opts) => {
    set({ busy: true })
    try {
      const { order } = await api.action(id, action, payload)
      get().applyOrder(order)
      set(s => ({ boot: s.boot ? { ...s.boot } : s.boot }))
      if (!opts?.silent) get().toast(actionDoneText(action), 'ok')
      return order
    } catch (e: any) {
      get().toast(e.message || '操作失败', 'err')
      return null
    } finally {
      set({ busy: false })
    }
  },

  createOrder: async body => {
    const { order } = await api.createOrder(body)
    get().toast('定制订单已提交，等待门店接单', 'ok')
    await get().refreshOrders()
    return order
  },

  loadAnalytics: async () => {
    const analytics = await api.analytics()
    set({ analytics })
  },

  loadCoupons: async () => {
    try {
      const { coupons } = await api.coupons()
      set({ coupons })
    } catch { /* 非顾客或未登录 */ }
  },

  setStock: async (storeId, body) => {
    await api.setStock(storeId, body)
    const boot = await api.bootstrap()
    set({ boot })
    get().toast('库存已更新', 'ok')
  },

  resetDemo: async () => {
    await api.reset()
    const boot = await api.bootstrap()
    set({ boot })
    await get().refreshOrders()
    if (get().account?.role === 'customer') await get().loadCoupons()
    get().toast('演示数据已重置', 'ok')
  }
}))

function actionDoneText(a: string) {
  return ({
    pay: '支付成功', accept: '门店已接单', handoff: '取货核验并签收完成',
    start_producing: '已开始制作', mark_materials: '原料准备已登记',
    log_rework: '返工已登记', upload_photos: '照片已上传',
    cs_propose: '方案已发送给顾客确认', customer_decide: '已确认，变更落回原订单',
    open_after_sale: '售后申请已提交，客服将跟进',
    open_style_appeal: '造型申诉已提交，客服将核对四类材料后判定',
    cs_decide_appeal: '申诉判定已执行并落回原订单',
    cs_close_appeal: '申诉已归档'
  } as Record<string, string>)[a] || '操作已记录'
}

// ---- 前端派生 ----
export function derive(boot: Bootstrap, o: Order): Derived {
  const fees = o.fees.reduce((s, f) => s + f.amount, 0)
  const total = o.price.base + o.price.addons + o.price.coldChain + fees
  const modifyLocked =
    new Date(o.latestModifyAt).getTime() <= Date.now() ||
    ['producing', 'ready', 'verified', 'picked_up', 'closed'].includes(o.status)
  const afterSaleDeadline = o.pickedUpAt
    ? new Date(new Date(o.pickedUpAt).getTime() + o.afterSalesHours * 3600 * 1000).toISOString()
    : null
  return { total, modifyLocked, afterSaleDeadline }
}

// ---- 目录查找辅助 ----
export function useCatalog() {
  const boot = useStore(s => s.boot)
  return boot?.catalog as Catalog
}
export function catName(cat: Catalog, kind: keyof Pick<Catalog, 'sizes' | 'bases' | 'creams' | 'fillings' | 'fruits' | 'styles' | 'candles' | 'allergens'>, id: string) {
  const list = cat[kind] as { id: string; name: string }[]
  return list.find(x => x.id === id)?.name || id
}
export function storeName(stores: StoreInfo[], id: string) {
  return stores.find(s => s.id === id)?.name || id
}
