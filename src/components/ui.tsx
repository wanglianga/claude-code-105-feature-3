import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { OrderStatus, CaseStatus } from '../../shared/types'

export const money = (n: number) => `¥${n.toFixed(0)}`

export function fmtDateTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso), p = (x: number) => String(x).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日（${'日一二三四五六'[d.getDay()]}）`
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  pending_accept: 'orange', accepted: 'blue', producing: 'violet',
  ready: 'pink', verified: 'blue', picked_up: 'green', closed: 'gray', cancelled: 'gray'
}
export const STATUS_TEXT: Record<OrderStatus, string> = {
  pending_accept: '待门店接单', accepted: '已接单·备料', producing: '裱花制作中',
  ready: '待取货', verified: '已核验', picked_up: '已签收', closed: '售后关闭', cancelled: '已取消'
}
export const PAY_TEXT: Record<string, { t: string; c: string }> = {
  unpaid: { t: '未支付', c: 'red' }, partial: { t: '部分支付/待补差', c: 'orange' },
  paid: { t: '已支付', c: 'green' }, refunded: { t: '已退款', c: 'gray' }
}
export const CASE_STATUS: Record<CaseStatus, { t: string; c: string }> = {
  open: { t: '待客服处理', c: 'red' }, awaiting_customer: { t: '待顾客确认', c: 'orange' },
  resolved: { t: '已解决', c: 'green' }, rejected: { t: '已驳回', c: 'gray' }, closed: { t: '已关闭', c: 'gray' }
}

export function Badge({ kind = 'gray', children }: { kind?: string; children: React.ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>
}

export function Notice({ kind = 'info', title, children, actions }: {
  kind?: 'info' | 'warn' | 'danger' | 'ok'; title?: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <div className={`notice ${kind}`}>
      {title && <div className="n-title">{title}</div>}
      {children != null && <div className="n-body">{children}</div>}
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide, footer }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode
}) {
  return (
    <div className="modal-mask" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn sm ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
          {footer && <div className="row end mt12">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toast-wrap">
      {toasts.map(t => <div key={t.id} className={`toast ${t.kind === 'ok' ? 'ok' : t.kind === 'err' ? 'err' : ''}`}>{t.text}</div>)}
    </div>
  )
}

export function useCountdown(targetIso?: string | null) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!targetIso) return
    const t = setInterval(() => tick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [targetIso])
  if (!targetIso) return null
  const ms = new Date(targetIso).getTime() - Date.now()
  if (ms <= 0) return { over: true, text: '已截止' }
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  const m = Math.floor((ms % 3600000) / 60000)
  const text = d > 0 ? `剩 ${d} 天 ${h % 24} 小时` : h > 0 ? `剩 ${h} 小时 ${m} 分` : `剩 ${m} 分钟`
  return { over: false, text }
}

export function Stepper({ status }: { status: OrderStatus }) {
  const steps: { key: OrderStatus[]; label: string }[] = [
    { key: ['pending_accept'], label: '门店接单' },
    { key: ['accepted'], label: '备料' },
    { key: ['producing'], label: '裱花制作' },
    { key: ['ready'], label: '门店待取' },
    { key: ['verified', 'picked_up', 'closed'], label: '核验签收' },
    { key: ['closed'], label: '售后关闭' }
  ]
  const order: OrderStatus[] = ['pending_accept', 'accepted', 'producing', 'ready', 'verified', 'picked_up', 'closed']
  const cur = status === 'cancelled' ? -1 : order.indexOf(status)
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.key[0])
        const state = cur > idx || (i === steps.length - 2 && ['picked_up', 'closed'].includes(status)) ? 'done' : cur === idx ? 'active' : ''
        return (
          <div key={i} className={`step ${state}`}>
            <div className="s-dot">{state === 'done' ? '✓' : i + 1}</div>
            <div className="s-label">{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export function FilePhoto({ label, value, onChange }: { label: string; value?: string; onChange: (data: string | undefined) => void }) {
  const handle = (f?: File) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      // 简单压缩，避免超过 body 限制
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const max = 900
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        canvas.width = img.width * scale; canvas.height = img.height * scale
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        onChange(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(f)
  }
  return (
    <div className="photo-box">
      {value
        ? <>
            <img className="photo-thumb" src={value} alt={label} />
            <button className="btn sm danger rm" onClick={() => onChange(undefined)}>删除</button>
          </>
        : <label className="photo-add">
            <input type="file" accept="image/*" hidden onChange={e => handle(e.target.files?.[0])} />
            ＋ {label}
          </label>}
      <div className="tiny muted mt8" style={{ textAlign: 'center' }}>{label}</div>
    </div>
  )
}

export function EmptyState({ icon = '🎂', title, sub }: { icon?: string; title: string; sub?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '44px 20px' }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <h3 style={{ justifyContent: 'center', marginTop: 8 }}>{title}</h3>
      {sub && <div className="muted small mt8">{sub}</div>}
    </div>
  )
}

export function confirmDestructive(msg: string) { return window.confirm(msg) }
