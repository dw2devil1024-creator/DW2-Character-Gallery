/*
 * DW2 · Character Gallery | v1.0.1
 * TT native character-list presentation only. Never clone/rebind character
 * cards: TT owns its delegated click handlers, sort/filter and bulk actions.
 */
const STORAGE_KEY = 'dw2cg:gallery:enabled';
const ROOT_CLASS = 'dw2cg-active';
const HEADER_ID = 'dw2cg-header';
const SETTINGS_ID = 'dw2cg-settings';
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
    status.textContent = '已加载 · v1.0.1 · DW2 独立视觉';
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
    guide.textContent = '三列封面 · 底部翻页 · 保留 TT 原生点击与管理功能';
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
    const settingsMounted = mountSettings();
    if (headerMounted && settingsMounted) return;
    // If TT constructs one of its native hosts late, retry until both exist.
    if (document.body) {
        pendingObserver = new MutationObserver(() => {
            const readyHeader = mountHeader();
            const readySettings = mountSettings();
            if (readyHeader && readySettings) {
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
    document.getElementById(SETTINGS_ID)?.remove();
}

onEnable();
