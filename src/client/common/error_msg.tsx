import React from "react";
import Alert from '@material-ui/lab/Alert';

interface ErrorProps {
    prefix?: string
    error?: string
}

export const ErrorMsg: React.FunctionComponent<ErrorProps> = (props) => {
    if (!props.error) {
        return null
    }
    let errorMsg = props.error
    if (typeof errorMsg === `object`) {
        errorMsg = JSON.stringify(errorMsg)
    }
    errorMsg = `${props.prefix}${errorMsg}`
    return (<Alert severity="error">{errorMsg}</Alert>)
}