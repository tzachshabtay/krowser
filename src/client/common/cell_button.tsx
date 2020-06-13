import React from "react";
import Button from '@material-ui/core/Button';
import EventNote from '@material-ui/icons/EventNote';
import { useTheme } from './theme_hook';

export interface CellProps {
    value?: number;
    data: any;
}

export interface CellButtonProps extends CellProps {
    getUrl: () => string;
}

export const CellButton: React.SFC<CellButtonProps> = (props) => {
    let msg = "Loading"
    if (props.value || props.value === 0) {
        msg = props.value.toString()
    }
    const { theme, _ } = useTheme()
    const buttonColor = theme === `dark` ? `secondary` : `primary`
    return (
        <div style={{ width: "100%", justifyContent: 'left', textAlign: "left", marginTop: -3 }}>
            <Button color={buttonColor} size="small" style={{ justifyContent: 'left', textAlign: "left" }}
                onClick={() => { props.data.history.push(props.getUrl()) }}>
                <EventNote />
                {msg}
            </Button>
        </div>
    )
}