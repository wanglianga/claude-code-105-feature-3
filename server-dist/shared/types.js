"use strict";
// 三端共用领域模型：顾客端 / 门店制作端（裱花师 + 前台）/ 客服后台
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSPORT_ISSUES = exports.APPEAL_STATUS_LABEL = exports.APPEAL_VERDICT_LABEL = exports.APPEAL_RESPONSIBILITY_LABEL = exports.APPEAL_ISSUE_LABEL = exports.CASE_LABEL = exports.STATUS_LABEL = void 0;
exports.STATUS_LABEL = {
    pending_accept: '待门店接单',
    accepted: '已接单·备料中',
    producing: '裱花制作中',
    ready: '待取货',
    verified: '已核验·待签收',
    picked_up: '已取货签收',
    closed: '售后已关闭',
    cancelled: '已取消'
};
exports.CASE_LABEL = {
    date_change: '临时改期',
    sensitive_inscription: '题字敏感待审',
    fruit_shortage: '原料缺货',
    fridge_capacity: '冷柜容量不足',
    store_transfer: '跨店调货',
    after_sale: '售后申请'
};
// ---- 取货后造型申诉：文案映射 ----
exports.APPEAL_ISSUE_LABEL = {
    style_mismatch: '造型与下单参考不符',
    inscription_wrong: '题字错误',
    color_deviation: '配色偏差',
    decoration_missing: '装饰/公仔缺失或损坏',
    transport_deformed: '运输造成变形/融化',
    other: '其他造型问题'
};
exports.APPEAL_RESPONSIBILITY_LABEL = {
    store: '门店制作责任',
    transport_store: '门店运输责任',
    transport_customer: '顾客自提责任',
    none: '无门店责任'
};
exports.APPEAL_VERDICT_LABEL = {
    refund: '退款',
    remake: '补做',
    coupon: '优惠券补偿',
    reject: '拒绝赔付'
};
exports.APPEAL_STATUS_LABEL = {
    open: { t: '待客服判定', c: 'red' },
    decided: { t: '已判定', c: 'green' },
    closed: { t: '已归档', c: 'gray' }
};
// 运输变形类问题：客服必须在门店责任与顾客自提责任之间判定
exports.TRANSPORT_ISSUES = ['transport_deformed'];
