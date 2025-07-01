import React from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import theme from './styles/theme';
import AppRouter from './router/AppRouter';
import BottomNavBar from './components/layout/BottomNavBar';

const App: React.FC = () => {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ pb: '65px' /* height of bottom nav */ }}>
                <AppRouter />
            </Box>
            <BottomNavBar />
        </ThemeProvider>
    );
};

export default App; 