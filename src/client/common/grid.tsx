import React from "react";
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, ColDef, FilterChangedEvent } from 'ag-grid-community';
import { useTheme } from './theme_hook'
import { Url } from "./url";

import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine-dark.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';
import { Search, UseSearch } from "./use_search";
import { Includes } from "../../shared/search";

export interface GridProps {
    url: Url;
    search: (row: any) => string;
    rows: any[];
    columnDefs: ColDef[];
    onGridReady?(event: GridReadyEvent): void;
    onFilterChanged?(event: FilterChangedEvent): void;
}

export const Grid: React.FunctionComponent<GridProps> = (props) => {
    const search: Search = UseSearch(props.url)
    let rows = props.rows
    if (search.pattern) {
        rows = rows.filter(r => Includes(props.search(r), search.pattern, search.style))
    }
    const { theme, _ } = useTheme()
    const cssTheme = theme === `dark` ? `ag-theme-alpine-dark` : `ag-theme-alpine`
    return (
        <div className={cssTheme}>
            <AgGridReact
                columnDefs={props.columnDefs}
                rowData={rows}
                domLayout='autoHeight'
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                onGridReady={props.onGridReady}
                onFilterChanged={props.onFilterChanged}
                enableCellTextSelection={true}
                pagination={true}
                columnTypes={
                    {
                        connectorState: { cellStyle: params => {
                            switch (params.value) {
                                case `RUNNING`:
                                    return {color: theme === `dark` ? `lightgreen` : `darkgreen` }
                                case `FAILED`:
                                    return {color: theme === `dark` ? `lightcoral` : `red`}
                                case `PAUSED`:
                                    return {color: theme === `dark` ? `orange` : `darkorange`}
                                default:
                                    return {}
                            }
                        }},
                    }
                }
            >
            </AgGridReact>
        </div>
    )
}