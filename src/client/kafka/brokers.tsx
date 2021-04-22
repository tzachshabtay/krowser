import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { Broker, GetClusterResult } from "../../shared/api";
import { CancelToken, Loader } from "../common/loader";

type State = {
    loading: boolean;
    error?: string;
    rows: Broker[];
}

export class Brokers extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], error: "" }
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchBrokers)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchBrokers = async (cancelToken: CancelToken) => {
        const data: GetClusterResult = await cancelToken.Fetch(`/api/cluster`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        const rows = data.brokers
        this.setState({ loading: false, rows })
    }

    getColumnDefs() {
        return [
            { headerName: "Node ID", field: "nodeId", filter: "agNumberColumnFilter" },
            { headerName: "Host", field: "host" },
            { headerName: "Port", field: "port", filter: "agNumberColumnFilter" },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Brokers"
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch brokers. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: Broker) => r.host}
                    rows={this.state.rows}
                    raw={this.state.rows}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}