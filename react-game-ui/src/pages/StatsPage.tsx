import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab, Grid, List, ListItemButton, ListItemText, Paper } from '@mui/material';
import TopAppBar from '../components/layout/TopAppBar';
import { useNavigate } from 'react-router-dom';
import PlayerStatRow from '../components/common/PlayerStatRow';

const mockStatsData: any = {
    points: {
        title: '得分榜',
        data: [
            { rank: 1, player: { name: '阿德托昆博', avatar: '/giannis.png', detailedStats: '33.0分 15.4板 6.6助' }, teamName: '雄鹿', statValue: 33.0 },
            { rank: 2, player: { name: '东契奇', avatar: '/luka.png', detailedStats: '30.2分 7.0板 5.8助' }, teamName: '湖人', statValue: 30.2 },
            { rank: 3, player: { name: '亚历山大', avatar: '/sga.png', detailedStats: '30.0分 5.4板 6.3助' }, teamName: '雷霆', statValue: 30.0 },
            { rank: 4, player: { name: '米切尔', avatar: '/mitchell.png', detailedStats: '29.6分 4.7板 3.9助' }, teamName: '骑士', statValue: 29.6 },
        ],
    },
    rebounds: {
        title: '篮板榜',
        data: [
            { rank: 1, player: { name: '阿德托昆博', avatar: '/giannis.png', detailedStats: '33.0分 15.4板 6.6助' }, teamName: '雄鹿', statValue: 15.4 },
            { rank: 2, player: { name: '约基奇', avatar: '/jokic.png', detailedStats: '26.2分 12.7板 8.0助' }, teamName: '掘金', statValue: 12.7 },
            { rank: 3, player: { name: '申京', avatar: '/sengun.png', detailedStats: '20.9分 11.9板 5.3助' }, teamName: '火箭', statValue: 11.9 },
        ],
    },
    assists: {
        title: '助攻榜',
        data: [
            { rank: 1, player: { name: '哈利伯顿', avatar: '/haliburton.png', detailedStats: '20.1分 3.9板 10.9助' }, teamName: '步行者', statValue: 10.9 },
        ]
    }
};

const statCategories = [
    { id: 'points', name: '得分' },
    { id: 'rebounds', name: '篮板' },
    { id: 'assists', name: '助攻' },
    { id: 'steals', name: '抢断' },
    { id: 'blocks', name: '盖帽' },
];

const StatsPage: React.FC = () => {
    const navigate = useNavigate();
    const [mainTab, setMainTab] = useState(0);
    const [subTab, setSubTab] = useState(0);
    const [selectedStat, setSelectedStat] = useState('points');

    const leaders = mockStatsData[selectedStat] || { title: '暂无数据', data: [] };

    return (
        <Box>
            <TopAppBar title="NBA" showBackButton onBackClick={() => navigate(-1)} />

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={mainTab} onChange={(e, v) => setMainTab(v)} textColor="primary" indicatorColor="primary" centered>
                    <Tab label="球员榜" />
                    <Tab label="球队榜" />
                </Tabs>
            </Box>

            <Paper elevation={0} sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                <Tabs value={subTab} onChange={(e, v) => setSubTab(v)} textColor="primary" indicatorColor="primary" >
                    <Tab label="基础" sx={{ textTransform: 'none' }} />
                    <Tab label="进阶" sx={{ textTransform: 'none' }} />
                    <Tab label="关键时刻" sx={{ textTransform: 'none' }} />
                </Tabs>
            </Paper>

            <Grid container>
                <Grid item xs={3}>
                    <List component="nav" sx={{ pt: 0 }}>
                        {statCategories.map(cat => (
                            <ListItemButton
                                key={cat.id}
                                selected={selectedStat === cat.id}
                                onClick={() => setSelectedStat(cat.id)}
                                sx={{
                                    justifyContent: 'center',
                                    '&.Mui-selected': {
                                        borderLeft: '3px solid',
                                        borderColor: 'primary.main',
                                        backgroundColor: 'action.hover',
                                    },
                                    '&.Mui-selected:hover': {
                                        backgroundColor: 'action.hover',
                                    }
                                }}
                            >
                                <ListItemText primary={cat.name} primaryTypographyProps={{ align: 'center' }} />
                            </ListItemButton>
                        ))}
                    </List>
                </Grid>

                <Grid item xs={9} sx={{ borderLeft: '1px solid #eee' }}>
                    <Box sx={{ px: 1 }}>
                        <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>{leaders.title}</Typography>
                        {leaders.data.map((item: any) => (
                            <PlayerStatRow key={item.rank} {...item} />
                        ))}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default StatsPage; 