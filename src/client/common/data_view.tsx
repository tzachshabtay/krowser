import React from "react";
import { GridProps, Grid } from "./grid";
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import { CardView, CardViewProps } from "./card_view";
import { GridApi } from 'ag-grid-community';

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

export class DataView extends React.Component<DataViewProps> {
    state: State = { value: 0 };
    grid: Grid | undefined = undefined;

    GetGridApi = (): GridApi | null => {
        if (this.grid) {
            return this.grid.GetGridApi()
        }
        return null
    }

    handleChange = (_: any, newValue: number) => {
        this.setState({value: newValue})
    };

    render () {
        return (
            <>
            <Tabs value={this.state.value} onChange={this.handleChange} aria-label="raw or grid mode selection"
            indicatorColor="primary"
            textColor="primary">
                <Tab label="Grid"></Tab>
                <Tab label="Raw"></Tab>
            </Tabs>
            <TabPanel value={this.state.value} index={0}>
                <Grid {...this.props} ref={r => {if (r) this.grid = r;}}></Grid>
            </TabPanel>
            <TabPanel value={this.state.value} index={1}>
                <CardView {...this.props}></CardView>
            </TabPanel>
            </>
        )
    }
}
