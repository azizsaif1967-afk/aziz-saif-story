/* ACE MC · AI Workforce-Brief Assistant
   Client-side template engine.
   Given a preset role + 4 answers (location / headcount / timeline / contract),
   composes a tailored UAE-compliant staffing brief.
*/
(function(){
  "use strict";

  const FORM_ENDPOINT = "https://formsubmit.co/ajax/aftab@acemcdubai.com";

  // ---------- Role library ----------
  // Each preset provides: label, role-title(s), certifications, typical package,
  // goals, extras. The composer stitches these with the wizard answers.
  const ROLES = {
    construction: {
      label: "Construction crew",
      roles: "foremen, steel fixers, carpenters, masons, MEP helpers and general labour",
      compliance: "MOHRE work permits, labour insurance, ICAD/ADCD or Dubai Municipality safety passport, medical fitness and Emirates ID",
      certifications: "valid third-party safety passport (OSHAD, Dubai Municipality, ADCD, Nakheel or equivalent), first-aid and working-at-heights for supervisors",
      shift: "6-day single shift, occasional night shift with overtime as per Federal Decree-Law No. 33",
      extras: "accommodation, transport, meals allowance, PPE issued at employer cost",
      goal: "Mobilise a compliant crew on site within the timeline with zero delays on HSE induction."
    },
    warehouse: {
      label: "Warehouse team",
      roles: "warehouse supervisors, inventory controllers, forklift operators, pickers/packers and loaders",
      compliance: "MOHRE work permits, forklift licences (RTA / Dubai Municipality), Dubai Trade / ADNOC / free-zone gate passes as applicable",
      certifications: "valid forklift licence, manual-handling training, WMS familiarity (SAP EWM, Manhattan, Infor or Oracle) for supervisors",
      shift: "rotating 8-hour shifts, 6 days a week, cycle-count weekends",
      extras: "accommodation, transport, meal allowance, PPE and safety shoes",
      goal: "Hit 99.5% inventory accuracy and sub-24-hour order turnaround within the first 60 days."
    },
    hospitality: {
      label: "Hospitality staff",
      roles: "front-office agents, F&B servers, commis chefs, housekeeping attendants, guest-experience leads",
      compliance: "MOHRE work permits, Dubai Tourism / Abu Dhabi DCT hospitality licensing, food-handler cards, basic food hygiene (PIC Level 2)",
      certifications: "OPERA PMS / Micros Simphony familiarity, HACCP awareness for F&B, customer-service English (B2+) and Arabic-speaking mix",
      shift: "split shifts covering breakfast / lunch / dinner peaks, 6 days a week with one rest day",
      extras: "accommodation, transport, two meals per shift, service-charge pool, uniform",
      goal: "Lift guest-satisfaction scores by 10 points and reduce first-year attrition below 18%."
    },
    facility: {
      label: "Facility technicians",
      roles: "multi-skilled FM technicians (HVAC, electrical, plumbing, BMS), shift engineers and an operations supervisor",
      compliance: "ADDC / DEWA certifications as applicable, ESMA, third-party safety passport",
      certifications: "HVAC refrigerant handling licence, electrical competence (LV/MV), BMS familiarity (Honeywell/Siemens/JCI), CAFM experience strongly preferred",
      shift: "24/7 cover with day/night rotation, on-call allowance for out-of-hours",
      extras: "company mobile, tools provided, on-call allowance, transport",
      goal: "Reduce reactive SLA breach rate below 5% and build a healthy PPM compliance score above 95%."
    },
    executive: {
      label: "Executive search",
      roles: "C-level, director-level or senior functional leadership role",
      compliance: "full confidentiality and NDA, board and shareholder approvals on the role brief, UAE visa/relocation support where applicable",
      certifications: "target candidate profile: 15+ years sector experience, GCC exposure, Arabic language an advantage, proven P&L or functional leadership",
      shift: "standard executive hours with travel as required",
      extras: "executive package incl. bonus, LTI, family benefits, schooling allowance, relocation support",
      goal: "Deliver a confidential shortlist of 4&ndash;6 qualified candidates within 6&ndash;8 weeks."
    },
    custom: {
      label: "Custom staffing brief",
      roles: "[describe the roles here]",
      compliance: "[list relevant UAE compliance requirements]",
      certifications: "[required certifications / systems exposure]",
      shift: "[shift pattern and working hours]",
      extras: "[accommodation, transport, allowances, equipment]",
      goal: "[primary business outcome you want this hire to deliver]"
    }
  };

  // ---------- Brief composer ----------
  function composeBrief(roleKey, a){
    const R = ROLES[roleKey] || ROLES.custom;
    // phrase timeline nicely
    const tl = a.timeline.toLowerCase();
    const timelinePhrase =
      tl.includes("this week")   ? "Mobilisation: this week &mdash; initial candidates within 48 hours."
      : tl.includes("2 weeks")   ? "Mobilisation: initial candidates within 2 weeks, balance within 4 weeks."
      : tl.includes("1 month")   ? "Mobilisation: initial cohort in 3 weeks, full headcount within 6 weeks."
      : tl.includes("1–3 months")|| tl.includes("1&ndash;3 months") ? "Mobilisation: staged intake across 1&ndash;3 months."
      :                            "Mobilisation: flexible &mdash; staged intake to be agreed.";

    // split executive vs operational
    const isExec = roleKey === "executive";

    const lines = [];
    lines.push(`Subject: ${R.label} — ${a.location}`);
    lines.push("");
    lines.push(`We need to hire ${a.positions} ${R.roles}.`);
    lines.push("");
    lines.push(`Location: ${a.location} ${isExec ? "(UAE-based or relocation candidate)" : "— site/office"}.`);
    lines.push(`Headcount: ${a.positions}.`);
    lines.push(`Timeline: ${a.timeline}. ${timelinePhrase}`);
    lines.push(`Contract: ${a.contract} under UAE Federal Decree-Law No. 33 of 2021.`);
    lines.push("");
    lines.push(`Compliance: ${R.compliance}.`);
    lines.push(`Required certifications / experience: ${R.certifications}.`);
    if (!isExec) {
      lines.push(`Working pattern: ${R.shift}.`);
      lines.push(`Extras: ${R.extras}.`);
    } else {
      lines.push(`Package: ${R.extras}.`);
    }
    lines.push("");
    lines.push(`Goal: ${R.goal}`);
    lines.push("");
    lines.push("Please revert with a shortlist, proposed start dates and a fixed-scope quote.");
    // Convert HTML entities used above (&mdash; &ndash;) into real UTF-8 characters
    return lines.join("\n")
      .replace(/&mdash;/g,"—")
      .replace(/&ndash;/g,"–")
      .replace(/&amp;/g,"&");
  }

  // ---------- DOM refs ----------
  const chips     = document.querySelectorAll(".chip");
  const briefBox  = document.getElementById("briefBox");
  const charCount = document.getElementById("charCount");
  const aiBadge   = document.getElementById("aiBadge");
  const aiBtn     = document.getElementById("aiDraftBtn");
  const clearBtn  = document.getElementById("clearBtn");
  const hireForm  = document.getElementById("hireForm");
  const status    = document.getElementById("submitStatus");
  const preset    = document.getElementById("selectedPreset");

  // Wizard refs
  const wiz        = document.getElementById("aiWizard");
  const wizSteps   = wiz.querySelectorAll(".wiz-step");
  const wizDots    = wiz.querySelectorAll(".wiz-dot");
  const wizBack    = wiz.querySelector(".wiz-back");
  const wizHint    = wiz.querySelector(".wiz-hint");

  // State
  let selectedRole = null;
  const answers = { location:"", positions:"", timeline:"", contract:"" };
  let currentStep = 1;

  // ---------- UI helpers ----------
  function updateCount(){
    const n = briefBox.value.length;
    charCount.textContent = n ? (n + " chars") : "0 chars";
  }
  briefBox.addEventListener("input", () => { updateCount(); aiBadge.hidden = true; });

  chips.forEach(c => c.addEventListener("click", () => {
    chips.forEach(x => x.classList.remove("active"));
    c.classList.add("active");
    selectedRole = c.dataset.role;
    preset.value = ROLES[selectedRole].label;
    aiBtn.disabled = false;
  }));

  clearBtn.addEventListener("click", () => {
    briefBox.value = "";
    updateCount();
    aiBadge.hidden = true;
    chips.forEach(x => x.classList.remove("active"));
    selectedRole = null;
    preset.value = "";
    aiBtn.disabled = true;
  });

  aiBtn.addEventListener("click", () => {
    if (!selectedRole) return;
    openWizard();
  });

  // ---------- Wizard ----------
  function openWizard(){
    currentStep = 1;
    answers.location = answers.positions = answers.timeline = answers.contract = "";
    showStep(1);
    wiz.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeWizard(){
    wiz.classList.remove("open");
    document.body.style.overflow = "";
  }
  function showStep(n){
    currentStep = n;
    wizSteps.forEach(s => s.hidden = (parseInt(s.dataset.step) !== n));
    wizDots.forEach((d,i) => d.classList.toggle("active", i < n));
    wizBack.hidden = (n === 1);
    wizHint.textContent = (n < 4) ? "Pick an option to continue →" : "Final step — drafting your brief…";
  }
  wiz.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeWizard();
    if (e.target.classList.contains("wiz-choice")) {
      const val = e.target.dataset.val;
      if (currentStep === 1) answers.location  = val;
      if (currentStep === 2) answers.positions = val;
      if (currentStep === 3) answers.timeline  = val;
      if (currentStep === 4) {
        answers.contract = val;
        // DRAFT NOW
        const draft = composeBrief(selectedRole, answers);
        briefBox.value = draft;
        updateCount();
        aiBadge.hidden = false;
        // also auto-fill corresponding contact dropdowns
        const urgencySel = hireForm.querySelector("select[name='urgency']");
        const positionsSel = hireForm.querySelector("select[name='positions']");
        if (urgencySel)   urgencySel.value   = mapUrgency(answers.timeline);
        if (positionsSel) positionsSel.value = mapPositions(answers.positions);
        closeWizard();
        briefBox.focus();
        briefBox.setSelectionRange(0,0);
        briefBox.scrollTop = 0;
        return;
      }
      showStep(currentStep + 1);
    }
    if (e.target.classList.contains("wiz-back")) {
      if (currentStep > 1) showStep(currentStep - 1);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeWizard(); });

  function mapUrgency(t){
    const s = t.toLowerCase();
    if (s.includes("this week"))  return "This week";
    if (s.includes("2 weeks"))    return "Within 2 weeks";
    if (s.includes("1 month"))    return "Within 1 month";
    if (s.includes("1") && s.includes("3")) return "1–3 months";
    return "";
  }
  function mapPositions(p){
    if (/^\d+$/.test(p)) return "1";
    if (p.includes("2")) return "2–5";
    if (p.includes("6")) return "6–20";
    if (p.includes("21")) return "21–50";
    if (p.includes("51") || p.includes("50+")) return "51–200";
    if (p.includes("200")) return "200+";
    return "";
  }

  // ---------- Form submit ----------
  hireForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = hireForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    status.textContent = "Sending…";
    const data = Object.fromEntries(new FormData(hireForm).entries());
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("send failed");
      status.innerHTML = "✓ Brief sent. Dr. Aftab's team will reply within one business day.";
      hireForm.reset();
      chips.forEach(x => x.classList.remove("active"));
      aiBtn.disabled = true;
      aiBadge.hidden = true;
      updateCount();
    } catch (err) {
      const body = encodeURIComponent(
        `Preset: ${data.selected_preset}\n\n${data.brief}\n\n— —\nName: ${data.name}\nCompany: ${data.company}\nEmail: ${data.email}\nMobile: ${data.mobile}\nPositions: ${data.positions}\nUrgency: ${data.urgency}`
      );
      window.location.href = `mailto:aftab@acemcdubai.com?subject=New%20staffing%20brief%20(${encodeURIComponent(data.selected_preset||"custom")})&body=${body}`;
      status.textContent = "Could not reach the form server — opening your email client as a fallback.";
      submitBtn.disabled = false;
    }
  });

  updateCount();
})();
