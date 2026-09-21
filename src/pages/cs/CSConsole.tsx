import { useEffect, useMemo, useState } from 'react'
import { useStore, catName, storeName } from '../../store'
import {
  Badge, Notice, Modal, EmptyState,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, CASE_STATUS, fmtDateTime, fmtDate
} from '../../components/ui'
import type { Order, ServiceCase, CaseKind } from '../../../shared/types'
import AnalyticsView from './Analytics'

const CASE_ICON: Record<CaseKind, string> = {
  date_change: '📅', sensitive_inscription: '✍️', fruit_shortage: '🍓',
  fridge_capacity: '🧊', store_transfer: '🏪', after_sale: '🛟'
}
const KIND_NAME: Record<CaseKind, string> = {
  date_change: '临时改期', sensitive_inscription: '敏感题字', fruit_shortage: '原料缺货',
  fridge_capacity: '冷柜不足', store_transfer: '更换门店', after_sale: '售后申请'
}

export default function CSConsole({ onOpen }: { onOpen: (id: string) => void }) {
  const { orders, boot, refreshOrders, resetDemo, account } = useStore()
  const [tab, setTab] = useState<'cases' | 'orders' | 'analytics'>('cases')
  const [kindFilter, setKindFilter] = useState<string>('open')
  useEffect(() => { refreshOrders() }, [])

  const allCases = useMemo(() => orders.flatMap(o => o.cases.map(c => ({ o, c })))
    .sort((a, b) => a.c.raisedAt.localeCompare(b.c.raisedAt)), [orders])

  const visibleCases = allCases.filter(({ c }) =>
    kindFilter === 'all' ? true :
      kindFilter === 'open' ? ['open', 'awaiting_customer'].includes(c.status) :
      kindFilter === 'done' ? ['resolved', 'closed', 'rejected'].includes(c.status) :
      c.kind === kindFilter && ['open', 'awaiting_customer'].includes(c.status))

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="pagename">🛟 客服与督导后台</h2>
          <div className="pagesub">跨店视角：改期、退款、敏感题字、缺货替代、冷柜调度、换店与售后证据——每条处理都落回原订单，三端状态一致</div>
        </div>
        <button className="btn sm" onClick={() => { if (confirm('重置全部演示数据？')) resetDemo() }}>↺ 重置演示数据</button>
      </div>

      <div className="tabs">
        <button className={tab === 'cases' ? 'active' : ''} onClick={() => setTab('cases')}>
          异常工单 {allCases.filter(x => ['open', 'awaiting_customer'].includes(x.c.status)).length > 0 &&
            <Badge kind="red">{allCases.filter(x => ['open', 'awaiting_customer'].includes(x.c.status)).length}</Badge>}
        </button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>全部订单（{orders.length}）</button>
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>门店复盘看板</button>
      </div>

      {tab === 'cases' && (
        <>
          <div className="chips mt16">
            {[
              ['open', '待处理'], ['all', '全部'], ['date_change', '📅 改期'], ['sensitive_inscription', '✍️ 敏感题字'],
              ['fruit_shortage', '🍓 缺货'], ['fridge_capacity', '🧊 冷柜'], ['store_transfer', '🏪 换店'], ['after_sale', '🛟 售后'],
              ['done', '已归档']
            ].map(([k, label]) => (
              <button key={k} className={`chip ${kindFilter === k ? 'sel' : ''}`} onClick={() => setKindFilter(k)}>{label}</button>
            ))}
          </div>

          {visibleCases.length === 0 && <div className="mt16"><EmptyState icon="✨" title="当前筛选下没有工单" sub="门店报缺货、顾客申请改期或发起售后后会出现在这里" /></div>}
          <div className="grid cols-2 mt12">
            {visibleCases.map(({ o, c }) => <CaseCard key={c.id} o={o} c={c} onOpen={onOpen} />)}
          </div>
        </>
      )}

      {tab === 'orders' && (
        <div className="card mt16">
          <table className="table">
            <thead>
              <tr><th>订单</th><th>门店</th><th>取货</th><th>顾客</th><th>状态</th><th>支付</th><th>工单</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td><b>{o.id}</b><div className="tiny muted">{catName(boot!.catalog, 'styles', o.cake.styleId)} · 「{o.cake.inscription}」</div></td>
                  <td>{storeName(boot!.stores, o.storeId)}</td>
                  <td>{fmtDate(o.pickupDate)}<div className="tiny muted">{o.slot}</div></td>
                  <td>{o.customer.contactName}<div className="tiny muted">{o.customer.phone}</div></td>
                  <td><Badge kind={STATUS_STYLE[o.status]}>{STATUS_TEXT[o.status]}</Badge></td>
                  <td><Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge></td>
                  <td>{o.cases.length ? <Badge kind={o.cases.some(c => ['open', 'awaiting_customer'].includes(c.status)) ? 'red' : 'gray'}>{o.cases.length} 条</Badge> : '—'}</td>
                  <td><button className="btn sm" onClick={() => onOpen(o.id)}>打开</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'analytics' && <AnalyticsView />}
    </div>
  )
}

function CaseCard({ o, c, onOpen }: { o: Order; c: ServiceCase; onOpen: (id: string) => void }) {
  const [propose, setPropose] = useState(false)
  const [detail, setDetail] = useState(false)
  const { act } = useStore()
  const active = ['open', 'awaiting_customer'].includes(c.status)
  return (
    <div className="card" style={{ borderLeft: active ? '3px solid var(--danger)' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>{CASE_ICON[c.kind]} {KIND_NAME[c.kind]}</h3>
        <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge>
      </div>
      <button className="btn sm ghost mt8" style={{ padding: 0 }} onClick={() => onOpen(o.id)}>
        订单 {o.id} · {storeName(useStore.getState().boot!.stores, o.storeId)} · {fmtDate(o.pickupDate)} {o.slot}
      </button>
      <div className="small mt8">{c.title}</div>
      <div className="tiny muted mt8 line-clamp">{c.detail}</div>
      {c.proposal && (
        <div className="small mt8" style={{ background: 'var(--cream)', borderRadius: 8, padding: 8 }}>
          已发方案：{c.proposal.desc}
          {c.proposal.feeAdjust !== 0 && <b style={{ color: c.proposal.feeAdjust < 0 ? 'var(--ok)' : 'var(--danger)' }}>
            （{c.proposal.feeAdjust < 0 ? `退 ¥${-c.proposal.feeAdjust}` : `收 ¥${c.proposal.feeAdjust}`}）
          </b>}
        </div>
      )}
      {c.status === 'resolved' && c.resolvedBy && <div className="tiny muted mt8">✓ 顾客 {fmtDateTime(c.resolvedAt!)} 确认，{c.resolvedBy} 经办</div>}
      <div className="row mt12" style={{ gap: 6 }}>
        {active && <>
          <button className="btn sm primary" onClick={() => setPropose(true)}>{c.status === 'awaiting_customer' ? '修改方案' : '给出处理方案'}</button>
          {c.kind === 'after_sale' || c.kind === 'fruit_shortage' ?
            <button className="btn sm danger" onClick={async () => {
              const note = prompt('驳回原因（将告知顾客）')
              if (note) act(o.id, 'cs_reject', { caseId: c.id, note })
            }}>驳回</button> : null}
        </>}
        {['resolved', 'rejected'].includes(c.status) &&
          <button className="btn sm" onClick={async () => {
            const note = prompt('关闭备注') || '处理完成，归档'
            act(o.id, 'cs_close', { caseId: c.id, note })
          }}>归档关闭</button>}
        <button className="btn sm ghost" onClick={() => setDetail(true)}>证据/详情</button>
      </div>
      {propose && <ProposeModal o={o} c={c} onClose={() => setPropose(false)} />}
      {detail && <CaseEvidence o={o} c={c} onClose={() => setDetail(false)} />}
    </div>
  )
}

// ---------- 客服方案弹窗（按工单类型生成补丁与费用）----------
function ProposeModal({ o, c, onClose }: { o: Order; c: ServiceCase; onClose: () => void }) {
  const { boot, act, openOrder } = useStore()
  const cat = boot!.catalog
  const [desc, setDesc] = useState(presetDesc(c.kind))
  const [feeAdjust, setFeeAdjust] = useState(0)
  const [newDate, setNewDate] = useState(o.pickupDate)
  const [newSlot, setNewSlot] = useState(o.slot)
  const [newStore, setNewStore] = useState(o.storeId === 'st_hd' ? 'st_cx' : 'st_hd')
  const [newInscription, setNewInscription] = useState(o.cake.inscription)
  const [swapFruit, setSwapFruit] = useState(o.cake.fruitIds.includes('strawberry') ? 'blueberry' : o.cake.fruitIds[0] || 'blueberry')
  const [refundOnly, setRefundOnly] = useState(false)

  const build = (): { proposal: { desc: string; feeAdjust: number; patch?: Record<string, unknown> } } => {
    let patch: Record<string, unknown> | undefined
    if (c.kind === 'date_change') {
      patch = { pickupDate: newDate, slot: newSlot }
    } else if (c.kind === 'sensitive_inscription') {
      patch = { 'cake.inscription': newInscription }
    } else if (c.kind === 'fruit_shortage') {
      if (!refundOnly) {
        const next = Array.from(new Set(o.cake.fruitIds.map(f => f === (c.materialId || 'strawberry') ? swapFruit : f)))
        patch = { 'cake.fruitIds': next }
      }
    } else if (c.kind === 'fridge_capacity') {
      patch = { slot: newSlot }
    } else if (c.kind === 'store_transfer') {
      patch = { storeId: newStore, pickupDate: newDate, slot: newSlot }
    }
    return { proposal: { desc, feeAdjust: Number(feeAdjust) || 0, patch } }
  }

  return (
    <Modal title={`处理方案 · ${KIND_NAME[c.kind]}（${o.id}）`} onClose={onClose} wide
      footer={<>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={async () => {
          if (!desc.trim()) return alert('请填写方案说明')
          const r = await act(o.id, 'cs_propose', { caseId: c.id, ...build() })
          if (r) { onClose(); openOrder(o.id) }
        }}>发送给顾客确认</button>
      </>}>
      <Notice kind="info" title="处理原则">方案（含费用调整）必须经顾客在订单页确认后才会写回原订单；退款记录原路退回，加收项标记待补差并联动前台收银。</Notice>

      {c.kind === 'date_change' && (
        <div className="inline-fields mt12">
          <div className="field"><label>协调后的日期</label><input type="date" className="input" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <div className="field"><label>时段</label><select className="input" value={newSlot} onChange={e => setNewSlot(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
      )}
      {c.kind === 'fridge_capacity' && (
        <div className="field mt12"><label>建议错峰时段（仍在原店）</label>
          <select className="input" value={newSlot} onChange={e => setNewSlot(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select>
        </div>
      )}
      {c.kind === 'store_transfer' && (
        <div className="inline-fields mt12">
          <div className="field"><label>转入门店</label>
            <select className="input" value={newStore} onChange={e => setNewStore(e.target.value)}>
              {boot!.stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.coldChainAvailable ? '' : '（不支持冷链）'}</option>)}
            </select>
          </div>
          <div className="field"><label>日期</label><input type="date" className="input" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <div className="field"><label>时段</label><select className="input" value={newSlot} onChange={e => setNewSlot(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
      )}
      {c.kind === 'sensitive_inscription' && (
        <div className="field mt12">
          <label>建议替代题字（顾客确认后替换，门店据此制作）</label>
          <input className="input" maxLength={22} value={newInscription} onChange={e => setNewInscription(e.target.value)} />
          <div className="hint">原题字「{o.cake.inscription}」命中审核规则；替代文案不得再含敏感词。</div>
        </div>
      )}
      {c.kind === 'fruit_shortage' && (
        <div className="field mt12">
          <label>处理方式</label>
          <div className="chips">
            <button className={`chip ${!refundOnly ? 'sel' : ''}`} onClick={() => setRefundOnly(false)}>等价水果替代</button>
            <button className={`chip ${refundOnly ? 'sel' : ''}`} onClick={() => setRefundOnly(true)}>不替代，退还加价</button>
          </div>
          {!refundOnly && (
            <select className="input mt8" value={swapFruit} onChange={e => setSwapFruit(e.target.value)}>
              {cat.fruits.filter(f => f.id !== 'none_fruit').map(f => <option key={f.id} value={f.id}>{f.name}（+¥{f.price}）</option>)}
            </select>
          )}
        </div>
      )}
      {c.kind === 'after_sale' && (
        <div className="field mt12">
          <label>售后补偿（负数为退款）</label>
          <div className="chips">
            {[0, -20, -50, -100, -o.price.total].map(v => (
              <button key={v} className={`chip ${feeAdjust === v ? 'sel' : ''}`} onClick={() => setFeeAdjust(v)}>
                {v === 0 ? '仅致歉' : v === -o.price.total ? '全额退款' : `退 ¥${-v}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field mt12">
        <label>给顾客的方案说明（将显示在订单页）</label>
        <textarea className="input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
      </div>

      {c.kind !== 'after_sale' && (
        <div className="inline-fields">
          <div className="field">
            <label>费用调整（元，负数=退还）</label>
            <input className="input" type="number" value={feeAdjust} onChange={e => setFeeAdjust(Number(e.target.value))} />
            <div className="hint">如改期服务费、跨店调货费、缺货退还；0 表示不调整。</div>
          </div>
        </div>
      )}

      <div className="tiny muted">确认后订单版本号递增，裱花看板、前台收银、顾客进度同步刷新。</div>
    </Modal>
  )
}

function presetDesc(kind: CaseKind) {
  return {
    date_change: '已与门店核对排班与原料，可以为您改期；请确认新的取货日期与时段。',
    sensitive_inscription: '原题字含平台受限内容，建议使用右侧合规替代文案，口味造型均不受影响，确认后门店立即制作。',
    fruit_shortage: '非常抱歉，该水果今日批次品质不达标，建议替换为等价水果（或退还对应加价），确认后门店据此备料。',
    fridge_capacity: '当日冷柜接近满载，为保证动物奶油品质，建议您错峰到邻近时段取货，门店会提前做好并独立冷藏。',
    store_transfer: '已与两家门店确认冷柜与排班，可以为您转店取货；跨店调货费用请见下方调整项。',
    after_sale: '非常抱歉影响了生日体验。我们已核对成品照片与您提供的证据，提出如下补偿方案。'
  }[kind]
}

function CaseEvidence({ o, c, onClose }: { o: Order; c: ServiceCase; onClose: () => void }) {
  return (
    <Modal title={`${KIND_NAME[c.kind]} 证据链 · ${o.id}`} onClose={onClose} wide>
      <div className="grid cols-2">
        <div>
          <div className="kv">
            <span className="k">工单状态</span><span className="v"><Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge></span>
            <span className="k">发起人</span><span className="v">{c.raisedBy} · {fmtDateTime(c.raisedAt)}</span>
            <span className="k">详情</span><span className="v">{c.detail}</span>
            {c.customerNote && <><span className="k">顾客留言</span><span className="v">{c.customerNote}</span></>}
            {c.resolution && <><span className="k">最终方案</span><span className="v">{c.resolution}</span></>}
            {c.refundAmount ? <><span className="k">累计退款</span><span className="v" style={{ color: 'var(--ok)' }}>¥{c.refundAmount}</span></> : null}
          </div>
          <div className="mt12">
            <h3>订单交付照片</h3>
            <div className="grid cols-3 mt8">
              <EvidenceImg v={o.photos.final} label="成品" />
              <EvidenceImg v={o.photos.package} label="包装" />
              <EvidenceImg v={o.photos.coldNotice} label="冷藏提示" />
            </div>
          </div>
        </div>
        <div>
          {c.evidencePhoto && <>
            <h3>顾客提交的售后证据</h3>
            <img className="photo-thumb mt8" src={c.evidencePhoto} alt="售后证据" />
          </>}
          <h3 className="mt12">订单动态摘录</h3>
          <div className="timeline mt8" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {[...o.timeline].reverse().slice(0, 12).map(ev => (
              <div key={ev.id} className={`tl-item ${ev.actorRole}`}>
                <div className="tl-who">{ev.actor}<span className="tl-at">{fmtDateTime(ev.at)}</span></div>
                <div className="tl-text small">{ev.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function EvidenceImg({ v, label }: { v?: string; label: string }) {
  const [big, setBig] = useState(false)
  return (
    <div>
      {v ? <img className="photo-thumb" src={v} style={{ cursor: 'zoom-in' }} onClick={() => setBig(true)} />
        : <div className="photo-thumb" style={{ display: 'grid', placeItems: 'center' }}><span className="tiny muted">无</span></div>}
      <div className="tiny muted" style={{ textAlign: 'center' }}>{label}</div>
      {big && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={v} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </div>
  )
}
