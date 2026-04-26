/* ACE MC · Download Gate
   Usage in any blog:
     <button class="dl-gate" data-pdf="../blogs-pdf/AMC-Culture.pdf" data-title="AMC · Culture — poor vs great">Download PDF</button>
     <script src="../download-gate.js" defer></script>
   On submit: POSTs the captured lead to FormSubmit (email → aftab@acemcdubai.com)
   then triggers the PDF download.
*/
(function(){
  const FORM_ENDPOINT = "https://formsubmit.co/ajax/aftab@acemcdubai.com";

  function mount(){
    if (document.getElementById("dl-gate-modal")) return;
    const wrap = document.createElement("div");
    wrap.id = "dl-gate-modal";
    wrap.innerHTML = `
      <div class="dlg-backdrop" data-close></div>
      <div class="dlg-card" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <button class="dlg-close" data-close aria-label="Close">×</button>
        <div class="dlg-kicker">◆ Download Whitepaper</div>
        <h2 id="dlg-title" class="dlg-title">Get the <em>full PDF</em>.</h2>
        <p class="dlg-lede" id="dlg-lede">Tell us who you are and we'll send you the PDF — plus a short follow-up from Dr. Aftab.</p>
        <form class="dlg-form" novalidate>
          <label>Your name<input type="text" name="name" required autocomplete="name" placeholder="Full name"/></label>
          <label>Company<input type="text" name="company" required autocomplete="organization" placeholder="Company"/></label>
          <div class="dlg-row">
            <label>Work email<input type="email" name="email" required autocomplete="email" placeholder="you@company.com"/></label>
            <label>Mobile<input type="tel" name="mobile" required autocomplete="tel" placeholder="+971 50 000 0000"/></label>
          </div>
          <label>No. of employees
            <select name="employees" required>
              <option value="">Select…</option>
              <option>1 – 9</option>
              <option>10 – 49</option>
              <option>50 – 199</option>
              <option>200 – 999</option>
              <option>1,000+</option>
            </select>
          </label>
          <label class="dlg-check"><input type="checkbox" name="consent" required/> I agree to receive the PDF and occasional insights from ACE MC.</label>
          <!-- FormSubmit hidden controls -->
          <input type="hidden" name="_subject" value="New whitepaper download · ACE MC website"/>
          <input type="hidden" name="_template" value="table"/>
          <input type="hidden" name="_captcha" value="false"/>
          <input type="hidden" name="whitepaper" value=""/>
          <input type="hidden" name="source_page" value=""/>
          <button class="dlg-submit" type="submit">
            <span class="dlg-submit-label">Email me the PDF</span>
            <svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
          </button>
          <div class="dlg-status" aria-live="polite"></div>
        </form>
      </div>
    `;
    document.body.appendChild(wrap);

    // close handlers
    wrap.addEventListener("click", (e) => {
      if (e.target.dataset.close !== undefined) close();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    const form = wrap.querySelector(".dlg-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".dlg-submit");
      const status = form.querySelector(".dlg-status");
      btn.disabled = true;
      btn.querySelector(".dlg-submit-label").textContent = "Sending…";
      status.textContent = "";

      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error("send failed");
        // trigger download
        const pdf = wrap.dataset.pdf;
        if (pdf) {
          const a = document.createElement("a");
          a.href = pdf;
          a.download = pdf.split("/").pop();
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        status.innerHTML = "✓ Sent. Your PDF is downloading. Dr. Aftab's office will follow up within one business day.";
        btn.querySelector(".dlg-submit-label").textContent = "Done";
        setTimeout(close, 2600);
      } catch (err) {
        // graceful fallback: mailto so the lead still reaches the inbox
        const body = encodeURIComponent(
          `Whitepaper: ${data.whitepaper}\nSource: ${data.source_page}\n\nName: ${data.name}\nCompany: ${data.company}\nEmail: ${data.email}\nMobile: ${data.mobile}\nEmployees: ${data.employees}`
        );
        window.location.href = `mailto:aftab@acemcdubai.com?subject=New%20whitepaper%20request%20(${encodeURIComponent(data.whitepaper)})&body=${body}`;
        status.textContent = "Could not reach the form server — opening your email client as a fallback.";
        btn.disabled = false;
        btn.querySelector(".dlg-submit-label").textContent = "Email me the PDF";
      }
    });
  }

  function open(pdf, title){
    mount();
    const wrap = document.getElementById("dl-gate-modal");
    wrap.dataset.pdf = pdf || "";
    wrap.querySelector("input[name='whitepaper']").value = title || "";
    wrap.querySelector("input[name='source_page']").value = location.pathname;
    wrap.querySelector("#dlg-lede").innerHTML = `Tell us who you are and we'll send you <strong>${title||"the PDF"}</strong> — plus a short follow-up from Dr. Aftab.`;
    wrap.classList.add("open");
    document.body.style.overflow = "hidden";
    setTimeout(() => wrap.querySelector("input[name='name']").focus(), 80);
  }
  function close(){
    const wrap = document.getElementById("dl-gate-modal");
    if (wrap) wrap.classList.remove("open");
    document.body.style.overflow = "";
  }

  // Bind to any .dl-gate button/link
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".dl-gate");
    if (!el) return;
    e.preventDefault();
    open(el.dataset.pdf, el.dataset.title);
  });

  // Expose for manual calls if needed
  window.AMCDownloadGate = { open, close };
})();
