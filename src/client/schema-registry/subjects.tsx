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
import { CancelToken, Loader } from "../common/loader";

type State = {
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
    subject: string,
    versions?: number[],
    num_versions?: number,
    history: History<unknown>,
}

export class Subjects extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], error: "", errorPrefix: "" }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchSubjects)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchSubjects = async (cancelToken: CancelToken) => {
        const data: GetSubjectsResult = await cancelToken.Fetch(`/api/schema-registry/subjects`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({ loading: false, error: data.error, errorPrefix: "Failed to fetch subjects. Error: "})
            return
        }
        const results = data.subjects.map(r => (
            { subject: r, history: this.props.history }))
        this.setState({ loading: false, rows: results })
        for (const subject of results) {
            await this.fetchSubject(subject, cancelToken)
            if (cancelToken.Aborted) return
        }
    }

    async fetchSubject(subject: Subject, cancelToken: CancelToken) {
        const data: GetSubjectVersionsResult = await cancelToken.Fetch(`/api/schema-registry/versions/${subject.subject}`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({ loading: false, error: data.error, errorPrefix: `Failed to fetch subject ${subject.subject}. Error: `})
            return
        }
        subject.num_versions = data.versions.length
        subject.versions = data.versions
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
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: Subject) => r.subject}
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