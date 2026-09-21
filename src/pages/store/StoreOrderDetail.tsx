import { useEffect, useState } from 'react'
import { useStore, catName, storeName } from '../../store'
import {
  Badge, Notice, Stepper, Modal,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, CASE_STATUS, fmtDateTime, fmtDate
} from '../../components/ui'
import type { Order, ServiceCase } from '../../../shared/types'

export default function StoreOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { boot, current, openOrder } = useStore()
  useEffect(() => { openOrder(id) }, [id])
  const [tab, setTab] = useState<'work' | 'log'>('work')
  if (!boot || !current) return null
  const { order: o } = current
  const cat = boot.catalog

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <button className="btn sm" onClick={onBack}>← 看板</button>
          <h2 className="pagename" style={{ margin: 0 }}>制作工单 {o.id}</h2>
          <Badge kind={STATUS_STYLE[o.status]}>{STATUS_TEXT[o.status]}</Badge>
          <Badge kind={PAY_TEXT[o.paymentStatus].c}>{PAY_TEXT[o.paymentStatus].t}</Badge>
        </div>
        <span className="small muted">顾客 {o.customer.contactName} · {o.customer.phone}</span>
      </div>

      <div className="card mt12"><Stepper status={o.status} /></div>

      <div className="tabs mt16">
        <button className={tab === 'work' ? 'active' : ''} onClick={() => setTab('work')}>制作工单</button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>订单动态 ({o.timeline.length})</button>
      </div>

      {tab === 'log' && (
        <div className="card mt12">
          <div className="timeline mt12">
            {[...o.timeline].reverse().map(ev => (
              <div key={ev.id} className={`tl-item ${ev.actorRole}`}>
                <div className="tl-who">{ev.actor}<span className="tl-at">{fmtDateTime(ev.at)}</span></div>
                <div className="tl-text">{ev.text}</div>
                {ev.fields && <div className="tl-fields">{ev.fields.map((f, i) => <span key={i}>{f}</span>)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'work' && (
        <div className="grid cols-2 mt12">
          <div className="grid">
            {/* 关键时间 */}
            <div className="card accent">
              <h3>⏰ 制作时间</h3>
              <div className="kv">
                <span className="k">取货</span><span className="v"><b style={{ color: 'var(--brand-dark)' }}>{fmtDate(o.pickupDate)} {o.slot}</b>（{storeName(boot.stores, o.storeId)}）</span>
                <span className="k">建议完成</span><span className="v">取货前 2 小时</span>
                <span className="k">最晚修改</span><span className="v">{fmtDateTime(o.latestModifyAt)}</span>
                <span className="k">备料完成</span><span className="v">{o.materialsReadyAt ? fmtDateTime(o.materialsReadyAt) : '未登记'}</span>
                <span className="k">开制时间</span><span className="v">{o.makeStartTime ? fmtDateTime(o.makeStartTime) : '未开始'}</span>
                <span className="k">完成时间</span><span className="v">{o.readyAt ? fmtDateTime(o.readyAt) : '—'}</span>
              </div>
            </div>

            {/* 异常阻塞 */}
            {o.cases.filter(c => ['open', 'awaiting_customer'].includes(c.status)).length > 0 && (
              <div className="grid" style={{ gap: 10 }}>
                {o.cases.filter(c => ['open', 'awaiting_customer'].includes(c.status)).map(c => (
                  <Notice key={c.id} kind="danger" title={<>{c.title} <Badge kind={CASE_STATUS[c.status].c}>{CASE_STATUS[c.status].t}</Badge></>}>
                    {c.detail}
                    {c.proposal && <div className="small mt8"><b>客服方案：</b>{c.proposal.desc}</div>}
                  </Notice>
                ))}
              </div>
            )}

            {/* 原料准备 */}
            <div className="card">
              <h3>🧺 原料准备单</h3>
              <div className="kv">
                <span className="k">胚底</span><span className="v">{catName(cat, 'bases', o.cake.baseId)}</span>
                <span className="k">奶油</span><span className="v">{catName(cat, 'creams', o.cake.creamId)}</span>
                <span className="k">夹心</span><span className="v">{o.cake.fillingIds.map(id => catName(cat, 'fillings', id)).join('、') || '无'}</span>
                <span className="k">水果</span><span className="v">{o.cake.fruitIds.map(id => catName(cat, 'fruits', id)).join('、') || '无'}</span>
                <span className="k">蜡烛餐具</span><span className="v">{catName(cat, 'candles', o.cake.candleId)} ×{o.cake.candleCount} / {o.cake.tablewareSets} 套</span>
              </div>
              <StockLine o={o} />
            </div>
          </div>

          <div className="grid">
            {/* 题字与造型 */}
            <div className="card">
              <h3>✍️ 题字与造型（开制前务必核对）</h3>
              <div style={{ background: 'var(--cream)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{o.cake.inscription || '（无题字）'}</div>
              </div>
              <div className="kv mt12">
                <span className="k">造型</span><span className="v">{catName(cat, 'styles', o.cake.styleId)}</span>
                <span className="k">尺寸</span><span className="v">{catName(cat, 'sizes', o.cake.sizeId)}</span>
              </div>
              <div className="field mt12"><label>造型备注</label><div className="small" style={{ whiteSpace: 'pre-wrap' }}>{o.cake.styleNote || '无'}</div></div>
              {o.cake.styleRefPhoto
                ? <img className="photo-thumb mt8" style={{ maxWidth: 280 }} src={o.cake.styleRefPhoto} alt="造型参考" />
                : <div className="tiny muted mt8">顾客未上传参考图</div>}
            </div>

            {/* 特殊禁忌 */}
            <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <h3>🚫 特殊禁忌 / 过敏原</h3>
              {o.cake.avoidAllergenIds.length
                ? <div className="chips">{o.cake.avoidAllergenIds.map(a => <span key={a} className="chip sel">规避 {catName(cat, 'allergens', a)}</span>)}</div>
                : <div className="small muted">顾客未声明特殊过敏原规避</div>}
              <Notice kind="warn" title="共用车间提醒">
                <span className="small">即使无声明，转台、抹刀与裱花袋仍需按 SOP 清洁；含芒果/坚果订单与本单错开操作台。</span>
              </Notice>
              <div className="small mt8">🎁 生日对象：{o.customer.birthdayPerson.name}（{o.customer.birthdayPerson.relation}{o.customer.birthdayPerson.age ? `，${o.customer.birthdayPerson.age} 岁` : ''}）{o.cake.needColdChain ? ' · ❄️需冷链保温袋' : ''}</div>
            </div>

            {/* 返工 */}
            <div className="card">
              <h3>🔁 本单返工记录（{o.reworks.length}）</h3>
              {o.reworks.length === 0 ? <div className="small muted">暂无返工</div> : o.reworks.map(r => (
                <div key={r.id} style={{ borderBottom: '1px dashed var(--line)', padding: '7px 0' }}>
                  <div className="small"><b>{fmtDateTime(r.at)}</b> · {r.reason}（成本约 ¥{r.cost}）</div>
                  <div className="tiny muted">{r.note} · 登记人 {r.by}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StockLine({ o }: { o: Order }) {
  const { boot } = useStore()
  const stock = boot!.stock[o.storeId] || {}
  const items = o.cake.fruitIds.filter(f => f !== 'none_fruit')
  if (!items.length) return null
  return (
    <div className="mt8">
      {items.map(f => {
        const s = stock[f]
        return (
          <div key={f} className="small row" style={{ justifyContent: 'space-between' }}>
            <span>{catName(boot!.catalog, 'fruits', f)}</span>
            {s === 'out'
              ? <Badge kind="red">缺货中（等顾客确认替代方案）</Badge>
              : s === 'low' ? <Badge kind="orange">库存紧张，先到先得</Badge>
              : <Badge kind="green">库存充足</Badge>}
          </div>
        )
      })}
    </div>
  )
}
