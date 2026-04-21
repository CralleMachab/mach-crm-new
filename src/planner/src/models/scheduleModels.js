export function createEmptySandboxProject(projectId = "sandbox") {
  const calendarId = `cal_${projectId}`;

  // Huvudtidplan + underplaner (Mark/Bygg/EL/VVS/Vent/Övrigt)
  const schedules = [
    { id: `sch_${projectId}_master`, name: "Huvudtidplan", type: "master", trade: null },
    { id: `sch_${projectId}_mark`, name: "Mark", type: "trade", trade: "MARK" },
    { id: `sch_${projectId}_bygg`, name: "Bygg", type: "trade", trade: "BYGG" },
    { id: `sch_${projectId}_el`, name: "EL", type: "trade", trade: "EL" },
    { id: `sch_${projectId}_vvs`, name: "VVS", type: "trade", trade: "VVS" },
    { id: `sch_${projectId}_vent`, name: "Vent", type: "trade", trade: "VENT" },
    { id: `sch_${projectId}_ovr`, name: "Övrigt", type: "trade", trade: "OVRIGT" }
  ];

  // Enkel kalender (helger ej arbetsdag). Helgdagar/semester lägger vi till i nästa steg.
  const calendars = {
    [calendarId]: {
      id: calendarId,
      name: "Projektkalender",
      timezone: "Europe/Stockholm",
      workingPattern: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
      nonWorkingDates: [],
      vacationRanges: []
    }
  };

  const schedulesMap = {};
  for (const s of schedules) {
    schedulesMap[s.id] = {
      ...s,
      projectId,
      calendarId,
      frame: { mode: s.type === "master" ? "manual" : "auto", start: null, end: null },
      locked: false,
      note: ""
    };
  }

  // Inga aktiviteter än – det lägger vi till efter att detta fungerar.
    // Startdata: några exempelrader så du ser att allt fungerar
  const tasks = {
    // BYGG
    tsk_bygg_001: {
      id: "tsk_bygg_001",
      scheduleId: `sch_${projectId}_bygg`,
      sortIndex: 10,
      name: "Betonggjutning",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-01-12",
      durationWorkdays: 5
    },
    tsk_bygg_002: {
      id: "tsk_bygg_002",
      scheduleId: `sch_${projectId}_bygg`,
      sortIndex: 20,
      name: "Stommontage",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-01-20",
      durationWorkdays: 15
    },

    // MARK
    tsk_mark_001: {
      id: "tsk_mark_001",
      scheduleId: `sch_${projectId}_mark`,
      sortIndex: 10,
      name: "Schakt",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-01-08",
      durationWorkdays: 7
    },
        // EL
    tsk_el_001: {
      id: "tsk_el_001",
      scheduleId: `sch_${projectId}_el`,
      sortIndex: 10,
      name: "El - Grovdragning",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-02-10",
      durationWorkdays: 5
    },
    tsk_el_002: {
      id: "tsk_el_002",
      scheduleId: `sch_${projectId}_el`,
      sortIndex: 20,
      name: "El - Slutmontage",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-02-20",
      durationWorkdays: 4
    },

    // VVS
    tsk_vvs_001: {
      id: "tsk_vvs_001",
      scheduleId: `sch_${projectId}_vvs`,
      sortIndex: 10,
      name: "VVS - Rördragning",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-02-12",
      durationWorkdays: 6
    },

    // Vent
    tsk_vent_001: {
      id: "tsk_vent_001",
      scheduleId: `sch_${projectId}_vent`,
      sortIndex: 10,
      name: "Vent - Kanalmontage",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-02-15",
      durationWorkdays: 7
    },

    // Övrigt
    tsk_ovr_001: {
      id: "tsk_ovr_001",
      scheduleId: `sch_${projectId}_ovr`,
      sortIndex: 10,
      name: "Dokumentation",
      note: "",
      dateMode: "WORKDAYS",
      start: "2026-03-04",
      durationWorkdays: 3
    }

  };

  return { projectId, calendarId, calendars, schedules: schedulesMap, tasks };
}