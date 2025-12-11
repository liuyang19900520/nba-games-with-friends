import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { HomePage } from './pages/HomePage';
import { LeaguesPage } from './pages/LeaguesPage';
import { LineupPage } from './pages/LineupPage';
import { MatchupsPage } from './pages/MatchupsPage';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto min-h-screen">
        <Routes>
          <Route path="/" element={<Navigate to="/lineup" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/leagues" element={<LeaguesPage />} />
          <Route path="/lineup" element={<LineupPage />} />
          <Route path="/matchups" element={<MatchupsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/lineup" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
