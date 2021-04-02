import React from "react";
import CircularProgress from '@material-ui/core/CircularProgress';
import { KafkaToolbar} from '../common/toolbar';
import { DataView} from '../common/data_view';
import { RouteComponentProps } from "react-router-dom";
import { GridApi, ColumnApi, GridReadyEvent } from 'ag-grid-community';
import { ErrorMsg} from '../common/error_msg';
import { Url } from "../common/url";
import { GetSchemaResult, GetSubjectVersionsResult } from "../../shared/api";
import { Schema } from "avsc";


type State = {
    search: string;
    loading: boolean;
    rows: any[];
    customCols: {cols: {}};
    error?: string;
    errorPrefix: string;
}

interface Field {
    name: string;
    doc?: string;
    type: Schema;
    default?: any;
    order?: "ascending" | "descending" | "ignore";
}

interface RecordType {
    type: "record" | "error";
    name: string;
    namespace?: string;
    doc?: string;
    aliases?: string[];
    fields: Field[];
}

type Version = {
    version: number,
    schema?: GetSchemaResult,
    [key: string]: any,
}

interface EnumType {
    type: "enum";
    name: string;
    namespace?: string;
    aliases?: string[];
    doc?: string;
    symbols: string[];
}

export class Versions extends React.Component<RouteComponentProps<{ subject: string }>, State> {
    state: State = { search: "", loading: true, rows: [], customCols: {cols: {}}, error: "", errorPrefix: "" }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;
    url: Url;

    constructor(props: RouteComponentProps<{ subject: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        const response = await fetch(`/api/schema-registry/versions/${this.props.match.params.subject}`)
        const data: GetSubjectVersionsResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: "Failed to fetch versions. Error: "})
            return
        }
        const results = data.map(r => (
            { version: r }))
        const search = this.url.Get(`search`) || ``
        this.setState({ loading: false, rows: results, search })
        const customCols = {cols: {}}
        for (const version of results) {
            await this.fetchSchema(version, customCols)
        }
        this.setState({customCols})
    }

    async fetchSchema(version: Version, customCols: {cols: any}) {
        const response = await fetch(`/api/schema-registry/schema/${this.props.match.params.subject}/${version.version}`)
        const data: GetSchemaResult = await response.json()
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: `Failed to fetch schema for version ${version.version}. Error: `})
            return
        }
        version.schema = data
        this.addToRow(version, data as RecordType, customCols, "")
        if (this.gridApi) {
            this.gridApi.refreshCells()
        }
        this.forceUpdate();
    }

    addToRow = (row: Version, record: RecordType, customCols: {cols: any}, prefix: string) => {
        if (record.fields === undefined) {
            return
        }
        for (const field of record.fields) {
            const name = `${prefix}${field.name}`
            const innerRecord = field.type as RecordType
            if (typeof innerRecord === "object" && innerRecord.type === "record") {
                this.addToRow(row, innerRecord, customCols, `${name}->`)
                continue
            }
            row[name] = this.getFieldValue(field)
            customCols.cols[name] = row[name]
        }
    }

    getFieldValue(field: Field): string {
        if (typeof field.type === "string") {
            return field.type
        }
        const enumType = field.type as EnumType
        if (enumType.type === "enum") {
            const symbols = enumType.symbols.join(`, `)
            return `${enumType.name} (${symbols})`
        }
        if (Array.isArray(field.type)) {
            const union = field.type.join(`, `)
            return `union{ ${union} }`
        }
        return `Unsupported Type`
    }

    getColumnDefs() {
        const cols = [
            { headerName: "Version", field: "version", filter: "agNumberColumnFilter" },
            { headerName: "Type", field: "schema.type" },
            { headerName: "Name", field: "schema.name" },
            { headerName: "Namespace", field: "schema.namespace" },
        ]
        this.addCustomColumns(cols, this.state.customCols.cols, ``)
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

    render() {
        return (
            <>
                <KafkaToolbar
                    title={`Schemas for subject ${this.props.match.params.subject}`}
                    url={this.url}
                    searchText={this.state.search}
                    onSearch={e => this.setState({ search: e.target.value })}>
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    searchQuery={this.state.search}
                    search={r => r.schema.includes(this.state.search)}
                    rows={this.state.rows}
                    raw={this.state.rows.map(r => ({version: r.version, schema: r.schema}))}
                    url={this.url}
                    columnDefs={this.getColumnDefs()}
                    onGridReady={this.onGridReady}
                    >
                </DataView>}
            </>
        )
    }
}