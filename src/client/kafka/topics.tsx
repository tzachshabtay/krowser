import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi } from 'ag-grid-community';
import { KafkaToolbar} from '../common/toolbar';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';

import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
}

class ViewPartitionsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/partitions/${this.props.data.topic}`} {...this.props} />
    }
}

class ViewMessagesButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/messages/${this.props.data.topic}`} {...this.props} />
    }
}

export class Topics extends React.Component<RouteComponentProps, State> {
    state: State = { search: "", loading: true, rows: [] }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    async componentDidMount() {
        const response = await fetch(`/api/topics`)
        const data = await response.json()
        const results = data.topics.map((r: any) => (
            { topic: r.name, num_partitions: r.partitions.length, raw: r, history: this.props.history }))
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
            { headerName: "#Partitions", field: "num_partitions", filter: "agNumberColumnFilter", cellRendererFramework: ViewPartitionsButton },
            { headerName: "#Messages", field: "num_messages", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton }
        ]
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
        this.api.refreshCells()
    }

    render() {
        let rows = this.state.rows
        if (this.state.search != "") {
            rows = rows.filter(r => r.topic.includes(this.state.search))
        }
        return (
            <>
                <KafkaToolbar
                    title="Topics"
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
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