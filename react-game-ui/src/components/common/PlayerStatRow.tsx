import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';

interface PlayerStatRowProps {
    rank: number;
    player: {
        name: string;
        avatar: string;
        detailedStats: string; // e.g., "33.0分 15.4板 6.6助"
    };
    teamName: string;
    statValue: number | string;
}

const PlayerStatRow: React.FC<PlayerStatRowProps> = ({ rank, player, teamName, statValue }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1.5,
                borderBottom: '1px solid #eee',
                paddingRight: 2,
            }}
        >
            <Typography variant="body1" sx={{ width: '40px', color: 'text.secondary', textAlign: 'center' }}>
                {rank}
            </Typography>
            <Avatar src={player.avatar} sx={{ width: 40, height: 40, mr: 1.5 }} />
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body1" fontWeight="medium">
                    {player.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {player.detailedStats}
                </Typography>
            </Box>
            <Box sx={{ width: '60px', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    {teamName}
                </Typography>
            </Box>
            <Box sx={{ width: '50px', textAlign: 'right' }}>
                <Typography variant="body1" fontWeight="medium">
                    {statValue}
                </Typography>
            </Box>
        </Box>
    );
};

export default PlayerStatRow; 