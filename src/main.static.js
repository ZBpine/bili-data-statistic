import { createApp, shallowRef } from "vue";
import App from "./App.vue";
import storage from "./utils/storage";
import {
    DEFAULT_THEME,
    normalizeThemeColor,
    normalizeThemeMode,
} from "./utils/theme";

const PANEL_TRANSFER_TYPE = "BDS_PANEL_TRANSFER";
const PANEL_TRANSFER_ACK_TYPE = "BDS_PANEL_TRANSFER_ACK";
const BRIDGE_EVENT = "BDS_HTTP_BRIDGE_READY";

const mount = document.getElementById("app");
if (!mount) {
    throw new Error("静态版挂载节点 #app 不存在");
}

const BiliDataManager = globalThis.BiliDataManager || null;

const hasHttpBridge = () =>
    typeof globalThis.__BDS_HTTP_REQUEST__ === "function";

if (!BiliDataManager) throw new Error("BiliDataManager 未加载");
const getThemeLoggerColor = () => {
    const mode = normalizeThemeMode(
        storage.get("theme.mode", DEFAULT_THEME.mode),
    );
    const lightPrimary = normalizeThemeColor(
        storage.get("theme.lightPrimary", DEFAULT_THEME.lightPrimary),
        DEFAULT_THEME.lightPrimary,
    );
    const darkPrimary = normalizeThemeColor(
        storage.get("theme.darkPrimary", DEFAULT_THEME.darkPrimary),
        DEFAULT_THEME.darkPrimary,
    );
    const isDark =
        mode === "dark" ||
        (mode === "auto" &&
            window.matchMedia?.("(prefers-color-scheme: dark)")?.matches);
    return isDark ? darkPrimary : lightPrimary;
};

const createBDM = (httpRequest) => {
    const options = {
        name: "BDS",
        isLog: true,
        loggerColor: getThemeLoggerColor(),
    };
    if (typeof httpRequest === "function") {
        options.httpRequest = httpRequest;
    }
    return BiliDataManager.create(options);
};

let currentBDM = createBDM(
    hasHttpBridge() ? globalThis.__BDS_HTTP_REQUEST__ : null,
);
const BDM = new Proxy(
    {},
    {
        get(_, prop) {
            return currentBDM?.[prop];
        },
    },
);

const data = shallowRef(null);
const sourceUrl = shallowRef("");
const appMode = shallowRef(hasHttpBridge() ? "live" : "readonly");
const runtimeWindow = window;

runtimeWindow.BDM = BDM;

const applyBridgeLive = () => {
    if (!hasHttpBridge()) return;
    currentBDM = createBDM(globalThis.__BDS_HTTP_REQUEST__);
    appMode.value = "live";
};

window.addEventListener(BRIDGE_EVENT, applyBridgeLive);
applyBridgeLive();

const isObjectPayload = (value) => {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const applyTransferPayload = (payload) => {
    if (!isObjectPayload(payload)) return false;
    data.value = payload;
    return true;
};

window.addEventListener("message", (event) => {
    const message = event?.data;
    if (!isObjectPayload(message)) return;
    if (message.type !== PANEL_TRANSFER_TYPE) return;
    const accepted = applyTransferPayload(message.payload);
    if (!accepted) return;
    try {
        event.source?.postMessage(
            {
                type: PANEL_TRANSFER_ACK_TYPE,
                sessionId: message.sessionId,
                ok: true,
            },
            event.origin,
        );
    } catch {
        // ignore ack failure
    }
});

const applyInjectedData = () => {
    const injectedDataNode = document.getElementById("bds-injected-data");
    if (injectedDataNode?.tagName !== "SCRIPT") return false;
    const raw = String(injectedDataNode.textContent || "").trim();
    if (!raw) return false;
    return applyTransferPayload(JSON.parse(raw));
};

let injectedApplied = false;
try {
    injectedApplied = applyInjectedData();
} catch {
    injectedApplied = false;
}

if (!injectedApplied) {
    window.addEventListener(
        "DOMContentLoaded",
        () => {
            try {
                applyInjectedData();
            } catch {
                // ignore invalid injected data
            }
        },
        { once: true },
    );
}

const getStaticHtmlText = async () => {
    return "<!doctype html>\n" + document.documentElement.outerHTML;
};

createApp(App)
    .provide("styleMountTarget", document.head)
    .provide("BDM", BDM)
    .provide("APP_MODE", appMode)
    .provide("data", data)
    .provide("sourceUrl", sourceUrl)
    .provide("runtimeWindow", runtimeWindow)
    .provide("getStaticHtmlText", getStaticHtmlText)
    .mount(mount);
