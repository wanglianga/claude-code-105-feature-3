import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore, catName, storeName } from '../../store'
import {
  Badge, Notice, Stepper, Modal, FilePhoto, EmptyState,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, CASE_STATUS, fmtDateTime, fmtDate, useCountdown
} from '../../components/ui'
import { sensitiveWords } from '../../price'
import type { Order, ServiceCase, AppealReasonCode } from '../../../shared/types'
import { APPEAL_VERDICT_LABEL, APPEAL_REASON_LABEL, RESPONSIBILITY_LABEL } from '../../../shared/types'

const CASE_ICON: Record<string, string> = {
  date_change: '📅', sensitive_inscription: '✍️', fruit_shortage: '🍓',
  fridge_capacity: '🧊', store_transfer: '🏪', after_sale: '🛟'
}

export default function CustomerOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { boot, current, openOrder, act } = useStore()
  const [tab, setTab] = useState<'progress' | 'detail' | 'timeline'>('progress')
  const [showModify, setShowModify] = useState(false)
  const [showDate, setShowDate] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showAfterSale, setShowAfterSale] = useState(false)
  useEffect(() => { openOrder(id) }, [id])
  if (!boot || !current) return null
  const { order: o, derived } = current
  const cat = boot.catalog
  const store = boot.stores.find(s => s.id === o.storeId)!

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button className="btn sm" onClick={onBack}>← 返回</button>
          <h2 className="pagename" style={{ margin: 0 }}>{o.id}</h2>
          <Badge kind={STATUS_STYLE[o.status]}><span className="dot" />{STATUS_TEXT[o.status]}</Badge>
          <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        </div>
        <span className="small muted">下单 {fmtDateTime(o.createdAt)}</span>
      </div>

      <div className="card mt12">
        <Stepper status={o.status} />
        <ProgressHints o={o} />
      </div>

      {/* 待顾客处理的工单：最高优先级置顶 */}
      <div className="grid mt12">
        {o.cases.filter(c => c.status === 'awaiting_customer').map(c => <AwaitingCase key={c.id} o={o} c={c} />)}
        {o.cases.filter(c => c.status === 'open' && c.raisedBy !== boot.accounts[0]?.id).slice(0, 3).map(c => (
          <Notice key={c.id} kind="info" title={<>{CASE_ICON[c.kind]} {c.title} <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge></>}>
            {c.detail}
          </Notice>
        ))}
      </div>

      <div className="tabs mt16">
        <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>定制进度与取货</button>
        <button className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>我的定制单</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>订单动态 ({o.timeline.length})</button>
      </div>

      <div className="mt12">
        {tab === 'progress' && <ProgressTab o={o} />}
        {tab === 'detail' && <DetailTab o={o} />}
        {tab === 'timeline' && <TimelineTab o={o} />}
      </div>
    </div>
  )

  function ProgressTab({ o }: { o: Order }) {
    const modifyCd = useCountdown(o.status === 'pending_accept' || o.status === 'accepted' ? o.latestModifyAt : null)
    const afterCd = useCountdown(derived.afterSaleDeadline)
    const due = Math.max(0, derived.total - o.paidAmount)

    return (
      <>
      <div className="grid cols-2">
        <div className="grid">
          {/* 支付 */}
          {due > 0 && o.status !== 'cancelled' && (
            <div className="card accent">
              <h3>💳 待支付 ¥{due}</h3>
              <div className="small muted">门店接单后开始备料，建议尽快完成支付</div>
              <button className="btn primary mt12" onClick={() => act(o.id, 'pay')}>立即支付 ¥{due}</button>
            </div>
          )}

          {/* 取货信息 */}
          <div className="card">
            <h3>🏪 取货信息</h3>
            <div className="kv">
              <span className="k">门店</span><span className="v">{store.name} · {store.address}</span>
              <span className="k">电话</span><span className="v">{store.phone}</span>
              <span className="k">时间</span><span className="v">{fmtDate(o.pickupDate)} {o.slot}</span>
              <span className="k">核验方式</span><span className="v">到店报 4 位取货码 + 手机号尾号 {o.customer.phone.slice(-4)}</span>
            </div>
            <div className="pickup-code mt12">{o.pickupCode}</div>
            <div className="tiny muted mt8" style={{ textAlign: 'center' }}>取货码已同步发送至 {o.customer.phone}；交付前请确认成品照片与包装</div>
          </div>

          {/* 可修改范围 */}
          <div className="card">
            <h3>✏️ 可修改范围</h3>
            {derived.modifyLocked ? (
              <>
                <Notice kind="warn" title="自助修改已关闭">
                  最晚修改时间为 {fmtDateTime(o.latestModifyAt)}；订单进入制作后题字与造型不可再改，避免裱花返工。<br />
                  如确需<b>临时改期 / 更换门店</b>，可提交申请由客服与门店评估（可能产生费用）。
                </Notice>
                <div className="row mt12">
                  <button className="btn" disabled={['ready', 'verified', 'picked_up', 'closed'].includes(o.status)} onClick={() => setShowDate(true)}>📅 申请临时改期</button>
                  <button className="btn" disabled={['ready', 'verified', 'picked_up', 'closed'].includes(o.status)} onClick={() => setShowTransfer(true)}>🏪 申请更换门店</button>
                </div>
              </>
            ) : (
              <>
                <div className="small">距最晚修改时间 <b className="countdown" style={{ color: 'var(--brand-dark)' }}>{modifyCd?.text}</b></div>
                <div className="small muted mt8">窗口期内可自助修改：题字、造型备注、餐具数量、取货时段（同日）；尺寸/胚底/奶油请联系客服。</div>
                <button className="btn primary mt12" onClick={() => setShowModify(true)}>自助修改定制信息</button>
                <div className="row mt8">
                  <button className="btn sm ghost" onClick={() => setShowDate(true)}>需要改期</button>
                  <button className="btn sm ghost" onClick={() => setShowTransfer(true)}>需要换店</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid">
          {/* 门店交付材料 */}
          <div className="card">
            <h3>📸 门店交付材料</h3>
            {o.photos.final || o.photos.package || o.photos.coldNotice ? (
              <div className="grid cols-3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <PhotoCell label="成品照片" v={o.photos.final} />
                <PhotoCell label="包装照片" v={o.photos.package} />
                <PhotoCell label="冷藏提示" v={o.photos.coldNotice} />
              </div>
            ) : <div className="small muted">门店将在交付前上传成品照片、包装照片与冷藏提示卡，可在此核对造型</div>}
            {o.cake.needColdChain && (
              <div className="small mt8">❄️ 本单含冷藏运输：取货后请 {store.coldChainAvailable ? '保持冷链袋封口、2 小时内冷藏' : '尽快冷藏'}，动物奶油请勿在常温久置。</div>
            )}
          </div>

          {/* 签收 / 售后 */}
          <div className="card">
            <h3>✅ 签收与售后</h3>
            {o.status === 'ready' && <div className="small">请到店向前台出示取货码；前台核验支付状态与冷藏提示后交付，请当面核对造型并签收。</div>}
            {o.status === 'picked_up' && (
              <>
                <Notice kind="ok" title={`已于 ${fmtDateTime(o.pickedUpAt)} 签收`}>
                  {afterCd && !afterCd.over
                    ? <>售后窗口计算中，剩余 <b className="countdown">{afterCd.text}</b>（{o.afterSalesHours} 小时）。如发现造型不符、原料错误等，请在窗口内提交照片证据。</>
                    : <>售后窗口已结束。</>}
                </Notice>
                {afterCd && !afterCd.over &&
                  <button className="btn danger mt12" onClick={() => setShowAfterSale(true)}>发起造型申诉（上传照片）</button>}
              </>
            )}
            {o.cases.some(c => c.kind === 'after_sale') && (
              <div className="grid mt12" style={{ gap: 8 }}>
                {o.cases.filter(c => c.kind === 'after_sale').map(c => <AppealTrack key={c.id} c={c} o={o} />)}
              </div>
            )}
            {o.remakes.length > 0 && <RemakeTrack o={o} />}
            {o.status === 'closed' && <div className="small muted">售后窗口已关闭，感谢惠顾。历史工单与证据仍可在订单动态中查看。</div>}
            {['pending_accept', 'accepted', 'producing'].includes(o.status) &&
              <div className="small muted">门店制作进度会实时同步；制作中如遇缺货/冷柜问题，客服会在此联系您确认。</div>}
          </div>

          {/* 费用明细 */}
          <FeeCard o={o} total={derived.total} />
        </div>
      </div>

      {showModify && <ModifyModal />}
      {showDate && <DateChangeModal />}
      {showTransfer && <TransferModal />}
      {showAfterSale && <AfterSaleModal />}
      </>
    )
  }

  function DetailTab({ o }: { o: Order }) {
    const rows: [string, ReactNode][] = [
      ['尺寸', catName(cat, 'sizes', o.cake.sizeId)],
      ['胚底', catName(cat, 'bases', o.cake.baseId)],
      ['奶油', catName(cat, 'creams', o.cake.creamId)],
      ['夹心', o.cake.fillingIds.map(id => catName(cat, 'fillings', id)).join('、') || '无'],
      ['表面水果', o.cake.fruitIds.map(id => catName(cat, 'fruits', id)).join('、') || '无'],
      ['规避过敏原', o.cake.avoidAllergenIds.map(id => catName(cat, 'allergens', id)).join('、') || '无'],
      ['造型', catName(cat, 'styles', o.cake.styleId)],
      ['造型备注/禁忌', o.cake.styleNote || '无'],
      ['题字', o.cake.inscription],
      ['蜡烛', `${catName(cat, 'candles', o.cake.candleId)}${o.cake.candleId !== 'none_c' ? ` ×${o.cake.candleCount}` : ''}`],
      ['餐具', `${o.cake.tablewareSets} 套`],
      ['冷藏运输', o.cake.needColdChain ? `需要（+¥${cat.coldChainFee}）` : '不需要'],
      ['生日对象', `${o.customer.birthdayPerson.name}（${o.customer.birthdayPerson.relation}${o.customer.birthdayPerson.age ? '，' + o.customer.birthdayPerson.age + ' 岁' : ''}）`],
      ['联系人', `${o.customer.contactName} ${o.customer.phone}`],
      ['发票', o.customer.invoice.needed ? `${o.customer.invoice.title} / ${o.customer.invoice.taxNo || '个人'}` : '不开票']
    ]
    return (
      <div className="grid cols-2">
        <div className="card">
          <h3>🎂 定制内容</h3>
          <div className="kv">{rows.map(([k, v]) => <Fragment key={k}><span className="k">{k}</span><span className="v">{v}</span></Fragment>)}</div>
          {o.cake.styleRefPhoto && (
            <div className="mt12" style={{ maxWidth: 260 }}>
              <div className="tiny muted mb8">造型参考图</div>
              <img className="photo-thumb" src={o.cake.styleRefPhoto} alt="参考图" />
            </div>
          )}
        </div>
        <div className="grid">
          {o.cases.length > 0 && <div className="card"><h3>📁 关联协商记录</h3><CaseHistory o={o} /></div>}
          {o.reworks.length > 0 && (
            <div className="card">
              <h3>🔁 门店返工记录（内部透明披露）</h3>
              {o.reworks.map(r => (
                <div key={r.id} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
                  {fmtDateTime(r.at)} · {r.reason} <span className="muted">（{r.note}）</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  function TimelineTab({ o }: { o: Order }) {
    return (
      <div className="card">
        <h3>📜 订单全程动态（三端一致）</h3>
        <div className="timeline mt12">
          {[...o.timeline].reverse().map(ev => (
            <div key={ev.id} className={`tl-item ${ev.actorRole}`}>
              <div className="tl-who">{ev.actor}<span className="tl-at">{fmtDateTime(ev.at)}</span></div>
              <div className="tl-text">{ev.text}</div>
              {ev.fields && <div className="tl-fields">{ev.fields.map((f, i) => <span key={i}>{f}</span>)}</div>}
              {ev.amount != null && <div className="small mt8" style={{ color: ev.amount < 0 ? 'var(--ok)' : 'var(--brand-dark)' }}>金额：{ev.amount < 0 ? '-' : ''}¥{Math.abs(ev.amount)}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---- 弹窗 ----
  function ModifyModal() {
    const [inscription, setInscription] = useState(o.cake.inscription)
    const [styleNote, setStyleNote] = useState(o.cake.styleNote)
    const [sets, setSets] = useState(o.cake.tablewareSets)
    const [sl, setSl] = useState(o.slot)
    const hits = sensitiveWords(cat, inscription)
    return (
      <Modal title="自助修改（最晚修改时间前）" onClose={() => setShowModify(false)}
        footer={<>
          <button className="btn" onClick={() => setShowModify(false)}>取消</button>
          <button className="btn primary" onClick={async () => {
            const r = await act(o.id, 'customer_modify', { cake: { inscription, styleNote, tablewareSets: sets }, slot: sl })
            if (r) { setShowModify(false); openOrder(o.id) }
          }}>保存修改</button>
        </>}>
        <div className="field">
          <label>题字（{inscription.length}/22）</label>
          <input className="input" maxLength={22} value={inscription} onChange={e => setInscription(e.target.value)} />
          {hits.length > 0 && <div className="tiny mt8" style={{ color: 'var(--warn)' }}>含敏感词 {hits.join('、')}：保存后将转客服人工审核，审核期间门店暂停制作</div>}
        </div>
        <div className="field"><label>造型备注 / 特殊禁忌</label><textarea className="input" value={styleNote} onChange={e => setStyleNote(e.target.value)} /></div>
        <div className="inline-fields">
          <div className="field"><label>餐具 {sets} 套</label><input type="range" min={0} max={20} value={sets} style={{ width: '100%', accentColor: 'var(--brand)' }} onChange={e => setSets(Number(e.target.value))} /></div>
          <div className="field"><label>取货时段（同日）</label>
            <select className="input" value={sl} onChange={e => setSl(e.target.value)}>
              {cat.slots.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="tiny muted">尺寸/胚底/奶油/水果涉及备料，请联系客服评估。</div>
      </Modal>
    )
  }

  function DateChangeModal() {
    const [d, setD] = useState(o.pickupDate)
    const [sl, setSl] = useState(o.slot)
    const [reason, setReason] = useState('')
    const today = new Date(); today.setDate(today.getDate() + 1)
    return (
      <Modal title="申请临时改期" onClose={() => setShowDate(false)}
        footer={<button className="btn primary" disabled={!reason.trim()} onClick={async () => {
          const r = await act(o.id, 'customer_request_change', { kind: 'date_change', detail: reason, wish: { pickupDate: d, slot: sl } })
          if (r) { setShowDate(false); openOrder(o.id) }
        }}>提交改期申请</button>}>
        <Notice kind="warn" title="已过免费修改窗口或临近制作">客服将与门店核对排班与原料，可能产生改期服务费；方案与费用需您确认后生效。</Notice>
        <div className="inline-fields mt12">
          <div className="field"><label>期望日期</label><input className="input" type="date" value={d} onChange={e => setD(e.target.value)} /></div>
          <div className="field"><label>期望时段</label><select className="input" value={sl} onChange={e => setSl(e.target.value)}>{cat.slots.map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="field"><label>改期原因</label><textarea className="input" placeholder="如：生日聚会临时改到周五晚" value={reason} onChange={e => setReason(e.target.value)} /></div>
      </Modal>
    )
  }

  function TransferModal() {
    const [sid, setSid] = useState(boot!.stores.find(s => s.id !== o.storeId)?.id || '')
    const [reason, setReason] = useState('')
    return (
      <Modal title="申请更换取货门店" onClose={() => setShowTransfer(false)}
        footer={<button className="btn primary" disabled={!sid || !reason.trim()} onClick={async () => {
          const r = await act(o.id, 'customer_request_change', { kind: 'store_transfer', detail: reason, wish: { storeId: sid } })
          if (r) { setShowTransfer(false); openOrder(o.id) }
        }}>提交换店申请</button>}>
        <div className="field"><label>目标门店</label>
          <select className="input" value={sid} onChange={e => setSid(e.target.value)}>
            {boot!.stores.filter(s => s.id !== o.storeId).map(s => <option key={s.id} value={s.id}>{s.name}（{s.address}）{s.coldChainAvailable ? '' : '·不支持冷链'}</option>)}
          </select>
        </div>
        <div className="field"><label>换店原因</label><textarea className="input" placeholder="如：当天会在另一个城区聚餐" value={reason} onChange={e => setReason(e.target.value)} /></div>
        <div className="tiny muted">两店需确认冷柜、原料与排班；可能产生跨店调货费，客服会在订单中列明。</div>
      </Modal>
    )
  }

  function AfterSaleModal() {
    const [reason, setReason] = useState<AppealReasonCode>('style_mismatch')
    const [detail, setDetail] = useState('')
    const [photo, setPhoto] = useState<string | undefined>()
    const [transportMode, setTransportMode] = useState<'cold_chain' | 'ambient'>(o.cake.needColdChain ? 'cold_chain' : 'ambient')
    const [transportNote, setTransportNote] = useState('')
    const reasonOptions: [AppealReasonCode, string][] = [
      ['style_mismatch', '造型与参考图不符'],
      ['inscription_wrong', '题字错误'],
      ['ingredient_mismatch', '原料/水果与订单不符'],
      ['transport_deformation', '运输途中变形'],
      ['packaging_damage', '包装破损或融化'],
      ['food_issue', '食用后不适'],
      ['other', '其他']
    ]
    return (
      <Modal title="取货后造型申诉" onClose={() => setShowAfterSale(false)} wide
        footer={<button className="btn danger" disabled={!detail.trim() || !photo} onClick={async () => {
          const r = await act(o.id, 'open_after_sale', {
            reason: reasonOptions.find(x => x[0] === reason)?.[1], reasonCode: reason,
            detail, evidencePhoto: photo, transportMode, transportNote
          })
          if (r) { setShowAfterSale(false); openOrder(o.id) }
        }}>上传照片并提交申诉</button>}>
        <Notice kind="info" title="页面将自动为客服并排呈现以下材料">
          您的<b>下单参考图</b>、门店<b>成品照 / 包装照</b>、<b>签收时间</b>与<b>运输方式</b>，连同本次上传的照片一起比对；客服据此判定退款、补做、优惠券或拒绝，并区分门店责任与自提运输责任。
        </Notice>

        {/* 申诉前可先核对的对比材料 */}
        <div className="grid cols-3 mt12" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <CustomerCmp label="我的下单参考图" v={o.cake.styleRefPhoto} empty="未上传参考图（以造型备注为准）" />
          <CustomerCmp label="门店成品照" v={o.photos.final} empty="门店未留成品照" />
          <CustomerCmp label="包装照 / 冷藏提示" v={o.photos.package || o.photos.coldNotice} empty="无" />
        </div>
        <div className="small muted mt8">
          签收时间：{fmtDateTime(o.pickedUpAt)}（{o.afterSalesHours}h 售后窗口内）·
          订单运输方式：{o.cake.needColdChain ? '含冷链（¥30）' : '常温'}
        </div>

        <div className="field mt12"><label>问题类型</label>
          <select className="input" value={reason} onChange={e => setReason(e.target.value as AppealReasonCode)}>
            {reasonOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>

        {reason === 'transport_deformation' && (
          <div className="field">
            <label>离店后的运输/保存方式（用于区分门店责任与自提责任）</label>
            <div className="chips">
              <button className={`chip ${transportMode === 'cold_chain' ? 'sel' : ''}`} onClick={() => setTransportMode('cold_chain')}>
                ❄️ 使用门店冷链保温袋
              </button>
              <button className={`chip ${transportMode === 'ambient' ? 'sel' : ''}`} onClick={() => setTransportMode('ambient')}>
                🚶 常温携带（步行/公交/自驾）
              </button>
            </div>
            <input className="input mt8" value={transportNote}
              placeholder="如：公交约 50 分钟、户外放置 2 小时、是否全程封口冷藏…"
              onChange={e => setTransportNote(e.target.value)} />
            <div className="tiny muted mt8">若变形来自离店后的高温/久置，可能判定为顾客自提责任；门店包装或冷藏提示不到位则为门店责任。</div>
          </div>
        )}

        <div className="field"><label>详细说明</label>
          <textarea className="input" placeholder="请描述取货时间、回家运输与保存情况、现场问题与诉求（退款/补做/优惠券）" value={detail} onChange={e => setDetail(e.target.value)} /></div>
        <div style={{ maxWidth: 280 }}><FilePhoto label="上传问题照片（必传）" value={photo} onChange={setPhoto} /></div>
      </Modal>
    )
  }
}

function ProgressHints({ o }: { o: Order }) {
  const hints: ReactNode[] = []
  if (o.status === 'pending_accept') hints.push(<span key="a">⏳ 门店正在确认接单与冷柜容量</span>)
  if (o.status === 'accepted') hints.push(<span key="b">🧺 门店备料中，裱花师将看到您的过敏原规避与特殊禁忌</span>)
  if (o.status === 'producing') hints.push(<span key="c">🎨 裱花师制作中，交付前会上传成品与包装照片</span>)
  if (o.status === 'ready') hints.push(<span key="d">🎁 蛋糕已就绪，请在 {o.slot} 到店报取货码 <b>{o.pickupCode}</b></span>)
  if (o.status === 'picked_up') hints.push(<span key="e">✅ 已签收，售后窗口进行中</span>)
  return <div className="small muted" style={{ textAlign: 'center' }}>{hints}</div>
}

function PhotoCell({ label, v }: { label: string; v?: string }) {
  const [big, setBig] = useState(false)
  return (
    <>
      <div>{v
        ? <img className="photo-thumb" src={v} alt={label} style={{ cursor: 'zoom-in' }} onClick={() => setBig(true)} />
        : <div className="photo-thumb" style={{ display: 'grid', placeItems: 'center' }}>
            <span className="tiny muted">{label}待上传</span>
          </div>}
        <div className="tiny muted" style={{ textAlign: 'center' }}>{label}</div>
      </div>
      {big && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={v} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </>
  )
}

function CustomerCmp({ label, v, empty }: { label: string; v?: string; empty: string }) {
  const [big, setBig] = useState(false)
  return (
    <div style={{ textAlign: 'center' }}>
      {v
        ? <img src={v} className="photo-thumb" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', cursor: 'zoom-in' }} onClick={() => setBig(true)} />
        : <div className="photo-thumb" style={{ width: '100%', aspectRatio: '4/3', display: 'grid', placeItems: 'center' }}><span className="tiny muted">{empty}</span></div>}
      <div className="tiny muted">{label}</div>
      {big && v && <div className="modal-mask" onMouseDown={e => e.target === e.currentTarget && setBig(false)}>
        <img src={v} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 12 }} />
      </div>}
    </div>
  )
}

function AppealTrack({ o, c }: { o: Order; c: ServiceCase }) {
  const d = c.decision
  const pending = !d
  return (
    <div className="card" style={{ padding: 12, borderLeft: pending ? '3px solid var(--warn)' : '3px solid var(--brand)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>🛟 造型申诉{c.reasonCode ? `·${APPEAL_REASON_LABEL[c.reasonCode]}` : ''}</b>
        <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge>
      </div>
      <div className="tiny muted mt8">发起 {fmtDateTime(c.raisedAt)} · 签收 {fmtDateTime(c.signedAt || o.pickedUpAt)} · 运输 {c.transportMode === 'cold_chain' ? '冷链' : '常温自提'}</div>
      {pending
        ? <div className="small mt8">客服正在核对下单参考图、门店成品照、签收时间与运输方式，请留意本页结论。</div>
        : <div className="mt8">
          <div className="chips">
            <Badge kind={d!.verdict === 'refund' ? 'green' : d!.verdict === 'remake' ? 'violet' : d!.verdict === 'coupon' ? 'blue' : 'gray'}>
              {APPEAL_VERDICT_LABEL[d!.verdict]}
            </Badge>
            <Badge kind={d!.responsibility === 'store' ? 'red' : 'orange'}>{RESPONSIBILITY_LABEL[d!.responsibility]}</Badge>
            {d!.transportDeformation && <Badge kind="orange">运输环节变形</Badge>}
          </div>
          <div className="small mt8">{c.resolution}</div>
          {d!.verdict === 'refund' && <div className="small mt8" style={{ color: 'var(--ok)' }}>💸 退款 ¥{d!.refundAmount} 已原路退回，费用流水见下方明细。</div>}
          {d!.verdict === 'coupon' && <div className="small mt8" style={{ color: 'var(--brand-dark)' }}>🎟️ 优惠券已进入您的账户（顶部「优惠券账户」可查看，关联本次申诉原因）。</div>}
          {d!.verdict === 'remake' && <div className="small mt8" style={{ color: 'var(--brand-dark)' }}>🎂 补做已重新排班：{fmtDate(d!.remakePickupDate!)} {d!.remakeSlot} 到店取货（见下方补做安排）。</div>}
          {d!.verdict === 'reject' && <div className="tiny muted mt8">如对结论有异议，可联系客服补充证据再次沟通。</div>}
        </div>}
    </div>
  )
}

function RemakeTrack({ o }: { o: Order }) {
  const ST: Record<string, string> = {
    scheduled: '已排班·待备料', materials: '备料完成', producing: '补做制作中', ready: '补做完成待取', picked_up: '已取货'
  }
  return (
    <div className="card accent mt12">
      <h3 style={{ marginTop: 0 }}>🎂 售后补做安排（免费）</h3>
      {o.remakes.map(r => (
        <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{fmtDate(r.pickupDate)} {r.slot} 取货</b>
            <Badge kind={r.status === 'picked_up' ? 'green' : 'violet'}>{ST[r.status]}</Badge>
          </div>
          <div className="tiny muted mt8">制作开始：{fmtDateTime(r.makeStart)} · {r.note}</div>
        </div>
      ))}
    </div>
  )
}

function FeeCard({ o, total }: { o: Order; total: number }) {
  return (
    <div className="card">
      <h3>💰 费用与调整</h3>
      <div className="kv">
        <span className="k">订单原价</span><span className="v">¥{o.price.base + o.price.addons + o.price.coldChain}</span>
        <span className="k">已付</span><span className="v">¥{o.paidAmount}</span>
      </div>
      {o.fees.length > 0 && (
        <table className="table mt8">
          <thead><tr><th>项目</th><th>原因</th><th style={{ textAlign: 'right' }}>金额</th></tr></thead>
          <tbody>
            {o.fees.map(f => (
              <tr key={f.id}>
                <td>{f.label}<div className="tiny muted">{fmtDateTime(f.at)}</div></td>
                <td className="small muted">{f.reason}</td>
                <td style={{ textAlign: 'right', color: f.amount < 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 700 }}>
                  {f.amount < 0 ? '-' : '+'}¥{Math.abs(f.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row mt12" style={{ justifyContent: 'space-between' }}>
        <b>应付合计</b><b style={{ fontSize: 18, color: 'var(--brand-dark)' }}>¥{total}</b>
      </div>
    </div>
  )
}

function AwaitingCase({ o, c }: { o: Order; c: ServiceCase }) {
  const { act, openOrder } = useStore()
  const [note, setNote] = useState('')
  const [show, setShow] = useState(false)
  return (
    <Notice kind="danger" title={<>{CASE_ICON[c.kind]} {c.title} <Badge kind="orange">待您确认</Badge></>}
      actions={
        <>
          <button className="btn sm" onClick={() => setShow(true)}>查看详情</button>
          <button className="btn sm danger" onClick={async () => { const r = await act(o.id, 'customer_decide', { caseId: c.id, accept: false, note: note || '暂不接受方案' }); if (r) { setNote(''); openOrder(o.id) } }}>拒绝</button>
          <button className="btn sm primary" onClick={async () => { const r = await act(o.id, 'customer_decide', { caseId: c.id, accept: true, note }); if (r) { setNote(''); openOrder(o.id) } }}>同意并应用到订单</button>
        </>
      }>
      <div>{c.detail}</div>
      {c.proposal && (
        <div className="card mt8" style={{ background: '#fff', boxShadow: 'none' }}>
          <div className="small"><b>客服方案（{c.proposal.by}）：</b>{c.proposal.desc}</div>
          {c.proposal.feeAdjust !== 0 && (
            <div className="small mt8">
              费用调整：
              <b style={{ color: c.proposal.feeAdjust < 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {c.proposal.feeAdjust < 0 ? `退还 ¥${-c.proposal.feeAdjust}` : `加收 ¥${c.proposal.feeAdjust}`}
              </b>
              <span className="muted">（加收需补差价，退款原路返回；确认后即刻落回原订单）</span>
            </div>
          )}
        </div>
      )}
      <textarea className="input mt8" placeholder="给客服留言（可选）" value={note} onChange={e => setNote(e.target.value)} />
      {show && <CaseDetailModal c={c} onClose={() => setShow(false)} />}
    </Notice>
  )
}

function CaseDetailModal({ c, onClose }: { c: ServiceCase; onClose: () => void }) {
  return (
    <Modal title={`${CASE_ICON[c.kind]} 协商详情`} onClose={onClose}>
      <div className="kv">
        <span className="k">状态</span><span className="v"><Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge></span>
        <span className="k">发起</span><span className="v">{c.raisedBy} · {fmtDateTime(c.raisedAt)}</span>
        <span className="k">说明</span><span className="v">{c.detail}</span>
        {c.customerNote && <><span className="k">顾客留言</span><span className="v">{c.customerNote}</span></>}
        {c.resolution && <><span className="k">处理结果</span><span className="v">{c.resolution}</span></>}
        {c.refundAmount ? <><span className="k">退款</span><span className="v" style={{ color: 'var(--ok)' }}>¥{c.refundAmount}</span></> : null}
        {c.closedNote && <><span className="k">关闭备注</span><span className="v">{c.closedNote}</span></>}
      </div>
      {c.evidencePhoto && <img className="photo-thumb mt12" style={{ maxWidth: 280 }} src={c.evidencePhoto} alt="证据" />}
    </Modal>
  )
}

function CaseHistory({ o }: { o: Order }) {
  const [sel, setSel] = useState<ServiceCase | null>(null)
  return (
    <>
      {o.cases.length === 0 && <EmptyState icon="📭" title="暂无异常协商" sub="改期、缺货、售后等都会记录在这里" />}
      <div className="grid" style={{ gap: 8 }}>
        {o.cases.map(c => (
          <button key={c.id} className="card order-card" style={{ padding: '10px 14px' }} onClick={() => setSel(c)}>
            <div className="oc-top">
              <b>{CASE_ICON[c.kind]} {c.title}</b>
              <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge>
            </div>
            <div className="tiny muted mt8">{fmtDateTime(c.raisedAt)} · {c.raisedBy}</div>
          </button>
        ))}
      </div>
      {sel && <CaseDetailModal c={sel} onClose={() => setSel(null)} />}
    </>
  )
}
