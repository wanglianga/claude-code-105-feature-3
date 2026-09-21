"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadState = loadState;
exports.getState = getState;
exports.saveState = saveState;
exports.resetState = resetState;
exports.login = login;
exports.me = me;
exports.nextOrderNo = nextOrderNo;
exports.nextPickupCode = nextPickupCode;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const seed_1 = require("./seed");
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data');
const DB_FILE = path_1.default.join(DATA_DIR, 'db.json');
let state;
function loadState() {
    try {
        if (fs_1.default.existsSync(DB_FILE)) {
            const raw = JSON.parse(fs_1.default.readFileSync(DB_FILE, 'utf-8'));
            if (raw && raw.orders && raw.catalog) {
                state = raw;
                return state;
            }
        }
    }
    catch (e) {
        console.warn('[store] db.json 读取失败，使用种子数据', e);
    }
    state = (0, seed_1.buildInitialState)();
    saveState();
    return state;
}
function getState() {
    return state;
}
let saveTimer = null;
function saveState() {
    if (saveTimer)
        return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        const tmp = DB_FILE + '.tmp';
        fs_1.default.writeFileSync(tmp, JSON.stringify(state, null, 2));
        fs_1.default.renameSync(tmp, DB_FILE);
    }, 120);
}
function resetState() {
    state = (0, seed_1.buildInitialState)();
    saveState();
    return state;
}
// ---- 简易会话（演示环境单租户，token 即会话表索引）----
const sessions = new Map(); // token -> accountId
function login(username, password) {
    const acc = seed_1.accounts.find(a => a.username === username && a.password === password);
    if (!acc)
        return null;
    const token = Buffer.from(`${acc.id}:${Date.now()}`).toString('base64url');
    sessions.set(token, acc.id);
    const { password: _pw, ...safe } = acc;
    return { token, account: safe };
}
function me(token) {
    if (!token)
        return null;
    const id = sessions.get(token);
    if (!id)
        return null;
    const acc = seed_1.accounts.find(a => a.id === id);
    if (!acc)
        return null;
    const { password: _pw, ...safe } = acc;
    return safe;
}
function nextOrderNo() {
    const n = 1004 + Math.max(0, state.orders.length - 3);
    const used = new Set(state.orders.map(o => o.id));
    let id = `OD${n}`;
    let i = 1;
    while (used.has(id))
        id = `OD${n + i++}`;
    return id;
}
function nextPickupCode() {
    const used = new Set(state.orders.map(o => o.pickupCode));
    for (;;) {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        if (!used.has(code))
            return code;
    }
}
