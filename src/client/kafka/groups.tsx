import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { CancelToken, Loader } from "../common/loader";
import { GetGroupsResult, GroupMetadata } from "../../shared/api";

type State = {
    loading: boolean;
    error: any;
    rows: GroupMetadata[];
    data: GetGroupsResult;
}

class ViewMembersButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/members/${this.props.data.groupId}`} {...this.props} />
    }
}

export class Groups extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], error: "", data: {groups: []} }
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchGroups)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchGroups = async (cancelToken: CancelToken) => {
        const data: GetGroupsResult = await cancelToken.Fetch(`/api/groups`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error})
            return
        }
        const results = data.groups.map((r: any) => {
            return { numMembers: r.members.length, raw: r, history: this.props.history, ...r }
        })
        this.setState({ loading: false, rows: results, data })
    }

    getColumnDefs() {
        return [
            { headerName: "Group ID", field: "name" },
            { headerName: "Protocol", field: "protocol" },
            { headerName: "Protocol Type", field: "protocol_type" },
            { headerName: "State", field: "state" },
            { headerName: "#Members", field: "numMembers", filter: "agNumberColumnFilter", cellRendererFramework: ViewMembersButton }
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Groups"
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch groups. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    search={r => `${r.groupId},${r.protocol},${r.protocolType}`}
                    rows={this.state.rows}
                    raw={this.state.data.groups}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}