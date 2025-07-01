import React, { useState, useEffect } from 'react';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Home, BarChart, VideogameAsset, Person } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavBar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [value, setValue] = useState(location.pathname);

    useEffect(() => {
        setValue(location.pathname);
    }, [location.pathname]);

    const handleChange = (event: React.SyntheticEvent, newValue: string) => {
        setValue(newValue);
        navigate(newValue);
    };

    return (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, maxWidth: '430px', margin: '0 auto' }} elevation={3}>
            <BottomNavigation
                showLabels
                value={value}
                onChange={handleChange}
            >
                <BottomNavigationAction label="信息" value="/" icon={<Home />} />
                <BottomNavigationAction label="技术统计" value="/stats" icon={<BarChart />} />
                <BottomNavigationAction label="游戏" value="/game" icon={<VideogameAsset />} />
                <BottomNavigationAction label="我的" value="/profile" icon={<Person />} />
            </BottomNavigation>
        </Paper>
    );
};

export default BottomNavBar; 