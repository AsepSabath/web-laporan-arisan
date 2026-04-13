import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import PublicPage from './pages/PublicPage'
import './App.css'

function App() {
  const location = useLocation()
  const isPublicRoute = location.pathname === '/'

  return (
    <div className="app-shell">
      {!isPublicRoute ? (
        <header className="topbar">
          <div>
            <h1>Laporan Arisan</h1>
            <p>Transparan, cepat, dan siap dipantau semua peserta.</p>
          </div>
          <nav>
            <Link to="/">Halaman Publik</Link>
            <Link to="/admin">Panel Admin</Link>
          </nav>
        </header>
      ) : null}

      <main>
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
