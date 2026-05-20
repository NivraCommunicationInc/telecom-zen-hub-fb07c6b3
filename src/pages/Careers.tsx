import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    <div className="min-h-screen bg-background">
      <SEOHead {...SEO_DATA.careers} />
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#EDE9FF] pt-32 pb-24">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#7C3AED]/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#7C3AED]/10 blur-3xl" aria-hidden />

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="mb-6 rounded-full border-0 bg-white px-4 py-1.5 text-xs font-medium text-[#7C3AED] shadow-sm">
              <Sparkles className="mr-1.5 h-3 w-3" />
              On recrute — équipe Nivra Telecom
            </Badge>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-[#111111] md:text-6xl lg:text-7xl">
              Construisez la nouvelle
              <br />
              télécommunication
              <span className="ml-2 inline-block text-[#7C3AED]">québécoise.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700 md:text-xl">
              Chez Nivra, on bâtit des services télécoms simples, transparents et sans engagement.
              Rejoignez une équipe qui livre vite, pense clair et prend soin de ses gens.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="h-12 rounded-full bg-[#111111] px-7 text-white hover:bg-[#111111]/90"
              >
                <a href="#positions">
                  Voir les postes ouverts
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-12 rounded-full border-neutral-300 bg-white px-7 text-[#111111] hover:bg-neutral-50"
              >
                <Link to="/apply">Candidature spontanée</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/60 bg-white/60 backdrop-blur md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-white/80 px-4 py-6 text-center">
                  <div className="font-display text-3xl font-bold text-[#111111]">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="border-y border-neutral-200 bg-white py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">Nos valeurs</div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-[#111111] md:text-5xl">
              Ce qui nous guide.
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Trois principes simples qui se ressentent dans chaque décision, chaque ligne de code, chaque appel client.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-[#F7F7F7] p-8 transition-all hover:border-[#7C3AED]/30 hover:bg-white hover:shadow-[0_8px_30px_rgb(124,58,237,0.08)]"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED] transition-colors group-hover:bg-[#7C3AED] group-hover:text-white">
                  <value.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-semibold text-[#111111]">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-[#F7F7F7] py-24">
        <div className="container mx-auto px-4">
          <div className="mb-16 grid items-end gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">Avantages</div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-[#111111] md:text-5xl">
                On investit dans
                <br />
                notre équipe.
              </h2>
            </div>
            <p className="text-lg text-neutral-600 md:text-right">
              Parce qu'un bon service commence par des gens qui se sentent bien au travail.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:border-[#7C3AED]/30"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#EDE9FF] text-[#7C3AED]">
                  <benefit.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-[#111111]">{benefit.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HIRING PROCESS */}
      <section className="bg-white py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">Notre processus</div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-[#111111] md:text-5xl">
              De candidat à coéquipier
              <br />
              en 4 étapes.
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Simple, rapide, transparent. On vous tient informé à chaque étape.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {hiringSteps.map((s, i) => (
              <div
                key={s.step}
                className="relative rounded-3xl border border-neutral-200 bg-[#F7F7F7] p-8"
              >
                <div className="mb-6 font-display text-5xl font-bold text-[#7C3AED]/30">{s.step}</div>
                <h3 className="font-display text-lg font-semibold text-[#111111]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.description}</p>
                {i < hiringSteps.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-[#7C3AED]/40 lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POSITIONS */}
      <section id="positions" className="scroll-mt-24 bg-[#F7F7F7] py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7C3AED]">Opportunités</div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-[#111111] md:text-5xl">
              Postes ouverts
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              {jobs?.length
                ? `${jobs.length} opportunité${jobs.length > 1 ? "s" : ""} à pourvoir maintenant.`
                : "Explorez nos opportunités actuelles."}
            </p>
          </div>

          {/* Filters */}
          <div className="mx-auto mb-8 max-w-5xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un poste, un mot-clé…"
                  className="h-11 rounded-xl border-neutral-200 bg-[#F7F7F7] pl-10"
                />
              </div>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm text-[#111111] outline-none focus:border-[#7C3AED]"
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
                className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm text-[#111111] outline-none focus:border-[#7C3AED]"
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
                  <div key={i} className="h-28 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                {filtered.map((position, idx) => (
                  <Link
                    key={position.id}
                    to={`/apply/${position.id}`}
                    className={`group flex flex-col gap-4 p-6 transition-colors hover:bg-[#EDE9FF]/30 md:flex-row md:items-center md:justify-between ${
                      idx !== filtered.length - 1 ? "border-b border-neutral-200" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-[#111111] group-hover:text-[#7C3AED]">
                          {position.title}
                        </h3>
                        <Badge className="rounded-full border-0 bg-[#EDE9FF] px-2.5 py-0.5 text-[11px] font-medium text-[#7C3AED] hover:bg-[#EDE9FF]">
                          {position.type}
                        </Badge>
                      </div>
                      {position.description && (
                        <p className="mb-3 line-clamp-2 max-w-2xl text-sm text-neutral-600">
                          {position.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-[#7C3AED]" />
                          {position.department}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-[#7C3AED]" />
                          {position.location}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-[#111111] md:text-[#7C3AED]">
                      Postuler
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-neutral-200 bg-white py-16 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EDE9FF]">
                  <Briefcase className="h-8 w-8 text-[#7C3AED]" />
                </div>
                <h3 className="font-display text-xl font-semibold text-[#111111]">
                  {jobs?.length ? "Aucun résultat" : "Aucun poste ouvert actuellement"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-neutral-600">
                  {jobs?.length
                    ? "Essayez d'ajuster votre recherche ou vos filtres."
                    : "On n'a pas d'ouverture pour le moment, mais on garde l'œil ouvert sur les talents."}
                </p>
                <Button
                  asChild
                  className="mt-6 rounded-full bg-[#7C3AED] text-white hover:bg-[#6d28d9]"
                >
                  <Link to="/apply">
                    <Send className="mr-2 h-4 w-4" />
                    Candidature spontanée
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-24">
        <div className="container mx-auto px-4">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#111111] p-10 md:p-16">
            <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#7C3AED]/30 blur-3xl" aria-hidden />
            <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[#7C3AED]/20 blur-3xl" aria-hidden />
            <div className="relative z-10 grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
              <div>
                <Badge className="mb-5 rounded-full border-0 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                  <Globe className="mr-1.5 h-3 w-3" />
                  Candidature spontanée
                </Badge>
                <h2 className="font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                  Vous ne trouvez pas
                  <br />
                  le poste idéal&nbsp;?
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-white/70">
                  Envoyez-nous votre CV. Si votre profil correspond à un besoin futur, nous reviendrons vers vous —
                  promis, pas de silence radio.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full bg-white px-7 text-[#111111] hover:bg-white/90"
                  >
                    <Link to="/apply">
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer ma candidature
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/20 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
                  >
                    <Link to="/contact">Nous contacter</Link>
                  </Button>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-white/80">
                {[
                  "Réponse sous 7 jours ouvrables",
                  "Processus 100% confidentiel",
                  "Suivi humain à chaque étape",
                  "Données conservées selon Loi 25",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[#a78bfa]" />
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
