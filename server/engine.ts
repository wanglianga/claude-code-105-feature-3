import type {
  Order, AppState, OrderStatus, ServiceCase, CaseKind, TimelineEvent, FeeItem,
  ReworkRecord, Account, CakeConfig, CustomerInfo, StyleAppeal, AppealVerdict,
  AppealResponsibility, CustomerCoupon
} from '../shared/types'
import { getState, nextOrderNo, nextPickupCode, saveState } from './store'

let seq = 0
function uid(prefix: string) {
  seq += 1
  return `${prefix}${Date.now().toString(36)}${seq}`
}

export function nowIso() {
  return new Date().toISOString()
}

export class ActionError extends Error {
  status = 400
}

// ---------- 派生计算 ----------
export function orderTotal(o: Order) {
  const fees = o.fees.reduce((s, f) => s + f.amount, 0)
  return o.price.base + o.price.addons + o.price.coldChain + fees
}

export function fridgeUsage(state: AppState, storeId: string, date: string, includePending = true) {
  const sizeUnits = new Map(state.catalog.sizes.map(s => [s.id, s.units]))
  return state.orders
    .filter(o => o.storeId === storeId && o.pickupDate === date &&
      !['cancelled', 'picked_up', 'closed'].includes(o.status) &&
      (includePending || o.status !== 'pending_accept'))
    .reduce((sum, o) => sum + (sizeUnits.get(o.cake.sizeId) || 1), 0)
}

export function slotUsage(state: AppState, storeId: string, date: string, slot: string) {
  return state.orders.filter(o =>
    o.storeId === storeId && o.pickupDate === date && o.slot === slot && o.status !== 'cancelled').length
}

export function sensitiveHit(state: AppState, text: string): string[] {
  return state.catalog.sensitiveWords.filter(w => w && text.includes(w))
}

export function modifyLocked(o: Order): boolean {
  return new Date(o.latestModifyAt).getTime() <= Date.now() ||
    ['producing', 'ready', 'verified', 'picked_up', 'closed'].includes(o.status)
}

export function afterSaleDeadline(o: Order): string | null {
  if (!o.pickedUpAt) return null
  return new Date(new Date(o.pickedUpAt).getTime() + o.afterSalesHours * 3600 * 1000).toISOString()
}

export function openBlockingCase(o: Order): ServiceCase | undefined {
  return o.cases.find(c =>
    ['open', 'awaiting_customer'].includes(c.status) && c.kind === 'sensitive_inscription')
}

function tl(o: Order, e: Omit<TimelineEvent, 'id' | 'at'> & { at?: string }) {
  o.timeline.push({ id: uid('ev'), at: e.at || nowIso(), ...e })
}

function actorName(actor: Account) {
  return actor.name
}

// ---------- 下单 ----------
export function createOrder(input: {
  storeId: string; pickupDate: string; slot: string
  customer: CustomerInfo; cake: CakeConfig
}, actor: Account): Order {
  const state = getState()
  const store = state.stores.find(s => s.id === input.storeId)
  if (!store) throw new ActionError('请选择取货门店')
  if (!input.cake.allergenConfirmed) throw new ActionError('请先确认过敏原与共用车间提示')
  // 敏感题字：不阻断下单，冻结题字并转客服人工审核（裱花师开制前会被拦截，避免返工）

  // 价格
  const cat = state.catalog
  const priceOf = (id: string, list: { id: string; price?: number }[]) => list.find(x => x.id === id)?.price || 0
  const size = cat.sizes.find(s => s.id === input.cake.sizeId)
  const base = size?.price || 0
  const addons =
    priceOf(input.cake.baseId, cat.bases) +
    priceOf(input.cake.creamId, cat.creams) +
    input.cake.fillingIds.reduce((s, id) => s + priceOf(id, cat.fillings), 0) +
    input.cake.fruitIds.reduce((s, id) => s + priceOf(id, cat.fruits), 0) +
    priceOf(input.cake.styleId, cat.styles) +
    priceOf(input.cake.candleId, cat.candles) +
    Math.max(0, input.cake.tablewareSets - 6) * 2
  const coldChain = input.cake.needColdChain ? cat.coldChainFee : 0
  if (input.cake.needColdChain && !store.coldChainAvailable)
    throw new ActionError('该门店暂不支持冷藏运输服务，请选择其他门店或取消冷藏运输')

  // 最晚修改时间 = 取货日前一天 18:00（且不少于 modifyLeadHours）
  const pickup = new Date(`${input.pickupDate}T12:00:00`)
  const lead = new Date(pickup.getTime() - cat.modifyLeadHours * 3600 * 1000)
  const dayBefore = new Date(pickup); dayBefore.setDate(dayBefore.getDate() - 1); dayBefore.setHours(18, 0, 0, 0)
  const latest = lead.getTime() < dayBefore.getTime() ? lead : dayBefore

  const o: Order = {
    id: nextOrderNo(),
    pickupCode: nextPickupCode(),
    createdAt: nowIso(),
    status: 'pending_accept',
    paymentStatus: 'unpaid',
    storeId: input.storeId,
    pickupDate: input.pickupDate,
    slot: input.slot,
    latestModifyAt: latest.toISOString(),
    customer: input.customer,
    cake: input.cake,
    price: { base, addons, coldChain, total: base + addons + coldChain },
    paidAmount: 0,
    fees: [], timeline: [], cases: [], reworks: [], photos: {},
    appeals: [], remakeCount: 0,
    afterSalesHours: 24,
    version: 1
  }
  tl(o, { actorRole: 'customer', actor: actor.name, type: 'created', text: `顾客提交生日蛋糕定制订单（${store.name} ${input.pickupDate} ${input.slot} 取货）` })

  // 下单时题字命中敏感词：转人工审核工单（题字冻结，确认前裱花师无法开制）
  const hits0 = sensitiveHit(state, input.cake.inscription)
  if (hits0.length) {
    raiseCase(o, 'sensitive_inscription', 'system',
      `题字含敏感内容待客服审核（命中：${hits0.join('、')}）`,
      { detail: `顾客下单题字“${input.cake.inscription}”命中敏感词 ${hits0.join('、')}；门店不得按原题字制作，等待客服与顾客确认替代文案` })
  }

  // 库存预检：草莓等缺货自动提示（不阻断，记录为风险，门店接单后由客服工单跟进）
  const missing = input.cake.fruitIds.filter(f => state.stock[input.storeId]?.[f] === 'out')
  if (missing.length) {
    const names = missing.map(id => cat.fruits.find(f => f.id === id)?.name).join('、')
    raiseCase(o, 'fruit_shortage', 'system', `下单预检：${names} 当前门店缺货`, {
      materialId: missing[0],
      detail: `顾客所选 ${names} 在该门店标记为缺货，等待门店/客服给出替代方案`
    })
  }

  state.orders.unshift(o)
  saveState()
  return o
}

// ---------- 工单 ----------
export function raiseCase(o: Order, kind: CaseKind, raisedBy: string, title: string,
  opts: { detail?: string; materialId?: string; styleId?: string; at?: string } = {}): ServiceCase {
  const c: ServiceCase = {
    id: uid('cs'), kind, title, status: 'open',
    raisedBy, raisedAt: opts.at || nowIso(),
    detail: opts.detail || title,
    materialId: opts.materialId, styleId: opts.styleId
  }
  o.cases.unshift(c)
  tl(o, {
    actorRole: raisedBy === 'system' ? 'system' : 'cs',
    actor: raisedBy === 'system' ? '系统风控' : raisedBy,
    type: 'case',
    at: opts.at,
    text: `异常工单开启：${title}`
  })
  return c
}

export function csPropose(o: Order, caseId: string, p: { desc: string; feeAdjust: number; patch?: Record<string, unknown> }, actor: Account) {
  const c = mustCase(o, caseId)
  if (!['open', 'awaiting_customer'].includes(c.status)) throw new ActionError('该工单已处理完成')
  c.proposal = { desc: p.desc, feeAdjust: p.feeAdjust, patch: p.patch, by: actor.name, at: nowIso() }
  c.status = 'awaiting_customer'
  tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服说明并给出方案：${p.desc}${p.feeAdjust ? `（费用调整 ${p.feeAdjust > 0 ? '加收' : '退还'} ¥${Math.abs(p.feeAdjust)}）` : ''}` })
  saveState()
  return c
}

export function customerDecide(o: Order, caseId: string, accept: boolean, note: string | undefined, actor: Account) {
  const c = mustCase(o, caseId)
  if (c.status !== 'awaiting_customer' || !c.proposal) throw new ActionError('该工单没有待确认的方案')
  c.customerDecisionAt = nowIso()
  c.customerNote = note || ''
  if (!accept) {
    c.status = 'open'
    tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'case', text: `顾客拒绝方案${note ? '：' + note : ''}，等待客服重新沟通` })
    saveState()
    return c
  }
  // 应用补丁（题字/日期/时段/门店/水果等都回写原订单）
  if (c.proposal.patch) applyPatch(o, c.proposal.patch)
  if (c.proposal.feeAdjust !== 0) {
    const fee: FeeItem = {
      id: uid('fee'), label: feeLabel(c.kind), amount: c.proposal.feeAdjust,
      reason: c.proposal.desc, by: actorName(actor), at: nowIso(), caseId: c.id
    }
    o.fees.push(fee)
    if (c.proposal.feeAdjust < 0) {
      c.refundAmount = (c.refundAmount || 0) + Math.abs(c.proposal.feeAdjust)
      o.paidAmount = Math.max(0, o.paidAmount + c.proposal.feeAdjust)
      if (o.paidAmount === 0) o.paymentStatus = 'refunded'
      tl(o, { actorRole: 'cs', actor: '系统', type: 'fee', text: `退款 ¥${Math.abs(fee.amount)} 已原路退回（${fee.label}）`, amount: fee.amount })
    } else {
      o.paymentStatus = 'partial'
      tl(o, { actorRole: 'cs', actor: '系统', type: 'fee', text: `加收 ¥${fee.amount}（${fee.label}），等待顾客补差价`, amount: fee.amount })
    }
  }
  o.price.total = orderTotal(o)
  c.status = 'resolved'
  c.resolvedBy = actorName(actor)
  c.resolvedAt = nowIso()
  c.resolution = c.proposal.desc
  tl(o, {
    actorRole: 'customer', actor: actorName(actor), type: 'case',
    text: `顾客确认方案，变更已落回原订单；${c.kind === 'fruit_shortage' ? '门店按新原料制作，' : ''}${c.kind === 'sensitive_inscription' ? '门店按新题字制作，' : ''}费用与排期同步更新`
  })
  saveState()
  return c
}

function feeLabel(kind: CaseKind) {
  return {
    date_change: '改期服务费调整',
    sensitive_inscription: '题字审核改单',
    fruit_shortage: '缺货替代/退还',
    fridge_capacity: '冷柜调度调整',
    store_transfer: '跨店调货费',
    after_sale: '售后补偿退款'
  }[kind]
}

function applyPatch(o: Order, patch: Record<string, unknown>) {
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('cake.')) {
      const field = k.slice(5) as keyof CakeConfig
      ;(o.cake as any)[field] = v
    } else if (k === 'pickupDate' || k === 'slot' || k === 'latestModifyAt' || k === 'storeId' || k === 'makeStartTime' || k === 'materialsReadyAt') {
      ;(o as any)[k] = v
    }
  }
}

export function csCloseCase(o: Order, caseId: string, note: string, actor: Account) {
  const c = mustCase(o, caseId)
  c.status = 'closed'
  c.closedNote = note
  tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服关闭工单：${note}` })
  saveState()
}

export function csRejectCase(o: Order, caseId: string, note: string, actor: Account) {
  const c = mustCase(o, caseId)
  c.status = 'rejected'
  c.closedNote = note
  tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服驳回工单：${note}` })
  saveState()
}

export function csNote(o: Order, text: string, actor: Account) {
  tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'note', text })
  saveState()
}

function mustCase(o: Order, id: string) {
  const c = o.cases.find(x => x.id === id)
  if (!c) throw new ActionError('工单不存在')
  return c
}

// ---------- 顾客：支付 / 自助修改 ----------
export function pay(o: Order, actor: Account) {
  const total = orderTotal(o)
  const due = total - o.paidAmount
  if (due <= 0) throw new ActionError('订单已结清')
  o.paidAmount += due
  o.paymentStatus = 'paid'
  tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'payment', text: `在线支付 ¥${due}`, amount: due })
  saveState()
}

export function customerModify(o: Order, patch: { cake?: Partial<CakeConfig>; pickupDate?: string; slot?: string }, actor: Account) {
  if (modifyLocked(o)) throw new ActionError(`已过最晚修改时间（${fmt(o.latestModifyAt)}）或订单已进入制作，自助修改已关闭；请联系客服发起改期工单`)
  const state = getState()
  const before = JSON.stringify({ cake: o.cake, d: o.pickupDate, s: o.slot })
  if (patch.cake) Object.assign(o.cake, patch.cake)
  if (patch.pickupDate) o.pickupDate = patch.pickupDate
  if (patch.slot) o.slot = patch.slot
  // 敏感题字：不直接生效，转人工审核工单
  if (patch.cake?.inscription !== undefined) {
    const hits = sensitiveHit(state, patch.cake.inscription)
    if (hits.length) {
      raiseCase(o, 'sensitive_inscription', 'system',
        `题字含敏感内容待客服审核（命中：${hits.join('、')}）`,
        { detail: `顾客在修改截止前提交题字“${patch.cake.inscription}”，命中敏感词 ${hits.join('、')}；题字暂按原文冻结，等待客服与顾客确认替代文案` })
    }
  }
  o.version += 1
  tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'modify', text: '顾客在可修改窗口内更新定制信息，已同步给门店制作端' })
  if (JSON.stringify({ cake: o.cake, d: o.pickupDate, s: o.slot }) !== before) saveState()
  return o
}

// ---------- 门店：前台 ----------
export function acceptOrder(o: Order, actor: Account) {
  if (o.status !== 'pending_accept') throw new ActionError('只有待接单订单可以接单')
  const state = getState()
  const size = state.catalog.sizes.find(s => s.id === o.cake.sizeId)
  // 容量只统计已接单/在制订单（待接单不锁容量，避免两单互相卡死）
  const used = fridgeUsage(state, o.storeId, o.pickupDate, false)
  if (used + (size?.units || 1) > state.stores.find(s => s.id === o.storeId)!.fridgeCapacity) {
    raiseCase(o, 'fridge_capacity', actor.name,
      `接单预警：${o.pickupDate} 冷柜容量不足（已占 ${used}/${state.stores.find(s => s.id === o.storeId)!.fridgeCapacity}）`,
      { detail: '前台尝试接单时发现冷柜容量不足，需客服协调改时段、跨店调货或增加冷链周转' })
    throw new ActionError('冷柜容量不足，已自动开启冷柜调度工单，请客服协调后再接单')
  }
  setStatus(o, 'accepted', actor, '门店确认接单，原料与排班进入准备')
  saveState()
}

export function handoff(o: Order, code: string, signer: string, actor: Account) {
  if (o.status !== 'ready') throw new ActionError('订单尚未进入待取货状态，不能核验取货')
  if (code.trim() !== o.pickupCode) throw new ActionError('取货码核验失败，请与顾客核对短信中的 4 位取货码')
  if (o.paymentStatus !== 'paid') throw new ActionError(`支付状态为「${o.paymentStatus === 'unpaid' ? '未支付' : '部分支付'}」，请先完成收银再交付`)
  if (o.cake.needColdChain && !o.photos.coldNotice) throw new ActionError('冷藏提示照片缺失，请裱花师补传后再交付')
  o.status = 'verified'
  o.verifiedAt = nowIso(); o.verifiedBy = actor.name
  tl(o, { actorRole: 'front', actor: actorName(actor), type: 'pickup', text: `取货码 ${o.pickupCode} 核验通过`, fields: [`核验方式：4 位取货码 + 手机号尾号 ${o.customer.phone.slice(-4)}`] })
  o.status = 'picked_up'
  o.pickedUpAt = nowIso()
  tl(o, { actorRole: 'front', actor: actorName(actor), type: 'pickup', text: `顾客${signer ? '（' + signer + '）' : ''}当面签收取货，${o.afterSalesHours} 小时售后窗口开始计算`, fields: ['成品照片/包装照片已留存', '冷藏提示已当面告知'] })
  // 补做单再次签收：回填申诉补做排班的实际取货时间
  const remakeAppeal = o.appeals.find(a => a.verdict === 'remake' && a.remake && !a.remake.pickedUpAt)
  if (remakeAppeal?.remake) {
    remakeAppeal.remake.pickedUpAt = nowIso()
    tl(o, { actorRole: 'front', actor: actorName(actor), type: 'remake', text: `补做成品已由顾客签收（取货码 ${o.pickupCode}），造型申诉补做闭环`, fields: [`约定取货：${remakeAppeal.remake.pickupDate} ${remakeAppeal.remake.slot}`] })
  }
  saveState()
}

// ---------- 门店：裱花师 ----------
export function markMaterials(o: Order, note: string, actor: Account) {
  o.materialsReadyAt = nowIso()
  o.materialsNote = note
  tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: '原料准备完成', fields: note.split('\n').filter(Boolean) })
  saveState()
}

export function startProducing(o: Order, actor: Account) {
  if (!['accepted'].includes(o.status)) throw new ActionError('当前状态不能开始制作')
  const block = openBlockingCase(o)
  if (block) throw new ActionError(`题字待客服/顾客确认（工单 ${block.id}），确认前不得开制，避免裱花返工`)
  if (!o.materialsReadyAt) throw new ActionError('请先登记原料准备完成')
  setStatus(o, 'producing', actor, '裱花师开始制作')
  o.makeStartTime = nowIso()
  saveState()
}

export function logRework(o: Order, r: { reason: string; note: string; cost: number }, actor: Account) {
  const rec: ReworkRecord = {
    id: uid('rw'), at: nowIso(), styleId: o.cake.styleId,
    reason: r.reason, note: r.note, cost: r.cost, by: actor.name
  }
  o.reworks.push(rec)
  tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: `登记裱花返工：${r.reason}（内部成本约 ¥${r.cost}）`, fields: [r.note] })
  saveState()
}

export function reportFruitShortage(o: Order, fruitId: string, note: string, actor: Account) {
  const state = getState()
  state.stock[o.storeId] = state.stock[o.storeId] || {}
  state.stock[o.storeId][fruitId] = 'out'
  const fname = state.catalog.fruits.find(f => f.id === fruitId)?.name || fruitId
  raiseCase(o, 'fruit_shortage', actor.name, `${fname}缺货，需替代方案或退款`, {
    materialId: fruitId,
    detail: `${actor.name} 备料时发现 ${fname} 缺货。${note ? '备注：' + note : ''} 可选：替换等价水果 / 退还该水果加价 / 顾客改款。`
  })
  saveState()
}

export function reportFridge(o: Order, note: string, actor: Account) {
  const state = getState()
  const store = state.stores.find(s => s.id === o.storeId)!
  const used = fridgeUsage(state, o.storeId, o.pickupDate, false)
  raiseCase(o, 'fridge_capacity', actor.name, `冷柜容量不足（${used}/${store.fridgeCapacity}）`, {
    detail: `${note ? note + '；' : ''}${o.pickupDate} 当日冷柜已占用 ${used}/${store.fridgeCapacity}，需协调取货时段、冷链周转或跨店调货。`
  })
  saveState()
}

export function uploadPhotos(o: Order, photos: { final?: string; package?: string; coldNotice?: string }, actor: Account) {
  Object.assign(o.photos, photos)
  const labels: string[] = []
  if (photos.final) labels.push('成品照片')
  if (photos.package) labels.push('包装照片')
  if (photos.coldNotice) labels.push('冷藏提示卡')
  tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'photo', text: `门店上传交付材料：${labels.join('、')}` })
  if (o.photos.final && o.photos.package && ['producing', 'accepted'].includes(o.status)) {
    setStatus(o, 'ready', actor, '成品与包装核验通过，进入待取货')
    o.readyAt = nowIso()
  }
  saveState()
}

function setStatus(o: Order, s: OrderStatus, actor: Account, text: string) {
  o.status = s
  tl(o, { actorRole: actor.role === 'baker' ? 'baker' : actor.role === 'front' ? 'front' : 'system', actor: actor.name, type: 'status', text })
}

// ---------- 顾客：过截止时间后的改期 / 换店申请 ----------
export function customerRequestChange(o: Order, kind: 'date_change' | 'store_transfer', detail: string,
  wish: { pickupDate?: string; slot?: string; storeId?: string }, actor: Account) {
  if (kind === 'date_change') {
    raiseCase(o, 'date_change', actor.name, '顾客申请临时改期', {
      detail: `顾客申请改期：原 ${o.pickupDate} ${o.slot} → 期望 ${wish.pickupDate || '?'} ${wish.slot || '同时段'}。原因：${detail}。已过最晚修改时间，需门店评估排班与原料，客服确认费用。`
    })
  } else {
    const state = getState()
    const target = state.stores.find(s => s.id === wish.storeId)
    raiseCase(o, 'store_transfer', actor.name, `顾客申请换门店：${target?.name || wish.storeId}`, {
      detail: `顾客因${detail || '行程变更'}申请由原门店转至「${target?.name || wish.storeId}」取货（期望 ${wish.pickupDate || o.pickupDate} ${wish.slot || o.slot}）。需两店确认冷柜、原料与排班。`
    })
  }
  saveState()
}

// ---------- 售后 ----------
export function openAfterSale(o: Order, r: { reason: string; detail: string; evidencePhoto?: string }, actor: Account) {
  if (o.status !== 'picked_up') throw new ActionError('只有已签收订单可以发起售后')
  const dl = afterSaleDeadline(o)!
  if (Date.now() > new Date(dl).getTime()) throw new ActionError(`售后窗口已于 ${fmt(dl)} 关闭`)
  const styleIssue = /造型|不符|偏差|图案|公仔|手绘/.test(r.reason + r.detail)
  raiseCase(o, 'after_sale', actor.name, `售后：${r.reason}`, {
    styleId: styleIssue ? o.cake.styleId : undefined,
    detail: r.detail
  })
  o.cases[0].evidencePhoto = r.evidencePhoto
  saveState()
}

// ---------- 取货后造型申诉 ----------
export function deliveryMethodText(o: Order): string {
  return o.cake.needColdChain ? '到店自提 · 冷藏运输（门店提供保温袋/冰袋）' : '到店自提 · 常温携带'
}

let appealSeq = 0
export function openStyleAppeal(o: Order, r: {
  issueType: StyleAppeal['issueType']
  detail: string
  foundWhen: string
  evidencePhoto?: string
}, actor: Account): StyleAppeal {
  if (o.status !== 'picked_up') throw new ActionError('只有已签收（取货后）订单可以发起造型申诉')
  if (!o.pickedUpAt) throw new ActionError('缺少签收时间，无法发起申诉')
  const dl = afterSaleDeadline(o)!
  if (Date.now() > new Date(dl).getTime()) throw new ActionError(`售后窗口已于 ${fmt(dl)} 关闭，无法发起造型申诉`)
  if (!r.evidencePhoto) throw new ActionError('请上传取货后的问题照片，便于客服对比下单参考与门店成品照')
  if (!r.detail.trim()) throw new ActionError('请描述造型不符的具体情况')
  if (o.appeals.some(a => a.status === 'open')) throw new ActionError('本单已有一条待客服判定的造型申诉，请等待处理结果')

  const a: StyleAppeal = {
    id: uid('ap'),
    orderId: o.id,
    status: 'open',
    issueType: r.issueType,
    reason: APPEAL_ISSUE[r.issueType],
    detail: r.detail.trim(),
    foundWhen: r.foundWhen,
    evidencePhoto: r.evidencePhoto,
    raisedAt: nowIso(),
    raisedBy: actor.name,
    pickedUpAt: o.pickedUpAt,
    deliveryMethod: deliveryMethodText(o),
    needColdChain: o.cake.needColdChain,
    styleRefPhoto: o.cake.styleRefPhoto,
    storeFinalPhoto: o.photos.final
  }
  o.appeals.unshift(a)
  tl(o, {
    actorRole: 'customer', actor: actor.name, type: 'appeal',
    text: `顾客取货后发起造型申诉：${APPEAL_ISSUE[r.issueType]}（${r.foundWhen}发现）`,
    fields: [r.detail.trim()]
  })
  saveState()
  return a
}

const APPEAL_ISSUE: Record<StyleAppeal['issueType'], string> = {
  style_mismatch: '造型与下单参考不符',
  inscription_wrong: '题字错误',
  color_deviation: '配色偏差',
  decoration_missing: '装饰/公仔缺失或损坏',
  transport_deformed: '运输造成变形/融化',
  other: '其他造型问题'
}

const STORE_SIDE: AppealResponsibility[] = ['store', 'transport_store']

// 客服判定：退款 / 补做 / 优惠券 / 拒绝赔付
export function csDecideAppeal(o: Order, appealId: string, d: {
  verdict: AppealVerdict
  responsibility: AppealResponsibility
  note: string
  refundAmount?: number
  couponAmount?: number
  pickupDate?: string
  slot?: string
}, actor: Account): StyleAppeal {
  const state = getState()
  const a = o.appeals.find(x => x.id === appealId)
  if (!a) throw new ActionError('申诉不存在')
  if (a.status !== 'open') throw new ActionError('该申诉已判定，不可重复处理')

  // 责任与判决的一致性约束
  if (a.issueType === 'transport_deformed' && !['transport_store', 'transport_customer'].includes(d.responsibility)) {
    throw new ActionError('运输造成变形必须在「门店运输责任」与「顾客自提责任」之间判定')
  }
  if (d.responsibility === 'transport_customer' && d.verdict !== 'reject') {
    throw new ActionError('判定为顾客自提责任（自提途中未按冷藏提示保管/倾倒/常温久置）时，门店不予赔付，结论只能是拒绝赔付')
  }
  if (d.responsibility === 'none' && d.verdict !== 'reject') {
    throw new ActionError('判定为无门店责任（申诉不成立）时，结论只能是拒绝赔付')
  }
  if (!d.note.trim()) throw new ActionError('请填写判定说明，会同步给顾客')

  a.responsibility = d.responsibility
  a.verdict = d.verdict
  a.decisionNote = d.note.trim()
  a.decidedBy = actor.name
  a.decidedAt = nowIso()
  a.status = 'decided'

  const respText = RESP_LABEL[d.responsibility]
  const storeSide = STORE_SIDE.includes(d.responsibility)

  if (d.verdict === 'refund') {
    const amount = Math.max(0, Math.round(Number(d.refundAmount) || 0))
    if (amount <= 0) throw new ActionError('退款金额必须大于 0')
    if (amount > o.paidAmount + (a.refundAmount || 0)) throw new ActionError('退款金额不能超过本单实际支付余额')
    const fee: FeeItem = {
      id: uid('fee'), label: '造型申诉退款', amount: -amount,
      reason: `取货后造型申诉（${a.reason}）· ${respText}：${d.note.trim()}`,
      by: actor.name, at: nowIso()
    }
    o.fees.push(fee)
    a.refundAmount = amount
    o.paidAmount = Math.max(0, o.paidAmount - amount)
    if (o.paidAmount === 0) o.paymentStatus = 'refunded'
    o.price.total = orderTotal(o)
    tl(o, { actorRole: 'cs', actor: actor.name, type: 'appeal', text: `客服判定造型申诉成立（${respText}），结论：退款 ¥${amount}`, amount: -amount, fields: [d.note.trim()] })
    tl(o, { actorRole: 'cs', actor: '系统', type: 'fee', text: `退款 ¥${amount} 已原路退回（造型申诉 ${a.id}）`, amount: -amount })
  }

  if (d.verdict === 'coupon') {
    const amount = Math.max(0, Math.round(Number(d.couponAmount) || 0))
    if (amount <= 0) throw new ActionError('优惠券面额必须大于 0')
    const expire = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
    const cp: CustomerCoupon = {
      id: uid('cp'),
      phone: o.customer.phone,
      amount,
      title: `造型关怀券 ¥${amount}`,
      reason: `取货后造型申诉（订单 ${o.id}）：${a.reason}`,
      appealId: a.id,
      orderId: o.id,
      grantedAt: nowIso(),
      expireAt: expire,
      used: false,
      source: 'appeal'
    }
    state.coupons.push(cp)
    a.coupon = { id: cp.id, amount, reason: cp.reason, at: cp.grantedAt }
    tl(o, { actorRole: 'cs', actor: actor.name, type: 'coupon', text: `客服判定（${respText}），结论：发放 ¥${amount} 优惠券至顾客账户`, fields: [`券号 ${cp.id}`, `关联申诉原因：${a.reason}`, `有效期至 ${expire.slice(0, 10)}`] })
  }

  if (d.verdict === 'remake') {
    if (!d.pickupDate || !d.slot) throw new ActionError('补做必须与顾客约定新的取货日期与时段')
    if (d.pickupDate < new Date().toISOString().slice(0, 10)) throw new ActionError('补做取货日期不能早于今天')
    // 容量校验（原单已签收、不占容量；这里校验补做单重新进入排班后的容量）
    const size = state.catalog.sizes.find(s => s.id === o.cake.sizeId)
    const used = fridgeUsage(state, o.storeId, d.pickupDate, false)
    const cap = state.stores.find(s => s.id === o.storeId)!.fridgeCapacity
    if (used + (size?.units || 1) > cap) {
      throw new ActionError(`${d.pickupDate} 冷柜容量不足（已占 ${used}/${cap}），请换时段或换日期后再判定补做`)
    }
    // 重新生成制作排班与取货时间
    const slotStart = d.slot.slice(0, 5)
    const pickupDt = new Date(`${d.pickupDate}T${slotStart}:00`)
    const makeDt = new Date(pickupDt.getTime() - 2 * 3600 * 1000)
    const newCode = nextPickupCode()
    a.remake = {
      pickupDate: d.pickupDate,
      slot: d.slot,
      makeStartTime: makeDt.toISOString(),
      readyAt: pickupDt.toISOString(),
      note: `造型申诉（${a.reason}）判定补做；门店按原定制要求重新制作，交付出品前重新上传成品/包装照片${o.cake.needColdChain ? '与冷藏提示卡' : ''}`,
      renewedCode: newCode
    }
    // 原单回到制作流程
    const oldDate = o.pickupDate, oldSlot = o.slot
    o.remakeCount += 1
    o.status = 'accepted'
    o.pickupDate = d.pickupDate
    o.slot = d.slot
    o.latestModifyAt = nowIso() // 补做单锁定自助修改
    o.makeStartTime = undefined
    o.materialsReadyAt = undefined
    o.materialsNote = undefined
    o.readyAt = undefined
    o.verifiedAt = undefined
    o.verifiedBy = undefined
    o.pickedUpAt = undefined
    o.pickupCode = newCode
    o.photos = {}
    o.version += 1
    tl(o, {
      actorRole: 'cs', actor: actor.name, type: 'remake',
      text: `客服判定（${respText}），结论：补做。制作排班已重新生成：${oldDate} ${oldSlot} → ${d.pickupDate} ${d.slot}，新取货码 ${newCode}`,
      fields: [`建议开制：${fmt(makeDt.toISOString())}`, `计划完成：${fmt(pickupDt.toISOString())}`, '原定制要求不变，出品前重新上传成品/包装照片']
    })
  }

  if (d.verdict === 'reject') {
    tl(o, {
      actorRole: 'cs', actor: actor.name, type: 'appeal',
      text: `客服判定申诉不成立（${respText}），结论：拒绝赔付`,
      fields: [d.note.trim()]
    })
  }

  saveState()
  return a
}

const RESP_LABEL: Record<AppealResponsibility, string> = {
  store: '门店制作责任',
  transport_store: '门店运输责任',
  transport_customer: '顾客自提责任',
  none: '无门店责任'
}

export function closeAppeal(o: Order, appealId: string, note: string, actor: Account) {
  const a = o.appeals.find(x => x.id === appealId)
  if (!a) throw new ActionError('申诉不存在')
  a.status = 'closed'
  a.decisionNote = (a.decisionNote ? a.decisionNote + '\n' : '') + `归档：${note}`
  tl(o, { actorRole: 'cs', actor: actor.name, type: 'appeal', text: `造型申诉归档：${note}` })
  saveState()
}

export function listCoupons(state: AppState, phone?: string): CustomerCoupon[] {
  const list = [...state.coupons].sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
  return phone ? list.filter(c => c.phone === phone) : list
}

// ---------- 复盘聚合 ----------
export function analytics(state: AppState) {
  const styleName = new Map(state.catalog.styles.map(s => [s.id, s.name]))
  const reworkByStyle = new Map<string, { count: number; cost: number }>()
  for (const o of state.orders) for (const r of o.reworks) {
    const k = r.styleId
    const cur = reworkByStyle.get(k) || { count: 0, cost: 0 }
    cur.count += 1; cur.cost += r.cost
    reworkByStyle.set(k, cur)
  }
  const matName = new Map(state.catalog.fruits.map(f => [f.id, f.name]))
  const changeByMaterial = new Map<string, { count: number; kinds: Record<string, number> }>()
  for (const o of state.orders) for (const c of o.cases) {
    if (!c.materialId) continue
    const cur = changeByMaterial.get(c.materialId) || { count: 0, kinds: {} }
    cur.count += 1
    cur.kinds[c.kind] = (cur.kinds[c.kind] || 0) + 1
    changeByMaterial.set(c.materialId, cur)
  }
  // 取货拥挤度：按门店 × 时段
  const heat: Record<string, { store: string; slot: string; count: number; capacity: number; ratio: number }[]> = {}
  for (const s of state.stores) {
    heat[s.id] = state.catalog.slots.map(slot => {
      const count = state.orders.filter(o => o.storeId === s.id && o.slot === slot && o.status !== 'cancelled').length
      return { store: s.name, slot, count, capacity: s.slotCapacity * 5, ratio: count / (s.slotCapacity * 5) }
    })
  }
  const casesByKind: Record<string, number> = {}
  for (const o of state.orders) for (const c of o.cases) casesByKind[c.kind] = (casesByKind[c.kind] || 0) + 1
  const afterCases = state.orders.flatMap(o => o.cases.filter(c => c.kind === 'after_sale'))

  // ---- 门店造型质量统计：取货后造型申诉 ----
  const storeName = new Map(state.stores.map(s => [s.id, s.name]))
  const allAppeals = state.orders.flatMap(o => o.appeals.map(a => ({ o, a })))
  const decidedAppeals = allAppeals.filter(x => aDecided(x.a))
  // 门店担责口径：门店制作责任 + 门店运输责任（自提责任不计门店质量问题）
  const storeAtFault = (a: StyleAppeal) => !!a.responsibility && ['store', 'transport_store'].includes(a.responsibility)

  const qualityByStore = state.stores.map(s => {
    const rows = allAppeals.filter(x => x.o.storeId === s.id)
    const decided = rows.filter(x => aDecided(x.a))
    const atFault = decided.filter(x => storeAtFault(x.a))
    const refund = decided.reduce((sum, x) => sum + (x.a.refundAmount || 0), 0)
    const couponSum = decided.reduce((sum, x) => sum + (x.a.coupon?.amount || 0), 0)
    const remakes = decided.filter(x => x.a.verdict === 'remake').length
    const delivered = state.orders.filter(o => o.storeId === s.id && ['picked_up', 'closed'].includes(o.status)).length
    return {
      storeId: s.id, store: s.name,
      appeals: rows.length,
      decided: decided.length,
      open: rows.filter(x => x.a.status === 'open').length,
      storeFault: atFault.length,
      customerFault: decided.filter(x => x.a.responsibility === 'transport_customer').length,
      rejected: decided.filter(x => x.a.verdict === 'reject').length,
      refunds: refund,
      coupons: couponSum,
      remakes,
      faultRate: delivered ? atFault.length / delivered : 0,
      delivered
    }
  }).sort((a, b) => b.storeFault - a.storeFault || b.appeals - a.appeals)

  // 按造型聚合：哪些造型被申诉/被判门店责任
  const qualityByStyle = new Map<string, {
    styleId: string; style: string; appeals: number; storeFault: number; remakes: number; refunds: number
  }>()
  for (const { o, a } of allAppeals) {
    const k = o.cake.styleId
    const cur = qualityByStyle.get(k) || { styleId: k, style: styleName.get(k) || k, appeals: 0, storeFault: 0, remakes: 0, refunds: 0 }
    cur.appeals += 1
    if (aDecided(a)) {
      if (storeAtFault(a)) cur.storeFault += 1
      if (a.verdict === 'remake') cur.remakes += 1
      cur.refunds += a.refundAmount || 0
    }
    qualityByStyle.set(k, cur)
  }

  // 责任分布与判决分布（全局）
  const responsibilityDist: Record<string, number> = {}
  const verdictDist: Record<string, number> = {}
  for (const { a } of decidedAppeals) {
    if (a.responsibility) responsibilityDist[a.responsibility] = (responsibilityDist[a.responsibility] || 0) + 1
    if (a.verdict) verdictDist[a.verdict] = (verdictDist[a.verdict] || 0) + 1
  }

  const today = new Date().toISOString().slice(0, 10)
  const fridgeToday = state.stores.map(s => ({
    storeId: s.id, store: s.name, used: fridgeUsage(state, s.id, today, false), capacity: s.fridgeCapacity, date: today
  }))
  return {
    reworkByStyle: [...reworkByStyle.entries()].map(([styleId, v]) => ({ styleId, style: styleName.get(styleId) || styleId, ...v }))
      .sort((a, b) => b.count - a.count),
    changeByMaterial: [...changeByMaterial.entries()].map(([materialId, v]) => ({ materialId, material: matName.get(materialId) || materialId, ...v }))
      .sort((a, b) => b.count - a.count),
    heat, casesByKind,
    afterSaleRate: afterCases.length ? afterCases.filter(c => ['resolved', 'closed'].includes(c.status)).length / afterCases.length : 0,
    fridgeToday,
    styleQuality: {
      totalAppeals: allAppeals.length,
      openAppeals: allAppeals.filter(x => x.a.status === 'open').length,
      storeFaultCount: decidedAppeals.filter(x => storeAtFault(x.a)).length,
      customerFaultCount: decidedAppeals.filter(x => x.a.responsibility === 'transport_customer').length,
      totalRefunds: decidedAppeals.reduce((s, x) => s + (x.a.refundAmount || 0), 0),
      totalCoupons: decidedAppeals.reduce((s, x) => s + (x.a.coupon?.amount || 0), 0),
      totalRemakes: decidedAppeals.filter(x => x.a.verdict === 'remake').length,
      byStore: qualityByStore,
      byStyle: [...qualityByStyle.values()].sort((a, b) => b.storeFault - a.storeFault || b.appeals - a.appeals),
      responsibilityDist,
      verdictDist
    }
  }
}

function aDecided(a: StyleAppeal): boolean {
  return a.status === 'decided' || a.status === 'closed'
}


export function fmt(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
