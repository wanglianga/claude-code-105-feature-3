import type {
  Order, AppState, OrderStatus, ServiceCase, CaseKind, TimelineEvent, FeeItem,
  ReworkRecord, Account, CakeConfig, CustomerInfo, AppealDecision, AppealReasonCode,
  AppealResponsibility, AppealVerdict, Coupon, RemakeAppointment
} from '../shared/types'
import { getState, nextOrderNo, nextPickupCode, nextCouponCode, saveState } from './store'

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
    fees: [], timeline: [], cases: [], reworks: [], remakes: [], photos: {},
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

// ---------- 售后：取货后造型申诉 ----------
export const APPEAL_REASON_CODES: AppealReasonCode[] = [
  'style_mismatch', 'inscription_wrong', 'ingredient_mismatch',
  'transport_deformation', 'packaging_damage', 'food_issue', 'other'
]

export function openAfterSale(o: Order, r: {
  reason: string
  reasonCode?: AppealReasonCode
  detail: string
  evidencePhoto?: string
  transportMode?: 'cold_chain' | 'ambient'
  transportNote?: string
}, actor: Account) {
  if (o.status !== 'picked_up' && o.status !== 'closed') throw new ActionError('只有已签收订单可以发起售后')
  const dl = afterSaleDeadline(o)!
  if (Date.now() > new Date(dl).getTime()) throw new ActionError(`售后窗口已于 ${fmt(dl)} 关闭`)
  if (o.cases.some(c => c.kind === 'after_sale' && ['open', 'awaiting_customer'].includes(c.status)))
    throw new ActionError('该订单已有进行中的造型申诉，请勿重复提交')
  const code = r.reasonCode || (/题字/.test(r.reason) ? 'inscription_wrong'
    : /原料|水果/.test(r.reason) ? 'ingredient_mismatch'
      : /运输|变形|挤压|融化|包装/.test(r.reason) ? 'transport_deformation'
        : /造型|不符|偏差|图案|公仔|手绘/.test(r.reason + r.detail) ? 'style_mismatch' : 'other') as AppealReasonCode
  const styleIssue = ['style_mismatch', 'inscription_wrong'].includes(code)
  const c = raiseCase(o, 'after_sale', actor.name, `取货后造型申诉：${r.reason}`, {
    styleId: styleIssue ? o.cake.styleId : undefined,
    detail: r.detail
  })
  c.reasonCode = code
  c.transportMode = r.transportMode || (o.cake.needColdChain ? 'cold_chain' : 'ambient')
  c.transportNote = r.transportNote || ''
  c.signedAt = o.pickedUpAt
  c.evidencePhoto = r.evidencePhoto
  tl(o, {
    actorRole: 'customer', actor: actorName(actor), type: 'after_sale',
    text: `顾客取货后上传照片申诉「${r.reason}」；页面已并排比对下单参考图、门店成品照、签收时间与${c.transportMode === 'cold_chain' ? '冷链' : '常温'}运输方式`,
    fields: [
      `签收时间：${o.pickedUpAt ? fmt(o.pickedUpAt) : '—'}`,
      `运输方式：${c.transportMode === 'cold_chain' ? '冷链保温袋自提' : '常温自提'}${r.transportNote ? '；' + r.transportNote : ''}`
    ]
  })
  saveState()
}

// ---------- 售后判定：退款 / 补做 / 优惠券 / 拒绝 ----------
export function afterSaleVerdict(o: Order, caseId: string, body: {
  verdict: AppealVerdict
  responsibility: AppealResponsibility
  transportDeformation: boolean
  note: string
  internalNote?: string
  refundAmount?: number
  couponAmount?: number
  remakeDate?: string
  remakeSlot?: string
}, actor: Account): ServiceCase {
  const c = mustCase(o, caseId)
  if (c.kind !== 'after_sale') throw new ActionError('该工单不是取货后造型申诉')
  if (!['open', 'awaiting_customer', 'resolved', 'rejected'].includes(c.status))
    throw new ActionError('该工单已关闭归档，无法再判定')
  if (c.decision) throw new ActionError('该申诉已有判定结论，如需更改请先关闭后重新发起')

  const reasonCode = c.reasonCode || 'style_mismatch'
  // 责任一致性：勾选“运输造成变形”时，需区分门店交付责任与顾客自提运输责任
  const resp: AppealResponsibility = body.transportDeformation && !body.responsibility
    ? 'self_pickup' : body.responsibility
  const decision: AppealDecision = {
    verdict: body.verdict,
    responsibility: resp,
    transportDeformation: !!body.transportDeformation,
    reasonCode,
    note: body.note,
    internalNote: body.internalNote,
    by: actorName(actor),
    at: nowIso()
  }

  const respText = resp === 'store' ? '门店责任' : '顾客自提责任'
  const respReason = body.transportDeformation
    ? `变形发生在运输环节，经证据比对判定为${respText}`
    : `经下单参考图 / 门店成品照 / 签收时间 / 运输方式比对，判定为${respText}`

  if (body.verdict === 'refund') {
    const amount = Math.max(0, Math.round(Number(body.refundAmount) || 0))
    if (amount <= 0) throw new ActionError('退款金额需大于 0')
    if (amount > o.paidAmount) throw new ActionError(`退款金额不能超过实付 ¥${o.paidAmount}`)
    applyRefund(o, c, amount, actor, respText, body.note)
    decision.refundAmount = amount
    c.status = 'resolved'
    c.resolution = `判定退款 ¥${amount}（${respReason}）：${body.note}`
    tl(o, {
      actorRole: 'cs', actor: actorName(actor), type: 'after_sale',
      text: `客服判定造型申诉成立→退款 ¥${amount}；${respReason}；结论计入门店造型质量统计`
    })
  } else if (body.verdict === 'remake') {
    const appt = scheduleRemake(o, c, {
      pickupDate: body.remakeDate, slot: body.remakeSlot
    }, actor, resp, respReason, body.note)
    decision.remakePickupDate = appt.pickupDate
    decision.remakeSlot = appt.slot
    decision.remakeMakeStart = appt.makeStart
    c.status = 'resolved'
    c.resolution = `判定补做（${respReason}）：重新排定制作 ${fmt(appt.makeStart)} 开始、${appt.pickupDate} ${appt.slot} 取货；${body.note}`
    tl(o, {
      actorRole: 'cs', actor: actorName(actor), type: 'after_sale',
      text: `客服判定造型申诉成立→门店免费补做；制作排班与取货时间已重新生成（${appt.pickupDate} ${appt.slot}）；${respReason}；计入门店造型质量统计`
    })
  } else if (body.verdict === 'coupon') {
    const amount = Math.max(0, Math.round(Number(body.couponAmount) || 0))
    if (amount <= 0) throw new ActionError('优惠券面额需大于 0')
    const coupon = issueCoupon(o, c, amount, resp, reasonCode, actor)
    decision.couponId = coupon.id
    c.status = 'resolved'
    c.resolution = `判定发放优惠券 ¥${amount}（${respReason}）：${body.note}`
    tl(o, {
      actorRole: 'cs', actor: actorName(actor), type: 'after_sale',
      text: `客服判定造型申诉→优惠券 ¥${amount} 已进入顾客账户（券号 ${coupon.code}，关联原因：${coupon.reasonText}）；${respReason}；计入门店造型质量统计`
    })
  } else {
    // 拒绝赔付
    c.status = 'rejected'
    c.closedNote = body.note
    c.resolution = `拒绝赔付（${respReason}）：${body.note}`
    tl(o, {
      actorRole: 'cs', actor: actorName(actor), type: 'after_sale',
      text: `客服判定造型申诉不成立→拒绝赔付；${respReason}${body.transportDeformation ? '（运输变形，非门店造型/包装责任）' : ''}；结论计入门店造型质量统计`
    })
  }

  c.decision = decision
  c.resolvedBy = actorName(actor)
  c.resolvedAt = nowIso()
  saveState()
  return c
}

function applyRefund(o: Order, c: ServiceCase, amount: number, actor: Account, respText: string, note: string) {
  const fee: FeeItem = {
    id: uid('fee'), label: '取货后造型申诉退款', amount: -amount,
    reason: `造型申诉成立（${respText}）：${note || c.title}`,
    by: actorName(actor), at: nowIso(), caseId: c.id
  }
  o.fees.push(fee)
  c.refundAmount = (Number(c.refundAmount) || 0) + amount
  o.paidAmount = Math.max(0, o.paidAmount - amount)
  if (o.paidAmount === 0) o.paymentStatus = 'refunded'
  o.price.total = orderTotal(o)
}

// 补做：重新生成制作排班与取货时间
function scheduleRemake(o: Order, c: ServiceCase, wish: {
  pickupDate?: string; slot?: string
}, actor: Account, resp: AppealResponsibility, respReason: string, note: string): RemakeAppointment {
  const state = getState()
  const cat = state.catalog
  // 默认取货：明天；时段沿用原单（可被 wish 覆盖）
  const d = new Date(); d.setDate(d.getDate() + 1)
  const pickupDate = wish.pickupDate || d.toISOString().slice(0, 10)
  const slot = wish.slot || o.slot
  // 制作开始：取货日时段开始前 2 小时（与裱花看板 SOP 一致）
  const startHour = Number(slot.slice(0, 2))
  const makeStart = (() => {
    const dt = new Date(`${pickupDate}T${String(Math.max(8, startHour - 2)).padStart(2, '0')}:00:00`)
    return dt.toISOString()
  })()

  // 容量校验（补做占用次日冷柜）
  const size = cat.sizes.find(s => s.id === o.cake.sizeId)
  const store = state.stores.find(s => s.id === o.storeId)!
  const used = fridgeUsage(state, o.storeId, pickupDate, false)
  if (used + (size?.units || 1) > store.fridgeCapacity) {
    throw new ActionError(`${pickupDate} 冷柜容量不足（已占 ${used}/${store.fridgeCapacity}），请改选其他补做取货日期或时段`)
  }

  const appt: RemakeAppointment = {
    id: uid('rm'), caseId: c.id, reasonCode: c.reasonCode || 'style_mismatch',
    responsibility: resp,
    pickupDate, slot, makeStart, status: 'scheduled',
    note: `售后免费补做：${note || c.title}（${respReason}）`,
    createdAt: nowIso()
  }
  o.remakes.unshift(appt)
  return appt
}

// 门店推进补做排班
export function remakeAction(o: Order, remakeId: string, step: 'materials' | 'start' | 'ready' | 'pickup', actor: Account) {
  const appt = o.remakes.find(r => r.id === remakeId)
  if (!appt) throw new ActionError('补做排班不存在')
  if (step === 'materials') {
    appt.status = 'materials'; appt.materialsReadyAt = nowIso()
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: `补做单 ${appt.id} 原料准备完成（${appt.pickupDate} ${appt.slot} 取）` })
  } else if (step === 'start') {
    appt.status = 'producing'; appt.makeStart = nowIso()
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: `补做单 ${appt.id} 开始裱花制作（售后免费补做）` })
  } else if (step === 'ready') {
    appt.status = 'ready'; appt.readyAt = nowIso()
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'photo', text: `补做单 ${appt.id} 成品完成，等待顾客到店取货` })
  } else if (step === 'pickup') {
    appt.status = 'picked_up'; appt.pickedUpAt = nowIso()
    tl(o, { actorRole: 'front', actor: actorName(actor), type: 'pickup', text: `补做单 ${appt.id} 顾客已取货签收，售后补做闭环` })
  }
  saveState()
}

// 优惠券：进入顾客账户并关联本次申诉原因
function issueCoupon(o: Order, c: ServiceCase, amount: number,
  resp: AppealResponsibility, reasonCode: AppealReasonCode, actor: Account): Coupon {
  const state = getState()
  const expire = new Date(); expire.setDate(expire.getDate() + 90)
  const reasonText = APPEAL_REASON_TEXT[reasonCode]
  const coupon: Coupon = {
    id: uid('cp'),
    code: nextCouponCode(),
    customerPhone: o.customer.phone,
    customerName: o.customer.contactName,
    amount,
    title: `造型关怀券 ¥${amount}`,
    reasonCode,
    reasonText,
    orderId: o.id,
    caseId: c.id,
    storeId: o.storeId,
    responsibility: resp,
    status: 'issued',
    issuedAt: nowIso(),
    expireAt: expire.toISOString(),
    issuedBy: actorName(actor)
  }
  state.coupons.unshift(coupon)
  return coupon
}

const APPEAL_REASON_TEXT: Record<AppealReasonCode, string> = {
  style_mismatch: '取货后造型与下单参考不符',
  inscription_wrong: '题字错误',
  ingredient_mismatch: '原料/水果与订单不符',
  transport_deformation: '运输途中蛋糕变形',
  packaging_damage: '包装破损或融化',
  food_issue: '食用后不适',
  other: '其他造型售后'
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

  // —— 门店造型质量统计（取货后造型申诉判定结论）——
  const appeals = state.orders.flatMap(o => o.cases.filter(c => c.kind === 'after_sale' && c.decision).map(c => ({ o, c })))
  const styleQuality = state.stores.map(s => {
    const rows = appeals.filter(({ o }) => o.storeId === s.id)
    const total = rows.length
    const storeResp = rows.filter(({ c }) => c.decision!.responsibility === 'store').length
    const selfResp = rows.filter(({ c }) => c.decision!.responsibility === 'self_pickup').length
    const verdicts = { refund: 0, remake: 0, coupon: 0, reject: 0 } as Record<AppealVerdict, number>
    let refundSum = 0, couponSum = 0, transportDeform = 0
    const byReason: Record<string, number> = {}
    for (const { c } of rows) {
      verdicts[c.decision!.verdict] += 1
      if (c.decision!.verdict === 'refund') refundSum += c.decision!.refundAmount || 0
      if (c.decision!.verdict === 'coupon') {
        const cp = state.coupons.find(x => x.id === c.decision!.couponId)
        couponSum += cp?.amount || 0
      }
      if (c.decision!.transportDeformation) transportDeform += 1
      byReason[c.decision!.reasonCode] = (byReason[c.decision!.reasonCode] || 0) + 1
    }
    return {
      storeId: s.id, store: s.name, total, storeResp, selfResp,
      verdicts, refundSum, couponSum, transportDeform, byReason,
      storeFaultRate: total ? storeResp / total : 0
    }
  })
  // 造型维度：哪些造型被申诉（造型质量）
  const appealByStyle = new Map<string, number>()
  for (const { c } of appeals) {
    if (c.styleId) appealByStyle.set(c.styleId, (appealByStyle.get(c.styleId) || 0) + 1)
  }

  const afterCases = state.orders.flatMap(o => o.cases.filter(c => c.kind === 'after_sale'))
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
    storeStyleQuality: styleQuality,
    appealByStyle: [...appealByStyle.entries()].map(([styleId, count]) => ({
      styleId, style: styleName.get(styleId) || styleId, count
    })).sort((a, b) => b.count - a.count),
    appealTotal: appeals.length
  }
}

export function fmt(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
