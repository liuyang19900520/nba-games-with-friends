import React from 'react';
import { Routes, Route } from 'react-router-dom';
import HomePage from '../pages/HomePage';
import StatsPage from '../pages/StatsPage';
import GamePage from '../pages/GamePage';
import ProfilePage from '../pages/ProfilePage';

const AppRouter: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/game" element={<GamePage />} />
            <Route path="/profile" element={<ProfilePage />} />
        </Routes>
    );
};

export default AppRouter; 