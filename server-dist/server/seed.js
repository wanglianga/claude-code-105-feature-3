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
        photos: {},
        afterSalesHours: 24,
        version: 1,
        ...partial
    };
}
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
            styleId: 'drawing', styleNote: '库洛米手绘', styleRefPhoto: undefined,
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
        photos: {}
    })
];
function buildInitialState() {
    return {
        catalog: exports.catalog,
        stores: exports.stores,
        stock: JSON.parse(JSON.stringify(exports.stockSeed)),
        accounts: exports.accounts.map(({ password, ...rest }) => rest),
        orders: exports.demoOrders
    };
}
