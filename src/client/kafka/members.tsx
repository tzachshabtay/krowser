import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { CancelToken, Loader } from "../common/loader";
import { GetGroupMembersResult, GroupMemberMetadata } from "../../shared/api";

type State = {
    loading: boolean;
    error: any;
    rows: GroupMemberMetadata[];
    data: GetGroupMembersResult;
}

export class Members extends React.Component<RouteComponentProps<{ group: string }>, State> {
    state: State = { loading: true, rows: [], error: "", data: {members: []} }
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps<{ group: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchMembers)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchMembers = async (cancelToken: CancelToken) => {
        const data: GetGroupMembersResult = await cancelToken.Fetch(`/api/members/${this.props.match.params.group}`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        this.setState({ loading: false, rows: data.members, data: data })
    }

    getColumnDefs() {
        return [
            { headerName: "Member ID", field: "member_id" },
            { headerName: "Client ID", field: "client_id" },
            { headerName: "Client Host", field: "client_host" },
            { headerName: "Assignment", field: "assignment" },
            { headerName: "Metadata", field: "metadata" },
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
                    raw={this.state.data.members}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}