import React from "react";
import ReactDOM from "react-dom";
import { Topics } from "./topics"

import "./style.css";

const App = () => {
	return (
		<Topics />
	)
};

ReactDOM.render(
	<App />,
	document.getElementById("root"),
);
