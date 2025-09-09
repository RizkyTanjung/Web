// app.js - simple client-side + API wrapper
// CONFIG: ubah API_BASE jika ingin pakai backend
const API_BASE = '/api'; // ganti ke URL backend (contoh: https://api.example.com)
const STORAGE_KEY = 'portal_sekolah_data_v1';
const AUTH_KEY = 'portal_sekolah_auth';

// ---------- helper ----------
function qs(id){ return document.getElementById(id); }
async function safeFetch(url, opts){
  try{
    const res = await fetch(url, opts);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){
    console.warn('safeFetch failed', url, e);
    throw e;
  }
}

// ---------- Local storage fallback ----------
function readLocal(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
function writeLocal(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------- Demo starter data (jika kosong) ----------
function ensureDemoData(){
  let data = readLocal();
  if(!data || data.length===0){
    data = [
      { id: 'smp1', name:'SMA Negeri 1 Bagansiapiapi', address:'Jl. Merdeka 1', phone:'(0766) 123456', vision:'Unggul dalam prestasi', mission:['Pendidikan berkualitas','Lingkungan aman'], logo:'https://via.placeholder.com/400x200?text=SMAN+1' },
      { id: 'smp2', name:'SMP Negeri 2 Example', address:'Jl. Contoh 2', phone:'0812345678', vision:'Cerdas & Berbudaya', mission:['Disiplin','Kreatif'], logo:'https://via.placeholder.com/400x200?text=SMP+2' }
    ];
    writeLocal(data);
  }
}

// ---------- API wrapper with fallback ----------
async function apiGetSchools(){
  // try real API, else fallback to local
  try{
    const json = await safeFetch(`${API_BASE}/schools`);
    if(Array.isArray(json)) return json;
    return readLocal();
  }catch(e){
    return readLocal();
  }
}
async function apiSaveSchool(school){
  // if backend exists try PUT/POST; else local
  try{
    if(school.id){
      await safeFetch(`${API_BASE}/schools/${encodeURIComponent(school.id)}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(school)
      });
    } else {
      await safeFetch(`${API_BASE}/schools`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(school)
      });
    }
    return {ok:true};
  }catch(e){
    // fallback local
    const data = readLocal();
    if(!school.id) school.id = cryptoId();
    const idx = data.findIndex(s=>s.id===school.id);
    if(idx>=0) data[idx] = school; else data.push(school);
    writeLocal(data);
    return {ok:true, local:true};
  }
}
async function apiDeleteSchool(id){
  try{
    await safeFetch(`${API_BASE}/schools/${encodeURIComponent(id)}`, { method:'DELETE' });
    return {ok:true};
  }catch(e){
    const data = readLocal().filter(s=>s.id!==id);
    writeLocal(data);
    return {ok:true, local:true};
  }
}

// ---------- small util ----------
function cryptoId(){ return 'id-'+Math.random().toString(36).slice(2,9); }
function toHtmlEscape(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

// ---------- UI: Index page ----------
async function renderIndexPage(){
  ensureDemoData();
  const sel = qs('schoolSelect');
  const cards = qs('cards');
  const list = await apiGetSchools();
  sel.innerHTML = '';
  list.forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    sel.appendChild(opt);
  });
  function renderOne(id){
    const sch = list.find(x=>x.id===id) || list[0];
    cards.innerHTML = '';
    if(!sch) { cards.innerHTML = '<p>Tidak ada data sekolah.</p>'; return;}
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `
      <img class="school-logo" src="${toHtmlEscape(sch.logo||'https://via.placeholder.com/400x200?text=No+Logo')}" alt="Logo ${toHtmlEscape(sch.name)}" />
      <h3>${toHtmlEscape(sch.name)}</h3>
      <div class="school-meta">
        <p><strong>Alamat:</strong> ${toHtmlEscape(sch.address||'-')}</p>
        <p><strong>Telepon:</strong> ${toHtmlEscape(sch.phone||'-')}</p>
        <p><strong>Visi:</strong> ${toHtmlEscape(sch.vision||'-')}</p>
        <p><strong>Misi:</strong> ${(sch.mission || []).map(m=>`<br>• ${toHtmlEscape(m)}`).join('')}</p>
      </div>
    `;
    cards.appendChild(card);
  }
  sel.addEventListener('change', ()=> renderOne(sel.value));
  qs('refreshBtn').addEventListener('click', async ()=> {
    const fresh = await apiGetSchools();
    // update list and re-render
    location.reload();
  });
  // default render
  renderOne(sel.value || list[0]?.id);
}

// ---------- UI: Login page ----------
function setupLoginPage(){
  const form = qs('loginForm');
  const demo = qs('demoBtn');
  const msg = qs('loginMsg');
  function setAuth(token){ localStorage.setItem(AUTH_KEY, token); }
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = qs('email').value.trim();
    const password = qs('password').value;
    // demo client-side auth: replace with real API call to /api/auth/login
    if(email==='admin@example.com' && password==='password123'){
      setAuth('demo-token');
      location.href = 'admin.html';
    } else {
      msg.textContent = 'Kredensial salah (pakai demo: admin@example.com / password123)'; 
    }
  });
  demo.addEventListener('click', ()=> {
    qs('email').value='admin@example.com';
    qs('password').value='password123';
    form.requestSubmit();
  });
}

// ---------- UI: Admin page ----------
async function setupAdminPage(){
  // require auth
  const token = localStorage.getItem(AUTH_KEY);
  if(!token){
    alert('Silakan login dulu. Demo: admin@example.com / password123');
    location.href='login.html';
    return;
  }

  ensureDemoData();
  const selectSchool = qs('selectSchool');
  const form = qs('schoolForm');
  const newBtn = qs('newSchoolBtn');
  const deleteBtn = qs('deleteBtn');
  const previewPublic = qs('previewPublic');
  const logoInput = qs('logoInput');
  const logoPreview = qs('logoPreview');
  const saveMsg = qs('saveMsg');

  let schools = readLocal();
  function populateSelect(){
    selectSchool.innerHTML = '';
    schools.forEach(s=>{
      const o = document.createElement('option'); o.value=s.id; o.textContent=s.name;
      selectSchool.appendChild(o);
    });
  }
  function fillForm(s){
    qs('name').value = s.name||'';
    qs('address').value = s.address||'';
    qs('phone').value = s.phone||'';
    qs('vision').value = s.vision||'';
    qs('mission').value = (s.mission||[]).join(' | ');
    logoPreview.src = s.logo || 'https://via.placeholder.com/400x200?text=No+Logo';
    currentId = s.id;
  }
  function renderPreview(s){
    previewPublic.innerHTML = `
      <div class="card">
        <img class="school-logo" src="${toHtmlEscape(s.logo||'https://via.placeholder.com/400x200?text=No+Logo')}" alt="">
        <h3>${toHtmlEscape(s.name)}</h3>
        <p><strong>Alamat:</strong> ${toHtmlEscape(s.address||'-')}</p>
        <p><strong>Telepon:</strong> ${toHtmlEscape(s.phone||'-')}</p>
        <p><strong>Visi:</strong> ${toHtmlEscape(s.vision||'-')}</p>
        <p><strong>Misi:</strong> ${(s.mission||[]).map(m=>`<br>• ${toHtmlEscape(m)}`).join('')}</p>
      </div>
    `;
  }

  let currentId = null;
  schools = readLocal();
  populateSelect();
  if(schools.length) fillForm(schools[0]), renderPreview(schools[0]);

  selectSchool.addEventListener('change', ()=>{
    const s = schools.find(x=>x.id===selectSchool.value);
    if(s){ fillForm(s); renderPreview(s);}
  });

  newBtn.addEventListener('click', ()=>{
    const s = { id: cryptoId(), name:'Sekolah Baru', address:'', phone:'', vision:'', mission:[], logo:'' };
    schools.push(s); writeLocal(schools); populateSelect();
    selectSchool.value = s.id; fillForm(s); renderPreview(s);
  });

  logoInput.addEventListener('change', async (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    // read as data URL (for demo); for production upload to server and store URL
    const reader = new FileReader();
    reader.onload = ()=> {
      logoPreview.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      id: currentId || cryptoId(),
      name: qs('name').value.trim(),
      address: qs('address').value.trim(),
      phone: qs('phone').value.trim(),
      vision: qs('vision').value.trim(),
      mission: qs('mission').value.split('|').map(s=>s.trim()).filter(Boolean),
      logo: logoPreview.src
    };
    // save to API or local
    const res = await apiSaveSchool(payload);
    // update local list and UI
    schools = readLocal();
    const idx = schools.findIndex(s=>s.id===payload.id);
    if(idx>=0) schools[idx] = payload; else schools.push(payload);
    writeLocal(schools);
    populateSelect();
    selectSchool.value = payload.id;
    renderPreview(payload);
    saveMsg.textContent = res.local ? 'Tersimpan di browser (localStorage).' : 'Tersimpan ke server.';
    setTimeout(()=> saveMsg.textContent='', 3500);
  });

  deleteBtn.addEventListener('click', async ()=>{
    if(!currentId) return;
    if(!confirm('Hapus sekolah ini?')) return;
    await apiDeleteSchool(currentId);
    schools = readLocal();
    populateSelect();
    if(schools.length){ selectSchool.value = schools[0].id; fillForm(schools[0]); renderPreview(schools[0]); }
    else { form.reset(); previewPublic.innerHTML=''; }
  });

  qs('logoutBtn')?.addEventListener('click', ()=>{
    localStorage.removeItem(AUTH_KEY);
    location.href='login.html';
  });
}

// ---------- Router-like boot ----------
document.addEventListener('DOMContentLoaded', ()=>{
  const path = location.pathname.split('/').pop();
  if(path === '' || path === 'index.html') renderIndexPage();
  else if(path === 'login.html') setupLoginPage();
  else if(path === 'admin.html') setupAdminPage();
});