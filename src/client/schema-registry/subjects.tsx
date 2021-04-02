import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetSubjectsResult, GetSubjectVersionsResult } from "../../shared/api";
import { History } from 'history';

type State = {
    search: string;
    loading: boolean;
    rows: Subject[];
    error?: string;
    errorPrefix: string;
}

class ViewVersionsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/schema-registry/versions/${this.props.data.subject}`} {...this.props} />
    }
}

type Subject = {
    subject: String,
    versions?: GetSubjectVersionsResult,
    num_versions?: number,
    history: History<unknown>,
}

export class Subjects extends React.Component<RouteComponentProps, State> {
    state: State = { search: "", loading: true, rows: [], error: "", errorPrefix: "" }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;
    url: Url;

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        const response = await fetch(`/api/schema-registry/subjects`)
        const data: GetSubjectsResult = await response.json()
        if (data.error) {
            this.setState({ loading: false, error: data.error, errorPrefix: "Failed to fetch subjects. Error: "})
            return
        }
        const results = data.map(r => (
            { subject: r, history: this.props.history }))
        const search = this.url.Get(`search`) || ``
        this.setState({ loading: false, rows: results, search })
        for (const subject of results) {
            await this.fetchSubject(subject)
        }
    }

    async fetchSubject(subject: Subject) {
        const response = await fetch(`/api/schema-registry/versions/${subject.subject}`)
        const data: GetSubjectVersionsResult = await response.json()
        if (data.error) {
            this.setState({ loading: false, error: data.error, errorPrefix: `Failed to fetch subject ${subject.subject}. Error: `})
            return
        }
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
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.subject.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({subject: r.subject, versions: r.versions}))}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}