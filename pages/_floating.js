// Shared floating-template JS
// Top nav scroll state
window.addEventListener('scroll',()=>{
  const n=document.getElementById('topNav');
  if(n)n.classList.toggle('scrolled',window.scrollY>40);
});

// Reveal on scroll
const io=new IntersectionObserver((entries)=>{
  entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}});
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Side-nav active dot
const chapters=[...document.querySelectorAll('.chapter')];
const dots=[...document.querySelectorAll('.side-nav-dot')];
if(chapters.length && dots.length){
  const activeIO=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        const idx=chapters.indexOf(e.target);
        dots.forEach((d,i)=>d.classList.toggle('active',i===idx));
      }
    });
  },{threshold:.5});
  chapters.forEach(c=>activeIO.observe(c));
}

// Lightbox (opt-in by passing a pages array via window.LB_PAGES)
(function(){
  const lb=document.getElementById('lb');
  if(!lb)return;
  const img=document.getElementById('lbImg');
  const counter=document.getElementById('lbCounter');
  const pages=window.LB_PAGES||[];
  let idx=0;
  window.openLb=function(i){idx=i;show();lb.classList.add('open');document.body.style.overflow='hidden'};
  window.closeLb=function(){lb.classList.remove('open');document.body.style.overflow=''};
  window.nextLb=function(){idx=(idx+1)%pages.length;show()};
  window.prevLb=function(){idx=(idx-1+pages.length)%pages.length;show()};
  function show(){if(!pages.length)return;img.src=pages[idx];if(counter)counter.textContent=(idx+1)+' / '+pages.length}
  lb.addEventListener('click',e=>{if(e.target.id==='lb')closeLb()});
  document.addEventListener('keydown',e=>{
    if(!lb.classList.contains('open'))return;
    if(e.key==='Escape')closeLb();
    if(e.key==='ArrowRight')nextLb();
    if(e.key==='ArrowLeft')prevLb();
  });
})();
