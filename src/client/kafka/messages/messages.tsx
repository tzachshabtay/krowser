import React from "react";
import { RouteComponentProps } from "react-router-dom";
import { KafkaToolbar} from '../../common/toolbar';
import { DataView} from '../../common/data_view';
import { SingleTopicInput} from './single_topic_input';
import { MultiTopicsInput} from './multi_topics_input';
import Typography from '@material-ui/core/Typography';
import { GridReadyEvent, GridApi, ColumnApi, FilterChangedEvent } from 'ag-grid-community';

interface Props extends RouteComponentProps<{ topic?: string, partition?: string }> {
}

type State = {
    search: string;
    rows: any[];
    error: string;
    customCols: {cols: {}};
}

export class Messages extends React.Component<Props, State> {
    state: State = { search: "", rows: [], customCols: {cols: {}}, error: "" }
    api: GridApi | null = null;
    columnApi: ColumnApi | null = null;

    getRow = (data: any, customCols: {cols: {}}): any => {
        let row: any = {
            rowTimestamp: data.message.timestamp,
            rowOffset: parseInt(data.message.offset),
            rowValue: data.value,
            rowType: data.schemaType ? data.schemaType.name : "",
            rowKey: data.key,
            rowTopic: data.topic,
            rowPartition: data.partition,
        }
        try {
            const cols = JSON.parse(data.value)
            let jsonRow: any = {}
            for (const col in row) {
                if (col === "rowValue") {
                    jsonRow.Value = cols;
                    continue;
                }
                if (col.startsWith("row")) {
                    jsonRow[col.substring(3)] = row[col];
                }
            }
            row = {...row, ...cols}
            row.rowJson = jsonRow;
            customCols.cols = {...customCols.cols, ...cols}
        }
        catch (error) {
            console.warn(`row is not json encoded, error: ${error}`)
        }
        return row
    }

    onGridReady = (params: GridReadyEvent) => {
        this.api = params.api;
        this.columnApi = params.columnApi;
    }

    onFilterChanged = (event: FilterChangedEvent) => {
        if (!this.columnApi) {
            return
        }
        const nonEmptyCols = this.getNonEmptyColumns()
        for (const col of this.columnApi.getAllColumns()) {
            let id = col.getColDef().field!
            if (id.startsWith("row")) {
                continue
            }
            const nestingIndex = id.indexOf('.')
            if (nestingIndex >= 1) {
                id = id.substring(0, nestingIndex)
            }
            if (nonEmptyCols[id]) {
                this.columnApi.setColumnVisible(col, true)
            } else {
                this.columnApi.setColumnVisible(col, false)
            }
        }
    }

    getColumnDefs = () => {
        const cols: any[] = [
            { headerName: "Timestamp", field: "rowTimestamp", valueFormatter: this.timeFormatter },
            { headerName: "Offset", field: "rowOffset", filter: "agNumberColumnFilter" },
            { headerName: "Type", field: "rowType" }
        ]
        if (this.props.match.params.topic === undefined) {
            cols.push({headerName: "Topic", field: "rowTopic"})
            cols.push({headerName: "Partition", field: "rowPartition"})
        }
        this.addCustomColumns(cols, this.state.customCols.cols, ``)
        cols.push({headerName: "Key", field: "rowKey"})
        cols.push({headerName: "Value", field: "rowValue"})
        return cols
    }

    addCustomColumns = (cols: any[], fields: any, prefix: string) => {
        for (const prop in fields) {
            const val: any = fields[prop]
            if (typeof val === 'object') {
                this.addCustomColumns(cols, val, `${prefix}${prop}.`)
            } else {
                const name = `${prefix}${prop}`
                cols.push({headerName: name, field: name})
            }
        }
    }

    getNonEmptyColumns = (): any => {
        if (!this.api) {
            return undefined
        }
        const filterModel = this.api.getFilterModel()
        if (Object.keys(filterModel).length === 0) {
            return undefined
        }
        const nonEmptyColumns: any = {}
        this.api.forEachNodeAfterFilter((node, index) => {
            for (const col in node.data) {
                if (node.data[col]) {
                    nonEmptyColumns[col] = true
                }
            }
        })
        return nonEmptyColumns
    }

    timeFormatter(params: any) {
        const date = new Date(parseFloat(params.value));
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const day = date.getDate().toString().padStart(2, "0")
        const year = date.getFullYear().toString().padStart(4, "0")
        const hour = date.getHours().toString().padStart(2, "0")
        const minute = date.getMinutes().toString().padStart(2, "0")
        const second = date.getSeconds().toString().padStart(2, "0")
        const millis = date.getMilliseconds().toString().padStart(3, "0")
        return `${month}/${day}/${year} ${hour}:${minute}:${second}.${millis}`
    }

    onDataFetched = (data: any) => {
        console.log(data)
        if (data.error) {
            this.setState({error: `Failed to fetch data. Error: ${data.error}`})
            return
        }
        const customCols = {cols: {}}
        const rows = data.map((d: any) => this.getRow(d, customCols))
        this.setState({
            rows, customCols, error: ""
        })
    }

    render() {
        const title = this.props.match.params.topic === undefined ? `Cross-Topic search` : `Messages for topic: ${this.props.match.params.topic}`
        return (
            <>
                <KafkaToolbar
                    title={title}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                <br />
                { this.props.match.params.topic === undefined ?
                (
                    <MultiTopicsInput onDataFetched={this.onDataFetched} search={this.state.search}></MultiTopicsInput>
                ) : (
                    <SingleTopicInput
                        topic={this.props.match.params.topic}
                        partition={this.props.match.params.partition}
                        onDataFetched={this.onDataFetched}>
                    </SingleTopicInput>
                )}
                { this.state.error && (<Typography color="error">{this.state.error}</Typography>)}
                <DataView
                    search={r => r.rowValue.includes(this.state.search) || r.rowKey.includes(this.state.search)}
                    searchQuery={this.state.search}
                    rows={this.state.rows}
                    jsonRows={this.state.rows.map(r => r.rowJson)}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    onFilterChanged={this.onFilterChanged}
                ></DataView>
            </>
        )
    }
}