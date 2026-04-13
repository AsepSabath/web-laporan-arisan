import { Route, Routes } from 'react-router-dom'
import AdminPage from './pages/AdminPage'
import PublicPage from './pages/PublicPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
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
