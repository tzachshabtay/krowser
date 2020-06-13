import React from "react";
import { useTheme } from './theme_hook';
import ReactJson from 'react-json-view';

export interface CardViewProps {
    raw: any[];
    searchQuery: string;
}

export const CardView: React.SFC<CardViewProps> = (props) => {
    let raw = props.raw
    if (props.searchQuery) {
        raw = filterJson(props.raw, props.searchQuery)
    }
    const { theme, _ } = useTheme()
    const jsonTheme = theme === `dark` ? `twilight` : undefined
    return (
        <ReactJson src={raw} theme={jsonTheme} style={{padding: 10, border: "solid gray"}} />
    )
}

const filterJson = (obj: any, text: string): any => {
    if (!obj) {
        return obj
    }
    if (Array.isArray(obj)) {
        return filterArray(obj, text)
    }
    if (typeof obj === 'object') {
        return filterObject(obj, text)
    }
    if (obj.toString().includes(text)) {
        return obj
    }
    return undefined
}

const filterArray = (obj: any[], text: string): any[] => {
    const res: any[] = []
    for (const item of obj) {
        const filtered = filterJson(item, text)
        if (isEmpty(filtered)) {
            continue
        }
        res.push(filtered)
    }
    return res
}

const filterObject = (obj: any, text: string): any => {
    const res: any = {}
    for (const key in obj) {
        if (key.includes(text)) {
            res[key] = obj[key]
            continue
        }
        const filtered  = filterJson(obj[key], text)
        if (isEmpty(filtered)) {
            continue
        }
        res[key] = filtered
    }
    return res
}

const isEmpty = (filtered: any): boolean => {
    if (!filtered) {
        return true
    }
    if (typeof filtered === 'object' && Object.keys(filtered).length === 0) {
        return true
    }
    return false
}