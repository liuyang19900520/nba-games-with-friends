import React from 'react';
import { Box, Typography } from '@mui/material';

interface StandingRowProps {
    rank: number;
    teamName: string;
    record: string; // e.g., "64-18"
}

const StandingRow: React.FC<StandingRowProps> = ({ rank, teamName, record }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 1.5,
                borderBottom: '1px solid #eee',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ width: '30px', color: 'text.secondary' }}>
                    {rank}
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                    {teamName}
                </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
                {record}
            </Typography>
        </Box>
    );
};

export default StandingRow; 