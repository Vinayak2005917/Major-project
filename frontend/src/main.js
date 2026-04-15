import React from "https://esm.sh/react@18.2.0?target=es2019";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client?target=es2019";

const rootElement = document.getElementById("root");

async function bootstrap() {
	try {
		const { App } = await import("./App.js");
		createRoot(rootElement).render(React.createElement(App));
	} catch (error) {
		console.error(error);
		const errorMessage = error && error.message ? error.message : String(error);

		rootElement.innerHTML = `
			<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#191919;color:#f1f1f1;font-family:Segoe UI, Noto Sans, sans-serif;padding:24px;">
				<div style="max-width:720px;border:1px solid #2f2f2f;background:#1f1f1f;border-radius:12px;padding:16px;line-height:1.6;">
					<h1 style="margin:0 0 8px;font-size:1.1rem;">App failed to load</h1>
					<p style="margin:0 0 8px;color:#b4b4b4;">Check browser console for the exact error. If you opened this file directly, run it via a local server.</p>
					<pre style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:#e8e8e8;">${errorMessage}</pre>
				</div>
			</div>
		`;
	}
}

bootstrap();
