import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';

type State = {
    search: string;
    loading: boolean;
    error: any;
    rows: any[];
    data: any;
}

export class Brokers extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], data: {}, search: "", error: "" }

    async componentDidMount() {
        const response = await fetch(`/api/cluster`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        const rows = data.brokers
        this.setState({ loading: false, rows, data })
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
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch brokers. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.host.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.data}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}