import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { api } from '../../api'
import type { CapacityInfo } from '../../api'
import { Badge, Notice, Modal, fmtDateTime, fmtDate } from '../../components/ui'
import {
  APPEAL_ISSUE_LABEL, APPEAL_RESPONSIBILITY_LABEL, APPEAL_VERDICT_LABEL,
  APPEAL_STATUS_LABEL, TRANSPORT_ISSUES
} from '../../../shared/types'
import type { Order, StyleAppeal, AppealResponsibility, AppealVerdict } from '../../../shared/types'

const RESP: AppealResponsibility[] = ['store', 'transport_store', 'transport_customer', 'none']
const RESP_DESC: Record<AppealResponsibility, string> = {
  store: '出品造型/题字/配色与下单要求不符，门店制作环节责任',
  transport_store: '门店配送或冷链包装不当（断链/封签破损）导致运输变形',
  transport_customer: '顾客自提途中保管不当（常温久置/倾倒/未按冷藏提示）',
  none: '证据不足或出品与要求一致，申诉不成立'
}

export default function AppealPanel({ o, a }: { o: Order; a: StyleAppeal }) {
  const { act, openOrder, boot } = useStore()
  const [decide, setDecide] = useState(false)
  const st = APPEAL_STATUS_LABEL[a.status]
  const transport = TRANSPORT_ISSUES.includes(a.issueType)

  return (
    <div className="card" style={{ borderLeft: a.status === 'open' ? '3px solid var(--danger)' : '3px solid var(--ok)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>🛟 取货后造型申诉 · {APPEAL_ISSUE_LABEL[a.issueType]}</h3>
        <Badge kind={st.c}>{st.t}</Badge>
      </div>
      <div className="tiny muted mt8">{a.id} · {a.raisedBy} 提交于 {fmtDateTime(a.raisedAt)} · {a.foundWhen}发现</div>

      {/* 四要素对比 */}
      <div className="grid cols-3 mt12" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Zoom label="① 下单参考图" v={a.styleRefPhoto} fallback="无参考图（以造型备注为准）" />
        <Zoom label="② 门店成品照" v={a.storeFinalPhoto} fallback="成品照缺失" />
        <Zoom label="③ 顾客取货后证据" v={a.evidencePhoto} fallback="证据缺失" />
      </div>
      <div className="chips mt8">
        <span className="chip sel">签收时间：{a.pickedUpAt ? fmtDateTime(a.pickedUpAt) : '—'}</span>
        <span className="chip sel">{a.needColdChain ? '❄️ 冷藏自提' : '🚶 常温自提'}</span>
        <span className="chip sel">{a.deliveryMethod}</span>
      </div>

      <div className="small mt8"><b>顾客说明：</b>{a.detail}</div>

      {a.status === 'open' ? (
        <>
          {transport && <Notice kind="warn" title="本单为运输造成变形">必须在「门店运输责任」与「顾客自提责任」之间判定；自提责任成立时门店拒绝赔付。</Notice>}
          <div className="row mt12">
            <button className="btn sm primary" onClick={() => setDecide(true)}>给出判定</button>
          </div>
        </>
      ) : (
        <div className="card mt12" style={{ background: 'var(--cream)' }}>
          <div className="kv">
            <span className="k">责任判定</span><span className="v">{a.responsibility && APPEAL_RESPONSIBILITY_LABEL[a.responsibility]}</span>
            <span className="k">处理结论</span><span className="v">{a.verdict && APPEAL_VERDICT_LABEL[a.verdict]}</span>
            <span className="k">经办</span><span className="v">{a.decidedBy} · {fmtDateTime(a.decidedAt)}</span>
            {a.refundAmount ? <><span className="k">退款</span><span className="v" style={{ color: 'var(--ok)' }}>¥{a.refundAmount} 已原路退回</span></> : null}
          </div>
          <div className="small mt8">{a.decisionNote}</div>
          {a.coupon && <div className="small mt8" style={{ color: 'var(--ok)' }}>🎟️ 优惠券 ¥{a.coupon.amount} 已入账（{a.coupon.reason}）</div>}
          {a.remake && (
            <div className="small mt8">
              🔁 补做排班：<b>{fmtDate(a.remake.pickupDate)} {a.remake.slot}</b> · 新取货码 <b>{a.remake.renewedCode}</b>
              {a.remake.pickedUpAt ? ` · 已于 ${fmtDateTime(a.remake.pickedUpAt)} 补做签收` : ' · 等待门店制作交付'}
            </div>
          )}
          <div className="row mt8">
            {a.status === 'decided' && <button className="btn sm" onClick={async () => act(o.id, 'cs_close_appeal', { appealId: a.id, note: '处理完成，归档' })}>归档</button>}
            <button className="btn sm ghost" onClick={() => openOrder(o.id)}>刷新</button>
            <span className="tiny muted">门店造型质量统计已计入该结论</span>
          </div>
        </div>
      )}

      {decide && <DecideModal o={o} a={a} onClose={() => setDecide(false)} onSent={() => { setDecide(false); openOrder(o.id) }} />}
    </div>
  )
}

function Zoom({ label, v, fallback }: { label: string; v?: string; fallback: string }) {
  const [big, setBig] = useState(false)
  return (
    <div>
      <div className="tiny muted mb8">{label}</div>
      {v
        ? <img className="photo-thumb" src={v} style={{ cursor: 'zoom-in' }} onClick={() => setBig(true)} />
        : <div className="photo-thumb" style={{ display: 'grid', placeItems: 'center' }}><span className="tiny muted">{fallback}</span></div>}
      {big && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={v} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </div>
  )
}

function DecideModal({ o, a, onClose, onSent }: { o: Order; a: StyleAppeal; onClose: () => void; onSent: () => void }) {
  const { boot, act } = useStore()
  const cat = boot!.catalog
  const transport = TRANSPORT_ISSUES.includes(a.issueType)
  const [responsibility, setResponsibility] = useState<AppealResponsibility>(transport ? 'transport_store' : 'store')
  const [verdict, setVerdict] = useState<AppealVerdict>('refund')
  const [note, setNote] = useState('')
  const [refundAmount, setRefundAmount] = useState(Math.round(o.paidAmount / 2) || 50)
  const [couponAmount, setCouponAmount] = useState(30)
  const [pickupDate, setPickupDate] = useState(addDays(2))
  const [slot, setSlot] = useState(cat.slots[2] || cat.slots[0])
  const [cap, setCap] = useState<CapacityInfo | null>(null)

  useEffect(() => {
    let alive = true
    api.capacity(o.storeId, pickupDate).then(c => { if (alive) setCap(c) }).catch(() => {})
    return () => { alive = false }
  }, [o.storeId, pickupDate])

  // 责任约束：顾客自提/无门店责任只能拒绝
  const customerSide = responsibility === 'transport_customer' || responsibility === 'none'
  const effectiveVerdict: AppealVerdict = customerSide ? 'reject' : verdict

  const slotCell = cap?.slots.find(s => s.slot === slot)
  const fridgeFull = cap ? cap.fridgeUsed >= cap.fridgeCapacity : false
  const overCapacity = slotCell ? slotCell.used >= slotCell.capacity : false

  const send = async () => {
    const decision: Record<string, unknown> = { verdict: effectiveVerdict, responsibility, note }
    if (effectiveVerdict === 'refund') decision.refundAmount = refundAmount
    if (effectiveVerdict === 'coupon') decision.couponAmount = couponAmount
    if (effectiveVerdict === 'remake') { decision.pickupDate = pickupDate; decision.slot = slot }
    const r = await act(o.id, 'cs_decide_appeal', { appealId: a.id, decision })
    if (r) onSent()
  }

  return (
    <Modal title={`造型申诉判定 · ${o.id}`} onClose={onClose} wide
      footer={<button className="btn primary" disabled={!note.trim()} onClick={send}>确认判定并执行</button>}>
      <Notice kind="info" title="判定口径">对比四要素后先判责任，再选结论。退款会原路退回并联动支付状态；补做会重新生成制作排班与取货码并推回门店看板；优惠券立即进入顾客账户并关联本申诉原因；拒绝赔付不计门店质量责任。</Notice>

      <div className="field mt12">
        <label>责任归属{transport ? '（运输变形：仅可选门店运输 / 顾客自提）' : ''}</label>
        <div className="chips">
          {RESP.filter(r => transport ? ['transport_store', 'transport_customer'].includes(r) : true).map(r => (
            <button key={r} className={`chip ${responsibility === r ? 'sel' : ''}`} onClick={() => setResponsibility(r)}>
              {APPEAL_RESPONSIBILITY_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="tiny muted mt8">{RESP_DESC[responsibility]}</div>
      </div>

      {!customerSide ? (
        <div className="field">
          <label>处理结论</label>
          <div className="chips">
            {(['refund', 'remake', 'coupon'] as AppealVerdict[]).map(v => (
              <button key={v} className={`chip ${verdict === v ? 'sel' : ''}`} onClick={() => setVerdict(v)}>{APPEAL_VERDICT_LABEL[v]}</button>
            ))}
            <button className={`chip ${verdict === 'reject' ? 'sel' : ''}`} onClick={() => setVerdict('reject')}>{APPEAL_VERDICT_LABEL.reject}</button>
          </div>
        </div>
      ) : (
        <Notice kind="warn" title={`${APPEAL_RESPONSIBILITY_LABEL[responsibility]} → 只能拒绝赔付`}>该责任口径下门店不承担赔付，系统已锁定结论为「拒绝赔付」。</Notice>
      )}

      {effectiveVerdict === 'refund' && (
        <div className="field">
          <label>退款金额（本单已付 ¥{o.paidAmount}，余额上限 ¥{o.paidAmount}）</label>
          <div className="chips">
            {[30, 50, 100, o.paidAmount].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map(v => (
              <button key={v} className={`chip ${refundAmount === v ? 'sel' : ''}`} onClick={() => setRefundAmount(v)}>{v === o.paidAmount ? '全额退款' : `¥${v}`}</button>
            ))}
          </div>
          <input className="input mt8" type="number" min={1} max={o.paidAmount} value={refundAmount} onChange={e => setRefundAmount(Number(e.target.value))} />
        </div>
      )}

      {effectiveVerdict === 'coupon' && (
        <div className="field">
          <label>优惠券面额（进入顾客账户，自动关联本次申诉原因）</label>
          <div className="chips">
            {[20, 30, 50, 100].map(v => (
              <button key={v} className={`chip ${couponAmount === v ? 'sel' : ''}`} onClick={() => setCouponAmount(v)}>¥{v}</button>
            ))}
          </div>
          <input className="input mt8" type="number" min={1} value={couponAmount} onChange={e => setCouponAmount(Number(e.target.value))} />
          <div className="hint">券有效期 90 天，顾客在顶部「我的优惠券」可见，来源标注「{APPEAL_ISSUE_LABEL[a.issueType]}」与订单号。</div>
        </div>
      )}

      {effectiveVerdict === 'remake' && (
        <div className="field">
          <label>与顾客约定的补做取货时间（将重新生成制作排班与取货码）</label>
          <div className="inline-fields">
            <input className="input" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
            <select className="input" value={slot} onChange={e => setSlot(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="hint mt8">
            建议开制：取货前 2 小时；该时段当前 {slotCell ? `${slotCell.used}/${slotCell.capacity} 单` : '—'}
            {overCapacity ? <b style={{ color: 'var(--danger)' }}>（时段已约满，建议更换）</b> : <span style={{ color: 'var(--ok)' }}>（可承接）</span>}
            ；当日冷柜 {cap ? `${cap.fridgeUsed}/${cap.fridgeCapacity} 标位` : '—'}
            {fridgeFull && <b style={{ color: 'var(--danger)' }}>（冷柜已满，提交会被拦截，请协调）</b>}
            ；系统会同时校验当日冷柜容量，原定制要求不变，门店需重新上传成品/包装照片。
          </div>
        </div>
      )}

      <div className="field">
        <label>判定说明（同步给顾客，并计入门店造型质量统计）</label>
        <textarea className="input" rows={3} value={note} onChange={e => setNote(note)}
          placeholder={effectiveVerdict === 'reject'
            ? '说明为何不构成门店责任（成品照/封签/冷藏提示履行情况、自提经过）'
            : '说明门店责任点、致歉与补偿/补做安排'} />
      </div>
    </Modal>
  )
}

function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
