import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { ConnectorConfig, ConnectorState, GetConnectorConfigResult, GetConnectorsResult, GetConnectorStatusResult } from "../../shared/api";
import { CellButton, CellProps } from "../common/cell_button";
import { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { History } from 'history';

type State = {
    search: string;
    loading: boolean;
    error?: string;
    customCols: {cols: {}};
    rows: Connector[];
}

type Connector = {
    name: string;
    state: ConnectorState | "Loading";
    workerId: string | "Loading";
    numTasks?: number;
    type: string | "Loading";
    config?: ConnectorConfig;
    history: History<unknown>;
}

class ViewTasksButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/kafka-connect/tasks/${this.props.data.name}`} {...this.props} />
    }
}

//this is needed for ag-grid to correctly detect the field mappings (it interprets dots as deep references)
export function ReplaceDots(data: ConnectorConfig): ConnectorConfig {
    const res: ConnectorConfig = {}
    for (const prop in data) {
        res[prop.split('.').join('->')] = data[prop]
    }
    return res
}

export class Connectors extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, customCols: {cols: {}}, rows: [], search: "", error: "" }
    gridApi: GridApi | null = null;
    url: Url;

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
    }

    async componentDidMount() {
        const response = await fetch(`/api/kafka-connect/connectors`)
        const data: GetConnectorsResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        const rows: Connector[] = data.map(c => ({name: c, state: "Loading", workerId: "Loading", type: "Loading", history: this.props.history}))
        const search = this.url.Get(`search`) || ``
        this.setState({ loading: false, rows, search })
        for (const connector of rows) {
            await this.fetchConnector(connector)
        }
    }

    async fetchConnector(connector: Connector) {
        await this.fetchConnectorStatus(connector)
        await this.fetchConnectorConfig(connector)
    }

    async fetchConnectorStatus(connector: Connector) {
        const response = await fetch(`/api/kafka-connect/connector/${connector.name}/status`)
        const data: GetConnectorStatusResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        connector.numTasks = data.tasks.length
        connector.state = data.connector.state
        connector.workerId = data.connector.worker_id
        connector.type = data.type
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    async fetchConnectorConfig(connector: Connector) {
        const response = await fetch(`/api/kafka-connect/connector/${connector.name}/config`)
        let data: GetConnectorConfigResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        data = ReplaceDots(data)
        connector.config = data
        this.state.customCols.cols = {...this.state.customCols.cols, ...data}
        this.refreshGrid()
    }

    refreshGrid() {
        if (this.gridApi) {
            this.gridApi.refreshCells({force: true})
        }
        this.forceUpdate();
    }

    getColumnDefs() {
        const cols: ColDef[] = [
            { headerName: "Name", field: "name" },
            { headerName: "State", field: "state", type: "connectorState" },
            { headerName: "Worker ID", field: "workerId" },
            { headerName: "Type", field: "type" },
            { headerName: "#Tasks", field: "numTasks", filter: "agNumberColumnFilter", cellRendererFramework: ViewTasksButton },
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
                    title="Connectors"
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}
                    OnThemeChanged={ _ => this.refreshGrid()}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch connectors. Error: "></ErrorMsg>
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