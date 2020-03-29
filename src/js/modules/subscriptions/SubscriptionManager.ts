import { RE6Module } from "../../components/RE6Module";
import { HeaderCustomizer } from "../general/HeaderCustomizer";
import { Tabbed } from "../../components/structure/Tabbed";
import { Modal } from "../../components/structure/Modal";
import { Subscription } from "./Subscription";
import { Util } from "../../components/structure/Util";

export class SubscriptionManager extends RE6Module {

    private static instance: SubscriptionManager;
    //should notifications be cleared once seen?
    public dismissOnUpdate: boolean = true;
    private updateInterval = 60 * 60; //1 hour, in seconds

    private tabNotificationsCount = 0;
    private subscribers: Subscription[] = [];

    public openSubsButton: { link: any; tab?: JQuery<HTMLElement>; };

    /**
     * Creates the module's structure.  
     * Should be run immediately after the constructor finishes.
     */
    public async create() {
        if (!this.canInitialize()) return;
        super.create();
        // Create a button in the header
        this.openSubsButton = HeaderCustomizer.getInstance().createTabElement({
            name: `<i class="fas fa-bell"></i>`,
            parent: "menu.extra",
            controls: false,
        });

        let content = [];
        for (const sub of this.subscribers) {
            await this.initSubscriber(sub);
            content.push({ name: sub.getName(), page: sub.tab });
        }

        let $subsTabs = new Tabbed({
            name: "settings-tabs",
            content: content
        });

        // Create the modal
        let modal = new Modal({
            title: "Subscriptions",
            triggers: [{ element: this.openSubsButton.link }],
            escapable: false,
            content: $subsTabs.create(),
            position: { my: "right top", at: "right top" }
        });

        //clear the notifications if the user opened the tab
        modal.getElement().on("dialogopen", event => {
            const index = modal.getElement().tabs("option", "active");
            const $element = $(event.currentTarget).find("[data-subscription-class]").eq(index);
            this.removeUnopened($element);
        });

        modal.getElement().tabs({
            activate: (event, tabProperties) => {
                const $element = tabProperties.newPanel.find(".subscriptions-list");
                this.removeUnopened($element);
            }
        });
    }

    public updateNotificationSymbol(difference: number) {
        this.tabNotificationsCount += difference;
        this.openSubsButton.link.attr("data-has-notifications", (this.tabNotificationsCount > 0).toString());
    }

    /**
     * Adds a subscriber to the list of them and creates a tab for it.
     * @param instance subscriber to be queued for update check
     */
    public static registerSubscriber(instance: Subscription) {
        this.getInstance().subscribers.push(instance);
    }

    public static createTabContent() {
        let $content = $("<div>")
            .addClass("subscriptions-list");

        return $content;
    }

    /**
     * Starts checking for updates for the passed subscriber
     */
    public async initSubscriber(instance: Subscription) {
        const moduleName = instance.constructor.name;
        let lastUpdate: number = instance.fetchSettings("lastUpdate");
        let cachedUpdates: UpdateData[] = this.fetchSettings("cache-" + moduleName);

        if (lastUpdate === undefined) {
            lastUpdate = new Date().getTime();
            instance.pushSettings("lastUpdate", lastUpdate);
        }
        if (cachedUpdates === undefined) {
            cachedUpdates = [];
        }

        this.addSubscribeButtons(instance);
        instance.tab = SubscriptionManager.createTabContent();
        instance.tab.attr("data-subscription-class", moduleName);
        instance.lastUpdate = lastUpdate;
        const currentDate = new Date().getTime();

        //don't update if the last check was pretty recently
        if (currentDate - lastUpdate - (this.updateInterval * 1000) < 0) {
            this.addUpdateEntries(instance, cachedUpdates);
            return;
        }

        const updates = await instance.getUpdatedEntries();
        this.addUpdateEntries(instance, updates);
        instance.pushSettings("lastUpdate", currentDate);
        this.pushSettings("cache-" + moduleName, updates);
    }

    /**
     * Creates an element through the data and how the subscriber defines it
     * @returns the element to append to a tab
     */
    private createUpdateEntry(data: UpdateData, definition: UpdateDefinition) {
        let $content = $("<div>")
            .addClass("subscription-update");

        // Image
        let $image = $("<div>")
            .addClass("subscription-update-preview")
            .appendTo($content);
        $("<img>")
            .attr("src", definition.imageSrc(data))
            .appendTo($image);

        // Entry Title
        let $title = $("<div>")
            .addClass("subscription-update-title")
            .appendTo($content);
        $("<a>")
            .html(definition.updateText(data))
            .attr({
                "href": definition.updateHref(data),
                "data-id": data.id,
            })
            .appendTo($title);

        // Link to all posts page
        let $full = $("<div>")
            .addClass("subscription-update-full")
            .appendTo($content);
        $("<a>")
            .attr("href", definition.sourceHref(data))
            .html(definition.sourceText(data))
            .appendTo($full);

        // Last Updated
        let $date = $("<div>")
            .addClass("subscription-update-date")
            .appendTo($content);
        $("<span>")
            .html(Util.timeAgo(data.date))
            .attr("title", data.date.toLocaleString())
            .appendTo($date);

        return $content;
    }

    public addSubscribeButtons(instance: Subscription) {
        let $subscribeButton = $("<button>")
            .addClass("subscribe-button subscribe")
            .html("Subscribe");
        let $unsubscribeButton = $("<button>")
            .addClass("subscribe-button unsubscribe")
            .html("Unsubscribe");

        let subscriptionData: SubscriptionSettings = instance.fetchSettings("data", true);

        if (subscriptionData[instance.getSubscriberId()] === undefined) {
            $unsubscribeButton.addClass("hidden");
        } else { $subscribeButton.addClass("hidden"); }

        $subscribeButton.click(() => {
            $subscribeButton.toggleClass("hidden");
            $unsubscribeButton.toggleClass("hidden");
            subscriptionData = instance.fetchSettings("data", true);
            subscriptionData[instance.getSubscriberId()] = {};
            instance.pushSettings("data", subscriptionData);
        });
        $unsubscribeButton.click(() => {
            $subscribeButton.toggleClass("hidden");
            $unsubscribeButton.toggleClass("hidden");
            subscriptionData = instance.fetchSettings("data", true);

            delete subscriptionData[instance.getSubscriberId()];
            instance.pushSettings("data", subscriptionData);
        });

        instance.appendSubscribeButtons($subscribeButton, $unsubscribeButton)
    }

    /**
     * Adds the passed updates to the tab of the subscriber
     */
    public addUpdateEntries(instance: Subscription, updates: UpdateData[]) {
        if (updates.length === 0) {
            $("<div>")
                .addClass("subscriptions-notice")
                .html("All caught up!")
                .appendTo(instance.tab);
        } else {
            updates.forEach(entry => {
                instance.tab.append(this.createUpdateEntry(entry, instance.updateDefinition));
            });
            this.updateNotificationSymbol(1);
            instance.tab.attr("data-remove-notification-count", "true");
        }
    }

    protected removeUnopened($element: JQuery<HTMLElement>) {
        if ($element.attr("data-remove-notification-count") === "true" && this.dismissOnUpdate === true) {
            this.updateNotificationSymbol(-1);
            this.pushSettings("cache-" + $element.attr("data-subscription-class"), []);
        }
    }

    protected getDefaultSettings() {
        return {
            enabled: true
        };
    }

    public static getInstance() {
        if (this.instance == undefined) this.instance = new SubscriptionManager();
        return this.instance;
    }

}



export interface SubscriptionSettings {
    [id: number]: any
}

export interface UpdateData {
    id: number,
    name: string,
    date: Date,
    last: number,
    thumbnailMd5: string
    extra?: any
}

export interface UpdateDefinition {
    //what link should be opened when you click on the image? Leave empty for no action
    imageHref: (data: UpdateData) => string,
    //image link which should be displayed on the left side of the entry
    imageSrc: (data: UpdateData) => string,
    //Link to get to the update
    updateHref: (data: UpdateData) => string,
    //Text for the updatelink
    updateText: (data: UpdateData) => string,
    //Text to display when clicking on sourceLink
    sourceText: (data: UpdateData) => string,
    //Link to where the "first page" of the subscription
    sourceHref: (data: UpdateData) => string,
}
