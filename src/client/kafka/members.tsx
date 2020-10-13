import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";

type State = {
    search: string;
    loading: boolean;
    error: any;
    rows: any[];
}

export class Members extends React.Component<RouteComponentProps<{ group: string }>, State> {
    state: State = { loading: true, rows: [], search: "", error: "" }
    url: Url;

    constructor(props: RouteComponentProps<{ group: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        const response = await fetch(`/api/members/${this.props.match.params.group}`)
        const data = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const search = this.url.Get(`search`) || ``
        this.setState({ loading: false, rows: data, search })
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
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch members. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.memberId.includes(this.state.search) || r.clientId.includes(this.state.search) || r.clientHost.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}