/* blog.js - simple local blog system using blog_posts.json */
document.addEventListener('DOMContentLoaded', ()=>{
  const postsEl = document.getElementById('posts');
  const titleInput = document.getElementById('post-title');
  const contentInput = document.getElementById('post-content');
  const saveBtn = document.getElementById('save-post');

  // load posts from blog_posts.json if exists, otherwise from localStorage
  const load = async ()=>{
    let data = null;
    try {
      const res = await fetch('blog_posts.json');
      if (res.ok) data = await res.json();
    } catch(e){}
    if (!data) {
      const raw = localStorage.getItem('ultraop_blog_posts');
      data = raw ? JSON.parse(raw) : {posts:[]};
    }
    renderPosts(data.posts || []);
  };
  
function escapeHTML(str){
  if (!str) return '';
  return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;").replaceAll('\n','<br>');
}

const renderPosts = (posts)=>{
    if (!posts.length) { postsEl.innerHTML = '<div class="muted">No posts yet</div>'; return; }
    postsEl.innerHTML = '';
    posts.slice().reverse().forEach(p=>{
      const art = document.createElement('article');
      while(art.firstChild) art.removeChild(art.firstChild);
const titleEl = document.createElement('h3'); titleEl.textContent = p.title;
const dateEl = document.createElement('div'); dateEl.style.color = 'var(--muted)'; dateEl.textContent = p.date;
const contentEl = document.createElement('div'); contentEl.innerHTML = escapeHTML(p.content);
art.appendChild(titleEl); art.appendChild(dateEl); art.appendChild(contentEl);
      postsEl.appendChild(art);
    });
  };
  saveBtn.addEventListener('click', ()=>{
    const title = titleInput.value.trim(); const content = contentInput.value.trim();
    if (!title || !content) return alert('Title and content required');
    const raw = localStorage.getItem('ultraop_blog_posts');
    const data = raw ? JSON.parse(raw) : {posts:[]};
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    data.posts.push({title: title, content: content, slug: slug, date: new Date().toLocaleString(), excerpt: content.slice(0,160)});
    localStorage.setItem('ultraop_blog_posts', JSON.stringify(data));
    alert('Saved locally. To publish site-wide, upload to blog_posts.json or connect a CMS.');
    titleInput.value=''; contentInput.value=''; load();
  });

  load();
});