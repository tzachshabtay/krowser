import React from "react";
import ReactDOM from "react-dom";
import { Route, Link, BrowserRouter as Router } from 'react-router-dom'
import { Topics } from "./kafka/topics"
import { Partitions } from "./kafka/partitions"
import { Messages } from "./kafka/messages/messages"

import "./style.css";

const App = () => {
	return (
		<Router>
			<div>
				<Route path="/" exact component={Topics} />
				<Route path="/partitions/:topic" component={Partitions} />
				<Route path="/messages/:topic/:partition" component={Messages} />
				<Route path="/messages/:topic" exact component={Messages} />
				<Route path="/messages-cross-topics" exact component={Messages} />
			</div>
		</Router>
	)
};

ReactDOM.render(
	<App />,
	document.getElementById("root"),
);
