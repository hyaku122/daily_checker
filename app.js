"use strict";

(function () {
  var APP_VERSION = "2026.05.03-1";
  var CACHE_PREFIX = "mino-kumoyou-static-";
  var BACKUP_PREFIX = "mino-kumoyou-backup-v1:";
  var STORAGE_KEYS = {
    records: "mino-kumoyou.records.v1",
    preferences: "mino-kumoyou.preferences.v1"
  };
  var STATE_OPTIONS = [
    { value: "澄", description: "少し軽くて、空が開けている感じ" },
    { value: "回復", description: "整えながら、持ち直している感じ" },
    { value: "濁", description: "重さやゆらぎが、少し濃い感じ" }
  ];
  var FATIGUE_OPTIONS = [
    { value: 1, label: "かるい" },
    { value: 2, label: "わりと平気" },
    { value: 3, label: "ふつう" },
    { value: 4, label: "おもい" },
    { value: 5, label: "へとへと" }
  ];
  var dom = {};
  var appState = {
    records: {},
    preferences: { selectedYear: getCurrentYear() },
    activeDate: getTodayKey(),
    activeView: "home",
    quickDraft: createBlankRecord(getTodayKey()),
    quickStep: 1,
    recordSheetMode: "quick",
    detailContext: "edit",
    editingDate: getTodayKey(),
    swRegistration: null,
    toastTimer: 0
  };
  var APP_ASSET_URLS = [
    "./",
    "./index.html",
    "./styles.css?v=" + APP_VERSION,
    "./app.js?v=" + APP_VERSION,
    "./manifest.webmanifest?v=" + APP_VERSION,
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
    "./icons/favicon-16.png"
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    appState.records = loadRecords();
    appState.preferences = loadPreferences();
    appState.preferences.selectedYear = normalizeSelectedYear(appState.preferences.selectedYear);
    appState.quickDraft = createBlankRecord(getTodayKey());
    bindEvents();
    renderApp();
    registerServiceWorker();
    autoOpenTodayIfNeeded();
  }

  function cacheDom() {
    dom.body = document.body;
    dom.todayPanel = document.getElementById("todayPanel");
    dom.recentPanel = document.getElementById("recentPanel");
    dom.monthPanel = document.getElementById("monthPanel");
    dom.yearPanel = document.getElementById("yearPanel");
    dom.appMain = document.querySelector(".app-main");
    dom.yearPage = document.getElementById("yearPage");
    dom.yearViewButton = document.getElementById("yearViewButton");
    dom.yearBackButton = document.getElementById("yearBackButton");
    dom.refreshButton = document.getElementById("refreshButton");
    dom.settingsButton = document.getElementById("settingsButton");
    dom.toast = document.getElementById("toast");

    dom.recordSheet = document.getElementById("recordSheet");
    dom.recordSheetEyebrow = document.getElementById("recordSheetEyebrow");
    dom.recordSheetTitle = document.getElementById("recordSheetTitle");
    dom.recordSheetClose = document.getElementById("recordSheetClose");
    dom.quickFlow = document.getElementById("quickFlow");
    dom.stepIndicator = document.getElementById("stepIndicator");
    dom.stepStatePanel = document.getElementById("stepStatePanel");
    dom.stepFatiguePanel = document.getElementById("stepFatiguePanel");
    dom.stepSavedPanel = document.getElementById("stepSavedPanel");
    dom.stateButtonGrid = document.getElementById("stateButtonGrid");
    dom.fatigueButtonGrid = document.getElementById("fatigueButtonGrid");
    dom.selectedStateCaption = document.getElementById("selectedStateCaption");
    dom.backToStateButton = document.getElementById("backToStateButton");
    dom.savedSummary = document.getElementById("savedSummary");
    dom.addMemoButton = document.getElementById("addMemoButton");
    dom.closeQuickFlowButton = document.getElementById("closeQuickFlowButton");

    dom.detailForm = document.getElementById("detailForm");
    dom.detailFormTitle = document.getElementById("detailFormTitle");
    dom.detailDateText = document.getElementById("detailDateText");
    dom.detailStateChoices = document.getElementById("detailStateChoices");
    dom.detailFatigueChoices = document.getElementById("detailFatigueChoices");
    dom.detailStateInput = document.getElementById("detailStateInput");
    dom.detailFatigueInput = document.getElementById("detailFatigueInput");
    dom.memoInput = document.getElementById("memoInput");
    dom.painToggleChoices = document.getElementById("painToggleChoices");
    dom.detailPainHasInput = document.getElementById("detailPainHasInput");
    dom.painFields = document.getElementById("painFields");
    dom.painPartInput = document.getElementById("painPartInput");
    dom.painLevelInput = document.getElementById("painLevelInput");
    dom.painLevelOutput = document.getElementById("painLevelOutput");
    dom.triggerInput = document.getElementById("triggerInput");
    dom.reliefInput = document.getElementById("reliefInput");
    dom.cancelDetailButton = document.getElementById("cancelDetailButton");

    dom.settingsSheet = document.getElementById("settingsSheet");
    dom.settingsClose = document.getElementById("settingsClose");
    dom.createBackupButton = document.getElementById("createBackupButton");
    dom.copyBackupButton = document.getElementById("copyBackupButton");
    dom.backupOutput = document.getElementById("backupOutput");
    dom.restoreInput = document.getElementById("restoreInput");
    dom.restoreButton = document.getElementById("restoreButton");
    dom.restoreFeedback = document.getElementById("restoreFeedback");
  }

  function bindEvents() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("change", handleDocumentChange);
    window.addEventListener("focus", handleWindowFocus);
    dom.refreshButton.addEventListener("click", handleManualUpdate);
    dom.settingsButton.addEventListener("click", openSettingsSheet);
    dom.yearViewButton.addEventListener("click", openYearView);
    dom.yearBackButton.addEventListener("click", closeYearView);
    dom.recordSheetClose.addEventListener("click", closeRecordSheet);
    dom.settingsClose.addEventListener("click", closeSettingsSheet);
    dom.recordSheet.addEventListener("click", handleBackdropClick);
    dom.settingsSheet.addEventListener("click", handleBackdropClick);
    dom.backToStateButton.addEventListener("click", function () {
      appState.quickStep = 1;
      renderRecordSheet();
    });
    dom.addMemoButton.addEventListener("click", function () {
      openDetailEditor(appState.editingDate, "memo");
    });
    dom.closeQuickFlowButton.addEventListener("click", closeRecordSheet);
    dom.detailForm.addEventListener("submit", handleDetailSubmit);
    dom.cancelDetailButton.addEventListener("click", closeRecordSheet);
    dom.painLevelInput.addEventListener("input", updatePainLevelOutput);
    dom.createBackupButton.addEventListener("click", handleCreateBackup);
    dom.copyBackupButton.addEventListener("click", handleCopyBackup);
    dom.restoreButton.addEventListener("click", handleRestore);
  }

  function handleDocumentClick(event) {
    var button = event.target.closest("button");
    if (!button) {
      return;
    }

    if (button.hasAttribute("data-open-quick")) {
      openQuickRecord(button.getAttribute("data-open-quick") || getTodayKey());
      return;
    }
    if (button.hasAttribute("data-open-edit")) {
      openDetailEditor(button.getAttribute("data-open-edit"), "edit");
      return;
    }
    if (button.hasAttribute("data-change-year")) {
      changeSelectedYear(Number(button.getAttribute("data-change-year")));
      return;
    }
    if (button.hasAttribute("data-quick-state")) {
      selectQuickState(button.getAttribute("data-quick-state"));
      return;
    }
    if (button.hasAttribute("data-quick-fatigue")) {
      selectQuickFatigue(Number(button.getAttribute("data-quick-fatigue")));
      return;
    }
    if (button.hasAttribute("data-detail-state")) {
      setDetailState(button.getAttribute("data-detail-state"));
      return;
    }
    if (button.hasAttribute("data-detail-fatigue")) {
      setDetailFatigue(Number(button.getAttribute("data-detail-fatigue")));
      return;
    }
    if (button.hasAttribute("data-pain-has")) {
      setPainHas(button.getAttribute("data-pain-has") === "true");
    }
  }

  function handleDocumentChange(event) {
    if (event.target && event.target.hasAttribute("data-active-date")) {
      setActiveDate(event.target.value);
    }
  }

  function handleBackdropClick(event) {
    if (event.target === dom.recordSheet) {
      closeRecordSheet();
    }
    if (event.target === dom.settingsSheet) {
      closeSettingsSheet();
    }
  }

  function handleWindowFocus() {
    appState.preferences.selectedYear = normalizeSelectedYear(appState.preferences.selectedYear);
    renderApp();
  }

  function renderApp() {
    renderViewState();
    renderYearButton();
    renderTodayPanel();
    renderMonthPanel();
    renderRecentPanel();
    renderYearPanel();
  }

  function renderViewState() {
    var isYearView = appState.activeView === "year";
    dom.appMain.classList.toggle("hidden", isYearView);
    dom.yearPage.classList.toggle("hidden", !isYearView);
  }

  function renderYearButton() {
    dom.yearViewButton.textContent = appState.preferences.selectedYear + "年を見返す";
  }

  function openYearView() {
    appState.activeView = "year";
    renderApp();
    window.scrollTo(0, 0);
  }

  function closeYearView() {
    appState.activeView = "home";
    renderApp();
    window.scrollTo(0, 0);
  }

  function setActiveDate(dateKey) {
    if (!isValidDateKey(dateKey)) {
      showToast("日付を選びなおしてください。");
      return;
    }
    appState.activeDate = dateKey;
    renderTodayPanel();
  }

  function createDatePicker(dateKey) {
    return '<label class="date-picker-pill">' +
      '<span>' + escapeHtml(formatDateLabel(dateKey, false)) + "</span>" +
      '<input type="date" value="' + escapeAttribute(dateKey) + '" data-active-date aria-label="記録する日付を選ぶ" />' +
      "</label>";
  }

  function renderTodayPanel() {
    var activeDate = appState.activeDate || getTodayKey();
    var todayRecord = getRecord(activeDate);
    var totalRecords = getSortedRecords().length;
    var isToday = activeDate === getTodayKey();
    var dateCaption = isToday ? "今日" : "記録日";
    var html = "";

    if (todayRecord) {
      html += '<div class="panel-head">';
      html += '<div><p class="section-caption">' + dateCaption + '</p><h2 class="panel-title">記録済みです</h2></div>';
      html += createDatePicker(activeDate);
      html += "</div>";
      html += '<div class="today-status">';
      html += '<div class="today-summary">';
      html += createStateBadge(todayRecord.state);
      html += '<span class="info-pill">疲れ度 ' + todayRecord.fatigue + " / 5 " + escapeHtml(getFatigueLabel(todayRecord.fatigue)) + "</span>";
      if (hasOptionalMemo(todayRecord)) {
        html += '<span class="info-pill">体調メモあり</span>';
      }
      html += "</div>";
      html += '<p class="summary-copy">' + escapeHtml(buildTodaySummary(todayRecord)) + "</p>";
      if (todayRecord.memo) {
        html += '<p class="inline-note">' + escapeHtml(truncateText(todayRecord.memo, 68)) + "</p>";
      } else if (todayRecord.painHas) {
        html += '<p class="inline-note">痛みの記録も残っています。</p>';
      }
      html += '<div class="button-row">';
      html += '<button class="primary-button" type="button" data-open-edit="' + escapeAttribute(activeDate) + '">記録を編集</button>';
      html += "</div>";
      html += "</div>";
    } else {
      html += '<div class="panel-head">';
      html += '<div><p class="section-caption">' + dateCaption + '</p><h2 class="panel-title">' + (isToday ? "今日の状態を置く" : "この日の状態を置く") + "</h2></div>";
      html += createDatePicker(activeDate);
      html += "</div>";
      html += '<div class="empty-state">';
      html += '<div class="empty-cloud" aria-hidden="true">☁</div>';
      if (totalRecords === 0) {
        html += '<p class="inline-note">最初の1件は、澄 / 回復 / 濁 と疲れ度だけで大丈夫です。</p>';
      }
      html += '<div class="button-row">';
      html += '<button class="primary-button" type="button" data-open-quick="' + escapeAttribute(activeDate) + '">状態を記録する</button>';
      html += "</div>";
      html += "</div>";
    }

    dom.todayPanel.innerHTML = html;
  }

  function renderRecentPanel() {
    var records = getSortedRecords().slice(0, 8);
    var html = '<div class="panel-head"><div><h2 class="panel-title">最近の記録</h2></div></div>';

    if (!records.length) {
      html += '<div class="empty-state">';
      html += '<p class="panel-copy">まだ記録はありません。今日の1件を置くと、ここから自然に育っていきます。</p>';
      html += "</div>";
      dom.recentPanel.innerHTML = html;
      return;
    }

    html += '<div class="recent-list">';
    records.forEach(function (record) {
      html += '<button class="record-row" type="button" data-open-edit="' + escapeAttribute(record.date) + '">';
      html += '<div class="record-head">';
      html += '<span class="record-date">' + escapeHtml(formatDateLabel(record.date, false)) + "</span>";
      html += createStateBadge(record.state);
      html += "</div>";
      html += '<div class="record-meta">';
      html += '<span class="mini-badge" data-state="' + escapeAttribute(record.state) + '">疲れ度 ' + record.fatigue + "</span>";
      if (record.memo) {
        html += '<span class="info-pill">メモ</span>';
      }
      if (record.painHas) {
        html += '<span class="info-pill">痛み</span>';
      }
      html += "</div>";
      html += '<p class="helper-text">' + escapeHtml(buildListSummary(record)) + "</p>";
      html += "</button>";
    });
    html += "</div>";

    dom.recentPanel.innerHTML = html;
  }

  function renderMonthPanel() {
    var today = parseDateKey(getTodayKey());
    var summary = getMonthSummary(today.getFullYear(), today.getMonth());
    var monthTitle = today.getMonth() + 1 + "月";
    var html = '<div class="panel-head">';
    html += '<div><h2 class="panel-title">' + monthTitle + "の輪郭</h2></div>";
    html += '<span class="info-pill">' + summary.total + "日記録</span>";
    html += "</div>";
    html += '<div class="month-summary-grid">';
    html += renderStackedBar(summary.counts, summary.total);
    html += '<div class="summary-grid">';
    STATE_OPTIONS.forEach(function (option) {
      html += '<div class="snapshot-card">';
      html += '<span class="metric-label">' + escapeHtml(option.value) + "</span>";
      html += '<span class="metric-value">' + summary.counts[option.value] + "</span>";
      html += '<span class="metric-sub">' + getRatioText(summary.counts[option.value], summary.total) + "</span>";
      html += "</div>";
    });
    html += "</div>";
    html += '<div class="month-stats">';
    html += createMetricCard("平均疲れ度", summary.total ? formatAverage(summary.averageFatigue) : "—", summary.total ? "1〜5で計算" : "まだ未記録");
    html += createMetricCard("メモ日", String(summary.memoDays), "自由記述か補足あり");
    html += createMetricCard("痛み日", String(summary.painDays), "痛みありを選択");
    html += createMetricCard("記録日", String(summary.total), "この月の保存件数");
    html += "</div>";
    if (!summary.total) {
      html += '<p class="helper-text">今月の記録はまだありません。今日の1件が入ると、ここにも反映されます。</p>';
    }
    html += "</div>";
    dom.monthPanel.innerHTML = html;
  }

  function renderYearPanel() {
    var selectedYear = appState.preferences.selectedYear;
    var yearSummary = getYearSummary(selectedYear);
    var bounds = getYearBounds();
    var html = '<div class="panel-head">';
    html += '<div><h2 class="panel-title">' + selectedYear + "年を見返す</h2></div>";
    html += "</div>";
    html += '<div class="year-nav">';
    html += '<button class="year-switch" type="button" data-change-year="-1"' + (selectedYear <= bounds.min ? " disabled" : "") + ' aria-label="前年を見る">‹</button>';
    html += '<div class="year-label">' + selectedYear + "年</div>";
    html += '<button class="year-switch" type="button" data-change-year="1"' + (selectedYear >= bounds.max ? " disabled" : "") + ' aria-label="翌年を見る">›</button>';
    html += "</div>";
    html += '<div class="metric-grid">';
    html += createMetricCard("記録日", String(yearSummary.total), "日付ごとに1件");
    html += createMetricCard("平均疲れ度", yearSummary.total ? formatAverage(yearSummary.averageFatigue) : "—", yearSummary.total ? "1〜5で平均" : "まだ未記録");
    html += createMetricCard("メモ日", String(yearSummary.memoDays), "補足メモがある日");
    html += "</div>";
    html += '<div class="year-list">';
    yearSummary.months.forEach(function (monthSummary) {
      html += '<div class="trend-row">';
      html += '<div class="trend-head">';
      html += '<span class="trend-title">' + (monthSummary.month + 1) + "月</span>";
      html += '<span class="info-pill">' + monthSummary.total + "日</span>";
      html += "</div>";
      html += renderStackedBar(monthSummary.counts, monthSummary.total);
      html += '<div class="trend-meta">';
      html += '<span class="mini-badge" data-state="澄">澄 ' + monthSummary.counts["澄"] + "</span>";
      html += '<span class="mini-badge" data-state="回復">回復 ' + monthSummary.counts["回復"] + "</span>";
      html += '<span class="mini-badge" data-state="濁">濁 ' + monthSummary.counts["濁"] + "</span>";
      html += "</div>";
      if (monthSummary.total) {
        html += '<p class="trend-subcopy">平均疲れ度 ' + formatAverage(monthSummary.averageFatigue) + " / 5 ・ メモ " + monthSummary.memoDays + "日 ・ 痛み " + monthSummary.painDays + "日</p>";
      } else {
        html += '<p class="trend-subcopy">まだ記録はありません。</p>';
      }
      html += "</div>";
    });
    html += "</div>";
    html += '<div class="year-snapshot">';
    html += '<div class="info-card">';
    html += '<div class="list-header"><strong>メモがあった日</strong><span class="helper-text">' + yearSummary.memoRecords.length + "件</span></div>";
    html += renderRecordSnapshotList(yearSummary.memoRecords, "まだありません。");
    html += "</div>";
    html += '<div class="info-card">';
    html += '<div class="list-header"><strong>痛み記録</strong><span class="helper-text">' + yearSummary.painRecords.length + "件</span></div>";
    html += renderRecordSnapshotList(yearSummary.painRecords, "まだありません。");
    html += "</div>";
    html += "</div>";
    dom.yearPanel.innerHTML = html;
  }

  function renderRecordSnapshotList(records, emptyText) {
    if (!records.length) {
      return '<p class="helper-text">' + escapeHtml(emptyText) + "</p>";
    }

    var html = '<div class="trend-list">';
    records.slice(0, 6).forEach(function (record) {
      html += '<button class="pain-row" type="button" data-open-edit="' + escapeAttribute(record.date) + '">';
      html += '<div class="record-head">';
      html += '<span class="record-date">' + escapeHtml(formatDateLabel(record.date, false)) + "</span>";
      html += createStateBadge(record.state);
      html += "</div>";
      html += '<p class="helper-text">' + escapeHtml(buildListSummary(record)) + "</p>";
      html += "</button>";
    });
    html += "</div>";
    return html;
  }

  function openQuickRecord(dateKey) {
    var targetDate = isValidDateKey(dateKey) ? dateKey : getTodayKey();
    var existing = getRecord(targetDate);
    appState.editingDate = targetDate;
    appState.quickDraft = existing ? cloneRecord(existing) : createBlankRecord(targetDate);
    appState.quickStep = appState.quickDraft.state ? 2 : 1;
    appState.recordSheetMode = "quick";
    showRecordSheet();
    renderRecordSheet();
  }

  function openDetailEditor(dateKey, context) {
    var targetDate = isValidDateKey(dateKey) ? dateKey : getTodayKey();
    var existing = getRecord(targetDate);
    appState.editingDate = targetDate;
    appState.recordSheetMode = "detail";
    appState.detailContext = context || "edit";
    appState.quickDraft = existing ? cloneRecord(existing) : createBlankRecord(targetDate);
    showRecordSheet();
    renderRecordSheet();

    if (appState.detailContext === "memo") {
      window.setTimeout(function () {
        dom.memoInput.focus();
      }, 60);
    }
  }

  function showRecordSheet() {
    closeSettingsSheet();
    dom.recordSheet.classList.remove("hidden");
    dom.recordSheet.setAttribute("aria-hidden", "false");
    updateBodyLock();
  }

  function closeRecordSheet() {
    dom.recordSheet.classList.add("hidden");
    dom.recordSheet.setAttribute("aria-hidden", "true");
    if (!getRecord(getTodayKey())) {
      sessionStorage.setItem("mino-kumoyou.autoPromptDismissed", "1");
    }
    updateBodyLock();
  }

  function openSettingsSheet() {
    dom.restoreFeedback.textContent = "";
    dom.restoreFeedback.classList.remove("is-error");
    dom.settingsSheet.classList.remove("hidden");
    dom.settingsSheet.setAttribute("aria-hidden", "false");
    updateBodyLock();
  }

  function closeSettingsSheet() {
    dom.settingsSheet.classList.add("hidden");
    dom.settingsSheet.setAttribute("aria-hidden", "true");
    updateBodyLock();
  }

  function updateBodyLock() {
    var shouldLock = !dom.recordSheet.classList.contains("hidden") || !dom.settingsSheet.classList.contains("hidden");
    dom.body.classList.toggle("modal-open", shouldLock);
  }

  function renderRecordSheet() {
    var targetDate = appState.editingDate;
    var record = getRecord(targetDate) || cloneRecord(appState.quickDraft);
    var isToday = targetDate === getTodayKey();
    dom.recordSheetEyebrow.textContent = "";

    if (appState.recordSheetMode === "quick") {
      dom.recordSheetTitle.textContent = isToday ? "今日の状態を置く" : "状態を置く";
      dom.quickFlow.classList.remove("hidden");
      dom.detailForm.classList.add("hidden");
      renderQuickFlow(record);
      return;
    }

    dom.recordSheetTitle.textContent = appState.detailContext === "memo" ? "体調メモを追加" : "記録を編集";
    dom.quickFlow.classList.add("hidden");
    dom.detailForm.classList.remove("hidden");
    populateDetailForm(record);
  }

  function renderQuickFlow(record) {
    renderStepIndicator(appState.quickStep);
    dom.stepStatePanel.classList.toggle("hidden", appState.quickStep !== 1);
    dom.stepFatiguePanel.classList.toggle("hidden", appState.quickStep !== 2);
    dom.stepSavedPanel.classList.toggle("hidden", appState.quickStep !== 3);

    dom.stateButtonGrid.innerHTML = STATE_OPTIONS.map(function (option) {
      var selected = record.state === option.value ? " is-selected" : "";
      return '<button class="state-card' + selected + '" type="button" data-quick-state="' + escapeAttribute(option.value) + '">' +
        '<span class="state-name">' + escapeHtml(option.value) + "</span>" +
        '<span class="state-desc">' + escapeHtml(option.description) + "</span>" +
        "</button>";
    }).join("");

    dom.selectedStateCaption.textContent = record.state ? "選択中: " + record.state + " ・ 次に疲れ度をひとつ選びます。" : "";
    dom.fatigueButtonGrid.innerHTML = FATIGUE_OPTIONS.map(function (option) {
      var selected = Number(record.fatigue) === option.value ? " is-selected" : "";
      return '<button class="fatigue-card' + selected + '" type="button" data-quick-fatigue="' + option.value + '">' +
        '<span class="fatigue-number">' + option.value + "</span>" +
        '<span class="choice-title">' + escapeHtml(option.label) + "</span>" +
        "</button>";
    }).join("");

    if (appState.quickStep === 3) {
      dom.savedSummary.innerHTML =
        '<div class="today-summary">' +
        createStateBadge(record.state) +
        '<span class="info-pill">疲れ度 ' + record.fatigue + " / 5 " + escapeHtml(getFatigueLabel(record.fatigue)) + "</span>" +
        "</div>" +
        '<p class="summary-copy">基本記録は保存済みです。必要なら体調メモや痛みの情報をこのまま追加できます。</p>';
    }
  }

  function renderStepIndicator(step) {
    var html = "";
    [1, 2, 3].forEach(function (index) {
      html += '<span class="step-pill' + (index <= step ? " is-active" : "") + '"></span>';
    });
    dom.stepIndicator.innerHTML = html;
  }

  function populateDetailForm(record) {
    dom.detailFormTitle.textContent = "";
    dom.detailDateText.textContent = formatDateLabel(record.date, true);
    dom.detailStateInput.value = record.state || "";
    dom.detailFatigueInput.value = record.fatigue || "";
    dom.memoInput.value = record.memo || "";
    dom.detailPainHasInput.value = record.painHas ? "true" : "false";
    dom.painPartInput.value = record.painPart || "";
    dom.painLevelInput.value = record.painLevel === null ? "5" : String(record.painLevel);
    dom.triggerInput.value = record.trigger || "";
    dom.reliefInput.value = record.relief || "";
    updatePainLevelOutput();
    renderDetailChoices();
    updatePainFields();
  }

  function renderDetailChoices() {
    var selectedState = dom.detailStateInput.value;
    var selectedFatigue = Number(dom.detailFatigueInput.value);
    var painHas = dom.detailPainHasInput.value === "true";

    dom.detailStateChoices.innerHTML = STATE_OPTIONS.map(function (option) {
      var selected = selectedState === option.value ? " is-selected" : "";
      return '<button class="choice-card' + selected + '" type="button" data-detail-state="' + escapeAttribute(option.value) + '">' +
        '<span class="choice-title">' + escapeHtml(option.value) + "</span>" +
        "</button>";
    }).join("");

    dom.detailFatigueChoices.innerHTML = FATIGUE_OPTIONS.map(function (option) {
      var selected = selectedFatigue === option.value ? " is-selected" : "";
      return '<button class="choice-card' + selected + '" type="button" data-detail-fatigue="' + option.value + '">' +
        '<span class="choice-title">' + option.value + "</span>" +
        '<span class="choice-desc">' + escapeHtml(option.label) + "</span>" +
        "</button>";
    }).join("");

    dom.painToggleChoices.innerHTML =
      '<button class="choice-card' + (!painHas ? " is-selected" : "") + '" type="button" data-pain-has="false">' +
      '<span class="choice-title">なし</span></button>' +
      '<button class="choice-card' + (painHas ? " is-selected" : "") + '" type="button" data-pain-has="true">' +
      '<span class="choice-title">あり</span></button>';
  }

  function selectQuickState(stateValue) {
    appState.quickDraft.state = stateValue;
    appState.quickStep = 2;
    renderRecordSheet();
  }

  function selectQuickFatigue(fatigueValue) {
    if (!appState.quickDraft.state) {
      showToast("先に状態を選んでください。");
      return;
    }

    appState.quickDraft.fatigue = fatigueValue;
    appState.quickDraft = cloneRecord(saveRecord(appState.editingDate, {
      state: appState.quickDraft.state,
      fatigue: fatigueValue,
      memo: "",
      painHas: false,
      painPart: "",
      painLevel: null,
      trigger: "",
      relief: ""
    }));
    appState.quickStep = 3;
    renderApp();
    renderRecordSheet();
    showToast("基本記録を保存しました。");
    sessionStorage.removeItem("mino-kumoyou.autoPromptDismissed");
  }

  function setDetailState(stateValue) {
    dom.detailStateInput.value = stateValue;
    renderDetailChoices();
  }

  function setDetailFatigue(fatigueValue) {
    dom.detailFatigueInput.value = String(fatigueValue);
    renderDetailChoices();
  }

  function setPainHas(value) {
    dom.detailPainHasInput.value = value ? "true" : "false";
    renderDetailChoices();
    updatePainFields();
  }

  function updatePainFields() {
    var painHas = dom.detailPainHasInput.value === "true";
    dom.painFields.classList.toggle("hidden", !painHas);
  }

  function updatePainLevelOutput() {
    dom.painLevelOutput.textContent = dom.painLevelInput.value;
  }

  function handleDetailSubmit(event) {
    event.preventDefault();

    if (!dom.detailStateInput.value || !dom.detailFatigueInput.value) {
      showToast("状態と疲れ度を選んでください。");
      return;
    }

    var painHas = dom.detailPainHasInput.value === "true";
    saveRecord(appState.editingDate, {
      state: dom.detailStateInput.value,
      fatigue: Number(dom.detailFatigueInput.value),
      memo: cleanText(dom.memoInput.value),
      painHas: painHas,
      painPart: painHas ? cleanText(dom.painPartInput.value) : "",
      painLevel: painHas ? Number(dom.painLevelInput.value) : null,
      trigger: cleanText(dom.triggerInput.value),
      relief: cleanText(dom.reliefInput.value)
    });

    renderApp();
    closeRecordSheet();
    showToast("記録を保存しました。");
  }

  function handleCreateBackup() {
    try {
      var payload = {
        app: "身の空模様",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        records: appState.records,
        preferences: { selectedYear: appState.preferences.selectedYear }
      };
      dom.backupOutput.value = BACKUP_PREFIX + encodeBase64Unicode(JSON.stringify(payload));
      showToast("バックアップ文字列を作成しました。");
    } catch (error) {
      console.error(error);
      showToast("バックアップ作成に失敗しました。");
    }
  }

  function handleCopyBackup() {
    var text = dom.backupOutput.value;
    if (!text) {
      showToast("先にバックアップ文字列を作成してください。");
      return;
    }

    copyText(text)
      .then(function () {
        showToast("バックアップ文字列をコピーしました。");
      })
      .catch(function () {
        showToast("コピーできませんでした。文字列を手動でコピーしてください。");
      });
  }

  function handleRestore() {
    var raw = dom.restoreInput.value.trim();
    if (!raw) {
      setRestoreFeedback("復元する文字列を貼り付けてください。", true);
      return;
    }

    try {
      var restored = parseBackupString(raw);
      if (!window.confirm("現在の保存データに上書きして復元します。実行しますか？")) {
        return;
      }

      appState.records = restored.records;
      appState.preferences = {
        selectedYear: normalizeSelectedYear(restored.preferences.selectedYear)
      };
      persistRecords();
      persistPreferences();
      renderApp();
      closeSettingsSheet();
      setRestoreFeedback("復元しました。", false);
      showToast("バックアップから復元しました。");
      sessionStorage.removeItem("mino-kumoyou.autoPromptDismissed");
    } catch (error) {
      console.error(error);
      setRestoreFeedback("復元できませんでした。文字列が壊れているか、形式が異なります。", true);
    }
  }

  function setRestoreFeedback(message, isError) {
    dom.restoreFeedback.textContent = message;
    dom.restoreFeedback.classList.toggle("is-error", Boolean(isError));
  }

  function changeSelectedYear(offset) {
    var bounds = getYearBounds();
    var nextYear = appState.preferences.selectedYear + offset;
    if (nextYear < bounds.min || nextYear > bounds.max) {
      return;
    }
    appState.preferences.selectedYear = nextYear;
    persistPreferences();
    renderYearButton();
    renderYearPanel();
  }

  function autoOpenTodayIfNeeded() {
    var todayKey = getTodayKey();
    if (getRecord(todayKey)) {
      return;
    }
    if (sessionStorage.getItem("mino-kumoyou.autoPromptDismissed") === "1") {
      return;
    }
    openQuickRecord(todayKey);
  }

  function saveRecord(dateKey, patch) {
    var now = new Date().toISOString();
    var existing = getRecord(dateKey);
    var next = normalizeRecord(
      Object.assign({}, existing || createBlankRecord(dateKey), patch || {}, {
        date: dateKey,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      }),
      true
    );

    if (!next.state || !next.fatigue) {
      throw new Error("state and fatigue are required");
    }

    appState.records[dateKey] = next;
    persistRecords();
    return next;
  }

  function getRecord(dateKey) {
    return appState.records[dateKey] ? cloneRecord(appState.records[dateKey]) : null;
  }

  function loadRecords() {
    var raw = safeStorageGet(STORAGE_KEYS.records);
    if (!raw) {
      return {};
    }

    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }

      var result = {};
      Object.keys(parsed).forEach(function (dateKey) {
        try {
          var record = normalizeRecord(parsed[dateKey], true, dateKey);
          if (record.state && record.fatigue) {
            result[record.date] = record;
          }
        } catch (error) {
          console.warn("skip invalid record", dateKey, error);
        }
      });
      return result;
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  function persistRecords() {
    safeStorageSet(STORAGE_KEYS.records, JSON.stringify(appState.records));
  }

  function loadPreferences() {
    var raw = safeStorageGet(STORAGE_KEYS.preferences);
    if (!raw) {
      return { selectedYear: getCurrentYear() };
    }

    try {
      var parsed = JSON.parse(raw);
      return {
        selectedYear: normalizeSelectedYear(parsed.selectedYear)
      };
    } catch (error) {
      console.error(error);
      return { selectedYear: getCurrentYear() };
    }
  }

  function persistPreferences() {
    safeStorageSet(STORAGE_KEYS.preferences, JSON.stringify(appState.preferences));
  }

  function safeStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(error);
      return "";
    }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(error);
      showToast("保存に失敗しました。ブラウザの空き容量をご確認ください。");
    }
  }

  function normalizeRecord(value, strict, forcedDateKey) {
    var source = value && typeof value === "object" ? value : {};
    var dateKey = forcedDateKey || source.date;
    var fatigueValue = Number(source.fatigue);
    var painLevelValue = source.painLevel === "" || source.painLevel === null || typeof source.painLevel === "undefined"
      ? null
      : Number(source.painLevel);
    var painHas = source.painHas === true || source.painHas === "true";

    if (!isValidDateKey(dateKey)) {
      throw new Error("invalid date");
    }

    var record = {
      date: dateKey,
      state: STATE_OPTIONS.some(function (option) { return option.value === source.state; }) ? source.state : "",
      fatigue: FATIGUE_OPTIONS.some(function (option) { return option.value === fatigueValue; }) ? fatigueValue : null,
      memo: cleanText(source.memo),
      painHas: painHas,
      painPart: painHas ? cleanText(source.painPart) : "",
      painLevel: painHas && !Number.isNaN(painLevelValue) ? clamp(Math.round(painLevelValue), 0, 10) : null,
      trigger: cleanText(source.trigger),
      relief: cleanText(source.relief),
      createdAt: isIsoDate(source.createdAt) ? source.createdAt : new Date().toISOString(),
      updatedAt: isIsoDate(source.updatedAt) ? source.updatedAt : new Date().toISOString()
    };

    if (strict && (!record.state || !record.fatigue)) {
      throw new Error("record is incomplete");
    }

    return record;
  }

  function createBlankRecord(dateKey) {
    return {
      date: dateKey,
      state: "",
      fatigue: null,
      memo: "",
      painHas: false,
      painPart: "",
      painLevel: null,
      trigger: "",
      relief: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
  }

  function getSortedRecords() {
    return Object.keys(appState.records)
      .map(function (key) {
        return cloneRecord(appState.records[key]);
      })
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
  }

  function getMonthSummary(year, month) {
    var records = getSortedRecords().filter(function (record) {
      var parts = splitDateKey(record.date);
      return parts.year === year && parts.month === month + 1;
    });

    return buildSummary(records, year, month);
  }

  function getYearSummary(year) {
    var yearRecords = getSortedRecords().filter(function (record) {
      return splitDateKey(record.date).year === year;
    });
    var months = [];
    var monthIndex = 0;

    while (monthIndex < 12) {
      months.push(getMonthSummary(year, monthIndex));
      monthIndex += 1;
    }

    var summary = buildSummary(yearRecords, year, null);
    summary.months = months;
    summary.memoRecords = yearRecords.filter(hasOptionalMemo);
    summary.painRecords = yearRecords.filter(function (record) {
      return record.painHas;
    });
    return summary;
  }

  function buildSummary(records, year, month) {
    var counts = { "澄": 0, "回復": 0, "濁": 0 };
    var fatigueTotal = 0;
    var memoDays = 0;
    var painDays = 0;

    records.forEach(function (record) {
      counts[record.state] += 1;
      fatigueTotal += record.fatigue;
      if (hasOptionalMemo(record)) {
        memoDays += 1;
      }
      if (record.painHas) {
        painDays += 1;
      }
    });

    return {
      year: year,
      month: month,
      total: records.length,
      counts: counts,
      averageFatigue: records.length ? fatigueTotal / records.length : 0,
      memoDays: memoDays,
      painDays: painDays
    };
  }

  function buildTodaySummary(record) {
    return record.state + "で、疲れ度は" + record.fatigue + " / 5（" + getFatigueLabel(record.fatigue) + "）です。";
  }

  function buildListSummary(record) {
    var pieces = [record.state + " / 疲れ度 " + record.fatigue + "（" + getFatigueLabel(record.fatigue) + "）"];
    if (record.memo) {
      pieces.push(truncateText(record.memo, 26));
    } else if (record.painHas) {
      pieces.push("痛みあり");
    }
    return pieces.join(" ・ ");
  }

  function createStateBadge(stateValue) {
    return '<span class="state-badge" data-state="' + escapeAttribute(stateValue) + '">' + escapeHtml(stateValue) + "</span>";
  }

  function createMetricCard(label, value, sub) {
    return '<div class="metric-card">' +
      '<span class="metric-label">' + escapeHtml(label) + "</span>" +
      '<span class="metric-value">' + escapeHtml(value) + "</span>" +
      '<span class="metric-sub">' + escapeHtml(sub) + "</span>" +
      "</div>";
  }

  function renderStackedBar(counts, total) {
    var html = '<div class="stacked-bar" aria-hidden="true">';

    if (!total) {
      html += '<span class="bar-segment" style="width: 100%; background: rgba(208, 227, 238, 0.64);"></span>';
      html += "</div>";
      return html;
    }

    STATE_OPTIONS.forEach(function (option) {
      var width = (counts[option.value] / total) * 100;
      html += '<span class="bar-segment" data-state="' + escapeAttribute(option.value) + '" style="width: ' + width + '%;"></span>';
    });
    html += "</div>";
    return html;
  }

  function getFatigueLabel(value) {
    var match = FATIGUE_OPTIONS.find(function (option) {
      return option.value === Number(value);
    });
    return match ? match.label : "";
  }

  function getRatioText(count, total) {
    if (!total) {
      return "0%";
    }
    return Math.round((count / total) * 100) + "%";
  }

  function formatAverage(value) {
    var rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(1).replace(".0", "");
  }

  function hasOptionalMemo(record) {
    return Boolean(
      cleanText(record.memo) ||
      cleanText(record.trigger) ||
      cleanText(record.relief) ||
      record.painHas
    );
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function truncateText(text, maxLength) {
    var clean = cleanText(text);
    return clean.length > maxLength ? clean.slice(0, maxLength) + "…" : clean;
  }

  function formatDateLabel(dateKey, withYear) {
    var date = parseDateKey(dateKey);
    var options = withYear
      ? { year: "numeric", month: "long", day: "numeric", weekday: "short" }
      : { month: "long", day: "numeric", weekday: "short" };
    return new Intl.DateTimeFormat("ja-JP", options).format(date);
  }

  function splitDateKey(dateKey) {
    var parts = dateKey.split("-");
    return {
      year: Number(parts[0]),
      month: Number(parts[1]),
      day: Number(parts[2])
    };
  }

  function parseDateKey(dateKey) {
    var parts = splitDateKey(dateKey);
    return new Date(parts.year, parts.month - 1, parts.day);
  }

  function getTodayKey() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function getCurrentYear() {
    return new Date().getFullYear();
  }

  function normalizeSelectedYear(value) {
    var numeric = Number(value);
    var bounds = getYearBounds();
    if (!numeric || Number.isNaN(numeric)) {
      return getCurrentYear();
    }
    return clamp(numeric, bounds.min, bounds.max);
  }

  function getYearBounds() {
    var years = getSortedRecords().map(function (record) {
      return splitDateKey(record.date).year;
    });
    var currentYear = getCurrentYear();
    var minYear = years.length ? Math.min.apply(null, years.concat([currentYear])) - 1 : currentYear;
    var maxYear = currentYear + 1;
    return { min: minYear, max: maxYear };
  }

  function isValidDateKey(value) {
    var text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return false;
    }
    var parts = splitDateKey(text);
    var date = new Date(parts.year, parts.month - 1, parts.day);
    return date.getFullYear() === parts.year &&
      date.getMonth() === parts.month - 1 &&
      date.getDate() === parts.day;
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function showToast(message, duration) {
    var timeout = typeof duration === "number" ? duration : 2600;
    dom.toast.textContent = message;
    dom.toast.classList.remove("hidden");
    window.clearTimeout(appState.toastTimer);
    appState.toastTimer = window.setTimeout(function () {
      dom.toast.classList.add("hidden");
    }, timeout);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      try {
        dom.backupOutput.focus();
        dom.backupOutput.select();
        var success = document.execCommand("copy");
        if (success) {
          resolve();
        } else {
          reject(new Error("copy failed"));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function encodeBase64Unicode(text) {
    return btoa(
      encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, function (_, code) {
        return String.fromCharCode(parseInt(code, 16));
      })
    );
  }

  function decodeBase64Unicode(text) {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(text), function (character) {
          return "%" + character.charCodeAt(0).toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  function parseBackupString(raw) {
    if (raw.indexOf(BACKUP_PREFIX) !== 0) {
      throw new Error("unknown backup prefix");
    }

    var encoded = raw.slice(BACKUP_PREFIX.length);
    var decoded = decodeBase64Unicode(encoded);
    var parsed = JSON.parse(decoded);

    if (!parsed || parsed.app !== "身の空模様" || parsed.schemaVersion !== 1) {
      throw new Error("invalid backup payload");
    }
    if (!parsed.records || typeof parsed.records !== "object" || Array.isArray(parsed.records)) {
      throw new Error("invalid records");
    }

    var restoredRecords = {};
    Object.keys(parsed.records).forEach(function (dateKey) {
      var restored = normalizeRecord(parsed.records[dateKey], true, dateKey);
      restoredRecords[restored.date] = restored;
    });

    return {
      records: restoredRecords,
      preferences: {
        selectedYear: normalizeSelectedYear(
          parsed.preferences && parsed.preferences.selectedYear ? parsed.preferences.selectedYear : getCurrentYear()
        )
      }
    };
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("./sw.js?v=" + APP_VERSION, { scope: "./" })
      .then(function (registration) {
        appState.swRegistration = registration;
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  function getServiceWorkerRegistration() {
    if (!("serviceWorker" in navigator)) {
      return Promise.resolve(null);
    }

    if (appState.swRegistration) {
      return Promise.resolve(appState.swRegistration);
    }

    return navigator.serviceWorker.getRegistration().then(function (registration) {
      appState.swRegistration = registration;
      return registration;
    });
  }

  function handleManualUpdate() {
    if (!window.confirm("キャッシュを削除して最新版を読み込みます。入力データは消えません。実行しますか？")) {
      return;
    }

    showToast("最新版を確認しています…", 3000);
    runManualUpdate().catch(function (error) {
      console.error(error);
      showToast("更新に失敗しました。通信状態をご確認ください。", 3600);
    });
  }

  async function runManualUpdate() {
    var registration = await getServiceWorkerRegistration();

    if (registration) {
      await registration.update();
      if (registration.installing) {
        await waitForWorkerInstallation(registration.installing);
      }

      registration = await getServiceWorkerRegistration();
      if (registration && registration.waiting) {
        var waitingPromise = waitForControllerChange(5000);
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        await waitingPromise;
      }
    }

    await clearStaticCaches();
    await refreshStaticAssets();
    showToast("最新版を読み込みます。", 1800);
    window.setTimeout(function () {
      window.location.reload();
    }, 260);
  }

  function waitForWorkerInstallation(worker) {
    return new Promise(function (resolve, reject) {
      if (!worker) {
        resolve();
        return;
      }

      function handleState() {
        if (worker.state === "installed" || worker.state === "activated") {
          resolve();
        }
        if (worker.state === "redundant") {
          reject(new Error("service worker became redundant"));
        }
      }

      worker.addEventListener("statechange", handleState);
      handleState();
    });
  }

  function waitForControllerChange(timeout) {
    return new Promise(function (resolve) {
      var finished = false;
      var timer = window.setTimeout(done, timeout || 4000);

      function done() {
        if (finished) {
          return;
        }
        finished = true;
        window.clearTimeout(timer);
        resolve();
      }

      navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
    });
  }

  async function clearStaticCaches() {
    if (!("caches" in window)) {
      return;
    }

    var cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(function (name) {
          return name.indexOf(CACHE_PREFIX) === 0;
        })
        .map(function (name) {
          return caches.delete(name);
        })
    );
  }

  async function refreshStaticAssets() {
    var results = await Promise.all(
      APP_ASSET_URLS.map(function (assetUrl) {
        return fetch(assetUrl, { cache: "reload", credentials: "same-origin" })
          .then(function () {
            return true;
          })
          .catch(function () {
            return false;
          });
      })
    );
    var allFailed = results.every(function (result) {
      return result === false;
    });
    if (allFailed) {
      throw new Error("failed to refresh assets");
    }
  }

})();
