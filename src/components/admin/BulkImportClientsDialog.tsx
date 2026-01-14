import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ClientToImport {
  name: string;
  email: string | null;
  phone: string;
}

interface ImportResult {
  success: boolean;
  name: string;
  email: string | null;
  phone: string;
  user_id?: string;
  error?: string;
}

interface BulkImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Pre-parsed client data from the Excel file
const clientsToImport: ClientToImport[] = [
  { name: "Casseus", email: "alexis.casseus81@gmail.com", phone: "5145858148" },
  { name: "JOSEPH", email: null, phone: "4389511371" },
  { name: "FAHE MAE CLAUDE", email: "email@telus.com", phone: "4388671822" },
  { name: "LIMA FEUSANNE", email: "limafeusanne@gmail.com", phone: "4383575067" },
  { name: "MARIA", email: "kiongamaria218@gmail.com", phone: "4388610523" },
  { name: "DAVID", email: null, phone: "4388672634" },
  { name: "JACARANDA VANESSA", email: null, phone: "4388613619" },
  { name: "MITZRAEL RODRIGUEZ", email: "meriusmit6@gmail.com", phone: "4389893336" },
  { name: "SOLINY", email: "solinyfrancois32@gmail.com", phone: "4388645592" },
  { name: "FANNY", email: null, phone: "4389514649" },
  { name: "LEILA", email: null, phone: "5145789469" },
  { name: "HOUSSAM", email: null, phone: "5142699082" },
  { name: "NICOLE", email: null, phone: "4508089345" },
  { name: "Nizar", email: "nizarabd@hotmail.com", phone: "5147305353" },
  { name: "STEEVENS", email: null, phone: "4389853322" },
  { name: "CASMY", email: "casmymoline@yahoo.fr", phone: "4382826517" },
  { name: "KENITA", email: "delmasbourjollykenita@gmail.com", phone: "4389346119" },
  { name: "ADRIEN", email: null, phone: "5148212690" },
  { name: "Serette", email: "serettedevalcy14@gmail.com", phone: "4389257855" },
  { name: "CARLOS RUBEN", email: "ariasrubencarlos@gmail.com", phone: "5146886487" },
  { name: "TEYEB", email: null, phone: "4388373794" },
  { name: "BENJAMIN", email: null, phone: "5148295113" },
  { name: "JOANNA DINELY", email: null, phone: "4388847307" },
  { name: "SREY POV", email: null, phone: "5146687798" },
  { name: "NOUMOU", email: "NOUMOUSIDIBE68@GMAIL.COM", phone: "4387634205" },
  { name: "JEAN CHARLES", email: "jeancharlesjerome247@gmail.com", phone: "4388314663" },
  { name: "KARLA PATRICIA", email: "Karlabarahonaramos@gmail.com", phone: "5143583946" },
  { name: "KHADY", email: null, phone: "4388857140" },
  { name: "Berlinsca", email: "berlinscamarius@yahoo.fr", phone: "5145660419" },
  { name: "GAUTHIER", email: "thegauthier11@hotmail.fr", phone: "4389378639" },
  { name: "ROSA", email: null, phone: "4389855105" },
  { name: "JONATHAN", email: null, phone: "4506133469" },
  { name: "GASPARD", email: null, phone: "4388609722" },
  { name: "TOMMY", email: null, phone: "4388769976" },
  { name: "FRANCOIS", email: null, phone: "4388330383" },
  { name: "kenslove", email: "kenslovemalade34@gmail.com", phone: "4388675091" },
  { name: "DAPHNE", email: "daphnedolcine45@gmail.com", phone: "4388673112" },
  { name: "FANIRA", email: "fanirarevolus68@gmail.com", phone: "5146184566" },
  { name: "CARMEN", email: null, phone: "5149121890" },
  { name: "JUVENS", email: null, phone: "4388806448" },
  { name: "STELLA", email: null, phone: "5148175315" },
  { name: "MASUMBOKO", email: null, phone: "4383503878" },
  { name: "VERONIQUE", email: null, phone: "4388829407" },
  { name: "BOURDEAU", email: "bourdeauandre6@gmail.com", phone: "4388872622" },
  { name: "JEAN", email: "JEANAUTERGE@GMAIL.COM", phone: "4388831510" },
  { name: "NANCY", email: "nancy.desgranges@gmail.com", phone: "4388212219" },
  { name: "EMILE", email: null, phone: "5144023077" },
  { name: "KARINA", email: "carrerakarina100@yahoo.com", phone: "4388653634" },
  { name: "OLGA", email: null, phone: "4388722490" },
  { name: "michelle", email: "michelledesirfaustin@yahoo.fr", phone: "4388787432" },
  { name: "CHELLA", email: "chellasainte@gmail.com", phone: "4386225435" },
  { name: "JEAN MICHEL", email: "desir.jm@hotmail.com", phone: "4388802070" },
  { name: "PHILOGENE", email: null, phone: "4388865175" },
  { name: "ISSA", email: null, phone: "4382268379" },
  { name: "OSCAR ARMANDO", email: null, phone: "5148300760" },
  { name: "ALEXANDRA", email: null, phone: "4388849568" },
  { name: "FRANCINE", email: null, phone: "5146868734" },
  { name: "PIERRE", email: "plecuyer777@gmail.com", phone: "4388705213" },
  { name: "FADILA", email: "fadilachelghoum767@gmail.com", phone: "4388818332" },
  { name: "KATHIANA", email: null, phone: "4389512763" },
  { name: "RICOT", email: null, phone: "4387659829" },
  { name: "YVES", email: null, phone: "4388785089" },
  { name: "ISLINNE", email: null, phone: "5144758970" },
  { name: "CLAUDIE", email: null, phone: "4387645062" },
  { name: "ST JUSTE", email: null, phone: "4389254399" },
  { name: "DANIELLE", email: "Daniellegi11@outlook.com", phone: "5142696638" },
  { name: "MARIE JUDE CARMELLE", email: "njudelacroix@yahoo.com", phone: "4389341698" },
  { name: "YANIS", email: null, phone: "4382706522" },
  { name: "STEPHANE", email: "sstecroix5@gmail.com", phone: "5148298765" },
  { name: "JOCELYNE", email: null, phone: "5148300228" },
  { name: "HITLER", email: "hilldyou@gmail.com", phone: "4388775981" },
  { name: "CHANTAL", email: "chantalmailloux0029@gmail.com", phone: "5142092556" },
  { name: "MARIE CARMEN", email: null, phone: "5142691663" },
  { name: "SOUAD", email: "sakinamekla@icloud.com", phone: "4388632078" },
  { name: "Schneider", email: "schneideraltidor90@gmail.com", phone: "4389515859" },
  { name: "OLIVIER", email: "ELISE.SEVERE@GMAIL.COM", phone: "4388701919" },
  { name: "ERIC", email: "hameleric754@gmail.com", phone: "5142694675" },
  { name: "DIEUNOR", email: null, phone: "4389890631" },
  { name: "EVENA", email: null, phone: "4388372590" },
  { name: "MORE IVETH", email: null, phone: "5142691480" },
  { name: "YVES", email: null, phone: "4387779876" },
  { name: "JESSIKA", email: null, phone: "4388847326" },
  { name: "YVAN RENAUD", email: null, phone: "4384588819" },
  { name: "KETELIE", email: "oldo.lavaud@icloud.com", phone: "4388884212" },
  { name: "JOSEPH MICHEL", email: null, phone: "4388672910" },
  { name: "KARLA IVONE", email: "karlalopez7123@icloud.com", phone: "4389512829" },
  { name: "JOAS", email: null, phone: "4388707914" },
  { name: "ESTIMAT", email: "adlineestimat9@gmail.com", phone: "4388299324" },
  { name: "DJEDELINE", email: null, phone: "4389851608" },
  { name: "EVELIN JADIRA", email: null, phone: "4388699089" },
  { name: "REDELINE", email: "credeline@gmail.com", phone: "4389517817" },
  { name: "ISABELLE", email: "ISA.DENIS2@HOTMAIL.COM", phone: "4383961212" },
  { name: "SUSAN", email: "susan.hamade90@gmail.com", phone: "5146592002" },
  { name: "SHIRLEY BARIL", email: null, phone: "4383917037" },
  { name: "AMANTINA", email: "masielnunez1@hotmail.com", phone: "4389516342" },
  { name: "ANNE GELINAS / SYLVIE", email: null, phone: "5142408383" },
  { name: "FRANCOIS FREDDY", email: "BLAISBADILLOF@GMAIL.COM", phone: "5149131944" },
  { name: "DIEGO ALEJANDRO", email: null, phone: "4388837525" },
  { name: "ROOSEVELT", email: null, phone: "4388606306" },
  { name: "FREDERIC", email: "fred@atelierdistinction.ca", phone: "5145539092" },
  { name: "CHERY", email: null, phone: "4388823313" },
  { name: "MOHAND AKLI", email: "meziantakli@gmail.com", phone: "4382231404" },
  { name: "NKODIA GARCIA", email: "nkodiagarcia@gmail.com", phone: "5146019966" },
  { name: "MARIE ROSETTE", email: null, phone: "4388776482" },
  { name: "TANDOGAN", email: "tandogandenizaltuntas@gmail.com", phone: "5142690144" },
  { name: "GUERLYNE", email: null, phone: "8733767399" },
  { name: "WILDY", email: null, phone: "5142953946" },
  { name: "MAMADOU DIAN", email: null, phone: "4387644537" },
  { name: "BETTY", email: "bettymercier@gmail.com", phone: "4388658615" },
  { name: "DAHLEN", email: "queendahlen8@gmail.com", phone: "5145669057" },
  { name: "LYNN", email: null, phone: "4388856621" },
  { name: "CHARLENE OLIVIA", email: null, phone: "4387648519" },
  { name: "MARC OLIVIER", email: null, phone: "4388651285" },
  { name: "ROMEO", email: null, phone: "5143226449" },
  { name: "GERDA", email: null, phone: "5149171617" },
  { name: "RODICA", email: null, phone: "4388689304" },
  { name: "MICHAELLE", email: null, phone: "5148311619" },
  { name: "VERONIQUE", email: null, phone: "5149787185" },
  { name: "MARIE", email: "j.mariestephanie4@gmail.com", phone: "5143492384" },
  { name: "JOE KENSKY", email: null, phone: "4388679133" },
  { name: "PASCAL", email: "pascalruthd@yahoo.ca", phone: "5142916303" },
  { name: "OSCAR ROLANDO", email: null, phone: "4387650480" },
  { name: "NATACHA", email: "n.ambroise@hotmail.com", phone: "5144429495" },
  { name: "JUDITH", email: "judithjean144@gmail.com", phone: "4382267723" },
  { name: "ALABY", email: "nuvobnuvo@gmail.com", phone: "4389512173" },
  { name: "CHRIS MARTINE", email: "cmbpharmd@hotmail.com", phone: "4388641502" },
  { name: "Klaus piter", email: null, phone: "4383495805" },
  { name: "Ruth", email: "petitfrereruth@hotmail.com", phone: "4388891895" },
  { name: "MICHEALLE", email: "aglaiseaudain@hotmail.com", phone: "4388678314" },
  { name: "UYGUR", email: null, phone: "4389518751" },
  { name: "PETIT FRERE", email: "judep1986@gmail.com", phone: "4384670018" },
  { name: "Yurii", email: null, phone: "5148865715" },
  { name: "ELBA", email: null, phone: "4388301084" },
  { name: "PATRICK", email: "pathouco123@yahoo.com", phone: "5143779316" },
  { name: "Djimy", email: null, phone: "5144631291" },
  { name: "ZAKARIA", email: null, phone: "4388737054" },
  { name: "NATHALIE", email: "nathalie_delorme@videotron.ca", phone: "5149524061" },
  { name: "SHERLYNE MANOUCHKA", email: null, phone: "5142445209" },
  { name: "FATIMA", email: "fatimaaw@icloud.com", phone: "5143240150" },
  { name: "YOKASTI POLANCO", email: "yokasti.polanco1980@gmail.com", phone: "5148382722" },
  { name: "DANIE", email: "donieremilien@gmail.com", phone: "4388722500" },
  { name: "MOHAMED LAMINE", email: null, phone: "4382829188" },
  { name: "AHMED", email: null, phone: "4388742607" },
  { name: "BEVERLEY", email: null, phone: "5149623461" },
  { name: "DANIEL", email: "yellea4t@gmail.com", phone: "4388600189" },
  { name: "VIVIANNE", email: null, phone: "5142174245" },
  { name: "WALVER", email: null, phone: "5144429327" },
  { name: "MELYNA", email: null, phone: "4508035336" },
  { name: "SILVANA", email: null, phone: "5149185665" },
  { name: "CAMITA", email: "serviusmarie1001@gmail.com", phone: "4388633056" },
  { name: "KARINE", email: null, phone: "4388873554" },
  { name: "DANIEL", email: "fenelusdaniel649@gmail.com", phone: "4388641804" },
  { name: "GIHAN", email: "cicokayali@gmail.com", phone: "4385401453" },
  { name: "JEAN", email: "JEANGAGNON2019@GMAIL.COM", phone: "5149844221" },
  { name: "ESSID", email: "lotfiessid84@gmail.com", phone: "4388604270" },
  { name: "JEAN-GABRIEL", email: null, phone: "5147772182" },
  { name: "FRANTZ", email: null, phone: "5148293014" },
  { name: "MUSTAFA", email: null, phone: "4388722960" },
  { name: "JEAN-PIERRE", email: null, phone: "5147105513" },
  { name: "Nadiia", email: null, phone: "5148863461" },
  { name: "CLAUDE", email: null, phone: "5146179688" },
  { name: "ERICK", email: "erickfrancois614@gmail.com", phone: "5142911537" },
  { name: "EDNEL", email: "placideednel229@gmail.com", phone: "4386864974" },
  { name: "BENICIA", email: null, phone: "4389353330" },
  { name: "EVERARDO", email: null, phone: "4388753760" },
  { name: "AMINA", email: null, phone: "5142698811" },
  { name: "ROY ANDRES", email: null, phone: "5147779814" },
  { name: "MARC ELTON FRANCLEY", email: null, phone: "5148387902" },
  { name: "PIERRE-ANDRÉ", email: null, phone: "5144636538" },
  { name: "YINET", email: "yinaval@gmail.com", phone: "4382279550" },
  { name: "PIETRO", email: null, phone: "5149614127" },
  { name: "WILNER", email: null, phone: "5145574536" },
  { name: "SERGIO", email: null, phone: "4388605388" },
  { name: "HENRY", email: null, phone: "4383462088" },
  { name: "SILENCE", email: "silencepierre@gmail.com", phone: "5142913667" },
  { name: "SEMELFORT", email: null, phone: "4388788420" },
  { name: "BRUNEL", email: null, phone: "4388310646" },
  { name: "OLENA", email: null, phone: "4389517625" },
  { name: "KENCIA", email: null, phone: "5148051275" },
  { name: "ANACLETO GOAO BATOMBO", email: null, phone: "5142995404" },
  { name: "TOYESE WASIU", email: null, phone: "4388838583" },
  { name: "NEFFETI", email: "nejib.neffati@gmail.com", phone: "4388213518" },
  { name: "NADJIB", email: "affounmadjib@gmail.com", phone: "4388818582" },
  { name: "KENNY", email: null, phone: "4385279998" },
  { name: "JAMSKY BASTIEN", email: null, phone: "4389332545" },
  { name: "FRANCOIS", email: "jfranckwebx@yahoo.com", phone: "4388734739" },
  { name: "TERESA DE JESUS", email: null, phone: "5146185203" },
  { name: "MARIAMA", email: null, phone: "5148838919" },
  { name: "ALDO EMMANUEL", email: null, phone: "4388894252" },
  { name: "GARDINE", email: null, phone: "4388706016" },
  { name: "JOLIE NDEFI", email: "joliendefi@gmail.com", phone: "5148673906" },
  { name: "YVELINE", email: null, phone: "5145467067" },
  { name: "JACQUES", email: "marteljay@hotmail.com", phone: "4384903541" },
  { name: "SAMIR", email: "kahinakaho78@gmail.com", phone: "4383088710" },
  { name: "lizotte", email: "m-lizotte@hotmail.com", phone: "5147133774" },
  { name: "REINA ISABEL", email: null, phone: "4389347080" },
  { name: "ISHAK", email: "gafourishak@gmail.com", phone: "4388315488" },
  { name: "NOELENE", email: null, phone: "4383455807" },
  { name: "GUILLAUME JOSEPH", email: null, phone: "4382205553" },
  { name: "LUCETTE", email: "juncolin@gmail.com", phone: "4383459518" },
  { name: "MARJORIE", email: null, phone: "4389514131" },
  { name: "AKLI AIT", email: "aklii002@outlook.fr", phone: "5142699785" },
  { name: "SAIDA", email: null, phone: "4387647257" },
  { name: "PABLO", email: null, phone: "4388303899" },
  { name: "DANY", email: null, phone: "5148631195" },
  { name: "BARBARA", email: "BARBARAL@GMAIL.COM", phone: "4389943462" },
  { name: "MARCELE", email: "emilimarcele@gmail.com", phone: "5143779841" },
  { name: "FATOU", email: null, phone: "5146163557" },
  { name: "MARIE CARMELLE", email: null, phone: "4389387641" },
  { name: "CARLOS ALFREDO", email: null, phone: "5143820792" },
  { name: "JOSEPH", email: null, phone: "5145260625" },
  { name: "ROGER JOEL", email: "rogercaballo272@gmail.com", phone: "4384954199" },
  { name: "ARMAND PEGUY", email: "asaeleliel2021@gmail.com", phone: "5146172409" },
  { name: "Naika", email: "naikamartine@gmail.com", phone: "5148217129" },
  { name: "STARLINE", email: null, phone: "4382336069" },
  { name: "MOUAD", email: null, phone: "4383452200" },
  { name: "FELYCIA", email: null, phone: "5145776301" },
  { name: "JESSE", email: null, phone: "5142690078" },
  { name: "RICHARD", email: null, phone: "4383541744" },
  { name: "JACQUES", email: null, phone: "5146776634" },
  { name: "LY", email: null, phone: "4388855279" },
  { name: "AMINA", email: null, phone: "4389511005" },
  { name: "MARIO", email: null, phone: "5142693360" },
  { name: "JEAN ABIAS", email: null, phone: "5149455128" },
  { name: "RACHEL", email: null, phone: "4388653050" },
  { name: "MONIQUE", email: "pren-1-@hotmail.com", phone: "5148292198" },
  { name: "FRANCE", email: null, phone: "4388670122" },
  { name: "SERGE", email: null, phone: "5149262424" },
  { name: "MYRTH-DANIELLE", email: null, phone: "4383460150" },
  { name: "DIANE", email: null, phone: "5145129769" },
  { name: "MOHAMED HEDI", email: null, phone: "5149624322" },
  { name: "Isabelle", email: null, phone: "5148385526" },
  { name: "FENEL", email: null, phone: "5142160723" },
  { name: "WILFRID", email: "westimable@hotmail.com", phone: "5149090778" },
  { name: "DANIEL", email: null, phone: "5146860848" },
  { name: "JEAN-BAPTISTE", email: null, phone: "4388308482" },
  { name: "EVANS", email: null, phone: "4387630458" },
  { name: "PIERRE", email: "kappysyril@gmail.com", phone: "4388708222" },
  { name: "DELY", email: null, phone: "4388670642" },
  { name: "GUERINO", email: null, phone: "4388723807" },
  { name: "ABDELAZIZ", email: null, phone: "5142625944" },
  { name: "TAMAIRA ARELIS", email: null, phone: "5148290724" },
  { name: "ISABELLE", email: "bebel@live.ca", phone: "5142692001" },
  { name: "JN PHILIPPE", email: null, phone: "5144675934" },
  { name: "NANOU", email: null, phone: "5144441013" },
  { name: "marques", email: "pavagemarques@gmail.com", phone: "5148309059" },
  { name: "JOSETTE", email: "josiebecham@yahoo.ca", phone: "4389392053" },
  { name: "ANDRE", email: "martineauandre1@gmail.com", phone: "4388652784" },
  { name: "JUAN JOSE", email: null, phone: "5146385131" },
  { name: "ERIC", email: null, phone: "4387645605" },
  { name: "RACHID", email: "rachidamiar@hotmail.com", phone: "4388671172" },
  { name: "quispe zamudio", email: null, phone: "5149954887" },
  { name: "DANNY", email: "dannymoreira18@protonmail.com", phone: "4389510676" },
  { name: "DARLING", email: null, phone: "5143584718" },
  { name: "JONATHAN", email: null, phone: "4384019383" },
  { name: "MARGUELINE", email: null, phone: "4388368827" },
  { name: "NGU PHUNG", email: "phungquach33366@gmail.com", phone: "5145810966" },
  { name: "JEAN CALVIN", email: null, phone: "4388606623" },
  { name: "HARRY", email: null, phone: "5142689822" },
  { name: "YOUDE SCHNEIDERLINE", email: null, phone: "4382255301" },
  { name: "Berc", email: null, phone: "5147957978" },
  { name: "MORIN", email: null, phone: "5145773385" },
  { name: "CAROLE", email: null, phone: "5146320217" },
  { name: "WNTER JONATAN", email: "winterpaiz23@gmail.com", phone: "4388605853" },
  { name: "RICHARD", email: "rickrack111@gmail.com", phone: "4383544461" },
  { name: "WALEX", email: "walexlaf@gmail.com", phone: "4388249835" },
  { name: "YVES FLORENT", email: "yves@bakana.net", phone: "4388608020" },
  { name: "DANA-MARCEL", email: null, phone: "4388651030" },
  { name: "FRANCE", email: null, phone: "5148820397" },
  { name: "PASCAL", email: null, phone: "5148354311" },
  { name: "JEAN MONFILS", email: null, phone: "4388795721" },
  { name: "IFEYINWA VIVIEN", email: null, phone: "4388673775" },
  { name: "ANTONIO", email: null, phone: "4387735242" },
  { name: "Hobenson", email: null, phone: "4389517614" },
  { name: "YOLETTE", email: null, phone: "5142692310" },
  { name: "MEHMET", email: null, phone: "4389512058" },
  { name: "ZIBERMAN", email: null, phone: "5145767363" },
  { name: "TURCILE", email: null, phone: "5143215223" },
  { name: "MARIE GERTHA", email: null, phone: "4389369201" },
  { name: "SHELBY", email: null, phone: "5148174864" },
  { name: "SILVESTRE", email: null, phone: "4388766982" },
  { name: "L.TJADEN", email: "stvryl.tjaden21@gmail.com", phone: "5142967705" },
  { name: "CYNTHIA", email: null, phone: "4383507114" },
  { name: "GINA", email: null, phone: "4388362923" },
  { name: "CLAUDY KERBY", email: "CLAUDY@GMAIL.COM", phone: "4389511926" },
  { name: "MARIAMA", email: null, phone: "5145499995" },
  { name: "NOUREDDINE", email: null, phone: "5142669448" },
  { name: "lucia", email: "binilucia47@gmail.com", phone: "4388802359" },
  { name: "marie", email: "mariecorellette4@gmail.com", phone: "5148052551" },
  { name: "VANESSA", email: null, phone: "5148217735" },
  { name: "MARIE-FRANCE", email: "marie-france_esposito@hotmail.com", phone: "5148838971" },
  { name: "MARIE VICTORIE", email: null, phone: "5148021275" },
  { name: "sandra", email: "sandra.rousseau94@hotmail.com", phone: "4383983094" },
  { name: "GILLES", email: null, phone: "4388867154" },
  { name: "PIERRE", email: "pierregusmene18@gmail.com", phone: "4389949715" },
  { name: "WILMINE", email: "wilmineetienne57@gmail.com", phone: "4388835285" },
  { name: "SYLVAIN", email: null, phone: "4389352254" },
  { name: "JUSTIN", email: null, phone: "4387633284" },
  { name: "ROBERT", email: null, phone: "5148212261" },
  { name: "JEAN-JACQUES", email: null, phone: "4388847087" },
  { name: "GIANNINA MARINA", email: "sulcaruedagiannina@gmail.com", phone: "4388695039" },
  { name: "HASSAN", email: "idrismasl@hotmail.com", phone: "5149984095" },
  { name: "JUNIOR", email: "dalicejunior9@gmail.com", phone: "5144624439" },
  { name: "MOHAMED", email: null, phone: "4388739892" },
  { name: "MARC", email: null, phone: "4389206771" },
  { name: "LOUIS ROGER", email: "boloroger@yahoo.fr", phone: "4388285503" },
  { name: "VANNA", email: null, phone: "5142912500" },
  { name: "NOVEMBRE", email: "novembresuze3510@gmail.com", phone: "4388838314" },
  { name: "HECTOR MANUEL", email: null, phone: "2639997971" },
  { name: "GEPHTHE", email: "gephthe.x.blanc@haleon.com", phone: "5144431060" },
  { name: "ROBERT YAW", email: null, phone: "5148053912" },
  { name: "Paulene Francois", email: "paulenemr@gmail.com", phone: "5142692861" },
  { name: "MARIE-PAULE", email: null, phone: "5147816953" },
  { name: "ALINE", email: null, phone: "5143850534" },
  { name: "CAROLE", email: null, phone: "5143775999" },
  { name: "EMMANUEL", email: null, phone: "4388359961" },
  { name: "STEPHANE", email: null, phone: "5142698493" },
  { name: "KAHINA", email: "amezianekahina@outlook.fr", phone: "4389250473" },
  { name: "Juan Ramon", email: "jordanteodorojuanramon@gmail.com", phone: "5148211417" },
  { name: "JOSE ANDRES ALFREDO", email: "josenagonzalez97@gmail.com", phone: "4388284054" },
  { name: "YOUCEF", email: null, phone: "4388788665" },
  { name: "ANNIE", email: null, phone: "4383727198" },
  { name: "WILLIAM", email: null, phone: "4505018408" },
  { name: "JODELIE", email: null, phone: "4389519687" },
  { name: "ROBERSON", email: null, phone: "4389364078" },
  { name: "maya", email: "noisetteviolet@gmail.com", phone: "5142692618" },
  { name: "Julie", email: null, phone: "5142692506" },
  { name: "MARIAM", email: null, phone: "4387877639" },
  { name: "ANDRE", email: null, phone: "4388605629" },
  { name: "ALEX", email: null, phone: "5142426605" },
  { name: "ADELINE", email: "adeline_leonard3@hotmail.fr", phone: "5146222730" },
  { name: "DRISS", email: null, phone: "2639993339" },
  { name: "LISE", email: null, phone: "5148820106" },
  { name: "JACQUELINE", email: null, phone: "2639993435" },
  { name: "RACHELE", email: null, phone: "4389785631" },
  { name: "MORENORD", email: null, phone: "4388862175" },
  { name: "JEAN ROBERT", email: null, phone: "4389353337" },
  { name: "lionel", email: "lionlabis@gmail.com", phone: "4388608410" },
  { name: "CYLIA", email: null, phone: "4388843738" },
  { name: "EMMANUEL", email: null, phone: "5148822661" },
  { name: "ROSA MARIA", email: null, phone: "4389512268" },
  { name: "JOCELYNE", email: "jsavard514@gmail.com", phone: "4388610699" },
  { name: "HERIBERTO", email: null, phone: "5144029231" },
  { name: "JEAN CLAUDE", email: null, phone: "5147910372" },
  { name: "JUDE", email: "JJUDEJEAN@YAHOO.IT", phone: "5148211805" },
  { name: "HOUSSAM", email: null, phone: "4387258784" },
  { name: "REZIKA", email: "rezikamedjnoun@gmail.com", phone: "4389858455" },
  { name: "DIEGO", email: "flexdiego17@gmail.com", phone: "4388604079" },
  { name: "DYMSON", email: "duvergerdymson2@gmail.com", phone: "4388670620" },
  { name: "Guervens", email: "guervensmoise470@gmail.com", phone: "4389259079" },
  { name: "IPHANIA", email: null, phone: "4388603520" },
  { name: "Claire", email: null, phone: "4388604416" },
  { name: "Walnick", email: "walnickfleury97@gmail.com", phone: "4389901742" },
  { name: "CARLOS ANDRES", email: null, phone: "4388610026" },
  { name: "MARIO DANIEL", email: null, phone: "4388685845" },
  { name: "Jean Balyte", email: null, phone: "4389273160" },
  { name: "KERSON", email: null, phone: "4387874182" },
  { name: "JACQUELINE", email: null, phone: "5146867594" },
  { name: "PHILIPPE", email: null, phone: "5148291454" },
  { name: "MERLIN YESENIA", email: "navarromerlin62@gmail.com", phone: "4388610189" },
  { name: "SOREL", email: null, phone: "4388736032" },
  { name: "CAROLLINE", email: "CAROLLINEBOUCHER403@gmail.com", phone: "5146229766" },
  { name: "HARRY", email: null, phone: "5149747147" },
  { name: "wisner", email: null, phone: "5148214478" },
  { name: "SANCHARAN", email: "s.sanja50@yahoo.ca", phone: "4388221325" },
  { name: "TEDDY OWEN", email: null, phone: "4388828201" },
  { name: "KARL", email: "karlgagnon1@gmail.com", phone: "5147545255" },
  { name: "JEFF EDGAR", email: null, phone: "4388250552" },
  { name: "KALAYA ELSA", email: "kayanorb@outlook.com", phone: "5142655584" },
  { name: "HUBERT", email: null, phone: "5148841569" },
  { name: "FATIMA", email: null, phone: "4168926581" },
  { name: "ZIAD", email: null, phone: "5149954009" },
  { name: "NADERGE", email: "nadergetchouandem@yahoo.com", phone: "5144758649" },
  { name: "STEVE ROSTAND", email: "STEVEFOKOUE@ICLOUD.COM", phone: "4389514455" },
  { name: "LENEUS", email: null, phone: "4388251096" },
  { name: "BENITHO", email: "benitho10.1@gmail.com", phone: "5147813363" },
  { name: "BENOIT", email: "benoitintin@yahoo.com", phone: "5142176092" },
  { name: "MARIA CARMELA", email: "sexydevi1508@gmail.com", phone: "4388612796" },
  { name: "WESLER", email: "WESCAMILLE@GMAIL.COM", phone: "4388825704" },
  { name: "STACY CARMELLE", email: null, phone: "5146887704" },
  { name: "ERICK KENETH", email: "elchacal.514@gmail.com", phone: "4389357738" },
  { name: "MAME MODOU", email: null, phone: "5148210454" },
  { name: "Martin", email: null, phone: "4388607546" },
  { name: "NABIL", email: null, phone: "4387645183" },
  { name: "CARL", email: null, phone: "5148169482" },
  { name: "ANILA", email: "anila-terzic@hotmail.com", phone: "4388274220" },
  { name: "FANNY", email: null, phone: "5148305357" },
  { name: "EVANS", email: null, phone: "5144417764" },
  { name: "SILVIO", email: "clausersilvio@gmail.com", phone: "5147124882" },
  { name: "HASTSADY", email: "randy.tpp@gmail.com", phone: "5197771964" },
  { name: "JEAN", email: null, phone: "5149957521" },
  { name: "JEAN BAPTISTE", email: "bazelaisjb42@gmail.com", phone: "5142221124" },
  { name: "RICHER & EMANUELLA", email: null, phone: "5144444144" },
  { name: "MICKEL ANGE", email: "mikelangemenelas@yahoo.com", phone: "4388612828" },
  { name: "Lakehal", email: null, phone: "4383465548" },
  { name: "ANGEL", email: null, phone: "5142061396" },
  { name: "NAWEL", email: null, phone: "5148082350" },
  { name: "EMILE", email: null, phone: "8739890418" },
  { name: "PAUL", email: null, phone: "4387642722" },
  { name: "EDELINE", email: null, phone: "4388816316" },
  { name: "DANNY", email: "DANNYG23@GMAIL.COM", phone: "5143777057" },
  { name: "DELSON", email: "sdelson765@gmail.com", phone: "2639993112" },
  { name: "INNOCENT", email: "donjeffte@gmail.com", phone: "4383089380" },
  { name: "ELIEZAIRE", email: null, phone: "5144629354" },
  { name: "MOKRANE", email: "youssefalgeria@gmail.com", phone: "4386807465" },
  { name: "DONNA", email: null, phone: "4388604405" },
  { name: "LOUIS JACQUES", email: "politique48@gmail.com", phone: "4388867974" },
  { name: "ELISCA", email: null, phone: "5142616993" },
  { name: "MANON", email: "marteljay@hotmail.com", phone: "5143220005" },
  { name: "SID AHMED", email: null, phone: "6474661969" },
  { name: "GUY", email: null, phone: "5149222424" },
  { name: "CHRISTIAN MARCOS", email: "CHRISTIAN.PEREYRA.3@ICLOUD.COM", phone: "4388657869" },
  { name: "CHANTAL", email: null, phone: "4384944903" },
  { name: "SAMMY", email: null, phone: "5145546685" },
  { name: "RONALD ELISEO", email: null, phone: "4388606135" },
  { name: "ELKA", email: "moraleselka1@hotmail.com", phone: "5142691813" },
  { name: "PIERRE", email: null, phone: "4389322992" },
  { name: "maude", email: null, phone: "4383687517" },
  { name: "jade", email: "magnier.m.mme@gmail.com", phone: "4388615147" },
  { name: "LEOCIANNE", email: null, phone: "4388832554" },
  { name: "HOUSSEM", email: null, phone: "4388266796" },
  { name: "SYLVANIE", email: null, phone: "4388299690" },
  { name: "NADIA", email: "nadiafrancois755@gmail.com", phone: "4386861452" },
  { name: "HASHEM", email: null, phone: "5145783034" },
  { name: "ARLANDDA", email: null, phone: "4388614715" },
  { name: "PEMBE", email: null, phone: "5148860575" },
  { name: "GILNOR", email: null, phone: "4389397030" },
  { name: "MYRTHA", email: null, phone: "5148054893" },
  { name: "MARIETOU", email: null, phone: "5149680075" },
  { name: "BEAUDOIN", email: null, phone: "4387647953" },
  { name: "MAME DIARRA", email: null, phone: "4388308182" },
  { name: "ABDELHAQ", email: "sariabdelhaq@gmail.com", phone: "5142693681" },
  { name: "DIEUDONNE", email: null, phone: "4388729535" },
  { name: "JESSICA", email: null, phone: "4506128767" },
  { name: "BLANCA DEL ROCIO YAGUANA", email: null, phone: "4382290412" },
  { name: "JN ANACIO", email: "anaciomathurin@gmail.com", phone: "5142699757" },
  { name: "GLORIA", email: null, phone: "5148319254" },
  { name: "NATHALIE", email: null, phone: "5148234067" },
  { name: "PASCAL", email: "pascalcoc@gmail.com", phone: "5142935734" },
  { name: "MARIE REJEANTE", email: null, phone: "5147997281" },
  { name: "NDOYA", email: null, phone: "4389394153" },
  { name: "VEILLOT", email: null, phone: "5145182027" },
  { name: "ROBERT", email: null, phone: "4383492811" },
  { name: "AWALIATOU MARIE", email: null, phone: "5142690801" },
  { name: "HEDI", email: "hedibenyounes@hotmail.com", phone: "5148214003" },
  { name: "EVENS", email: null, phone: "2639993967" },
  { name: "FEDER MAURICIO", email: "KARENSIILVA1995@GMAIL.COM", phone: "8192168532" },
  { name: "LETIZIA", email: null, phone: "4388827969" },
  { name: "ROCHENEL", email: null, phone: "5142990329" },
  { name: "MARIE-ANDREE", email: null, phone: "5147552171" },
  { name: "JUBA", email: null, phone: "4388657557" },
  { name: "MYRTHA", email: "monezaire126@gmail.com", phone: "5142691587" },
  { name: "NDEYE AISSATOU", email: "gueyeaissatou0105@gmail.com", phone: "4388260272" },
  { name: "MICHELINE", email: "michelineerius67@gmail.com", phone: "4389926509" },
  { name: "GULIN", email: null, phone: "4388606272" },
  { name: "RACHID", email: null, phone: "4382219928" },
  { name: "JOHNNY", email: null, phone: "4382238338" },
  { name: "GABRIEL", email: "gabrielgk67@icloud.com", phone: "4388676846" },
  { name: "JOSUE", email: null, phone: "4382335682" },
  { name: "SERGE", email: null, phone: "4388827396" },
  { name: "ARTURO", email: null, phone: "5146796309" },
  { name: "DOMENICA MARIE", email: "khadome2000@yahoo.com", phone: "5146222049" },
  { name: "JAMESON", email: "sidonnicejameson@gmail.com", phone: "5148211343" },
  { name: "MADIALITHA", email: null, phone: "4388686311" },
  { name: "RITHA", email: null, phone: "4389363781" },
  { name: "HUMBERTO REYES", email: "HRL123@HOTMAIL.COM", phone: "4388307167" },
  { name: "EDDY", email: "eddydenis0914@gmail.com", phone: "4388813784" },
  { name: "STEFAN DANIEL", email: null, phone: "4388603239" },
  { name: "Yurii", email: null, phone: "5148865393" },
  { name: "FRANK", email: null, phone: "4383462342" },
  { name: "JEAN YVES", email: null, phone: "5142691630" },
  { name: "MOCTAR", email: null, phone: "4388298617" },
  { name: "SAINTELLUS ALEXIS", email: null, phone: "4389852548" },
  { name: "Alma Thersa", email: null, phone: "5149662906" },
  { name: "RONY", email: null, phone: "4388617024" },
  { name: "YANNICK", email: "yannickvais@gmail.com", phone: "4388228246" },
  { name: "CELENE", email: "celenedivert@gmail.com", phone: "4388201013" },
  { name: "CLODALDO", email: "aldolouis@hotmail.com", phone: "4389300295" },
  { name: "MELANIE", email: null, phone: "5149928295" },
  { name: "JEROME", email: null, phone: "8192168220" },
  { name: "ANGEL MARTIN", email: "ANGELMARTIN345@GMAIL.COM", phone: "4388604569" },
  { name: "MARIE FLORE", email: null, phone: "5149771295" },
  { name: "GENESE", email: null, phone: "4389334857" },
  { name: "HUGUETTE", email: null, phone: "5148865350" },
  { name: "Marcelin", email: null, phone: "3679937065" },
  { name: "MARIE EDELLE", email: null, phone: "5148212022" },
  { name: "JACQUELINE J", email: null, phone: "5142229393" },
  { name: "THEAVY", email: null, phone: "4383372999" },
  { name: "CARLOS GUILLERMO", email: null, phone: "4388674830" },
  { name: "ANTONIO", email: null, phone: "4385807061" },
  { name: "EDUARDO", email: null, phone: "4383683069" },
  { name: "FRANCESCO", email: null, phone: "2639997700" },
  { name: "RACHID", email: null, phone: "4388673681" },
  { name: "KAREN YESENIA", email: "karenyesenialaracalderon@gmail.com", phone: "4389370760" },
  { name: "KEASSIENE", email: "KEASSIENE@GMAIL.COM", phone: "4389235658" },
  { name: "AMY", email: null, phone: "4388844667" },
  { name: "LEOPOLD", email: null, phone: "4388857042" },
  { name: "LUIGI", email: null, phone: "4388795313" },
  { name: "WILDER", email: null, phone: "4388359203" },
  { name: "LUMINITA", email: null, phone: "4382239373" },
  { name: "PEGGY", email: null, phone: "5148520501" },
  { name: "MARC", email: null, phone: "5143185491" },
  { name: "WISNA", email: null, phone: "4389226694" },
  { name: "Mohamad", email: "mohammad06@hotmail.com", phone: "4387639545" },
  { name: "HALIMA", email: null, phone: "4388644111" },
  { name: "JEAN LORFILS", email: null, phone: "4389515650" },
  { name: "Iryna", email: null, phone: "5148864136" },
  { name: "RAYMOND", email: "raymonddutremble@gmail.com", phone: "5147775693" },
  { name: "BECKENSON", email: null, phone: "5145891656" },
  { name: "WISLIN JEFF", email: null, phone: "4388648059" },
  { name: "LUIS ROBERTO", email: null, phone: "5142926650" },
  { name: "JEAN WILEQUE", email: null, phone: "4389347082" },
  { name: "MANUEL", email: null, phone: "5143583263" },
  { name: "LAURA", email: null, phone: "5143228057" },
  { name: "NICOLE", email: null, phone: "4388740032" },
  { name: "STEPHANIE", email: null, phone: "4382264754" },
  { name: "FANTA", email: null, phone: "4389514630" },
  { name: "MEHDI", email: null, phone: "4389885859" },
  { name: "LUCIEN", email: null, phone: "5149953249" },
  { name: "JENNY", email: null, phone: "4388863101" },
  { name: "RACHELLE", email: null, phone: "4388784420" },
  { name: "BERMATHE", email: null, phone: "4384580959" },
  { name: "DIDEROT", email: null, phone: "5145674013" },
  { name: "KATHY", email: null, phone: "4386226373" },
  { name: "ROSA ANGELICA", email: null, phone: "4388375430" },
  { name: "ALBERT", email: null, phone: "5149689557" },
  { name: "MADLYNE", email: null, phone: "5146166850" },
  { name: "MARC ELTON FRANCLEY", email: "henryeltonmarc@gmail.com", phone: "4388835700" },
  { name: "JOEL", email: null, phone: "4389305092" },
  { name: "JOSE EDGAR FLAMINIO", email: null, phone: "5148501050" },
  { name: "SHELA", email: null, phone: "4388615643" },
  { name: "BERTHA", email: null, phone: "4388773695" },
  { name: "Shaima", email: null, phone: "5147795108" },
  { name: "PAUNIQUE DESTIN", email: "pauniquedestin@gmail.com", phone: "4389787170" },
  { name: "EUSTACIO UVALDO", email: null, phone: "5149288121" },
  { name: "JULES", email: null, phone: "5142653261" },
  { name: "WIDLINE", email: null, phone: "5146774676" },
  { name: "fethi", email: "fetiaydogdu.fa@gmail.com", phone: "4388676873" },
  { name: "SEYDOU", email: "sedibeseydou2251@gmail.com", phone: "4389889459" },
  { name: "Julie", email: null, phone: "4385264992" },
  { name: "MICHEL", email: null, phone: "5149778239" },
  { name: "MAMADOU LAMINE", email: null, phone: "5148210457" },
  { name: "ANGELA", email: null, phone: "5144320439" },
  { name: "RIGOBERTO", email: null, phone: "5142698448" },
  { name: "CECILE", email: "cecileladouceur@yahoo.ca", phone: "4388784812" },
  { name: "ABDELKRIM", email: null, phone: "4388308194" },
  { name: "Mona", email: null, phone: "5142698482" },
  { name: "HAMID", email: "hamid.ghajji@gmail.com", phone: "4388644809" },
  { name: "ABDELAZIZ", email: null, phone: "4387647732" },
  { name: "DANY", email: null, phone: "2639990498" },
  { name: "ENERS", email: null, phone: "5148176202" },
  { name: "PIERRE", email: null, phone: "5148357775" },
  { name: "GUY", email: "orlandovidal1@outlook.com", phone: "4389227104" },
  { name: "Delvia", email: null, phone: "5142690461" },
  { name: "OUERDIA BENCHALAL", email: null, phone: "5143371430" },
  { name: "CHARLES", email: null, phone: "4388606700" },
  { name: "NADEGE", email: null, phone: "4388674042" },
  { name: "YAO AMANI", email: "kyaopatrice85@gmail.com", phone: "6138059064" },
  { name: "SADRACK", email: null, phone: "4387646502" },
  { name: "JUDITH", email: null, phone: "4383457944" },
  { name: "ANAÏSSA SIRENA", email: null, phone: "5146689062" },
  { name: "RENE TADEO", email: null, phone: "4387645154" },
  { name: "tang", email: null, phone: "5149688866" },
  { name: "MARIE LAURE", email: "marielaure1971@hotmail.com", phone: "5146775579" },
  { name: "SERGO", email: null, phone: "4389230695" },
  { name: "VINCENZO", email: null, phone: "4389331432" },
  { name: "OGUZHAN", email: "oguzhankeles@gmail.com", phone: "6479893461" },
  { name: "AUGUSTE", email: "tikandeceide@gmail.com", phone: "4389896896" },
];

export function BulkImportClientsDialog({ open, onOpenChange }: BulkImportClientsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [importComplete, setImportComplete] = useState(false);

  const totalClients = clientsToImport.length;
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  const handleImport = async () => {
    setIsImporting(true);
    setProgress(0);
    setResults([]);
    setImportComplete(false);

    try {
      // Import in batches of 50 to avoid timeouts
      const batchSize = 50;
      const allResults: ImportResult[] = [];

      for (let i = 0; i < clientsToImport.length; i += batchSize) {
        const batch = clientsToImport.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke("admin-bulk-import-clients", {
          body: { clients: batch },
        });

        if (error) {
          console.error("Batch import error:", error);
          toast({
            title: "Erreur d'import",
            description: error.message,
            variant: "destructive",
          });
          break;
        }

        if (data?.results) {
          allResults.push(...data.results);
          setResults([...allResults]);
        }

        setProgress(Math.min(100, Math.round(((i + batch.length) / clientsToImport.length) * 100)));
      }

      setImportComplete(true);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });

      toast({
        title: "Import terminé",
        description: `${allResults.filter(r => r.success).length} clients importés sur ${clientsToImport.length}`,
      });
    } catch (err) {
      console.error("Import error:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'import",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      setResults([]);
      setProgress(0);
      setImportComplete(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import en masse des clients
          </DialogTitle>
          <DialogDescription>
            Importer {totalClients} clients depuis le fichier Excel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!importComplete && !isImporting && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                Cette action va créer {totalClients} comptes clients. Les emails invalides 
                (comme noemail@telus.com, x@gmail.com) seront ignorés et un email temporaire 
                sera généré basé sur le numéro de téléphone.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Emails valides: {clientsToImport.filter(c => c.email && !c.email.includes("noemail") && !c.email.includes("x@")).length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>Sans email valide: {clientsToImport.filter(c => !c.email || c.email.includes("noemail") || c.email.includes("x@")).length}</span>
                </div>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progression de l'import...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm font-medium">
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {successCount} importés
                </Badge>
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {errorCount} erreurs
                </Badge>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg p-2">
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        result.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{result.name}</span>
                        <span className="text-muted-foreground">{result.phone}</span>
                      </div>
                      {result.error && (
                        <span className="text-red-500 text-xs">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            {importComplete ? "Fermer" : "Annuler"}
          </Button>
          {!importComplete && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Lancer l'import ({totalClients} clients)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
