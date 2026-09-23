import { useState } from 'react'
import { useStore } from '../../store'
import { Badge, Notice, Modal, FilePhoto, fmtDateTime, fmtDate } from '../../components/ui'
import {
  APPEAL_ISSUE_LABEL, APPEAL_RESPONSIBILITY_LABEL, APPEAL_VERDICT_LABEL,
  APPEAL_STATUS_LABEL, TRANSPORT_ISSUES
} from '../../../shared/types'
import type { Order, StyleAppeal, AppealIssueType } from '../../../shared/types'

const ISSUE_OPTIONS = Object.keys(APPEAL_ISSUE_LABEL) as AppealIssueType[]
const FOUND_WHEN_OPTIONS = ['门店当场（签收时）', '返程途中', '到家后（约取货后 1-2 小时）', '次日食用时', '其他时间']

const RESP_COLOR: Record<string, string> = {
  store: 'red', transport_store: 'orange', transport_customer: 'blue', none: 'gray'
}

// ---- 发起申诉弹窗 ----
export function AppealSubmitModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const { act, openOrder } = useStore()
  const [issueType, setIssueType] = useState<AppealIssueType>('style_mismatch')
  const [foundWhen, setFoundWhen] = useState(FOUND_WHEN_OPTIONS[2])
  const [detail, setDetail] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()

  const transport = TRANSPORT_ISSUES.includes(issueType)

  return (
    <Modal title={`取货后造型申诉 · ${o.id}`} onClose={onClose} wide
      footer={<button className="btn danger" disabled={!detail.trim() || !photo} onClick={async () => {
        const r = await act(o.id, 'open_style_appeal', { issueType, foundWhen, detail, evidencePhoto: photo })
        if (r) { onClose(); openOrder(o.id) }
      }}>提交申诉</button>}>
      <Notice kind="info" title="客服将在同一页对比四类材料后判定">
        ① 下单参考（造型/参考图与要求）　② 门店成品照（交付前上传）　③ 您的签收时间　④ 运输方式与您上传的取货后照片。
        若为运输中变形，客服会区分<b>门店运输责任</b>与<b>顾客自提责任</b>。
      </Notice>

      {/* 提交前即展示对比材料，提示顾客证据是否充分 */}
      <div className="grid cols-3 mt12">
        <CompareCell label="① 下单参考图" v={o.cake.styleRefPhoto} fallback="顾客未上传参考图，以造型备注/题字为准" />
        <CompareCell label="② 门店成品照" v={o.photos.final} fallback="门店未上传成品照" />
        <CompareCell label="③ 取货后问题照（本次上传）" v={photo} fallback="必传：请上传取货后实拍" highlight />
      </div>
      <div className="chips mt8">
        <span className="chip sel">签收时间：{o.pickedUpAt ? fmtDateTime(o.pickedUpAt) : '—'}</span>
        <span className="chip sel">{o.cake.needColdChain ? '❄️ 运输方式：冷藏自提' : '🚶 运输方式：常温自提'}</span>
      </div>

      <div className="field mt12"><label>问题类型</label>
        <select className="input" value={issueType} onChange={e => setIssueType(e.target.value as AppealIssueType)}>
          {ISSUE_OPTIONS.map(k => <option key={k} value={k}>{APPEAL_ISSUE_LABEL[k]}</option>)}
        </select>
      </div>
      <div className="field"><label>什么时候发现问题</label>
        <select className="input" value={foundWhen} onChange={e => setFoundWhen(e.target.value)}>
          {FOUND_WHEN_OPTIONS.map(x => <option key={x}>{x}</option>)}
        </select>
      </div>
      <div className="field">
        <label>详细说明（造型差异部位、携带过程、是否按冷藏提示保存）</label>
        <textarea className="input" rows={4} value={detail} onChange={e => setDetail(e.target.value)}
          placeholder={transport
            ? '如：取货后是否立刻冷藏？途中停留多久、是否倾倒？保温袋冰袋状态？'
            : '如：参考图要求黑紫库洛米，实际做成粉色兔子；题字写成了……'} />
      </div>
      {transport && (
        <Notice kind="warn" title="运输变形的责任区分">
          门店成品照 + 包装封签完整、且门店已履行冷藏提示义务，而问题出现在自提途中（常温久置/倾倒/冰袋失效），
          将判定为<b>顾客自提责任</b>，门店可拒绝赔付；若门店配送或冷链包装不到位，则为门店运输责任。
        </Notice>
      )}
      <div style={{ maxWidth: 280 }}><FilePhoto label="上传取货后问题照片（必传）" value={photo} onChange={setPhoto} /></div>
    </Modal>
  )
}

function CompareCell({ label, v, fallback, highlight }: { label: string; v?: string; fallback: string; highlight?: boolean }) {
  const [big, setBig] = useState(false)
  return (
    <div>
      <div className="tiny muted mb8">{label}</div>
      {v
        ? <img className="photo-thumb" src={v} alt={label} style={{ cursor: 'zoom-in', border: highlight ? '2px solid var(--danger)' : undefined }} onClick={() => setBig(true)} />
        : <div className="photo-thumb" style={{ display: 'grid', placeItems: 'center' }}><span className="tiny muted">{fallback}</span></div>}
      {big && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={v} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </div>
  )
}

// ---- 申诉卡片（顾客订单页内）----
export function AppealCard({ o, a }: { o: Order; a: StyleAppeal }) {
  const [detail, setDetail] = useState(false)
  const st = APPEAL_STATUS_LABEL[a.status]
  const transport = TRANSPORT_ISSUES.includes(a.issueType)
  return (
    <>
      <Notice kind={a.status === 'open' ? 'danger' : a.verdict === 'reject' ? 'warn' : 'ok'}
        title={<>{a.status === 'open' ? '🛟 造型申诉处理中' : '🛟 造型申诉已判定'} <Badge kind={st.c}>{st.t}</Badge>
          {a.verdict && a.status !== 'open' && <Badge kind={a.verdict === 'reject' ? 'gray' : 'green'}>{APPEAL_VERDICT_LABEL[a.verdict]}</Badge>}</>}
        actions={<button className="btn sm" onClick={() => setDetail(true)}>查看对比与结论</button>}>
        <div className="small">{APPEAL_ISSUE_LABEL[a.issueType]} · {a.foundWhen}发现 · 提交于 {fmtDateTime(a.raisedAt)}</div>
        {a.status !== 'open' && a.decisionNote && <div className="tiny muted mt8">{a.decisionNote}</div>}
        {a.verdict === 'remake' && a.remake && (
          <div className="small mt8" style={{ color: 'var(--brand-dark)' }}>
            📅 补做取货：<b>{fmtDate(a.remake.pickupDate)} {a.remake.slot}</b>　新取货码：<b>{a.remake.renewedCode}</b>
          </div>
        )}
        {a.coupon && <div className="small mt8" style={{ color: 'var(--ok)' }}>🎟️ ¥{a.coupon.amount} 优惠券已进入您的账户（顶部「我的优惠券」查看）</div>}
        {transport && a.responsibility && <div className="tiny mt8">责任判定：<b>{APPEAL_RESPONSIBILITY_LABEL[a.responsibility]}</b></div>}
      </Notice>
      {detail && <AppealDetailModal o={o} a={a} onClose={() => setDetail(false)} />}
    </>
  )
}

// ---- 申诉对比详情：下单参考 / 门店成品照 / 签收时间 / 运输方式 ----
export function AppealDetailModal({ o, a, onClose }: { o: Order; a: StyleAppeal; onClose: () => void }) {
  return (
    <Modal title={`🛟 造型申诉对比 · ${o.id}`} onClose={onClose} wide>
      <div className="grid cols-2">
        <div>
          <div className="kv">
            <span className="k">问题类型</span><span className="v">{APPEAL_ISSUE_LABEL[a.issueType]}</span>
            <span className="k">发现时机</span><span className="v">{a.foundWhen}</span>
            <span className="k">提交时间</span><span className="v">{fmtDateTime(a.raisedAt)}</span>
            <span className="k">签收时间</span><span className="v">{a.pickedUpAt ? fmtDateTime(a.pickedUpAt) : '—'}</span>
            <span className="k">运输方式</span><span className="v">{a.deliveryMethod}</span>
            {a.responsibility && <>
              <span className="k">责任判定</span>
              <span className="v"><Badge kind={RESP_COLOR[a.responsibility]}>{APPEAL_RESPONSIBILITY_LABEL[a.responsibility]}</Badge></span>
            </>}
            {a.verdict && <>
              <span className="k">处理结论</span><span className="v"><Badge kind={a.verdict === 'reject' ? 'gray' : 'green'}>{APPEAL_VERDICT_LABEL[a.verdict]}</Badge></span>
            </>}
            {a.refundAmount ? <><span className="k">退款</span><span className="v" style={{ color: 'var(--ok)' }}>¥{a.refundAmount} 已原路退回</span></> : null}
          </div>
          <div className="field mt12"><label>我的说明</label><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.detail}</div></div>
          {a.decisionNote && <div className="field"><label>客服判定说明</label><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.decisionNote}</div></div>}
          {a.decidedBy && <div className="tiny muted">{a.decidedBy} · {fmtDateTime(a.decidedAt)}</div>}

          {a.remake && (
            <div className="card mt12" style={{ background: 'var(--cream)' }}>
              <h3>🔁 补做排班（已重新生成）</h3>
              <div className="kv">
                <span className="k">补做取货</span><span className="v"><b>{fmtDate(a.remake.pickupDate)} {a.remake.slot}</b></span>
                <span className="k">新取货码</span><span className="v"><b>{a.remake.renewedCode}</b></span>
                <span className="k">建议开制</span><span className="v">{a.remake.makeStartTime ? fmtDateTime(a.remake.makeStartTime) : '门店排班中'}</span>
                <span className="k">补做签收</span><span className="v">{a.remake.pickedUpAt ? fmtDateTime(a.remake.pickedUpAt) : '待取货'}</span>
              </div>
              <div className="tiny muted mt8">{a.remake.note}</div>
            </div>
          )}
          {a.coupon && (
            <div className="card mt12" style={{ background: '#eefaf0' }}>
              <h3>🎟️ 优惠券已入账</h3>
              <div className="small">¥{a.coupon.amount} · {a.coupon.reason}</div>
            </div>
          )}
        </div>

        <div>
          <h3>四要素对比</h3>
          <div className="grid cols-2 mt8">
            <ZoomImg label="① 下单参考图" v={a.styleRefPhoto} fallback="未上传参考图（以造型备注为准）" />
            <ZoomImg label="② 门店成品照" v={a.storeFinalPhoto} fallback="门店未上传成品照" />
            <ZoomImg label="③ 取货后问题照（顾客）" v={a.evidencePhoto} fallback="未上传" wide />
          </div>
          <div className="chips mt8">
            <span className="chip sel">④ 签收：{a.pickedUpAt ? fmtDateTime(a.pickedUpAt) : '—'}</span>
            <span className="chip sel">{a.needColdChain ? '❄️ 冷藏自提' : '🚶 常温自提'}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ZoomImg({ label, v, fallback, wide }: { label: string; v?: string; fallback: string; wide?: boolean }) {
  const [big, setBig] = useState(false)
  return (
    <div className={wide ? 'cols-span-2' : ''}>
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
