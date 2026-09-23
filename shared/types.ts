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

// ---- 取货后造型申诉 ----
export type AppealIssueType =
  | 'style_mismatch' // 造型与参考图不符
  | 'inscription_wrong' // 题字错误
  | 'color_deviation' // 配色偏差
  | 'decoration_missing' // 装饰/公仔缺失或损坏
  | 'transport_deformed' // 运输造成变形/融化
  | 'other'

// 责任归属：运输造成变形时需区分门店责任与顾客自提责任
export type AppealResponsibility =
  | 'store' // 门店制作责任（出品即不符）
  | 'transport_store' // 门店运输责任（门店配送途中变形，如冷链断链/包装不当）
  | 'transport_customer' // 顾客自提责任（自提途中保管不当：常温久置/倾倒/未按冷链提示）
  | 'none' // 无门店责任（申诉不成立）

export type AppealVerdict =
  | 'refund' // 退款
  | 'remake' // 补做
  | 'coupon' // 优惠券补偿
  | 'reject' // 拒绝赔付

export type AppealStatus =
  | 'open' // 待客服判定
  | 'decided' // 已判定，结论已执行
  | 'closed' // 已归档

// 补做排班（判决为补做时重新生成）
export interface RemakeSchedule {
  pickupDate: string
  slot: string
  makeStartTime?: string // 建议开制时间
  readyAt?: string // 计划完成时间
  note: string
  renewedCode?: string // 补做单新取货码
  pickedUpAt?: string // 补做成品实际签收时间
}

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
    | 'appeal'
    | 'coupon'
    | 'remake'
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

// ---- 取货后造型申诉（顾客在签收/售后窗口内提交）----
export interface StyleAppeal {
  id: string
  orderId: string
  status: AppealStatus
  issueType: AppealIssueType
  reason: string // 问题分类短标题
  detail: string // 顾客详细说明
  foundWhen: string // 发现变形/不符的时机（门店当场/返程途中/到家后/次日食用时）
  evidencePhoto?: string // 顾客取货后上传的照片
  raisedAt: string
  raisedBy: string // 顾客姓名
  // 对比快照（提交时从订单快照，便于客服一页核对）
  pickedUpAt?: string // 签收时间
  deliveryMethod: string // 运输方式：到店自提（冷藏/常温）/ 门店配送
  needColdChain: boolean // 本单是否需要冷藏运输
  styleRefPhoto?: string // 下单参考图快照
  storeFinalPhoto?: string // 门店成品照快照
  // 客服判定
  responsibility?: AppealResponsibility
  verdict?: AppealVerdict
  decisionNote?: string // 判定说明
  decidedBy?: string
  decidedAt?: string
  // 各判决的执行结果
  refundAmount?: number // 退款判决金额
  coupon?: { id: string; amount: number; reason: string; at: string } // 优惠券入账记录（关联本次申诉原因）
  remake?: RemakeSchedule // 补做排班
}

// ---- 顾客账户优惠券 ----
export interface CustomerCoupon {
  id: string
  phone: string // 归属顾客（按手机号）
  amount: number
  title: string
  reason: string // 关联的申诉原因
  appealId?: string
  orderId?: string
  grantedAt: string
  expireAt: string
  used: boolean
  usedAt?: string
  source: 'appeal' | 'manual'
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
  appeals: StyleAppeal[] // 取货后造型申诉
  remakeOf?: string // 补做单：来源原订单 ID
  remakeCount: number // 本单被补做次数（质量统计）
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
  coupons: CustomerCoupon[]
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

// ---- 取货后造型申诉：文案映射 ----
export const APPEAL_ISSUE_LABEL: Record<AppealIssueType, string> = {
  style_mismatch: '造型与下单参考不符',
  inscription_wrong: '题字错误',
  color_deviation: '配色偏差',
  decoration_missing: '装饰/公仔缺失或损坏',
  transport_deformed: '运输造成变形/融化',
  other: '其他造型问题'
}

export const APPEAL_RESPONSIBILITY_LABEL: Record<AppealResponsibility, string> = {
  store: '门店制作责任',
  transport_store: '门店运输责任',
  transport_customer: '顾客自提责任',
  none: '无门店责任'
}

export const APPEAL_VERDICT_LABEL: Record<AppealVerdict, string> = {
  refund: '退款',
  remake: '补做',
  coupon: '优惠券补偿',
  reject: '拒绝赔付'
}

export const APPEAL_STATUS_LABEL: Record<AppealStatus, { t: string; c: string }> = {
  open: { t: '待客服判定', c: 'red' },
  decided: { t: '已判定', c: 'green' },
  closed: { t: '已归档', c: 'gray' }
}

// 运输变形类问题：客服必须在门店责任与顾客自提责任之间判定
export const TRANSPORT_ISSUES: AppealIssueType[] = ['transport_deformed']
