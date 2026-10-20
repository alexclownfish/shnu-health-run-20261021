const stations = [
  {
    title: "起步站：托球平衡挑战",
    location: "A 点 · 起步站",
    tag: "第一打卡点",

    success: "照片已上传，继续沿路线前往下一站。",
  },
  {
    title: "途中站：快乐燃动锤",
    location: "B 点 · 途中站",
    tag: "第二打卡点",

    success: "照片已上传，还剩最后一个点位。",
  },
  {
    title: "终点站：趣味翻翻乐",
    location: "C 点 · 终点站",
    tag: "第三打卡点",

    success: "三个点位照片均已上传，前往终点扫码解锁完赛凭证。",
  },
];

const savedFlow = (() => {
  try {
    return JSON.parse(localStorage.getItem("patchwalk-flow-v1") || "{}");
  } catch {
    return {};
  }
})();
const storedProgress = Number(localStorage.getItem("patchwalk-progress"));
const state = {
  completed: Number.isFinite(savedFlow.completed)
    ? Math.min(Math.max(savedFlow.completed, 0), 3)
    : Number.isFinite(storedProgress) ? Math.min(Math.max(storedProgress, 0), 3) : 0,
  current: Number.isFinite(savedFlow.current) ? Math.min(Math.max(savedFlow.current, 0), 2) : 0,
  // 起点和终点只在扫码成功回调中写入一次，用它们计算整条路线用时。
  startedAt: Number.isFinite(savedFlow.startedAt) ? savedFlow.startedAt : 0,
  finishedAt: Number.isFinite(savedFlow.finishedAt) ? savedFlow.finishedAt : 0,
  scanType: "start",
};

function persistFlow() {
  localStorage.setItem("patchwalk-flow-v1", JSON.stringify({
    completed: state.completed,
    current: state.current,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  }));
  // 兼容原型旧版进度键，避免刷新后出现两个不同的点位进度。
  localStorage.setItem("patchwalk-progress", String(state.completed));
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function routeElapsed() {
  if (!state.startedAt) return 0;
  return (state.finishedAt || Date.now()) - state.startedAt;
}

const screens = [...document.querySelectorAll(".screen")];
const bottomNav = document.getElementById("bottomNav");
const appViewport = document.getElementById("appViewport");
const sheetBackdrop = document.getElementById("sheetBackdrop");
const scanSheet = document.getElementById("scanSheet");
const successSheet = document.getElementById("successSheet");
const toast = document.getElementById("toast");

function iconRefresh() {
  if (window.lucide) window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
}

function showScreen(name) {
  screens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
  const primaryTab = ["route", "records", "profile"].includes(name);
  bottomNav.classList.toggle("is-hidden", !primaryTab);
  document.querySelector(".phone").classList.toggle("detail-mode", !primaryTab);
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.tab === name));
  const active = document.querySelector(`[data-screen="${name}"]`);
  if (active) active.scrollTop = 0;
  closeSheets();
  iconRefresh();
}

function renderStations() {
  const list = document.getElementById("stationList");
  list.innerHTML = stations.map((station, index) => {
    const done = index < state.completed;
    const current = index === state.completed && state.completed < 3;
    const locked = index > state.completed;
    return `
      <article class="station-card ${done ? "is-done" : ""} ${locked ? "is-locked" : ""}" data-station="${index}" ${locked ? "aria-disabled=\"true\"" : ""}>
        <span class="station-number">${done ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <div class="station-info"><strong>${station.title}</strong><span>${station.location} · ${station.tag}</span></div>
        <div class="station-meta"><b>${done ? "已完成" : current ? "下一点" : "待解锁"}</b></div>
      </article>`;
  }).join("");

  document.querySelectorAll("[data-map-point]").forEach((point, index) => {
    point.classList.toggle("is-done", index < state.completed);
    point.classList.toggle("is-current", index === state.completed && state.completed < 3);
    point.querySelector("text").textContent = index < state.completed ? "✓" : index + 1;
  });

  const progressTitle = document.getElementById("routeProgressTitle");
  const ctaLabel = document.getElementById("routeCtaLabel");
  document.getElementById("progressCount").textContent = `${state.completed} / 3 点位`;
  progressTitle.textContent = !state.startedAt ? "等待起点扫码" : state.finishedAt ? "已抵达终点" : state.completed === 3 ? "三个打卡站已完成" : `下一站 · ${stations[state.completed].title}`;
  ctaLabel.textContent = !state.startedAt ? "扫描起点开始计时" : state.finishedAt ? "查看完赛凭证" : state.completed === 3 ? "扫描终点结束计时" : `前往点位 ${state.completed + 1}`;
  document.querySelectorAll(".flow-node").forEach((node, index) => {
    const done = index === 0 ? Boolean(state.startedAt) : index <= state.completed;
    const current = index === 0 ? !state.startedAt : index === state.completed + 1 && !state.finishedAt;
    node.classList.toggle("is-done", done || (index === 4 && state.finishedAt));
    node.classList.toggle("is-current", current || (index === 4 && state.completed === 3 && !state.finishedAt));
  });
  updateTiming();
  updateRecords();
}

function updateTiming() {
  const elapsed = state.startedAt ? (state.finishedAt || Date.now()) - state.startedAt : 0;
  document.querySelectorAll("[data-route-time]").forEach((node) => { node.textContent = formatDuration(elapsed); });
  const status = document.getElementById("timingStatus");
  if (status) status.textContent = !state.startedAt ? "起点扫码后开始" : state.finishedAt ? "计时已结束" : "计时进行中";
}

function beginRoute() {
  state.startedAt = Date.now();
  state.finishedAt = 0;
  persistFlow();
  closeSheets();
  renderStations();
  showToast("起点扫码成功，计时开始", "play");
}

function finishRoute() {
  state.finishedAt = Date.now();
  persistFlow();
  renderStations();
  document.getElementById("successTitle").textContent = "终点已完成";
  document.getElementById("successDescription").textContent = `计时结束，本次用时 ${formatDuration(state.finishedAt - state.startedAt)}，恭喜完成挑战！`;
  document.getElementById("successProgressBar").style.width = "100%";
  document.getElementById("continueLabel").textContent = "生成完赛凭证";
  openSheet(successSheet);
}

function prepareStation(index = state.current) {
  state.current = Math.min(index, 2);
  const station = stations[state.current];
  document.getElementById("uploadSubtitle").textContent = `点位 ${state.current + 1} · ${station.title}`;
  document.getElementById("uploadStep").textContent = `${state.current + 1}/3`;
  document.getElementById("photoPreview").removeAttribute("src");
  document.getElementById("photoStage").classList.remove("has-photo");
  document.getElementById("photoInput").value = "";
}

function openSheet(sheet) {
  sheetBackdrop.classList.add("is-open");
  sheet.classList.add("is-open");
  iconRefresh();
}

function closeSheets() {
  sheetBackdrop.classList.remove("is-open");
  scanSheet.classList.remove("is-open");
  successSheet.classList.remove("is-open");
}

function startRoute() {
  if (state.finishedAt) {
    renderCertificate();
    showScreen("certificate");
    return;
  }
  if (!state.startedAt) {
    state.scanType = "start";
    document.getElementById("scanTitle").textContent = "起点扫码 · 开始计时";
    document.getElementById("scanDescription").textContent = "请扫描起点二维码。扫码成功后直接开始计时，无需拍照。";
  } else if (state.completed >= 3) {
    state.scanType = "finish";
    document.getElementById("scanTitle").textContent = "终点扫码 · 结束计时";
    document.getElementById("scanDescription").textContent = "三个打卡站均已完成，请扫描终点二维码结束计时，无需拍照。";
  } else {
    state.current = state.completed;
    state.scanType = "station";
    const station = stations[state.current];
    document.getElementById("scanTitle").textContent = `点位 ${state.current + 1} · ${station.title}`;
    document.getElementById("scanDescription").textContent = `已到达${station.location}。请对准现场二维码扫码，成功后直接拍照上传。`;
  }
  const scanActionLabel = document.getElementById("scanActionLabel");
  if (scanActionLabel) scanActionLabel.textContent = state.scanType === "start" ? "模拟扫描起点" : state.scanType === "finish" ? "模拟扫描终点" : "模拟扫码打卡";
  openSheet(scanSheet);
}

function submitPoint() {
  if (!document.getElementById("photoPreview").src) {
    showToast("请先拍照或选择照片", "camera");
    return;
  }
  if (!document.getElementById("privacyCheck").checked) {
    showToast("请先确认照片隐私设置", "alert-circle");
    return;
  }
  state.completed = Math.max(state.completed, state.current + 1);
  persistFlow();
  renderStations();
  const station = stations[state.current];
  document.getElementById("successTitle").textContent = `点位 ${state.current + 1} 已完成`;
  document.getElementById("successDescription").textContent = station.success;
  document.getElementById("successProgressBar").style.width = `${state.completed / 3 * 100}%`;
  document.getElementById("continueLabel").textContent = state.completed === 3 ? "前往终点扫码" : "查看下一站";
  openSheet(successSheet);
}

function continueRoute() {
  if (state.finishedAt) {
    renderCertificate();
    showScreen("certificate");
  } else {
    state.current = state.completed;
    showScreen("route");
    showToast(state.completed >= 3 ? "三个打卡站已完成，请扫描终点" : `点位 ${state.completed} 已完成`);
  }
}

function renderCertificate() {
  const now = new Date();
  const dateCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  document.getElementById("certificateId").textContent = dateCode;
  document.getElementById("completeTime").textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const duration = document.getElementById("completeDuration");
  if (duration) duration.textContent = formatDuration(routeElapsed());
  document.getElementById("certificateStations").innerHTML = stations.map((station, index) => `
    <div class="certificate-station"><b>${index + 1}</b><span>${station.title} · ${station.location}</span><span>完成</span></div>
  `).join("");
}

function updateRecords() {
  const factor = Math.max(state.completed, 1);
  document.getElementById("weeklyEnergy").textContent = state.completed === 3 ? "260" : String(60 + factor * 20);
  document.getElementById("ringValue").textContent = state.completed === 3 ? "86%" : `${40 + factor * 10}%`;
  document.querySelector(".energy-ring").style.setProperty("--p", state.completed === 3 ? "86%" : `${40 + factor * 10}%`);
  document.getElementById("totalDistance").textContent = state.completed === 3 ? "3.5" : (state.completed * 1.2).toFixed(1);
  document.getElementById("totalCalories").textContent = state.completed === 3 ? "68" : String(state.completed * 18);
  document.getElementById("totalPoints").textContent = state.completed;
}

function showToast(message, icon = "check-circle-2") {
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  toast.classList.add("is-visible");
  iconRefresh();
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function resetProgress() {
  state.completed = 0;
  state.current = 0;
  state.startedAt = 0;
  state.finishedAt = 0;
  persistFlow();
  renderStations();
  showScreen("route");
  showToast("演示进度已重置");
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    showScreen(tab.dataset.tab);
    return;
  }

  const stationCard = event.target.closest("[data-station]");
  if (stationCard && !stationCard.classList.contains("is-locked")) {
    const index = Number(stationCard.dataset.station);
    if (index < state.completed) {
      showToast("该点位已完成");
    } else {
      state.current = index;
      startRoute();
    }
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const actions = {
    profile: () => showScreen("profile"),
    "back-route": () => showScreen("route"),
    "start-route": startRoute,
    "close-sheet": closeSheets,
    "simulate-scan": () => {
      const button = document.querySelector('[data-action="simulate-scan"]');
      button.innerHTML = '<span>识别中...</span><i data-lucide="loader-circle"></i>';
      iconRefresh();
      button.querySelector("svg")?.classList.add("spin");
      setTimeout(() => {
        if (state.scanType === "start") {
          beginRoute();
        } else if (state.scanType === "finish") {
          finishRoute();
        } else {
          prepareStation(state.current);
          showScreen("upload");
          showToast("扫码成功，请拍照上传");
        }
        button.innerHTML = '<span>模拟扫码打卡</span><i data-lucide="scan-line"></i>';
        iconRefresh();
      }, 700);
    },
    "submit-point": submitPoint,
    "continue-route": continueRoute,
    "demo-complete": () => {
      state.completed = 3;
      state.current = 2;
      if (!state.startedAt) state.startedAt = Date.now() - 45 * 60 * 1000;
      state.finishedAt = Date.now();
      persistFlow();
      renderStations();
      renderCertificate();
      showScreen("certificate");
    },
    share: () => {
      if (navigator.share) {
        navigator.share({ title: "步履拾光·健康同行", text: "我完成了 3.50 公里健步走，3/3 点位全部打卡！" }).catch(() => {});
      } else {
        showToast("分享文案已准备");
      }
    },
    download: () => showToast("凭证已保存到相册（原型演示）", "download"),
    "reset-progress": resetProgress,
  };
  actions[action]?.();
});

sheetBackdrop.addEventListener("click", closeSheets);

document.getElementById("photoInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("照片不能超过 10MB", "alert-circle");
    return;
  }
  const preview = document.getElementById("photoPreview");
  preview.src = URL.createObjectURL(file);
  document.getElementById("photoStage").classList.add("has-photo");
  showToast("照片已就绪");
});

function setStatusTime() {
  document.getElementById("statusTime").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

renderStations();
renderCertificate();
setStatusTime();
iconRefresh();
setInterval(setStatusTime, 30000);
setInterval(updateTiming, 1000);

const previewScreen = new URLSearchParams(window.location.search).get("screen");
if (["route", "upload", "certificate", "records", "profile"].includes(previewScreen)) {
  if (previewScreen === "upload") prepareStation(0);
  if (previewScreen === "certificate") renderCertificate();
  showScreen(previewScreen);
}
