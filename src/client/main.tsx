import React, { useState } from "react";
import ReactDOM from "react-dom";

import "./style.css";

const App = () => {
	const [counter, setCounter] = useState(0);

	return (
		<div className="App">
			<h1>{counter}</h1>
			<button onClick={() => setCounter(counter + 1)}>Press me</button>
		</div>
	)
};

ReactDOM.render(
	<App />,
	document.getElementById("root"),
);
