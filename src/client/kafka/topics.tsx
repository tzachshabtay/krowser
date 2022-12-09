import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetTopicResult, GetTopicsResult, TopicsOffsets, TopicMetadata } from "../../shared/api";
import { History } from 'history';
import { CancelToken, Loader } from "../common/loader";

type State = {
    loading: boolean;
    error?: string;
    errorPrefix: string;
    rows: Topic[];
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
        return <CellButton getUrl={() => `/topic/configs/${this.props.data.topic}`} {...this.props} value="Show" />
    }
}

class ViewMessagesButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/messages/${this.props.data.topic}`} {...this.props} />
    }
}

type Topic = {
    topic: string,
    num_partitions: number,
    raw: TopicMetadata,
    history: History<unknown>,
    offsets?: TopicsOffsets,
    groups?: string[],
    num_messages?: number,
    num_groups?: number | `Unknown`,
}

export class Topics extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], error: "", errorPrefix: "" }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;
    url: Url;
    loader: Loader = new Loader();

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchTopics)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchTopics = async (cancelToken: CancelToken) => {
        const data: GetTopicsResult = await cancelToken.Fetch(`/api/topics`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: "Failed to fetch topics. Error: "})
            return
        }
        const results: Topic[] = data.topics.map((r: TopicMetadata) => (
            { topic: r.name, num_partitions: r.partitions.length, raw: r, history: this.props.history }))
        this.setState({ loading: false, rows: results })
        const batch_size = 4;
        let batch = [];
        for (const topic of results) {
            batch.push(this.fetchTopic(topic, cancelToken));
            if (batch.length === batch_size) {
                await Promise.all(batch);
                if (cancelToken.Aborted) return
                batch = [];
                if (this.gridApi) {
                    this.gridApi.refreshCells()
                }
                this.forceUpdate();
            }
        }
        if (batch.length > 0) {
            await Promise.all(batch);
            if (cancelToken.Aborted) return
            batch = [];
            if (this.gridApi) {
                this.gridApi.refreshCells()
            }
            this.forceUpdate();
        }
    }

    fetchTopic = async (topic: Topic, cancelToken: CancelToken) => {
        const data: GetTopicResult = await cancelToken.Fetch(`/api/topic/${topic.topic}`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: `Failed to fetch topic ${topic.topic}. Error: `})
            return
        }
        let sum = 0
        for (const partition of data.offsets) {
            const messages_in_partition = partition.high - partition.low
            sum += messages_in_partition
        }
        topic.offsets = data.offsets
        topic.groups = data.consumer_groups?.map(p => p.group_id)
        topic.num_messages = sum
        if (data.consumer_groups) {
            topic.num_groups = data.consumer_groups.length
        } else {
            topic.num_groups = `Unknown`
        }
    }

    getColumnDefs() {
        return [
            { headerName: "Topic", field: "topic" },
            { headerName: "#Partitions", field: "num_partitions", filter: "agNumberColumnFilter", cellRendererFramework: ViewPartitionsButton },
            { headerName: "#Messages", field: "num_messages", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton },
            { headerName: "#Consumer Groups", field: "num_groups", filter: "agNumberColumnFilter", cellRendererFramework: ViewConsumerGroupsButton },
            { headerName: "Configs", field: "num_configs", filter: "agNumberColumnFilter", cellRendererFramework: ViewConfigsButton },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Topics"
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: Topic) => r.topic}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({...r.raw, num_messages: r.num_messages, offsets: r.offsets, groups: r.groups }))}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}