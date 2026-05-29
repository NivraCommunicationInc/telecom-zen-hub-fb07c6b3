import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Briefcase,
  MapPin,
  Search,
  Heart,
  Zap,
  Users,
  TrendingUp,
  Shield,
  GraduationCap,
  Coffee,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Send,
  Sparkles,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { backendClient as supabase } from "@/integrations/backend";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead, { SEO_DATA } from "@/components/SEOHead";

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string | null;
}

const ALL = "Tous";

const Careers = () => {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<string>(ALL);
  const [location, setLocation] = useState<string>(ALL);

  const benefits = [
    { icon: TrendingUp, title: "Rémunération compétitive", description: "Salaires alignés sur le marché télécom canadien, révisés chaque année." },
    { icon: Heart, title: "Assurance complète", description: "Santé, dentaire et vision pour vous et votre famille." },
    { icon: GraduationCap, title: "Formation continue", description: "Budget annuel de développement et certifications professionnelles." },
    { icon: Coffee, title: "Équilibre & bien-être", description: "Horaires flexibles, télétravail possible, programme santé mentale." },
    { icon: Users, title: "Culture collaborative", description: "Équipes petites, autonomes et bienveillantes. Impact rapide." },
    { icon: Shield, title: "Stabilité québécoise", description: "Entreprise locale en pleine croissance, fière de bâtir au Québec." },
  ];

  const values = [
    { icon: Shield, title: "Intégrité", description: "On dit ce qu'on fait, on fait ce qu'on dit. Pas de petits caractères." },
    { icon: Zap, title: "Excellence", description: "Chaque détail compte — du code à l'expérience client." },
    { icon: Users, title: "Collaboration", description: "On gagne ensemble. Personne n'avance seul chez Nivra." },
  ];

  const hiringSteps = [
    { step: "01", title: "Candidature", description: "Vous postulez en quelques minutes via notre formulaire en ligne." },
    { step: "02", title: "Premier échange", description: "Un appel découverte avec notre équipe recrutement (~30 min)." },
    { step: "03", title: "Entrevue IA & technique", description: "Mise en situation et entrevue avec votre futur·e gestionnaire." },
    { step: "04", title: "Offre & accueil", description: "Une offre claire, un onboarding structuré, vous démarrez l'esprit léger." },
  ];

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, department, location, type, description")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Job[];
    },
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs?.forEach((j) => j.department && set.add(j.department));
    return [ALL, ...Array.from(set).sort()];
  }, [jobs]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    jobs?.forEach((j) => j.location && set.add(j.location));
    return [ALL, ...Array.from(set).sort()];
  }, [jobs]);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (department !== ALL && j.department !== department) return false;
      if (location !== ALL && j.location !== location) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        (j.description ?? "").toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q)
      );
    });
  }, [jobs, query, department, location]);

  const stats = [
    { value: jobs?.length ?? 0, label: "Postes ouverts" },
    { value: departments.length - 1, label: "Équipes" },
    { value: locations.length - 1, label: "Lieux" },
    { value: "100%", label: "Québécois" },
  ];

  return (
    <div style={{ background: '#080612', minHeight: '100vh' }}>
      <SEOHead {...SEO_DATA.careers} />
      <Header />

      {/* HERO */}
      <section style={{ background: 'linear-gradient(160deg, #080612 0%, #11082A 55%, #0C0C18 100%)', paddingTop: 96, paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ top: -140, right: -80, width: 500, height: 500, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 65%)' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ bottom: -100, left: -80, width: 400, height: 400, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.10) 0%, transparent 65%)' }} />

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 mb-6" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 999, padding: '6px 16px' }}>
              <Sparkles className="w-3 h-3" style={{ color: '#A78BFA' }} />
              <span style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
                On recrute — équipe Nivra Telecom
              </span>
            </div>
            <h1 className="font-display font-black text-white" style={{ fontSize: 'clamp(36px, 6vw, 68px)', letterSpacing: '-2px', lineHeight: 1.03, marginBottom: 20 }}>
              Construisez la nouvelle
              <br />
              télécommunication
              <span style={{ marginLeft: 12, background: 'linear-gradient(90deg, #A78BFA 0%, #7C3AED 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> québécoise.</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18, lineHeight: 1.65, maxWidth: 560, margin: '0 auto 36px' }}>
              Chez Nivra, on bâtit des services télécoms simples, transparents et sans engagement.
              Rejoignez une équipe qui livre vite, pense clair et prend soin de ses gens.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#positions" style={{ height: 48, borderRadius: 999, background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 15, padding: '0 28px', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(124,58,237,0.45)', textDecoration: 'none' }}>
                Voir les postes ouverts
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link to="/apply" style={{ height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 15, padding: '0 28px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Candidature spontanée
              </Link>
            </div>

            {/* Stats */}
            <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 md:grid-cols-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)' }}>
              {stats.map((s) => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', padding: '24px 16px', textAlign: 'center' }}>
                  <div className="font-display font-bold text-white" style={{ fontSize: 32 }}>{s.value}</div>
                  <div style={{ marginTop: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section style={{ background: '#0A0A18', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '80px 0' }}>
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#A78BFA' }}>Nos valeurs</div>
            <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px', marginBottom: 14 }}>
              Ce qui nous guide.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7 }}>
              Trois principes simples qui se ressentent dans chaque décision, chaque ligne de code, chaque appel client.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="group hover:border-purple-500/30"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32, transition: 'border-color 0.2s' }}
              >
                <div className="group-hover:bg-[#7C3AED] group-hover:text-white transition-colors" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
                  <value.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-semibold text-white" style={{ fontSize: 19, marginBottom: 8 }}>{value.title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section style={{ background: '#080612', padding: '80px 0' }}>
        <div className="container mx-auto px-4">
          <div className="mb-14 grid items-end gap-8 md:grid-cols-2">
            <div>
              <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#A78BFA' }}>Avantages</div>
              <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px', lineHeight: 1.1 }}>
                On investit dans<br />notre équipe.
              </h2>
            </div>
            <p className="md:text-right" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7 }}>
              Parce qu'un bon service commence par des gens qui se sentent bien au travail.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="hover:border-purple-500/30"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24, transition: 'border-color 0.2s' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <benefit.icon className="h-5 w-5" style={{ color: '#A78BFA' }} />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-white" style={{ fontSize: 15, marginBottom: 4 }}>{benefit.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HIRING PROCESS */}
      <section style={{ background: '#0A0A18', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '80px 0' }}>
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#A78BFA' }}>Notre processus</div>
            <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px', marginBottom: 14 }}>
              De candidat à coéquipier<br />en 4 étapes.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7 }}>
              Simple, rapide, transparent. On vous tient informé à chaque étape.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {hiringSteps.map((s, i) => (
              <div
                key={s.step}
                style={{ position: 'relative', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32 }}
              >
                <div className="font-display font-bold" style={{ fontSize: 52, color: 'rgba(124,58,237,0.3)', marginBottom: 20 }}>{s.step}</div>
                <h3 className="font-display font-semibold text-white" style={{ fontSize: 17, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>{s.description}</p>
                {i < hiringSteps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 lg:block" style={{ color: 'rgba(124,58,237,0.4)' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POSITIONS */}
      <section id="positions" className="scroll-mt-24" style={{ background: '#080612', padding: '80px 0' }}>
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#A78BFA' }}>Opportunités</div>
            <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px, 4vw, 44px)', letterSpacing: '-1px', marginBottom: 14 }}>
              Postes ouverts
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, lineHeight: 1.7 }}>
              {jobs?.length
                ? `${jobs.length} opportunité${jobs.length > 1 ? "s" : ""} à pourvoir maintenant.`
                : "Explorez nos opportunités actuelles."}
            </p>
          </div>

          {/* Filters */}
          <div className="mx-auto mb-8 max-w-5xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 16 }}>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un poste, un mot-clé…"
                  style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', paddingLeft: 40, paddingRight: 16, color: 'white', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                style={{ height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20,10,40,1)', padding: '0 16px', color: 'rgba(255,255,255,0.8)', fontSize: 14, outline: 'none' }}
                aria-label="Filtrer par département"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === ALL ? "Tous les départements" : d}
                  </option>
                ))}
              </select>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ height: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20,10,40,1)', padding: '0 16px', color: 'rgba(255,255,255,0.8)', fontSize: 14, outline: 'none' }}
                aria-label="Filtrer par lieu"
              >
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l === ALL ? "Tous les lieux" : l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mx-auto max-w-5xl">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse" style={{ height: 112, borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }} />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div style={{ overflow: 'hidden', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                {filtered.map((position, idx) => (
                  <Link
                    key={position.id}
                    to={`/apply/${position.id}`}
                    className="group md:flex-row md:items-center md:justify-between hover:bg-white/[0.03]"
                    style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, textDecoration: 'none', borderBottom: idx !== filtered.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none', transition: 'background 0.15s' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <h3 className="font-display font-semibold text-white group-hover:text-[#A78BFA]" style={{ fontSize: 17, transition: 'color 0.15s' }}>
                          {position.title}
                        </h3>
                        <span style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '2px 10px', fontSize: 11, color: '#C4B5FD', fontWeight: 500 }}>
                          {position.type}
                        </span>
                      </div>
                      {position.description && (
                        <p className="line-clamp-2 max-w-2xl" style={{ marginBottom: 10, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                          {position.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Building2 className="h-4 w-4" style={{ color: '#A78BFA' }} />
                          {position.department}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin className="h-4 w-4" style={{ color: '#A78BFA' }} />
                          {position.location}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#A78BFA' }}>
                      Postuler
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: '64px 0', textAlign: 'center' }}>
                <div style={{ margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 20, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <Briefcase className="h-8 w-8" style={{ color: '#A78BFA' }} />
                </div>
                <h3 className="font-display font-semibold text-white" style={{ fontSize: 19, marginBottom: 8 }}>
                  {jobs?.length ? "Aucun résultat" : "Aucun poste ouvert actuellement"}
                </h3>
                <p style={{ maxWidth: 400, margin: '0 auto 24px', color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.7 }}>
                  {jobs?.length
                    ? "Essayez d'ajuster votre recherche ou vos filtres."
                    : "On n'a pas d'ouverture pour le moment, mais on garde l'œil ouvert sur les talents."}
                </p>
                <Link
                  to="/apply"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 999, background: '#7C3AED', color: '#fff', fontWeight: 600, fontSize: 14, padding: '0 24px', textDecoration: 'none' }}
                >
                  <Send className="h-4 w-4" />
                  Candidature spontanée
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#0A0A18', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '80px 0' }}>
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-5xl overflow-hidden" style={{ background: '#0D0D20', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 32, padding: '48px 40px' }}>
            <div aria-hidden className="absolute pointer-events-none" style={{ right: -80, top: -80, width: 320, height: 320, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.3) 0%, transparent 65%)' }} />
            <div aria-hidden className="absolute pointer-events-none" style={{ left: -80, bottom: -80, width: 320, height: 320, background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, transparent 65%)' }} />
            <div className="relative z-10 grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
              <div>
                <div className="inline-flex items-center gap-2 mb-5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '5px 14px' }}>
                  <Globe className="w-3 h-3 text-white/60" />
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500 }}>Candidature spontanée</span>
                </div>
                <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(24px, 3vw, 36px)', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 14 }}>
                  Vous ne trouvez pas<br />le poste idéal&nbsp;?
                </h2>
                <p style={{ maxWidth: 480, fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', marginBottom: 28 }}>
                  Envoyez-nous votre CV. Si votre profil correspond à un besoin futur, nous reviendrons vers vous —
                  promis, pas de silence radio.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/apply"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, borderRadius: 999, background: '#7C3AED', color: '#fff', fontWeight: 700, fontSize: 15, padding: '0 28px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
                  >
                    <Send className="h-4 w-4" />
                    Envoyer ma candidature
                  </Link>
                  <Link
                    to="/contact"
                    style={{ display: 'inline-flex', alignItems: 'center', height: 48, borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 15, padding: '0 28px', textDecoration: 'none' }}
                  >
                    Nous contacter
                  </Link>
                </div>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  "Réponse sous 7 jours ouvrables",
                  "Processus 100% confidentiel",
                  "Suivi humain à chaque étape",
                  "Données conservées selon Loi 25",
                ].map((item) => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', listStyle: 'none' }}>
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: '#A78BFA' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
