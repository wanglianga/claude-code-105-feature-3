import { useEffect, useState } from 'react'
import { useStore, catName, storeName } from '../../store'
import {
  Badge, Notice, Stepper, Modal,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, CASE_STATUS, fmtDateTime, fmtDate
} from '../../components/ui'
import type { Order, ServiceCase } from '../../../shared/types'
import AppealPanel from './AppealPanel'

const KIND_CN: Record<string, string> = {
  date_change: '临时改期', sensitive_inscription: '敏感题字', fruit_shortage: '原料缺货',
  fridge_capacity: '冷柜不足', store_transfer: '更换门店', after_sale: '售后申请'
}

export default function CSOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { boot, current, openOrder, act } = useStore()
  useEffect(() => { openOrder(id) }, [id])
  const [note, setNote] = useState('')
  if (!boot || !current) return null
  const { order: o } = current
  const cat = boot.catalog
  const total = o.price.total + o.fees.reduce((s, f) => s + f.amount, 0)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button className="btn sm" onClick={onBack}>← 工单台</button>
          <h2 className="pagename" style={{ margin: 0 }}>{o.id}</h2>
          <Badge kind={STATUS_STYLE[o.status]}>{STATUS_TEXT[o.status]}</Badge>
          <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        </div>
        <div className="row">
          {o.status === 'pending_accept' &&
            <button className="btn sm primary" onClick={() => act(o.id, 'cs_force_ready')}>协调资源后代接单</button>}
          <button className="btn sm" onClick={() => onBack()}>返回</button>
        </div>
      </div>

      <div className="card mt12"><Stepper status={o.status} /></div>

      <div className="grid cols-2 mt12">
        <div className="grid">
          <div className="card">
            <h3>📋 订单与顾客信息</h3>
            <div className="kv">
              <span className="k">取货门店</span><span className="v">{storeName(boot.stores, o.storeId)}</span>
              <span className="k">取货时间</span><span className="v">{fmtDate(o.pickupDate)} {o.slot}</span>
              <span className="k">最晚修改</span><span className="v">{fmtDateTime(o.latestModifyAt)}</span>
              <span className="k">联系人</span><span className="v">{o.customer.contactName} {o.customer.phone}</span>
              <span className="k">生日对象</span><span className="v">{o.customer.birthdayPerson.name}（{o.customer.birthdayPerson.relation}{o.customer.birthdayPerson.age ? `，${o.customer.birthdayPerson.age} 岁` : ''}）</span>
              <span className="k">发票</span><span className="v">{o.customer.invoice.needed ? `${o.customer.invoice.title} / ${o.customer.invoice.taxNo || '个人'}` : '不开票'}</span>
              <span className="k">冷链</span><span className="v">{o.cake.needColdChain ? '需要' : '不需要'}</span>
              <span className="k">金额</span><span className="v">原价 ¥{o.price.base + o.price.addons + o.price.coldChain} / 已付 ¥{o.paidAmount} / 当前应付 ¥{total}</span>
            </div>
            <div className="small mt8">🎂 {catName(cat, 'sizes', o.cake.sizeId)} · {catName(cat, 'bases', o.cake.baseId)} · {catName(cat, 'creams', o.cake.creamId)}</div>
            <div className="small">✍️ 题字：<b>{o.cake.inscription}</b> · {catName(cat, 'styles', o.cake.styleId)}</div>
            <div className="small">🍓 {o.cake.fruitIds.map(x => catName(cat, 'fruits', x)).join('、')}；规避：{o.cake.avoidAllergenIds.map(x => catName(cat, 'allergens', x)).join('、') || '无'}</div>
            {o.cake.styleRefPhoto && <img className="photo-thumb mt8" style={{ maxWidth: 240 }} src={o.cake.styleRefPhoto} />}
          </div>

          <div className="card">
            <h3>💸 费用调整流水（落回原订单）</h3>
            {o.fees.length === 0 ? <div className="small muted">暂无调整</div> : (
              <table className="table">
                <thead><tr><th>项目</th><th>原因</th><th style={{ textAlign: 'right' }}>金额</th></tr></thead>
                <tbody>
                  {o.fees.map(f => (
                    <tr key={f.id}>
                      <td className="small">{f.label}<div className="tiny muted">{fmtDateTime(f.at)} · {f.by}</div></td>
                      <td className="tiny muted">{f.reason}</td>
                      <td style={{ textAlign: 'right', color: f.amount < 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>{f.amount < 0 ? '-' : '+'}¥{Math.abs(f.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <h3>📁 工单（{o.cases.length}）</h3>
            {o.cases.length === 0 && <div className="small muted">暂无异常工单</div>}
            <div className="grid" style={{ gap: 10 }}>
              {o.cases.map(c => <CaseBlock key={c.id} o={o} c={c} />)}
            </div>
          </div>

          <div className="card">
            <h3>📝 客服内部备注（仅客服/门店可见动作）</h3>
            <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="电话沟通记录、补偿口径等，写入订单动态" />
            <button className="btn sm mt8" onClick={async () => { if (note.trim()) { await act(o.id, 'cs_note', { text: note }); setNote(''); openOrder(o.id) } }}>追加备注</button>
          </div>

          <div className="card">
            <h3>📜 订单全程动态</h3>
            <div className="timeline mt8" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {[...o.timeline].reverse().map(ev => (
                <div key={ev.id} className={`tl-item ${ev.actorRole}`}>
                  <div className="tl-who">{ev.actor}<span className="tl-at">{fmtDateTime(ev.at)}</span></div>
                  <div className="tl-text small">{ev.text}</div>
                  {ev.fields && <div className="tl-fields">{ev.fields.map((f, i) => <span key={i}>{f}</span>)}</div>}
                  {ev.amount != null && <div className="tiny" style={{ color: ev.amount < 0 ? 'var(--ok)' : 'var(--brand-dark)' }}>¥{Math.abs(ev.amount)}{ev.amount < 0 ? ' 退款' : ' 加收'}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 取货后造型申诉：对比下单参考、门店成品照、签收时间、运输方式 */}
      {o.appeals.length > 0 && (
        <div className="grid mt12" style={{ gap: 12 }}>
          {o.appeals.map(a => <AppealPanel key={a.id} o={o} a={a} />)}
        </div>
      )}
    </div>
  )
}

function CaseBlock({ o, c }: { o: Order; c: ServiceCase }) {
  const { act, openOrder } = useStore()
  const [propose, setPropose] = useState(false)
  return (
    <div className="card" style={{ padding: 12, borderLeft: ['open', 'awaiting_customer'].includes(c.status) ? '3px solid var(--danger)' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>{KIND_CN[c.kind]} · {fmtDateTime(c.raisedAt)}</b>
        <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge>
      </div>
      <div className="small mt8">{c.detail}</div>
      {c.proposal && <div className="small mt8" style={{ background: 'var(--cream)', borderRadius: 8, padding: 8 }}>
        方案：{c.proposal.desc}（{c.proposal.feeAdjust < 0 ? `退 ¥${-c.proposal.feeAdjust}` : c.proposal.feeAdjust > 0 ? `收 ¥${c.proposal.feeAdjust}` : '无费用调整'}）— {c.proposal.by}
      </div>}
      {c.customerNote && <div className="tiny mt8">顾客留言：{c.customerNote}</div>}
      {c.evidencePhoto && <img className="photo-thumb mt8" style={{ maxWidth: 200 }} src={c.evidencePhoto} />}
      <div className="row mt8" style={{ gap: 6 }}>
        {['open', 'awaiting_customer'].includes(c.status) && <button className="btn sm primary" onClick={() => setPropose(true)}>给出/修改方案</button>}
        {['resolved', 'rejected'].includes(c.status) &&
          <button className="btn sm" onClick={async () => act(o.id, 'cs_close', { caseId: c.id, note: '处理完成，归档' })}>归档</button>}
      </div>
      {propose && <QuickPropose o={o} c={c} onClose={() => setPropose(false)} onSent={() => { setPropose(false); openOrder(o.id) }} />}
    </div>
  )
}

function QuickPropose({ o, c, onClose, onSent }: { o: Order; c: ServiceCase; onClose: () => void; onSent: () => void }) {
  const { act } = useStore()
  const [desc, setDesc] = useState('')
  const [fee, setFee] = useState(0)
  const [newInscription, setNewInscription] = useState(o.cake.inscription)

  const send = async () => {
    const patch: Record<string, unknown> = {}
    if (c.kind === 'sensitive_inscription') patch['cake.inscription'] = newInscription
    if (c.kind === 'date_change') { /* 可在此快速改期，默认仅说明 */ }
    await act(o.id, 'cs_propose', {
      caseId: c.id,
      proposal: { desc, feeAdjust: Number(fee) || 0, ...(Object.keys(patch).length ? { patch } : {}) }
    })
    onSent()
  }

  return (
    <Modal title={`快速方案 · ${KIND_CN[c.kind]}`} onClose={onClose}
      footer={<button className="btn primary" disabled={!desc.trim()} onClick={send}>发送顾客确认</button>}>
      {c.kind === 'sensitive_inscription' && (
        <div className="field"><label>替代题字</label><input className="input" maxLength={22} value={newInscription} onChange={e => setNewInscription(e.target.value)} /></div>
      )}
      <div className="field"><label>说明</label><textarea className="input" rows={3} value={desc} onChange={e => setDesc(e.target.value)} /></div>
      <div className="field"><label>费用调整（负=退款）</label><input className="input" type="number" value={fee} onChange={e => setFee(Number(e.target.value))} /></div>
      <div className="tiny muted">复杂改期/换店/水果替代建议回到工单台使用专属方案模板。</div>
    </Modal>
  )
}
