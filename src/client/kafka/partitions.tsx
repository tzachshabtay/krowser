import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, GridApi, ColumnApi } from 'ag-grid-community';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { KafkaToolbar} from '../common/toolbar';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.css';

type State = {
    loading: boolean;
    rows: any[];
}

class ViewMessagesButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/messages/${this.props.data.topic}/${this.props.data.partition}`} {...this.props} />
    }
}

export class Partitions extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { loading: true, rows: [] }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    async componentDidMount() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}`)
        const data = await response.json()
        const results = data.map((r: any) => {
            return { partition: r.partition, offset: r.offset, low: r.low, high: r.high, topic: this.props.match.params.topic, raw: r, history: this.props.history }
        })
        this.setState({ loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Partition", field: "partition", filter: "agNumberColumnFilter" },
            { headerName: "Offset", field: "offset", filter: "agNumberColumnFilter" },
            { headerName: "Low", field: "low", filter: "agNumberColumnFilter" },
            { headerName: "#Messages (High)", field: "high", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton }
        ]
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
    }

    render() {
        return (
            <>
                <KafkaToolbar title={`Partitions for topic: ${this.props.match.params.topic}`}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <div
                    className="ag-theme-balham"
                >
                    <AgGridReact
                        columnDefs={this.getColumnDefs()}
                        rowData={this.state.rows}
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