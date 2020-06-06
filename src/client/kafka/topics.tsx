import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';


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
    grid: DataView | undefined = undefined;

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
        if (this.grid) {
            this.grid.RefreshCells()
        }
        this.forceUpdate();
    }

    getColumnDefs() {
        return [
            { headerName: "Topic", field: "topic" },
            { headerName: "#Partitions", field: "num_partitions", filter: "agNumberColumnFilter", cellRendererFramework: ViewPartitionsButton },
            { headerName: "#Messages", field: "num_messages", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton }
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Topics"
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.topic.includes(this.state.search)}
                    rows={this.state.rows}
                    jsonRows={this.state.rows.map(r => ({...r.raw, num_messages: r.num_messages, offsets: r.offsets }))}
                    columnDefs={this.getColumnDefs()}
                    ref={r => {if (r) this.grid = r;}}
                    >
                </DataView>}
            </>
        )
    }
}