import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import { ArrowBack, Settings } from '@mui/icons-material';

interface TopAppBarProps {
    title: string;
    showBackButton?: boolean;
    showSettingsButton?: boolean;
    onBackClick?: () => void;
}

const TopAppBar: React.FC<TopAppBarProps> = ({ title, showBackButton, showSettingsButton, onBackClick }) => {
    return (
        <AppBar position="static">
            <Toolbar>
                <Box sx={{ width: '40px' }}>
                    {showBackButton && (
                        <IconButton edge="start" color="inherit" aria-label="back" onClick={onBackClick}>
                            <ArrowBack />
                        </IconButton>
                    )}
                </Box>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1, textAlign: 'center' }}>
                    {title}
                </Typography>
                <Box sx={{ width: '40px' }}>
                    {showSettingsButton && (
                        <IconButton edge="end" color="inherit" aria-label="settings">
                            <Settings />
                        </IconButton>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default TopAppBar; 