/*
 * DW2 · Character Gallery | v1.0.3
 * TT native character-list presentation only. Never clone/rebind character
 * cards: TT owns its delegated click handlers, sort/filter and bulk actions.
 */
const STORAGE_KEY = 'dw2cg:gallery:enabled';
const ROOT_CLASS = 'dw2cg-active';
const HEADER_ID = 'dw2cg-header';
const SETTINGS_ID = 'dw2cg-settings';
const FILTER_STRIP_ID = 'dw2cg-filter-strip';
const FILTERS_KEY = 'dw2cg:filters:open';
let runtimeEnabled = false;
let pendingObserver = null;

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
        if (label) label.textContent = active ? '画廊模式' : '原生模式';
    }
    const checkbox = document.getElementById('dw2cg-settings-toggle');
    if (checkbox) checkbox.checked = active;
}

function applyMode(value) {
    if (!runtimeEnabled || !document.body) return;
    document.body.classList.toggle(ROOT_CLASS, Boolean(value));
    renderToggle();
}

function mountHeader() {
    const panelTop = document.querySelector('#rm_characters_block #charListFixedTop');
    if (!panelTop || !runtimeEnabled) return false;
    if (document.getElementById(HEADER_ID)) {
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

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'dw2cg-toggle';
    toggle.className = 'dw2cg-switch';
    const mark = document.createElement('i');
    mark.className = 'fa-solid fa-images';
    mark.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'dw2cg-switch-label';
    toggle.append(mark, text);
    toggle.addEventListener('click', () => {
        const next = !document.body.classList.contains(ROOT_CLASS);
        setPreferredEnabled(next);
        applyMode(next);
    });
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
    if (document.getElementById(FILTER_STRIP_ID)) return true;
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
    return true;
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
    status.textContent = '已加载 · v1.0.3 · DW2 独立视觉';
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
    guide.textContent = '三列封面 · 底部翻页 · 筛选横向收纳 · 保留原生管理';
    content.append(status, option, guide);
    drawer.append(heading, content);
    panel.append(drawer);
    host.append(panel);
    renderToggle();
    return true;
}

export function onEnable() {
    if (runtimeEnabled) return;
    runtimeEnabled = true;
    applyMode(preferredEnabled());
    const headerMounted = mountHeader();
    const filterMounted = mountFilterStrip();
    const settingsMounted = mountSettings();
    if (headerMounted && filterMounted && settingsMounted) return;
    // If TT constructs one of its native hosts late, retry until both exist.
    if (document.body) {
        pendingObserver = new MutationObserver(() => {
            const readyHeader = mountHeader();
            const readyFilter = mountFilterStrip();
            const readySettings = mountSettings();
            if (readyHeader && readyFilter && readySettings) {
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
    document.body?.classList.remove(ROOT_CLASS);
    document.getElementById(HEADER_ID)?.remove();
    document.getElementById(FILTER_STRIP_ID)?.remove();
    document.querySelector('#rm_characters_block #charListFixedTop')?.classList.remove('dw2cg-filters-open');
    document.getElementById(SETTINGS_ID)?.remove();
}

onEnable();
