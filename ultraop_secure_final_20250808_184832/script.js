/* script.js - homepage logic: supporter ticker, blog preview, UPI copy */

function escapeHTML(str){ if (!str) return ''; return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;'); }


document.addEventListener('DOMContentLoaded', ()=>{
  // copy upi
  const copyBtn = document.getElementById('copy-upi');
  copyBtn.addEventListener('click', ()=>{
    const upi = document.getElementById('upi-id').textContent.trim();
    navigator.clipboard?.writeText(upi).then(()=> alert('UPI copied: ' + upi));
  });

  // inject supporter ticker placeholder (if games added supporter.json exists)
  const placeholder = document.getElementById('support-ticker-placeholder');
  if (placeholder) {
    const div = document.createElement('div');
    div.className = 'support-ticker';
    div.innerHTML = '<div class="support-ticker-track" id="support-ticker-track"><div class="support-ticker-item">Loading supporters…</div></div>';
    placeholder.appendChild(div);
    // load supporters.json
    fetch('supporters.json').then(r=>r.ok?r.json():null).then(data=>{
      if (!data || !Array.isArray(data.supporters)) return;
      const track = document.getElementById('support-ticker-track');
      const items = data.supporters.map(n=>`<div class="support-ticker-item glow">${n}</div>`).join('');
      track.innerHTML = items + items;
      // compute duration
      const computeDuration = ()=>{
        const totalWidth = track.scrollWidth/2;
        const pps = Math.max(60, Math.min(240, window.innerWidth/6));
        const seconds = Math.max(12, Math.ceil(totalWidth/pps));
        track.style.animationDuration = seconds + 's';
      };
      computeDuration();
      window.addEventListener('resize', computeDuration);
      track.addEventListener('mouseenter', ()=> track.style.animationPlayState='paused');
      track.addEventListener('mouseleave', ()=> track.style.animationPlayState='running');
    }).catch(()=>{});
  }

  // load latest blog posts from blog.json (if exists)
  const postsList = document.getElementById('posts-list');
  fetch('blog_posts.json').then(r=>r.ok?r.json():null).then(data=>{
    if (!data || !Array.isArray(data.posts)) { postsList.innerHTML = '<div class="muted">No posts yet</div>'; return; }
    postsList.innerHTML = '';
    data.posts.slice(0,3).forEach(p=>{
      const el = document.createElement('article');
      while(el.firstChild) el.removeChild(el.firstChild);
// Build safe blog preview DOM
const h4 = document.createElement('h4');
const a = document.createElement('a');
a.href = 'blog.html#' + encodeURIComponent(p.slug);
a.textContent = p.title;
h4.appendChild(a);
const pEl = document.createElement('p');
pEl.className = '';
pEl.style.color = 'var(--muted)';
pEl.textContent = p.excerpt;
el.appendChild(h4);
el.appendChild(pEl);
      postsList.appendChild(el);
    });
  }).catch(()=>{ postsList.innerHTML = '<div class="muted">No posts yet</div>'; });
});




/* Rewarded ad placeholder (simulate watch ad) */
function showRewardedAd(onComplete){
  // In production, integrate AdSense/AdMob/IMA here. This simulates a 4s ad with a progress bar.
  const modal = document.createElement('div'); modal.style.position='fixed'; modal.style.inset='0'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.background='rgba(0,0,0,0.6)'; modal.style.zIndex=9999;
  modal.innerHTML = `<div style="background:#0b1220;padding:18px;border-radius:10px;color:white;min-width:320px;text-align:center"><div style="margin-bottom:8px">Ad — watch to get reward</div><div id="adbar" style="height:10px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden"><div id="adprog" style="width:0%;height:100%;background:linear-gradient(90deg,#6c5ce7,#00ffd5)"></div></div><div style="margin-top:10px"><button id="ad-skip" class="btn" style="display:none">Skip</button></div></div>`;
  document.body.appendChild(modal);
  const prog = modal.querySelector('#adprog');
  let t=0; const interval = setInterval(()=>{ t+=100; prog.style.width = Math.min(100, t/4000*100) + '%'; if (t>=4000){ clearInterval(interval); modal.remove(); onComplete && onComplete(); } }, 100);
  modal.querySelector('#ad-skip').addEventListener('click', ()=>{ clearInterval(interval); modal.remove(); onComplete && onComplete(); });
}
