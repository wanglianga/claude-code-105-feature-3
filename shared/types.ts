// 三端共用领域模型：顾客端 / 门店制作端（裱花师 + 前台）/ 客服后台

export type Role = 'customer' | 'baker' | 'front' | 'cs'

export type OrderStatus =
  | 'pending_accept' // 待门店接单
  | 'accepted' // 已接单 / 备料
  | 'producing' // 制作中
  | 'ready' // 已完成待取货
  | 'verified' // 前台已核验取货码，待顾客签收
  | 'picked_up' // 已取货签收，售后窗口计算中
  | 'closed' // 售后窗口关闭
  | 'cancelled'

export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refunded'

export type CaseKind =
  | 'date_change' // 顾客临时改日期
  | 'sensitive_inscription' // 题字含敏感内容
  | 'fruit_shortage' // 草莓等水果缺货
  | 'fridge_capacity' // 门店冷柜容量不足
  | 'store_transfer' // 顾客要求换门店
  | 'after_sale' // 取货后售后（造型不符等）

export type CaseStatus = 'open' | 'awaiting_customer' | 'resolved' | 'rejected' | 'closed'

export interface Account {
  id: string
  username: string
  password: string
  name: string
  role: Role
  storeId?: string
  phone?: string
}

export interface CatalogOption {
  id: string
  name: string
  desc?: string
  price?: number
  badge?: string
}

export interface SizeOption extends CatalogOption {
  servings: number
  units: number // 占用冷柜容量
}

export interface StyleOption extends CatalogOption {
  difficulty: 1 | 2 | 3 // 造型复杂度（复盘返工率参考）
}

export interface StoreInfo {
  id: string
  name: string
  address: string
  phone: string
  fridgeCapacity: number // 每日冷柜容量（单位：标位）
  slotCapacity: number // 每个取货时段可承载订单数
  coldChainAvailable: boolean
}

export interface CakeConfig {
  sizeId: string
  baseId: string
  creamId: string
  fillingIds: string[]
  fruitIds: string[]
  avoidAllergenIds: string[] // 顾客声明需要规避的过敏原
  allergenConfirmed: boolean // 已阅读《过敏原与共用车间提示》
  styleId: string
  styleNote: string
  styleRefPhoto?: string // 造型参考图（dataURL）
  inscription: string
  inscriptionApproved: boolean
  candleId: string
  candleCount: number
  tablewareSets: number
  needColdChain: boolean // 是否需要冷藏运输
}

export interface InvoiceInfo {
  needed: boolean
  title?: string
  taxNo?: string
  email?: string
}

export interface CustomerInfo {
  contactName: string
  phone: string
  birthdayPerson: {
    name: string
    relation: string
    age?: string
    gender?: string
  }
  invoice: InvoiceInfo
}

export interface FeeItem {
  id: string
  label: string
  amount: number // 正为加收，负为退还
  reason: string
  by: string
  at: string
  caseId?: string
}

export interface CaseProposal {
  desc: string
  feeAdjust: number
  patch?: Record<string, unknown>
  by: string
  at: string
}

export interface ServiceCase {
  id: string
  kind: CaseKind
  title: string
  status: CaseStatus
  raisedBy: string
  raisedAt: string
  detail: string
  materialId?: string // 关联原料（复盘：哪些原料导致改单多）
  styleId?: string // 关联造型（复盘：哪些造型返工多）
  proposal?: CaseProposal
  customerDecisionAt?: string
  customerNote?: string
  resolution?: string
  resolvedBy?: string
  resolvedAt?: string
  closedNote?: string
  evidencePhoto?: string
  refundAmount?: number
}

export interface TimelineEvent {
  id: string
  at: string
  actorRole: Role | 'system'
  actor: string
  type:
    | 'created'
    | 'status'
    | 'modify'
    | 'payment'
    | 'note'
    | 'case'
    | 'production'
    | 'photo'
    | 'pickup'
    | 'after_sale'
    | 'fee'
  text: string
  fields?: string[]
  amount?: number
}

export interface ReworkRecord {
  id: string
  at: string
  styleId: string
  reason: string
  note: string
  cost: number // 返工内部成本
  by: string
}

export interface OrderPhotos {
  final?: string // 成品照片
  package?: string // 包装照片
  coldNotice?: string // 冷藏提示（贴/卡）
}

export interface Order {
  id: string
  pickupCode: string // 取货核验码
  createdAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  storeId: string
  pickupDate: string // YYYY-MM-DD
  slot: string // 取货时段
  latestModifyAt: string // 最晚修改时间
  customer: CustomerInfo
  cake: CakeConfig
  price: {
    base: number
    addons: number
    coldChain: number
    total: number
  }
  paidAmount: number
  fees: FeeItem[]
  timeline: TimelineEvent[]
  cases: ServiceCase[]
  reworks: ReworkRecord[]
  photos: OrderPhotos
  makeStartTime?: string
  materialsReadyAt?: string
  materialsNote?: string
  readyAt?: string
  verifiedAt?: string
  verifiedBy?: string
  pickedUpAt?: string
  afterSalesHours: number
  version: number
}

export interface Catalog {
  sizes: SizeOption[]
  bases: CatalogOption[]
  creams: CatalogOption[]
  fillings: CatalogOption[]
  fruits: CatalogOption[]
  allergens: CatalogOption[]
  styles: StyleOption[]
  candles: CatalogOption[]
  slots: string[]
  sensitiveWords: string[]
  modifyLeadHours: number
  coldChainFee: number
}

export interface AppState {
  catalog: Catalog
  stores: StoreInfo[]
  stock: Record<string, Record<string, 'ok' | 'low' | 'out'>> // storeId -> fruitId
  accounts: Omit<Account, 'password'>[]
  orders: Order[]
}

// ---- 动作载荷（/api/orders/:id/action）----
export interface ActionRequest {
  action: string
  payload?: Record<string, any>
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_accept: '待门店接单',
  accepted: '已接单·备料中',
  producing: '裱花制作中',
  ready: '待取货',
  verified: '已核验·待签收',
  picked_up: '已取货签收',
  closed: '售后已关闭',
  cancelled: '已取消'
}

export const CASE_LABEL: Record<CaseKind, string> = {
  date_change: '临时改期',
  sensitive_inscription: '题字敏感待审',
  fruit_shortage: '原料缺货',
  fridge_capacity: '冷柜容量不足',
  store_transfer: '跨店调货',
  after_sale: '售后申请'
}
