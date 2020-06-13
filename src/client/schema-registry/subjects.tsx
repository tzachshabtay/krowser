import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
}

class ViewVersionsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/schema-registry/versions/${this.props.data.subject}`} {...this.props} />
    }
}

export class Subjects extends React.Component<RouteComponentProps, State> {
    state: State = { search: "", loading: true, rows: [] }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        const response = await fetch(`/api/schema-registry/subjects`)
        const data = await response.json()
        const results = data.map((r: any) => (
            { subject: r, history: this.props.history }))
        this.setState({ loading: false, rows: results })
        for (const subject of results) {
            await this.fetchSubject(subject)
        }
    }

    async fetchSubject(subject: any) {
        const response = await fetch(`/api/schema-registry/versions/${subject.subject}`)
        const data = await response.json()
        subject.num_versions = data.length
        subject.versions = data
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    getColumnDefs() {
        return [
            { headerName: "Subject", field: "subject" },
            { headerName: "#Versions", field: "num_versions", filter: "agNumberColumnFilter", cellRendererFramework: ViewVersionsButton },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Subjects"
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.subject.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({subject: r.subject, versions: r.versions}))}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}