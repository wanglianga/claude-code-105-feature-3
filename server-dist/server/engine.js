"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionError = void 0;
exports.nowIso = nowIso;
exports.orderTotal = orderTotal;
exports.fridgeUsage = fridgeUsage;
exports.slotUsage = slotUsage;
exports.sensitiveHit = sensitiveHit;
exports.modifyLocked = modifyLocked;
exports.afterSaleDeadline = afterSaleDeadline;
exports.openBlockingCase = openBlockingCase;
exports.createOrder = createOrder;
exports.raiseCase = raiseCase;
exports.csPropose = csPropose;
exports.customerDecide = customerDecide;
exports.csCloseCase = csCloseCase;
exports.csRejectCase = csRejectCase;
exports.csNote = csNote;
exports.pay = pay;
exports.customerModify = customerModify;
exports.acceptOrder = acceptOrder;
exports.handoff = handoff;
exports.markMaterials = markMaterials;
exports.startProducing = startProducing;
exports.logRework = logRework;
exports.reportFruitShortage = reportFruitShortage;
exports.reportFridge = reportFridge;
exports.uploadPhotos = uploadPhotos;
exports.customerRequestChange = customerRequestChange;
exports.openAfterSale = openAfterSale;
exports.analytics = analytics;
exports.fmt = fmt;
const store_1 = require("./store");
let seq = 0;
function uid(prefix) {
    seq += 1;
    return `${prefix}${Date.now().toString(36)}${seq}`;
}
function nowIso() {
    return new Date().toISOString();
}
class ActionError extends Error {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 400
        });
    }
}
exports.ActionError = ActionError;
// ---------- 派生计算 ----------
function orderTotal(o) {
    const fees = o.fees.reduce((s, f) => s + f.amount, 0);
    return o.price.base + o.price.addons + o.price.coldChain + fees;
}
function fridgeUsage(state, storeId, date, includePending = true) {
    const sizeUnits = new Map(state.catalog.sizes.map(s => [s.id, s.units]));
    return state.orders
        .filter(o => o.storeId === storeId && o.pickupDate === date &&
        !['cancelled', 'picked_up', 'closed'].includes(o.status) &&
        (includePending || o.status !== 'pending_accept'))
        .reduce((sum, o) => sum + (sizeUnits.get(o.cake.sizeId) || 1), 0);
}
function slotUsage(state, storeId, date, slot) {
    return state.orders.filter(o => o.storeId === storeId && o.pickupDate === date && o.slot === slot && o.status !== 'cancelled').length;
}
function sensitiveHit(state, text) {
    return state.catalog.sensitiveWords.filter(w => w && text.includes(w));
}
function modifyLocked(o) {
    return new Date(o.latestModifyAt).getTime() <= Date.now() ||
        ['producing', 'ready', 'verified', 'picked_up', 'closed'].includes(o.status);
}
function afterSaleDeadline(o) {
    if (!o.pickedUpAt)
        return null;
    return new Date(new Date(o.pickedUpAt).getTime() + o.afterSalesHours * 3600 * 1000).toISOString();
}
function openBlockingCase(o) {
    return o.cases.find(c => ['open', 'awaiting_customer'].includes(c.status) && c.kind === 'sensitive_inscription');
}
function tl(o, e) {
    o.timeline.push({ id: uid('ev'), at: e.at || nowIso(), ...e });
}
function actorName(actor) {
    return actor.name;
}
// ---------- 下单 ----------
function createOrder(input, actor) {
    const state = (0, store_1.getState)();
    const store = state.stores.find(s => s.id === input.storeId);
    if (!store)
        throw new ActionError('请选择取货门店');
    if (!input.cake.allergenConfirmed)
        throw new ActionError('请先确认过敏原与共用车间提示');
    // 敏感题字：不阻断下单，冻结题字并转客服人工审核（裱花师开制前会被拦截，避免返工）
    // 价格
    const cat = state.catalog;
    const priceOf = (id, list) => list.find(x => x.id === id)?.price || 0;
    const size = cat.sizes.find(s => s.id === input.cake.sizeId);
    const base = size?.price || 0;
    const addons = priceOf(input.cake.baseId, cat.bases) +
        priceOf(input.cake.creamId, cat.creams) +
        input.cake.fillingIds.reduce((s, id) => s + priceOf(id, cat.fillings), 0) +
        input.cake.fruitIds.reduce((s, id) => s + priceOf(id, cat.fruits), 0) +
        priceOf(input.cake.styleId, cat.styles) +
        priceOf(input.cake.candleId, cat.candles) +
        Math.max(0, input.cake.tablewareSets - 6) * 2;
    const coldChain = input.cake.needColdChain ? cat.coldChainFee : 0;
    if (input.cake.needColdChain && !store.coldChainAvailable)
        throw new ActionError('该门店暂不支持冷藏运输服务，请选择其他门店或取消冷藏运输');
    // 最晚修改时间 = 取货日前一天 18:00（且不少于 modifyLeadHours）
    const pickup = new Date(`${input.pickupDate}T12:00:00`);
    const lead = new Date(pickup.getTime() - cat.modifyLeadHours * 3600 * 1000);
    const dayBefore = new Date(pickup);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(18, 0, 0, 0);
    const latest = lead.getTime() < dayBefore.getTime() ? lead : dayBefore;
    const o = {
        id: (0, store_1.nextOrderNo)(),
        pickupCode: (0, store_1.nextPickupCode)(),
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
        afterSalesHours: 24,
        version: 1
    };
    tl(o, { actorRole: 'customer', actor: actor.name, type: 'created', text: `顾客提交生日蛋糕定制订单（${store.name} ${input.pickupDate} ${input.slot} 取货）` });
    // 下单时题字命中敏感词：转人工审核工单（题字冻结，确认前裱花师无法开制）
    const hits0 = sensitiveHit(state, input.cake.inscription);
    if (hits0.length) {
        raiseCase(o, 'sensitive_inscription', 'system', `题字含敏感内容待客服审核（命中：${hits0.join('、')}）`, { detail: `顾客下单题字“${input.cake.inscription}”命中敏感词 ${hits0.join('、')}；门店不得按原题字制作，等待客服与顾客确认替代文案` });
    }
    // 库存预检：草莓等缺货自动提示（不阻断，记录为风险，门店接单后由客服工单跟进）
    const missing = input.cake.fruitIds.filter(f => state.stock[input.storeId]?.[f] === 'out');
    if (missing.length) {
        const names = missing.map(id => cat.fruits.find(f => f.id === id)?.name).join('、');
        raiseCase(o, 'fruit_shortage', 'system', `下单预检：${names} 当前门店缺货`, {
            materialId: missing[0],
            detail: `顾客所选 ${names} 在该门店标记为缺货，等待门店/客服给出替代方案`
        });
    }
    state.orders.unshift(o);
    (0, store_1.saveState)();
    return o;
}
// ---------- 工单 ----------
function raiseCase(o, kind, raisedBy, title, opts = {}) {
    const c = {
        id: uid('cs'), kind, title, status: 'open',
        raisedBy, raisedAt: opts.at || nowIso(),
        detail: opts.detail || title,
        materialId: opts.materialId, styleId: opts.styleId
    };
    o.cases.unshift(c);
    tl(o, {
        actorRole: raisedBy === 'system' ? 'system' : 'cs',
        actor: raisedBy === 'system' ? '系统风控' : raisedBy,
        type: 'case',
        at: opts.at,
        text: `异常工单开启：${title}`
    });
    return c;
}
function csPropose(o, caseId, p, actor) {
    const c = mustCase(o, caseId);
    if (!['open', 'awaiting_customer'].includes(c.status))
        throw new ActionError('该工单已处理完成');
    c.proposal = { desc: p.desc, feeAdjust: p.feeAdjust, patch: p.patch, by: actor.name, at: nowIso() };
    c.status = 'awaiting_customer';
    tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服说明并给出方案：${p.desc}${p.feeAdjust ? `（费用调整 ${p.feeAdjust > 0 ? '加收' : '退还'} ¥${Math.abs(p.feeAdjust)}）` : ''}` });
    (0, store_1.saveState)();
    return c;
}
function customerDecide(o, caseId, accept, note, actor) {
    const c = mustCase(o, caseId);
    if (c.status !== 'awaiting_customer' || !c.proposal)
        throw new ActionError('该工单没有待确认的方案');
    c.customerDecisionAt = nowIso();
    c.customerNote = note || '';
    if (!accept) {
        c.status = 'open';
        tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'case', text: `顾客拒绝方案${note ? '：' + note : ''}，等待客服重新沟通` });
        (0, store_1.saveState)();
        return c;
    }
    // 应用补丁（题字/日期/时段/门店/水果等都回写原订单）
    if (c.proposal.patch)
        applyPatch(o, c.proposal.patch);
    if (c.proposal.feeAdjust !== 0) {
        const fee = {
            id: uid('fee'), label: feeLabel(c.kind), amount: c.proposal.feeAdjust,
            reason: c.proposal.desc, by: actorName(actor), at: nowIso(), caseId: c.id
        };
        o.fees.push(fee);
        if (c.proposal.feeAdjust < 0) {
            c.refundAmount = (c.refundAmount || 0) + Math.abs(c.proposal.feeAdjust);
            o.paidAmount = Math.max(0, o.paidAmount + c.proposal.feeAdjust);
            if (o.paidAmount === 0)
                o.paymentStatus = 'refunded';
            tl(o, { actorRole: 'cs', actor: '系统', type: 'fee', text: `退款 ¥${Math.abs(fee.amount)} 已原路退回（${fee.label}）`, amount: fee.amount });
        }
        else {
            o.paymentStatus = 'partial';
            tl(o, { actorRole: 'cs', actor: '系统', type: 'fee', text: `加收 ¥${fee.amount}（${fee.label}），等待顾客补差价`, amount: fee.amount });
        }
    }
    o.price.total = orderTotal(o);
    c.status = 'resolved';
    c.resolvedBy = actorName(actor);
    c.resolvedAt = nowIso();
    c.resolution = c.proposal.desc;
    tl(o, {
        actorRole: 'customer', actor: actorName(actor), type: 'case',
        text: `顾客确认方案，变更已落回原订单；${c.kind === 'fruit_shortage' ? '门店按新原料制作，' : ''}${c.kind === 'sensitive_inscription' ? '门店按新题字制作，' : ''}费用与排期同步更新`
    });
    (0, store_1.saveState)();
    return c;
}
function feeLabel(kind) {
    return {
        date_change: '改期服务费调整',
        sensitive_inscription: '题字审核改单',
        fruit_shortage: '缺货替代/退还',
        fridge_capacity: '冷柜调度调整',
        store_transfer: '跨店调货费',
        after_sale: '售后补偿退款'
    }[kind];
}
function applyPatch(o, patch) {
    for (const [k, v] of Object.entries(patch)) {
        if (k.startsWith('cake.')) {
            const field = k.slice(5);
            o.cake[field] = v;
        }
        else if (k === 'pickupDate' || k === 'slot' || k === 'latestModifyAt' || k === 'storeId' || k === 'makeStartTime' || k === 'materialsReadyAt') {
            ;
            o[k] = v;
        }
    }
}
function csCloseCase(o, caseId, note, actor) {
    const c = mustCase(o, caseId);
    c.status = 'closed';
    c.closedNote = note;
    tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服关闭工单：${note}` });
    (0, store_1.saveState)();
}
function csRejectCase(o, caseId, note, actor) {
    const c = mustCase(o, caseId);
    c.status = 'rejected';
    c.closedNote = note;
    tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'case', text: `客服驳回工单：${note}` });
    (0, store_1.saveState)();
}
function csNote(o, text, actor) {
    tl(o, { actorRole: 'cs', actor: actorName(actor), type: 'note', text });
    (0, store_1.saveState)();
}
function mustCase(o, id) {
    const c = o.cases.find(x => x.id === id);
    if (!c)
        throw new ActionError('工单不存在');
    return c;
}
// ---------- 顾客：支付 / 自助修改 ----------
function pay(o, actor) {
    const total = orderTotal(o);
    const due = total - o.paidAmount;
    if (due <= 0)
        throw new ActionError('订单已结清');
    o.paidAmount += due;
    o.paymentStatus = 'paid';
    tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'payment', text: `在线支付 ¥${due}`, amount: due });
    (0, store_1.saveState)();
}
function customerModify(o, patch, actor) {
    if (modifyLocked(o))
        throw new ActionError(`已过最晚修改时间（${fmt(o.latestModifyAt)}）或订单已进入制作，自助修改已关闭；请联系客服发起改期工单`);
    const state = (0, store_1.getState)();
    const before = JSON.stringify({ cake: o.cake, d: o.pickupDate, s: o.slot });
    if (patch.cake)
        Object.assign(o.cake, patch.cake);
    if (patch.pickupDate)
        o.pickupDate = patch.pickupDate;
    if (patch.slot)
        o.slot = patch.slot;
    // 敏感题字：不直接生效，转人工审核工单
    if (patch.cake?.inscription !== undefined) {
        const hits = sensitiveHit(state, patch.cake.inscription);
        if (hits.length) {
            raiseCase(o, 'sensitive_inscription', 'system', `题字含敏感内容待客服审核（命中：${hits.join('、')}）`, { detail: `顾客在修改截止前提交题字“${patch.cake.inscription}”，命中敏感词 ${hits.join('、')}；题字暂按原文冻结，等待客服与顾客确认替代文案` });
        }
    }
    o.version += 1;
    tl(o, { actorRole: 'customer', actor: actorName(actor), type: 'modify', text: '顾客在可修改窗口内更新定制信息，已同步给门店制作端' });
    if (JSON.stringify({ cake: o.cake, d: o.pickupDate, s: o.slot }) !== before)
        (0, store_1.saveState)();
    return o;
}
// ---------- 门店：前台 ----------
function acceptOrder(o, actor) {
    if (o.status !== 'pending_accept')
        throw new ActionError('只有待接单订单可以接单');
    const state = (0, store_1.getState)();
    const size = state.catalog.sizes.find(s => s.id === o.cake.sizeId);
    // 容量只统计已接单/在制订单（待接单不锁容量，避免两单互相卡死）
    const used = fridgeUsage(state, o.storeId, o.pickupDate, false);
    if (used + (size?.units || 1) > state.stores.find(s => s.id === o.storeId).fridgeCapacity) {
        raiseCase(o, 'fridge_capacity', actor.name, `接单预警：${o.pickupDate} 冷柜容量不足（已占 ${used}/${state.stores.find(s => s.id === o.storeId).fridgeCapacity}）`, { detail: '前台尝试接单时发现冷柜容量不足，需客服协调改时段、跨店调货或增加冷链周转' });
        throw new ActionError('冷柜容量不足，已自动开启冷柜调度工单，请客服协调后再接单');
    }
    setStatus(o, 'accepted', actor, '门店确认接单，原料与排班进入准备');
    (0, store_1.saveState)();
}
function handoff(o, code, signer, actor) {
    if (o.status !== 'ready')
        throw new ActionError('订单尚未进入待取货状态，不能核验取货');
    if (code.trim() !== o.pickupCode)
        throw new ActionError('取货码核验失败，请与顾客核对短信中的 4 位取货码');
    if (o.paymentStatus !== 'paid')
        throw new ActionError(`支付状态为「${o.paymentStatus === 'unpaid' ? '未支付' : '部分支付'}」，请先完成收银再交付`);
    if (o.cake.needColdChain && !o.photos.coldNotice)
        throw new ActionError('冷藏提示照片缺失，请裱花师补传后再交付');
    o.status = 'verified';
    o.verifiedAt = nowIso();
    o.verifiedBy = actor.name;
    tl(o, { actorRole: 'front', actor: actorName(actor), type: 'pickup', text: `取货码 ${o.pickupCode} 核验通过`, fields: [`核验方式：4 位取货码 + 手机号尾号 ${o.customer.phone.slice(-4)}`] });
    o.status = 'picked_up';
    o.pickedUpAt = nowIso();
    tl(o, { actorRole: 'front', actor: actorName(actor), type: 'pickup', text: `顾客${signer ? '（' + signer + '）' : ''}当面签收取货，${o.afterSalesHours} 小时售后窗口开始计算`, fields: ['成品照片/包装照片已留存', '冷藏提示已当面告知'] });
    (0, store_1.saveState)();
}
// ---------- 门店：裱花师 ----------
function markMaterials(o, note, actor) {
    o.materialsReadyAt = nowIso();
    o.materialsNote = note;
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: '原料准备完成', fields: note.split('\n').filter(Boolean) });
    (0, store_1.saveState)();
}
function startProducing(o, actor) {
    if (!['accepted'].includes(o.status))
        throw new ActionError('当前状态不能开始制作');
    const block = openBlockingCase(o);
    if (block)
        throw new ActionError(`题字待客服/顾客确认（工单 ${block.id}），确认前不得开制，避免裱花返工`);
    if (!o.materialsReadyAt)
        throw new ActionError('请先登记原料准备完成');
    setStatus(o, 'producing', actor, '裱花师开始制作');
    o.makeStartTime = nowIso();
    (0, store_1.saveState)();
}
function logRework(o, r, actor) {
    const rec = {
        id: uid('rw'), at: nowIso(), styleId: o.cake.styleId,
        reason: r.reason, note: r.note, cost: r.cost, by: actor.name
    };
    o.reworks.push(rec);
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'production', text: `登记裱花返工：${r.reason}（内部成本约 ¥${r.cost}）`, fields: [r.note] });
    (0, store_1.saveState)();
}
function reportFruitShortage(o, fruitId, note, actor) {
    const state = (0, store_1.getState)();
    state.stock[o.storeId] = state.stock[o.storeId] || {};
    state.stock[o.storeId][fruitId] = 'out';
    const fname = state.catalog.fruits.find(f => f.id === fruitId)?.name || fruitId;
    raiseCase(o, 'fruit_shortage', actor.name, `${fname}缺货，需替代方案或退款`, {
        materialId: fruitId,
        detail: `${actor.name} 备料时发现 ${fname} 缺货。${note ? '备注：' + note : ''} 可选：替换等价水果 / 退还该水果加价 / 顾客改款。`
    });
    (0, store_1.saveState)();
}
function reportFridge(o, note, actor) {
    const state = (0, store_1.getState)();
    const store = state.stores.find(s => s.id === o.storeId);
    const used = fridgeUsage(state, o.storeId, o.pickupDate, false);
    raiseCase(o, 'fridge_capacity', actor.name, `冷柜容量不足（${used}/${store.fridgeCapacity}）`, {
        detail: `${note ? note + '；' : ''}${o.pickupDate} 当日冷柜已占用 ${used}/${store.fridgeCapacity}，需协调取货时段、冷链周转或跨店调货。`
    });
    (0, store_1.saveState)();
}
function uploadPhotos(o, photos, actor) {
    Object.assign(o.photos, photos);
    const labels = [];
    if (photos.final)
        labels.push('成品照片');
    if (photos.package)
        labels.push('包装照片');
    if (photos.coldNotice)
        labels.push('冷藏提示卡');
    tl(o, { actorRole: 'baker', actor: actorName(actor), type: 'photo', text: `门店上传交付材料：${labels.join('、')}` });
    if (o.photos.final && o.photos.package && ['producing', 'accepted'].includes(o.status)) {
        setStatus(o, 'ready', actor, '成品与包装核验通过，进入待取货');
        o.readyAt = nowIso();
    }
    (0, store_1.saveState)();
}
function setStatus(o, s, actor, text) {
    o.status = s;
    tl(o, { actorRole: actor.role === 'baker' ? 'baker' : actor.role === 'front' ? 'front' : 'system', actor: actor.name, type: 'status', text });
}
// ---------- 顾客：过截止时间后的改期 / 换店申请 ----------
function customerRequestChange(o, kind, detail, wish, actor) {
    if (kind === 'date_change') {
        raiseCase(o, 'date_change', actor.name, '顾客申请临时改期', {
            detail: `顾客申请改期：原 ${o.pickupDate} ${o.slot} → 期望 ${wish.pickupDate || '?'} ${wish.slot || '同时段'}。原因：${detail}。已过最晚修改时间，需门店评估排班与原料，客服确认费用。`
        });
    }
    else {
        const state = (0, store_1.getState)();
        const target = state.stores.find(s => s.id === wish.storeId);
        raiseCase(o, 'store_transfer', actor.name, `顾客申请换门店：${target?.name || wish.storeId}`, {
            detail: `顾客因${detail || '行程变更'}申请由原门店转至「${target?.name || wish.storeId}」取货（期望 ${wish.pickupDate || o.pickupDate} ${wish.slot || o.slot}）。需两店确认冷柜、原料与排班。`
        });
    }
    (0, store_1.saveState)();
}
// ---------- 售后 ----------
function openAfterSale(o, r, actor) {
    if (o.status !== 'picked_up')
        throw new ActionError('只有已签收订单可以发起售后');
    const dl = afterSaleDeadline(o);
    if (Date.now() > new Date(dl).getTime())
        throw new ActionError(`售后窗口已于 ${fmt(dl)} 关闭`);
    const styleIssue = /造型|不符|偏差|图案|公仔|手绘/.test(r.reason + r.detail);
    raiseCase(o, 'after_sale', actor.name, `售后：${r.reason}`, {
        styleId: styleIssue ? o.cake.styleId : undefined,
        detail: r.detail
    });
    o.cases[0].evidencePhoto = r.evidencePhoto;
    (0, store_1.saveState)();
}
// ---------- 复盘聚合 ----------
function analytics(state) {
    const styleName = new Map(state.catalog.styles.map(s => [s.id, s.name]));
    const reworkByStyle = new Map();
    for (const o of state.orders)
        for (const r of o.reworks) {
            const k = r.styleId;
            const cur = reworkByStyle.get(k) || { count: 0, cost: 0 };
            cur.count += 1;
            cur.cost += r.cost;
            reworkByStyle.set(k, cur);
        }
    const matName = new Map(state.catalog.fruits.map(f => [f.id, f.name]));
    const changeByMaterial = new Map();
    for (const o of state.orders)
        for (const c of o.cases) {
            if (!c.materialId)
                continue;
            const cur = changeByMaterial.get(c.materialId) || { count: 0, kinds: {} };
            cur.count += 1;
            cur.kinds[c.kind] = (cur.kinds[c.kind] || 0) + 1;
            changeByMaterial.set(c.materialId, cur);
        }
    // 取货拥挤度：按门店 × 时段
    const heat = {};
    for (const s of state.stores) {
        heat[s.id] = state.catalog.slots.map(slot => {
            const count = state.orders.filter(o => o.storeId === s.id && o.slot === slot && o.status !== 'cancelled').length;
            return { store: s.name, slot, count, capacity: s.slotCapacity * 5, ratio: count / (s.slotCapacity * 5) };
        });
    }
    const casesByKind = {};
    for (const o of state.orders)
        for (const c of o.cases)
            casesByKind[c.kind] = (casesByKind[c.kind] || 0) + 1;
    const afterCases = state.orders.flatMap(o => o.cases.filter(c => c.kind === 'after_sale'));
    const today = new Date().toISOString().slice(0, 10);
    const fridgeToday = state.stores.map(s => ({
        storeId: s.id, store: s.name, used: fridgeUsage(state, s.id, today, false), capacity: s.fridgeCapacity, date: today
    }));
    return {
        reworkByStyle: [...reworkByStyle.entries()].map(([styleId, v]) => ({ styleId, style: styleName.get(styleId) || styleId, ...v }))
            .sort((a, b) => b.count - a.count),
        changeByMaterial: [...changeByMaterial.entries()].map(([materialId, v]) => ({ materialId, material: matName.get(materialId) || materialId, ...v }))
            .sort((a, b) => b.count - a.count),
        heat, casesByKind,
        afterSaleRate: afterCases.length ? afterCases.filter(c => ['resolved', 'closed'].includes(c.status)).length / afterCases.length : 0,
        fridgeToday
    };
}
function fmt(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
