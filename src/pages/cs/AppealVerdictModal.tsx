import { useState } from 'react'
import { useStore, catName } from '../../store'
import { Badge, Notice, Modal, fmtDateTime } from '../../components/ui'
import {
  APPEAL_VERDICT_LABEL, APPEAL_REASON_LABEL, RESPONSIBILITY_LABEL
} from '../../../shared/types'
import type { Order, ServiceCase, AppealVerdict, AppealResponsibility } from '../../../shared/types'

function tomorrowPlus(n = 1) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function AppealVerdictModal(
  { o, c, onClose }: { o: Order; c: ServiceCase; onClose: () => void }
) {
  const { boot, act, openOrder } = useStore()
  const cat = boot!.catalog
  const [verdict, setVerdict] = useState<AppealVerdict>('refund')
  const [responsibility, setResponsibility] = useState<AppealResponsibility>(
    c.reasonCode === 'transport_deformation' ? 'self_pickup' : 'store')
  const [transportDeformation, setTransportDeformation] = useState(c.reasonCode === 'transport_deformation')
  const [note, setNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [refundAmount, setRefundAmount] = useState(o.paidAmount)
  const [couponAmount, setCouponAmount] = useState(50)
  const [remakeDate, setRemakeDate] = useState(tomorrowPlus(1))
  const [remakeSlot, setRemakeSlot] = useState(o.slot)

  const reasonLabel = c.reasonCode ? APPEAL_REASON_LABEL[c.reasonCode] : '造型问题'
  const transport = c.transportMode === 'cold_chain' ? '冷链保温袋自提' : '常温自提'

  const submit = async () => {
    if (!note.trim()) return alert('请填写判定说明（将告知顾客）')
    if (verdict === 'refund' && refundAmount <= 0) return alert('退款金额需大于 0')
    if (verdict === 'coupon' && couponAmount <= 0) return alert('优惠券面额需大于 0')
    const r = await act(o.id, 'after_sale_verdict', {
      caseId: c.id, verdict, responsibility, transportDeformation, note, internalNote,
      refundAmount, couponAmount, remakeDate, remakeSlot
    })
    if (r) { onClose(); openOrder(o.id) }
  }

  return (
    <Modal wide title={`🛟 取货后造型申诉判定 · ${o.id}`} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={submit}>提交判定并落回订单</button>
      </>}>

      {/* 证据对比：下单参考 / 门店成品照 / 顾客证据 */}
      <div className="card" style={{ background: 'var(--cream)' }}>
        <h3 style={{ marginTop: 0 }}>🔍 证据并排比对</h3>
        <div className="grid cols-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <ComparePhoto title="① 下单参考图" sub={`${catName(cat, 'styles', o.cake.styleId)}${o.cake.styleRefPhoto ? '' : '（顾客未传，以造型备注/题字为准）'}`}>
            {o.cake.styleRefPhoto
              ? <CmpImg src={o.cake.styleRefPhoto} />
              : <div className="cmp-empty">造型：{catName(cat, 'styles', o.cake.styleId)}<br />备注：{o.cake.styleNote || '无'}</div>}
          </ComparePhoto>
          <ComparePhoto title="② 门店成品照" sub="交付前裱花师上传">
            {o.photos.final ? <CmpImg src={o.photos.final} /> : <div className="cmp-empty">⚠ 门店未上传成品照</div>}
          </ComparePhoto>
          <ComparePhoto title="③ 顾客取货后照片" sub="本次申诉证据（必传）" highlight>
            {c.evidencePhoto ? <CmpImg src={c.evidencePhoto} /> : <div className="cmp-empty">未上传</div>}
          </ComparePhoto>
        </div>
        <div className="grid cols-2 mt12">
          <div className="kv" style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
            <span className="k">签收时间</span><span className="v">{c.signedAt ? fmtDateTime(c.signedAt) : fmtDateTime(o.pickedUpAt)}</span>
            <span className="k">申诉发起</span><span className="v">{fmtDateTime(c.raisedAt)}（售后 {o.afterSalesHours}h 窗口内）</span>
            <span className="k">取货时段</span><span className="v">{o.slot}</span>
          </div>
          <div className="kv" style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
            <span className="k">运输方式</span>
            <span className="v"><Badge kind={c.transportMode === 'cold_chain' ? 'blue' : 'orange'}>{transport}</Badge></span>
            <span className="k">顾客自述离店运输</span><span className="v">{c.transportNote || '未填写'}</span>
            <span className="k">包装/冷藏</span>
            <span className="v">{o.photos.package ? '包装照已留' : '无包装照'} · {o.cake.needColdChain ? (o.photos.coldNotice ? '冷藏提示已留' : '⚠ 缺冷藏提示') : '常温款'}</span>
          </div>
        </div>
        <div className="small mt12"><b>申诉原因：</b>{reasonTag(c)}；<b>顾客说明：</b>{c.detail}</div>
        {o.reworks.length > 0 && (
          <div className="tiny mt8" style={{ color: 'var(--warn)' }}>
            ⚠ 本单制作期已有 {o.reworks.length} 次返工：{o.reworks.map(r => r.reason).join('、')}（可作为造型质量判定参考）
          </div>
        )}
      </div>

      {/* 责任判定（运输变形时区分门店 / 自提） */}
      <div className="field mt12">
        <label>责任归属判定</label>
        <div className="chips">
          <button className={`chip ${responsibility === 'store' ? 'sel' : ''}`} onClick={() => setResponsibility('store')}>
            🏪 门店责任（造型 / 题字 / 包装 / 冷链交付）
          </button>
          <button className={`chip ${responsibility === 'self_pickup' ? 'sel' : ''}`} onClick={() => setResponsibility('self_pickup')}>
            🚶 顾客自提责任（离店运输 / 存放不当）
          </button>
        </div>
        <label className="check-row mt8">
          <input type="checkbox" checked={transportDeformation} onChange={e => setTransportDeformation(e.target.checked)} />
          <span className="small">变形发生在<b>离开门店后的运输环节</b>（勾选后需在门店责任与顾客自提责任间明确区分，统计将分别计入）</span>
        </label>
        {transportDeformation && (
          <Notice kind={responsibility === 'self_pickup' ? 'warn' : 'danger'}
            title={responsibility === 'self_pickup' ? '当前判定：顾客自提运输责任' : '当前判定：门店交付责任'}>
            {responsibility === 'self_pickup'
              ? '门店成品照/包装/冷藏提示齐全且离店时造型完好，变形由自提运输（高温、颠簸、久置）导致：通常拒绝赔付或仅给关怀券，不计门店造型缺陷。'
              : '虽发生在运输环节，但门店存在包装不当、未交付冷链袋、未给冷藏提示等过错：判定门店责任，可退款/补做/发券。'}
          </Notice>
        )}
      </div>

      {/* 四种结论 */}
      <div className="field">
        <label>判定结论</label>
        <div className="chips">
          {(['refund', 'remake', 'coupon', 'reject'] as AppealVerdict[]).map(v => (
            <button key={v} className={`chip ${verdict === v ? 'sel' : ''}`} onClick={() => setVerdict(v)}>
              {v === 'refund' ? '💸 ' : v === 'remake' ? '🎂 ' : v === 'coupon' ? '🎟️ ' : '🚫 '}
              {APPEAL_VERDICT_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {verdict === 'refund' && (
        <div className="field">
          <label>退款金额（实付 ¥{o.paidAmount}，原路退回）</label>
          <div className="chips">
            {[50, 100, o.paidAmount].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i).map(v => (
              <button key={v} className={`chip ${refundAmount === v ? 'sel' : ''}`} onClick={() => setRefundAmount(v)}>
                {v === o.paidAmount ? '全额退款' : `退 ¥${v}`}
              </button>
            ))}
          </div>
          <input className="input mt8" type="number" min={1} max={o.paidAmount} value={refundAmount}
            onChange={e => setRefundAmount(Number(e.target.value))} />
        </div>
      )}

      {verdict === 'remake' && (
        <div className="field">
          <Notice kind="info" title="补做将重新生成制作排班与取货时间">
            系统按新取货时间自动排定制作开始（取货时段前 2 小时），裱花师看板出现「售后补做单」，前台按新时间交付；原单费用不变、免费补做。
          </Notice>
          <div className="inline-fields mt8">
            <div className="field"><label>补做取货日期</label>
              <input className="input" type="date" min={tomorrowPlus(1)} value={remakeDate} onChange={e => setRemakeDate(e.target.value)} /></div>
            <div className="field"><label>取货时段</label>
              <select className="input" value={remakeSlot} onChange={e => setRemakeSlot(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
        </div>
      )}

      {verdict === 'coupon' && (
        <div className="field">
          <label>优惠券面额（自动进入顾客账户，关联本次申诉原因）</label>
          <div className="chips">
            {[20, 50, 100].map(v => (
              <button key={v} className={`chip ${couponAmount === v ? 'sel' : ''}`} onClick={() => setCouponAmount(v)}>¥{v}</button>
            ))}
          </div>
          <input className="input mt8" type="number" min={1} value={couponAmount} onChange={e => setCouponAmount(Number(e.target.value))} />
          <div className="tiny muted mt8">发放后在顾客「优惠券账户」可见，券面关联原因「{reasonLabel}」与订单 {o.id}，有效期 90 天。</div>
        </div>
      )}

      {verdict === 'reject' && (
        <Notice kind="warn" title="拒绝赔付">请在说明中给出证据依据（如成品照与冷藏提示齐全、变形发生在离店后自提环节），结论仍会计入门店造型质量统计。</Notice>
      )}

      <div className="field">
        <label>给顾客的判定说明</label>
        <textarea className="input" rows={3} value={note}
          placeholder="说明证据比对结果、责任归属与处理方式；将展示在顾客订单页" onChange={e => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label>内部备注（仅客服/门店可见，可选）</label>
        <textarea className="input" rows={2} value={internalNote} onChange={e => setInternalNote(e.target.value)} />
      </div>
    </Modal>
  )
}

function reasonTag(c: ServiceCase) {
  if (!c.reasonCode) return '—'
  return APPEAL_REASON_LABEL[c.reasonCode]
}

function ComparePhoto({ title, sub, highlight, children }: {
  title: string; sub: string; highlight?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="small" style={{ fontWeight: 800 }}>{title}</div>
      <div className="tiny muted">{sub}</div>
      <div style={{
        marginTop: 6, borderRadius: 10, overflow: 'hidden', border: highlight ? '2px solid var(--danger)' : '2px solid var(--line)',
        background: '#fff', aspectRatio: '4 / 3', display: 'grid', placeItems: 'center'
      }}>{children}</div>
    </div>
  )
}

function CmpImg({ src }: { src: string }) {
  const [big, setBig] = useState(false)
  return (
    <>
      <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
        onClick={() => setBig(true)} alt="证据" />
      {big && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={src} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </>
  )
}
