import React, { useMemo, useState } from 'react'
import { useStore } from '../../store'
import { Badge, Notice, fmtDate } from '../../components/ui'
import { calcPrice, latestModifyFor, sensitiveWords } from '../../price'
import type { CakeConfig } from '../../../shared/types'
import { api } from '../../api'

const emptyCake: CakeConfig = {
  sizeId: 's8', baseId: 'vanilla', creamId: 'animal', fillingIds: [], fruitIds: [],
  avoidAllergenIds: [], allergenConfirmed: false,
  styleId: 'classic_fruit', styleNote: '', inscription: '', inscriptionApproved: false,
  candleId: 'digital', candleCount: 1, tablewareSets: 6, needColdChain: true
}

function todayPlus(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function NewOrder({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const { boot, account, createOrder } = useStore()
  const cat = boot!.catalog
  const [step, setStep] = useState(0)
  const [cake, setCake] = useState<CakeConfig>(emptyCake)
  const [storeId, setStoreId] = useState(boot!.stores[0].id)
  const [pickupDate, setPickupDate] = useState(todayPlus(2))
  const [slot, setSlot] = useState(cat.slots[2])
  const [contactName, setContactName] = useState(account?.name || '')
  const [phone, setPhone] = useState(account?.phone || '')
  const [bpName, setBpName] = useState('')
  const [bpRelation, setBpRelation] = useState('朋友')
  const [bpAge, setBpAge] = useState('')
  const [bpGender, setBpGender] = useState('')
  const [invNeeded, setInvNeeded] = useState(false)
  const [invTitle, setInvTitle] = useState('')
  const [invTaxNo, setInvTaxNo] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [capacity, setCapacity] = useState<Record<string, Awaited<ReturnType<typeof api.capacity>> | null>>({})

  const price = useMemo(() => calcPrice(cat, cake), [cat, cake])
  const store = boot!.stores.find(s => s.id === storeId)!
  const sensitive = useMemo(() => sensitiveWords(cat, cake.inscription), [cat, cake.inscription])
  const latestModify = latestModifyFor(pickupDate, cat.modifyLeadHours)
  const set = (p: Partial<CakeConfig>) => setCake(c => ({ ...c, ...p }))
  const toggle = (field: 'fillingIds' | 'fruitIds' | 'avoidAllergenIds', id: string) =>
    setCake(c => ({ ...c, [field]: c[field].includes(id) ? c[field].filter(x => x !== id) : [...c[field], id] }))

  const loadCapacity = async (sid: string, date: string) => {
    try {
      const key = `${sid}:${date}`
      if (!capacity[key]) {
        const r = await api.capacity(sid, date)
        setCapacity(m => ({ ...m, [key]: r }))
      }
    } catch { /* 未登录等情况忽略 */ }
  }
  const capKey = `${storeId}:${pickupDate}`
  const cap = capacity[capKey]
  loadCapacity(storeId, pickupDate)

  const stockOf = (fid: string) => boot!.stock[storeId]?.[fid]

  const steps = ['蛋糕口味', '造型题字', '取货信息', '确认下单']

  const canNext = [
    cake.sizeId && cake.baseId && cake.creamId && cake.allergenConfirmed,
    cake.styleId && cake.inscription.trim().length > 0 && cake.inscription.length <= 22,
    storeId && pickupDate && slot && contactName && /^1\d{10}$/.test(phone) &&
      (!cake.needColdChain || store.coldChainAvailable) &&
      (!invNeeded || (invTitle && invTaxNo))
  ]

  const submit = async () => {
    setErr(''); setSubmitting(true)
    try {
      const body = {
        storeId, pickupDate, slot,
        customer: {
          contactName, phone,
          birthdayPerson: { name: bpName || contactName, relation: bpRelation, age: bpAge, gender: bpGender },
          invoice: invNeeded ? { needed: true, title: invTitle, taxNo: invTaxNo, email: invEmail } : { needed: false }
        },
        cake
      }
      const o = await createOrder(body)
      onDone(o.id)
    } catch (e: any) {
      setErr(e.message)
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="pagename">🎂 定制生日蛋糕</h2>
        <button className="btn sm" onClick={onCancel}>返回我的订单</button>
      </div>
      <div className="pagesub">四步完成定制；最晚可免费修改时间为取货前 {cat.modifyLeadHours} 小时（{fmtDate(latestModify.slice(0, 10))}前一晚 18:00 取较早者）</div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {steps.map((s, i) => (
          <button key={s} className={i === step ? 'active' : ''} onClick={() => setStep(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }} className="order-form-grid">
        <div>
          {err && <div className="mt8"><Notice kind="danger" title="无法提交">{err}</Notice></div>}

          {step === 0 && (
            <div className="grid">
              <div className="card">
                <h3>📏 尺寸 <span className="sec-sub">按食用人数选择</span></h3>
                <div className="tiles">
                  {cat.sizes.map(s => (
                    <button key={s.id} className={`tile ${cake.sizeId === s.id ? 'sel' : ''}`} onClick={() => set({ sizeId: s.id })}>
                      <div className="t-name">{s.name}{s.badge && <Badge kind="pink">{s.badge}</Badge>}</div>
                      <div className="t-desc">{s.desc}</div>
                      <div className="t-price">{s.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid cols-2">
                <div className="card">
                  <h3>🍰 胚底</h3>
                  <div className="tiles">
                    {cat.bases.map(b => (
                      <button key={b.id} className={`tile ${cake.baseId === b.id ? 'sel' : ''}`} onClick={() => set({ baseId: b.id })}>
                        <div className="t-name">{b.name}{b.badge && <Badge kind="green">{b.badge}</Badge>}</div>
                        <div className="t-desc">{b.desc}</div>
                        <div className="t-price">{b.price ? `+¥${b.price}` : '不加价'}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h3>🥛 奶油</h3>
                  <div className="tiles">
                    {cat.creams.map(c => (
                      <button key={c.id} className={`tile ${cake.creamId === c.id ? 'sel' : ''}`} onClick={() => set({ creamId: c.id })}>
                        <div className="t-name">{c.name}</div>
                        <div className="t-desc">{c.desc}</div>
                        <div className="t-price">{c.price ? (c.price < 0 ? `-¥${-c.price}` : `+¥${c.price}`) : '不加价'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>🍓 夹心（可多选）</h3>
                <div className="tiles wide">
                  {cat.fillings.map(f => (
                    <button key={f.id} className={`tile ${cake.fillingIds.includes(f.id) ? 'sel' : ''}`} onClick={() => toggle('fillingIds', f.id)}>
                      <div className="t-name">{f.name}</div>
                      <div className="t-price">+¥{f.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3>🫐 表面水果（可多选）</h3>
                <div className="tiles wide">
                  {cat.fruits.map(f => {
                    const st = stockOf(f.id)
                    return (
                      <button key={f.id} className={`tile ${cake.fruitIds.includes(f.id) ? 'sel' : ''}`} onClick={() => toggle('fruitIds', f.id)}>
                        <div className="t-name">{f.name}{f.badge && <Badge kind="pink">{f.badge}</Badge>}</div>
                        <div className="t-price">{f.price ? `+¥${f.price}` : '不加价'}</div>
                        {st === 'low' && <span className="stocktag"><Badge kind="orange">库存紧张</Badge></span>}
                        {st === 'out' && <span className="stocktag"><Badge kind="red">今日缺货</Badge></span>}
                      </button>
                    )
                  })}
                </div>
                <div className="small muted mt8">缺货水果可照常下单，门店/客服会主动联系替代方案或退还加价，变更需您确认后才执行。</div>
              </div>

              <div className="card">
                <h3>⚠️ 过敏原提示</h3>
                <div className="sec-sub">本店为共用车间，所有蛋糕可能含或交叉接触以下过敏原。请勾选生日对象需要<b>严格规避</b>的项目，裱花师会单独准备工具并复核：</div>
                <div className="chips">
                  {cat.allergens.map(a => (
                    <button key={a.id} className={`chip ${cake.avoidAllergenIds.includes(a.id) ? 'sel' : ''}`}
                      onClick={() => toggle('avoidAllergenIds', a.id)}>
                      规避 {a.name}
                    </button>
                  ))}
                </div>
                <label className={`check-row mt12 ${cake.allergenConfirmed ? 'sel' : ''}`}>
                  <input type="checkbox" checked={cake.allergenConfirmed}
                    onChange={e => set({ allergenConfirmed: e.target.checked })} />
                  <span className="small">我已阅读并知晓《过敏原与共用车间告知书》，确认所选规避项已与生日对象家属核实；严重过敏史将另行电话沟通。</span>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid">
              <div className="card">
                <h3>🎨 造型</h3>
                <div className="tiles wide">
                  {cat.styles.map(s => (
                    <button key={s.id} className={`tile ${cake.styleId === s.id ? 'sel' : ''}`} onClick={() => set({ styleId: s.id })}>
                      <div className="t-name">{s.name}{s.badge && <Badge kind="orange">{s.badge}</Badge>}</div>
                      <div className="t-desc">{s.desc} · 复杂度 {'★'.repeat(s.difficulty)}</div>
                      <div className="t-price">{s.price ? `+¥${s.price}` : '不加价'}</div>
                    </button>
                  ))}
                </div>
                <div className="field mt12">
                  <label>造型备注 / 特殊禁忌</label>
                  <textarea className="input" placeholder="例如：粉色系、不要太甜；孩子对芒果过敏，刀具案板需专用；寿星有糖尿病请减糖……"
                    value={cake.styleNote} onChange={e => set({ styleNote: e.target.value })} />
                  <div className="hint">裱花师开制前会看到禁忌项并单独复核</div>
                </div>
                <div className="field">
                  <label>造型参考图（可选）</label>
                  <RefPhoto value={cake.styleRefPhoto} onChange={d => set({ styleRefPhoto: d })} />
                </div>
              </div>

              <div className="card">
                <h3>✍️ 蛋糕题字</h3>
                <input className="input" maxLength={22} placeholder="如：小团子 5 岁生日快乐（限 22 字）"
                  value={cake.inscription} onChange={e => set({ inscription: e.target.value })} />
                <div className="row mt8" style={{ justifyContent: 'space-between' }}>
                  <span className="tiny muted">{cake.inscription.length}/22 字</span>
                  <span className="tiny">题字内容会经过敏感内容审核</span>
                </div>
                {sensitive.length > 0 && (
                  <Notice kind="warn" title="题字可能含敏感内容" >
                    命中：{sensitive.join('、')}。可以直接提交，订单将转客服人工审核——审核通过前裱花师不会开制，避免返工；客服会在订单内与您沟通替代文案。
                  </Notice>
                )}
              </div>

              <div className="grid cols-2">
                <div className="card">
                  <h3>🕯️ 蜡烛</h3>
                  <div className="tiles">
                    {cat.candles.map(c => (
                      <button key={c.id} className={`tile ${cake.candleId === c.id ? 'sel' : ''}`} onClick={() => set({ candleId: c.id })}>
                        <div className="t-name">{c.name}{c.badge && <Badge kind="orange">{c.badge}</Badge>}</div>
                        <div className="t-price">{c.price ? `+¥${c.price}` : '免费'}</div>
                      </button>
                    ))}
                  </div>
                  {cake.candleId !== 'none_c' && (
                    <div className="field mt12">
                      <label>数字蜡烛年龄 / 蜡烛数量</label>
                      <input className="input" type="number" min={1} max={99} value={cake.candleCount}
                        onChange={e => set({ candleCount: Number(e.target.value) })} />
                    </div>
                  )}
                </div>
                <div className="card">
                  <h3>🍴 餐具</h3>
                  <div className="field">
                    <label>一次性刀叉盘套装：{cake.tablewareSets} 套</label>
                    <input type="range" min={0} max={20} value={cake.tablewareSets} style={{ width: '100%', accentColor: 'var(--brand)' }}
                      onChange={e => set({ tablewareSets: Number(e.target.value) })} />
                    <div className="hint">前 6 套免费，超出部分 ¥2/套</div>
                  </div>
                  <label className={`check-row ${cake.needColdChain ? 'sel' : ''}`}>
                    <input type="checkbox" checked={cake.needColdChain} onChange={e => set({ needColdChain: e.target.checked })} />
                    <span className="small"><b>需要冷藏运输/全程冷链保温袋</b>（+¥{cat.coldChainFee}）<br />动物奶油与鲜果款强烈建议勾选</span>
                  </label>
                  {cake.needColdChain && !store.coldChainAvailable && (
                    <div className="small" style={{ color: 'var(--danger)' }}>⚠ 当前所选门店不支持冷链，请更换门店或取消勾选</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid">
              <div className="card">
                <h3>🏪 取货门店与时段</h3>
                <div className="tiles">
                  {boot!.stores.map(s => (
                    <button key={s.id} className={`tile ${storeId === s.id ? 'sel' : ''}`}
                      onClick={() => setStoreId(s.id)}>
                      <div className="t-name">{s.name}</div>
                      <div className="t-desc">{s.address} · {s.phone}</div>
                      <div className="t-desc">{s.coldChainAvailable ? '✅ 支持冷藏运输' : '⛔ 暂不支持冷链'}</div>
                    </button>
                  ))}
                </div>
                <div className="inline-fields mt12">
                  <div className="field">
                    <label>取货日期</label>
                    <input className="input" type="date" min={todayPlus(1)} value={pickupDate}
                      onChange={e => setPickupDate(e.target.value)} />
                  </div>
                </div>
                <label className="small muted">取货时段（深色为当日已约满/拥挤度）</label>
                <div className="chips mt8">
                  {cat.slots.map(sl => {
                    const info = cap?.slots.find(x => x.slot === sl)
                    const ratio = info ? info.used / info.capacity : 0
                    return (
                      <button key={sl} className={`chip ${slot === sl ? 'sel' : ''}`} onClick={() => setSlot(sl)}>
                        {sl}
                        <span className="n">{info ? `${info.used}/${info.capacity}` : ''}</span>
                        {ratio >= 1 ? ' 🔥' : ratio >= 0.75 ? ' 🟠' : ''}
                      </button>
                    )
                  })}
                </div>
                <div className="small muted mt8">
                  当日冷柜占用：{cap ? `${cap.fridgeUsed}/${cap.fridgeCapacity} 标位` : '加载中…'}
                  {cap && cap.fridgeUsed >= cap.fridgeCapacity && <b style={{ color: 'var(--danger)' }}>（已满，接单后可能需客服调度）</b>}
                </div>
              </div>

              <div className="grid cols-2">
                <div className="card">
                  <h3>🎁 生日对象</h3>
                  <div className="inline-fields">
                    <div className="field"><label>称呼/姓名</label><input className="input" value={bpName} onChange={e => setBpName(e.target.value)} placeholder="如：小团子" /></div>
                    <div className="field"><label>关系</label>
                      <select className="input" value={bpRelation} onChange={e => setBpRelation(e.target.value)}>
                        {['本人', '子女', '父母', '伴侣', '朋友', '同事', '其他'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>年龄（可选）</label><input className="input" value={bpAge} onChange={e => setBpAge(e.target.value)} /></div>
                    <div className="field"><label>性别（可选）</label>
                      <select className="input" value={bpGender} onChange={e => setBpGender(e.target.value)}>
                        <option value="">保密</option><option>女</option><option>男</option><option>其他</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <h3>📞 联系人</h3>
                  <div className="field"><label>取货联系人</label><input className="input" value={contactName} onChange={e => setContactName(e.target.value)} /></div>
                  <div className="field"><label>手机号（取货码与变更通知）</label><input className="input" maxLength={11} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} />
                    {phone && !/^1\d{10}$/.test(phone) && <div className="tiny" style={{ color: 'var(--danger)' }}>请输入 11 位手机号</div>}
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>🧾 发票信息</h3>
                <label className={`check-row ${invNeeded ? 'sel' : ''}`}>
                  <input type="checkbox" checked={invNeeded} onChange={e => setInvNeeded(e.target.checked)} />
                  <span className="small">需要开具电子普通发票（取货后 1-3 个工作日发送邮箱）</span>
                </label>
                {invNeeded && (
                  <div className="inline-fields mt12">
                    <div className="field" style={{ gridColumn: '1/-1' }}><label>发票抬头</label><input className="input" value={invTitle} onChange={e => setInvTitle(e.target.value)} placeholder="个人 / 单位全称" /></div>
                    <div className="field"><label>税号（单位必填）</label><input className="input" value={invTaxNo} onChange={e => setInvTaxNo(e.target.value)} /></div>
                    <div className="field"><label>接收邮箱</label><input className="input" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="name@example.com" /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid">
              <ConfirmCard title="蛋糕配置" rows={[
                ['尺寸', cat.sizes.find(s => s.id === cake.sizeId)?.name],
                ['胚底 / 奶油', `${cat.bases.find(b => b.id === cake.baseId)?.name} / ${cat.creams.find(c => c.id === cake.creamId)?.name}`],
                ['夹心', cake.fillingIds.map(id => cat.fillings.find(f => f.id === id)?.name).join('、') || '无'],
                ['水果', cake.fruitIds.map(id => cat.fruits.find(f => f.id === id)?.name).join('、') || '无'],
                ['规避过敏原', cake.avoidAllergenIds.map(id => cat.allergens.find(a => a.id === id)?.name).join('、') || '无特殊规避']
              ]} />
              <ConfirmCard title="造型与题字" rows={[
                ['造型', cat.styles.find(s => s.id === cake.styleId)?.name],
                ['题字', cake.inscription],
                ['造型备注', cake.styleNote || '无'],
                ['参考图', cake.styleRefPhoto ? '已上传 1 张' : '无'],
                ['蜡烛 / 餐具', `${cat.candles.find(c => c.id === cake.candleId)?.name}${cake.candleId !== 'none_c' ? ` ×${cake.candleCount}` : ''} / ${cake.tablewareSets} 套`],
                ['冷藏运输', cake.needColdChain ? `需要（+¥${cat.coldChainFee}）` : '不需要']
              ]} />
              <ConfirmCard title="取货与联系人" rows={[
                ['门店', `${store.name}（${store.address}）`],
                ['取货时间', `${fmtDate(pickupDate)} ${slot}`],
                ['最晚修改', fmtDate(latestModify.slice(0, 10)) + ' 前一晚 18:00（以订单页倒计时为准）'],
                ['生日对象', `${bpName || contactName} · ${bpRelation}${bpAge ? ` · ${bpAge} 岁` : ''}`],
                ['联系人', `${contactName} ${phone}`],
                ['发票', invNeeded ? `${invTitle}${invTaxNo ? ' / ' + invTaxNo : ''}` : '不开票']
              ]} />
              {sensitive.length > 0 && (
                <Notice kind="warn" title="本单题字将进入人工审核">
                  提交后订单正常生成，门店不会按敏感题字制作；客服会在订单中给出替代方案，您确认后才会落单制作。
                </Notice>
              )}
              <label className="check-row sel">
                <input type="checkbox" checked={cake.inscriptionApproved} onChange={e => set({ inscriptionApproved: e.target.checked })} />
                <span className="small">我确认题字、过敏原信息与取货时间无误，并同意《定制蛋糕退换规则》：定制商品仅在取货前 {cat.modifyLeadHours} 小时可免费修改，临时改期/换店需客服评估。</span>
              </label>
            </div>
          )}

          <div className="row end mt16">
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>上一步</button>}
            {step < 3
              ? <button className="btn primary" disabled={!canNext[step]} onClick={() => setStep(step + 1)}>下一步</button>
              : <button className="btn primary" disabled={!cake.inscriptionApproved || submitting} onClick={submit}>
                {submitting ? '提交中…' : `确认支付 ¥${price.total} 提交定制`}
              </button>}
          </div>
        </div>

        {/* 右侧实时订单摘要 */}
        <div className="card" style={{ position: 'sticky', top: 78 }}>
          <h3>🧾 实时报价</h3>
          <div className="kv">
            <span className="k">蛋糕主体</span><span className="v">¥{price.base}</span>
            <span className="k">口味加价</span><span className="v">¥{price.addons}</span>
            <span className="k">冷藏运输</span><span className="v">{price.coldChain ? `¥${price.coldChain}` : '—'}</span>
          </div>
          <div style={{ borderTop: '1px dashed var(--line)', margin: '10px 0' }} />
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>预估合计</b><b style={{ color: 'var(--brand-dark)', fontSize: 22 }}>¥{price.total}</b>
          </div>
          <div className="tiny muted mt8">后续若因缺货、改期、换店产生费用调整，会以工单形式列明原因，经您确认后才生效；退款原路返回。</div>
          <div className="mt12"><Badge kind="blue">取货前 {cat.modifyLeadHours}h 可改</Badge></div>
        </div>
      </div>
    </div>
  )
}

function ConfirmCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="kv">
        {rows.map(([k, v]) => <React.Fragment key={k}><span className="k">{k}</span><span className="v">{v || '—'}</span></React.Fragment>)}
      </div>
    </div>
  )
}

function RefPhoto({ value, onChange }: { value?: string; onChange: (d?: string) => void }) {
  if (value) return (
    <div className="photo-box" style={{ maxWidth: 280 }}>
      <img className="photo-thumb" src={value} alt="参考图" />
      <button className="btn sm danger rm" onClick={() => onChange(undefined)}>删除</button>
    </div>
  )
  return (
    <label className="photo-add" style={{ maxWidth: 280 }}>
      <input type="file" accept="image/*" hidden onChange={e => {
        const f = e.target.files?.[0]; if (!f) return
        const r = new FileReader()
        r.onload = () => {
          const img = new Image()
          img.onload = () => {
            const c = document.createElement('canvas'); const max = 900
            const sc = Math.min(1, max / Math.max(img.width, img.height))
            c.width = img.width * sc; c.height = img.height * sc
            c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
            onChange(c.toDataURL('image/jpeg', 0.72))
          }
          img.src = String(r.result)
        }
        r.readAsDataURL(f)
      }} />
      ＋ 上传造型参考图（裱花师开制前查看）
    </label>
  )
}
