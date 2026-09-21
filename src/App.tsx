import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Toasts } from './components/ui'
import Login from './pages/Login'
import CustomerOrders from './pages/customer/CustomerOrders'
import CustomerOrderDetail from './pages/customer/CustomerOrderDetail'
import NewOrder from './pages/customer/NewOrder'
import StoreBaker from './pages/store/StoreBaker'
import StoreFront from './pages/store/StoreFront'
import StoreOrderDetail from './pages/store/StoreOrderDetail'
import CSConsole from './pages/cs/CSConsole'
import CSOrderDetail from './pages/cs/CSOrderDetail'

type Route =
  | { name: 'customer-list' } | { name: 'customer-new' } | { name: 'customer-order'; id: string }
  | { name: 'baker' } | { name: 'front' } | { name: 'store-order'; id: string }
  | { name: 'cs' } | { name: 'cs-order'; id: string }

const ROLE_LABEL: Record<string, string> = {
  customer: '顾客', baker: '裱花师', front: '门店前台', cs: '客服/督导'
}

export default function App() {
  const { account, boot, init, logout, refreshOrders } = useStore()
  const [route, setRoute] = useState<Route>({ name: 'customer-list' })

  useEffect(() => { init() }, [])
  useEffect(() => {
    if (!account) return
    refreshOrders()
    const t = setInterval(refreshOrders, 15000) // 三端状态一致：15s 轮询
    return () => clearInterval(t)
  }, [account?.id])

  // 角色切换时落到默认首页
  useEffect(() => {
    if (!account) return
    if (account.role === 'customer') setRoute(r => r.name.startsWith('customer') ? r : { name: 'customer-list' })
    if (account.role === 'baker') setRoute(r => r.name === 'baker' || r.name === 'store-order' ? r : { name: 'baker' })
    if (account.role === 'front') setRoute(r => r.name === 'front' || r.name === 'store-order' ? r : { name: 'front' })
    if (account.role === 'cs') setRoute(r => r.name === 'cs' || r.name === 'cs-order' ? r : { name: 'cs' })
  }, [account?.id])

  if (!boot) return <div style={{ padding: 40, textAlign: 'center' }} className="muted">正在加载…</div>
  if (!account) return <><Login /><Toasts /></>

  const storeName = account.storeId ? boot.stores.find(s => s.id === account.storeId)?.name : ''

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="logo">🍰</span> 甜星烘焙工作室</div>
        <nav className="topnav">
          {account.role === 'customer' && <>
            <button className={route.name === 'customer-list' ? 'active' : ''} onClick={() => setRoute({ name: 'customer-list' })}>我的订单</button>
            <button className={route.name === 'customer-new' ? 'active' : ''} onClick={() => setRoute({ name: 'customer-new' })}>定制新蛋糕</button>
          </>}
          {account.role === 'baker' && <button className={route.name === 'baker' ? 'active' : ''} onClick={() => setRoute({ name: 'baker' })}>制作看板</button>}
          {account.role === 'front' && <button className={route.name === 'front' ? 'active' : ''} onClick={() => setRoute({ name: 'front' })}>前台工作台</button>}
          {account.role === 'cs' && <button className={route.name === 'cs' ? 'active' : ''} onClick={() => setRoute({ name: 'cs' })}>客服工单台</button>}
        </nav>
        <div className="spacer" />
        <div className="who">
          <b>{account.name}</b> · <Badge>{ROLE_LABEL[account.role]}</Badge>{storeName && <span className="muted"> · {storeName}</span>}
        </div>
        <button className="btn sm" onClick={logout}>退出</button>
      </header>

      <main className="page">
        {route.name === 'customer-list' && <CustomerOrders onOpen={id => setRoute({ name: 'customer-order', id })} onNew={() => setRoute({ name: 'customer-new' })} />}
        {route.name === 'customer-new' && <NewOrder onDone={id => setRoute({ name: 'customer-order', id })} onCancel={() => setRoute({ name: 'customer-list' })} />}
        {route.name === 'customer-order' && <CustomerOrderDetail id={route.id} onBack={() => setRoute({ name: 'customer-list' })} />}

        {route.name === 'baker' && <StoreBaker onOpen={id => setRoute({ name: 'store-order', id })} />}
        {route.name === 'front' && <StoreFront onOpen={id => setRoute({ name: 'store-order', id })} />}
        {route.name === 'store-order' && <StoreOrderDetail id={route.id} onBack={() => setRoute({ name: account.role === 'front' ? 'front' : 'baker' } as Route)} />}

        {route.name === 'cs' && <CSConsole onOpen={id => setRoute({ name: 'cs-order', id })} />}
        {route.name === 'cs-order' && <CSOrderDetail id={route.id} onBack={() => setRoute({ name: 'cs' })} />}
      </main>

      <Toasts />
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge pink" style={{ margin: '0 2px' }}>{children}</span>
}
