import { useEffect } from 'react'
import { useStore } from '../../store'
import { Badge, EmptyState } from '../../components/ui'
import type { Analytics as AnalyticsData } from '../../api'

const KIND_CN: Record<string, string> = {
  date_change: '临时改期', sensitive_inscription: '敏感题字', fruit_shortage: '原料缺货',
  fridge_capacity: '冷柜不足', store_transfer: '更换门店', after_sale: '售后申请'
}

const VERDICT_CN: Record<string, string> = {
  refund: '退款', remake: '补做', coupon: '优惠券', reject: '拒绝赔付'
}
const REASON_CN: Record<string, string> = {
  style_mismatch: '造型不符', inscription_wrong: '题字错误', ingredient_mismatch: '原料不符',
  transport_deformation: '运输变形', packaging_damage: '包装破损', food_issue: '食用不适', other: '其他'
}

export default function AnalyticsView() {
  const { analytics, loadAnalytics, boot } = useStore()
  useEffect(() => { loadAnalytics() }, [])
  if (!analytics || !boot) return null
  const a: AnalyticsData = analytics
  const maxRework = Math.max(1, ...a.reworkByStyle.map(x => x.count))
  const maxMat = Math.max(1, ...a.changeByMaterial.map(x => x.count))

  return (
    <div className="mt16">
      {/* 冷柜与售后概览 */}
      <div className="grid cols-3">
        {a.fridgeToday.map(f => {
          const ratio = f.used / f.capacity
          return (
            <div className="stat" key={f.storeId}>
              <div className="s-label">🧊 {f.store} 今日冷柜</div>
              <div className="s-num" style={{ color: ratio >= 1 ? 'var(--danger)' : ratio >= 0.8 ? 'var(--warn)' : undefined }}>
                {f.used}<span className="small muted">/{f.capacity} 标位</span>
              </div>
              <div className="bar mt8"><i className={ratio >= 1 ? 'full' : ratio >= 0.8 ? 'warn' : ''} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
              <div className="s-sub">{ratio >= 1 ? '已满：接单触发客服调度工单' : ratio >= 0.8 ? '接近满载：关注改单风险' : '容量充足'}</div>
            </div>
          )
        })}
        <div className="stat">
          <div className="s-label">🛟 售后结案率</div>
          <div className="s-num">{Math.round(a.afterSaleRate * 100)}%</div>
          <div className="s-sub">取货签收后 24h 窗口内发起，依据三类交付照片与顾客证据判定</div>
        </div>
      </div>

      {/* 门店造型质量统计：取货后造型申诉结论 */}
      <div className="card mt16">
        <h3>🏅 门店造型质量统计 <span className="sec-sub">取货后造型申诉判定结论 · 区分门店责任 / 顾客自提责任</span></h3>
        {a.appealTotal === 0 ? <EmptyState icon="🛟" title="暂无已判定的造型申诉" /> : (
          <div className="grid cols-2 mt12" style={{ gap: 12 }}>
            {a.storeStyleQuality.map(s => {
              const fault = Math.round(s.storeFaultRate * 100)
              return (
                <div key={s.storeId} className="card" style={{ padding: 14, boxShadow: 'none', border: '1px solid var(--line)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <b>{s.store}</b>
                    <Badge kind={s.total === 0 ? 'gray' : fault >= 50 ? 'red' : fault > 0 ? 'orange' : 'green'}>
                      造型申诉 {s.total} 起 · 门店责任占比 {fault}%
                    </Badge>
                  </div>
                  {s.total === 0 ? <div className="small muted mt8">该门店暂无取货后造型申诉判定</div> : (
                    <>
                      {/* 责任分布 */}
                      <div className="mt8">
                        <div className="tiny muted mb8">责任归属</div>
                        <ResponsibilityBar storeResp={s.storeResp} selfResp={s.selfResp} />
                      </div>
                      {/* 四种结论 */}
                      <div className="chips mt8">
                        {(['refund', 'remake', 'coupon', 'reject'] as const).map(v => (
                          <span key={v} className={`chip ${s.verdicts[v] > 0 ? 'sel' : ''}`}>
                            {VERDICT_CN[v]} <span className="n">×{s.verdicts[v]}</span>
                          </span>
                        ))}
                      </div>
                      <div className="small mt8">
                        退款合计 <b style={{ color: 'var(--ok)' }}>¥{s.refundSum}</b> ·
                        优惠券赔付 <b style={{ color: 'var(--brand-dark)' }}>¥{s.couponSum}</b> ·
                        运输环节变形 <b>{s.transportDeform}</b> 起
                      </div>
                      {Object.keys(s.byReason).length > 0 && (
                        <div className="tiny mt8">
                          申诉原因：
                          {Object.entries(s.byReason).sort((x, y) => y[1] - x[1]).map(([k, n]) =>
                            <Badge key={k} kind="orange">{REASON_CN[k] || k} ×{n}</Badge>)}
                        </div>
                      )}
                      {fault >= 50 && <div className="tiny mt8" style={{ color: 'var(--danger)' }}>门店责任占比偏高，建议复盘该店裱花 SOP、交付包装与冷藏提示执行。</div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 被申诉造型排行 */}
        {a.appealByStyle.length > 0 && (
          <div className="mt12">
            <div className="small" style={{ fontWeight: 700 }}>被申诉造型排行（造型质量）</div>
            <div className="chips mt8">
              {a.appealByStyle.map(s => <span key={s.styleId} className="chip sel">{s.style} <span className="n">×{s.count}</span></span>)}
            </div>
          </div>
        )}
        <div className="tiny muted mt12">运输造成变形的申诉会单独标注：门店包装/冷链交付过错计入「门店责任」；离店后高温、久置、颠簸导致则计入「顾客自提责任」，不拖累门店造型合格率。</div>
      </div>

      <div className="grid cols-2 mt16">
        {/* 造型返工 */}
        <div className="card">
          <h3>🔁 哪些造型返工多 <span className="sec-sub">按返工次数与内部成本</span></h3>
          {a.reworkByStyle.length === 0 ? <EmptyState icon="🧁" title="暂无返工记录" /> : (
            <div className="grid" style={{ gap: 12 }}>
              {a.reworkByStyle.map((s, i) => (
                <div key={s.styleId}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small"><b>{i + 1}. {s.style}</b></span>
                    <span className="small muted">返工 {s.count} 次 · 损耗 ¥{s.cost}</span>
                  </div>
                  <div className="bar mt8"><i className={s.count >= 2 ? 'full' : ''} style={{ width: `${s.count / maxRework * 100}%` }} /></div>
                  {i === 0 && <div className="tiny mt8" style={{ color: 'var(--danger)' }}>建议：该造型增加参考图确认环节、安排高等级裱花师，或在下单页提示制作周期。</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 原料改单 */}
        <div className="card">
          <h3>🍓 哪些原料导致改单多 <span className="sec-sub">缺货/替代触发的工单</span></h3>
          {a.changeByMaterial.length === 0 ? <EmptyState icon="📦" title="暂无原料相关改单" /> : (
            <div className="grid" style={{ gap: 12 }}>
              {a.changeByMaterial.map((m, i) => (
                <div key={m.materialId}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="small"><b>{i + 1}. {m.material}</b></span>
                    <span className="small muted">{m.count} 次改单</span>
                  </div>
                  <div className="bar mt8"><i className={m.count >= 2 ? 'full' : 'warn'} style={{ width: `${m.count / maxMat * 100}%` }} /></div>
                  <div className="chips mt8">
                    {Object.entries(m.kinds).map(([k, n]) => <Badge key={k} kind="orange">{KIND_CN[k] || k} ×{n}</Badge>)}
                  </div>
                  {i === 0 && <div className="tiny mt8" style={{ color: 'var(--warn)' }}>建议：提高该原料备货安全系数，或在下单页对紧张批次做实时库存提示。</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 取货拥挤热力 */}
      <div className="card mt16">
        <h3>🕑 哪些时段取货拥挤 <span className="sec-sub">各门店 × 时段订单密度（按近两日订单合计 / 日容量）</span></h3>
        <div className="grid cols-2 mt12">
          {Object.entries(a.heat).map(([storeId, cells]) => (
            <div key={storeId}>
              <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{boot.stores.find(s => s.id === storeId)?.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                {cells.map(c => {
                  const bg = c.ratio >= 1 ? 'var(--danger)' : c.ratio >= 0.6 ? 'var(--warn)' : c.ratio > 0 ? 'var(--ok)' : 'var(--line)'
                  const fg = c.ratio > 0 || c.ratio >= 1 ? '#fff' : 'var(--ink-2)'
                  return (
                    <div key={c.slot} className="heat-cell" style={{ background: bg, color: bg === 'var(--line)' ? 'var(--ink-2)' : '#fff' }}>
                      <div>{c.slot}</div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{c.count}</div>
                      <div style={{ fontSize: 10, opacity: .85 }}>{c.ratio >= 1 ? '拥挤' : c.ratio >= 0.6 ? '较忙' : '顺畅'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="tiny muted mt12">运营建议：18:00-20:00 为高峰时，可在下单页引导 14:00-16:00 时段并给小额权益；高峰时段增派前台核验。</div>
      </div>

      {/* 工单类型分布 */}
      <div className="card mt16">
        <h3>📊 异常工单类型分布</h3>
        {Object.keys(a.casesByKind).length === 0 ? <div className="small muted">暂无工单</div> : (
          <div className="chips mt8">
            {Object.entries(a.casesByKind).sort((x, y) => y[1] - x[1]).map(([k, n]) => (
              <span key={k} className="chip sel">{KIND_CN[k] || k} <span className="n">×{n}</span></span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResponsibilityBar({ storeResp, selfResp }: { storeResp: number; selfResp: number }) {
  const total = storeResp + selfResp
  if (total === 0) return <div className="small muted">暂无</div>
  const sp = (storeResp / total) * 100
  const fp = (selfResp / total) * 100
  return (
    <div>
      <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: 'var(--line)' }}>
        <div style={{ width: `${sp}%`, background: 'var(--danger)' }} title={`门店责任 ${storeResp}`} />
        <div style={{ width: `${fp}%`, background: 'var(--warn)' }} title={`顾客自提责任 ${selfResp}`} />
      </div>
      <div className="row mt8" style={{ gap: 12 }}>
        <span className="tiny"><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--danger)', marginRight: 4 }} />门店责任 {storeResp}</span>
        <span className="tiny"><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--warn)', marginRight: 4 }} />顾客自提责任 {selfResp}</span>
      </div>
    </div>
  )
}
