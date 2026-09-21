"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const store_1 = require("./store");
const eng = __importStar(require("./engine"));
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '8mb' }));
// ---- 鉴权中间件 ----
function auth(roles) {
    return (req, res, next) => {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
        const account = (0, store_1.me)(token);
        if (!account)
            return res.status(401).json({ error: '未登录或会话已过期' });
        if (roles && !roles.includes(account.role))
            return res.status(403).json({ error: '当前角色无权执行该操作' });
        req.account = account;
        next();
    };
}
const getOrder = (id) => {
    const o = (0, store_1.getState)().orders.find(x => x.id === id);
    if (!o) {
        const e = new Error('订单不存在');
        e.status = 404;
        throw e;
    }
    return o;
};
// ---- 认证 ----
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const r = (0, store_1.login)(String(username || ''), String(password || ''));
    if (!r)
        return res.status(401).json({ error: '用户名或密码错误' });
    res.json(r);
});
app.get('/api/auth/me', auth(), (req, res) => res.json({ account: req.account }));
// ---- 引导数据 ----
app.get('/api/bootstrap', (req, res) => {
    const { catalog, stores, stock, accounts } = (0, store_1.getState)();
    const today = new Date().toISOString().slice(0, 10);
    const capacity = stores.map(s => ({
        storeId: s.id,
        date: today,
        fridgeUsed: eng.fridgeUsage((0, store_1.getState)(), s.id, today, false),
        fridgePending: eng.fridgeUsage((0, store_1.getState)(), s.id, today, true) - eng.fridgeUsage((0, store_1.getState)(), s.id, today, false),
        fridgeCapacity: s.fridgeCapacity,
        slots: catalog.slots.map(slot => ({ slot, used: eng.slotUsage((0, store_1.getState)(), s.id, today, slot), capacity: s.slotCapacity }))
    }));
    res.json({ catalog, stores, stock, accounts, capacity });
});
app.get('/api/capacity', (req, res) => {
    const storeId = String(req.query.storeId || '');
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const state = (0, store_1.getState)();
    const store = state.stores.find(s => s.id === storeId);
    if (!store)
        return res.status(404).json({ error: '门店不存在' });
    res.json({
        storeId, date,
        fridgeUsed: eng.fridgeUsage(state, storeId, date, false),
        fridgeCapacity: store.fridgeCapacity,
        slots: state.catalog.slots.map(slot => ({ slot, used: eng.slotUsage(state, storeId, date, slot), capacity: store.slotCapacity }))
    });
});
// ---- 订单查询（三端各有视角，但数据源一致）----
app.get('/api/orders', auth(), (req, res) => {
    const acc = req.account;
    const state = (0, store_1.getState)();
    let list = state.orders;
    if (acc.role === 'customer')
        list = list.filter(o => o.customer.phone === acc.phone);
    if (acc.role === 'baker' || acc.role === 'front')
        list = list.filter(o => o.storeId === acc.storeId);
    // 列表轻量：不回传参考大图
    res.json({ orders: list });
});
app.get('/api/orders/:id', auth(), (req, res) => {
    const acc = req.account;
    const o = getOrder(req.params.id);
    if (acc.role === 'customer' && o.customer.phone !== acc.phone)
        return res.status(403).json({ error: '无权查看他人订单' });
    if ((acc.role === 'baker' || acc.role === 'front') && o.storeId !== acc.storeId)
        return res.status(403).json({ error: '跨店订单，请联系客服协调' });
    res.json({ order: o, derived: {
            total: eng.orderTotal(o),
            modifyLocked: eng.modifyLocked(o),
            afterSaleDeadline: eng.afterSaleDeadline(o)
        } });
});
// ---- 下单 ----
app.post('/api/orders', auth(['customer']), (req, res) => {
    try {
        const o = eng.createOrder(req.body, req.account);
        res.json({ order: o });
    }
    catch (e) {
        res.status(e.status || 400).json({ error: e.message });
    }
});
// ---- 统一动作入口 ----
app.post('/api/orders/:id/action', auth(), (req, res) => {
    const acc = req.account;
    const { action, payload = {} } = req.body;
    try {
        const o = getOrder(req.params.id);
        currentOrder = o;
        const state = (0, store_1.getState)();
        switch (action) {
            // 顾客
            case 'pay': return res.json(go(() => eng.pay(o, acc)));
            case 'customer_modify':
                assertRole(acc, 'customer');
                assertOwner(acc, o);
                return res.json(go(() => eng.customerModify(o, payload, acc)));
            case 'customer_decide':
                assertRole(acc, 'customer');
                assertOwner(acc, o);
                return res.json(go(() => eng.customerDecide(o, payload.caseId, !!payload.accept, payload.note, acc)));
            case 'open_after_sale':
                assertRole(acc, 'customer');
                assertOwner(acc, o);
                return res.json(go(() => eng.openAfterSale(o, payload, acc)));
            case 'customer_request_change':
                assertRole(acc, 'customer');
                assertOwner(acc, o);
                return res.json(go(() => eng.customerRequestChange(o, payload.kind, payload.detail, payload.wish || {}, acc)));
            // 门店前台
            case 'accept':
                assertRole(acc, 'front');
                assertStore(acc, o);
                return res.json(go(() => eng.acceptOrder(o, acc)));
            case 'handoff':
                assertRole(acc, 'front');
                assertStore(acc, o);
                return res.json(go(() => eng.handoff(o, payload.code, payload.signer, acc)));
            // 裱花师
            case 'mark_materials':
                assertRole(acc, 'baker');
                assertStore(acc, o);
                return res.json(go(() => eng.markMaterials(o, payload.note, acc)));
            case 'start_producing':
                assertRole(acc, 'baker');
                assertStore(acc, o);
                return res.json(go(() => eng.startProducing(o, acc)));
            case 'log_rework':
                assertRole(acc, 'baker');
                assertStore(acc, o);
                return res.json(go(() => eng.logRework(o, payload, acc)));
            case 'fruit_shortage':
                assertRole(acc, 'baker');
                assertStore(acc, o);
                return res.json(go(() => eng.reportFruitShortage(o, payload.fruitId, payload.note, acc)));
            case 'fridge_report':
                assertRole(acc, 'baker', 'front');
                assertStore(acc, o);
                return res.json(go(() => eng.reportFridge(o, payload.note, acc)));
            case 'upload_photos':
                assertRole(acc, 'baker');
                assertStore(acc, o);
                return res.json(go(() => eng.uploadPhotos(o, payload.photos, acc)));
            // 客服
            case 'cs_propose':
                assertRole(acc, 'cs');
                return res.json(go(() => eng.csPropose(o, payload.caseId, payload.proposal, acc)));
            case 'cs_close':
                assertRole(acc, 'cs');
                return res.json(go(() => eng.csCloseCase(o, payload.caseId, payload.note, acc)));
            case 'cs_reject':
                assertRole(acc, 'cs');
                return res.json(go(() => eng.csRejectCase(o, payload.caseId, payload.note, acc)));
            case 'cs_note':
                assertRole(acc, 'cs');
                return res.json(go(() => eng.csNote(o, payload.text, acc)));
            case 'cs_force_ready':
                assertRole(acc, 'cs'); // 客服协调后可推进
                if (o.status !== 'pending_accept')
                    throw new eng.ActionError('仅待接单订单可由客服协调推进');
                o.status = 'accepted';
                o.timeline.push({ id: `ev${Date.now()}`, at: eng.nowIso(), actorRole: 'cs', actor: acc.name, type: 'status', text: '客服协调冷柜/跨店资源后，门店接单' });
                (0, store_1.saveState)();
                return res.json({ order: o });
            default: return res.status(400).json({ error: `未知动作：${action}` });
        }
    }
    catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
    }
});
// ---- 库存（门店端更新）----
app.post('/api/stock/:storeId', auth(['baker', 'front', 'cs']), (req, res) => {
    const acc = req.account;
    if (acc.role !== 'cs' && acc.storeId !== req.params.storeId)
        return res.status(403).json({ error: '跨店无权限' });
    const state = (0, store_1.getState)();
    state.stock[req.params.storeId] = { ...(state.stock[req.params.storeId] || {}), ...req.body };
    (0, store_1.saveState)();
    res.json({ ok: true });
});
// ---- 复盘看板 ----
app.get('/api/analytics', auth(['cs', 'baker', 'front']), (req, res) => {
    res.json(eng.analytics((0, store_1.getState)()));
});
// ---- 演示：重置数据 ----
app.post('/api/reset', auth(['cs']), (req, res) => {
    res.json({ ok: true, state: (0, store_1.resetState)() });
});
function go(fn) {
    fn(); // 各引擎动作均原地修改闭包中的订单 o
    return { order: currentOrder };
}
let currentOrder = null;
function assertRole(acc, ...roles) {
    if (!roles.includes(acc.role)) {
        const e = new eng.ActionError('当前角色无权执行该操作');
        e.status = 403;
        throw e;
    }
}
function assertOwner(acc, o) {
    if (o.customer.phone !== acc.phone) {
        const e = new eng.ActionError('只能操作自己的订单');
        e.status = 403;
        throw e;
    }
}
function assertStore(acc, o) {
    if (acc.storeId !== o.storeId) {
        const e = new eng.ActionError('这是其他门店的订单');
        e.status = 403;
        throw e;
    }
}
// ---- 静态资源（容器生产模式）----
// 编译产物位于 server-dist/server/，静态资源在 /app/dist
const dist = path_1.default.join(__dirname, '..', '..', 'dist');
app.use(express_1.default.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => {
    const index = path_1.default.join(dist, 'index.html');
    if (fs_1.default.existsSync(index))
        res.sendFile(index);
    else
        res.status(404).send('building...');
});
const PORT = Number(process.env.PORT || 8080);
(0, store_1.loadState)();
app.listen(PORT, '0.0.0.0', () => console.log(`🍰 sweet-cake server listening on :${PORT}`));
