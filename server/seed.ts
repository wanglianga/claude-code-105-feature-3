import type { AppState, Catalog, StoreInfo, Order, Account, StyleAppeal, CustomerCoupon } from '../shared/types'

const now = new Date()
function isoOffset(days: number, hour = 10, minute = 0) {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
function dateOffset(days: number) {
  return isoOffset(days).slice(0, 10)
}
function agoIso(hours: number) {
  return new Date(now.getTime() - hours * 3600 * 1000).toISOString()
}
function inDaysIso(days: number) {
  return new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString()
}

// ---- 演示用示意图（内联 SVG dataURL，浏览器可直接渲染，避免依赖外部图片）----
function svgPhoto(opts: {
  bg: string; cake: string; cream: string; emoji: string; title: string; sub: string; tilt?: boolean; tag?: string
}): string {
  const rot = opts.tilt ? ' transform="rotate(-14 320 250)"' : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" font-family="sans-serif">
  <rect width="640" height="480" fill="${opts.bg}"/>
  ${opts.tag ? `<rect x="24" y="24" width="150" height="40" rx="20" fill="rgba(0,0,0,.45)"/><text x="99" y="51" font-size="20" fill="#fff" text-anchor="middle">${opts.tag}</text>` : ''}
  <g${rot}>
    <ellipse cx="320" cy="360" rx="210" ry="26" fill="rgba(0,0,0,.18)"/>
    <rect x="140" y="330" width="360" height="22" rx="11" fill="#f5f5f5"/>
    <rect x="170" y="250" width="300" height="86" rx="16" fill="${opts.cake}"/>
    <path d="M170 268 q37.5 -26 75 0 t75 0 t75 0 t75 0 v-2 q0-16 75 0 z" fill="${opts.cream}"/>
    <rect x="205" y="176" width="230" height="78" rx="14" fill="${opts.cake}"/>
    <path d="M205 192 q28.75 -22 57.5 0 t57.5 0 t57.5 0 t57.5 0 z" fill="${opts.cream}"/>
    <circle cx="250" cy="240" r="9" fill="#e4474b"/><circle cx="320" cy="240" r="9" fill="#e4474b"/><circle cx="390" cy="240" r="9" fill="#e4474b"/>
    <text x="320" y="150" font-size="64" text-anchor="middle">${opts.emoji}</text>
  </g>
  <rect x="0" y="404" width="640" height="76" fill="rgba(0,0,0,.55)"/>
  <text x="320" y="436" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">${opts.title}</text>
  <text x="320" y="462" font-size="17" fill="rgba(255,255,255,.85)" text-anchor="middle">${opts.sub}</text>
</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

// 下单参考图：黑紫库洛米风
const REF_KUROMI = svgPhoto({ bg: '#2b2350', cake: '#3a2f63', cream: '#8a7fd0', emoji: '🐱‍⬛', title: '下单参考图', sub: '黑紫配色 · 库洛米手绘 · 顾客上传', tag: 'REFERENCE' })
// 门店成品照（与参考存在配色偏差，便于演示申诉对比）
const FINAL_PINK_BUNNY = svgPhoto({ bg: '#5a2342', cake: '#7a3360', cream: '#f3b6d8', emoji: '🐰', title: '门店成品照', sub: '实际出品 · 粉色系兔子 · 交付前上传', tag: 'STORE FINAL' })
// 顾客取货后证据：明显倾斜变形
const EVI_TILTED = svgPhoto({ bg: '#7a3b1d', cake: '#8a4a26', cream: '#f0d9a8', emoji: '😵', title: '顾客取货后拍摄', sub: '造型倾倒 · 奶油滑移 · 到家后发现', tag: 'EVIDENCE', tilt: true })
const EVI_WRONG_INSCRIPTION = svgPhoto({ bg: '#33415c', cake: '#3d4d6b', cream: '#cfe0ff', emoji: '✍️', title: '顾客取货后拍摄', sub: '题字与下单要求不一致', tag: 'EVIDENCE' })
const EVI_MELTED = svgPhoto({ bg: '#1d4a3b', cake: '#26604c', cream: '#bfe6d6', emoji: '🫠', title: '顾客取货后拍摄', sub: '奶油融化塌陷 · 装饰脱落', tag: 'EVIDENCE', tilt: true })
const PKG_PHOTO = svgPhoto({ bg: '#6b5636', cake: '#c9b489', cream: '#f3e8cf', emoji: '📦', title: '包装照片', sub: '封签完整 · 餐具蜡烛已装袋', tag: 'PACKAGE' })
const COLD_CARD = svgPhoto({ bg: '#1c4f7a', cake: '#2a6394', cream: '#cfeaff', emoji: '❄️', title: '冷藏提示卡', sub: '动物奶油：保温袋封口勿拆，2 小时内 0-4℃ 冷藏', tag: 'COLD CHAIN' })

export const catalog: Catalog = {
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
}

export const stores: StoreInfo[] = [
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
]

export const accounts: Account[] = [
  { id: 'u_cust', username: 'customer', password: '123456', name: '李小满', role: 'customer', phone: '13800000001' },
  { id: 'u_cust2', username: 'customer2', password: '123456', name: '周也', role: 'customer', phone: '13800000002' },
  { id: 'u_baker', username: 'baker', password: '123456', name: '陈裱花（湖滨道首席）', role: 'baker', storeId: 'st_hd' },
  { id: 'u_front', username: 'front', password: '123456', name: '王前台（湖滨道）', role: 'front', storeId: 'st_hd' },
  { id: 'u_baker2', username: 'baker2', password: '123456', name: '赵裱花（春熙里）', role: 'baker', storeId: 'st_cx' },
  { id: 'u_front2', username: 'front2', password: '123456', name: '孙前台（春熙里）', role: 'front', storeId: 'st_cx' },
  { id: 'u_cs', username: 'cs', password: '123456', name: '客服·甜小橙', role: 'cs' },
  { id: 'u_mgr', username: 'manager', password: '123456', name: '区域督导·林店长', role: 'cs' }
]

// 库存：草莓在湖滨道店低库存（可触发缺货场景），春熙里店正常
export const stockSeed: AppState['stock'] = {
  st_hd: { strawberry: 'low', blueberry: 'ok', mango_fruit: 'ok', fig: 'out' },
  st_cx: { strawberry: 'ok', blueberry: 'ok', mango_fruit: 'ok', fig: 'ok' }
}

function demoOrder(partial: Partial<Order> & Pick<Order, 'id' | 'pickupCode' | 'pickupDate' | 'slot' | 'latestModifyAt' | 'customer' | 'cake' | 'price'>): Order {
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
    appeals: [],
    remakeCount: 0,
    afterSalesHours: 24,
    version: 1,
    ...partial
  }
}

export const demoOrders: Order[] = [
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
    paidAmount: 296,
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
      styleId: 'drawing', styleNote: '库洛米手绘，黑紫配色', styleRefPhoto: REF_KUROMI,
      inscription: 'Happy 30th', inscriptionApproved: true,
      candleId: 'fairy', candleCount: 1, tablewareSets: 8, needColdChain: true
    },
    price: { base: 238, addons: 148, coldChain: 30, total: 296 },
    timeline: [
      { id: 't1', at: isoOffset(-4, 11), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单' },
      { id: 't2', at: isoOffset(-4, 11, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
      { id: 't3', at: isoOffset(-4, 11, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 416 },
      { id: 't4', at: isoOffset(-1, 15), actorRole: 'baker', actor: '陈裱花', type: 'status', text: '开始裱花制作' },
      { id: 't5', at: isoOffset(-1, 17), actorRole: 'baker', actor: '陈裱花', type: 'production', text: '第一次造型与参考图偏差较大，登记返工', },
      { id: 't6', at: isoOffset(-1, 18, 30), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品照片、包装照片与冷藏提示卡' },
      { id: 't7', at: isoOffset(-1, 18, 31), actorRole: 'front', actor: '王前台', type: 'status', text: '制作完成，进入待取货' },
      { id: 't8', at: isoOffset(-1, 19, 12), actorRole: 'front', actor: '王前台', type: 'pickup', text: '核验取货码 5517，顾客当面签收', fields: ['取货码核验通过', '签收人：李小满本人'] },
      { id: 't9', at: isoOffset(-1, 20, 20), actorRole: 'customer', actor: '李小满', type: 'appeal', text: '顾客取货后发起造型申诉：造型与下单参考不符（到家后约1小时发现）', fields: ['黑紫库洛米被做成粉色兔子，配色与造型均不符'] },
      { id: 't10', at: isoOffset(-1, 21, 0), actorRole: 'cs', actor: '客服·甜小橙', type: 'appeal', text: '客服判定造型申诉成立（门店制作责任），结论：退款 ¥120', amount: -120 },
      { id: 't11', at: isoOffset(-1, 21, 1), actorRole: 'cs', actor: '系统', type: 'fee', text: '退款 ¥120 已原路退回（造型申诉）', amount: -120 }
    ],
    reworks: [
      { id: 'rw1', at: isoOffset(-1, 17), styleId: 'drawing', reason: '造型与参考图不符：库洛米配色偏差', note: '转印线条晕染，重新调色转印', cost: 35, by: '陈裱花' }
    ],
    fees: [
      { id: 'f_ap1', label: '造型申诉退款', amount: -120, reason: '取货后造型申诉（造型与下单参考不符）· 门店制作责任：成品与参考图黑紫库洛米配色造型均不符', by: '客服·甜小橙', at: isoOffset(-1, 21) }
    ],
    photos: { final: FINAL_PINK_BUNNY, package: PKG_PHOTO, coldNotice: COLD_CARD },
    appeals: [
      {
        id: 'ap_demo_1', orderId: 'OD1003', status: 'decided',
        issueType: 'style_mismatch', reason: '造型与下单参考不符',
        detail: '下单参考是黑紫配色库洛米手绘，取回家打开发现做成了粉色兔子，造型和颜色都不对。',
        foundWhen: '到家后（约取货后 1 小时）',
        evidencePhoto: EVI_WRONG_INSCRIPTION,
        raisedAt: isoOffset(-1, 20, 20), raisedBy: '李小满',
        pickedUpAt: isoOffset(-1, 19, 12),
        deliveryMethod: '到店自提 · 冷藏运输（门店提供保温袋/冰袋）', needColdChain: true,
        styleRefPhoto: REF_KUROMI, storeFinalPhoto: FINAL_PINK_BUNNY,
        responsibility: 'store', verdict: 'refund',
        decisionNote: '对比下单参考图与门店成品照，造型与配色确实不符，属门店制作责任；退款 ¥120 原路退回，已要求裱花复盘转印工序。',
        decidedBy: '客服·甜小橙', decidedAt: isoOffset(-1, 21),
        refundAmount: 120
      }
    ]
  }),
  demoOrder({
    id: 'OD1004',
    pickupCode: '7208',
    storeId: 'st_hd',
    pickupDate: dateOffset(-1),
    slot: '16:00-18:00',
    latestModifyAt: isoOffset(-2, 18, 0),
    status: 'picked_up',
    paymentStatus: 'paid',
    paidAmount: 336,
    pickedUpAt: agoIso(6),
    customer: {
      contactName: '李小满', phone: '13800000001',
      birthdayPerson: { name: '李小满', relation: '本人', age: '30', gender: '女' },
      invoice: { needed: false }
    },
    cake: {
      sizeId: 's6', baseId: 'vanilla', creamId: 'animal',
      fillingIds: ['mango'], fruitIds: ['blueberry'],
      avoidAllergenIds: [], allergenConfirmed: true,
      styleId: '3d_doll', styleNote: '奥特曼立体公仔',
      inscription: '小满要加油', inscriptionApproved: true,
      candleId: 'rainbow', candleCount: 1, tablewareSets: 6, needColdChain: true
    },
    price: { base: 168, addons: 138, coldChain: 30, total: 336 },
    timeline: [
      { id: 't1', at: isoOffset(-3, 10), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单（3D 立体公仔）' },
      { id: 't2', at: isoOffset(-3, 10, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
      { id: 't3', at: isoOffset(-3, 10, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 336 },
      { id: 't4', at: agoIso(28), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品照片、包装照片与冷藏提示卡' },
      { id: 't5', at: agoIso(6), actorRole: 'front', actor: '王前台', type: 'pickup', text: '核验取货码 7208，顾客当面签收', fields: ['已口头提醒：保温袋封口勿拆，2小时内冷藏'] }
    ],
    photos: { final: FINAL_PINK_BUNNY, package: PKG_PHOTO, coldNotice: COLD_CARD },
    appeals: [
      {
        id: 'ap_demo_2', orderId: 'OD1004', status: 'open',
        issueType: 'transport_deformed', reason: '运输造成变形/融化',
        detail: '取货后顺路逛了商场约 3 小时才回家，打开发现立体公仔歪倒、奶油融化，保温袋冰袋已化成水。',
        foundWhen: '到家后（取货后约 3 小时）',
        evidencePhoto: EVI_TILTED,
        raisedAt: agoIso(2),
        raisedBy: '李小满',
        pickedUpAt: agoIso(6),
        deliveryMethod: '到店自提 · 冷藏运输（门店提供保温袋/冰袋）', needColdChain: true,
        styleRefPhoto: undefined, storeFinalPhoto: EVI_MELTED
      }
    ]
  }),
  demoOrder({
    id: 'OD1005',
    pickupCode: '4093',
    storeId: 'st_cx',
    pickupDate: dateOffset(-2),
    slot: '12:00-14:00',
    latestModifyAt: isoOffset(-3, 18, 0),
    status: 'picked_up',
    paymentStatus: 'paid',
    paidAmount: 278,
    pickedUpAt: isoOffset(-2, 13, 0),
    customer: {
      contactName: '周也', phone: '13800000002',
      birthdayPerson: { name: '小团子', relation: '儿子', age: '5', gender: '男' },
      invoice: { needed: false }
    },
    cake: {
      sizeId: 's6', baseId: 'choco', creamId: 'plant',
      fillingIds: ['oreo'], fruitIds: ['none_fruit'],
      avoidAllergenIds: ['mango_al'], allergenConfirmed: true,
      styleId: 'classic_fruit', styleNote: '蓝莓围边',
      inscription: '小团子 5 岁', inscriptionApproved: true,
      candleId: 'digital', candleCount: 5, tablewareSets: 6, needColdChain: false
    },
    price: { base: 168, addons: 110, coldChain: 0, total: 278 },
    timeline: [
      { id: 't1', at: isoOffset(-4, 9), actorRole: 'customer', actor: '周也', type: 'created', text: '顾客提交订单' },
      { id: 't2', at: isoOffset(-4, 9, 10), actorRole: 'front', actor: '孙前台', type: 'status', text: '春熙里店接单' },
      { id: 't3', at: isoOffset(-4, 9, 20), actorRole: 'customer', actor: '周也', type: 'payment', text: '在线支付', amount: 278 },
      { id: 't4', at: isoOffset(-2, 11), actorRole: 'baker', actor: '赵裱花', type: 'photo', text: '上传成品、包装照片' },
      { id: 't5', at: isoOffset(-2, 13), actorRole: 'front', actor: '孙前台', type: 'pickup', text: '核验取货码 4093，顾客骑电动车自提签收' },
      { id: 't6', at: isoOffset(-2, 15), actorRole: 'customer', actor: '周也', type: 'appeal', text: '顾客取货后发起造型申诉：运输造成变形/融化（到家后发现）' },
      { id: 't7', at: isoOffset(-2, 16), actorRole: 'cs', actor: '客服·甜小橙', type: 'appeal', text: '客服判定申诉不成立（顾客自提责任），结论：拒绝赔付', fields: ['常温单且自提途中颠簸倾倒，包装封签完整、门店成品照造型正常'] }
    ],
    photos: { final: FINAL_PINK_BUNNY, package: PKG_PHOTO },
    appeals: [
      {
        id: 'ap_demo_3', orderId: 'OD1005', status: 'decided',
        issueType: 'transport_deformed', reason: '运输造成变形/融化',
        detail: '骑电动车带回家，打开蛋糕一侧塌了，认为门店没做好。',
        foundWhen: '到家后（约取货后 40 分钟）',
        evidencePhoto: EVI_TILTED,
        raisedAt: isoOffset(-2, 15), raisedBy: '周也',
        pickedUpAt: isoOffset(-2, 13),
        deliveryMethod: '到店自提 · 常温携带', needColdChain: false,
        styleRefPhoto: undefined, storeFinalPhoto: FINAL_PINK_BUNNY,
        responsibility: 'transport_customer', verdict: 'reject',
        decisionNote: '门店成品照显示出品造型完整、包装封签完好；本单为常温单，顾客电动车自提途中颠簸倾倒导致变形，属顾客自提运输责任，门店不予赔付。已附赠下次自提固定绳扣建议。',
        decidedBy: '客服·甜小橙', decidedAt: isoOffset(-2, 16)
      }
    ]
  }),
  demoOrder({
    id: 'OD1006',
    pickupCode: '6185',
    storeId: 'st_hd',
    pickupDate: dateOffset(-3),
    slot: '10:00-12:00',
    latestModifyAt: isoOffset(-4, 18, 0),
    status: 'picked_up',
    paymentStatus: 'paid',
    paidAmount: 258,
    pickedUpAt: isoOffset(-3, 11, 20),
    customer: {
      contactName: '李小满', phone: '13800000001',
      birthdayPerson: { name: '李奶奶', relation: '奶奶', age: '78', gender: '女' },
      invoice: { needed: false }
    },
    cake: {
      sizeId: 's6', baseId: 'vanilla', creamId: 'animal',
      fillingIds: ['cheese_ball'], fruitIds: ['fig'],
      avoidAllergenIds: [], allergenConfirmed: true,
      styleId: 'minimal', styleNote: '极简留白',
      inscription: '福寿', inscriptionApproved: true,
      candleId: 'none_c', candleCount: 0, tablewareSets: 6, needColdChain: false
    },
    price: { base: 168, addons: 90, coldChain: 0, total: 258 },
    timeline: [
      { id: 't1', at: isoOffset(-5, 9), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单' },
      { id: 't2', at: isoOffset(-5, 9, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
      { id: 't3', at: isoOffset(-5, 9, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 258 },
      { id: 't4', at: isoOffset(-3, 10), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品、包装照片' },
      { id: 't5', at: isoOffset(-3, 11, 20), actorRole: 'front', actor: '王前台', type: 'pickup', text: '核验取货码 6185，顾客签收' },
      { id: 't6', at: isoOffset(-3, 14), actorRole: 'customer', actor: '李小满', type: 'appeal', text: '顾客取货后发起造型申诉：装饰/公仔缺失或损坏' },
      { id: 't7', at: isoOffset(-3, 15), actorRole: 'cs', actor: '客服·甜小橙', type: 'coupon', text: '客服判定（门店制作责任），结论：发放 ¥30 优惠券至顾客账户', fields: ['关联申诉原因：装饰无花果干摆放缺失', '有效期 90 天'] }
    ],
    photos: { final: FINAL_PINK_BUNNY, package: PKG_PHOTO },
    appeals: [
      {
        id: 'ap_demo_4', orderId: 'OD1006', status: 'decided',
        issueType: 'decoration_missing', reason: '装饰/公仔缺失或损坏',
        detail: '下单选了无花果装饰，取回家发现表面只有两颗且摆放歪斜，和页面图片差挺多，但蛋糕本身没坏，不想退款想要个补偿。',
        foundWhen: '到家后（约取货后 2 小时）',
        evidencePhoto: EVI_WRONG_INSCRIPTION,
        raisedAt: isoOffset(-3, 14), raisedBy: '李小满',
        pickedUpAt: isoOffset(-3, 11, 20),
        deliveryMethod: '到店自提 · 常温携带', needColdChain: false,
        styleRefPhoto: undefined, storeFinalPhoto: FINAL_PINK_BUNNY,
        responsibility: 'store', verdict: 'coupon',
        decisionNote: '核对成品照，无花果装饰数量与标准造型卡有差距，属门店出品细节责任；顾客接受优惠券补偿，已发放 ¥30 造型关怀券至账户。',
        decidedBy: '客服·甜小橙', decidedAt: isoOffset(-3, 15),
        coupon: { id: 'cp_demo_1', amount: 30, reason: '取货后造型申诉（订单 OD1006）：装饰/公仔缺失或损坏', at: isoOffset(-3, 15) }
      }
    ]
  }),
  // 补做进行中：原单已签收→申诉判定补做→已重新排回备料，等待裱花师重新制作
  demoOrder({
    id: 'OD1007',
    pickupCode: '9034',
    storeId: 'st_hd',
    pickupDate: dateOffset(1),
    slot: '14:00-16:00',
    latestModifyAt: now.toISOString(),
    status: 'accepted',
    paymentStatus: 'paid',
    paidAmount: 358,
    remakeCount: 1,
    customer: {
      contactName: '李小满', phone: '13800000001',
      birthdayPerson: { name: '李小满', relation: '本人', age: '30', gender: '女' },
      invoice: { needed: false }
    },
    cake: {
      sizeId: 's8', baseId: 'vanilla', creamId: 'animal',
      fillingIds: ['taro'], fruitIds: ['strawberry'],
      avoidAllergenIds: [], allergenConfirmed: true,
      styleId: 'vintage', styleNote: '复古裱花裙边，粉色系', styleRefPhoto: REF_KUROMI,
      inscription: 'Happy Birthday', inscriptionApproved: true,
      candleId: 'rainbow', candleCount: 1, tablewareSets: 8, needColdChain: true
    },
    price: { base: 238, addons: 90, coldChain: 30, total: 358 },
    timeline: [
      { id: 't1', at: isoOffset(-6, 9), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单' },
      { id: 't2', at: isoOffset(-6, 9, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
      { id: 't3', at: isoOffset(-6, 9, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 358 },
      { id: 't4', at: isoOffset(-2, 16), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传原单成品、包装照片与冷藏提示卡' },
      { id: 't5', at: isoOffset(-2, 18), actorRole: 'front', actor: '王前台', type: 'pickup', text: '原单签收' },
      { id: 't6', at: isoOffset(-2, 20), actorRole: 'customer', actor: '李小满', type: 'appeal', text: '顾客取货后发起造型申诉：配色偏差' },
      { id: 't7', at: isoOffset(-1, 10), actorRole: 'cs', actor: '客服·甜小橙', type: 'remake', text: '客服判定（门店制作责任），结论：补做。制作排班已重新生成', fields: ['新取货：明日 14:00-16:00', '新取货码 9034', '建议开制：取货前 2 小时', '出品前重新上传成品/包装照片'] }
    ],
    photos: {},
    appeals: [
      {
        id: 'ap_demo_5', orderId: 'OD1007', status: 'decided',
        issueType: 'color_deviation', reason: '配色偏差',
        detail: '要求的粉色系复古裙边做成了白色，整体色差明显；蛋糕还能吃但生日拍照效果差，希望重新做一个。',
        foundWhen: '门店当场（签收时已提出，回家拍照后补提申诉）',
        evidencePhoto: EVI_WRONG_INSCRIPTION,
        raisedAt: isoOffset(-2, 20), raisedBy: '李小满',
        pickedUpAt: isoOffset(-2, 18),
        deliveryMethod: '到店自提 · 冷藏运输（门店提供保温袋/冰袋）', needColdChain: true,
        styleRefPhoto: REF_KUROMI, storeFinalPhoto: FINAL_PINK_BUNNY,
        responsibility: 'store', verdict: 'remake',
        decisionNote: '裙边配色与参考要求确有偏差，门店制作责任；与顾客约定明日 14:00-16:00 免费补做，原定制要求不变，重新生成制作排班与取货码。',
        decidedBy: '客服·甜小橙', decidedAt: isoOffset(-1, 10),
        remake: {
          pickupDate: dateOffset(1), slot: '14:00-16:00',
          makeStartTime: isoOffset(1, 12), readyAt: isoOffset(1, 14),
          note: '造型申诉（配色偏差）判定补做；门店按原定制要求重新制作，交付出品前重新上传成品/包装照片与冷藏提示卡',
          renewedCode: '9034'
        }
      }
    ]
  }),
  // 当天刚签收、无在途申诉：顾客登录即可对其发起造型申诉（24h 窗口剩余约 21h）
  demoOrder({
    id: 'OD1008',
    pickupCode: '2756',
    storeId: 'st_hd',
    pickupDate: dateOffset(0),
    slot: '10:00-12:00',
    latestModifyAt: isoOffset(-1, 18, 0),
    status: 'picked_up',
    paymentStatus: 'paid',
    paidAmount: 328,
    pickedUpAt: agoIso(3),
    customer: {
      contactName: '李小满', phone: '13800000001',
      birthdayPerson: { name: '李妈妈', relation: '妈妈', age: '55', gender: '女' },
      invoice: { needed: false }
    },
    cake: {
      sizeId: 's8', baseId: 'vanilla', creamId: 'animal',
      fillingIds: ['mango'], fruitIds: ['blueberry', 'strawberry'],
      avoidAllergenIds: [], allergenConfirmed: true,
      styleId: 'photo', styleNote: '食用照片打印：全家福', styleRefPhoto: REF_KUROMI,
      inscription: '妈妈永远年轻', inscriptionApproved: true,
      candleId: 'digital', candleCount: 55, tablewareSets: 8, needColdChain: true
    },
    price: { base: 238, addons: 60, coldChain: 30, total: 328 },
    timeline: [
      { id: 't1', at: isoOffset(-2, 9), actorRole: 'customer', actor: '李小满', type: 'created', text: '顾客提交订单（食用照片打印款）' },
      { id: 't2', at: isoOffset(-2, 9, 10), actorRole: 'front', actor: '王前台', type: 'status', text: '门店接单' },
      { id: 't3', at: isoOffset(-2, 9, 20), actorRole: 'customer', actor: '李小满', type: 'payment', text: '在线支付', amount: 328 },
      { id: 't4', at: agoIso(5), actorRole: 'baker', actor: '陈裱花', type: 'photo', text: '上传成品照片、包装照片与冷藏提示卡' },
      { id: 't5', at: agoIso(3), actorRole: 'front', actor: '王前台', type: 'pickup', text: '核验取货码 2756，顾客当面签收', fields: ['取货码核验通过', '冷藏提示已当面告知'] }
    ],
    photos: { final: FINAL_PINK_BUNNY, package: PKG_PHOTO, coldNotice: COLD_CARD }
  })
]

// ---- 顾客账户优惠券种子（与 OD1006 判决关联）----
export const couponSeed: CustomerCoupon[] = [
  {
    id: 'cp_demo_1',
    phone: '13800000001',
    amount: 30,
    title: '造型关怀券 ¥30',
    reason: '取货后造型申诉（订单 OD1006）：装饰/公仔缺失或损坏',
    appealId: 'ap_demo_4',
    orderId: 'OD1006',
    grantedAt: isoOffset(-3, 15),
    expireAt: inDaysIso(87),
    used: false,
    source: 'appeal'
  }
]

export function buildInitialState(): AppState {
  return {
    catalog,
    stores,
    stock: JSON.parse(JSON.stringify(stockSeed)),
    accounts: accounts.map(({ password, ...rest }) => rest) as any,
    // 深拷贝：动作引擎会原地修改订单，reset 必须能还原到干净种子
    orders: JSON.parse(JSON.stringify(demoOrders)),
    coupons: JSON.parse(JSON.stringify(couponSeed))
  }
}
