import React from "react";
import TextField from '@material-ui/core/TextField';
import CircularProgress from '@material-ui/core/CircularProgress';
import Checkbox from '@material-ui/core/Checkbox';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import Toolbar from '@material-ui/core/Toolbar';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemText from '@material-ui/core/ListItemText';
import { GoButton } from './go_button';
import { ErrorMsg} from '../../common/error_msg';
import { Url } from '../../common/url';

interface Props {
    url: Url;
    search: string;
    selectedTopics?: any;
    searchFrom?: any;
    limit?: any;
    onDataFetched: (data: any) => void;
    onDataFetchStarted: () => void;
}

type State = {
    topics: string[];
    selectedTopics: string[];
    loadingMessages: boolean;
    loadingTopics: boolean;
    searchFrom: string;
    limit: number;
    error: any;
    isCanceled: boolean;
    abortController: AbortController | null;
}


export class MultiTopicsInput extends React.Component<Props, State> {
    state: State = {
        topics: [],
        selectedTopics: [],
        searchFrom: `End`,
        limit: 100,
        loadingMessages: false,
        loadingTopics: true,
        error: "",
        isCanceled: false,
        abortController: null,
    }

    async componentDidMount() {
        const newState: any = {};
        if (this.props.selectedTopics !== undefined) {
            newState.selectedTopics = this.props.selectedTopics.split(`,`)
        }
        if (this.props.searchFrom !== undefined) {
            newState.searchFrom = this.props.searchFrom
        }
        if (this.props.limit !== undefined) {
            newState.limit = this.props.limit
        }
        this.setState(newState, this.updateUrl)
        await this.fetchTopics()
    }

    async fetchTopics() {
        const response = await fetch(`/api/topics`)
        const data = await response.json()
        if (data.error) {
            this.setState({loadingTopics: false, error: data.error })
            return
        }
        const topics = data.topics.map((r: any) => r.name)
        this.setState({topics, loadingTopics: false})
    }

    fetchMessages = async () => {
        this.setState({ loadingMessages: true })
        this.props.onDataFetchStarted()
        const topics = this.state.selectedTopics.join(`,`)
        const response = await fetch(
            `/api/messages-cross-topics/${topics}?limit=${this.state.limit}&search_from=${this.state.searchFrom}&search=${this.props.search}`,
            {signal: this.state.abortController?.signal})
        if (this.state.isCanceled) {
            this.setState({loadingMessages: false})
            return
        }
        const data = await response.json()
        if (this.state.isCanceled) {
            this.setState({loadingMessages: false})
            return
        }
        this.props.onDataFetched(data)
        this.setState({loadingMessages: false})
    }

    updateUrl = () => {
        this.props.url.BaseUrl = `/messages-cross-topics`
        this.props.url.Set(
            {name: `searchFrom`, val: this.state.searchFrom},
            {name: `limit`, val: this.state.limit.toString()},
            {name: `topics`, val: this.state.selectedTopics.join(`,`)})
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

        const searchFrom = [`Beginning`, `End`].map((from: string) => (<MenuItem key={from} value={from}>{from}</MenuItem>))
        const allTopicsSelected = this.state.selectedTopics.length === this.state.topics.length

        return (
            <>
            <Toolbar>
                <div style={{ flex: 1 }}>
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                        <InputLabel htmlFor="topics-select">Topics</InputLabel>
                        <Select
                            value={this.state.selectedTopics}
                            multiple
                            renderValue={(selected: any) => selected.length > 2 ? `${selected.length} topics` : selected.join(', ')}
                            onChange={(e: any) => {
                                let selected = e.target.value
                                if (selected && selected.includes("SelectAll")) {
                                    if (allTopicsSelected) {
                                        selected = []
                                    } else {
                                        selected = this.state.topics
                                    }
                                }
                                this.setState({ selectedTopics: selected }, this.updateUrl)
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
                    <FormControl style={{ margin: 16, minWidth: 120 }}>
                        <InputLabel htmlFor="search-from-select">Search From</InputLabel>
                        <Select
                                value={this.state.searchFrom}
                                onChange={(e: any) => this.setState({ searchFrom: e.target.value }, this.updateUrl)}
                                inputProps={{
                                    name: 'search-from',
                                    id: 'search-from-select',
                                }}
                            >
                                {searchFrom}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Limit"
                        type="number"
                        value={this.state.limit}
                        onChange={(e: any) => this.setState({ limit: parseInt(e.target.value) }, this.updateUrl)}
                        margin="normal"
                        style={{ marginRight: 10, maxWidth: 50 }}
                        inputProps={{ min: "0", step: "1" }}
                    />
                    </div>
                    <GoButton
                        onRun={() => { this.setState({isCanceled: false, abortController: new AbortController()}, async () => await this.fetchMessages())}}
                        onCancel={()=>{ this.setState({isCanceled: true }, () => this.state.abortController?.abort())}}
                        isRunning={this.state.loadingMessages}>
                    </GoButton>
            </Toolbar>
            <ErrorMsg error={this.state.error} prefix="Failed to fetch topics. Error: "></ErrorMsg>
            </>
        )
    }
}