import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import Checkbox from '@material-ui/core/Checkbox';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemText from '@material-ui/core/ListItemText';
import { Fetcher, SearchBy, AllPartitions, FetchData } from './fetcher';
import { Url } from '../../common/url';
import { GetTopicsResult } from "../../../shared/api";
import { ITopicMetadata } from "kafkajs";

interface Props {
    selectedTopics?: string;
    limit?: number;
    fromTime?: string;
    toTime?: string;
    searchBy: SearchBy;
    url: Url;
    onDataFetched: (data: FetchData) => void;
    onDataFetchStarted: (partition: string) => void;
}

type State = {
    topics: string[];
    selectedTopics: string[];
    loadingMessages: boolean;
    loadingTopics: boolean;
    error?: string;
}

export class MultiTopicsInput extends React.Component<Props, State> {
    state: State = {
        topics: [],
        selectedTopics: this.props.selectedTopics?.split(`,`) ?? [],
        loadingMessages: false,
        loadingTopics: true,
        error: "",
    }

    async componentDidMount() {
        await this.fetchTopics()
    }

    async fetchTopics() {
        const response = await fetch(`/api/topics`)
        const data: GetTopicsResult = await response.json()
        if (data.error) {
            this.setState({loadingTopics: false, error: data.error })
            return
        }
        const topics = data.topics.map((r: ITopicMetadata) => r.name)
        this.setState({topics, loadingTopics: false})
    }

    updateUrl = () => {
        this.props.url.BaseUrl = `/topics/messages/${this.state.selectedTopics.join(`,`)}`
    }

    render() {
        if (this.state.loadingTopics) {
            return (<><CircularProgress /><div>Loading...</div></>)
        }
        const topics = this.state.topics.map(topic => (
            <MenuItem key={topic} value={topic}>
                <Checkbox checked={this.state.selectedTopics.indexOf(topic) > -1} />
                <ListItemText primary={topic} />
            </MenuItem>))

        const allTopicsSelected = this.state.selectedTopics.length === this.state.topics.length

        return (
            <>
            {!this.state.loadingTopics && ( <Fetcher
                url={this.props.url}
                updateUrl={this.updateUrl}
                onError={(error: string) => this.setState({error})}
                scope={(
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                    <InputLabel htmlFor="topics-select">Topics</InputLabel>
                    <Select
                        value={this.state.selectedTopics}
                        multiple
                        renderValue={(selected: any) => selected.length > 2 ? `${selected.length} topics` : selected.join(', ')}
                        onChange={(e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
                            let selected = e.target.value as string[]
                            if (selected && selected.includes("SelectAll")) {
                                if (allTopicsSelected) {
                                    selected = []
                                } else {
                                    selected = this.state.topics
                                }
                            }
                            this.setState({ selectedTopics: selected }, () => { this.updateUrl(); this.props.url.Refresh(); })
                        }}
                        inputProps={{
                            name: 'topics',
                            id: 'topics-select',
                        }}
                    >
                        <MenuItem key={"select all topics"} value="SelectAll">
                            <Checkbox checked={allTopicsSelected} />
                            <ListItemText primary={allTopicsSelected ? "Select none" : "Select all"} />
                        </MenuItem>

                        {topics}
                    </Select>
                </FormControl>
            )}
            topics={this.state.selectedTopics}
            partition={AllPartitions}
            limit={this.props.limit}
            fromTime={this.props.fromTime}
            toTime={this.props.toTime}
            searchBy={this.props.searchBy}
            onDataFetched={this.props.onDataFetched}
            onDataFetchStarted={() => { this.setState({loadingMessages: true}); this.props.onDataFetchStarted(AllPartitions)} }
            onDataFetchCompleted={() => this.setState({loadingMessages: false})}
            loadingMessages={this.state.loadingMessages}
            error={this.state.error ?? ""}
            errorPrefix={"Error while loading messages: "}
            >
            </Fetcher>)}
            </>
        )
    }
}