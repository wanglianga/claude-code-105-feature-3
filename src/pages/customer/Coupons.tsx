import { useStore } from '../../store'
import { Modal, EmptyState, fmtDateTime } from '../../components/ui'
import type { CustomerCoupon } from '../../../shared/types'

export default function CouponsModal({ onClose }: { onClose: () => void }) {
  const { coupons } = useStore()
  const active = coupons.filter(c => !c.used && new Date(c.expireAt).getTime() > Date.now())
  const inactive = coupons.filter(c => c.used || new Date(c.expireAt).getTime() <= Date.now())

  return (
    <Modal title="🎟️ 我的优惠券" onClose={onClose}>
      <div className="small muted mb12">造型申诉判定为优惠券补偿时，券会自动进入本账户，并关联本次申诉原因。</div>
      {coupons.length === 0 && <EmptyState icon="🎫" title="暂无优惠券" sub="取货后如遇造型问题，可在订单售后窗口内发起造型申诉" />}
      <div className="grid" style={{ gap: 10 }}>
        {active.map(c => <CouponRow key={c.id} c={c} />)}
        {inactive.map(c => <CouponRow key={c.id} c={c} dim />)}
      </div>
    </Modal>
  )
}

function CouponRow({ c, dim }: { c: CustomerCoupon; dim?: boolean }) {
  return (
    <div className="card" style={{
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16,
      opacity: dim ? 0.55 : 1, borderLeft: '4px solid var(--brand)'
    }}>
      <div style={{ textAlign: 'center', minWidth: 92 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand-dark)' }}>¥{c.amount}</div>
        <div className="tiny muted">{c.used ? '已使用' : '未使用'}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div className="small"><b>{c.title}</b></div>
        <div className="tiny muted mt8">来源：{c.reason}</div>
        <div className="tiny muted">发放 {fmtDateTime(c.grantedAt)} · 有效期至 {c.expireAt.slice(0, 10)}{c.orderId ? ` · 关联订单 ${c.orderId}` : ''}</div>
      </div>
      {!c.used && new Date(c.expireAt).getTime() > Date.now() && <span className="badge green">可用</span>}
    </div>
  )
}
