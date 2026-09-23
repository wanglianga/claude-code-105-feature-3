import { useStore } from '../../store'
import { Badge, EmptyState, STATUS_STYLE, STATUS_TEXT, PAY_TEXT, fmtDate } from '../../components/ui'
import { catName, storeName } from '../../store'

export default function CustomerOrders({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { orders, boot } = useStore()
  if (!boot) return null
  const active = orders.filter(o => !['closed', 'cancelled'].includes(o.status))
  const history = orders.filter(o => ['closed', 'cancelled'].includes(o.status))

  const Card = ({ o }: { o: typeof orders[number] }) => (
    <button className="card order-card" onClick={() => onOpen(o.id)}>
      <div className="oc-top">
        <span className="oc-id">{o.id}</span>
        <Badge kind={STATUS_STYLE[o.status]}><span className="dot" />{STATUS_TEXT[o.status]}</Badge>
        <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        {o.cases.some(c => ['open', 'awaiting_customer'].includes(c.status)) &&
          <Badge kind="red">🔔 {o.cases.filter(c => ['open', 'awaiting_customer'].includes(c.status)).length} 个待处理事项</Badge>}
        {o.appeals.some(a => a.status === 'open') && <Badge kind="red">🛟 造型申诉待判定</Badge>}
        {o.remakeCount > 0 && ['pending_accept', 'accepted', 'producing', 'ready'].includes(o.status) && <Badge kind="orange">🔁 补做中</Badge>}
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
        <button className="btn primary" onClick={onNew}>＋ 定制新蛋糕</button>
      </div>

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
