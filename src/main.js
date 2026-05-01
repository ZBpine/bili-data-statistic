import { createApp, ref, shallowRef } from "vue";
import App from "./App.vue";
import {
    monkeyWindow,
    GM_xmlhttpRequest,
    GM_getResourceText,
    unsafeWindow,
} from "$";

const HOST_ID = "bds-root-host";
const MOUNT_ID = "bds-root";
const BRIDGE_EVENT = "BDS_HTTP_BRIDGE_READY";

const isStaticSite = !location.hostname.endsWith(".bilibili.com");
const runtimeWindow = unsafeWindow || monkeyWindow || window;

if (isStaticSite) {
    if (typeof GM_xmlhttpRequest === "function") {
        runtimeWindow.__BDS_HTTP_REQUEST__ = (details) =>
            GM_xmlhttpRequest(details);
        window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));
    }
}

if (isStaticSite) {
    // Static site app handles rendering itself.
    // Userscript only injects request bridge on this host.
} else {
    function ensureShadowMount() {
        let host = document.getElementById(HOST_ID);
        if (!host) {
            host = document.createElement("div");
            host.id = HOST_ID;
            document.documentElement.appendChild(host);
        }

        const shadowRoot =
            host.shadowRoot || host.attachShadow({ mode: "open" });
        let mount = shadowRoot.getElementById(MOUNT_ID);
        if (!mount) {
            mount = document.createElement("div");
            mount.id = MOUNT_ID;
            shadowRoot.appendChild(mount);
        }

        return { styleMountTarget: shadowRoot, mount };
    }

    const { styleMountTarget, mount } = ensureShadowMount();
    const data = shallowRef(null);

    const getStaticHtmlText = async () => {
        if (typeof GM_getResourceText !== "function") {
            throw new Error("GM_getResourceText 不可用");
        }
        const html = GM_getResourceText("staticHtml");
        if (!html) throw new Error("静态模板资源 staticHtml 为空");
        return String(html);
    };

    const sourceUrl = shallowRef(location.href);

    const BiliDataManager =
        monkeyWindow.BiliDataManager || globalThis.BiliDataManager;
    if (!BiliDataManager) throw new Error("BiliDataManager 未加载");
    if (typeof GM_xmlhttpRequest !== "function")
        throw new Error("GM_xmlhttpRequest 不可用");
    const BDM = BiliDataManager.create({
        httpRequest: GM_xmlhttpRequest,
        name: "BDS",
        isLog: true,
    });

    createApp(App)
        .provide("styleMountTarget", styleMountTarget)
        .provide("BDM", BDM)
        .provide("APP_MODE", ref("script"))
        .provide("data", data)
        .provide("sourceUrl", sourceUrl)
        .provide("runtimeWindow", runtimeWindow)
        .provide("getStaticHtmlText", getStaticHtmlText)
        .mount(mount);
}
