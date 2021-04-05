import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { ConnectorConfig, ConnectorState, GetConnectorTasksResult, GetConnectorTaskStatusResult } from "../../shared/api";
import { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { ReplaceDots } from "./connectors";

type State = {
    search: string;
    loading: boolean;
    error?: string;
    customCols: {cols: {}};
    rows: Task[];
}

type Task = {
    id: number;
    state: ConnectorState | "Loading";
    workerId: string | "Loading";
    config: ConnectorConfig;
}

export class Tasks extends React.Component<RouteComponentProps<{ connector: string }>, State> {
    state: State = { loading: true, customCols: {cols: {}}, rows: [], search: "", error: "" }
    gridApi: GridApi | null = null;
    url: Url;

    constructor(props: RouteComponentProps<{ connector: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
    }

    async componentDidMount() {
        const response = await fetch(`/api/kafka-connect/connector/${this.props.match.params.connector}/tasks`)
        const data: GetConnectorTasksResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        const rows: Task[] = []
        const search = this.url.Get(`search`) || ``
        for (const c of data) {
            const config = ReplaceDots(c.config)
            rows.push({id: c.id.task, state: "Loading", workerId: "Loading", config })
            this.state.customCols.cols = {...this.state.customCols.cols, ...config}
        }
        this.setState({ loading: false, rows, search })
        for (const c of rows) {
            await this.fetchTaskStatus(c)
        }
    }

    async fetchTaskStatus(task: Task) {
        const response = await fetch(`/api/kafka-connect/connector/${this.props.match.params.connector}/tasks/${task.id}/status`)
        const data: GetConnectorTaskStatusResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        task.state = data.state
        task.workerId = data.worker_id
        this.refreshGrid()
    }

    refreshGrid() {
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    getColumnDefs() {
        const cols: ColDef[] = [
            { headerName: "ID", field: "id" },
            { headerName: "State", field: "state", type: "connectorState" },
            { headerName: "Worker ID", field: "workerId" },
        ]
        for (const prop in this.state.customCols.cols) {
            const field = `config.${prop}`
            const orig = prop.split('->').join('.')
            const headerName = `config.${orig}`
            cols.push({headerName, field})
        }
        return cols
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Tasks for connector: ${this.props.match.params.connector}`}
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}
                    OnThemeChanged={_ => this.refreshGrid()}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch tasks. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.host.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}>
                </DataView>}
            </>
        )
    }
}