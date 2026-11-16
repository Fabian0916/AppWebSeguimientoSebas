// Capa de datos: Supabase (producción) o localStorage (modo demo)
(function () {
  const cfg = window.APP_CONFIG;
  const demo = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;
  const sb = demo ? null : window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const LS_R = "bebe_demo_registros";
  const LS_E = "bebe_demo_enlaces";
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } };
  const lsSet = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };

  function newToken() {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function paged(build) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await build().range(from, from + 999);
      if (error) throw error;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  }

  const inRange = (r, d, h) => r.fecha >= d && r.fecha <= h;

  window.DB = {
    demo,

    async session() {
      if (demo) return { demo: true };
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    async signIn(email, password) {
      if (demo) return;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() { if (!demo) await sb.auth.signOut(); },

    async list(desde, hasta) {
      if (demo) return lsGet(LS_R).filter((r) => inRange(r, desde, hasta)).sort((a, b) => a.fecha.localeCompare(b.fecha));
      return paged(() => sb.from("registros").select("*").gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: true }));
    },
    async listShared(token, desde, hasta) {
      if (demo) return lsGet(LS_E).some((e) => e.token === token && e.activo) ? this.list(desde, hasta) : [];
      return paged(() => sb.rpc("datos_compartidos", { p_token: token, p_desde: desde, p_hasta: hasta }));
    },

    async save(rec) {
      const row = { tipo: rec.tipo, fecha: rec.fecha, datos: rec.datos || {}, nota: rec.nota || null, fotos: rec.fotos || [] };
      if (demo) {
        const all = lsGet(LS_R);
        if (rec.id) {
          const i = all.findIndex((x) => x.id === rec.id);
          if (i >= 0) all[i] = { ...all[i], ...row };
        } else all.push({ id: uid(), creado_en: new Date().toISOString(), ...row });
        lsSet(LS_R, all);
        return;
      }
      const q = rec.id ? sb.from("registros").update(row).eq("id", rec.id) : sb.from("registros").insert(row);
      const { error } = await q;
      if (error) throw error;
    },
    async remove(id) {
      if (demo) { lsSet(LS_R, lsGet(LS_R).filter((x) => x.id !== id)); return; }
      const { error } = await sb.from("registros").delete().eq("id", id);
      if (error) throw error;
    },

    async upload(blob) {
      if (demo) {
        return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      }
      const path = uid() + ".jpg";
      const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      return sb.storage.from("fotos").getPublicUrl(path).data.publicUrl;
    },

    async links() {
      if (demo) return lsGet(LS_E);
      const { data, error } = await sb.from("enlaces").select("*").order("creado_en", { ascending: false });
      if (error) throw error;
      return data;
    },
    async createLink(nombre) {
      const row = { token: newToken(), nombre, activo: true };
      if (demo) { const a = lsGet(LS_E); a.unshift({ ...row, creado_en: new Date().toISOString() }); lsSet(LS_E, a); return row; }
      const { error } = await sb.from("enlaces").insert(row);
      if (error) throw error;
      return row;
    },
    async setLinkActive(token, activo) {
      if (demo) { lsSet(LS_E, lsGet(LS_E).map((e) => (e.token === token ? { ...e, activo } : e))); return; }
      const { error } = await sb.from("enlaces").update({ activo }).eq("token", token);
      if (error) throw error;
    },
    async deleteLink(token) {
      if (demo) { lsSet(LS_E, lsGet(LS_E).filter((e) => e.token !== token)); return; }
      const { error } = await sb.from("enlaces").delete().eq("token", token);
      if (error) throw error;
    },
  };
})();
