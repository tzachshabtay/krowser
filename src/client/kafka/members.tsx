import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
}

export class Members extends React.Component<RouteComponentProps<{ group: string }>, State> {
    state: State = { loading: true, rows: [], search: "" }

    async componentDidMount() {
        const response = await fetch(`/api/members/${this.props.match.params.group}`)
        const data = await response.json()
        this.setState({ loading: false, rows: data })
    }

    getColumnDefs() {
        return [
            { headerName: "Member ID", field: "memberId" },
            { headerName: "Client ID", field: "clientId" },
            { headerName: "Client Host", field: "clientHost" },
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Members for group: ${this.props.match.params.group}`}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.memberId.includes(this.state.search) || r.clientId.includes(this.state.search) || r.clientHost.includes(this.state.search)}
                    rows={this.state.rows}
                    rawJsonRows={this.state.rows}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}