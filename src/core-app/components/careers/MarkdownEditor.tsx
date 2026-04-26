/**
 * MarkdownEditor — Two-tab markdown editor with live preview.
 * Used for job descriptions and email template bodies.
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, Link2, Heading2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, rows = 12, placeholder }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  const wrap = (before: string, after = before) => {
    const ta = document.activeElement as HTMLTextAreaElement | null;
    if (!ta || ta.tagName !== "TEXTAREA") {
      onChange(value + before + after);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  };

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between border-b px-2 py-1 bg-muted/30">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="write" className="h-6 text-xs">Éditer</TabsTrigger>
            <TabsTrigger value="preview" className="h-6 text-xs">Aperçu</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "write" && (
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrap("**")} title="Gras">
              <Bold className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrap("_")} title="Italique">
              <Italic className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrap("\n## ", "\n")} title="Titre">
              <Heading2 className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrap("\n- ", "")} title="Liste">
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrap("[", "](https://)")} title="Lien">
              <Link2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {tab === "write" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="border-0 rounded-none focus-visible:ring-0 font-mono text-sm"
        />
      ) : (
        <div
          className="prose prose-sm max-w-none p-4 min-h-[200px]"
          style={{ minHeight: rows * 22 }}
        >
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Aucun contenu à prévisualiser</p>
          )}
        </div>
      )}
    </div>
  );
}
