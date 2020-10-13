import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";

type State = {
    loading: boolean;
    error: any;
    rows: any[];
}

class ViewMessagesButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/topic/messages/${this.props.data.topic}/${this.props.data.partition}`} {...this.props} />
    }
}

export class Partitions extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { loading: true, rows: [], error: "" }
    url: Url;

    constructor(props: RouteComponentProps<{ topic: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const results = data.offsets.map((r: any) => {
            return { partition: r.partition, offset: r.offset, low: r.low, high: r.high, topic: this.props.match.params.topic, raw: r, history: this.props.history }
        })
        this.setState({ loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Partition", field: "partition", filter: "agNumberColumnFilter" },
            { headerName: "Offset", field: "offset", filter: "agNumberColumnFilter" },
            { headerName: "Low", field: "low", filter: "agNumberColumnFilter" },
            { headerName: "#Messages (High)", field: "high", filter: "agNumberColumnFilter", cellRendererFramework: ViewMessagesButton }
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Partitions for topic: ${this.props.match.params.topic}`}
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch partitions. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery=""
                    search={_ => true}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({topic: r.topic, ...r.raw}))}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}