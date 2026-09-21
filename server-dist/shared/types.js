"use strict";
// 三端共用领域模型：顾客端 / 门店制作端（裱花师 + 前台）/ 客服后台
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASE_LABEL = exports.STATUS_LABEL = void 0;
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
