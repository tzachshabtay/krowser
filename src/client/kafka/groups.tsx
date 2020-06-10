import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { RouteComponentProps } from "react-router-dom";
import { CellProps, CellButton } from '../common/cell_button';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
}

class ViewMembersButton extends React.Component<CellProps, {}> {
    render() {
        return <CellButton getUrl={() => `/members/${this.props.data.groupId}`} {...this.props} />
    }
}

export class Groups extends React.Component<RouteComponentProps, State> {
    state: State = { loading: true, rows: [], search: "" }

    async componentDidMount() {
        const response = await fetch(`/api/groups`)
        const data = await response.json()
        const results = data.groups.map((r: any) => {
            return { numMembers: r.members.length, raw: r, history: this.props.history, ...r }
        })
        this.setState({ loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Group ID", field: "groupId" },
            { headerName: "Protocol", field: "protocol" },
            { headerName: "Protocol Type", field: "protocolType" },
            { headerName: "State", field: "state" },
            { headerName: "#Members", field: "numMembers", filter: "agNumberColumnFilter", cellRendererFramework: ViewMembersButton }
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar
                    title="Groups"
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.groupId.includes(this.state.search) || r.protocol.includes(this.state.search) || r.protocolType.includes(this.state.search)}
                    rows={this.state.rows}
                    jsonRows={this.state.rows.map(r => r.raw)}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}