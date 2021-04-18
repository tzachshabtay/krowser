import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";

type State = {
    loading: boolean;
    error: any;
    rows: any[];
}

export class Members extends React.Component<RouteComponentProps<{ group: string }>, State> {
    state: State = { loading: true, rows: [], error: "" }
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
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch members. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    search={r => `${r.memberId},${r.clientId},${r.clientHost}`}
                    rows={this.state.rows}
                    raw={this.state.rows}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}