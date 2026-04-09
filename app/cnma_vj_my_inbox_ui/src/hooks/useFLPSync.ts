import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Iframe-safe FLP sync using postMessage API.
 * 
 * When running in an iframe, we can't directly access parent.location due to
 * cross-origin restrictions. Instead, we use postMessage to communicate with
 * the parent window.
 */

// Global store for initial FLP state received from parent
let initialFLPState: { hash: string; search: string } | null = null;
let stateReceived = false;

/**
 * Sync React Router navigation with parent FLP URL using postMessage.
 */
export function useFLPSyncDirect() {
    const location = useLocation();
    const isInitialRenderRef = useRef(true);

    useEffect(() => {
        const isInIframe = window.parent !== window;

        if (!isInIframe) {
            console.log("[FLP-SYNC] Standalone mode - skipping");
            return;
        }

        const appRoute = location.pathname.replace(/^\//, "");

        console.log("[FLP-SYNC] Syncing route to parent:", appRoute, "| Initial render:", isInitialRenderRef.current);

        const hasDeepLinkInParent = initialFLPState?.hash?.includes("&/") || false;

        if (isInitialRenderRef.current && appRoute === "" && hasDeepLinkInParent) {
            console.log("[FLP-SYNC] Skipping initial sync - waiting for deep link navigation");
            isInitialRenderRef.current = false;
            return;
        }

        isInitialRenderRef.current = false;

        try {
            window.parent.postMessage({
                type: 'ROUTE_CHANGE',
                route: appRoute
            }, '*');
            console.log("[FLP-SYNC] Sent route change to parent:", appRoute);
        } catch (e) {
            console.error("[FLP-SYNC] Failed to send message to parent:", e);
        }
    }, [location.pathname]);
}

/**
 * Get the initial route from parent FLP hash or iframe URL params.
 */
export function getInitialFLPRoute(): string {
    let initialRoute = "/";

    if (window.parent === window) {
        console.log("[FLP-INIT] Standalone mode - using default route");
        return initialRoute;
    }

    const iframeParams = new URLSearchParams(window.location.search);
    const worklistParam = iframeParams.get("worklist");
    console.log("[FLP-INIT] Iframe search params:", window.location.search, "| worklist:", worklistParam);

    if (worklistParam) {
        initialRoute = "/?worklist=" + encodeURIComponent(worklistParam);
        console.log("[FLP-INIT] Found worklist from iframe params:", initialRoute);
        return initialRoute;
    }

    const parseFLPHash = (hash: string): { route: string; intentParams: string } => {
        const parts = hash.split("&/");
        let route = "/";
        let intentParams = "";

        if (parts.length > 1) {
            const routePart = parts[parts.length - 1];
            route = "/" + routePart;
        }

        const intentPart = parts[0];
        const qIdx = intentPart.indexOf("?");
        if (qIdx !== -1) {
            intentParams = intentPart.substring(qIdx + 1);
        }

        return { route, intentParams };
    };

    if (initialFLPState && initialFLPState.hash) {
        const parentHash = initialFLPState.hash;
        console.log("[FLP-INIT] Parent hash (from postMessage):", parentHash);

        const { route, intentParams } = parseFLPHash(parentHash);
        if (route !== "/" || intentParams) {
            initialRoute = route;
            if (intentParams) {
                initialRoute += (initialRoute.includes("?") ? "&" : "?") + intentParams;
            }
            console.log("[FLP-INIT] Found initial route:", initialRoute);
            return initialRoute;
        }
    }

    try {
        const parentHash = window.parent.location.hash;
        console.log("[FLP-INIT] Parent hash (direct access):", parentHash);

        const { route, intentParams } = parseFLPHash(parentHash);
        if (route !== "/" || intentParams) {
            initialRoute = route;
            if (intentParams) {
                initialRoute += (initialRoute.includes("?") ? "&" : "?") + intentParams;
            }
            console.log("[FLP-INIT] Found initial route:", initialRoute);
        } else {
            console.log("[FLP-INIT] No inner route found, using default /");
        }
    } catch (e) {
        console.log("[FLP-INIT] Cannot access parent directly (expected in iframe)");
    }

    return initialRoute;
}

/**
 * Get URL parameters from initial FLP state.
 */
export function getInitialFLPParams(): { locale: string | null; theme: string | null } {
    const result = { locale: null as string | null, theme: null as string | null };

    if (window.parent === window) {
        console.log("[FLP-PARAMS] Standalone mode");
        return result;
    }

    if (initialFLPState && initialFLPState.search) {
        const params = new URLSearchParams(initialFLPState.search);
        result.locale = params.get('sap-locale');
        result.theme = params.get('sap-theme');
        console.log("[FLP-PARAMS] From postMessage - locale:", result.locale, "theme:", result.theme);
        return result;
    }

    try {
        const params = new URLSearchParams(window.parent.location.search);
        result.locale = params.get('sap-locale');
        result.theme = params.get('sap-theme');
        console.log("[FLP-PARAMS] From direct access - locale:", result.locale, "theme:", result.theme);
    } catch (e) {
        console.log("[FLP-PARAMS] Cannot access parent directly (expected in iframe)");
    }

    return result;
}

/**
 * Initialize postMessage listener to receive initial state from parent.
 */
export function initFLPMessageListener() {
    if (stateReceived) {
        return;
    }

    console.log("[FLP-MSG] Initializing message listener");

    const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'INITIAL_STATE') {
            console.log("[FLP-MSG] Received initial state from parent:", event.data);
            initialFLPState = {
                hash: event.data.hash || '',
                search: event.data.search || ''
            };
            stateReceived = true;
        }
    };

    window.addEventListener('message', handleMessage);

    if (window.parent !== window) {
        console.log("[FLP-MSG] Requesting initial state from parent");
        try {
            window.parent.postMessage({ type: 'REQUEST_INITIAL_STATE' }, '*');
        } catch (e) {
            console.error("[FLP-MSG] Failed to request initial state:", e);
        }
    }
}
