import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import Link from '@material-ui/core/Link';

type State = {
    search: string;
    loading: boolean;
    rows: any[];
    data: any;
}

export interface TopicConfigLinkProps {
    data: { configName: string };
}

class TopicConfigLink extends React.Component<TopicConfigLinkProps, {}> {
    render() {
        return (
        <Link rel="noopener noreferrer" target="_blank" href={`https://docs.confluent.io/current/installation/configuration/topic-configs.html#${this.props.data.configName}`}>
                    {this.props.data.configName}
        </Link>)
    }
}

export class TopicConfigs extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { search: "", loading: true, rows: [], data: {} }

    async componentDidMount() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}/config`)
        const data = await response.json()
        const results = data.config.resources[0].configEntries
        this.setState({ data, loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Name", field: "configName", cellRendererFramework: TopicConfigLink },
            { headerName: "Value", field: "configValue" },
            { headerName: "Readonly", field: "readOnly" },
            { headerName: "Is Default", field: "isDefault"},
            { headerName: "Is Sensitive", field: "isSensitive"},
        ]
    }

    render() {
        return (
            <>
                <KafkaToolbar title={`Configs for topic: ${this.props.match.params.topic}`}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.configName.includes(this.state.search)}
                    rows={this.state.rows}
                    jsonRows={this.state.data}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}