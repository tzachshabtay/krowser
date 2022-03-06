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
import { CancelToken, Loader } from "../common/loader";

type State = {
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
    schema?: Schema,
    schemaID?: number,
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
    state: State = { loading: true, rows: [], customCols: {cols: {}}, error: "", errorPrefix: "" }
    gridApi: GridApi | null = null;
    columnApi: ColumnApi | null = null;
    url: Url;
    loader: Loader = new Loader()

    constructor(props: RouteComponentProps<{ subject: string }>) {
        super(props);
        this.url = new Url(props.location.search, ``);
    }

    onGridReady = (params: GridReadyEvent) => {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
    }

    async componentDidMount() {
        await this.loader.Load(this.fetchVersions)
    }

    componentWillUnmount() {
        this.loader.Abort()
    }

    fetchVersions = async (cancelToken: CancelToken) => {
        const data: GetSubjectVersionsResult = await cancelToken.Fetch(`/api/schema-registry/versions/${this.props.match.params.subject}`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: "Failed to fetch versions. Error: "})
            return
        }
        const results = data.versions.map(r => (
            { version: r }))
        this.setState({ loading: false, rows: results })
        const customCols = {cols: {}}
        for (const version of results) {
            await this.fetchSchema(version, customCols, cancelToken)
            if (cancelToken.Aborted) return
        }
        this.setState({customCols})
    }

    async fetchSchema(version: Version, customCols: {cols: any}, cancelToken: CancelToken) {
        const data: GetSchemaResult = await cancelToken.Fetch(`/api/schema-registry/schema/${this.props.match.params.subject}/${version.version}`)
        if (cancelToken.Aborted) return
        if (data.error) {
            this.setState({loading: false, error: data.error, errorPrefix: `Failed to fetch schema for version ${version.version}. Error: `})
            return
        }
        let record: RecordType = JSON.parse(data.schema)
        version.schema = record
        version.schemaID = data.id
        this.addToRow(version, record, customCols, "")
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
            { headerName: "Schema ID", field: "schemaID", filter: "agNumberColumnFilter" },
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
                >
                </KafkaToolbar>
                {this.state.loading && <><CircularProgress /><div>Loading...</div></>}
                <ErrorMsg error={this.state.error} prefix={this.state.errorPrefix}></ErrorMsg>
                {!this.state.loading && <DataView
                    search={(r: Version) => JSON.stringify(r.schema ?? "")}
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