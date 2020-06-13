import React from "react";
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, ColDef, FilterChangedEvent } from 'ag-grid-community';
import { useTheme } from './theme_hook'

import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine-dark.css';
import 'ag-grid-community/dist/styles/ag-theme-alpine.css';

export interface GridProps {
    searchQuery: string;
    search: (row: any) => boolean;
    rows: any[];
    columnDefs: ColDef[];
    onGridReady?(event: GridReadyEvent): void;
    onFilterChanged?(event: FilterChangedEvent): void;
}

export const Grid: React.SFC<GridProps> = (props) => {
    let rows = props.rows
    if (props.searchQuery) {
        rows = rows.filter(props.search)
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
            >
            </AgGridReact>
        </div>
    )
}