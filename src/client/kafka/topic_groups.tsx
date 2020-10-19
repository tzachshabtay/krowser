import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar } from '../common/toolbar';
import { DataView } from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";

type State = {
    search: string;
    loading: boolean;
    error: any;
    rows: any[];
    data: any;
}

export class TopicGroups extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { search: "", loading: true, rows: [], data: {}, error: "" }
    url: Url;

    constructor(props: RouteComponentProps<{ topic: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}/consumer_groups`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const results: any[] = []
        for (const group of data) {
            for (const partition of group.offsets) {
                const high = parseInt(partition.partitionOffsets.high)
                const offset = parseInt(partition.offset)
                let lag = high - offset
                if (offset === -1) {
                    lag -= 1
                }
                results.push({
                    name: group.groupId,
                    partition: partition.partition,
                    offset,
                    high,
                    low: partition.partitionOffsets.low,
                    lag,
                })
            }
        }
        const search = this.url.Get(`search`) || ``
        this.setState({ data, loading: false, rows: results, search })
    }

    getColumnDefs() {
        return [
            { headerName: "Name", field: "name" },
            { headerName: "Partition", field: "partition", filter: "agNumberColumnFilter" },
            { headerName: "Offset", field: "offset", filter: "agNumberColumnFilter" },
            { headerName: "Low", field: "low", filter: "agNumberColumnFilter" },
            { headerName: "High", field: "high", filter: "agNumberColumnFilter" },
            { headerName: "Lag", field: "lag", filter: "agNumberColumnFilter" },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Consumer groups for topic: ${this.props.match.params.topic}`}
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch consumer groups. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.name.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.data}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}