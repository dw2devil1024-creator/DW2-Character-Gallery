/*
 * DW2 · Character Gallery | v1.0.13
 * TT native character-list presentation only. Never clone/rebind character
 * cards: TT owns its delegated click handlers, sort/filter and bulk actions.
 */
const STORAGE_KEY = 'dw2cg:gallery:enabled';
const ROOT_CLASS = 'dw2cg-active';
const HEADER_ID = 'dw2cg-header';
const SETTINGS_ID = 'dw2cg-settings';
const FILTER_STRIP_ID = 'dw2cg-filter-strip';
const FILTERS_KEY = 'dw2cg:filters:open';
const NATIVE_ACTIONS_ID = 'dw2cg-native-actions';
const QUICK_ACTIONS_ID = 'dw2cg-quick-actions';
const ACTION_ROW_ID = 'dw2cg-action-row';
const HEADER_ACTIONS_ID = 'dw2cg-header-actions';
const QUICK_ACTION_IDS = Object.freeze([
    'rm_button_create', 'character_import_button',
    'external_import_button', 'rm_button_group_chats', 'rm_buttons_container'
]);
const BUILD_VERSION = '1.0.13';
let checkedUpdate = null;
let updateBusy = false;
const NATIVE_ACTION_IDS = Object.freeze([
    'charListGridToggle',
    'bulkEditButton',
    'bulkSelectedCount',
    'bulkSelectAllButton',
    'bulkDeleteButton',
]);
let runtimeEnabled = false;
let pendingObserver = null;
const PINS_KEY = 'dw2cg:pinned:avatars:v1';
const PINNED_VIEW_VALUE = 'dw2cg-only-pinned';
let pinnedAvatars = new Set();
let pinnedOnly = false;
let lastNativeSortValue = '';
let paginationOriginal = null;
let paginationBridge = null;
let sortSelect = null;
let pageRefreshPromise = null;
let latestNativeEntities = null;
let latestNativePageSize = 0;


function preferredEnabled() {
    try {
        return localStorage.getItem(STORAGE_KEY) !== '0';
    } catch {
        return true;
    }
}

function setPreferredEnabled(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
        // Private or restricted storage: the live switch still works.
    }
}

function renderToggle() {
    const active = Boolean(document.body?.classList.contains(ROOT_CLASS));
    const button = document.getElementById('dw2cg-toggle');
    if (button) {
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', active ? '关闭 DW2 角色画廊美化' : '启用 DW2 角色画廊美化');
        button.title = active ? '切换到 TT 原生外观' : '启用 DW2 角色画廊';
        const label = button.querySelector('.dw2cg-switch-label');
        if (label) label.textContent = active ? 'GALLERY VIEW' : 'NATIVE VIEW';
    }
    const checkbox = document.getElementById('dw2cg-settings-toggle');
    if (checkbox) checkbox.checked = active;
}


/* TT binds these native button events directly. Move real nodes rather than
 * copying controls; pagination.js only rerenders its own .paginationjs child. */
function positionNativeActions(inGallery) {
    const pager = document.querySelector('#rm_characters_block #rm_print_characters_pagination');
    if (!pager) return false;
    const nodes = NATIVE_ACTION_IDS.map(id => document.getElementById(id)).filter(Boolean);
    if (nodes.length !== NATIVE_ACTION_IDS.length) return false;

    if (inGallery) {
        const tagControls = document.querySelector('#rm_characters_block #charListFixedTop > .rm_tag_controls');
        const nativeFilter = tagControls?.querySelector(':scope > .rm_tag_filter');
        if (!nativeFilter) return false;
        let holder = document.getElementById(NATIVE_ACTIONS_ID);
        if (!holder) {
            holder = document.createElement('div');
            holder.id = NATIVE_ACTIONS_ID;
            holder.setAttribute('aria-label', '角色显示与批量整理');
            nativeFilter.after(holder);
        }
        for (const node of nodes) {
            if (node.parentElement !== holder) holder.append(node);
        }
    } else {
        const anchor = pager.querySelector(':scope > .paginationjs');
        for (const node of nodes) pager.insertBefore(node, anchor);
        document.getElementById(NATIVE_ACTIONS_ID)?.remove();
    }
    return true;
}


/* Leave original controls intact. Search, import and sort all use TT's
 * existing listeners, so the actual DOM nodes are relocated, never copied. */
function positionGalleryToolbar(active) {
    const top = document.querySelector('#rm_characters_block #charListFixedTop');
    const header = document.getElementById(HEADER_ID);
    const bar = document.getElementById('rm_button_bar');
    const strip = document.getElementById(FILTER_STRIP_ID);
    const searchForm = document.getElementById('form_character_search_form');
    const tagControls = top?.querySelector(':scope > .rm_tag_controls');
    const search = document.getElementById('rm_button_search');
    const sort = document.getElementById('character_sort_order');
    if (!top || !bar || !search || !sort || !searchForm || !tagControls) return false;
    const buttons = QUICK_ACTION_IDS.map(id => document.getElementById(id));
    if (buttons.some(b => !b)) return false;
    if (active) {
        if (!header || !strip) return false;
        let actions = document.getElementById(HEADER_ACTIONS_ID);
        if (!actions) {
            actions = document.createElement('div');
            actions.id = HEADER_ACTIONS_ID;
            header.append(actions);
        }
        const toggle = document.getElementById('dw2cg-toggle');
        actions.append(search);
        // Never append a null value: Element.append(null) creates the literal
        // text "null" (the 1.0.5 header regression). Keep a missing toggle
        // recoverable instead of silently replacing it with text.
        if (toggle) actions.append(toggle);
        let row = document.getElementById(ACTION_ROW_ID);
        if (!row) {
            row = document.createElement('div');
            row.id = ACTION_ROW_ID;
            header.after(row);
        }
        row.append(bar, strip);
        let quick = document.getElementById(QUICK_ACTIONS_ID);
        if (!quick) {
            quick = document.createElement('div');
            quick.id = QUICK_ACTIONS_ID;
            quick.setAttribute('aria-label', '新建、导入和群聊');
            tagControls.append(quick);
        }
        for (const button of buttons) if (button.parentElement !== quick) quick.append(button);
    } else {
        // Restore native order: creation/import controls, sorting, search.
        for (const button of buttons) bar.insertBefore(button, sort);
        bar.append(search);
        top.insertBefore(bar, searchForm);
        if (strip) top.insertBefore(strip, tagControls);
        document.getElementById(QUICK_ACTIONS_ID)?.remove();
        document.getElementById(ACTION_ROW_ID)?.remove();
        // Rescue the live mode toggle BEFORE deleting its temporary parent.
        // v1.0.5 did this in the opposite order and destroyed the button.
        const toggle = document.getElementById('dw2cg-toggle');
        if (toggle && header) header.append(toggle);
        document.getElementById(HEADER_ACTIONS_ID)?.remove();
    }
    return true;
}

function applyMode(value) {
    if (!runtimeEnabled || !document.body) return;
    document.body.classList.toggle(ROOT_CLASS, Boolean(value));
    if (value) {
        attachPaginationBridge();
        updatePinnedSortOption();
        positionNativeActions(true);
        positionGalleryToolbar(true);
    } else {
        resetPinnedSortOption();
        removePinButtons();
        clearPreviewCardOrder();
        positionGalleryToolbar(false);
        positionNativeActions(false);
    }
    renderToggle();
    void refreshNativeCharacterList();
}

function createModeToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'dw2cg-toggle';
    toggle.className = 'dw2cg-switch';
    const text = document.createElement('span');
    text.className = 'dw2cg-switch-label';
    toggle.append(text);
    toggle.addEventListener('click', () => {
        const next = !document.body.classList.contains(ROOT_CLASS);
        setPreferredEnabled(next);
        applyMode(next);
    });
    return toggle;
}

function mountHeader() {
    const panelTop = document.querySelector('#rm_characters_block #charListFixedTop');
    if (!panelTop || !runtimeEnabled) return false;
    if (document.getElementById(HEADER_ID)) {
        const header = document.getElementById(HEADER_ID);
        // Repair a partially switched header in-session, if another UI pass
        // removed the toggle. Reloading v1.0.6 also starts from a clean DOM.
        if (!document.getElementById('dw2cg-toggle')) {
            header.append(createModeToggle());
        }
        for (const node of [...header.childNodes]) {
            if (node.nodeType === 3 && node.textContent.trim() === 'null') node.remove();
        }
        renderToggle();
        return true;
    }

    const header = document.createElement('div');
    header.id = HEADER_ID;

    const title = document.createElement('div');
    title.className = 'dw2cg-brand';
    const overline = document.createElement('span');
    overline.className = 'dw2cg-overline';
    overline.textContent = 'DW2 · CHARACTER GALLERY';
    const name = document.createElement('span');
    name.className = 'dw2cg-name';
    name.textContent = '角色档案馆';
    title.append(overline, name);

    const toggle = createModeToggle();
    header.append(title, toggle);
    panelTop.prepend(header);
    renderToggle();
    return true;
}



/* Hide only the native tag/action row. TT owns its filter clicks and its folder
 * breadcrumbs, which must remain visible even when the tray is collapsed. */
function readFilterOpen() {
    try { return localStorage.getItem(FILTERS_KEY) === '1'; }
    catch { return false; }
}
function writeFilterOpen(value) {
    try { localStorage.setItem(FILTERS_KEY, value ? '1' : '0'); }
    catch { /* The session's expand/collapse still works. */ }
}
function syncFilterStrip(open) {
    const top = document.querySelector('#rm_characters_block #charListFixedTop');
    top?.classList.toggle('dw2cg-filters-open', Boolean(open));
    const toggle = document.getElementById('dw2cg-filter-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
    const verb = toggle.querySelector('.dw2cg-filter-verb');
    if (verb) verb.textContent = open ? '收起工具' : '筛选与整理';
    toggle.title = open ? '收起角色筛选与整理工具' : '展开角色筛选与整理工具';
}
function mountFilterStrip() {
    const top = document.querySelector('#rm_characters_block #charListFixedTop');
    const controls = top?.querySelector(':scope > .rm_tag_controls');
    if (!top || !controls || !runtimeEnabled) return false;
    if (document.getElementById(FILTER_STRIP_ID)) {
        if (document.body.classList.contains(ROOT_CLASS)) {
            positionNativeActions(true);
            positionGalleryToolbar(true);
        }
        return true;
    }
    const strip = document.createElement('div');
    strip.id = FILTER_STRIP_ID;
    const caption = document.createElement('span');
    caption.className = 'dw2cg-filter-caption';
    caption.textContent = 'COLLECTION · 角色浏览';
    const toggle = document.createElement('button');
    toggle.id = 'dw2cg-filter-toggle';
    toggle.type = 'button';
    toggle.className = 'dw2cg-filter-toggle';
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-sliders';
    icon.setAttribute('aria-hidden','true');
    const verb = document.createElement('span');
    verb.className = 'dw2cg-filter-verb';
    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-chevron-down dw2cg-filter-arrow';
    arrow.setAttribute('aria-hidden','true');
    toggle.append(icon, verb, arrow);
    toggle.addEventListener('click', () => {
        const next = !top.classList.contains('dw2cg-filters-open');
        writeFilterOpen(next);
        syncFilterStrip(next);
    });
    strip.append(caption, toggle);
    // Never move or clone TT's actual filters; keep its rerender/event contract.
    controls.before(strip);
    syncFilterStrip(readFilterOpen());
    if (document.body.classList.contains(ROOT_CLASS)) {
        positionNativeActions(true);
        positionGalleryToolbar(true);
    }
    return true;
}


async function galleryApi(route, input, method = 'POST') {
    const appRoot = new URL('../../../../', import.meta.url);
    const { getRequestHeaders } = await import(new URL('script.js', appRoot).href);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        const res = await fetch(new URL('api/extensions/' + route, appRoot).href, {
            method,
            headers: getRequestHeaders(),
            ...(method === 'POST' ? { body: JSON.stringify(input) } : {}),
            cache: 'no-store',
            signal: controller.signal,
        });
        if (!res.ok) throw new Error('TT 扩展接口错误（' + res.status + '）：' + String(await res.text()).slice(0, 180));
        return await res.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function resolveGalleryInstall() {
    const path = new URL(import.meta.url).pathname;
    const match = path.match(/\/scripts\/extensions\/third-party\/([^/]+)\//);
    if (!match) throw new Error('没有找到第三方扩展安装目录，无法执行仓库更新。');
    const name = decodeURIComponent(match[1]);
    const installed = await galleryApi('discover', null, 'GET');
    const entry = Array.isArray(installed) && installed.find(item =>
        String(item.name).toLowerCase() === ('third-party/' + name).toLowerCase()
        && ['global', 'local'].includes(item.type)
    );
    if (!entry) throw new Error('未找到当前扩展，请在「管理扩展」确认安装位置。');
    const info = await galleryApi('version', { extensionName: name, global: entry.type === 'global' });
    if (!info?.remoteUrl || !info.currentCommitHash) {
        throw new Error('当前不是 Git 仓库安装的扩展，无法在线更新。');
    }
    return { name, global: entry.type === 'global', info };
}

function installUpdateControls(content) {
    const actions = document.createElement('div');
    actions.className = 'dw2cg-settings-actions';
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'dw2cg-settings-button';
    check.textContent = '检查更新';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'dw2cg-settings-button';
    apply.textContent = '更新到最新版';
    apply.disabled = true;
    const status = document.createElement('p');
    status.className = 'dw2cg-settings-status';
    status.setAttribute('role','status');
    status.textContent = '需要时手动检测，不会自动更新。';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'dw2cg-settings-button dw2cg-settings-reload';
    reload.textContent = '刷新酒馆';
    reload.hidden = true;

    const busy = state => {
        updateBusy = Boolean(state);
        check.disabled = updateBusy;
        apply.disabled = updateBusy || !checkedUpdate;
        reload.disabled = updateBusy;
    };
    const notify = message => { status.textContent = message; };

    check.addEventListener('click', async () => {
        if (updateBusy) return;
        checkedUpdate = null;
        busy(true);
        notify('正在通过 TT 检查 Git 仓库更新…');
        try {
            const install = await resolveGalleryInstall();
            if (install.info.isUpToDate === true && install.info.currentBranchName === 'main') {
                notify('当前已是最新版（v' + BUILD_VERSION + '），无需更新。');
            } else if (install.info.isUpToDate === false || install.info.currentBranchName !== 'main') {
                checkedUpdate = { name: install.name, global: install.global };
                notify('检测到仓库新提交，可以点击「更新到最新版」。');
            } else {
                notify('酒馆未返回确定的更新状态，请在扩展管理中检查。');
            }
        } catch (error) {
            notify('检查失败：' + (error.message || String(error)));
        } finally { busy(false); }
    });

    apply.addEventListener('click', async () => {
        if (updateBusy || !checkedUpdate) return;
        if (!window.confirm('确认通过 TT 更新 DW2 · Character Gallery？更新后需要刷新酒馆。')) return;
        const target = checkedUpdate;
        busy(true);
        notify('正在更新仓库，请稍候…');
        try {
            const result = await galleryApi('update', { extensionName: target.name, global: target.global });
            checkedUpdate = null;
            if (result.isUpToDate) {
                notify('仓库已经是最新版，无需重复更新。');
            } else {
                notify('更新成功' + (result.shortCommitHash ? ' · ' + result.shortCommitHash : '') + '，请点击「刷新酒馆」启用新版。');
                reload.hidden = false;
            }
        } catch (error) {
            checkedUpdate = null;
            notify('更新失败：' + (error.message || String(error)) + '。请核实权限及网络。');
        } finally { busy(false); }
    });
    reload.addEventListener('click', () => window.location.reload());
    actions.append(check, apply);
    content.append(actions, reload, status);
}

function mountSettings() {
    const host = document.getElementById('extensions_settings2')
        || document.getElementById('extensions_settings');
    if (!host || !runtimeEnabled) return false;
    if (document.getElementById(SETTINGS_ID)) {
        renderToggle();
        return true;
    }

    // TT's own inline-drawer handler operates the accordion. We only supply
    // its content and leave native extension management and fold behavior intact.
    const panel = document.createElement('div');
    panel.id = SETTINGS_ID;
    panel.className = 'extension_container';
    const drawer = document.createElement('div');
    drawer.className = 'inline-drawer';
    const heading = document.createElement('div');
    heading.className = 'inline-drawer-toggle inline-drawer-header';
    heading.tabIndex = 0;
    heading.setAttribute('role', 'button');
    heading.setAttribute('aria-expanded', 'false');
    heading.setAttribute('aria-controls', 'dw2cg-settings-content');

    const title = document.createElement('div');
    title.className = 'dw2cg-settings-heading';
    const name = document.createElement('b');
    name.textContent = 'DW2 · Character Gallery';
    const credit = document.createElement('span');
    credit.className = 'dw2cg-settings-credit';
    credit.textContent = 'S.A. · DW2';
    title.append(name, credit);
    const arrow = document.createElement('div');
    arrow.className = 'inline-drawer-icon fa-solid fa-circle-chevron-down down';
    arrow.setAttribute('aria-hidden', 'true');
    heading.append(title, arrow);
    heading.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        heading.click();
    });

    const content = document.createElement('div');
    content.id = 'dw2cg-settings-content';
    content.className = 'inline-drawer-content';
    const status = document.createElement('p');
    status.className = 'dw2cg-settings-note';
    status.textContent = '已加载 · v1.0.13 · DW2 独立视觉';
    const option = document.createElement('label');
    option.className = 'checkbox_label dw2cg-settings-option';
    const checkbox = document.createElement('input');
    checkbox.id = 'dw2cg-settings-toggle';
    checkbox.type = 'checkbox';
    checkbox.checked = document.body.classList.contains(ROOT_CLASS);
    checkbox.addEventListener('change', () => {
        setPreferredEnabled(checkbox.checked);
        applyMode(checkbox.checked);
    });
    const desc = document.createElement('span');
    desc.textContent = '启用角色画廊美化';
    option.append(checkbox, desc);
    const guide = document.createElement('p');
    guide.className = 'dw2cg-settings-note';
    guide.textContent = '三列画廊 · 卡面置顶 · 横向收纳 · 原生交互';
    content.append(status, option);
    installUpdateControls(content);
    content.append(guide);
    drawer.append(heading, content);
    panel.append(drawer);
    host.append(panel);
    renderToggle();
    return true;
}


/* Pinned state is private to this plugin. Character records, favorites, tags,
 * IDs and TT's own sorting settings are not changed. Avatar filenames form
 * stable character keys across native sort and import order changes. */
function readPinnedAvatars() {
    try {
        const raw = JSON.parse(localStorage.getItem(PINS_KEY) || '[]');
        return new Set(Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.length > 0) : []);
    } catch { return new Set(); }
}
function savePinnedAvatars() {
    try { localStorage.setItem(PINS_KEY, JSON.stringify([...pinnedAvatars])); }
    catch { /* Storage restriction: pins survive until this page reloads. */ }
}
function avatarKey(item) {
    return typeof item?.avatar === 'string' && item.avatar !== 'none' && item.avatar.length > 0
        ? 'avatar:' + item.avatar
        : null;
}
function pinKeyForCard(card, characterList) {
    const id = Number(card.dataset.chid);
    // Reuse the character collection across the entire page. TT getContext()
    // may be costly with large history; 1000/page must not call it 1000 times.
    const characters = characterList ?? globalThis.SillyTavern?.getContext?.()?.characters;
    const entity = characters?.[id];
    // Data-chid is transient; never save it as a pin identifier.
    return avatarKey(entity);
}
function getPinRanks() {
    // Set retains the original user click order and survives serialization
    // as an array in dw2cg:pinned:avatars:v1. Earliest pin ranks first.
    return new Map([...pinnedAvatars].map((key, index) => [key, index]));
}
function sortPinnedEntities(entities) {
    // TT can temporarily switch its own selector to Search when a query
    // starts. Do not keep a hidden custom-only-pins state after that.
    if (pinnedOnly && document.getElementById('character_sort_order')?.value !== PINNED_VIEW_VALUE) {
        pinnedOnly = false;
    }
    const ranks = getPinRanks();
    if (pinnedOnly) {
        return entities
            .filter(entity => entity?.type === 'character' && ranks.has(avatarKey(entity.item)))
            .sort((a,b) => ranks.get(avatarKey(a.item)) - ranks.get(avatarKey(b.item)));
    }
    if (!ranks.size) return entities;
    const folders = [], pinned = [], others = [];
    for (const entity of entities) {
        // Preserve TT's native folder priority and non-pinned sorting.
        if (entity?.type === 'tag') folders.push(entity);
        else if (entity?.type === 'character' && ranks.has(avatarKey(entity.item))) pinned.push(entity);
        else others.push(entity);
    }
    pinned.sort((a,b) => ranks.get(avatarKey(a.item)) - ranks.get(avatarKey(b.item)));
    return [...folders, ...pinned, ...others];
}
function clearPreviewCardOrder() {
    document.querySelectorAll('#rm_print_characters_block > .character_select[style*="order"]')
        .forEach(card => card.style.removeProperty('order'));
}
/* Fast path: 1000/page often contains the entire filtered list. A pin tap
 * need not ask TT to rebuild hundreds of cards, their tag filters and the
 * pagination bar just to move one existing DOM card. CSS Grid order changes
 * only visual card placement; TT still owns every original card and handler.
 *
 * For multiple pages, folders/groups, or the pinned-only filter, use the
 * native refresh instead to preserve pagination and filter correctness. */
function reorderVisibleSinglePage() {
    if (pinnedOnly || pageRefreshPromise || !latestNativeEntities?.length) return false;
    if (!latestNativePageSize || latestNativeEntities.length > latestNativePageSize) return false;
    const list = document.getElementById('rm_print_characters_block');
    if (!list || !document.body?.classList.contains(ROOT_CLASS)) return false;
    const children = Array.from(list.children);
    if (!children.length || !children.every(node =>
        node.classList?.contains('character_select') && node.hasAttribute('data-chid'))) return false;
    const characters = globalThis.SillyTavern?.getContext?.()?.characters;
    if (!characters) return false;
    const nativeRank = new Map();
    latestNativeEntities.forEach((entity, index) => {
        if (entity?.type === 'character') nativeRank.set(Number(entity.id), index);
    });
    const pinRank = getPinRanks();
    const cards = children.map((card, index) => {
        const characterId = Number(card.dataset.chid);
        const key = pinKeyForCard(card, characters);
        return {
            card,
            index,
            originalOrder: nativeRank.get(characterId) ?? index,
            pinnedOrder: pinRank.get(key),
        };
    });
    if (cards.some(entry => !Number.isFinite(entry.originalOrder))) return false;
    cards.sort((a,b) => {
        const ap = a.pinnedOrder !== undefined;
        const bp = b.pinnedOrder !== undefined;
        if (ap !== bp) return ap ? -1 : 1;
        if (ap) return a.pinnedOrder - b.pinnedOrder;
        return a.originalOrder - b.originalOrder || a.index - b.index;
    });
    // order is only visible in Gallery grid mode. Clear it on mode changes.
    cards.forEach((entry, index) => {
        if (entry.card.style.order !== String(index)) entry.card.style.order = String(index);
    });
    return true;
}
function removePinButtons() {
    document.querySelectorAll('#rm_print_characters_block .dw2cg-pin').forEach(el => el.remove());
}
function addPinButtons() {
    if (!runtimeEnabled || !document.body?.classList.contains(ROOT_CLASS)) return;
    const cards = document.querySelectorAll('#rm_print_characters_block > .character_select[data-chid]');
    if (!cards.length) return;
    const characterList = globalThis.SillyTavern?.getContext?.()?.characters;
    if (!characterList) return;
    for (const card of cards) {
        const key = pinKeyForCard(card, characterList);
        // Character entries without a native avatar filename are not pinned
        // by unstable numeric IDs. This protects records after resort/import.
        if (!key) continue;
        let button = card.querySelector(':scope > .dw2cg-pin');
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'dw2cg-pin';
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-thumbtack';
            icon.setAttribute('aria-hidden','true');
            button.append(icon);
            button.addEventListener('pointerdown', event => event.stopPropagation());
            button.addEventListener('mousedown', event => event.stopPropagation());
            button.addEventListener('touchstart', event => event.stopPropagation(), { passive: true });
            button.addEventListener('click', async event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                const currentKey = pinKeyForCard(card);
                if (!currentKey) return;
                if (pinnedAvatars.has(currentKey)) pinnedAvatars.delete(currentKey);
                else pinnedAvatars.add(currentKey);
                savePinnedAvatars();
                // Decorate immediately while native rendering is in flight.
                button.classList.toggle('dw2cg-is-pinned', pinnedAvatars.has(currentKey));
                card.classList.toggle('dw2cg-is-pinned', pinnedAvatars.has(currentKey));
                button.setAttribute('aria-pressed', String(pinnedAvatars.has(currentKey)));
                button.setAttribute('aria-label', pinnedAvatars.has(currentKey) ? '取消角色置顶' : '置顶角色');
                button.title = pinnedAvatars.has(currentKey) ? '取消置顶' : '置顶角色';
                // In single-page galleries move the existing cards without
                // TT's full printCharacters(true) rebuild or scroll reset.
                if (!reorderVisibleSinglePage()) await refreshNativeCharacterList();
            });
            card.append(button);
        }
        const selected = pinnedAvatars.has(key);
        button.classList.toggle('dw2cg-is-pinned', selected);
        card.classList.toggle('dw2cg-is-pinned', selected);
        button.setAttribute('aria-pressed', String(selected));
        button.setAttribute('aria-label', selected ? '取消角色置顶' : '置顶角色');
        button.title = selected ? '取消置顶' : '置顶角色';
    }
}
async function refreshNativeCharacterList(force = false) {
    if (!runtimeEnabled && !force) return;
    // Coalesce fast taps: TT printCharacters(true) preserves the native
    // pagination algorithm but resets to page one so newly pinned items show.
    if (pageRefreshPromise) return pageRefreshPromise;
    pageRefreshPromise = (async () => {
        try {
            const root = new URL('../../../../', import.meta.url);
            const native = await import(new URL('script.js', root).href);
            if (runtimeEnabled || force) await native.printCharacters(true);
        } catch (error) {
            console.warn('[DW2 Character Gallery] Could not refresh native character list:', error);
        } finally {
            pageRefreshPromise = null;
        }
    })();
    return pageRefreshPromise;
}
/* TT's native list passes its fully-filtered, sorted ENTIRE entity array into
 * jquery.pagination before pagination takes place. Scope our reversible bridge
 * to that one container, otherwise pinned cards on later pages could not reach
 * the front. The original callback and native paginator remain authoritative.
 */
function attachPaginationBridge() {
    const $ = globalThis.jQuery || globalThis.$;
    if (!$?.fn || typeof $.fn.pagination !== 'function') return false;
    if (paginationBridge && $.fn.pagination === paginationBridge) return true;
    if (paginationBridge) return false; // Another extension replaced it; do not stack blindly.
    const original = $.fn.pagination;
    const wrapped = function (...args) {
        if (runtimeEnabled && document.body?.classList.contains(ROOT_CLASS)
            && this?.[0]?.id === 'rm_print_characters_pagination'
            && args[0] && typeof args[0] === 'object'
            && Array.isArray(args[0].dataSource)) {
            latestNativeEntities = args[0].dataSource;
            latestNativePageSize = Number(args[0].pageSize) || 0;
            const options = { ...args[0] };
            options.dataSource = sortPinnedEntities(options.dataSource);
            const callback = options.callback;
            if (typeof callback === 'function') {
                options.callback = async function (...callbackArgs) {
                    const result = await callback.apply(this, callbackArgs);
                    addPinButtons();
                    return result;
                };
            }
            args[0] = options;
        }
        return original.apply(this, args);
    };
    // Keep any plugin metadata on the original method accessible to TT.
    Object.assign(wrapped, original);
    paginationOriginal = original;
    paginationBridge = wrapped;
    $.fn.pagination = wrapped;
    return true;
}
function detachPaginationBridge() {
    const $ = globalThis.jQuery || globalThis.$;
    if ($?.fn && $.fn.pagination === paginationBridge) $.fn.pagination = paginationOriginal;
    paginationBridge = null;
    paginationOriginal = null;
    latestNativeEntities = null;
    latestNativePageSize = 0;
}
function updatePinnedSortOption() {
    const select = document.getElementById('character_sort_order');
    if (!select || !runtimeEnabled) return false;
    // Never expose our custom option when the user is in TT native mode.
    if (!document.body?.classList.contains(ROOT_CLASS)) return true;
    if (sortSelect !== select) {
        sortSelect?.removeEventListener('change', onPinnedSortChange, true);
        sortSelect = select;
        select.addEventListener('change', onPinnedSortChange, true);
        lastNativeSortValue = select.value;
    }
    let option = select.querySelector('option[data-dw2cg-pinned]');
    if (!option) {
        option = document.createElement('option');
        option.value = PINNED_VIEW_VALUE;
        option.textContent = '仅看置顶';
        option.dataset.dw2cgPinned = 'true';
        select.append(option);
    }
    if (pinnedOnly) select.value = PINNED_VIEW_VALUE;
    return true;
}
function onPinnedSortChange(event) {
    if (!runtimeEnabled || !document.body?.classList.contains(ROOT_CLASS)) return;
    const selected = event.currentTarget.value;
    if (selected === PINNED_VIEW_VALUE) {
        // The TT handler would otherwise persist an invalid sort_field.
        event.stopImmediatePropagation();
        pinnedOnly = true;
        void refreshNativeCharacterList();
    } else {
        lastNativeSortValue = selected;
        pinnedOnly = false;
        // Do not stop propagation: TT must update its native sort settings.
    }
}
function resetPinnedSortOption() {
    if (sortSelect) {
        sortSelect.removeEventListener('change', onPinnedSortChange, true);
        const option = sortSelect.querySelector('option[data-dw2cg-pinned]');
        if (option?.selected) {
            const nativeOption = [...sortSelect.options].find(x => x.value === lastNativeSortValue && x !== option)
                || [...sortSelect.options].find(x => x !== option && !x.hidden);
            if (nativeOption) nativeOption.selected = true;
        }
        option?.remove();
    }
    sortSelect = null;
    pinnedOnly = false;
}
function initializePinFeature() {
    pinnedAvatars = readPinnedAvatars();
    attachPaginationBridge();
    updatePinnedSortOption();
    addPinButtons();
}

export function onEnable() {
    if (runtimeEnabled) return;
    runtimeEnabled = true;
    applyMode(preferredEnabled());
    initializePinFeature();
    const headerMounted = mountHeader();
    const filterMounted = mountFilterStrip();
    const settingsMounted = mountSettings();
    const pinsReady = attachPaginationBridge() && updatePinnedSortOption();
    if (headerMounted && filterMounted && settingsMounted && pinsReady) {
        // The native page may have been drawn before pagination was bridged.
        void refreshNativeCharacterList();
        return;
    }
    // If TT constructs one of its native hosts late, retry until both exist.
    if (document.body) {
        pendingObserver = new MutationObserver(() => {
            const readyHeader = mountHeader();
            const readyFilter = mountFilterStrip();
            const readySettings = mountSettings();
            const readyPins = attachPaginationBridge() && updatePinnedSortOption();
            if (readyHeader && readyFilter && readySettings && readyPins) {
                addPinButtons();
                void refreshNativeCharacterList();
                pendingObserver?.disconnect();
                pendingObserver = null;
            }
        });
        pendingObserver.observe(document.body, { childList: true, subtree: true });
    }
}

export function onDisable() {
    runtimeEnabled = false;
    pendingObserver?.disconnect();
    pendingObserver = null;
    resetPinnedSortOption();
    detachPaginationBridge();
    removePinButtons();
    clearPreviewCardOrder();
    positionGalleryToolbar(false);
    positionNativeActions(false);
    document.body?.classList.remove(ROOT_CLASS);
    document.getElementById(HEADER_ID)?.remove();
    document.getElementById(FILTER_STRIP_ID)?.remove();
    document.querySelector('#rm_characters_block #charListFixedTop')?.classList.remove('dw2cg-filters-open');
    document.getElementById(SETTINGS_ID)?.remove();
    // Removing the bridge does not redraw TT's last pinned datasource by
    // itself. Reprint once so native mode immediately regains its full list.
    void refreshNativeCharacterList(true);
}

onEnable();
