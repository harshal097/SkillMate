import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [session, setSession] = useState(null);
  const [services, setServices] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: '', price: '', location: '' });
  const [email, setEmail] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && session.user) upsertProfile(session.user);
    });

    fetchAll();
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function upsertProfile(user) {
    // create a profile row if not exists
    const payload = { id: user.id, full_name: user.user_metadata?.full_name || user.email, created_at: new Date() };
    await supabase.from('profiles').upsert(payload);
    await fetchProfiles();
  }

  async function fetchProfiles() {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error(error);
      return;
    }
    const map = {};
    (data || []).forEach(p => (map[p.id] = p));
    setProfilesMap(map);
  }

  async function fetchServices() {
    setLoading(true);
    const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
    if (error) console.error(error);
    else setServices(data || []);
    setLoading(false);
  }

  async function fetchAll() {
    await fetchProfiles();
    await fetchServices();
  }

  async function signInWithEmail(e) {
    e.preventDefault();
    if (!email) return alert('Enter email');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) return alert(error.message);
    alert('Check your email for the magic link.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function createService(e) {
    e.preventDefault();
    if (!session?.user) return alert('Sign in first');
    const payload = {
      owner: session.user.id,
      title: form.title,
      description: form.description,
      category: form.category,
      price: form.price ? Number(form.price) : null,
      location: form.location || ''
    };
    const { error } = await supabase.from('services').insert([payload]);
    if (error) return alert('Error: ' + error.message);
    setForm({ title: '', description: '', category: '', price: '', location: '' });
    fetchAll();
  }

  async function markInterest(service_id) {
    if (!session?.user) return alert('Sign in to show interest');
    const payload = { service_id, user_id: session.user.id, message: 'Interested via campus app' };
    const { error } = await supabase.from('interests').insert([payload]);
    if (error) return alert('Error: ' + error.message);
    alert('Interest recorded — owner can view it.');
  }

  const filtered = services.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.title || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, Arial' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>CampusSkill — College Skill & Service Marketplace</h1>
        <div>
          {session?.user ? (
            <>
              <span style={{ marginRight: 8 }}>{session.user.email}</span>
              <button onClick={signOut}>Sign out</button>
            </>
          ) : (
            <form onSubmit={signInWithEmail} style={{ display: 'inline' }}>
              <input placeholder="your.email@college.edu" value={email} onChange={e => setEmail(e.target.value)} style={{ marginRight: 8 }} />
              <button type="submit">Sign in</button>
            </form>
          )}
        </div>
      </header>

      <section style={{ marginTop: 20 }}>
        <input placeholder="Search services, categories, keywords" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </section>

      <main style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginTop: 20 }}>
        <div>
          <h2>Available Services</h2>
          {loading ? <p>Loading...</p> : filtered.length === 0 ? <p>No services yet. Post one on the right.</p> : null}
          {filtered.map(s => {
            const ownerProfile = profilesMap[s.owner];
            return (
              <div key={s.id} style={{ border: '1px solid #ddd', padding: 12, marginBottom: 8 }}>
                <h3>{s.title} <small style={{ color: '#666' }}>₹{s.price ?? '—'}</small></h3>
                <p style={{ margin: '6px 0' }}>{s.description}</p>
                <div style={{ fontSize: 12, color: '#666' }}>Category: {s.category || 'General'} • Location: {s.location || 'Campus'}</div>
                <div style={{ marginTop: 8 }}>
                  <small>Owner: {ownerProfile ? ownerProfile.full_name || ownerProfile.id : s.owner}</small>
                </div>
                <div style={{ marginTop: 10 }}>
                  <button onClick={() => markInterest(s.id)}>I'M INTERESTED</button>
                </div>
              </div>
            );
          })}
        </div>

        <aside style={{ border: '1px solid #eee', padding: 12 }}>
          <h3>Post a service</h3>
          {!session?.user ? <p>Please sign in to post.</p> : (
            <form onSubmit={createService}>
              <div style={{ marginBottom: 8 }}><input required placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><textarea required placeholder="Short description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><input placeholder="Category (e.g. Tutoring)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><input placeholder="Price (INR)" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              <div style={{ marginBottom: 8 }}><input placeholder="Pickup / Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <button type="submit">Post Service</button>
            </form>
          )}
          <hr style={{ margin: '12px 0' }} />
          <p style={{ fontSize: 13, color: '#666' }}>Tip: use UPI for payments and post a screenshot in chat for safety.</p>
        </aside>
      </main>
    </div>
  );
}
