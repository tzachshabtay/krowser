import React from "react";
import ReactDOM from "react-dom";
import { Route, BrowserRouter as Router } from 'react-router-dom'
import { Topics } from "./kafka/topics"
import { Partitions } from "./kafka/partitions"
import { Messages } from "./kafka/messages/messages"
import { TopicConfigs } from "./kafka/topic_configs"
import { Brokers } from "./kafka/brokers"
import { Groups } from "./kafka/groups"
import { Members } from "./kafka/members"
import { Subjects } from "./schema-registry/subjects"
import { Versions } from "./schema-registry/versions"
import { GlobalThemeProvider } from "./common/theme_hook"

import "./style.css";

const App = () => {
	return (
		<GlobalThemeProvider>
			<Router>
				<div>
					<Route path="/" exact component={Topics} />
					<Route path="/topic/partitions/:topic" exact component={Partitions} />
					<Route path="/topic/configs/:topic" exact component={TopicConfigs} />
					<Route path="/topic/messages/:topic/:partition" component={Messages} />
					<Route path="/topic/messages/:topic" exact component={Messages} />
					<Route path="/messages-cross-topics" exact component={Messages} />
					<Route path="/brokers" exact component={Brokers} />
					<Route path="/groups" exact component={Groups} />
					<Route path="/members/:group" exact component={Members} />
					<Route path="/schema-registry/subjects" exact component={Subjects} />
					<Route path="/schema-registry/versions/:subject" exact component={Versions} />
				</div>
			</Router>
		</GlobalThemeProvider>
	)
};

ReactDOM.render(
	<App />,
	document.getElementById("root"),
);
