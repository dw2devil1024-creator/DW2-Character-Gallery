/*
 * DW2 · Character Gallery | v1.0.0
 * TT native character-list presentation only. Never clone/rebind character
 * cards: TT owns its delegated click handlers, sort/filter and bulk actions.
 */
const STORAGE_KEY = 'dw2cg:gallery:enabled';
const ROOT_CLASS = 'dw2cg-active';
const HEADER_ID = 'dw2cg-header';
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
    const button = document.getElementById('dw2cg-toggle');
    if (!button) return;
    const active = document.body?.classList.contains(ROOT_CLASS);
    button.setAttribute('aria-pressed', String(Boolean(active)));
    button.setAttribute('aria-label', active ? '关闭 DW2 角色画廊美化' : '启用 DW2 角色画廊美化');
    button.title = active ? '切换到 TT 原生外观' : '启用 DW2 角色画廊';
    const label = button.querySelector('.dw2cg-switch-label');
    if (label) label.textContent = active ? '画廊模式' : '原生模式';
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

export function onEnable() {
    if (runtimeEnabled) return;
    runtimeEnabled = true;
    applyMode(preferredEnabled());
    if (mountHeader()) return;
    // Rare late DOM cases only. Disconnect as soon as the native panel exists.
    if (document.body) {
        pendingObserver = new MutationObserver(() => {
            if (mountHeader()) {
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
}

onEnable();
