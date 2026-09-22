import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { Badge, EmptyState, Modal, STATUS_STYLE, STATUS_TEXT, PAY_TEXT, fmtDate, fmtDateTime } from '../../components/ui'
import { catName, storeName } from '../../store'
import type { Coupon } from '../../../shared/types'

export default function CustomerOrders({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { orders, boot, coupons, loadCoupons } = useStore()
  const [showCoupons, setShowCoupons] = useState(false)
  useEffect(() => { loadCoupons() }, [])
  if (!boot) return null
  const active = orders.filter(o => !['closed', 'cancelled'].includes(o.status))
  const history = orders.filter(o => ['closed', 'cancelled'].includes(o.status))
  const activeCoupons = coupons.filter(c => c.status === 'issued')
  const couponTotal = activeCoupons.reduce((s, c) => s + c.amount, 0)

  const Card = ({ o }: { o: typeof orders[number] }) => (
    <button className="card order-card" onClick={() => onOpen(o.id)}>
      <div className="oc-top">
        <span className="oc-id">{o.id}</span>
        <Badge kind={STATUS_STYLE[o.status]}><span className="dot" />{STATUS_TEXT[o.status]}</Badge>
        <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        {o.cases.some(c => ['open', 'awaiting_customer'].includes(c.status)) &&
          <Badge kind="red">🔔 {o.cases.filter(c => ['open', 'awaiting_customer'].includes(c.status)).length} 个待处理事项</Badge>}
      </div>
      <div className="oc-mid">
        <span>🎂 <b>{catName(boot.catalog, 'sizes', o.cake.sizeId)} · {catName(boot.catalog, 'styles', o.cake.styleId)}</b></span>
        <span>🏪 {storeName(boot.stores, o.storeId)}</span>
        <span>🕑 {fmtDate(o.pickupDate)} {o.slot}</span>
        <span>✍️ {o.cake.inscription}</span>
        <span>💳 <b>¥{o.price.total + o.fees.reduce((s, f) => s + f.amount, 0)}</b></span>
      </div>
    </button>
  )

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="pagename">我的蛋糕订单</h2>
          <div className="pagesub">查看定制进度、可修改范围与取货码；所有改期/退款/缺货协商都留存在原订单里</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setShowCoupons(true)}>
            🎟️ 优惠券账户{activeCoupons.length > 0 && <Badge kind="red">{activeCoupons.length} · ¥{couponTotal}</Badge>}
          </button>
          <button className="btn primary" onClick={onNew}>＋ 定制新蛋糕</button>
        </div>
      </div>

      {showCoupons && <CouponWallet coupons={coupons} onClose={() => setShowCoupons(false)} onOpenOrder={onOpen} />}

      {orders.length === 0 && (
        <EmptyState title="还没有生日蛋糕订单" sub="为重要的人定制一款，从尺寸到题字都可以自己搭配" />
      )}

      {active.length > 0 && (
        <>
          <h3 className="mt16" style={{ fontSize: 15 }}>进行中（{active.length}）</h3>
          <div className="grid mt12">{active.map(o => <Card key={o.id} o={o} />)}</div>
        </>
      )}
      {history.length > 0 && (
        <>
          <h3 className="mt20" style={{ fontSize: 15 }}>已完成 / 已关闭</h3>
          <div className="grid mt12">{history.map(o => <Card key={o.id} o={o} />)}</div>
        </>
      )}
    </div>
  )
}

function CouponWallet({ coupons, onClose, onOpenOrder }: {
  coupons: Coupon[]; onClose: () => void; onOpenOrder: (id: string) => void
}) {
  const issued = coupons.filter(c => c.status === 'issued')
  const total = issued.reduce((s, c) => s + c.amount, 0)
  return (
    <Modal wide title="🎟️ 我的优惠券账户" onClose={onClose}
      footer={<div className="small muted">优惠券均来自取货后造型申诉的客服赔付，券面关联申诉原因与原订单，下单时可向客服出示券号核销。</div>}>
      {coupons.length === 0
        ? <EmptyState icon="🎟️" title="暂无优惠券" sub="如取货后造型申诉成立，客服发放的退款券/关怀券会自动进入此账户" />
        : (
          <>
            <div className="small mb8">可用 <b style={{ color: 'var(--brand-dark)', fontSize: 16 }}>{issued.length}</b> 张 · 合计面额 <b style={{ color: 'var(--brand-dark)' }}>¥{total}</b></div>
            <div className="grid cols-2">
              {coupons.map(c => (
                <div key={c.id} className="card" style={{
                  padding: 14, borderLeft: '4px solid var(--brand)',
                  opacity: c.status === 'issued' ? 1 : 0.55,
                  background: c.status === 'issued' ? 'linear-gradient(120deg,#fff7ef,#fff)' : undefined
                }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-dark)' }}>¥{c.amount}</div>
                    <Badge kind={c.status === 'issued' ? 'green' : 'gray'}>
                      {c.status === 'issued' ? '未使用' : c.status === 'used' ? '已使用' : '已过期'}
                    </Badge>
                  </div>
                  <div className="small mt8"><b>{c.title}</b></div>
                  <div className="tiny muted mt8">券号 {c.code} · 有效期至 {fmtDateTime(c.expireAt)}</div>
                  <div className="tiny mt8">
                    关联申诉：{c.reasonText}
                    <span className="muted">（{c.responsibility === 'store' ? '门店责任' : '自提责任'}）</span>
                  </div>
                  <div className="row mt8" style={{ justifyContent: 'space-between' }}>
                    <button className="btn sm ghost" onClick={() => { onClose(); onOpenOrder(c.orderId) }}>查看原订单 {c.orderId}</button>
                    <span className="tiny muted">客服 {c.issuedBy} · {fmtDateTime(c.issuedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
    </Modal>
  )
}
