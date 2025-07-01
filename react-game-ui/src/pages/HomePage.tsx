import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import TopAppBar from '../components/layout/TopAppBar';
import GameCard from '../components/common/GameCard';

const resultsData = [
    {
        awayTeam: { name: 'Lakers', logo: '/lakers.png', score: 112 },
        homeTeam: { name: 'Celtics', logo: '/celtics.png', score: 108 },
        status: 'Final' as const,
    },
    {
        awayTeam: { name: 'Warriors', logo: '/warriors.png', score: 105 },
        homeTeam: { name: 'Nets', logo: '/nets.png', score: 100 },
        status: 'Final' as const,
    },
    {
        awayTeam: { name: 'Heat', logo: '/heat.png', score: 118 },
        homeTeam: { name: 'Bucks', logo: '/bucks.png', score: 115 },
        status: 'Final' as const,
    },
];

const scheduleData = [
    {
        awayTeam: { name: 'Raptors', logo: '/raptors.png' },
        homeTeam: { name: '76ers', logo: '/76ers.png' },
        status: 'Scheduled' as const,
        time: '7:00 PM',
    },
    {
        awayTeam: { name: 'Clippers', logo: '/clippers.png' },
        homeTeam: { name: 'Nuggets', logo: '/nuggets.png' },
        status: 'Scheduled' as const,
        time: '8:30 PM',
    },
    {
        awayTeam: { name: 'Suns', logo: '/suns.png' },
        homeTeam: { name: 'Mavericks', logo: '/mavericks.png' },
        status: 'Scheduled' as const,
        time: '10:00 PM',
    },
];


const HomePage: React.FC = () => {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    return (
        <Box>
            <TopAppBar title="NBA" showSettingsButton />
            <Box>
                <Tabs value={tabIndex} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="fullWidth">
                    <Tab label="Today" />
                    <Tab label="Tomorrow" />
                </Tabs>
                {tabIndex === 0 && (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Results</Typography>
                        {resultsData.map((game, index) => (
                            <GameCard key={index} {...game} />
                        ))}
                    </Box>
                )}
                {tabIndex === 1 && (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Tomorrow</Typography>
                        {scheduleData.map((game, index) => (
                            <GameCard key={index} {...game} />
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default HomePage; 