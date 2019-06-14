import React from "react";
import TextField from '@material-ui/core/TextField';
import InputAdornment from '@material-ui/core/InputAdornment';
import CircularProgress from '@material-ui/core/CircularProgress';
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi } from 'ag-grid-community';
import Button from '@material-ui/core/Button';
import EventNote from '@material-ui/icons/EventNote';
import Search from '@material-ui/icons/Search';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
}

class CellButton extends React.Component<{ value: number }, {}> {
    render() {
        let msg = "Loading"
        if (this.props.value) {
            msg = this.props.value.toString()
        }
        return (
            <div style={{ width: "100%", justifyContent: 'center', textAlign: "center" }}>
                <Button color="primary" size="small" onClick={() => console.log(this.props)}>
                    <EventNote />
                    {msg}
                </Button>
            </div>
        )
    }
}

export class Topics extends React.Component<{}, State> {
    state: State = { search: "", loading: true, rows: [] }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    async componentDidMount() {
        const response = await fetch(`/api/topics`)
        const data = await response.json()
        const results = data.topics.map((r: any) => {
            return { topic: r.name, num_partitions: r.partitions.length, raw: r }
        })
        this.setState({ loading: false, rows: results })
        for (const topic of results) {
            await this.fetchTopic(topic)
        }
    }

    async fetchTopic(topic: any) {
        const response = await fetch(`/api/topic/${topic.topic}`)
        const data = await response.json()
        let sum = 0
        for (const partition of data) {
            const high = parseInt(partition.high)
            sum += high
        }
        topic.offsets = data
        topic.num_messages = sum
        if (this.api) {
            this.api.refreshCells()
        }
    }

    getColumnDefs() {
        return [
            { headerName: "Topic", field: "topic" },
            { headerName: "#Partitions", field: "num_partitions", filter: "agNumberColumnFilter", cellRendererFramework: CellButton },
            { headerName: "#Messages", field: "num_messages", filter: "agNumberColumnFilter", cellRendererFramework: CellButton }
        ]
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
    }

    render() {
        let rows = this.state.rows
        if (this.state.search != "") {
            rows = rows.filter(r => r.topic.includes(this.state.search))
        }
        return (
            <>
                <h1>Topics</h1>
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
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <div
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
                </div>}
            </>
        )
    }
}