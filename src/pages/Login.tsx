import { useState } from 'react'
import { useStore } from '../store'

const DEMO = [
  { username: 'customer', password: '123456', role: '顾客', desc: '李小满 · 下单/进度/售后' },
  { username: 'baker', password: '123456', role: '裱花师', desc: '陈裱花 · 湖滨道店制作端' },
  { username: 'front', password: '123456', role: '前台', desc: '王前台 · 接单/核验/收银' },
  { username: 'cs', password: '123456', role: '客服/督导', desc: '甜小橙 · 工单与复盘' }
]

export default function Login() {
  const { login } = useStore()
  const [u, setU] = useState('customer')
  const [p, setP] = useState('123456')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setErr(''); setBusy(true)
    try { await login(u, p) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-hero">
          <div className="hero-icon">🎂</div>
          <h2>甜星烘焙<br />生日蛋糕定制与门店取货</h2>
          <p>一套系统，三种节奏：顾客跟踪定制进度，门店盯制作与取货压力，客服处理改期、退款与售后——状态实时一致，减少生日当天的临时争议。</p>
          <div className="roles">
            <div>👤 顾客端：尺寸/胚底/奶油/夹心/水果/过敏原/造型/题字/蜡烛餐具/门店/最晚修改</div>
            <div>👩‍🍳 门店端：裱花师制作工单 + 前台接单与取货码核验 + 冷柜容量</div>
            <div>🛟 客服端：六类异常工单、费用调整与门店复盘看板</div>
          </div>
        </div>
        <div className="login-main">
          <h3 style={{ fontSize: 18 }}>登录演示账号</h3>
          <div className="field mt12">
            <label>用户名</label>
            <input className="input" value={u} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="field">
            <label>密码</label>
            <input className="input" type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          {err && <div className="tiny" style={{ color: 'var(--danger)', marginBottom: 8 }}>{err}</div>}
          <button className="btn primary block" onClick={submit} disabled={busy}>{busy ? '登录中…' : '进入系统'}</button>

          <div className="demo-accounts">
            {DEMO.map(d => (
              <button key={d.username} className="demo-account" onClick={() => { setU(d.username); setP(d.password) }}>
                <b>{d.username}</b><span className="muted">/ {d.password}</span>
                <span className="muted">· {d.desc}</span>
                <span className="da-role badge pink">{d.role}</span>
              </button>
            ))}
          </div>
          <div className="tiny muted mt12">点击账号自动填充；另有第二门店账号 baker2 / front2（春熙里店），customer2 是第二位顾客。</div>
        </div>
      </div>
    </div>
  )
}
