"use strict";
// 三端共用领域模型：顾客端 / 门店制作端（裱花师 + 前台）/ 客服后台
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESPONSIBILITY_LABEL = exports.APPEAL_REASON_LABEL = exports.APPEAL_VERDICT_LABEL = exports.CASE_LABEL = exports.STATUS_LABEL = void 0;
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
exports.APPEAL_VERDICT_LABEL = {
    refund: '退款',
    remake: '补做',
    coupon: '优惠券赔付',
    reject: '拒绝赔付'
};
exports.APPEAL_REASON_LABEL = {
    style_mismatch: '造型与参考不符',
    inscription_wrong: '题字错误',
    ingredient_mismatch: '原料/水果不符',
    transport_deformation: '运输途中变形',
    packaging_damage: '包装破损/融化',
    food_issue: '食用后不适',
    other: '其他'
};
exports.RESPONSIBILITY_LABEL = {
    store: '门店责任',
    self_pickup: '顾客自提责任'
};
