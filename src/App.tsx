import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import GamesList from './components/games/GamesList'
import GameDetail from './components/games/GameDetail'
import PlayersAdmin from './components/admin/PlayersAdmin'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<GamesList />} />
          <Route path="games/:id" element={<GameDetail />} />
          <Route path="admin" element={<PlayersAdmin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
