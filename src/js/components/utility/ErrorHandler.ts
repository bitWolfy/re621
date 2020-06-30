import { XM } from "../api/XM";
import { RE6Module } from "../RE6Module";
import { Modal } from "../structure/Modal";

declare const UAParser;

export class ErrorHandler {

    private static instance: ErrorHandler;

    private modal: Modal;

    private feedback: JQuery<HTMLElement>;
    private trigger: JQuery<HTMLElement>;

    private constructor() {
        const $contentWrapper = $("<div>")
            .append("<p>RE621 has encountered an error during script execution.</p>")
            .append(`<p>Please, report this message, including the error log below, through the <a href="` + window["re621"]["links"]["issues"] + `">issue tracker</a>, or in the <a href="` + window["re621"]["links"]["forum"] + `">forum thread</a>.</p>`);

        this.feedback = $("<textarea>")
            .addClass("error-feedback bg-section color-text")
            .val(
                window["re621"]["name"] + ` v.` + window["re621"]["version"] + `-` + window["re621"]["build"] + ` for ` + XM.info().scriptHandler + ` v.` + XM.info().version + `\n` +
                window.navigator.userAgent + `\n`
            )
            .appendTo($contentWrapper);

        this.trigger = $("<a>");

        this.modal = new Modal({
            title: "An error has occurred",
            content: $contentWrapper,
            triggers: [{ element: this.trigger }],

            fixed: true,
        });

        this.modal.getElement().dialog("open");
    }

    private static getInstance(): ErrorHandler {
        if (this.instance === undefined) this.instance = new ErrorHandler();
        return this.instance;
    }

    /**
     * Writes a message into the error log, but does not trigger the error modal to open.  
     * Useful if you need to write several messages into the log.  
     * @param module Module that triggered the error. ex. TinyAlias
     * @param message Error message, preferably the stack trace
     * @param context Error context. ex. API Lookup
     */
    public static log(module: "ModuleController" | "DOM" | { new(): RE6Module }, message: string, context?: string): void {
        const instance = this.getInstance();

        if (typeof module !== "string") module = module.prototype.constructor.name;
        if (context !== undefined) module += "/" + context;

        instance.feedback.val((index, value) => {
            const entry = (value === "") ? module + "\n" + message + "\n" : value + "\n" + module + "\n" + message + "\n";
            console.log(entry);
            return entry;
        });
    }

    /**
     * Writes a message into the error log and shows it to the user. 
     * @param module Module that triggered the error. ex. TinyAlias
     * @param message Error message, preferably the stack trace
     * @param context Error context. ex. API Lookup
     */
    public static error(module: "ModuleController" | "DOM" | { new(): RE6Module }, message: string, context?: string): void {
        const instance = this.getInstance();
        if (!instance.modal.isOpen()) instance.trigger.get(0).click();
        this.log(module, message, context);
    }

    public static async report(): Promise<any> {
        //    if(await XM.Storage.getValue("re621.report", false)) return;
        //    XM.Storage.setValue("re621.stats", true);

        const userAgent = UAParser(navigator.userAgent);
        const userInfo = {
            browserName: userAgent.browser.name,
            browserVersion: userAgent.browser.major,
            osName: userAgent.os.name,
            osVersion: userAgent.os.version,
            handlerName: XM.info().scriptHandler,
            handlerVersion: XM.info().version,
        }

        return XM.Connect.xmlHttpPromise({
            method: "POST",
            url: "https://re621.bitwolfy.com/report",
            headers: { "User-Agent": window["re621"]["useragent"] },
            data: JSON.stringify(userInfo),
            onload: (data) => { console.log(data.responseText); }
        });
    }

}