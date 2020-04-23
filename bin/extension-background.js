function handleMessage(request, sender, sendResponse) {
    if (request.fn == "xmlHttpRequest") xmlHttpNative(request.args).then((data) => { sendResponse(data); });
    return true;
}

function xmlHttpNative(details) {
    const request = new XMLHttpRequest();

    return new Promise(function(resolve) {
        /** **onabort** callback to be executed if the request was aborted */
        request.onabort = () => {
            resolve({
                event: "onabort",
                finalURL: request.finalURL,
                state: request.readyState,
                status: request.status,
                statusText: request.statusText,
            });
        }

        /** **onerror** callback to be executed if the request ended up with an error */
        request.onerror = () => {
            resolve({
                event: "onerror",
                finalURL: request.finalURL,
                state: request.readyState,
                status: request.status,
                statusText: request.statusText,
            });
        }

        /** **onloadstart** callback to be executed if the request started to load */
        request.onloadstart = () => {
            // N/A
        }

        /** **onprogress** callback to be executed if the request made some progress */
        request.onprogress = () => {
            // N/A
        }

        /** **onreadystatechange** callback to be executed if the request's ready state changed */
        request.onreadystatechange = () => {
            if (request.readyState !== 4) return;
            if (request.status >= 200 && request.status < 300) {
                resolve({
                    event: "onload",
                    finalURL: request.finalURL,
                    state: request.readyState,
                    status: request.status,
                    statusText: request.statusText,
                    responseHeaders: request.getAllResponseHeaders(),
                    response: request.response,
                    responseXML: request.responseXML,
                    responseText: request.responseText,
                });
            } else {
                resolve({
                    event: "onerror",
                    finalURL: request.finalURL,
                    state: request.readyState,
                    status: request.status,
                    statusText: request.statusText,
                });
            }
        };

        /** **ontimeout** callback to be executed if the request failed due to a timeout */
        request.ontimeout = () => {
            details.ontimeout({
                event: "ontimeout",
                finalURL: request.finalURL,
                state: request.readyState,
                status: request.status,
                statusText: request.statusText,
            });
        }

        /** **onload** callback to be executed if the request was loaded. */
        request.onload = () => {
            // N/A
        }

        request.open(details.method, details.url, true, details.username, details.password);
        Object.keys(details.headers).forEach((header) => {
            request.setRequestHeader(header, details.headers[header]);
        });

        if (details.responseType) request.responseType = details.responseType;

        if (details.overrideMimeType) request.overrideMimeType();

        if (details.binary) request.sendAsBinary();
        else request.send();
    });
}

chrome.runtime.onMessage.addListener(handleMessage);