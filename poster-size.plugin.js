/**
 * @name PosterSize
 * @description Adds a size control (S/M/L/XL) to Discover and Library so you can choose how big the posters/cards are. Your choice is remembered.
 * @updateUrl none
 * @version 1.0.1
 * @author meli & Claude
 */

(function () {
    const NS = "psz";
    const STORAGE_KEY = "stremio-enhanced-poster-size";

    const SIZES = [
        { key: "s", label: "S", minWidth: 100 },
        { key: "m", label: "M", minWidth: 140 },
        { key: "l", label: "L", minWidth: 185 },
        { key: "xl", label: "XL", minWidth: 235 }
    ];
    const DEFAULT_SIZE = "m";

    // Shared micro-kit so multiple Stremio Enhanced plugins from the same
    // author don't each spin up their own document-wide MutationObserver,
    // duplicate the same DOM helpers, or inject the same CSS fix separately
    // when several of them are installed and enabled together. Defined once
    // by whichever of these plugins loads first; every other one just reuses
    // it. Still fully self-contained if this is the only one active.
    const sek = window.__sek || (function () {
        const ITEM_SELECTOR = 'a[class*="meta-item-container-"], div[class*="meta-item-container-"]';
        const waiters = [];
        let observer = null;

        function checkWaiters() {
            for (let i = waiters.length - 1; i >= 0; i--) {
                const w = waiters[i];
                const el = w.find();
                if (el) {
                    waiters.splice(i, 1);
                    w.resolve(el);
                }
            }
        }

        function ensureObserver() {
            if (observer) return;
            observer = new MutationObserver(checkWaiters);
            observer.observe(document.body, { childList: true, subtree: true });
        }

        function waitFor(find) {
            return new Promise((resolve) => {
                const existing = find();
                if (existing) return resolve(existing);
                waiters.push({ find, resolve });
                ensureObserver();
            });
        }

        const kit = {
            ITEM_SELECTOR,
            waitForElm(selector, root) {
                root = root || document;
                return waitFor(() => root.querySelector(selector));
            },
            findScoped(wrapperSelector, innerSelector) {
                const wrapper = document.querySelector(wrapperSelector);
                return wrapper ? wrapper.querySelector(innerSelector) : null;
            },
            waitForScoped(wrapperSelector, innerSelector) {
                return waitFor(() => kit.findScoped(wrapperSelector, innerSelector));
            },
            isWatched(el) {
                return !!el.querySelector('[class*="watched-icon-layer-"]');
            },
            extractItemId(el) {
                const href = el.getAttribute("href") || "";
                const match = href.match(/#\/detail\/[^/]+\/([^/]+)/);
                if (!match) return null;
                try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
            },
            extractType(el) {
                const href = el.getAttribute("href") || "";
                const match = href.match(/#\/detail\/([^/]+)\//);
                return match ? match[1] : "other";
            },
            escapeHtml(str) {
                const div = document.createElement("div");
                div.textContent = str == null ? "" : String(str);
                return div.innerHTML;
            },
            ensureFilterRowWrap() {
                if (document.getElementById("sek-filter-wrap-fix")) return;
                const style = document.createElement("style");
                style.id = "sek-filter-wrap-fix";
                style.textContent = '[class*="selectable-inputs-container-"] { flex-wrap: wrap !important; row-gap: 10px; }';
                document.head.appendChild(style);
            }
        };

        window.__sek = kit;
        return kit;
    })();

    const log = (msg) => {
        if (window.StremioEnhancedAPI && window.StremioEnhancedAPI.logger) {
            window.StremioEnhancedAPI.logger.info(msg);
        } else {
            console.log(`[PosterSize] ${msg}`);
        }
    };

    function loadSize() {
        const v = localStorage.getItem(STORAGE_KEY);
        return SIZES.some((s) => s.key === v) ? v : DEFAULT_SIZE;
    }

    function saveSize(key) {
        localStorage.setItem(STORAGE_KEY, key);
    }

    function injectStyles() {
        if (document.getElementById(`${NS}-styles`)) return;
        const style = document.createElement("style");
        style.id = `${NS}-styles`;
        style.textContent = `
            .${NS}-group { display: inline-flex; align-items: center; gap: 2px; margin-left: 1.5rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 7px; padding: 3px; flex-shrink: 0; }
            .${NS}-opt { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; padding: 4px 8px; border-radius: 5px; font-size: 12px; font-weight: 600; color: #b3b3bd; cursor: pointer; user-select: none; white-space: nowrap; transition: background .15s ease, color .15s ease; }
            .${NS}-opt:hover { color: #fff; background: rgba(255,255,255,0.08); }
            .${NS}-opt.${NS}-active { background: #7B5BF5; color: #fff; }
        `;
        document.head.appendChild(style);
        sek.ensureFilterRowWrap();
    }

    const waitForElm = sek.waitForElm;

    // ".selectable-inputs-container" is used by both Discover and Library
    // (each has its own filter row with that exact class name). The shared
    // kit's scoped lookup makes sure we never grab the wrong page's element.
    const waitForScopedInputsContainer = (wrapperSelector) =>
        sek.waitForScoped(wrapperSelector, '[class*="selectable-inputs-container-"]');

    function applySize(itemsContainer, sizeKey) {
        const size = SIZES.find((s) => s.key === sizeKey) || SIZES.find((s) => s.key === DEFAULT_SIZE);
        // Stremio sets a fixed column count per screen-width breakpoint via its
        // stylesheet; an inline style always wins over that without needing to
        // fight specificity/!important, and React never sets a style prop on
        // this element itself so our value just sticks across re-renders.
        itemsContainer.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size.minWidth}px, 1fr))`;
    }

    function renderControl(groupEl, itemsContainer, sizeKey) {
        groupEl.innerHTML = SIZES.map((s) => `<span class="${NS}-opt ${s.key === sizeKey ? NS + "-active" : ""}" data-size="${s.key}">${s.label}</span>`).join("");
        groupEl.querySelectorAll(`.${NS}-opt`).forEach((el) => {
            el.addEventListener("click", () => {
                const key = el.getAttribute("data-size");
                saveSize(key);
                applySize(itemsContainer, key);
                renderControl(groupEl, itemsContainer, key);
            });
        });
    }

    let cleanupFns = [];

    function runCleanup() {
        cleanupFns.forEach((fn) => {
            try { fn(); } catch (e) { /* ignore */ }
        });
        cleanupFns = [];
        document.getElementById(`${NS}-group`)?.remove();
    }

    const ROUTES = [
        { hashPrefix: "#/discover", wrapperSelector: '[class*="discover-container-"]' },
        { hashPrefix: "#/library", wrapperSelector: '[class*="library-container-"]' }
    ];

    function matchRoute() {
        return ROUTES.find((r) => location.hash.startsWith(r.hashPrefix)) || null;
    }

    let initGeneration = 0;

    async function initView(route, myGeneration) {
        injectStyles();

        const inputsContainer = await waitForScopedInputsContainer(route.wrapperSelector);
        if (myGeneration !== initGeneration || matchRoute() !== route) return;

        const catalogContainer = inputsContainer.parentElement;
        const itemsContainer = await waitForElm('[class*="meta-items-container-"]', catalogContainer);
        if (myGeneration !== initGeneration || matchRoute() !== route) return;

        const sizeKey = loadSize();
        applySize(itemsContainer, sizeKey);

        let group = document.getElementById(`${NS}-group`);
        if (!group) {
            group = document.createElement("div");
            group.id = `${NS}-group`;
            group.className = `${NS}-group`;
            inputsContainer.appendChild(group);
        }
        renderControl(group, itemsContainer, sizeKey);

        // Pagination/catalog swaps replace the grid's children but keep the
        // same container node (and thus our inline style) - only re-apply if
        // Stremio ever swaps the container itself out from under us.
        const observer = new MutationObserver(() => {
            if (itemsContainer.style.gridTemplateColumns === "") {
                applySize(itemsContainer, loadSize());
            }
        });
        observer.observe(itemsContainer, { attributes: true, attributeFilter: ["style"] });
        cleanupFns.push(() => observer.disconnect());
    }

    let currentRouteKey = null;

    function onRouteChange() {
        const route = matchRoute();
        const routeKey = route ? route.hashPrefix : null;

        // Changing type/genre/sort filters within the same page just swaps
        // the item list - no need to tear the control down and rebuild it.
        if (routeKey && routeKey === currentRouteKey) return;

        currentRouteKey = routeKey;
        initGeneration++;
        runCleanup();
        if (route) {
            initView(route, initGeneration).catch((e) => log("Error initializing: " + e.message));
        }
    }

    window.addEventListener("hashchange", onRouteChange);
    onRouteChange();

    log("Poster Size plugin loaded.");
})();
