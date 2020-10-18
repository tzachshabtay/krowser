import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";

type State = {
    search: string;
    loading: boolean;
    error: any;
    errorPrefix: string;
    rows: any[];
}

class ViewPartitionsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/partitions/${this.props.data.topic}`} {...this.props} />
    }
}

class ViewConsumerGroupsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/consumer_groups/${this.props.data.topic}`} {...this.props} />
    }
}

class ViewConfigsButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/configs/${this.props.data.topic}`} {...this.props} />
    }
}

class ViewMessagesButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/messages/${this.props.data.topic}`} {...this.props} />
    }
}

export class Topics extends React.Component<RouteComponentProps, State> {
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
        const response = await fetch(`/api/topics`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: "Failed to fetch topics. Error: "})
            return
        }
        const results = data.topics.map((r: any) => (
            { topic: r.name, num_partitions: r.partitions.length, raw: r, history: this.props.history }))
        const search = this.url.Get(`search`) || ``
        this.setState({ loading: false, rows: results, search })
        for (const topic of results) {
            await this.fetchTopic(topic)
        }
    }

    async fetchTopic(topic: any) {
        const response = await fetch(`/api/topic/${topic.topic}`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: `Failed to fetch topic ${topic.topic}. Error: `})
            return
        }
        let sum = 0
        for (const partition of data.offsets) {
            const high = parseInt(partition.high)
            sum += high
        }
        topic.offsets = data.offsets
        topic.config = data.config
        topic.groups = data.groups
        topic.num_messages = sum
        if (data.groups) {
            topic.num_groups = data.groups.length
        } else {
            topic.num_groups = `Unknown`
        }
        if (data.config) {
            topic.num_configs = data.config.resources[0].configEntries.length
        } else {
            topic.num_configs = `Unknown`
        }
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    getColumnDefs() {
        return [
            { headerName: "Topic", field: "topic" },
            { headerName: "#Partitions", field: "num_partitions", filter: "agNumberColumnFilter", cellRendererFramework: ViewPartitionsButton },
            { headerName: "#Messages", field: "num_messages", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton },
            { headerName: "#Consumer Groups", field: "num_groups", filter: "agNumberColumnFilter", cellRendererFramework: ViewConsumerGroupsButton },
            { headerName: "#Configs", field: "num_configs", filter: "agNumberColumnFilter", cellRendererFramework: ViewConfigsButton },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Topics"
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.topic.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({...r.raw, num_messages: r.num_messages, offsets: r.offsets, config: r.config, groups: r.groups }))}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}