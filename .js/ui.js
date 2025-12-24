// js/ui.js
(function () {
  const JC = window.JC;

  function setActiveLinks(tab) {
    JC.$$(".tabs .tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    JC.$$("#drawer .drawer-nav [data-tab]").forEach((a) => {
      a.classList.toggle("active", a.dataset.tab === tab);
    });
  }

  function showView(tab) {
    JC.$$(".view").forEach((sec) => sec.classList.remove("active"));
    const view = JC.$(`.view[data-view="${tab}"]`);
    if (view) view.classList.add("active");
    setActiveLinks(tab);
  }

  function activate(tab) {
    if (!tab) tab = "inicio";
    showView(tab);
    // hash
    if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
    JC.emit("ui:view", { tab });
  }

  function bindDrawer() {
    const overlay = JC.$("#overlay");
    const drawer = JC.$("#drawer");
    const openBtn = JC.$("#openDrawer");
    const closeBtn = JC.$("#closeDrawer");

    const open = () => {
      drawer?.classList.add("open");
      overlay?.classList.add("show");
      overlay?.setAttribute("aria-hidden", "false");
    };
    const close = () => {
      drawer?.classList.remove("open");
      overlay?.classList.remove("show");
      overlay?.setAttribute("aria-hidden", "true");
    };

    openBtn?.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    overlay?.addEventListener("click", close);

    // drawer links
    JC.$$("#drawer [data-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        const tab = el.dataset.tab;
        close();
        activate(tab);
      });
    });
  }

  function bindTabs() {
    JC.$$(".tabs .tab").forEach((btn) => {
      btn.addEventListener("click", () => activate(btn.dataset.tab));
    });

    // links tipo <a href="#eventos" data-tab="eventos">
    JC.$$("#main [data-tab]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const tab = el.dataset.tab;
        if (!tab) return;
        // si es <a>, evita salto raro
        if (el.tagName === "A") e.preventDefault();
        activate(tab);
      });
    });
  }

  function initTheme() {
    const picker = JC.$("#themePicker");
    if (!picker) return;

    const saved = localStorage.getItem("jc_theme");
    if (saved) picker.value = saved;

    const apply = (val) => {
      document.documentElement.dataset.theme = val;
      localStorage.setItem("jc_theme", val);
      JC.state.theme = val;
      JC.emit("ui:theme", { theme: val });
    };

    apply(picker.value || "auto");
    picker.addEventListener("change", () => apply(picker.value));
  }

  function activateFromHash() {
    const tab = (location.hash || "#inicio").replace("#", "");
    activate(tab);
  }

  function init() {
    bindDrawer();
    bindTabs();
    initTheme();
    activateFromHash();

    window.addEventListener("hashchange", activateFromHash);
  }

  JC.ui = { init, activate, activateFromHash };
})();