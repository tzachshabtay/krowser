import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar } from '../common/toolbar';
import { DataView } from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import Link from '@material-ui/core/Link';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetTopicConfigsResult, ConfigEntry } from "../../shared/api";
import { CancelToken, Loader } from "../common/loader";

type State = {
    loading: boolean;
    error?: string;
    rows: ConfigEntry[];
    data?: GetTopicConfigsResult;
}

export interface TopicConfigLinkProps {
    data: { name: string };
}

const TopicConfigLink: React.FunctionComponent<TopicConfigLinkProps> = (props) => {
    return (
    <Link rel="noopener noreferrer" color="primary" target="_blank" href={`https://docs.confluent.io/current/installation/configuration/topic-configs.html#${props.data.name}`}>
                {props.data.name}
    </Link>)
}

export class TopicConfigs extends React.Component<RouteComponentProps<{ topic: string }>, State> {
    state: State = { loading: true, rows: [], data: undefined, error: "" }
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps<{ topic: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchConfigs)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchConfigs = async(cancelToken: CancelToken) => {
        const data: GetTopicConfigsResult = await cancelToken.Fetch(`/api/topic/${this.props.match.params.topic}/config`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error })
            return
        }
        const results = data.entries
        this.setState({ data, loading: false, rows: results })
    }

    getColumnDefs() {
        return [
            { headerName: "Name", field: "name", cellRendererFramework: TopicConfigLink },
            { headerName: "Value", field: "value" },
            { headerName: "Readonly", field: "is_read_only" },
            { headerName: "Is Default", field: "is_default"},
            { headerName: "Is Sensitive", field: "is_sensitive"},
            { headerName: "Source", field: "source"},
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
                    search={(r: ConfigEntry) => r.name}
                    rows={this.state.rows}
                    raw={this.state.data?.entries ?? []}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}>
                </DataView>}
            </>
        )
    }
}