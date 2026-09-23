import type {
  Account, AppState, Catalog, Order, StoreInfo, ServiceCase,
  StyleAppeal, CustomerCoupon
} from '../shared/types'

const TOKEN_KEY = 'scs_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''

async function request<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {})
    }
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || `请求失败 (${res.status})`)
  return data as T
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; account: Account }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<{ account: Account }>('/api/auth/me'),
  bootstrap: () => request<Bootstrap>('/api/bootstrap'),
  capacity: (storeId: string, date: string) =>
    request<CapacityInfo>(`/api/capacity?storeId=${storeId}&date=${date}`),
  listOrders: () => request<{ orders: Order[] }>('/api/orders'),
  getOrder: (id: string) => request<{ order: Order; derived: Derived }>(`/api/orders/${id}`),
  createOrder: (body: any) => request<{ order: Order }>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  action: (id: string, action: string, payload: any = {}) =>
    request<{ order: Order }>(`/api/orders/${id}/action`, { method: 'POST', body: JSON.stringify({ action, payload }) }),
  setStock: (storeId: string, body: Record<string, 'ok' | 'low' | 'out'>) =>
    request<{ ok: boolean }>(`/api/stock/${storeId}`, { method: 'POST', body: JSON.stringify(body) }),
  analytics: () => request<Analytics>('/api/analytics'),
  coupons: () => request<{ coupons: CustomerCoupon[] }>('/api/coupons'),
  reset: () => request<{ ok: boolean }>('/api/reset', { method: 'POST' })
}

export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }

export interface CapacitySlot { slot: string; used: number; capacity: number }
export interface CapacityInfo {
  storeId: string; date: string; fridgeUsed: number; fridgeCapacity: number; slots: CapacitySlot[]
}
export interface Bootstrap extends Pick<AppState, 'catalog' | 'stores' | 'stock' | 'accounts'> {
  capacity: (CapacityInfo & { storeId: string })[]
}
export interface Derived { total: number; modifyLocked: boolean; afterSaleDeadline: string | null }
export interface StyleQualityByStore {
  storeId: string; store: string
  appeals: number; decided: number; open: number
  storeFault: number; customerFault: number; rejected: number
  refunds: number; coupons: number; remakes: number
  faultRate: number; delivered: number
}
export interface StyleQualityByStyle {
  styleId: string; style: string
  appeals: number; storeFault: number; remakes: number; refunds: number
}
export interface Analytics {
  reworkByStyle: { styleId: string; style: string; count: number; cost: number }[]
  changeByMaterial: { materialId: string; material: string; count: number; kinds: Record<string, number> }[]
  heat: Record<string, { store: string; slot: string; count: number; capacity: number; ratio: number }[]>
  casesByKind: Record<string, number>
  afterSaleRate: number
  fridgeToday: { storeId: string; store: string; used: number; capacity: number; date: string }[]
  styleQuality?: {
    totalAppeals: number; openAppeals: number
    storeFaultCount: number; customerFaultCount: number
    totalRefunds: number; totalCoupons: number; totalRemakes: number
    byStore: StyleQualityByStore[]
    byStyle: StyleQualityByStyle[]
    responsibilityDist: Record<string, number>
    verdictDist: Record<string, number>
  }
}

export type { Account, Catalog, Order, StoreInfo, ServiceCase, StyleAppeal, CustomerCoupon }
