import { useEffect, useMemo, useState } from 'react'
import { useStore, catName } from '../../store'
import {
  Badge, Notice, Modal, EmptyState,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, fmtDateTime, fmtDate
} from '../../components/ui'
import type { Order } from '../../../shared/types'

export default function StoreFront({ onOpen }: { onOpen: (id: string) => void }) {
  const { account, orders, boot, refreshOrders } = useStore()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  useEffect(() => { refreshOrders() }, [])
  const store = boot!.stores.find(s => s.id === account!.storeId)!
  const cat = boot!.catalog

  const dayOrders = orders.filter(o => o.pickupDate === date).sort((a, b) => a.slot.localeCompare(b.slot))
  // 冷柜占用只计已接单/在制；待接单单列，避免顾客下单互相锁死
  const fridgeUsed = dayOrders.filter(o => !['cancelled', 'picked_up', 'closed', 'pending_accept'].includes(o.status))
    .reduce((s, o) => s + (cat.sizes.find(x => x.id === o.cake.sizeId)?.units || 1), 0)
  const fridgePending = dayOrders.filter(o => o.status === 'pending_accept')
    .reduce((s, o) => s + (cat.sizes.find(x => x.id === o.cake.sizeId)?.units || 1), 0)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="pagename">🏬 前台工作台 · {store.name}</h2>
          <div className="pagesub">关注取货时段拥挤、支付状态与取货码核验；接单前确认冷柜容量，改期/换店由客服协调后回流本单</div>
        </div>
        <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: 170 }} />
      </div>

      {/* 容量压力 */}
      <div className="grid cols-3">
        <div className="stat">
          <div className="s-label">🧊 当日冷柜占用（{fmtDate(date)}）</div>
          <div className="s-num" style={{ color: fridgeUsed >= store.fridgeCapacity ? 'var(--danger)' : fridgeUsed >= store.fridgeCapacity - 1 ? 'var(--warn)' : undefined }}>
            {fridgeUsed}<span className="small muted"> / {store.fridgeCapacity} 标位</span>
          </div>
          <div className="bar mt8"><i className={fridgeUsed >= store.fridgeCapacity ? 'full' : fridgeUsed >= store.fridgeCapacity - 1 ? 'warn' : ''} style={{ width: `${Math.min(100, fridgeUsed / store.fridgeCapacity * 100)}%` }} /></div>
          {fridgePending > 0 && <div className="s-sub" style={{ color: 'var(--warn)' }}>另有待接单 {fridgePending} 标位未锁定，接单前需评估</div>}
        </div>
        <div className="stat">
          <div className="s-label">🎂 当日订单</div>
          <div className="s-num">{dayOrders.length}<span className="small muted"> 单</span></div>
          <div className="s-sub">待接单 {dayOrders.filter(o => o.status === 'pending_accept').length} · 待取 {dayOrders.filter(o => o.status === 'ready').length} · 已取 {dayOrders.filter(o => o.status === 'picked_up').length}</div>
        </div>
        <div className="stat">
          <div className="s-label">💳 待收银</div>
          <div className="s-num" style={{ color: 'var(--warn)' }}>{dayOrders.filter(o => o.paymentStatus !== 'paid' && o.paymentStatus !== 'refunded' && o.status !== 'cancelled').length}</div>
          <div className="s-sub">交付前必须结清（含加收差价）</div>
        </div>
      </div>

      {/* 待接单 */}
      {dayOrders.filter(o => o.status === 'pending_accept').length > 0 && (
        <>
          <h3 className="mt16" style={{ fontSize: 15 }}>📥 待接单（需确认冷柜与排班）</h3>
          <div className="grid mt12 cols-2">
            {dayOrders.filter(o => o.status === 'pending_accept').map(o => <AcceptCard key={o.id} o={o} onOpen={onOpen} />)}
          </div>
        </>
      )}

      {/* 取货时段列 */}
      <h3 className="mt20" style={{ fontSize: 15 }}>🕑 取货时段排布</h3>
      <div className="grid mt12">
        {cat.slots.map(sl => {
          const list = dayOrders.filter(o => o.slot === sl && o.status !== 'cancelled')
          const ratio = list.length / store.slotCapacity
          return (
            <div className="card" key={sl}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>{sl}
                  <Badge kind={ratio >= 1 ? 'red' : ratio >= 0.75 ? 'orange' : 'green'}>
                    {list.length}/{store.slotCapacity} 单 {ratio >= 1 ? '🔥 已约满' : ratio >= 0.75 ? '拥挤' : '顺畅'}
                  </Badge>
                </h3>
                <span className="tiny muted">拥挤时段建议提前致电错峰</span>
              </div>
              {list.length === 0 ? <div className="tiny muted mt8">该时段暂无订单</div> : (
                <div className="grid cols-2 mt12" style={{ gap: 10 }}>
                  {list.map(o => <PickupRow key={o.id} o={o} onOpen={onOpen} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AcceptCard({ o, onOpen }: { o: Order; onOpen: (id: string) => void }) {
  const { act, openOrder, boot } = useStore()
  const units = boot!.catalog.sizes.find(s => s.id === o.cake.sizeId)?.units || 1
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn sm ghost" style={{ padding: 0, fontWeight: 800, fontSize: 14 }} onClick={() => onOpen(o.id)}>{o.id}</button>
        <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
      </div>
      <div className="small mt8">{catName(boot!.catalog, 'sizes', o.cake.sizeId)} · {catName(boot!.catalog, 'styles', o.cake.styleId)}（占冷柜 {units} 标位）</div>
      <div className="tiny muted">{o.slot} · {o.customer.contactName} {o.customer.phone}</div>
      {o.cases.some(c => c.kind === 'fruit_shortage' && ['open', 'awaiting_customer'].includes(c.status)) &&
        <div className="mt8"><Badge kind="red">🍓 存在缺货工单，先与客服确认再接单</Badge></div>}
      <div className="row mt8">
        <button className="btn sm primary" onClick={async () => { const r = await act(o.id, 'accept'); if (r) openOrder(o.id) }}>确认接单</button>
        <button className="btn sm" onClick={() => onOpen(o.id)}>查看工单</button>
      </div>
    </div>
  )
}

function PickupRow({ o, onOpen }: { o: Order; onOpen: (id: string) => void }) {
  const { act, openOrder } = useStore()
  const [verify, setVerify] = useState(false)
  const photosOk = !!o.photos.final && !!o.photos.package && (!o.cake.needColdChain || !!o.photos.coldNotice)
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn sm ghost" style={{ padding: 0, fontWeight: 800 }} onClick={() => onOpen(o.id)}>{o.id}</button>
        <div className="row" style={{ gap: 6 }}>
          <Badge kind={STATUS_STYLE[o.status]}>{STATUS_TEXT[o.status]}</Badge>
          <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        </div>
      </div>
      <div className="small mt8">🎂 {catName(useStore.getState().boot!.catalog, 'sizes', o.cake.sizeId)} · 题字「{o.cake.inscription}」</div>
      <div className="tiny muted">{o.customer.contactName} · 尾号 {o.customer.phone.slice(-4)} · 取货码 <b style={{ fontSize: 13 }}>{o.pickupCode}</b></div>
      <div className="row mt8" style={{ gap: 6 }}>
        {o.status === 'ready'
          ? <button className="btn sm primary" disabled={!photosOk} onClick={() => setVerify(true)}>
            {photosOk ? '核验取货码并交付' : '照片未齐，催裱花师上传'}
          </button>
          : <button className="btn sm" onClick={() => onOpen(o.id)}>详情</button>}
        {o.status === 'picked_up' && <span className="tiny" style={{ color: 'var(--ok)' }}>✓ {fmtDateTime(o.pickedUpAt)} 已签收</span>}
      </div>
      {verify && <VerifyModal o={o} onClose={() => setVerify(false)} onDone={() => { setVerify(false); openOrder(o.id) }} />}
    </div>
  )
}

function VerifyModal({ o, onClose, onDone }: { o: Order; onClose: () => void; onDone: () => void }) {
  const { act } = useStore()
  const [code, setCode] = useState('')
  const [signer, setSigner] = useState(o.customer.contactName)
  const due = o.price.total + o.fees.reduce((s, f) => s + f.amount, 0) - o.paidAmount
  return (
    <Modal title={`取货核验 · ${o.id}`} onClose={onClose}
      footer={<button className="btn primary" disabled={code.length !== 4} onClick={async () => {
        const r = await act(o.id, 'handoff', { code, signer })
        if (r) onDone()
      }}>核验通过并确认签收</button>}>
      <div className="kv">
        <span className="k">取货人</span><span className="v">{o.customer.contactName} · 手机尾号 {o.customer.phone.slice(-4)}</span>
        <span className="k">预定</span><span className="v">{fmtDate(o.pickupDate)} {o.slot}</span>
        <span className="k">蛋糕</span><span className="v">{catName(useStore.getState().boot!.catalog, 'sizes', o.cake.sizeId)} · 「{o.cake.inscription}」</span>
      </div>

      {due > 0
        ? <Notice kind="danger" title={`支付未结清：还差 ¥${due}`}>请先在 POS 完成收银（含费用调整产生的差价），再进行交付。</Notice>
        : <Notice kind="ok" title="支付状态正常">已结清，可交付。</Notice>}

      <div className="field mt12">
        <label>请顾客出示 4 位取货码</label>
        <input className="input" maxLength={4} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="短信/订单页中的 4 位数字" style={{ fontSize: 20, letterSpacing: 8, textAlign: 'center' }} />
        <div className="hint">核验方式：取货码 + 手机号尾号双重核对；码错误时系统拒绝交付。</div>
      </div>
      <div className="field"><label>签收人</label><input className="input" value={signer} onChange={e => setSigner(e.target.value)} /></div>
      <div className="small muted">签收后 {o.afterSalesHours} 小时售后窗口立即开始计算。</div>
    </Modal>
  )
}
