import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar } from '../common/toolbar';
import { DataView } from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import Link from '@material-ui/core/Link';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetTopicConfigsResult } from "../../shared/api";
import { ConfigEntries } from "kafkajs";

type State = {
    loading: boolean;
    error?: string;
    rows: ConfigEntries[];
    data?: GetTopicConfigsResult;
}

export interface TopicConfigLinkProps {
    data: { configName: string };
}

const TopicConfigLink: React.FunctionComponent<TopicConfigLinkProps> = (props) => {
    return (
    <Link rel="noopener noreferrer" color="primary" target="_blank" href={`https://docs.confluent.io/current/installation/configuration/topic-configs.html#${props.data.configName}`}>
                {props.data.configName}
    </Link>)
}

export class TopicConfigs extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { loading: true, rows: [], data: undefined, error: "" }
    url: Url;

    constructor(props: RouteComponentProps<{ topic: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        const response = await fetch(`/api/topic/${this.props.match.params.topic}/config`)
        const data: GetTopicConfigsResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const results = data.resources[0].configEntries
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
                <KafkaToolbar
                    title={`Configs for topic: ${this.props.match.params.topic}`}
                    url={this.url}
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix="Failed to fetch configs. Error: "></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: ConfigEntries) => r.configName}
                    rows={this.state.rows}
                    raw={this.state.data?.resources ?? []}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}