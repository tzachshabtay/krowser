import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
    data: any;
}

export class Brokers extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], data: {}, search: "" }

    async componentDidMount() {
        const response = await fetch(`/api/cluster`)
        const data = await response.json()
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
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.host.includes(this.state.search)}
                    rows={this.state.rows}
                    rawJsonRows={this.state.data}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}