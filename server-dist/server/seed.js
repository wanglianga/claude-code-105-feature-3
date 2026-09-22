"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoOrders = exports.stockSeed = exports.accounts = exports.stores = exports.catalog = void 0;
exports.buildInitialState = buildInitialState;
const now = new Date();
function isoOffset(days, hour = 10, minute = 0) {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
}
function dateOffset(days) {
    return isoOffset(days).slice(0, 10);
}
exports.catalog = {
    sizes: [
        { id: 's6', name: '6 英寸', desc: '约 4-6 人食', price: 168, servings: 6, units: 1 },
        { id: 's8', name: '8 英寸', desc: '约 8-10 人食', price: 238, servings: 10, units: 2 },
        { id: 's10', name: '10 英寸', desc: '约 12-15 人食', price: 328, servings: 15, units: 3 },
        { id: 's12', name: '12 英寸双层', desc: '约 20 人食·派对款', price: 498, servings: 20, units: 4, badge: '派对' }
    ],
    bases: [
        { id: 'vanilla', name: '香草戚风', desc: '经典轻盈', price: 0 },
        { id: 'choco', name: '可可海绵', desc: '浓郁可可', price: 10 },
        { id: 'cheese', name: '轻乳酪胚', desc: '绵密微酸', price: 20 },
        { id: 'glutenfree', name: '无麸质米胚', desc: '麸质过敏友好', price: 30, badge: '过敏原友好' }
    ],
    creams: [
        { id: 'animal', name: '动物淡奶油', desc: '奶香清爽·建议全程冷藏', price: 0 },
        { id: 'plant', name: '植脂奶油', desc: '塑形稳定·短时间常温', price: -10 },
        { id: 'choco_cream', name: '巧克力甘纳许', desc: '醇厚顺滑', price: 18 }
    ],
    fillings: [
        { id: 'mango', name: '芒果粒', price: 12 },
        { id: 'strawberry_jam', name: '草莓果冻', price: 12 },
        { id: 'oreo', name: '奥利奥碎', price: 10 },
        { id: 'taro', name: '香芋泥', price: 12 },
        { id: 'cheese_ball', name: '芝士波波', price: 15 }
    ],
    fruits: [
        { id: 'strawberry', name: '丹东草莓', price: 18, badge: '当季' },
        { id: 'blueberry', name: '蓝莓', price: 14 },
        { id: 'mango_fruit', name: '鲜芒果', price: 12 },
        { id: 'fig', name: '无花果', price: 20 },
        { id: 'none_fruit', name: '不添加鲜果', price: 0 }
    ],
    allergens: [
        { id: 'gluten', name: '麸质（小麦）' },
        { id: 'dairy', name: '乳制品' },
        { id: 'egg', name: '鸡蛋' },
        { id: 'nut', name: '坚果' },
        { id: 'soy', name: '大豆' },
        { id: 'mango_al', name: '芒果（交叉接触）' }
    ],
    styles: [
        { id: 'classic_fruit', name: '经典水果围边', desc: '鲜果 + 淡奶油', price: 0, difficulty: 1 },
        { id: 'drawing', name: '卡通手绘转印', desc: '可指定角色', price: 40, difficulty: 2 },
        { id: 'photo', name: '食用照片打印', desc: '上传清晰照片', price: 50, difficulty: 2 },
        { id: '3d_doll', name: '3D 立体公仔', desc: '手工翻糖·耗时较长', price: 120, difficulty: 3, badge: '高返工' },
        { id: 'vintage', name: '复古裱花裙边', desc: '韩式裱花', price: 60, difficulty: 3 },
        { id: 'minimal', name: '极简留白蜡烛款', desc: '高级感', price: 20, difficulty: 1 }
    ],
    candles: [
        { id: 'none_c', name: '不需要蜡烛', price: 0 },
        { id: 'digital', name: '数字蜡烛', price: 5 },
        { id: 'rainbow', name: '彩虹蜡烛 10 支', price: 8 },
        { id: 'fairy', name: '仙女棒蜡烛', price: 12, badge: '需成年人点火' }
    ],
    slots: ['10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'],
    sensitiveWords: ['第一', '最', '国家级', '领导人姓名占位', '暴', '赌'],
    modifyLeadHours: 24,
    coldChainFee: 30
};
exports.stores = [
    {
        id: 'st_hd',
        name: '甜星·湖滨道店',
        address: '湖滨路 88 号 1 层',
        phone: '021-5500-1101',
        fridgeCapacity: 8,
        slotCapacity: 4,
        coldChainAvailable: true
    },
    {
        id: 'st_cx',
        name: '甜星·春熙里店',
        address: '春熙里商业街 6 栋',
        phone: '021-5500-1102',
        fridgeCapacity: 5,
        slotCapacity: 3,
        coldChainAvailable: false
    }
];
exports.accounts = [
    { id: 'u_cust', username: 'customer', password: '123456', name: '李小满', role: 'customer', phone: '13800000001' },
    { id: 'u_cust2', username: 'customer2', password: '123456', name: '周也', role: 'customer', phone: '13800000002' },
    { id: 'u_baker', username: 'baker', password: '123456', name: '陈裱花（湖滨道首席）', role: 'baker', storeId: 'st_hd' },
    { id: 'u_front', username: 'front', password: '123456', name: '王前台（湖滨道）', role: 'front', storeId: 'st_hd' },
    { id: 'u_baker2', username: 'baker2', password: '123456', name: '赵裱花（春熙里）', role: 'baker', storeId: 'st_cx' },
    { id: 'u_front2', username: 'front2', password: '123456', name: '孙前台（春熙里）', role: 'front', storeId: 'st_cx' },
    { id: 'u_cs', username: 'cs', password: '123456', name: '客服·甜小橙', role: 'cs' },
    { id: 'u_mgr', username: 'manager', password: '123456', name: '区域督导·林店长', role: 'cs' }
];
// 库存：草莓在湖滨道店低库存（可触发缺货场景），春熙里店正常
exports.stockSeed = {
    st_hd: { strawberry: 'low', blueberry: 'ok', mango_fruit: 'ok', fig: 'out' },
    st_cx: { strawberry: 'ok', blueberry: 'ok', mango_fruit: 'ok', fig: 'ok' }
};
function demoOrder(partial) {
    return {
        createdAt: isoOffset(-2, 9),
        status: 'accepted',
        paymentStatus: 'unpaid',
        storeId: 'st_hd',
        paidAmount: 0,
        fees: [],
        timeline: [],
        cases: [],
        reworks: [],
        remakes: [],
        photos: {},
        afterSalesHours: 24,
        version: 1,
        ...partial
    };
}
// 演示用占位照片（SVG dataURL），用于售后证据对比
function svgPhoto(label, bg, fg = '#ffffff') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360">
  <rect width="480" height="360" fill="${bg}"/>
  <circle cx="240" cy="150" r="86" fill="#fff" opacity="0.92"/>
  <circle cx="185" cy="120" r="10" fill="${bg}"/><circle cx="295" cy="120" r="10" fill="${bg}"/>
  <path d="M190 175 Q240 215 290 175" stroke="${bg}" stroke-width="8" fill="none" stroke-linecap="round"/>
  <rect x="70" y="262" width="340" height="58" rx="10" fill="rgba(0,0,0,.28)"/>
  <text x="240" y="300" font-size="28" fill="${fg}" text-anchor="middle" font-family="sans-serif">${label}</text>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const PHOTO_FINAL_OK = svgPhoto('门店成品照·造型规范', '#7c5cff');
const PHOTO_PACKAGE = svgPhoto('包装照片·封签完好', '#2bb673');
const PHOTO_COLD = svgPhoto('冷藏提示卡 2-8℃', '#1e9be8');
const PHOTO_EVIDENCE_BAD = svgPhoto('顾客证据·公仔头部变形', '#e8505b');
const PHOTO_EVIDENCE_MELT = svgPhoto('顾客证据·奶油融化塌腰', '#f08c2e');
const PHOTO_REF_GUIDE = svgPhoto('下单参考图', '#9b6bd8');
exports.demoOrders = [
    demoOrder({
        id: 'OD1001',
        pickupCode: '8862',
        storeId: 'st_hd',
        pickupDate: dateOffset(0),
        slot: '16:00-18:00',
        latestModifyAt: isoOffset(0, 12, 0),
        status: 'producing',
        paymentStatus: 'paid',
        paidAmount: 276,
        materialsReadyAt: isoOffset(0, 9, 20),
        makeStartTime: isoOffset(0, 10, 0),
        customer: {
            contactName: '李小满',
            phone: '13800000001',
            birthdayPerson: { name: '李奶奶', relation: '奶奶', age: '78', gender: '女' },
            invoice: { needed: false }
        },
        cake: {
            sizeId: 's8', baseId: 'vanilla', creamId: 'animal',
            fillingIds: ['mango'], fruitIds: ['strawberry', 'blueberry'],
            avoidAllergenIds: ['nut'], allergenConfirmed: true,
            styleId: 'vintage', styleNote: '粉色系，写"福如东海"，不要太甜',
            inscription: '福如东海 寿比南山', inscriptionApproved: true,
            candleId: 'digital', candleCount: 78, tablewareSets: 10, needColdChain: true
        },
        price: { base: 238, addons: 8, coldChain: 30, total: 276 },
        timeline: [
            { id: 't1', at: isoOffset(-2, 9), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交生日蛋糕定制订单' },
            { id: 't2', at: isoOffset(-2, 9, 5), actorRole: 'front', actor: '王前台', type: 'status', text: '湖滨道店已接单' },
            { id: 't3', at: isoOffset(-2, 9, 6), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付完成', amount: 276 },
            { id: 't4', at: isoOffset(0, 9, 20), actorRole: 'baker', actor: '陈裱花', type: 'production', text: '原料备齐：丹东草莓、蓝莓、动物淡奶油', fields: ['草莓 200g（低库存批次）', '淡奶油 2L', '8寸香草戚风胚'] },
            { id: 't5', at: isoOffset(0, 10), actorRole: 'baker', actor: '陈裱花', type: 'status', text: '开始裱花制作' }
        ]
    }),
    demoOrder({
        id: 'OD1002',
        pickupCode: '3390',
        storeId: 'st_hd',
        pickupDate: dateOffset(1),
        slot: '10:00-12:00',
        latestModifyAt: isoOffset(0, 10, 0),
        status: 'pending_accept',
        customer: {
            contactName: '周也',
            phone: '13800000002',
            birthdayPerson: { name: '小团子', relation: '儿子', age: '5', gender: '男' },
            invoice: { needed: true, title: '上海星河科技有限公司', taxNo: '91310000MA1FL000XX', email: 'zhou@example.com' }
        },
        cake: {
            sizeId: 's6', baseId: 'choco', creamId: 'choco_cream',
            fillingIds: ['oreo'], fruitIds: ['none_fruit'],
            avoidAllergenIds: [], allergenConfirmed: true,
            styleId: '3d_doll', styleNote: '奥特曼公仔，红色为主，孩子对芒果过敏',
            inscription: '小团子 5 岁生日快乐', inscriptionApproved: true,
            candleId: 'rainbow', candleCount: 1, tablewareSets: 6, needColdChain: false
        },
        price: { base: 168, addons: 198, coldChain: 0, total: 366 },
        timeline: [
            { id: 't1', at: isoOffset(-1, 20), actorRole: 'customer', actor: '周也', type: 'created', text: '顾客提交生日蛋糕定制订单（3D 立体公仔款）' }
        ]
    }),
    demoOrder({
        id: 'OD1003',
        pickupCode: '5517',
        storeId: 'st_hd',
        pickupDate: dateOffset(-1),
        slot: '18:00-20:00',
        latestModifyAt: isoOffset(-2, 18, 0),
        status: 'picked_up',
        paymentStatus: 'paid',
        paidAmount: 416,
        pickedUpAt: isoOffset(-1, 19, 12),
        customer: {
            contactName: '李小满', phone: '13800000001',
            birthdayPerson: { name: '李小满', relation: '本人', age: '30', gender: '女' },
            invoice: { needed: false }
        },
        cake: {
            sizeId: 's8', baseId: 'vanilla', creamId: 'animal',
            fillingIds: ['strawberry_jam'], fruitIds: ['strawberry'],
            avoidAllergenIds: [], allergenConfirmed: true,
            styleId: 'drawing', styleNote: '库洛米手绘', styleRefPhoto: PHOTO_REF_GUIDE,
            inscription: 'Happy 30th', inscriptionApproved: true,
            candleId: 'fairy', candleCount: 1, tablewareSets: 8, needColdChain: true
        },
        price: { base: 238, addons: 148, coldChain: 30, total: 416 },
        timeline: [
            { id: 't1', at: isoOffset(-4, 11), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单' },
            { id: 't2', at: isoOffset(-4, 11, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
            { id: 't3', at: isoOffset(-4, 11, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 416 },
            { id: 't4', at: isoOffset(-1, 15), actorRole: 'baker', actor: '陈裱花', type: 'status', text: '开始裱花制作' },
            { id: 't5', at: isoOffset(-1, 17), actorRole: 'baker', actor: '陈裱花', type: 'production', text: '第一次造型与参考图偏差较大，登记返工', },
            { id: 't6', at: isoOffset(-1, 18, 30), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品照片、包装照片与冷藏提示卡' },
            { id: 't7', at: isoOffset(-1, 18, 31), actorRole: 'front', actor: '王前台', type: 'status', text: '制作完成，进入待取货' },
            { id: 't8', at: isoOffset(-1, 19, 12), actorRole: 'front', actor: '王前台', type: 'pickup', text: '核验取货码 5517，顾客当面签收', fields: ['取货码核验通过', '签收人：李小满本人'] }
        ],
        reworks: [
            { id: 'rw1', at: isoOffset(-1, 17), styleId: 'drawing', reason: '造型与参考图不符：库洛米配色偏差', note: '转印线条晕染，重新调色转印', cost: 35, by: '陈裱花' }
        ],
        photos: { final: PHOTO_FINAL_OK, package: PHOTO_PACKAGE, coldNotice: PHOTO_COLD }
    })
];
// —— 取货后造型申诉演示订单 ——
function appealOrder(no) {
    return demoOrder({
        id: no.id,
        pickupCode: no.code,
        storeId: no.storeId,
        pickupDate: dateOffset(no.pickupDaysAgo ?? no.daysAgo - 1),
        slot: '18:00-20:00',
        latestModifyAt: isoOffset(no.daysAgo - 2, 18),
        status: 'picked_up',
        paymentStatus: 'paid',
        paidAmount: no.price,
        pickedUpAt: isoOffset(no.daysAgo, no.hour, 12),
        customer: {
            contactName: no.contact, phone: no.phone,
            birthdayPerson: { name: no.bpName, relation: no.bpRel },
            invoice: { needed: false }
        },
        cake: {
            sizeId: 's8', baseId: 'vanilla', creamId: 'animal',
            fillingIds: ['mango'], fruitIds: ['strawberry'],
            avoidAllergenIds: [], allergenConfirmed: true,
            styleId: no.styleId, styleNote: no.styleNote, styleRefPhoto: PHOTO_REF_GUIDE,
            inscription: no.inscription, inscriptionApproved: true,
            candleId: 'digital', candleCount: 1, tablewareSets: 8, needColdChain: no.needCold,
            ...no.cake
        },
        price: { base: 238, addons: no.price - 238 - (no.needCold ? 30 : 0), coldChain: no.needCold ? 30 : 0, total: no.price },
        timeline: [
            { id: 't1', at: isoOffset(no.daysAgo - 3, 10), actorRole: 'customer', actor: no.contact, type: 'created', text: '顾客提交订单' },
            { id: 't2', at: isoOffset(no.daysAgo - 3, 10, 10), actorRole: 'front', actor: '前台', type: 'status', text: '门店接单' },
            { id: 't3', at: isoOffset(no.daysAgo - 1, 16), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品照片、包装照片与冷藏提示卡' },
            { id: 't4', at: isoOffset(no.daysAgo, no.hour, 12), actorRole: 'front', actor: '前台', type: 'pickup', text: `核验取货码 ${no.code}，顾客当面签收` }
        ],
        photos: { final: PHOTO_FINAL_OK, package: PHOTO_PACKAGE, coldNotice: no.needCold ? PHOTO_COLD : undefined }
    });
}
// 进行中的申诉（顾客今日可见、等待客服判定；运输变形、常温自提 → 需区分责任）
const openHour = Math.max(8, new Date().getHours() - 2);
const OD1004 = appealOrder({
    id: 'OD1004', code: '6620', daysAgo: 0, hour: openHour,
    storeId: 'st_hd', phone: '13800000001', contact: '李小满', bpName: '李小满', bpRel: '本人',
    styleId: '3d_doll', styleNote: '奥特曼立体公仔，红色为主', inscription: '小满 冲鸭',
    needCold: false, price: 388, cake: {}, pickupDaysAgo: 0
});
OD1004.cases.unshift({
    id: 'cs_open_appeal', kind: 'after_sale', status: 'open',
    title: '取货后造型申诉：运输途中公仔变形',
    raisedBy: '李小满', raisedAt: isoOffset(0, Math.min(22, openHour + 1)),
    detail: '回家打开发现 3D 公仔头部歪到一侧、奶油有挤压痕迹。当天 35℃，我坐公交约 50 分钟到家，未要冷链袋。请核对门店成品照与我上传的照片。',
    styleId: '3d_doll', reasonCode: 'transport_deformation',
    transportMode: 'ambient', transportNote: '常温自提，公交约 50 分钟，无冷链保温袋',
    signedAt: OD1004.pickedUpAt, evidencePhoto: PHOTO_EVIDENCE_MELT
});
OD1004.timeline.push({
    id: 't5', at: isoOffset(0, Math.min(22, openHour + 1)), actorRole: 'customer', actor: '李小满', type: 'after_sale',
    text: '顾客取货后上传照片申诉「运输途中公仔变形」；页面已并排比对下单参考图、门店成品照、签收时间与常温运输方式',
    fields: [`签收时间：${OD1004.pickedUpAt ? new Date(OD1004.pickedUpAt).toLocaleString('zh-CN') : ''}`, '运输方式：常温自提，公交约 50 分钟']
});
// 已判定：退款 + 门店责任（造型不符）
const OD1005 = appealOrder({
    id: 'OD1005', code: '7711', daysAgo: 2, hour: 19, storeId: 'st_hd',
    phone: '13800000002', contact: '周也', bpName: '小团子', bpRel: '儿子',
    styleId: 'drawing', styleNote: '库洛米手绘，紫色系', inscription: '小团子 5 岁',
    needCold: true, price: 366, cake: {}
});
OD1005.fees.push({
    id: 'fee_ref1005', label: '取货后造型申诉退款', amount: -120,
    reason: '造型申诉成立（门店责任）：手绘图案与参考图配色明显不符', by: '客服·甜小橙',
    at: isoOffset(-2, 20), caseId: 'cs_dec_refund'
});
OD1005.paidAmount = 246;
OD1005.cases.unshift({
    id: 'cs_dec_refund', kind: 'after_sale', status: 'resolved',
    title: '取货后造型申诉：造型与参考不符', raisedBy: '周也', raisedAt: isoOffset(-2, 19, 40),
    detail: '手绘库洛米配色与参考图差异较大。', styleId: 'drawing',
    reasonCode: 'style_mismatch', transportMode: 'cold_chain', signedAt: OD1005.pickedUpAt,
    evidencePhoto: PHOTO_EVIDENCE_BAD, refundAmount: 120,
    resolvedBy: '客服·甜小橙', resolvedAt: isoOffset(-2, 20),
    resolution: '判定退款 ¥120（经下单参考图 / 门店成品照 / 签收时间 / 运输方式比对，判定为门店责任）：手绘配色偏差，部分退款',
    decision: {
        verdict: 'refund', responsibility: 'store', transportDeformation: false,
        reasonCode: 'style_mismatch', note: '手绘配色偏差，部分退款', by: '客服·甜小橙',
        at: isoOffset(-2, 20), refundAmount: 120
    }
});
// 已判定：补做 + 门店责任（题字错误），已生成补做排班
const OD1006 = appealOrder({
    id: 'OD1006', code: '8833', daysAgo: 1, hour: 18, storeId: 'st_hd',
    phone: '13800000001', contact: '李小满', bpName: '李奶奶', bpRel: '奶奶',
    styleId: 'vintage', styleNote: '寿桃复古裱花', inscription: '福如东海',
    needCold: true, price: 298, cake: { candleId: 'fairy' }
});
const remake1006 = {
    id: 'rm1006', caseId: 'cs_dec_remake', reasonCode: 'inscription_wrong', responsibility: 'store',
    pickupDate: dateOffset(1), slot: '14:00-16:00',
    makeStart: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d.toISOString(); })(),
    status: 'scheduled', note: '售后免费补做：题字误写为“福入东海”（门店责任）',
    createdAt: isoOffset(-1, 20)
};
OD1006.remakes = [remake1006];
OD1006.cases.unshift({
    id: 'cs_dec_remake', kind: 'after_sale', status: 'resolved',
    title: '取货后造型申诉：题字错误', raisedBy: '李小满', raisedAt: isoOffset(-1, 18, 40),
    detail: '题字写成“福入东海”，生日现场无法使用。', styleId: 'vintage',
    reasonCode: 'inscription_wrong', transportMode: 'cold_chain', signedAt: OD1006.pickedUpAt,
    evidencePhoto: PHOTO_EVIDENCE_BAD, resolvedBy: '客服·甜小橙', resolvedAt: isoOffset(-1, 20),
    resolution: `判定补做（门店责任）：重新排定制作并于 ${dateOffset(1)} 14:00-16:00 取货；门店免费补做`,
    decision: {
        verdict: 'remake', responsibility: 'store', transportDeformation: false,
        reasonCode: 'inscription_wrong', note: '门店免费补做', by: '客服·甜小橙',
        at: isoOffset(-1, 20), remakePickupDate: dateOffset(1), remakeSlot: '14:00-16:00',
        remakeMakeStart: remake1006.makeStart
    }
});
OD1006.timeline.push({
    id: 't5', at: isoOffset(-1, 20), actorRole: 'cs', actor: '客服·甜小橙', type: 'after_sale',
    text: `客服判定造型申诉成立→门店免费补做；制作排班与取货时间已重新生成（${dateOffset(1)} 14:00-16:00）；门店责任；计入门店造型质量统计`
});
// 已判定：优惠券 + 门店责任（包装破损）
const OD1007 = appealOrder({
    id: 'OD1007', code: '9901', daysAgo: 3, hour: 12, storeId: 'st_cx',
    phone: '13800000002', contact: '周也', bpName: '周也', bpRel: '本人',
    styleId: 'classic_fruit', styleNote: '经典水果围边', inscription: '生日快乐',
    needCold: false, price: 258, cake: { sizeId: 's6' }
});
const coupon1007 = {
    id: 'cp1007', code: 'SQ200418', customerPhone: '13800000002', customerName: '周也',
    amount: 50, title: '造型关怀券 ¥50', reasonCode: 'packaging_damage',
    reasonText: '包装破损或融化', orderId: 'OD1007', caseId: 'cs_dec_coupon', storeId: 'st_cx',
    responsibility: 'store', status: 'issued', issuedAt: isoOffset(-3, 13),
    expireAt: (() => { const d = new Date(); d.setDate(d.getDate() + 90); return d.toISOString(); })(),
    issuedBy: '客服·甜小橙'
};
OD1007.cases.unshift({
    id: 'cs_dec_coupon', kind: 'after_sale', status: 'resolved',
    title: '取货后造型申诉：包装破损', raisedBy: '周也', raisedAt: isoOffset(-3, 12, 30),
    detail: '包装盒封签开裂，围边水果移位。', reasonCode: 'packaging_damage',
    transportMode: 'ambient', signedAt: OD1007.pickedUpAt, evidencePhoto: PHOTO_EVIDENCE_BAD,
    resolvedBy: '客服·甜小橙', resolvedAt: isoOffset(-3, 13),
    resolution: '判定发放优惠券 ¥50（门店责任）：包装封签不牢，补偿关怀券',
    decision: {
        verdict: 'coupon', responsibility: 'store', transportDeformation: false,
        reasonCode: 'packaging_damage', note: '包装封签不牢，补偿关怀券', by: '客服·甜小橙',
        at: isoOffset(-3, 13), couponId: 'cp1007'
    }
});
// 已判定：拒绝赔付 + 顾客自提责任（运输变形，常温久置）
const OD1008 = appealOrder({
    id: 'OD1008', code: '1208', daysAgo: 4, hour: 13, storeId: 'st_hd',
    phone: '13800000001', contact: '李小满', bpName: '李小满', bpRel: '本人',
    styleId: 'photo', styleNote: '食用照片打印', inscription: 'Happy Bday',
    needCold: false, price: 308, cake: {}
});
OD1008.cases.unshift({
    id: 'cs_dec_reject', kind: 'after_sale', status: 'rejected',
    title: '取货后造型申诉：运输途中变形', raisedBy: '李小满', raisedAt: isoOffset(-4, 17),
    detail: '取货后在户外聚餐放置 4 小时，奶油融化造型塌陷。',
    reasonCode: 'transport_deformation', transportMode: 'ambient',
    transportNote: '常温自提，户外放置约 4 小时后食用', signedAt: OD1008.pickedUpAt,
    evidencePhoto: PHOTO_EVIDENCE_MELT, resolvedBy: '客服·甜小橙', resolvedAt: isoOffset(-4, 18),
    closedNote: '门店成品照与冷藏提示齐全，变形发生在离店后的自提运输/存放环节',
    resolution: '拒绝赔付（变形发生在运输环节，经证据比对判定为顾客自提责任）：门店成品照与冷藏提示齐全',
    decision: {
        verdict: 'reject', responsibility: 'self_pickup', transportDeformation: true,
        reasonCode: 'transport_deformation', note: '门店成品照与冷藏提示齐全，变形发生在离店后的自提运输/存放环节',
        by: '客服·甜小橙', at: isoOffset(-4, 18)
    }
});
OD1008.timeline.push({
    id: 't5', at: isoOffset(-4, 18), actorRole: 'cs', actor: '客服·甜小橙', type: 'after_sale',
    text: '客服判定造型申诉不成立→拒绝赔付；变形发生在运输环节，经证据比对判定为顾客自提责任（运输变形，非门店造型/包装责任）；结论计入门店造型质量统计'
});
function buildInitialState() {
    // 深拷贝：演示订单/优惠券是模块级单例，运行中会被原地修改，重置时必须恢复全新副本
    const orders = JSON.parse(JSON.stringify([...exports.demoOrders, OD1004, OD1005, OD1006, OD1007, OD1008]));
    const coupons = JSON.parse(JSON.stringify([coupon1007]));
    return {
        catalog: exports.catalog,
        stores: exports.stores,
        stock: JSON.parse(JSON.stringify(exports.stockSeed)),
        accounts: exports.accounts.map(({ password, ...rest }) => rest),
        orders,
        coupons
    };
}
