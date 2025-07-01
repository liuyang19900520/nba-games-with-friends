import React from 'react';
import { Card, CardContent, Typography, Box, Avatar } from '@mui/material';

interface Team {
    name: string;
    logo: string; // URL to logo
    score?: number;
}

interface GameCardProps {
    homeTeam: Team;
    awayTeam: Team;
    status: 'Final' | 'Scheduled';
    time?: string;
}

const GameCard: React.FC<GameCardProps> = ({ homeTeam, awayTeam, status, time }) => {
    return (
        <Card sx={{ mb: 2, borderRadius: 3 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Away Team */}
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '40%' }}>
                        <Avatar src={awayTeam.logo} sx={{ width: 40, height: 40, mr: 2 }} />
                        <Typography variant="body1" fontWeight="medium">{awayTeam.name}</Typography>
                    </Box>

                    {/* Score / Time */}
                    <Box sx={{ textAlign: 'center', width: '20%' }}>
                        {status === 'Final' ? (
                            <Typography variant="h6">{`${awayTeam.score} - ${homeTeam.score}`}</Typography>
                        ) : (
                            <Typography variant="body1" color="text.secondary">{time}</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">{status}</Typography>
                    </Box>

                    {/* Home Team */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '40%' }}>
                        <Typography variant="body1" fontWeight="medium" sx={{ mr: 2 }}>{homeTeam.name}</Typography>
                        <Avatar src={homeTeam.logo} sx={{ width: 40, height: 40 }} />
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

export default GameCard; 