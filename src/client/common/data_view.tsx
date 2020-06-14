import React, { useState } from "react";
import { GridProps, Grid } from "./grid";
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import { CardView, CardViewProps } from "./card_view";

interface DataViewProps extends GridProps, CardViewProps {
}

interface State {
    value: number;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: any;
    value: any;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
        role="tabpanel"
        hidden={value !== index}
        id={`tabpanel-${index}`}
        aria-labelledby={`tab-${index}`}
        {...other}
        >
        {value === index && (
            <Box p={3}>
                <Typography component='span'>{children}</Typography>
            </Box>
        )}
        </div>
    );
}

export const DataView: React.SFC<DataViewProps> = (props) => {
    const [tab, setTab] = useState(0)

    const handleTabChange = (_: any, newValue: number) => {
        setTab(newValue)
    };

    return (
        <>
        <Tabs value={tab} onChange={handleTabChange} aria-label="raw or grid mode selection"
        indicatorColor="secondary"
        textColor="secondary">
            <Tab label="Grid"></Tab>
            <Tab label="Raw"></Tab>
        </Tabs>
        <TabPanel value={tab} index={0}>
            <Grid {...props}></Grid>
        </TabPanel>
        <TabPanel value={tab} index={1}>
            <CardView {...props}></CardView>
        </TabPanel>
        </>
    )
}
