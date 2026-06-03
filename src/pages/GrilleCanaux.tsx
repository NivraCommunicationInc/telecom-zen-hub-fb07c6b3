import { useState, useMemo, useRef } from "react";
import { X, Search, Tv, Radio, Wifi } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";

interface Channel {
  number: number;
  name: string;
  category: string;
  hd: boolean;
  description: string;
}

const CHANNELS: Channel[] = [
  { number: 601, name: "QUB radio", category: "Radio", hd: false, description: "Station de radio numérique de Québecor diffusant en continu de la musique, des nouvelles et des émissions de divertissement." },
  { number: 602, name: "ICI RADIO-CANADA TÉLÉ", category: "Généralistes", hd: true, description: "La chaîne généraliste française de Radio-Canada, offrant nouvelles, émissions culturelles, séries dramatiques et documentaires." },
  { number: 603, name: "Télé-Québec", category: "Généralistes", hd: true, description: "Télédiffuseur public québécois proposant des émissions éducatives, culturelles et de divertissement pour toute la famille." },
  { number: 604, name: "TVA", category: "Généralistes", hd: true, description: "La plus grande chaîne généraliste francophone privée du Québec, diffusant nouvelles, téléromans, émissions de variétés et téléréalité." },
  { number: 605, name: "Noovo", category: "Généralistes", hd: true, description: "Chaîne généraliste de Bell Média proposant des émissions de divertissement, téléréalité, séries et nouvelles pour un public jeune." },
  { number: 606, name: "CBC", category: "Généralistes", hd: true, description: "La chaîne généraliste anglophone de Radio-Canada à Montréal, offrant nouvelles, sports et divertissement en anglais." },
  { number: 607, name: "CTV", category: "Généralistes", hd: true, description: "La principale chaîne généraliste anglophone privée du Canada, diffusant nouvelles, séries américaines et émissions canadiennes." },
  { number: 608, name: "Global", category: "Généralistes", hd: true, description: "Réseau de télévision canadien anglophone proposant des séries américaines populaires, des nouvelles et des émissions de divertissement." },
  { number: 609, name: "MAtv", category: "Généralistes", hd: true, description: "Chaîne communautaire locale diffusant des émissions produites par et pour les résidents de Québec et Lévis." },
  { number: 610, name: "Télé-Mag", category: "Spécialisées", hd: true, description: "Chaîne magazine francophone couvrant la mode, les tendances, la cuisine et les arts de vivre." },
  { number: 614, name: "Citytv Montréal", category: "Généralistes", hd: true, description: "Chaîne urbaine anglophone de Rogers diffusant séries, films et émissions de divertissement à Montréal." },
  { number: 616, name: "APTN", category: "Spécialisées", hd: true, description: "Réseau de télévision des peuples autochtones du Canada, diffusant des émissions en langues autochtones, en français et en anglais." },
  { number: 618, name: "CBC News Network", category: "Nouvelles", hd: true, description: "Chaîne d'information continue en anglais de Radio-Canada, couvrant l'actualité canadienne et internationale 24h/24." },
  { number: 619, name: "ICI RDI", category: "Nouvelles", hd: true, description: "Réseau de l'information de Radio-Canada en français, diffusant nouvelles, analyses et reportages en continu." },
  { number: 620, name: "LCN", category: "Nouvelles", hd: true, description: "Le Canal Nouvelles de TVA, chaîne d'information continue en français couvrant l'actualité québécoise et mondiale 24h/24." },
  { number: 621, name: "Météomédia", category: "Nouvelles", hd: true, description: "Chaîne météorologique canadienne offrant des prévisions locales, régionales et mondiales en temps réel." },
  { number: 622, name: "Savoir média", category: "Éducation", hd: true, description: "Chaîne éducative francophone proposant des documentaires, conférences et émissions de savoir pour adultes." },
  { number: 623, name: "TVA Sports", category: "Sports", hd: true, description: "Principale chaîne sportive francophone du Québec couvrant le hockey, le football, le soccer et les sports de combat." },
  { number: 624, name: "TVA Sports 2", category: "Sports", hd: true, description: "Chaîne complémentaire de TVA Sports diffusant des événements sportifs supplémentaires et de la couverture en direct." },
  { number: 625, name: "RDS", category: "Sports", hd: true, description: "Le Réseau des sports, principale chaîne sportive francophone canadienne couvrant le hockey NHL, le football CFL et plus." },
  { number: 626, name: "RDS2", category: "Sports", hd: true, description: "Chaîne complémentaire de RDS offrant plus de contenu sportif, incluant des sports moins médiatisés et des rediffusions." },
  { number: 627, name: "RDS INFO", category: "Sports", hd: true, description: "Chaîne d'information sportive continue du Réseau des sports, avec résultats, analyses et nouvelles sportives en temps réel." },
  { number: 629, name: "TV5", category: "International", hd: true, description: "Chaîne internationale francophone diffusant des émissions de France, Belgique, Suisse et du monde francophone." },
  { number: 630, name: "TV5 Unis", category: "International", hd: true, description: "Chaîne canadienne francophone célébrant la diversité et la francophonie canadienne avec des émissions de partout au pays." },
  { number: 631, name: "ICI ARTV", category: "Arts", hd: true, description: "Chaîne culturelle de Radio-Canada dédiée aux arts, à la musique, au cinéma, à la danse et aux arts de la scène." },
  { number: 632, name: "Max", category: "Cinéma", hd: true, description: "La plateforme HBO au Canada, offrant les meilleures séries originales, films et documentaires primés." },
  { number: 633, name: "ELLE Fictions", category: "Séries", hd: true, description: "Anciennement MusiquePlus, maintenant dédiée aux séries dramatiques et aux fictions pour un public féminin." },
  { number: 634, name: "CASA", category: "Style de vie", hd: true, description: "Chaîne québécoise spécialisée dans la décoration, la rénovation, l'architecture et les arts de vivre à la maison." },
  { number: 635, name: "ADDIK", category: "Séries", hd: true, description: "Chaîne de Québecor proposant des séries dramatiques captivantes, des thrillers et des émissions de suspense." },
  { number: 636, name: "Canal D", category: "Documentaires", hd: true, description: "Chaîne documentaire de Bell Média diffusant des documentaires sur le crime, la nature, la science et les biographies." },
  { number: 637, name: "Investigation", category: "Documentaires", hd: true, description: "Chaîne spécialisée dans les émissions de vraie criminalité, enquêtes policières et mystères non résolus." },
  { number: 638, name: "Natyf TV", category: "International", hd: true, description: "Chaîne caribéenne et afro-antillaise diffusant des émissions culturelles, de divertissement et d'information des Antilles." },
  { number: 639, name: "TÉMOIN", category: "Documentaires", hd: true, description: "Chaîne documentaire proposant des reportages, témoignages et documentaires sur des sujets de société actuels." },
  { number: 640, name: "Évasion", category: "Voyages", hd: true, description: "Chaîne de voyage et d'aventure de Québecor inspirant les téléspectateurs avec des destinations du monde entier." },
  { number: 641, name: "Séries Plus", category: "Séries", hd: true, description: "Chaîne dédiée aux meilleures séries télévisées françaises et québécoises, drames et comédies de qualité." },
  { number: 642, name: "Historia", category: "Documentaires", hd: true, description: "Chaîne historique et documentaire explorant l'histoire mondiale, les grands événements et les figures marquantes." },
  { number: 644, name: "Canal Vie", category: "Style de vie", hd: true, description: "Chaîne lifestyle de Bell Média axée sur la santé, les relations, la cuisine, la mode et le bien-être au féminin." },
  { number: 645, name: "Zeste", category: "Cuisine", hd: true, description: "Chaîne culinaire québécoise proposant des émissions de cuisine, recettes, restauration et arts de la table." },
  { number: 646, name: "PLANÈTE+", category: "Documentaires", hd: true, description: "Chaîne documentaire internationale explorant la nature, la science, l'exploration et les grandes découvertes." },
  { number: 647, name: "ICI EXPLORA", category: "Documentaires", hd: true, description: "Chaîne documentaire de Radio-Canada dédiée à la science, la nature, l'histoire et la culture en français." },
  { number: 648, name: "Prise 2", category: "Cinéma", hd: true, description: "Chaîne cinématographique québécoise diffusant des films classiques, cultes et contemporains en version française." },
  { number: 651, name: "QUB", category: "Divertissement", hd: true, description: "Chaîne numérique de Québecor proposant du contenu original, des émissions exclusives et du divertissement varié." },
  { number: 653, name: "Télétoon", category: "Enfants", hd: true, description: "La principale chaîne de dessins animés et émissions pour enfants en français au Canada." },
  { number: 654, name: "TFO", category: "Éducation", hd: true, description: "Télévision éducative francophone de l'Ontario proposant des émissions jeunesse, culturelles et éducatives de qualité." },
  { number: 680, name: "The News Forum", category: "Nouvelles", hd: false, description: "Chaîne d'information canadienne indépendante offrant une couverture alternative des actualités nationales et internationales." },
  { number: 681, name: "CNN", category: "Nouvelles", hd: true, description: "Cable News Network, la référence mondiale de l'information continue en anglais, couvrant l'actualité internationale 24h/24." },
  { number: 684, name: "NBC", category: "Généralistes", hd: true, description: "National Broadcasting Company, grand réseau américain diffusant nouvelles, séries populaires et événements sportifs majeurs." },
  { number: 685, name: "FOX Burlington", category: "Généralistes", hd: true, description: "Affilié FOX américain diffusant séries populaires, nouvelles locales et événements sportifs depuis Burlington, Vermont." },
  { number: 686, name: "ABC Plattsburgh", category: "Généralistes", hd: true, description: "Affilié ABC américain proposant nouvelles, séries et émissions de divertissement depuis Plattsburgh, New York." },
  { number: 687, name: "CBS Burlington", category: "Généralistes", hd: true, description: "Affilié CBS américain diffusant nouvelles, sports et émissions primées depuis Burlington, Vermont." },
  { number: 689, name: "PBS Plattsburgh", category: "Éducation", hd: true, description: "Public Broadcasting Service, télévision publique américaine offrant documentaires, émissions culturelles et éducatives." },
  { number: 690, name: "A&E", category: "Documentaires", hd: true, description: "Arts & Entertainment Network, chaîne américaine diffusant des documentaires sur le crime, des biopics et des téléréalités populaires." },
  { number: 691, name: "TLC", category: "Style de vie", hd: true, description: "The Learning Channel, chaîne de téléréalité et de style de vie couvrant la famille, la mode, la cuisine et les transformations." },
  { number: 692, name: "CTV Drama", category: "Séries", hd: true, description: "Chaîne canadienne spécialisée dans les séries dramatiques américaines et canadiennes de qualité." },
  { number: 696, name: "Flavour Network", category: "Cuisine", hd: true, description: "Chaîne culinaire proposant des émissions de cuisine, compétitions gastronomiques et voyages culinaires." },
  { number: 697, name: "Home Network", category: "Style de vie", hd: true, description: "Chaîne dédiée à la maison, la décoration intérieure, la rénovation et l'aménagement paysager." },
  { number: 701, name: "CTV Sci-Fi", category: "Séries", hd: true, description: "Chaîne canadienne spécialisée dans la science-fiction, le fantastique, l'horreur et les séries de genre." },
  { number: 702, name: "USA Network", category: "Séries", hd: true, description: "Réseau américain populaire diffusant des séries originales, films et événements sportifs de divertissement grand public." },
  { number: 703, name: "CTV Speed", category: "Sports", hd: false, description: "Chaîne canadienne dédiée aux sports motorisés, course automobile, Formule 1 et sports d'action." },
  { number: 705, name: "Showcase", category: "Séries", hd: true, description: "Chaîne canadienne diffusant des séries dramatiques audacieuses, des thrillers et des productions primées." },
  { number: 707, name: "History", category: "Documentaires", hd: true, description: "Chaîne documentaire explorant l'histoire mondiale, les mystères anciens, les grandes guerres et les civilisations." },
  { number: 745, name: "National Geographic", category: "Documentaires", hd: true, description: "La référence mondiale du documentaire sur la nature, la science, l'exploration et les cultures du monde." },
  { number: 746, name: "Love Nature", category: "Nature", hd: false, description: "Chaîne dédiée à la nature et à la faune sauvage, proposant des documentaires en haute définition sur l'environnement." },
  { number: 747, name: "BBC Earth", category: "Nature", hd: false, description: "Chaîne de la BBC dédiée aux documentaires sur la nature, la faune, la planète et les sciences naturelles." },
  { number: 553, name: "Stingray Naturescape", category: "Nature", hd: false, description: "Chaîne de détente proposant des paysages naturels apaisants accompagnés de musique ambiante, sans narration." },
  { number: 769, name: "Uvagut TV", category: "International", hd: true, description: "Première chaîne de télévision inuite du Canada diffusant des émissions en inuktitut pour les communautés arctiques." },
  { number: 770, name: "BeIN Sports en Español", category: "Sports", hd: true, description: "Chaîne sportive internationale en espagnol couvrant le soccer mondial, la Liga, la Serie A et les grands événements sportifs." },
  { number: 779, name: "Sportsnet", category: "Sports", hd: true, description: "Réseau sportif national canadien de Rogers couvrant le baseball MLB, le hockey NHL, le basketball et plus." },
  { number: 784, name: "Sportsnet ONE", category: "Sports", hd: true, description: "Chaîne complémentaire de Sportsnet offrant une couverture sportive élargie incluant des matchs supplémentaires en direct." },
  { number: 785, name: "Sportsnet 360", category: "Sports", hd: true, description: "Anciennement The Score, chaîne sportive proposant des nouvelles sportives continues, analyses et événements en direct." },
  { number: 786, name: "TSN 1", category: "Sports", hd: true, description: "The Sports Network, principale chaîne sportive anglophone canadienne couvrant le hockey, le football et les grands événements." },
  { number: 787, name: "TSN 2", category: "Sports", hd: true, description: "Deuxième chaîne TSN offrant une couverture sportive complémentaire incluant golf, tennis, soccer et sports universitaires." },
  { number: 788, name: "TSN 3", category: "Sports", hd: true, description: "Troisième chaîne TSN proposant des événements sportifs supplémentaires et une couverture élargie des sports canadiens." },
  { number: 789, name: "TSN 4", category: "Sports", hd: true, description: "Quatrième chaîne TSN diffusant des sports régionaux, universitaires et des événements sportifs alternatifs en direct." },
  { number: 790, name: "TSN 5", category: "Sports", hd: true, description: "Cinquième chaîne TSN complétant le réseau avec des événements sportifs nationaux et internationaux supplémentaires." },
  { number: 792, name: "Fox Sports Racing", category: "Sports", hd: true, description: "Chaîne dédiée aux sports motorisés, NASCAR, IndyCar, Formule 1 et toutes les compétitions automobiles." },
  { number: 793, name: "GOLF", category: "Sports", hd: true, description: "Golf Channel Canada, chaîne entièrement dédiée au golf avec tournois PGA, enseignements et actualités du circuit." },
  { number: 795, name: "NFL Network", category: "Sports", hd: true, description: "Chaîne officielle de la NFL diffusant des matchs en direct, analyses, nouvelles et contenu exclusif de la Ligue nationale de football." },
  { number: 796, name: "NBA TV Canada", category: "Sports", hd: true, description: "Chaîne officielle de la NBA au Canada proposant des matchs en direct, résumés et contenu exclusif de la ligue de basketball." },
  { number: 800, name: "Cinépop", category: "Cinéma", hd: true, description: "Chaîne québécoise de cinéma populaire diffusant des films grand public, comédies, actions et drames en version française." },
  { number: 801, name: "Super Écran", category: "Cinéma", hd: true, description: "Première chaîne cinéma premium du Québec diffusant les dernières sorties en exclusivité, sans publicité." },
  { number: 802, name: "Super Écran 2", category: "Cinéma", hd: true, description: "Deuxième chaîne Super Écran proposant une programmation cinématographique complémentaire de films premium." },
  { number: 803, name: "Super Écran 3", category: "Cinéma", hd: true, description: "Troisième chaîne Super Écran offrant encore plus de films en exclusivité, drames, thrillers et comédies." },
  { number: 804, name: "Super Écran 4", category: "Cinéma", hd: true, description: "Quatrième chaîne Super Écran complétant l'offre cinématographique premium avec des films internationaux et indépendants." },
  { number: 811, name: "Crave 1", category: "Cinéma", hd: true, description: "Première chaîne Crave de Bell Média donnant accès aux séries HBO, Showtime et aux productions originales canadiennes." },
  { number: 815, name: "HBO", category: "Cinéma", hd: true, description: "Home Box Office, référence mondiale des séries premium et films d'auteur, sans publicité et en haute définition." },
  { number: 816, name: "STARZ 1", category: "Cinéma", hd: true, description: "Chaîne premium américaine offrant des films récents, des séries originales et du contenu exclusif sans publicité." },
  { number: 820, name: "FX", category: "Séries", hd: true, description: "Chaîne câblée américaine reconnue pour ses séries originales audacieuses, drames primés et comédies provocatrices." },
  { number: 910, name: "TSN 4K", category: "Sports 4K", hd: true, description: "Version 4K Ultra HD de TSN offrant les grands événements sportifs canadiens en résolution maximale." },
  { number: 911, name: "Sportsnet 4K", category: "Sports 4K", hd: true, description: "Version 4K Ultra HD de Sportsnet pour une expérience sportive immersive avec une qualité d'image exceptionnelle." },
  { number: 912, name: "Sportsnet ONE 4K", category: "Sports 4K", hd: true, description: "Version 4K de Sportsnet ONE pour vivre les matchs de hockey et baseball en Ultra Haute Définition." },
  { number: 913, name: "Love Nature 4K", category: "Nature 4K", hd: true, description: "Version 4K Ultra HD de Love Nature pour découvrir la faune et la nature mondiale en qualité cinématographique." },
  { number: 915, name: "Stingray Naturescape 4K UHD", category: "Nature 4K", hd: true, description: "Paysages naturels en 4K Ultra HD accompagnés de musique ambiante pour une relaxation totale en qualité maximale." },
  { number: 916, name: "Stingray Festival 4K", category: "Musique 4K", hd: true, description: "Chaîne 4K dédiée aux concerts et festivals musicaux du monde entier en Ultra Haute Définition." },
];

const ALL_CATEGORIES = [
  "Toutes", "Généralistes", "Nouvelles", "Sports", "Sports 4K", "Cinéma",
  "Séries", "Documentaires", "Style de vie", "Cuisine", "Nature", "Nature 4K",
  "Voyages", "Arts", "Éducation", "Enfants", "International", "Musique 4K",
  "Divertissement", "Radio", "Spécialisées",
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Généralistes":  { bg: "rgba(124,58,237,0.15)",  border: "rgba(124,58,237,0.4)",  text: "#A78BFA" },
  "Nouvelles":     { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",  text: "#FCA5A5" },
  "Sports":        { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.35)", text: "#6EE7B7" },
  "Sports 4K":     { bg: "rgba(16,185,129,0.18)",  border: "rgba(16,185,129,0.5)",  text: "#34D399" },
  "Cinéma":        { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)", text: "#FCD34D" },
  "Séries":        { bg: "rgba(99,102,241,0.15)",  border: "rgba(99,102,241,0.4)",  text: "#A5B4FC" },
  "Documentaires": { bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.35)",  text: "#67E8F9" },
  "Style de vie":  { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.35)", text: "#F9A8D4" },
  "Cuisine":       { bg: "rgba(234,88,12,0.12)",   border: "rgba(234,88,12,0.35)",  text: "#FDBA74" },
  "Nature":        { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)",  text: "#86EFAC" },
  "Nature 4K":     { bg: "rgba(34,197,94,0.18)",   border: "rgba(34,197,94,0.5)",   text: "#4ADE80" },
  "Voyages":       { bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.35)", text: "#7DD3FC" },
  "Arts":          { bg: "rgba(217,70,239,0.12)",  border: "rgba(217,70,239,0.35)", text: "#E879F9" },
  "Éducation":     { bg: "rgba(20,184,166,0.12)",  border: "rgba(20,184,166,0.35)", text: "#5EEAD4" },
  "Enfants":       { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)", text: "#FDE68A" },
  "International": { bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.35)", text: "#D8B4FE" },
  "Musique 4K":    { bg: "rgba(244,114,182,0.15)", border: "rgba(244,114,182,0.4)", text: "#FBCFE8" },
  "Divertissement":{ bg: "rgba(124,58,237,0.12)",  border: "rgba(124,58,237,0.3)",  text: "#C4B5FD" },
  "Radio":         { bg: "rgba(107,114,128,0.15)", border: "rgba(107,114,128,0.4)", text: "#D1D5DB" },
  "Spécialisées":  { bg: "rgba(124,58,237,0.1)",   border: "rgba(124,58,237,0.25)", text: "#C4B5FD" },
};

function getCatColor(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.7)" };
}

export default function GrilleCanaux() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [activeCategory, setActiveCategory] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Channel | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = CHANNELS;
    if (activeCategory !== "Toutes") list = list.filter(c => c.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.number.toString().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.number - b.number);
  }, [activeCategory, search]);

  const usedCategories = useMemo(() => {
    const set = new Set(CHANNELS.map(c => c.category));
    return ALL_CATEGORIES.filter(c => c === "Toutes" || set.has(c));
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#020209" }}>
      <SEOHead
        title={isFr ? "Grille des canaux TV | Nivra Telecom" : "TV Channel Guide | Nivra Telecom"}
        description={isFr
          ? `Découvrez les ${CHANNELS.length} chaînes TV disponibles chez Nivra Telecom — Généralistes, Sports, Cinéma, Nouvelles et plus.`
          : `Explore the ${CHANNELS.length} TV channels available with Nivra Telecom — General, Sports, Movies, News and more.`}
      />
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden" style={{ paddingTop: 96, paddingBottom: 48 }}>
        <div aria-hidden style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 65%)", animation: "n-aurora-1 16s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: "-20%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.1) 0%, transparent 65%)", animation: "n-aurora-2 20s ease-in-out infinite", pointerEvents: "none" }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />

        <div className="max-w-[1200px] mx-auto px-4 sm:px-10 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
            <Tv className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {isFr ? "Grille des canaux" : "Channel Guide"}
            </span>
          </div>
          <h1 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 5vw, 52px)", letterSpacing: "-1.5px", lineHeight: 1.08 }}>
            {isFr ? <>Vos <span className="n-shimmer-text">{CHANNELS.length} chaînes</span> TV</> : <>Your <span className="n-shimmer-text">{CHANNELS.length} TV channels</span></>}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, maxWidth: 560 }}>
            {isFr
              ? "Généralistes, sports, cinéma, nouvelles, documentaires et plus — tout inclus dans votre forfait Télévision Nivra."
              : "General, sports, movies, news, documentaries and more — all included in your Nivra TV plan."}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mt-8">
            {[
              { val: `${CHANNELS.filter(c => c.hd).length}+`, label: isFr ? "Chaînes HD" : "HD Channels" },
              { val: `${CHANNELS.filter(c => c.category.includes("4K")).length}`, label: "Chaînes 4K" },
              { val: `${usedCategories.length - 1}`, label: isFr ? "Catégories" : "Categories" },
              { val: `${CHANNELS.filter(c => c.category === "Sports" || c.category === "Sports 4K").length}`, label: isFr ? "Chaînes sport" : "Sport channels" },
            ].map(s => (
              <div key={s.label}>
                <div className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, letterSpacing: "-1px", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sticky filter bar ── */}
      <div ref={filterRef} style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(2,2,9,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(124,58,237,0.15)", paddingTop: 12, paddingBottom: 12 }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-10">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isFr ? "Rechercher par nom ou numéro…" : "Search by name or number…"}
              style={{ width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px 8px 36px", color: "#fff", fontSize: 13, outline: "none" }}
              className="focus:border-purple-500/50"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "none", border: "none" }}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {usedCategories.map(cat => {
              const active = activeCategory === cat;
              const color = getCatColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    flexShrink: 0,
                    padding: "5px 14px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    transition: "all .18s",
                    border: active ? `1px solid ${color.border}` : "1px solid rgba(255,255,255,0.1)",
                    background: active ? color.bg : "rgba(255,255,255,0.03)",
                    color: active ? color.text : "rgba(255,255,255,0.5)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat === "Toutes" ? `${isFr ? "Toutes" : "All"} (${CHANNELS.length})` : cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Channel grid ── */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px 80px" }} className="sm:px-10">
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.35)", fontSize: 15 }}>
            {isFr ? "Aucune chaîne trouvée." : "No channels found."}
          </div>
        ) : (
          <>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 20, letterSpacing: "0.05em" }}>
              {filtered.length} {isFr ? "chaîne" : "channel"}{filtered.length > 1 ? "s" : ""}
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {filtered.map(ch => {
                const color = getCatColor(ch.category);
                return (
                  <button
                    key={ch.number}
                    onClick={() => setSelected(ch)}
                    className="text-left rounded-2xl transition-all group"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      padding: "16px",
                      cursor: "pointer",
                      transition: "border-color .2s, box-shadow .2s, transform .15s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = color.border;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 24px ${color.bg}`;
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }}
                  >
                    {/* Number + badges row */}
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, color: color.text, letterSpacing: "-0.5px" }}>
                        {ch.number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ch.hd && (
                          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#67E8F9", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                            HD
                          </span>
                        )}
                        {ch.category.includes("4K") && (
                          <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#FCD34D", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "2px 6px" }}>
                            4K
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Channel name */}
                    <div className="font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, lineHeight: 1.3 }}>
                      {ch.name}
                    </div>

                    {/* Category badge */}
                    <div className="mb-2">
                      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", color: color.text, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 6, padding: "2px 8px" }}>
                        {ch.category}
                      </span>
                    </div>

                    {/* Description preview */}
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11.5, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {ch.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── Channel detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative rounded-2xl w-full max-w-md"
            style={{ background: "linear-gradient(135deg, rgba(20,10,40,0.98) 0%, rgba(10,5,20,0.98) 100%)", border: "1px solid rgba(124,58,237,0.4)", boxShadow: "0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.2)", padding: "28px" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.6)" }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Number */}
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 48, lineHeight: 1, color: getCatColor(selected.category).text, letterSpacing: "-2px", marginBottom: 4 }}>
              {selected.number}
            </div>

            {/* Name */}
            <h2 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
              {selected.name}
            </h2>

            {/* Badges */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: getCatColor(selected.category).text, background: getCatColor(selected.category).bg, border: `1px solid ${getCatColor(selected.category).border}`, borderRadius: 6, padding: "3px 10px" }}>
                {selected.category}
              </span>
              {selected.hd && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#67E8F9", background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 4, padding: "3px 8px" }}>
                  HD
                </span>
              )}
              {selected.category.includes("4K") && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", color: "#FCD34D", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "3px 8px" }}>
                  4K UHD
                </span>
              )}
              {!selected.hd && !selected.category.includes("4K") && (
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "3px 8px" }}>
                  SD
                </span>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)", marginBottom: 16 }} />

            {/* Description */}
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.7 }}>
              {selected.description}
            </p>

            {/* CTA */}
            <a
              href="/tv"
              className="flex items-center justify-center gap-2 font-bold text-white mt-6"
              style={{ height: 46, borderRadius: 10, fontSize: 14, textDecoration: "none", fontFamily: "'Space Grotesk', sans-serif", background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 6px 20px rgba(124,58,237,0.35)" }}
            >
              <Tv className="w-4 h-4" />
              {isFr ? "Voir les forfaits TV" : "See TV plans"}
            </a>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
