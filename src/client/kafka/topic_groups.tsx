import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import Slider from '@material-ui/core/Slider';
import { KafkaToolbar } from '../common/toolbar';
import { CellProps } from '../common/cell_button';
import { DataView } from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import Box from '@material-ui/core/Box';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetTopicConsumerGroupsResult } from "../../shared/api";
import { CancelToken, Loader } from "../common/loader";

type State = {
    loading: boolean;
    error?: string;
    rows: Group[];
    data: GetTopicConsumerGroupsResult;
}

class ProgressRenderer extends React.Component<CellProps, {}> {
    render() {
        let offset = this.props.data.offset
        if (offset === -1) {
            offset = 0
        }
        return (
        <Box minWidth={150} paddingTop={1} paddingX={3}>
            <Slider
                value={offset}
                aria-labelledby="fake"
                valueLabelDisplay="off"
                step={1}
                min={this.props.data.low}
                max={this.props.data.high}
            />
        </Box>
        )
    }
}

type Group = {
    name: string,
    partition: number,
    offset: number,
    high: number,
    low: number,
    lag: number,
}

export class TopicGroups extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { loading: true, rows: [], data: [], error: "" }
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps<{ topic: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchGroups)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchGroups = async(cancelToken: CancelToken) => {
        const data: GetTopicConsumerGroupsResult = await cancelToken.Fetch(`/api/topic/${this.props.match.params.topic}/consumer_groups`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const results: Group[] = []
        for (const group of data) {
            for (const partition of group.offsets) {
                const high = partition.partition_offsets?.high ?? -1
                const offset = parseInt(partition.offset)
                let lag = high - offset
                if (offset === -1) {
                    lag -= 1
                }
                results.push({
                    name: group.group_id,
                    partition: partition.partition,
                    offset,
                    high,
                    low: partition.partition_offsets?.low ?? -1,
                    lag,
                })
            }
        }
        this.setState({ data, loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Name", field: "name" },
            { headerName: "Partition", field: "partition", filter: "agNumberColumnFilter" },
            { headerName: "Progress", cellRendererFramework: ProgressRenderer },
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
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch consumer groups. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: Group) => r.name}
                    rows={this.state.rows}
                    raw={this.state.data}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}