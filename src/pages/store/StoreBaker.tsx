import { useEffect, useMemo, useState } from 'react'
import { useStore, catName } from '../../store'
import {
  Badge, Notice, Modal, EmptyState,
  STATUS_STYLE, STATUS_TEXT, PAY_TEXT, fmtDateTime, fmtDate
} from '../../components/ui'
import type { Order } from '../../../shared/types'

const FRUIT_ICON: Record<string, string> = { strawberry: '🍓', blueberry: '🫐', mango_fruit: '🥭', fig: '🍑' }

export default function StoreBaker({ onOpen }: { onOpen: (id: string) => void }) {
  const { account, orders, boot, refreshOrders } = useStore()
  useEffect(() => { refreshOrders() }, [])

  const cols: { key: string; title: string; statuses: Order['status'][]; hint: string }[] = [
    { key: 'todo', title: '待接单 / 备料', statuses: ['pending_accept', 'accepted'], hint: '接单后按禁忌备料' },
    { key: 'making', title: '裱花制作中', statuses: ['producing'], hint: '题字/造型开制前再核对一次' },
    { key: 'ready', title: '待取货 / 已交付', statuses: ['ready', 'verified', 'picked_up'], hint: '交付前必须上传三类照片' }
  ]

  return (
    <div>
      <h2 className="pagename">👩‍🍳 裱花师制作看板 · {boot?.stores.find(s => s.id === account?.storeId)?.name}</h2>
      <div className="pagesub">按取货时间排序：先看制作时间与特殊禁忌，再看题字与造型参考；任何缺货/返工都登记回原订单，客服与顾客实时可见</div>

      <RemakeBoard orders={orders} onOpen={onOpen} />

      <div className="kanban">
        {cols.map(col => {
          const list = orders.filter(o => col.statuses.includes(o.status))
            .sort((a, b) => (a.pickupDate + a.slot).localeCompare(b.pickupDate + b.slot))
          return (
            <div className="kcol" key={col.key}>
              <h4>{col.title} <span className="kcount">{list.length}</span></h4>
              {list.length === 0 && <div className="tiny muted" style={{ padding: '4px 6px' }}>{col.hint}</div>}
              <div className="grid" style={{ gap: 10 }}>
                {list.map(o => <BakerCard key={o.id} o={o} onOpen={onOpen} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BakerCard({ o, onOpen }: { o: Order; onOpen: (id: string) => void }) {
  const { boot, act, openOrder } = useStore()
  const cat = boot!.catalog
  const blockedCase = o.cases.find(c => c.status !== 'resolved' && c.status !== 'closed' && c.status !== 'rejected'
    && ['sensitive_inscription', 'fruit_shortage'].includes(c.kind))
  const [matOpen, setMatOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [shortOpen, setShortOpen] = useState(false)
  const [reworkOpen, setReworkOpen] = useState(false)
  const overdue = useMemo(() => {
    const due = new Date(`${o.pickupDate}T${o.slot.slice(0,2)}:00:00`).getTime() - 2 * 3600 * 1000
    return due < Date.now() && ['accepted', 'producing'].includes(o.status)
  }, [o])

  return (
    <div className="card" style={{ padding: 13, borderLeft: blockedCase ? '3px solid var(--danger)' : overdue ? '3px solid var(--warn)' : undefined }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn sm ghost" style={{ padding: 0, fontWeight: 800, fontSize: 14 }} onClick={() => onOpen(o.id)}>{o.id}</button>
        <Badge kind={STATUS_STYLE[o.status]}>{STATUS_TEXT[o.status]}</Badge>
      </div>
      <div className="small mt8">
        🕑 <b>{fmtDate(o.pickupDate)} {o.slot}</b> 取
        <span className="muted">（建议 {new Date(new Date(`${o.pickupDate}T${o.slot.slice(0, 2)}:00`).getTime() - 2 * 3600e3).getHours()}:00 前完成）</span>
        {overdue && <Badge kind="orange">临近取货</Badge>}
      </div>
      <div className="small mt8">🎂 {catName(cat, 'sizes', o.cake.sizeId)} · {catName(cat, 'styles', o.cake.styleId)}</div>
      <div className="small">✍️ 题字：<b>{o.cake.inscription || '无题字'}</b></div>
      {o.cake.avoidAllergenIds.length > 0 && (
        <div className="mt8"><Badge kind="red">⚠ 规避：{o.cake.avoidAllergenIds.map(id => catName(cat, 'allergens', id)).join('、')}</Badge></div>
      )}
      {o.cake.styleNote && <div className="tiny muted mt8">备注：{o.cake.styleNote}</div>}

      {blockedCase && (
        <Notice kind="danger" title={blockedCase.kind === 'sensitive_inscription' ? '题字待确认，禁止开制' : '原料缺货待方案'}>
          <span className="small">{blockedCase.title}</span>
        </Notice>
      )}

      <div className="row mt8" style={{ gap: 6 }}>
        {o.status === 'accepted' && (
          <>
            <button className="btn sm" onClick={() => setMatOpen(true)}>{o.materialsReadyAt ? '✓ 备料完成' : '登记原料准备'}</button>
            <button className="btn sm primary" onClick={async () => { const r = await act(o.id, 'start_producing'); if (r) openOrder(o.id) }}>开始制作</button>
          </>
        )}
        {o.status === 'producing' && (
          <>
            <button className="btn sm" onClick={() => setReworkOpen(true)}>登记返工</button>
            <button className="btn sm primary" onClick={() => setPhotoOpen(true)}>上传交付照片</button>
          </>
        )}
        {(o.status === 'ready' || o.status === 'picked_up') && (
          <button className="btn sm" onClick={() => setPhotoOpen(true)}>补传/查看照片</button>
        )}
        <button className="btn sm ghost" onClick={() => setShortOpen(true)}>报缺货</button>
      </div>
      <div className="tiny muted mt8">
        {o.materialsReadyAt ? `原料已于 ${fmtDateTime(o.materialsReadyAt)} 备齐` : '原料准备尚未登记'} · 返工 {o.reworks.length} 次
      </div>

      {matOpen && <MaterialsModal o={o} onClose={() => setMatOpen(false)} />}
      {photoOpen && <PhotosModal o={o} onClose={() => setPhotoOpen(false)} />}
      {shortOpen && <ShortageModal o={o} onClose={() => setShortOpen(false)} />}
      {reworkOpen && <ReworkModal o={o} onClose={() => setReworkOpen(false)} />}
    </div>
  )
}

function MaterialsModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const { act, openOrder } = useStore()
  const cat = useStore(s => s.boot)!.catalog
  const preset = [
    `${catName(cat, 'sizes', o.cake.sizeId)}胚 ×1`,
    `${catName(cat, 'creams', o.cake.creamId)} 按单`,
    ...o.cake.fillingIds.map(id => `夹心：${catName(cat, 'fillings', id)}`),
    ...o.cake.fruitIds.filter(id => id !== 'none_fruit').map(id => `${FRUIT_ICON[id] || ''} ${catName(cat, 'fruits', id)} 新鲜备货`),
    ...(o.cake.avoidAllergenIds.length ? [`⚠ 专用工具台，规避 ${o.cake.avoidAllergenIds.map(x => catName(cat, 'allergens', x)).join('、')}`] : [])
  ].join('\n')
  const [note, setNote] = useState(o.materialsNote || preset)
  return (
    <Modal title={`原料准备 · ${o.id}`} onClose={onClose}
      footer={<button className="btn primary" onClick={async () => { const r = await act(o.id, 'mark_materials', { note }); if (r) { onClose(); openOrder(o.id) } }}>确认备料完成</button>}>
      <div className="small muted mb8">逐项核对后再勾选；记录会同步给前台与客服，作为排产依据。</div>
      <textarea className="input" rows={7} value={note} onChange={e => setNote(e.target.value)} />
    </Modal>
  )
}

function PhotosModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const { act, openOrder } = useStore()
  const [photos, setPhotos] = useState(o.photos)
  const save = async (next: typeof photos) => {
    setPhotos(next)
    const r = await act(o.id, 'upload_photos', { photos: next }, { silent: true })
    if (r) openOrder(o.id)
  }
  return (
    <Modal title={`交付照片 · ${o.id}`} onClose={onClose} wide
      footer={<div className="small muted">成品照片 + 包装照片齐备后订单自动进入「待取货」；{o.cake.needColdChain ? '本单需要冷藏运输，冷藏提示卡必传。' : '建议上传冷藏提示卡。'}</div>}>
      <div className="grid cols-3">
        <PhotoUpload label="成品照片（核对造型/题字）" value={photos.final} onChange={v => save({ ...photos, final: v })} />
        <PhotoUpload label="包装照片（封签/餐具/蜡烛）" value={photos.package} onChange={v => save({ ...photos, package: v })} />
        <PhotoUpload label="冷藏提示卡（必传冷链单）" value={photos.coldNotice} onChange={v => save({ ...photos, coldNotice: v })} />
      </div>
      <div className="tiny muted mt8">照片将作为顾客取货核对与售后判定依据；上传后立刻出现在顾客端与前台核验页。</div>
    </Modal>
  )
}

function PhotoUpload({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  return (
    <div>
      {value
        ? <div className="photo-box"><img className="photo-thumb" src={value} /><button className="btn sm danger rm" onClick={() => onChange(undefined)}>重拍</button></div>
        : <label className="photo-add"><input type="file" accept="image/*" hidden onChange={e => {
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
        }} />＋ {label}</label>}
      <div className="tiny muted mt8" style={{ textAlign: 'center' }}>{label}</div>
    </div>
  )
}

function ShortageModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const { act, openOrder, setStock } = useStore()
  const cat = useStore(s => s.boot)!.catalog
  const [fruitId, setFruitId] = useState(o.cake.fruitIds[0] || 'strawberry')
  const [note, setNote] = useState('')
  return (
    <Modal title="登记原料缺货" onClose={onClose}
      footer={<button className="btn danger" onClick={async () => {
        const r = await act(o.id, 'fruit_shortage', { fruitId, note })
        if (r) { await setStock(o.storeId, { [fruitId]: 'out' }); onClose(); openOrder(o.id) }
      }}>标记缺货并通知客服</button>}>
      <Notice kind="warn" title="登记后自动开启客服工单">客服将向顾客提出替代/退款方案，顾客确认前不得使用替代原料；同时更新门店库存看板。</Notice>
      <div className="field mt12"><label>缺货原料</label>
        <select className="input" value={fruitId} onChange={e => setFruitId(e.target.value)}>
          {cat.fruits.filter(f => f.id !== 'none_fruit').map(f => <option key={f.id} value={f.id}>{FRUIT_ICON[f.id] || ''} {f.name}</option>)}
        </select>
      </div>
      <div className="field"><label>现场情况（批次/预计到货）</label><textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="如：今早到货批次霉变，已拒收；预计明天下午补" /></div>
    </Modal>
  )
}

function ReworkModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const { act, openOrder } = useStore()
  const [reason, setReason] = useState('造型与参考图不符')
  const [note, setNote] = useState('')
  const [cost, setCost] = useState(30)
  return (
    <Modal title={`登记裱花返工 · ${o.id}`} onClose={onClose}
      footer={<button className="btn primary" onClick={async () => {
        const r = await act(o.id, 'log_rework', { reason, note, cost })
        if (r) { onClose(); openOrder(o.id) }
      }}>保存返工记录</button>}>
      <div className="small muted">返工数据用于门店复盘：哪些造型返工多、内部损耗多少；顾客端可看到透明披露。</div>
      <div className="field mt12"><label>返工原因</label>
        <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
          {['造型与参考图不符', '题字书写失误', '颜色调色偏差', '运输挤压变形', '原料状态不佳', '顾客临时变更', '其他']}
        </select>
      </div>
      <div className="field"><label>返工说明</label><textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="具体部位、处理方式" /></div>
      <div className="field"><label>估算内部成本（¥）</label><input className="input" type="number" value={cost} onChange={e => setCost(Number(e.target.value))} /></div>
    </Modal>
  )
}

// 售后补做看板：补做会重新生成制作排班与取货时间
function RemakeBoard({ orders, onOpen }: { orders: Order[]; onOpen: (id: string) => void }) {
  const { act, openOrder } = useStore()
  const remakes = orders.flatMap(o => (o.remakes || []).map(r => ({ o, r })))
    .filter(({ r }) => r.status !== 'picked_up')
    .sort((a, b) => (a.r.pickupDate + a.r.slot).localeCompare(b.r.pickupDate + b.r.slot))
  if (remakes.length === 0) return null
  const ST: Record<string, string> = {
    scheduled: '已排班·待备料', materials: '备料完成', producing: '补做制作中', ready: '待取货', picked_up: '已取货'
  }
  const next: Record<string, 'materials' | 'start' | 'ready' | 'pickup'> = {
    scheduled: 'materials', materials: 'start', producing: 'ready', ready: 'pickup'
  }
  const NEXT_LABEL: Record<string, string> = {
    materials: '登记补做备料', start: '开始补做制作', ready: '补做完成（上传成品）', pickup: '前台确认取货'
  }
  return (
    <div className="card mt12" style={{ borderLeft: '4px solid var(--brand)' }}>
      <h3 style={{ marginTop: 0 }}>🎂 售后补做排班（{remakes.length}）<span className="sec-sub">取货后造型申诉判定补做，系统已重新排定制作与取货时间</span></h3>
      <div className="grid cols-2 mt8" style={{ gap: 10 }}>
        {remakes.map(({ o, r }) => (
          <div key={r.id} className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="btn sm ghost" style={{ padding: 0, fontWeight: 800 }} onClick={() => onOpen(o.id)}>{o.id}</button>
              <Badge kind="violet">{ST[r.status]}</Badge>
            </div>
            <div className="small mt8">🕑 新取货 <b>{fmtDate(r.pickupDate)} {r.slot}</b></div>
            <div className="tiny muted">制作开始 {fmtDateTime(r.makeStart)}</div>
            <div className="tiny mt8">🎂 {catName(useStore.getState().boot!.catalog, 'styles', o.cake.styleId)} · 题字「{o.cake.inscription}」</div>
            <div className="tiny muted" style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div>
            {r.status !== 'picked_up' &&
              <button className="btn sm primary mt8" onClick={async () => {
                const res = await act(o.id, 'remake_action', { remakeId: r.id, step: next[r.status] })
                if (res) openOrder(o.id)
              }}>{NEXT_LABEL[next[r.status]]}</button>}
            {r.status === 'ready' && <div className="tiny mt8" style={{ color: 'var(--ok)' }}>成品已就绪，请通知顾客按新时间到店，由前台核验交付。</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
