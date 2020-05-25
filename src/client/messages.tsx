import React from "react";
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi } from 'ag-grid-community';
import Search from '@material-ui/icons/Search';
import { RouteComponentProps } from "react-router-dom";
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Box from '@material-ui/core/Box';
import Toolbar from '@material-ui/core/Toolbar';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

interface Props extends RouteComponentProps<{ topic: string, partition?: string }> {
}

type State = {
    search: string;
    partition: string;
    loadingMessages: boolean;
    loadingPartitions: boolean;
    rows: any[];
    offset: number;
    limit: number;
    partitions: any[];
    customCols: {cols: {}};
}

export class Messages extends React.Component<Props, State> {
    state: State = { search: "", partitions: [], offset: 0, limit: 10, loadingMessages: false, loadingPartitions: true, rows: [], partition: this.props.match.params.partition || "0", customCols: {cols: {}} }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    async componentDidMount() {
        await this.fetchPartitions()
    }

    async fetchPartitions() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}`)
        const data = await response.json()
        const results = data.map((r: any) => {
            const label = r.high.toString() === "0" ?
                `Partition: ${r.partition} (Empty)` :
                `Partition: ${r.partition} (Low- ${r.low}, High- ${r.high}, Current- ${r.offset})`;
            return { label: label, value: r.partition.toString() }
        })
        this.setState({ loadingPartitions: false, partitions: results })
    }

    async fetchMaxOffset() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}`)
        const data = await response.json()
        for (const r of data) {
            if (r.partition.toString() === this.state.partition) {
                return parseInt(r.high)
            }
        }
        return 0
    }

    async fetchMessages() {
        this.setState({ loadingMessages: true })
        const maxOffset = await this.fetchMaxOffset()
        if ((!maxOffset && maxOffset !== 0) || this.state.offset > maxOffset) {
            return
        }
        let limit = this.state.limit
        if (this.state.offset + limit > maxOffset) {
            limit = maxOffset - this.state.offset
        }
        const topic = this.props.match.params.topic
        const response = await fetch(`/api/messages/${topic}/${this.state.partition}?limit=${limit}&offset=${this.state.offset}`)
        const data = await response.json()
        console.log(data)
        const customCols = {cols: {}}
        const rows = data.map((d: any) => this.getRow(d, customCols))
        this.setState({
            loadingMessages: false, rows, customCols
        })
    }

    getRow = (data: any, customCols: {cols: {}}): any => {
        let row = {
            rowTimestamp: data.message.timestamp,
            rowOffset: parseInt(data.message.offset),
            rowText: data.value,
            rowKey: data.message.key && data.message.key.data ? data.message.key.data.toString() : data.message.key,
        }
        try {
            const cols = JSON.parse(data.value)
            row = {...row, ...cols}
            customCols.cols = {...customCols.cols, ...cols}
        }
        catch (error) {
            console.warn(`row is not json encoded, error: ${error}`)
        }
        return row
    }

    getColumnDefs = () => {
        const cols: any[] = [
            { headerName: "Timestamp", field: "rowTimestamp", valueFormatter: this.timeFormatter },
            { headerName: "Offset", field: "rowOffset", filter: "agNumberColumnFilter" },
        ]
        for (const prop in this.state.customCols.cols) {
            cols.push({headerName: prop, field: prop})
        }
        cols.push({headerName: "Key", field: "rowKey"})
        cols.push({headerName: "Text", field: "rowText"})
        return cols
    }

    timeFormatter(params: any) {
        const date = new Date(parseFloat(params.value));
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const day = date.getDate().toString().padStart(2, "0")
        const year = date.getFullYear().toString().padStart(4, "0")
        const hour = date.getHours().toString().padStart(2, "0")
        const minute = date.getMinutes().toString().padStart(2, "0")
        const second = date.getSeconds().toString().padStart(2, "0")
        const millis = date.getMilliseconds().toString().padStart(3, "0")
        return `${month}/${day}/${year} ${hour}:${minute}:${second}.${millis}`
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
    }

    render() {
        if (this.state.loadingPartitions) {
            return (<><CircularProgress /><div>Loading...</div></>)
        }
        let rows = this.state.rows
        if (this.state.search !== "") {
            rows = rows.filter(r => r.rowText.includes(this.state.search))
        }
        const partitions = this.state.partitions.map(p => (<MenuItem key={p.label} value={p.value}>{p.label}</MenuItem>))
        return (
            <>
                <h1>Topic: {this.props.match.params.topic}</h1>
                <Toolbar>
                    <Box style={{ flex: 1 }}>
                        <TextField
                            label="Search"
                            value={this.state.search}
                            onChange={e => this.setState({ search: e.target.value })}
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search />
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>
                    <div>
                        <FormControl style={{ margin: 16, minWidth: 120 }}>
                            <InputLabel htmlFor="partition-select">Partition</InputLabel>
                            <Select
                                value={this.state.partition}
                                onChange={(e: any) => this.setState({ partition: e.target.value })}
                                inputProps={{
                                    name: 'partition',
                                    id: 'partition-select',
                                }}
                            >
                                {partitions}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Offset"
                            type="number"
                            value={this.state.offset}
                            onChange={(e: any) => this.setState({ offset: parseInt(e.target.value) })}
                            margin="normal"
                            inputProps={{ min: "0", step: "1" }}
                            style={{ marginRight: 10, maxWidth: 50 }}
                        />
                        <TextField
                            label="Limit"
                            type="number"
                            value={this.state.limit}
                            onChange={(e: any) => this.setState({ limit: parseInt(e.target.value) })}
                            margin="normal"
                            style={{ marginRight: 10, maxWidth: 50 }}
                            inputProps={{ min: "0", step: "1" }}
                        />
                        <Button color="primary" variant="contained" style={{ marginTop: 18 }}
                            onClick={async () => { await this.fetchMessages() }}>
                            GO
                        </Button>
                    </div>
                </Toolbar>
                <br />
                {this.state.loadingMessages && <><CircularProgress /><div>Loading...</div></>}
                {
                    !this.state.loadingMessages && <div
                        className="ag-theme-balham"
                    >
                        <AgGridReact
                            columnDefs={this.getColumnDefs()}
                            rowData={rows}
                            domLayout='autoHeight'
                            defaultColDef={{ sortable: true, filter: true, resizable: true }}
                            onGridReady={this.onGridReady}
                        >
                        </AgGridReact>
                    </div>
                }
            </>
        )
    }
}